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

    def test_preflight_collision_does_not_remove_unowned_resources(self):
        with tempfile.TemporaryDirectory() as directory:
            fake = FakeDocker(pathlib.Path(directory))
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
            backup = base/'bad.tar.gz'
            with tarfile.open(backup,'w:gz') as archive:
                member = tarfile.TarInfo('userdata-lookalike/profile.json')
                member.size = 3
                archive.addfile(member,io.BytesIO(b'bad'))
            with self.assertRaises(RuntimeError):
                updater.restore_userdata(backup,fake.volume,base,'unsafe')
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


if __name__ == '__main__':
    unittest.main()
