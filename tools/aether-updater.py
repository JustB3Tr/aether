#!/usr/bin/env python3
"""Host-side Aether release updater. The public web container gets no Docker socket."""
import argparse
import contextlib
import datetime
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.parse
import urllib.request
import uuid

REPO = 'JustB3Tr/aether'
ARCHIVE = 'aether-image-linux-amd64.tar.gz'
MANIFEST = 'IMAGE-MANIFEST.json'
VERSION_LABEL = 'org.opencontainers.image.version'
MAX_IMAGE = 2 * 1024 * 1024 * 1024
PREFLIGHT_LABEL = 'io.aether.updater.preflight'

class RollbackRequired(RuntimeError):
    """A replacement failed and automatic recovery could not safely finish."""

def version(value):
    match = re.fullmatch(r'v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', str(value))
    if not match:
        raise ValueError('Only stable x.y.z release versions are accepted')
    return tuple(map(int, match.groups()))

def log(message):
    print(datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds') + ' ' + message, flush=True)

def docker(*args, timeout=120):
    result = subprocess.run(['docker', *map(str, args)], capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError('Docker ' + str(args[0]) + ' failed: ' + result.stderr.strip()[:1500])
    return result.stdout.strip()

def inspect(name):
    return json.loads(docker('inspect', name))[0]

def maybe_inspect(name):
    try:
        return inspect(name)
    except RuntimeError as error:
        if any(text in str(error).lower() for text in ('no such object', 'no such container')):
            return None
        raise

def image_version(info):
    label = (info['Config'].get('Labels') or {}).get(VERSION_LABEL)
    if label:
        version(label)
        return label
    tag = info['Config']['Image'].rsplit(':', 1)[-1]
    version(tag)
    return tag

def allowed_url(url):
    parsed = urllib.parse.urlparse(url)
    return parsed.scheme == 'https' and not parsed.username and not parsed.password and parsed.port in (None,443) and parsed.hostname in {
        'api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'
    }

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed_url(newurl):
            raise ValueError('Release download redirected outside GitHub HTTPS')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def download(url, limit, destination=None):
    if not allowed_url(url):
        raise ValueError('Release URL is not an allowed GitHub HTTPS URL')
    req = urllib.request.Request(url, headers={'User-Agent':'Aether-NAS-updater/1', 'Accept':'application/vnd.github+json' if 'api.github.com' in url else 'application/octet-stream'})
    opener = urllib.request.build_opener(SafeRedirect())
    deadline, size, pieces = time.monotonic() + 900, 0, []
    with opener.open(req, timeout=30) as response, (open(destination, 'wb') if destination else contextlib.nullcontext()) as output:
        if int(response.headers.get('Content-Length') or 0) > limit:
            raise ValueError('Release download exceeds size limit')
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > limit or time.monotonic() > deadline:
                raise ValueError('Release download exceeds size or time limit')
            if output:
                output.write(chunk)
            else:
                pieces.append(chunk)
    return size if destination else b''.join(pieces)

def release_assets(release):
    if release.get('draft') or release.get('prerelease'):
        raise ValueError('Draft and prerelease images are excluded')
    version(release['tag_name'])
    result = {}
    for name in (ARCHIVE, MANIFEST):
        matches = [a for a in release.get('assets', []) if a.get('name') == name]
        if len(matches) != 1:
            raise ValueError('Release must contain exactly one ' + name)
        asset = matches[0]
        parsed = urllib.parse.urlparse(asset['browser_download_url'])
        expected = '/' + REPO + '/releases/download/' + release['tag_name'] + '/' + name
        if parsed.hostname != 'github.com' or parsed.path != expected or not allowed_url(asset['browser_download_url']):
            raise ValueError('Release asset must belong to the pinned repository and tag')
        if not 0 < int(asset['size']) <= (MAX_IMAGE if name == ARCHIVE else 65536):
            raise ValueError('Invalid release asset size')
        result[name] = asset
    return result

def verify_archive(path, manifest, expected):
    canonical = '.'.join(map(str, version(expected)))
    if manifest.get('version') != canonical or manifest.get('platform') != 'linux/amd64' or manifest.get('tag') != 'aether:' + canonical:
        raise ValueError('Release manifest version, tag or platform mismatch')
    if manifest.get('archive') != ARCHIVE or manifest.get('bytes') != path.stat().st_size or path.stat().st_size > MAX_IMAGE:
        raise ValueError('Archive name or size mismatch')
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    if not re.fullmatch('[a-f0-9]{64}', str(manifest.get('sha256'))) or digest != manifest['sha256']:
        raise ValueError('Archive SHA-256 mismatch')
    with tarfile.open(path, 'r:gz') as archive:
        def read_json(name):
            member = archive.getmember(name)
            if not member.isfile() or member.size > 4 * 1024 * 1024:
                raise ValueError('Invalid Docker archive metadata')
            return json.load(archive.extractfile(member))
        entries = read_json('manifest.json')
        if len(entries) != 1 or entries[0].get('RepoTags') != [manifest['tag']]:
            raise ValueError('Archive must contain only the expected image tag')
        config = read_json(entries[0]['Config'])
        if config.get('os') != 'linux' or config.get('architecture') != 'amd64' or (config.get('config', {}).get('Labels') or {}).get(VERSION_LABEL) != canonical:
            raise ValueError('Docker config platform or version label mismatch')
        config_bytes = archive.extractfile(entries[0]['Config']).read()
        if manifest.get('imageId') != 'sha256:' + hashlib.sha256(config_bytes).hexdigest():
            raise ValueError('Docker image ID mismatch')
    return manifest['tag']

class Updater:
    def __init__(self, config, workdir):
        self.config, self.work = config, pathlib.Path(workdir).resolve()
        self.work.mkdir(parents=True, exist_ok=True)
        self.state_path = self.work / 'state.json'
        try:
            self.state = json.loads(self.state_path.read_text())
        except FileNotFoundError:
            self.state = {}
        self.last_check = 0
        if not isinstance(self.state, dict):
            raise ValueError('Updater state must be a JSON object')

    def state_save(self):
        tmp = self.state_path.with_suffix('.tmp')
        tmp.write_text(json.dumps(self.state, indent=2) + '\n')
        tmp.replace(self.state_path)

    def validate_container(self, info):
        host, conf = info['HostConfig'], self.config
        mounts = info['Mounts']
        if len(mounts) != 1 or mounts[0].get('Type') != 'volume' or mounts[0].get('Name') != conf['volume'] or mounts[0].get('Destination') != '/app/userdata' or not mounts[0].get('RW'):
            raise ValueError('Container volume changed. Review updater config before updating.')
        ports = host.get('PortBindings')
        expected = {'3000/tcp':[{'HostIp':conf.get('hostIp',''), 'HostPort':str(conf['port'])}]}
        if ports != expected or host.get('NetworkMode') != 'bridge' or host.get('RestartPolicy',{}).get('Name') != 'unless-stopped':
            raise ValueError('Container port, network or restart policy changed. Review updater config.')
        if host.get('Privileged') or host.get('CapAdd') or host.get('Devices') or host.get('ExtraHosts') or host.get('Links'):
            raise ValueError('Unsupported container configuration. Refusing to lose configuration.')
        if info['Config'].get('Cmd') != ['node','server.js'] or info['Config'].get('User') or info['Config'].get('Entrypoint') != ['docker-entrypoint.sh']:
            raise ValueError('Unsupported command, entrypoint or container user')
        supported_defaults = {'ReadonlyRootfs':False,'CapDrop':None,'SecurityOpt':None,'Memory':0,'NanoCpus':0,'CpuShares':0,'CpuPeriod':0,'CpuQuota':0,'CpuRealtimePeriod':0,'CpuRealtimeRuntime':0,'CpusetCpus':'','CpusetMems':'','MemoryReservation':0,'MemorySwap':0,'MemorySwappiness':None,'Dns':None,'DnsOptions':[],'DnsSearch':[],'Tmpfs':None,'PidMode':'','IpcMode':'private','UTSMode':'','UsernsMode':'','ShmSize':67108864,'PidsLimit':None,'Ulimits':[],'VolumeDriver':'','VolumesFrom':None,'AutoRemove':False,'OomKillDisable':None,'OomScoreAdj':0,'GroupAdd':None,'DeviceRequests':None,'DeviceCgroupRules':None,'CgroupParent':'','BlkioWeight':0,'BlkioWeightDevice':[],'BlkioDeviceReadBps':[],'BlkioDeviceWriteBps':[],'BlkioDeviceReadIOps':[],'BlkioDeviceWriteIOps':[],'Runtime':'runc','PublishAllPorts':False}
        for key, default in supported_defaults.items():
            actual = host.get(key, default)
            if key == 'OomKillDisable' and actual is False:
                continue
            if actual != default and not (default in (None, []) and actual in (None, [])):
                raise ValueError('Unsupported changed container option: ' + key)
        if host.get('LogConfig') != {'Type':'json-file','Config':{}} or info['Config'].get('WorkingDir','/app') != '/app' or info['Config'].get('Hostname') not in (None,'',info['Id'][:12]) or info['Config'].get('Domainname') or info['Config'].get('Tty') or info['Config'].get('OpenStdin'):
            raise ValueError('Unsupported logging, working directory, hostname or terminal configuration')
        image_defaults = json.loads(docker('image','inspect',info.get('Image') or info['Config']['Image']))[0]['Config']
        expected_env = dict(value.split('=',1) for value in image_defaults.get('Env',[]) or [])
        expected_env.update(dict(value.split('=',1) for value in conf.get('env',[])))
        if dict(value.split('=',1) for value in info['Config'].get('Env',[]) or []) != expected_env:
            raise ValueError('Customized environment requires updater configuration review')
        for key in ('Healthcheck','StopSignal','StopTimeout','ExposedPorts','Labels'):
            actual, expected = info['Config'].get(key), image_defaults.get(key)
            if key == 'Labels':
                actual, expected = actual or {}, expected or {}
            if actual != expected:
                raise ValueError('Customized container ' + key + ' requires updater configuration review')
        if host.get('Sysctls') or host.get('StorageOpt') or host.get('CgroupnsMode','private') not in ('private','') or host.get('Init'):
            raise ValueError('Unsupported sysctls, cgroup namespace or init configuration')
        for network in info.get('NetworkSettings',{}).get('Networks',{}).values():
            if network.get('IPAMConfig') or network.get('Aliases') or network.get('DriverOpts'):
                raise ValueError('Unsupported custom network addressing or aliases')

    def run_args(self, name, tag, preflight=False):
        conf = self.config
        args = ['run','-d','--name',name,'--restart','no' if preflight else 'unless-stopped','--network','bridge']
        if not preflight:
            host = conf.get('hostIp','')
            args += ['-p', (host + ':' if host else '') + str(conf['port']) + ':3000']
        args += ['-v', (name + '-data' if preflight else conf['volume']) + ':/app/userdata']
        if preflight:
            args += ['--label',PREFLIGHT_LABEL + '=' + name]
        for value in conf.get('env',[]):
            args += ['-e', value]
        return args + [tag]

    def healthy(self, name, expected=None):
        deadline = time.monotonic() + 75
        while time.monotonic() < deadline:
            info = inspect(name)
            if not info['State']['Running']:
                raise RuntimeError('New container exited: ' + docker('logs','--tail','25',name)[:1500])
            try:
                health = json.loads(docker('exec',name,'curl','-sf','--max-time','5','http://127.0.0.1:3000/health',timeout=10))
                if health.get('ok') and (expected is None or health.get('version') == expected):
                    return
            except (RuntimeError, ValueError):
                pass
            time.sleep(2)
        raise RuntimeError('New image failed health or version checks')

    def cleanup_preflight(self, name):
        # A failed `run` can still create a container. Remove only our labelled attempt.
        try:
            info = maybe_inspect(name)
            if info is not None:
                if (info['Config'].get('Labels') or {}).get(PREFLIGHT_LABEL) != name:
                    log('Preflight name is owned by another container; leaving it untouched: ' + name)
                    return
                docker('rm','-f',info['Id'])
            volumes = json.loads(docker('volume','inspect',name + '-data'))
            if (volumes[0].get('Labels') or {}).get(PREFLIGHT_LABEL) == name:
                docker('volume','rm',name + '-data')
        except Exception as error:
            log('Preflight cleanup needs review: ' + str(error))

    def restore_userdata(self, backup, volume_path, backup_dir, stamp):
        staging = backup_dir / (stamp + '-restore')
        staging.mkdir()
        try:
            # Finish validation and extraction before touching any live userdata.
            with tarfile.open(backup,'r:gz') as archive:
                for member in archive.getmembers():
                    path = pathlib.PurePosixPath(member.name)
                    if (not (member.name == 'userdata' or member.name.startswith('userdata/'))
                            or path.is_absolute() or '..' in path.parts
                            or not (member.isdir() or member.isfile())):
                        raise RuntimeError('Unsafe userdata backup; manual recovery required')
                archive.extractall(staging,filter='data')
            restored = staging / 'userdata'
            if not restored.is_dir():
                raise RuntimeError('Userdata backup has no root directory')
            # Preserve the unsuccessful image's files too, in case restoring later fails.
            failed_data = backup_dir / (stamp + '-failed-userdata')
            shutil.copytree(volume_path,failed_data,symlinks=True)
            for child in volume_path.iterdir():
                if child.is_dir() and not child.is_symlink():
                    shutil.rmtree(child)
                else:
                    child.unlink()
            shutil.copytree(restored,volume_path,dirs_exist_ok=True)
        finally:
            with contextlib.suppress(Exception):
                shutil.rmtree(staging)

    def rollback(self, old, backup, backup_dir, stamp, replacement_attempted):
        name = self.config['container']
        current = maybe_inspect(name)
        if current is not None and current['Id'] != old['Id']:
            # Refuse to remove an unexpected container created by another administrator.
            if current.get('Image') != self.state['transaction']['newImageId']:
                raise RuntimeError('The managed name belongs to an unexpected container')
            docker('rm','-f',current['Id'])
        if replacement_attempted:
            self.restore_userdata(backup,pathlib.Path(old['Mounts'][0]['Source']),backup_dir,stamp)
        original = inspect(old['Id'])
        if original.get('Name','/' + name).lstrip('/') != name:
            docker('rename',old['Id'],name)
        docker('start',old['Id'])
        if not inspect(old['Id'])['State']['Running']:
            raise RuntimeError('Previous container did not start during rollback')

    def install(self, path, manifest, expected):
        if self.state.get('rollbackRequired') or self.state.get('transaction'):
            raise RollbackRequired('A previous replacement needs manual recovery before another install')
        expected = '.'.join(map(str, version(expected)))
        tag = verify_archive(path, manifest, expected)
        name = self.config['container']
        old = inspect(name)
        self.validate_container(old)
        if not old['State']['Running']:
            raise ValueError('Managed container is stopped; start it before installing an update')
        if version(expected) <= version(image_version(old)):
            log('No update needed: installed ' + image_version(old) + ', release ' + expected)
            return False
        docker('load','-i',path,timeout=900)
        loaded = json.loads(docker('image','inspect',tag))[0]
        if loaded['Id'] != manifest['imageId'] or loaded['Os'] != 'linux' or loaded['Architecture'] != 'amd64' or loaded['Config']['Labels'].get(VERSION_LABEL) != expected:
            raise ValueError('Loaded image does not match release manifest')
        preflight = name + '-update-preflight-' + uuid.uuid4().hex[:16]
        try:
            docker('volume','create','--label',PREFLIGHT_LABEL + '=' + preflight,preflight + '-data')
            volume = json.loads(docker('volume','inspect',preflight + '-data'))[0]
            if (volume.get('Labels') or {}).get(PREFLIGHT_LABEL) != preflight:
                raise RuntimeError('Preflight volume belongs to another attempt')
            docker(*self.run_args(preflight, tag, True))
            try:
                self.healthy(preflight, expected)
            except Exception:
                self.state['failedVersion'] = expected
                self.state_save()
                raise
        finally:
            self.cleanup_preflight(preflight)
        # Preflight can take time. Recheck the exact original before stopping it.
        fresh = inspect(name)
        if fresh['Id'] != old['Id'] or not fresh['State']['Running']:
            raise RuntimeError('Managed container changed or stopped during preflight')
        self.validate_container(fresh)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup_name = name + '-backup-' + stamp
        backup_dir = self.work / 'backups'
        backup_dir.mkdir(exist_ok=True)
        (backup_dir / (stamp + '-container.json')).write_text(json.dumps(old,indent=2))
        volume_path = pathlib.Path(old['Mounts'][0]['Source'])
        backup = backup_dir / (stamp + '-userdata.tar.gz')
        self.state['transaction'] = {'targetVersion':expected,'oldContainerId':old['Id'],'backupContainer':backup_name,'backupFile':str(backup),'newImageId':loaded['Id'],'phase':'stopping'}
        self.state_save()
        # Stop writes for a consistent data snapshot, then switch names and preserve the volume.
        replacement_attempted, health_failed = False, False
        try:
            docker('stop','-t','30',old['Id'])
            with tarfile.open(backup,'w:gz') as archive:
                archive.add(volume_path,arcname='userdata')
            self.state['transaction']['phase'] = 'backed-up'
            self.state_save()
            docker('rename',old['Id'],backup_name)
            self.state['transaction']['phase'] = 'replacing'
            self.state_save()
            replacement_attempted = True
            docker(*self.run_args(name,tag))
            try:
                self.healthy(name,expected)
            except Exception:
                health_failed = True
                raise
        except Exception as update_error:
            if health_failed:
                self.state['failedVersion'] = expected
            try:
                self.rollback(old,backup,backup_dir,stamp,replacement_attempted)
            except Exception as rollback_error:
                self.state['rollbackRequired'] = {**self.state['transaction'],'error':str(rollback_error),'updateError':str(update_error)}
                with contextlib.suppress(Exception):
                    self.state_save()
                log('CRITICAL: automatic rollback failed. Manual recovery required: ' + str(rollback_error))
                raise RollbackRequired('Update and rollback failed; see state.json and retained backup: ' + str(rollback_error)) from update_error
            self.state.pop('transaction',None)
            self.state.pop('rollbackRequired',None)
            with contextlib.suppress(Exception):
                self.state_save()
            log('Update failed. Previous image and userdata restored.')
            raise
        self.state.pop('transaction',None)
        self.state.pop('rollbackRequired',None)
        self.state.update(installedVersion=expected, installedAt=stamp, backupContainer=backup_name, backupFile=str(backup), failedVersion=None)
        self.state_save()
        log('Installed ' + expected + '; retained rollback container ' + backup_name)
        return True

    def check(self):
        # Docker emits another start during replacement. A cooldown avoids recursive checks.
        if time.monotonic() - self.last_check < 30:
            return
        self.last_check = time.monotonic()
        try:
            if self.state.get('rollbackRequired') or self.state.get('transaction'):
                raise RollbackRequired('A previous interrupted replacement needs manual recovery; see state.json')
            info = inspect(self.config['container'])
            if not info['State']['Running']:
                log('Restart check skipped: Aether is manually stopped.')
                return
            current = image_version(info)
            release = json.loads(download('https://api.github.com/repos/' + REPO + '/releases/latest',1048576))
            assets = release_assets(release)
            latest = '.'.join(map(str,version(release['tag_name'])))
            self.state.update(lastCheckedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), currentVersion=current, latestVersion=latest)
            self.state_save()
            if version(latest) <= version(current):
                log('Restart check: installed ' + current + ', latest ' + latest + '. Already current.')
                return
            if self.state.get('failedVersion') == latest:
                log('Release ' + latest + ' previously failed. Keeping the working image; manual review required.')
                return
            manifest = json.loads(download(assets[MANIFEST]['browser_download_url'],65536))
            path = self.work / ARCHIVE
            temp = path.with_suffix('.partial')
            log('Downloading release ' + latest)
            downloaded = download(assets[ARCHIVE]['browser_download_url'], MAX_IMAGE, temp)
            if downloaded != assets[ARCHIVE]['size']:
                raise ValueError('Downloaded size differs from GitHub asset')
            verify_archive(temp, manifest, latest)
            digest = assets[ARCHIVE].get('digest')
            if digest and digest != 'sha256:' + manifest['sha256']:
                raise ValueError('GitHub asset digest differs from manifest')
            temp.replace(path)
            self.install(path,manifest,latest)
        except RollbackRequired as error:
            log('CRITICAL: updater paused for manual recovery: ' + str(error))
        except Exception as error:
            log('Restart update check failed; current app retained: ' + str(error))

    def watch(self):
        while True:
            try:
                # Subscribe before the initial check so restarts during a slow download are not lost.
                events = subprocess.Popen(['docker','events','--filter','type=container','--filter','event=start','--format','{{json .}}'],stdout=subprocess.PIPE,text=True)
                try:
                    self.check()
                    for line in events.stdout:
                        event = json.loads(line)
                        if event.get('Actor',{}).get('Attributes',{}).get('name') == self.config['container']:
                            self.check()
                finally:
                    events.terminate()
                    with contextlib.suppress(subprocess.TimeoutExpired):
                        events.wait(timeout=5)
            except Exception as error:
                log('Docker event watcher reconnecting: ' + str(error))
            time.sleep(10)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config',required=True)
    parser.add_argument('--workdir',required=True)
    parser.add_argument('--once',action='store_true')
    parser.add_argument('--install')
    parser.add_argument('--manifest')
    args = parser.parse_args()
    os.umask(0o077)
    config = json.loads(pathlib.Path(args.config).read_text())
    if not re.fullmatch('[a-zA-Z0-9][a-zA-Z0-9_.-]{0,80}', config['container']) or not re.fullmatch('[a-zA-Z0-9][a-zA-Z0-9_.-]{0,80}',config['volume']) or not 1 <= int(config['port']) <= 65535:
        raise ValueError('Invalid updater container, volume or port config')
    updater = Updater(config,args.workdir)
    # Linux kernel lock survives crashes correctly and prevents duplicate boot/event supervisors.
    import fcntl
    with (updater.work / 'updater.lock').open('w') as lock:
        try:
            fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log('Another Aether updater already owns the lock.')
            return
        if args.install:
            manifest = json.loads(pathlib.Path(args.manifest).read_text())
            updater.install(pathlib.Path(args.install),manifest,manifest['version'])
        elif args.once:
            updater.check()
        else:
            updater.watch()

if __name__ == '__main__':
    main()
