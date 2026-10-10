# Aether 5.4.0 build and deployment

Build on Windows with Docker Desktop's Linux container engine. All three proxy engines launch in Aether's isolated viewer by default. Check **Open in a new tab** for a separate tab containing the Aether shell and its viewer.

## Local build and preview

```powershell
docker build --platform linux/amd64 --build-arg AETHER_VERSION=5.4.0 -t aether:5.4.0 .
docker run -d --name aether-v54-preview --restart unless-stopped -e NODE_ENV=development -p 127.0.0.1:15007:3000 -v aether-v54-preview-data:/app/userdata aether:5.4.0
```

Open [Aether](http://127.0.0.1:15007/) and [health](http://127.0.0.1:15007/health). The image should report `version: "5.4.0"`; read the actual response after startup. The preview uses local development mode and must remain bound to loopback. The image uses Node 22 Alpine and locked production dependencies. The application listens on `0.0.0.0` inside the container.

The example assumes the preview container name and port are available. Identify an existing preview before replacement and preserve its data. Source, a built image, and a deployed container are distinct states; see [deployment validation](docs/DEPLOYMENT.md) for the release owner's actual evidence.

## Export a verified image

```powershell
New-Item -ItemType Directory -Force -Path outputs/v5.4.0
docker save --output outputs/v5.4.0/aether-image-linux-amd64.tar aether:5.4.0
python tools/archive-image.py outputs/v5.4.0/aether-image-linux-amd64.tar --tag aether:5.4.0
```

The helper verifies the real Docker image config, platform and version label, compresses the archive, and writes `IMAGE-MANIFEST.json` and a SHA-256 file. Keep these three files together. The gzip is an image archive, not a build context.

The finished local v5.4 archive is `outputs/v5.4.0/aether-image-linux-amd64.tar.gz`, 85,579,081 bytes, with SHA-256 `e557b14892c9653fce3ddda39638cfb5b18878ded8fb06c38423f8ff7b97fd7d`. It was loaded back with `docker load`. This release has not been deployed to the NAS, published to GitHub, or uploaded to Drive. See [v5.4 build notes](docs/RELEASE-5.4.0.md) for validation evidence.

## Manual NAS transfer

Substitute your NAS address and SSH user. Use a persistent staging directory you can write to.

```powershell
scp outputs/v5.4.0/aether-image-linux-amd64.tar.gz user@NAS:/path/to/staging/
scp outputs/v5.4.0/aether-image-linux-amd64.tar.gz.sha256 user@NAS:/path/to/staging/
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
  -e NODE_ENV=production \
  -e AETHER_APP_ORIGIN=https://aether.thetrademaster.trade \
  -e AETHER_PROXY_ORIGIN=https://proxy.aether.thetrademaster.trade \
  -e AETHER_ACCESS_TEAM_DOMAIN=your-team.cloudflareaccess.com \
  -e AETHER_APP_ACCESS_AUDIENCE=replace-with-app-audience \
  -e AETHER_PROXY_ACCESS_AUDIENCE=replace-with-proxy-audience \
  -p 3000:3000 -v aether-data:/app/userdata aether:5.4.0
curl -fsS http://127.0.0.1:3000/health
```

Inspect the original container first and preserve its **actual** volume, environment, port and network options. `aether-data` is an example named volume. Keep the stopped original container and backup until validation finishes. For rollback, stop/remove only the failed replacement, restore userdata while stopped, rename the retained original to `aether`, and start it.

## Restart updater

The installed host supervisor performs verification, isolated preflight, consistent backup, replacement and health rollback. It is started by a TrueNAS Post Init task and listens for Aether container start events. See [automatic updates](docs/AUTO-UPDATES.md) for the release format, publishing command and limitations. GitHub builds are optional manual runs; source pushes do not build images there.

Before enabling future automatic replacements, add the six production environment values above exactly to the private updater configuration's `env` list. The supervisor compares that list to the running container and intentionally refuses a mismatch.

Aether requires separate Cloudflare Access applications and policies for the app and proxy origins in production. Configure the matching Access team and audience values before starting the production image. Route both hostnames through the existing Tunnel to this container; the proxy hostname must not serve the shell or profile API. See [security and origins](docs/SECURITY-AND-ORIGINS.md). No Cloudflare account, DNS, Tunnel, or NAS settings were changed for this source work.

[v5.4 release notes](docs/RELEASE-5.4.0.md) · [Previous v5.3 release notes](docs/RELEASE-5.3.0.md) · [Next independent audit/visionary brief](docs/NEXT-AUDIT-BRIEF.md)
