# Aether 5.1.0 build and deployment

Build on Windows with Docker Desktop's Linux container engine. All three proxy engines launch inside Aether's viewer by default. Check **Open in a new tab** for a separate tab containing the Aether shell and its viewer.

## Local build and preview

```powershell
docker build --platform linux/amd64 --build-arg AETHER_VERSION=5.1.0 -t aether:5.1.0 .
docker run -d --name aether-v5-preview --restart unless-stopped -p 127.0.0.1:15001:3000 -v aether-v5-preview-data:/app/userdata aether:5.1.0
```

Open [Aether](http://127.0.0.1:15001/) and [health](http://127.0.0.1:15001/health). The v5.1 image should report `version: "5.1.0"`; read the actual response after startup. The image uses Node 22 Alpine and locked production dependencies. The application listens on `0.0.0.0` inside the container.

The example assumes the preview container name and port are available. Identify an existing preview before replacement and preserve its data. Source, a built image, and a deployed container are distinct states; see [deployment validation](docs/DEPLOYMENT.md) for the release owner's actual evidence.

## Export a verified image

```powershell
New-Item -ItemType Directory -Force -Path outputs/v5.1.0
docker save --output outputs/v5.1.0/aether-image-linux-amd64.tar aether:5.1.0
python tools/archive-image.py outputs/v5.1.0/aether-image-linux-amd64.tar --tag aether:5.1.0
```

The helper verifies the real Docker image config, platform and version label, compresses the archive, and writes `IMAGE-MANIFEST.json` and a SHA-256 file. Keep these three files together. The gzip is an image archive, not a build context.

## Manual NAS transfer

Substitute your NAS address and SSH user. Use a persistent staging directory you can write to.

```powershell
scp outputs/v5.1.0/aether-image-linux-amd64.tar.gz user@NAS:/path/to/staging/
scp outputs/v5.1.0/aether-image-linux-amd64.tar.gz.sha256 user@NAS:/path/to/staging/
ssh user@NAS
```

On the NAS:

```sh
cd /path/to/staging
sha256sum -c aether-image-linux-amd64.tar.gz.sha256
sudo docker load -i aether-image-linux-amd64.tar.gz
sudo docker inspect aether > before-upgrade.json
sudo docker stop aether
# Back up the exact userdata volume after stopping writes.
sudo tar -czf userdata-before-v5.tar.gz -C /actual/volume/mountpoint .
sudo docker rename aether aether-before-v5
sudo docker run -d --name aether --restart unless-stopped \
  -p 3000:3000 -v aether-data:/app/userdata aether:5.1.0
curl -fsS http://127.0.0.1:3000/health
```

Inspect the original container first and preserve its **actual** volume, environment, port and network options. `aether-data` is an example named volume. Keep the stopped original container and backup until validation finishes. For rollback, stop/remove only the failed replacement, restore userdata while stopped, rename the retained original to `aether`, and start it.

## Restart updater

The installed host supervisor performs verification, isolated preflight, consistent backup, replacement and health rollback. It is started by a TrueNAS Post Init task and listens for Aether container start events. See [automatic updates](docs/AUTO-UPDATES.md) for the release format, publishing command and limitations. GitHub builds are optional manual runs; source pushes do not build images there.

Aether has no built-in account authentication. Use authenticated HTTPS access for an Internet deployment. Proxy engines require a separate destination/network security review; the [previous v5.0 audit](docs/audit/AUDIT.md) describes unresolved findings. The visual overhaul does not resolve those architectural risks.

[v5.1 release notes](docs/RELEASE-5.1.0.md) · [Next independent audit/visionary brief](docs/NEXT-AUDIT-BRIEF.md)
