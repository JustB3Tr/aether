"""Updater regression tests use mocked Docker and disposable files, never the NAS."""
import copy
import hashlib
import importlib.util
import io
import json
import pathlib
import tarfile
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('updater',pathlib.Path(__file__).with_name('aether-updater.py'))
up = importlib.util.module_from_spec(spec)
spec.loader.exec_module(up)


class FakeDocker:
    def __init__(self, base, failure=None):
        self.base, self.failure, self.fault_used = base, failure, False
        self.volume = base / 'volume'
        self.volume.mkdir()
        self.docker_root = base / 'docker-root'
        self.docker_root.mkdir()
        (self.volume / 'profile.json').write_text('saved before update')
        self.config = {'container':'aether-test','volume':'aether-test-data','port':15002,'hostIp':'127.0.0.1','env':[]}
        self.old_id, self.new_id = 'a' * 64, 'sha256:' + '2' * 64
        self.old_image_id = 'sha256:' + '1' * 64
        defaults = {'Cmd':['node','server.js'],'Entrypoint':['docker-entrypoint.sh'],'Env':['PATH=/usr/bin','NODE_VERSION=22','YARN_VERSION=1'],'Labels':{up.VERSION_LABEL:'5.0.0'},'WorkingDir':'/app','User':'','Healthcheck':{'Test':['CMD','curl','-f','http://localhost:3000/health']}}
        self.old_image = {'Id':self.old_image_id,'Os':'linux','Architecture':'amd64','Config':copy.deepcopy(defaults)}
        self.new_image = copy.deepcopy(self.old_image)
        self.new_image.update(Id=self.new_id)
        self.new_image['Config']['Labels'][up.VERSION_LABEL] = '5.0.1'
        self.old = {'Id':self.old_id,'Image':self.old_image_id,'Name':'/aether-test','Mounts':[{'Type':'volume','Name':self.config['volume'],'Destination':'/app/userdata','RW':True,'Source':str(self.volume)}], 'HostConfig':{'PortBindings':{'3000/tcp':[{'HostIp':'127.0.0.1','HostPort':'15002'}]},'NetworkMode':'bridge','RestartPolicy':{'Name':'unless-stopped'},'LogConfig':{'Type':'json-file','Config':{}}},'Config':{**copy.deepcopy(defaults),'Image':'aether:5.0.0','Hostname':self.old_id[:12]},'State':{'Running':True}}
        self.containers = {self.config['container']:copy.deepcopy(self.old)}
        self.volumes = {self.config['volume']:{'Name':self.config['volume'],'Labels':{}}}
        self.calls = []

    def find(self, key):
        if key in self.containers:
            return key,self.containers[key]
        for name, info in self.containers.items():
            if info['Id'] == key:
                return name,info
        raise RuntimeError('Docker inspect failed: No such object: ' + key)

    def inspect(self, key):
        return copy.deepcopy(self.find(key)[1])

    def fault(self, name):
        if self.failure == name and not self.fault_used:
            self.fault_used = True
            raise RuntimeError('Deliberate Docker failure after ' + name)

    def docker(self, *args, **kwargs):
        self.calls.append(args)
        if args[:2] == ('info','--format'):
            return str(self.docker_root)
        if args[:2] == ('image','inspect'):
            image = self.old_image if args[2] in (self.old_image_id,'aether:5.0.0') else self.new_image
            return json.dumps([image])
        if args[0] == 'load':
            return 'Loaded image: aether:5.0.1'
        if args[:2] == ('volume','create'):
            name = args[-1]
            label = args[args.index('--label')+1].split('=',1)
            self.volumes.setdefault(name,{'Name':name,'Labels':{label[0]:label[1]}})
            return name
        if args[:2] == ('volume','inspect'):
            if args[2] not in self.volumes:
                raise RuntimeError('Docker volume inspect failed: No such volume')
            return json.dumps([self.volumes[args[2]]])
        if args[:2] == ('volume','rm'):
            self.volumes.pop(args[2],None)
        elif args[0] == 'stop':
            self.find(args[-1])[1]['State']['Running'] = False
            self.fault('stop')
        elif args[0] == 'start':
            self.find(args[-1])[1]['State']['Running'] = True
        elif args[0] == 'rename':
            old_name, info = self.find(args[1])
            self.containers.pop(old_name)
            self.containers[args[2]] = info
            info['Name'] = '/' + args[2]
            self.fault('rename')
        elif args[0] == 'rm':
            name, _ = self.find(args[-1])
            self.containers.pop(name)
        elif args[0] == 'run':
            name = args[args.index('--name')+1]
            if name in self.containers:
                raise RuntimeError('Container name already in use')
            info = copy.deepcopy(self.old)
            info.update(Id='new-' + name,Image=self.new_id,Name='/' + name)
            info['Config'] = {**copy.deepcopy(self.new_image['Config']),'Image':'aether:5.0.1'}
            info['State']['Running'] = True
            if '--label' in args:
                key, value = args[args.index('--label')+1].split('=',1)
                info['Config']['Labels'][key] = value
            self.containers[name] = info
            if name == self.config['container']:
                (self.volume / 'profile.json').write_text('new image changed data')
                self.fault('replacement-run')
            else:
                self.fault('preflight-run')
            return info['Id']
        return ''

    def healthy(self, name, expected=None):
        if self.failure == 'preflight-health' and name != self.config['container']:
            raise RuntimeError('Deliberate preflight health failure')
        if self.failure in ('replacement-health','restore-extraction') and name == self.config['container']:
            raise RuntimeError('Deliberate replacement health failure')


class UpdaterTests(unittest.TestCase):
    def seed_rollback_set(self, fake, updater, stamp, include_backup=True):
        backup_dir = updater.backup_directory(create=True)
        container_name = fake.config['container'] + '-backup-' + stamp
        container_id = hashlib.sha256(stamp.encode()).hexdigest()
        image_id = 'sha256:' + hashlib.sha256((stamp + '-image').encode()).hexdigest()
        info = copy.deepcopy(fake.old)
        info.update(Id=container_id,Image=image_id,Name='/'+container_name)
        info['Config']['Image'] = 'aether:5.0.0'
        info['Config']['Labels'][up.VERSION_LABEL] = '5.0.0'
        info['State']['Running'] = False
        fake.containers[container_name] = info
        (backup_dir/(stamp+'-container.json')).write_text(json.dumps(info))
        if include_backup:
            with tarfile.open(backup_dir/(stamp+'-userdata.tar.gz'),'w:gz') as archive:
                root = tarfile.TarInfo('userdata')
                root.type = tarfile.DIRTYPE
                archive.addfile(root)
        return {
            'status':'successful','stamp':stamp,'containerName':container_name,
            'containerId':container_id,'imageId':image_id,
            'previousVersion':'5.0.0','installedVersion':'5.0.1'
        }

    def test_versions(self):
        self.assertGreater(up.version('v5.10.0'),up.version('5.9.9'))
        for value in ['latest','5.0','5.0.1-beta','v05.0.0','5.0.0;rm','-1.0.0']:
            with self.assertRaises(ValueError):
                up.version(value)

    def test_https_hosts(self):
        self.assertTrue(up.allowed_url('https://release-assets.githubusercontent.com/a'))
        for url in ['http://github.com/a','https://github.com.evil.test/a','https://a@github.com/a','https://github.com:8443/a','file:///tmp/a','https://127.0.0.1/a']:
            self.assertFalse(up.allowed_url(url))

    @staticmethod
    def release():
        return {'tag_name':'v5.0.1','assets':[{'name':name,'size':1,'browser_download_url':f'https://github.com/{up.REPO}/releases/download/v5.0.1/{name}'} for name in (up.ARCHIVE,up.MANIFEST)]}

    def test_pinned_release(self):
        release = self.release()
        self.assertEqual(len(up.release_assets(release)),2)
        for alteration in [{'prerelease':True},{'draft':True},{'assets':release['assets'][:1]},{'assets':release['assets']+[release['assets'][0]]}]:
            with self.assertRaises(ValueError):
                up.release_assets({**release,**alteration})
        release['assets'][0]['browser_download_url'] = release['assets'][0]['browser_download_url'].replace(up.REPO,'evil/aether')
        with self.assertRaises(ValueError):
            up.release_assets(release)

    def transaction(self, failure=None):
        with tempfile.TemporaryDirectory() as directory:
            base = pathlib.Path(directory)
            (base/'fake.tar.gz').write_bytes(b'disposable test archive')
            fake = FakeDocker(base,failure)
            updater = up.Updater(fake.config,base/'work')
            manifest = {'imageId':fake.new_id,'version':'5.0.1'}
            with patch.object(up,'docker',fake.docker), patch.object(up,'inspect',fake.inspect), patch.object(up,'verify_archive',return_value='aether:5.0.1'), patch.object(updater,'healthy',fake.healthy):
                if failure == 'backup':
                    with patch.object(tarfile.TarFile,'add',side_effect=OSError('Deliberate partial backup')):
                        with self.assertRaises(OSError):
                            updater.install(base/'fake.tar.gz',manifest,'5.0.1')
                elif failure == 'restore-extraction':
                    with patch.object(tarfile.TarFile,'extractall',side_effect=OSError('Deliberate extraction failure')):
                        with self.assertRaises(up.RollbackRequired):
                            updater.install(base/'fake.tar.gz',manifest,'5.0.1')
                    self.assertEqual((fake.volume/'profile.json').read_text(),'new image changed data')
                    self.assertIn('rollbackRequired',updater.state)
                    self.assertIn('transaction',updater.state)
                    self.assertEqual(updater.state['failedVersion'],'5.0.1')
                    return
                elif failure:
                    with self.assertRaises(RuntimeError):
                        updater.install(base/'fake.tar.gz',manifest,'5.0.1')
                else:
                    self.assertTrue(updater.install(base/'fake.tar.gz',manifest,'5.0.1'))
                    self.assertEqual(fake.containers[fake.config['container']]['Image'],fake.new_id)
                    self.assertEqual(updater.state['installedVersion'],'5.0.1')
                    self.assertTrue(pathlib.Path(updater.state['backupFile']).is_file())
                if failure:
                    self.assertEqual(fake.containers[fake.config['container']]['Id'],fake.old_id)
                    self.assertTrue(fake.containers[fake.config['container']]['State']['Running'])
                    self.assertEqual((fake.volume/'profile.json').read_text(),'saved before update')
                    self.assertEqual(updater.state.get('failedVersion'),'5.0.1' if failure in ('replacement-health','preflight-health') else None)
                self.assertNotIn('transaction',updater.state)
                self.assertFalse(any('docker.sock' in str(call) for call in fake.calls))
                self.assertFalse(any('preflight' in name for name in fake.containers))
                self.assertFalse(any('preflight' in name for name in fake.volumes))

    def test_successful_transaction(self): self.transaction()
    def test_failed_health_restores_image_and_data(self): self.transaction('replacement-health')
    def test_stop_succeeds_then_client_raises(self): self.transaction('stop')
    def test_rename_succeeds_then_client_raises(self): self.transaction('rename')
    def test_run_creates_container_then_client_raises(self): self.transaction('replacement-run')
    def test_partial_backup_restarts_original(self): self.transaction('backup')
    def test_failed_preflight_keeps_original(self): self.transaction('preflight-health')
    def test_failed_preflight_run_cleans_only_owned_resources(self): self.transaction('preflight-run')
    def test_failed_restore_keeps_live_files_and_marks_manual_recovery(self): self.transaction('restore-extraction')

    def test_rollback_retention_defaults_to_three_and_is_bounded(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(up.Updater({},pathlib.Path(directory)/'default').rollback_retention,3)
            self.assertEqual(up.Updater({'rollbackRetention':2},pathlib.Path(directory)/'custom').rollback_retention,2)
            for value in (True,0,11,'3'):
                with self.subTest(value=value),self.assertRaises(ValueError):
                    up.Updater({'rollbackRetention':value},pathlib.Path(directory)/'invalid')

    def test_legacy_last_backup_is_imported_only_when_its_set_is_complete(self):
        with tempfile.TemporaryDirectory() as directory:
            base = pathlib.Path(directory)
            fake = FakeDocker(base)
            updater = up.Updater(fake.config,base/'work')
            stamp = '20260101T000000000001Z'
            entry = self.seed_rollback_set(fake,updater,stamp)
            backup_file = updater.backup_directory()/(stamp+'-userdata.tar.gz')
            updater.state.update(installedVersion='5.0.1',installedAt=stamp,backupContainer=entry['containerName'],backupFile=str(backup_file))
            with patch.object(up,'docker',fake.docker),patch.object(up,'inspect',fake.inspect):
                self.assertEqual(updater.known_rollback_sets(),[entry])
                backup_file.unlink()
                self.assertEqual(updater.known_rollback_sets(),[])

    def test_successful_update_prunes_only_older_complete_sets_to_latest_three(self):
        with tempfile.TemporaryDirectory() as directory:
            base = pathlib.Path(directory)
            fake = FakeDocker(base)
            updater = up.Updater(fake.config,base/'work')
            stamps = [f'20260101T00000{i:07d}Z' for i in range(1,5)]
            entries = [self.seed_rollback_set(fake,updater,stamp) for stamp in stamps]
            updater.state['rollbackSets'] = entries
            failed_dir = updater.backup_directory()/(stamps[0]+'-failed-userdata')
            failed_dir.mkdir()
            failed_file = failed_dir/'profile.json'
            failed_file.write_text('preserve failed recovery data')
            # A matching name alone is not ownership. It is absent from updater state.
            unmanaged_name = fake.config['container']+'-backup-20250101T000000000001Z'
            unmanaged = copy.deepcopy(fake.old)
            unmanaged.update(Id='b'*64,Name='/'+unmanaged_name)
            unmanaged['State']['Running'] = False
            fake.containers[unmanaged_name] = unmanaged
            (base/'fake.tar.gz').write_bytes(b'disposable test archive')
            manifest = {'imageId':fake.new_id,'version':'5.0.1'}
            with patch.object(up,'docker',fake.docker),patch.object(up,'inspect',fake.inspect),patch.object(up,'verify_archive',return_value='aether:5.0.1'),patch.object(updater,'healthy',fake.healthy):
                self.assertTrue(updater.install(base/'fake.tar.gz',manifest,'5.0.1'))
            retained = updater.state['rollbackSets']
            self.assertEqual(len(retained),3)
            self.assertEqual([entry['stamp'] for entry in retained],stamps[-2:]+[updater.state['installedAt']])
            backup_dir = updater.backup_directory()
            for stamp in stamps[:2]:
                self.assertNotIn(fake.config['container']+'-backup-'+stamp,fake.containers)
                self.assertFalse((backup_dir/(stamp+'-userdata.tar.gz')).exists())
                self.assertFalse((backup_dir/(stamp+'-container.json')).exists())
            self.assertEqual(failed_file.read_text(),'preserve failed recovery data')
            for stamp in stamps[2:]:
                self.assertIn(fake.config['container']+'-backup-'+stamp,fake.containers)
                self.assertTrue((backup_dir/(stamp+'-userdata.tar.gz')).is_file())
                self.assertTrue((backup_dir/(stamp+'-container.json')).is_file())
            self.assertIn(unmanaged_name,fake.containers)
            self.assertTrue(fake.containers[fake.config['container']]['State']['Running'])
            self.assertFalse(any(args[:2] == ('rm','-v') for args in fake.calls))

    def test_retention_preserves_incomplete_failed_and_untracked_material(self):
        with tempfile.TemporaryDirectory() as directory:
            base = pathlib.Path(directory)
            fake = FakeDocker(base)
            updater = up.Updater(fake.config,base/'work')
            stamps = [f'20260101T00000{i:07d}Z' for i in range(1,4)]
            entries = [self.seed_rollback_set(fake,updater,stamp) for stamp in stamps]
            incomplete_stamp = '20250101T000000000001Z'
            incomplete = self.seed_rollback_set(fake,updater,incomplete_stamp,include_backup=False)
            entries.insert(0,incomplete)
            updater.state['rollbackSets'] = entries
            backup_dir = updater.backup_directory()
            failed_dir = backup_dir/(incomplete_stamp+'-failed-userdata')
            failed_dir.mkdir()
            failed_file = failed_dir/'profile.json'
            failed_file.write_text('preserve failed recovery data')
            loose_stamp = '20240101T000000000001Z'
            loose = self.seed_rollback_set(fake,updater,loose_stamp)
            # Leave this complete-looking set untracked so retention cannot claim it.
            untracked_name = loose['containerName']
            (backup_dir/(loose_stamp+'-userdata.tar.gz')).unlink()
            (backup_dir/(loose_stamp+'-container.json')).unlink()
            (backup_dir/(loose_stamp+'-container.json')).write_text(json.dumps(fake.containers[untracked_name]))
            (backup_dir/(loose_stamp+'-userdata.tar.gz')).write_bytes(b'untracked material')
            (base/'fake.tar.gz').write_bytes(b'disposable test archive')
            manifest = {'imageId':fake.new_id,'version':'5.0.1'}
            with patch.object(up,'docker',fake.docker),patch.object(up,'inspect',fake.inspect),patch.object(up,'verify_archive',return_value='aether:5.0.1'),patch.object(updater,'healthy',fake.healthy):
                self.assertTrue(updater.install(base/'fake.tar.gz',manifest,'5.0.1'))
            self.assertIn(incomplete,updater.state['rollbackSets'])
            self.assertIn(incomplete['containerName'],fake.containers)
            self.assertFalse((backup_dir/(incomplete_stamp+'-userdata.tar.gz')).exists())
            self.assertEqual(failed_file.read_text(),'preserve failed recovery data')
            self.assertIn(untracked_name,fake.containers)
            self.assertTrue((backup_dir/(loose_stamp+'-userdata.tar.gz')).is_file())
            self.assertTrue(fake.containers[fake.config['container']]['State']['Running'])

    def test_failed_replacement_does_not_prune_successful_or_failed_recovery_material(self):
        with tempfile.TemporaryDirectory() as directory:
            base = pathlib.Path(directory)
            fake = FakeDocker(base,'replacement-health')
            updater = up.Updater(fake.config,base/'work')
            stamps = [f'20260101T00000{i:07d}Z' for i in range(1,5)]
            entries = [self.seed_rollback_set(fake,updater,stamp) for stamp in stamps]
            updater.state['rollbackSets'] = entries
            (base/'fake.tar.gz').write_bytes(b'disposable test archive')
            with patch.object(up,'docker',fake.docker),patch.object(up,'inspect',fake.inspect),patch.object(up,'verify_archive',return_value='aether:5.0.1'),patch.object(updater,'healthy',fake.healthy):
                with self.assertRaises(RuntimeError):
                    updater.install(base/'fake.tar.gz',{'imageId':fake.new_id,'version':'5.0.1'},'5.0.1')
            backup_dir = updater.backup_directory()
            self.assertEqual(updater.state['rollbackSets'],entries)
            for stamp in stamps:
                self.assertIn(fake.config['container']+'-backup-'+stamp,fake.containers)
                self.assertTrue((backup_dir/(stamp+'-userdata.tar.gz')).is_file())
                self.assertTrue((backup_dir/(stamp+'-container.json')).is_file())
            failed_dirs = [path for path in backup_dir.iterdir() if path.name.endswith('-failed-userdata')]
            self.assertEqual(len(failed_dirs),1)
            self.assertTrue((failed_dirs[0]/'profile.json').is_file())
            self.assertEqual(fake.containers[fake.config['container']]['Id'],fake.old_id)
            self.assertTrue(fake.containers[fake.config['container']]['State']['Running'])

    def test_preflight_collision_does_not_remove_unowned_resources(self):
        with tempfile.TemporaryDirectory() as directory:
            fake = FakeDocker(pathlib.Path(directory))
            (pathlib.Path(directory)/'fake.tar.gz').write_bytes(b'disposable test archive')
            name = fake.config['container'] + '-update-preflight-collision'
            fake.containers[name] = {**copy.deepcopy(fake.old),'Id':'unrelated','Name':'/'+name}
            fake.volumes[name+'-data'] = {'Name':name+'-data','Labels':{}}
            updater = up.Updater(fake.config,pathlib.Path(directory)/'work')
            with patch.object(up,'docker',fake.docker), patch.object(up,'inspect',fake.inspect), patch.object(up,'verify_archive',return_value='aether:5.0.1'), patch.object(up.uuid,'uuid4',return_value=types.SimpleNamespace(hex='collision')):
                with self.assertRaises(RuntimeError):
                    updater.install(pathlib.Path(directory)/'fake.tar.gz',{'imageId':fake.new_id},'5.0.1')
            self.assertEqual(fake.containers[name]['Id'],'unrelated')
            self.assertIn(name+'-data',fake.volumes)
            self.assertTrue(fake.containers[fake.config['container']]['State']['Running'])

    def test_manually_stopped_container_is_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            fake = FakeDocker(pathlib.Path(directory))
            fake.containers[fake.config['container']]['State']['Running'] = False
            updater = up.Updater(fake.config,pathlib.Path(directory)/'work')
            with patch.object(up,'inspect',fake.inspect),patch.object(up,'download') as download:
                updater.check()
            download.assert_not_called()
            self.assertFalse(fake.containers[fake.config['container']]['State']['Running'])

    def test_transient_download_retries_without_blocking_release(self):
        with tempfile.TemporaryDirectory() as directory:
            fake = FakeDocker(pathlib.Path(directory))
            updater = up.Updater(fake.config,pathlib.Path(directory)/'work')
            attempts = []
            def download(url,limit,destination=None):
                if '/releases/latest' in url:
                    return json.dumps(self.release()).encode()
                if url.endswith(up.MANIFEST):
                    return b'{"version":"5.0.1","sha256":"stub"}'
                attempts.append(url)
                raise OSError('Temporary network failure')
            with patch.object(up,'inspect',fake.inspect),patch.object(up,'download',download):
                updater.check()
                updater.last_check = 0
                updater.check()
            self.assertEqual(len(attempts),2)
            self.assertNotIn('failedVersion',updater.state)

    def test_unsupported_configuration_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            fake = FakeDocker(pathlib.Path(directory))
            updater = up.Updater(fake.config,pathlib.Path(directory)/'work')
            with patch.object(up,'docker',fake.docker):
                updater.validate_container(fake.old)
                for key,value in [('ReadonlyRootfs',True),('CapDrop',['ALL']),('Memory',1000),('Dns',['1.1.1.1']),('Sysctls',{'net.ipv4.ip_forward':'0'}),('PidMode','host'),('SecurityOpt',['no-new-privileges']),('Tmpfs',{'/tmp':'rw'}),('NanoCpus',1000)]:
                    changed = copy.deepcopy(fake.old)
                    changed['HostConfig'][key] = value
                    with self.subTest(key=key),self.assertRaises(ValueError):
                        updater.validate_container(changed)
                for key,value in [('WorkingDir','/tmp'),('Healthcheck',{'Test':['NONE']}),('Env',['PATH=/changed']),('Labels',{'custom':'value'})]:
                    changed = copy.deepcopy(fake.old)
                    changed['Config'][key] = value
                    with self.subTest(key=key),self.assertRaises(ValueError):
                        updater.validate_container(changed)

    def test_empty_list_default_variants_and_configured_env_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            fake = FakeDocker(pathlib.Path(directory))
            fake.config['env'] = ['PORT=3000','PATH=/custom/bin']
            changed = copy.deepcopy(fake.old)
            changed['HostConfig']['Dns'] = []
            changed['HostConfig']['CapDrop'] = []
            changed['Config']['Env'] = ['PATH=/custom/bin','NODE_VERSION=22','YARN_VERSION=1','PORT=3000']
            updater = up.Updater(fake.config,pathlib.Path(directory)/'work')
            with patch.object(up,'docker',fake.docker):
                updater.validate_container(changed)
            args = updater.run_args('test','aether:5.0.1')
            self.assertIn('PATH=/custom/bin',args)
            self.assertIn('PORT=3000',args)

    def test_pending_recovery_stops_automatic_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            updater = up.Updater({'container':'test'},pathlib.Path(directory)/'work')
            updater.state['transaction'] = {'phase':'replacing'}
            with patch.object(up,'inspect') as inspect,patch.object(up,'download') as download:
                updater.check()
            inspect.assert_not_called()
            download.assert_not_called()

    def test_unsafe_backup_does_not_touch_live_userdata(self):
        with tempfile.TemporaryDirectory() as directory:
            base = pathlib.Path(directory)
            fake = FakeDocker(base)
            updater = up.Updater(fake.config,base/'work')
            backup_dir = updater.backup_directory(create=True)
            stamp = '20260101T000000000001Z'
            backup = backup_dir/(stamp+'-userdata.tar.gz')
            with tarfile.open(backup,'w:gz') as archive:
                member = tarfile.TarInfo('userdata-lookalike/profile.json')
                member.size = 3
                archive.addfile(member,io.BytesIO(b'bad'))
            with self.assertRaises(RuntimeError):
                updater.restore_userdata(backup,fake.volume,backup_dir,stamp)
            self.assertEqual((fake.volume/'profile.json').read_text(),'saved before update')

    def test_userdata_restore_rejects_paths_outside_managed_backup_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            base = pathlib.Path(directory)
            fake = FakeDocker(base)
            updater = up.Updater(fake.config,base/'work')
            backup_dir = updater.backup_directory(create=True)
            stamp = '20260101T000000000001Z'
            outside = base/(stamp+'-userdata.tar.gz')
            with tarfile.open(outside,'w:gz') as archive:
                root = tarfile.TarInfo('userdata')
                root.type = tarfile.DIRTYPE
                archive.addfile(root)
            with self.assertRaises(ValueError):
                updater.restore_userdata(outside,fake.volume,base,stamp)
            with self.assertRaises(ValueError):
                updater.restore_userdata(outside,fake.volume,backup_dir,stamp)
            self.assertEqual((fake.volume/'profile.json').read_text(),'saved before update')

    def test_archive_hash_platform_label_and_image_id(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)/up.ARCHIVE
            config = {'os':'linux','architecture':'amd64','config':{'Labels':{up.VERSION_LABEL:'5.0.1'}}}
            config_bytes = json.dumps(config).encode()
            with tarfile.open(path,'w:gz') as archive:
                for name,data in [('manifest.json',json.dumps([{'Config':'config.json','RepoTags':['aether:5.0.1']}]).encode()),('config.json',config_bytes)]:
                    member = tarfile.TarInfo(name)
                    member.size = len(data)
                    archive.addfile(member,io.BytesIO(data))
            manifest = {'archive':up.ARCHIVE,'version':'5.0.1','platform':'linux/amd64','tag':'aether:5.0.1','bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'imageId':'sha256:'+hashlib.sha256(config_bytes).hexdigest()}
            self.assertEqual(up.verify_archive(path,manifest,'v5.0.1'),'aether:5.0.1')
            for key,value in [('sha256','0'*64),('imageId','sha256:wrong'),('version','5.0.2'),('platform','linux/arm64'),('tag','aether:latest'),('bytes',1)]:
                with self.subTest(key=key),self.assertRaises(ValueError):
                    up.verify_archive(path,{**manifest,key:value},'5.0.1')

    @staticmethod
    def oci_archive(base, *, config_link=None, platform=None, corrupt=None, root_name='docker.io/library/aether:5.0.1', oversized=False):
        blobs = {}

        def blob(document, media_type, **extra):
            data = json.dumps(document).encode()
            digest = 'sha256:' + hashlib.sha256(data).hexdigest()
            blobs['blobs/' + digest.replace(':', '/')] = data
            return {'mediaType':media_type,'digest':digest,'size':len(data),**extra}

        config = {'os':'linux','architecture':'amd64','config':{'Labels':{up.VERSION_LABEL:'5.0.1'}}}
        config_descriptor = blob(config,'application/vnd.oci.image.config.v1+json')
        linked_config = {**config_descriptor,'digest':config_link or config_descriptor['digest']}
        image = {'schemaVersion':2,'mediaType':'application/vnd.oci.image.manifest.v1+json','config':linked_config,'layers':[]}
        image_descriptor = blob(image,image['mediaType'],platform=platform or {'os':'linux','architecture':'amd64'})
        # Attestation manifests are not runnable Linux AMD64 image candidates.
        attestation = {'mediaType':image['mediaType'],'digest':'sha256:'+'f'*64,'size':100,'platform':{'os':'unknown','architecture':'unknown'}}
        image_index = {'schemaVersion':2,'mediaType':'application/vnd.oci.image.index.v1+json','manifests':[image_descriptor,attestation]}
        index_descriptor = blob(image_index,image_index['mediaType'],annotations={'io.containerd.image.name':root_name,'org.opencontainers.image.ref.name':'5.0.1'})
        root = {'schemaVersion':2,'mediaType':image_index['mediaType'],'manifests':[index_descriptor]}
        if oversized:
            root['padding'] = 'x' * (4 * 1024 * 1024)
        if corrupt:
            descriptor = image_descriptor if corrupt == 'manifest' else index_descriptor
            name = 'blobs/' + descriptor['digest'].replace(':','/')
            blobs[name] = blobs[name].replace(b'"schemaVersion": 2',b'"schemaVersion": 3')
        files = {
            'oci-layout':json.dumps({'imageLayoutVersion':'1.0.0'}).encode(),
            'index.json':json.dumps(root).encode(),
            'manifest.json':json.dumps([{'Config':'blobs/'+config_descriptor['digest'].replace(':','/'),'RepoTags':['aether:5.0.1'],'Layers':[]}]).encode(),
            **blobs,
        }
        path = base/up.ARCHIVE
        with tarfile.open(path,'w:gz') as archive:
            for name, data in files.items():
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member,io.BytesIO(data))
        manifest = {'archive':up.ARCHIVE,'version':'5.0.1','platform':'linux/amd64','tag':'aether:5.0.1','bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'imageId':config_descriptor['digest']}
        return path, manifest, {'index':index_descriptor['digest'],'manifest':image_descriptor['digest']}

    def test_legacy_loaded_config_id_needs_no_oci_metadata(self):
        digest = 'sha256:'+'1'*64
        with patch.object(tarfile,'open',side_effect=AssertionError('Legacy image must not require OCI metadata')):
            self.assertTrue(up.loaded_image_id_matches_archive(pathlib.Path('unused.tar.gz'),{'imageId':digest},digest))

    def test_containerd_index_and_platform_manifest_install_with_mocked_docker(self):
        for kind in ('index','manifest'):
            with self.subTest(kind=kind),tempfile.TemporaryDirectory() as directory:
                base = pathlib.Path(directory)
                path, manifest, ids = self.oci_archive(base)
                fake = FakeDocker(base)
                fake.new_id = ids[kind]
                fake.new_image['Id'] = fake.new_id
                updater = up.Updater(fake.config,base/'work')
                with patch.object(up,'docker',fake.docker),patch.object(up,'inspect',fake.inspect),patch.object(updater,'healthy',fake.healthy):
                    self.assertTrue(updater.install(path,manifest,'5.0.1'))
                self.assertEqual(fake.containers[fake.config['container']]['Image'],ids[kind])
                self.assertNotEqual(manifest['imageId'],ids[kind])
                self.assertEqual(up.verify_archive(path,manifest,'5.0.1'),'aether:5.0.1')

    def test_containerd_identity_failures_stop_before_preflight_or_downtime(self):
        cases = {
            'unrelated-loaded-id':{},
            'wrong-linked-config':{'config_link':'sha256:'+'0'*64},
            'corrupt-platform-manifest':{'corrupt':'manifest'},
            'corrupt-image-index':{'corrupt':'index'},
            'wrong-descriptor-platform':{'platform':{'os':'linux','architecture':'arm64'}},
            'wrong-loaded-platform':{},
            'wrong-loaded-version':{},
            'wrong-root-tag':{'root_name':'docker.io/library/unrelated:5.0.1'},
            'oversized-oci-metadata':{'oversized':True},
        }
        for name, options in cases.items():
            with self.subTest(name=name),tempfile.TemporaryDirectory() as directory:
                base = pathlib.Path(directory)
                path, manifest, ids = self.oci_archive(base,**options)
                fake = FakeDocker(base)
                fake.new_id = ids['index'] if name != 'unrelated-loaded-id' else 'sha256:'+'e'*64
                fake.new_image['Id'] = fake.new_id
                if name == 'wrong-loaded-platform':
                    fake.new_image['Architecture'] = 'arm64'
                if name == 'wrong-loaded-version':
                    fake.new_image['Config']['Labels'][up.VERSION_LABEL] = '5.0.2'
                updater = up.Updater(fake.config,base/'work')
                with patch.object(up,'docker',fake.docker),patch.object(up,'inspect',fake.inspect),patch.object(updater,'healthy',fake.healthy):
                    with self.assertRaises(ValueError):
                        updater.install(path,manifest,'5.0.1')
                self.assertFalse(any(call[0] in ('run','stop','rename') for call in fake.calls))
                self.assertTrue(fake.containers[fake.config['container']]['State']['Running'])
                self.assertEqual((fake.volume/'profile.json').read_text(),'saved before update')

    def test_containerd_descriptor_id_cannot_replace_release_config_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            path, manifest, ids = self.oci_archive(pathlib.Path(directory))
            with self.assertRaisesRegex(ValueError,'Docker image ID mismatch'):
                up.verify_archive(path,{**manifest,'imageId':ids['index']},'5.0.1')


if __name__ == '__main__':
    unittest.main()
