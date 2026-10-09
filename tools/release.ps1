param([string]$NotesFile = 'docs/RELEASE-5.0.0.md')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$releaseVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
if ($releaseVersion -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') { throw 'Only stable x.y.z versions can be published.' }
if (git status --porcelain) { throw 'Commit the release source before publishing an image.' }
$releaseOutput = Join-Path (Get-Location) "outputs/v$releaseVersion"
New-Item -ItemType Directory -Force -Path $releaseOutput | Out-Null
docker build --platform linux/amd64 --build-arg "AETHER_VERSION=$releaseVersion" -t "aether:$releaseVersion" .
if ($LASTEXITCODE -ne 0) { throw 'Docker build failed.' }
docker save --output "$releaseOutput/aether-image-linux-amd64.tar" "aether:$releaseVersion"
if ($LASTEXITCODE -ne 0) { throw 'Docker save failed.' }
python tools/archive-image.py "$releaseOutput/aether-image-linux-amd64.tar" --tag "aether:$releaseVersion"
if ($LASTEXITCODE -ne 0) { throw 'Archive verification failed.' }
$releaseCommit = git rev-parse HEAD
gh release create "v$releaseVersion" "$releaseOutput/aether-image-linux-amd64.tar.gz" "$releaseOutput/IMAGE-MANIFEST.json" "$releaseOutput/aether-image-linux-amd64.tar.gz.sha256" --repo JustB3Tr/aether --target $releaseCommit --title "Aether $releaseVersion" --notes-file $NotesFile
if ($LASTEXITCODE -ne 0) { throw 'GitHub release upload failed.' }
