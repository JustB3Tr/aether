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
MIN_FREE_SPACE = 512 * 1024 * 1024
DEFAULT_ROLLBACK_RETENTION = 3
MAX_ROLLBACK_RETENTION = 10
BACKUP_STAMP = re.compile(r'[0-9]{8}T[0-9]{12}Z')

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

def loaded_image_id_matches_archive(path, manifest, loaded_id):
    """Accept containerd descriptors only when linked to the verified image config."""
    if loaded_id == manifest['imageId']:
        return True  # Classic Docker uses the config digest as its image ID.
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', str(loaded_id)):
        return False
    index_types = {'application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'}
    image_types = {'application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'}
    with tarfile.open(path, 'r:gz') as archive:
        metadata_bytes, metadata_reads = 0, 0

        def read_json(name, descriptor=None):
            nonlocal metadata_bytes, metadata_reads
            try:
                member = archive.getmember(name)
            except KeyError as error:
                raise ValueError('Required OCI archive metadata is missing') from error
            metadata_bytes += member.size
            metadata_reads += 1
            if not member.isfile() or not 0 <= member.size <= 4 * 1024 * 1024 or metadata_bytes > 16 * 1024 * 1024 or metadata_reads > 64:
                raise ValueError('OCI archive metadata exceeds its bounds')
            data = archive.extractfile(member).read()
            if descriptor is not None and (descriptor.get('size') != len(data) or descriptor['digest'] != 'sha256:' + hashlib.sha256(data).hexdigest()):
                raise ValueError('OCI archive descriptor digest or size mismatch')
            result = json.loads(data)
            if not isinstance(result, dict):
                raise ValueError('Invalid OCI archive metadata object')
            return result

        def read_descriptor(descriptor):
            if not isinstance(descriptor, dict) or not re.fullmatch(r'sha256:[a-f0-9]{64}', str(descriptor.get('digest'))):
                raise ValueError('Invalid OCI archive descriptor')
            return read_json('blobs/' + descriptor['digest'].replace(':', '/'), descriptor)

        if read_json('oci-layout').get('imageLayoutVersion') != '1.0.0':
            raise ValueError('Unsupported OCI archive layout')
        root = read_json('index.json')
        roots = root.get('manifests')
        if root.get('schemaVersion') != 2 or not isinstance(roots, list) or len(roots) != 1:
            raise ValueError('OCI archive must contain exactly one image root')
        descriptor = roots[0]
        if not isinstance(descriptor, dict):
            raise ValueError('Invalid OCI archive root descriptor')
        annotations = descriptor.get('annotations') or {}
        if not isinstance(annotations, dict):
            raise ValueError('Invalid OCI archive root annotations')
        names = {manifest['tag'], 'docker.io/library/' + manifest['tag']}
        refs = {manifest['tag'], manifest['version']}
        name, ref = annotations.get('io.containerd.image.name'), annotations.get('org.opencontainers.image.ref.name')
        if (name and name not in names) or (ref and ref not in refs) or (not name and ref not in refs):
            raise ValueError('OCI archive image root tag mismatch')

        def walk(descriptor, depth=0):
            if depth > 8:
                raise ValueError('OCI archive descriptor nesting exceeds its bound')
            platform = descriptor.get('platform', {})
            if not isinstance(platform, dict):
                raise ValueError('Invalid OCI archive platform descriptor')
            if platform and (platform.get('os') != 'linux' or platform.get('architecture') != 'amd64'):
                return set()
            document = read_descriptor(descriptor)
            media_type = descriptor.get('mediaType')
            if document.get('schemaVersion') != 2 or document.get('mediaType', media_type) != media_type:
                raise ValueError('OCI archive descriptor schema or media type mismatch')
            if media_type in index_types:
                children = document.get('manifests')
                if not isinstance(children, list) or not 0 < len(children) <= 64:
                    raise ValueError('Invalid OCI archive image index')
                matching = set()
                for child in children:
                    if not isinstance(child, dict) or not isinstance(child.get('platform', {}), dict):
                        raise ValueError('Invalid OCI archive platform descriptor')
                    platform = child.get('platform', {})
                    if platform and (platform.get('os') != 'linux' or platform.get('architecture') != 'amd64'):
                        continue
                    matching.update(walk(child, depth + 1))
                return matching | {descriptor['digest']} if matching else set()
            if media_type not in image_types:
                raise ValueError('Unsupported OCI archive image descriptor')
            config_descriptor = document.get('config')
            if not isinstance(config_descriptor, dict) or config_descriptor.get('digest') != manifest['imageId']:
                raise ValueError('OCI image does not reference the verified Docker config')
            config = read_descriptor(config_descriptor)
            if config.get('os') != 'linux' or config.get('architecture') != 'amd64':
                raise ValueError('OCI image config platform mismatch')
            return {descriptor['digest']}

        return loaded_id in walk(descriptor)

class Updater:
    def __init__(self, config, workdir):
        self.config, self.work = config, pathlib.Path(workdir).resolve()
        retention = config.get('rollbackRetention', DEFAULT_ROLLBACK_RETENTION)
        if type(retention) is not int or not 1 <= retention <= MAX_ROLLBACK_RETENTION:
            raise ValueError('rollbackRetention must be an integer from 1 to ' + str(MAX_ROLLBACK_RETENTION))
        self.rollback_retention = retention
        self.work.mkdir(parents=True, exist_ok=True)
        self.state_path = self.work / 'state.json'
        try:
            self.state = json.loads(self.state_path.read_text())
        except FileNotFoundError:
            self.state = {}
        self.last_check = 0
        if not isinstance(self.state, dict):
            raise ValueError('Updater state must be a JSON object')

    def require_update_space(self, archive, volume_path, include_image=True):
        volume_path = pathlib.Path(volume_path)
        volume_bytes = sum(
            entry.stat(follow_symlinks=False).st_size
            for entry in volume_path.rglob('*')
            if entry.is_file() and not entry.is_symlink()
        )
        needs = [(self.work, max(MIN_FREE_SPACE, volume_bytes * 3 + 256 * 1024 * 1024))]
        if include_image:
            docker_root = pathlib.Path(docker('info', '--format', '{{.DockerRootDir}}'))
            needs.append((docker_root, max(MIN_FREE_SPACE, pathlib.Path(archive).stat().st_size * 3)))

        by_device = {}
        for path, required in needs:
            path.mkdir(parents=True, exist_ok=True)
            device = path.stat().st_dev
            slot = by_device.setdefault(device, {'path': path, 'required': 0})
            slot['required'] += required
        for slot in by_device.values():
            available = shutil.disk_usage(slot['path']).free
            if available < slot['required']:
                raise RuntimeError(
                    'Update stopped before downtime: ' + str(slot['path']) + ' has '
                    + str(available) + ' bytes free; estimated requirement is '
                    + str(slot['required']) + ' bytes including image layers and rollback copies'
                )
    def state_save(self):
        tmp = self.state_path.with_suffix('.tmp')
        tmp.write_text(json.dumps(self.state, indent=2) + '\n')
        tmp.replace(self.state_path)

    def backup_directory(self, create=False):
        candidate = self.work / 'backups'
        if candidate.is_symlink():
            raise ValueError('Updater backup directory must not be a symlink')
        if create:
            candidate.mkdir(parents=True, exist_ok=True)
        resolved = candidate.resolve()
        if resolved.parent != self.work:
            raise ValueError('Updater backup directory must be directly under the work directory')
        return resolved

    def backup_artifact(self, backup_dir, stamp, suffix):
        if not isinstance(stamp, str) or not BACKUP_STAMP.fullmatch(stamp):
            raise ValueError('Invalid updater backup timestamp')
        safe_dir = self.backup_directory()
        requested_dir = pathlib.Path(backup_dir).resolve()
        if requested_dir != safe_dir:
            raise ValueError('Backup path is outside the updater backup directory')
        name = stamp + suffix
        candidate = safe_dir / name
        if candidate.is_symlink():
            raise ValueError('Updater backup artifacts must not be symlinks')
        resolved = candidate.resolve()
        if resolved.parent != safe_dir or resolved.name != name:
            raise ValueError('Updater backup artifact resolved outside its backup directory')
        return resolved

    def validate_rollback_set_schema(self, entry):
        if not isinstance(entry, dict) or entry.get('status') != 'successful':
            raise ValueError('Rollback set is not marked as a successful update')
        stamp = entry.get('stamp')
        if not isinstance(stamp, str) or not BACKUP_STAMP.fullmatch(stamp):
            raise ValueError('Rollback set has an invalid timestamp')
        if entry.get('containerName') != self.config['container'] + '-backup-' + stamp:
            raise ValueError('Rollback set container name is not an exact Aether backup name')
        if not re.fullmatch(r'[a-f0-9]{64}', str(entry.get('containerId', ''))):
            raise ValueError('Rollback set has an invalid container ID')
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', str(entry.get('imageId', ''))):
            raise ValueError('Rollback set has an invalid image ID')
        version(entry.get('previousVersion'))
        version(entry.get('installedVersion'))

    def legacy_rollback_set(self):
        """Import only the last known successful set from the pre-retention state shape."""
        container_name = self.state.get('backupContainer')
        backup_file = self.state.get('backupFile')
        if not isinstance(container_name, str) or not isinstance(backup_file, str):
            return None
        prefix = self.config['container'] + '-backup-'
        if not container_name.startswith(prefix):
            return None
        stamp = container_name[len(prefix):]
        if not BACKUP_STAMP.fullmatch(stamp):
            return None
        backup_dir = self.backup_directory()
        backup = self.backup_artifact(backup_dir, stamp, '-userdata.tar.gz')
        try:
            if pathlib.Path(backup_file).resolve() != backup:
                return None
            metadata_path = self.backup_artifact(backup_dir, stamp, '-container.json')
            metadata = json.loads(metadata_path.read_text())
            previous = image_version(metadata)
            entry = {
                'status': 'successful', 'stamp': stamp, 'containerName': container_name,
                'containerId': metadata['Id'], 'imageId': metadata['Image'],
                'previousVersion': previous, 'installedVersion': self.state.get('installedVersion')
            }
            self.validate_rollback_set_schema(entry)
            return entry if self.complete_rollback_set(entry, backup_dir) is not None else None
        except (OSError, KeyError, TypeError, ValueError, RuntimeError, json.JSONDecodeError):
            return None

    def known_rollback_sets(self):
        entries = self.state.get('rollbackSets')
        if entries is None or entries == []:
            entries = []
            legacy = self.legacy_rollback_set()
            if legacy is not None:
                entries.append(legacy)
            return entries
        if not isinstance(entries, list):
            raise ValueError('Updater rollbackSets must be a JSON array')
        for entry in entries:
            self.validate_rollback_set_schema(entry)
        return list(entries)

    def complete_rollback_set(self, entry, backup_dir):
        """Return exact artifacts only when a recorded successful set is still complete."""
        try:
            self.validate_rollback_set_schema(entry)
            backup = self.backup_artifact(backup_dir, entry['stamp'], '-userdata.tar.gz')
            metadata_path = self.backup_artifact(backup_dir, entry['stamp'], '-container.json')
            for path in (backup, metadata_path):
                if path.is_symlink() or not path.is_file() or path.stat().st_size <= 0:
                    return None
            if metadata_path.stat().st_size > 4 * 1024 * 1024:
                return None
            metadata = json.loads(metadata_path.read_text())
            if metadata.get('Id') != entry['containerId'] or metadata.get('Image') != entry['imageId']:
                return None
            if image_version(metadata) != entry['previousVersion']:
                return None
            with tarfile.open(backup, 'r:gz') as archive:
                root = archive.getmember('userdata')
                if not root.isdir():
                    return None
            info = maybe_inspect(entry['containerName'])
            if info is None or info.get('Id') != entry['containerId'] or info.get('Image') != entry['imageId']:
                return None
            if info.get('Name', '').lstrip('/') != entry['containerName'] or info.get('State', {}).get('Running'):
                return None
            mounts = info.get('Mounts') or []
            if (len(mounts) != 1 or mounts[0].get('Type') != 'volume'
                    or mounts[0].get('Name') != self.config['volume']
                    or mounts[0].get('Destination') != '/app/userdata'):
                return None
            if image_version(info) != entry['previousVersion']:
                return None
            return {'container': info, 'userdata': backup, 'metadata': metadata_path}
        except (OSError, KeyError, TypeError, ValueError, RuntimeError, tarfile.TarError, json.JSONDecodeError):
            return None

    def prune_rollback_sets(self):
        """Prune only exact, complete successful sets after the replacement is healthy."""
        backup_dir = self.backup_directory()
        entries = self.state.get('rollbackSets', [])
        complete = []
        for entry in entries:
            artifacts = self.complete_rollback_set(entry, backup_dir)
            if artifacts is not None:
                complete.append((entry, artifacts))
        complete.sort(key=lambda pair: pair[0]['stamp'])
        stale = complete[:-self.rollback_retention]
        removed = set()
        for entry, artifacts in stale:
            try:
                # No --force and no -v: only the previously inspected, stopped container is removed.
                docker('rm', artifacts['container']['Id'])
                artifacts['userdata'].unlink()
                artifacts['metadata'].unlink()
                removed.add(entry['stamp'])
                log('Pruned successful rollback set ' + entry['containerName'])
            except Exception as error:
                log('Rollback retention left a set for manual review: ' + entry['containerName'] + ': ' + str(error))
        if removed:
            self.state['rollbackSets'] = [entry for entry in entries if entry['stamp'] not in removed]
            self.state_save()

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
        safe_dir = self.backup_directory()
        if pathlib.Path(backup_dir).resolve() != safe_dir:
            raise ValueError('Userdata restore directory is outside the updater backup directory')
        backup_dir = safe_dir
        expected_backup = self.backup_artifact(backup_dir, stamp, '-userdata.tar.gz')
        if pathlib.Path(backup).resolve() != expected_backup:
            raise ValueError('Userdata archive is outside the updater backup directory')
        backup = expected_backup
        staging = self.backup_artifact(backup_dir, stamp, '-restore')
        failed_data = self.backup_artifact(backup_dir, stamp, '-failed-userdata')
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
        if not old.get('Mounts'):
            raise ValueError('Managed container has no mounted userdata volume for safe rollback')
        volume_path = pathlib.Path(old['Mounts'][0]['Source'])
        rollback_sets = self.known_rollback_sets()
        self.require_update_space(path, volume_path)
        docker('load','-i',path,timeout=900)
        loaded = json.loads(docker('image','inspect',tag))[0]
        if loaded['Os'] != 'linux' or loaded['Architecture'] != 'amd64' or (loaded['Config'].get('Labels') or {}).get(VERSION_LABEL) != expected or not loaded_image_id_matches_archive(path, manifest, loaded['Id']):
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
        self.require_update_space(path, volume_path, include_image=False)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        if any(entry['stamp'] == stamp for entry in rollback_sets):
            raise ValueError('Updater generated a duplicate rollback backup timestamp')
        backup_name = name + '-backup-' + stamp
        backup_dir = self.backup_directory(create=True)
        metadata_path = self.backup_artifact(backup_dir, stamp, '-container.json')
        metadata_path.write_text(json.dumps(old,indent=2))
        backup = self.backup_artifact(backup_dir, stamp, '-userdata.tar.gz')
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
        rollback_sets.append({
            'status':'successful', 'stamp':stamp, 'containerName':backup_name,
            'containerId':old['Id'], 'imageId':old['Image'],
            'previousVersion':image_version(old), 'installedVersion':expected
        })
        self.state.update(installedVersion=expected, installedAt=stamp, backupContainer=backup_name, backupFile=str(backup), rollbackSets=rollback_sets, failedVersion=None)
        self.state_save()
        try:
            self.prune_rollback_sets()
        except Exception as error:
            log('Rollback retention was skipped; active image is healthy and all existing sets were left untouched: ' + str(error))
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
