"""Compress and verify a real Docker save archive for the Aether release."""
import argparse, gzip, hashlib, json, pathlib, shutil, tarfile
parser=argparse.ArgumentParser()
parser.add_argument('tar')
parser.add_argument('--tag',default='aether:5.4.0')
args=parser.parse_args()
source=pathlib.Path(args.tar).resolve()
target=source.with_suffix(source.suffix+'.gz')
with source.open('rb') as src,target.open('wb') as raw:
    with gzip.GzipFile(filename='',mode='wb',fileobj=raw,compresslevel=6,mtime=0) as dst:
        shutil.copyfileobj(src,dst,1024*1024)
with tarfile.open(target,'r:gz') as archive:
    manifest=json.load(archive.extractfile('manifest.json'))
    matching=[entry for entry in manifest if args.tag in (entry.get('RepoTags') or [])]
    if len(matching)!=1:
        raise RuntimeError('Expected image tag missing or ambiguous')
    config=json.load(archive.extractfile(matching[0]['Config']))
    if config.get('os')!='linux' or config.get('architecture')!='amd64':
        raise RuntimeError('Image platform is not linux/amd64')
    release_version=args.tag.rsplit(':',1)[-1]
    if (config.get('config',{}).get('Labels') or {}).get('org.opencontainers.image.version')!=release_version:
        raise RuntimeError('Image version label does not match release tag')
    image_id='sha256:'+hashlib.sha256(archive.extractfile(matching[0]['Config']).read()).hexdigest()
digest=hashlib.file_digest(target.open('rb'),'sha256').hexdigest()
report={'archive':target.name,'version':release_version,'imageId':image_id,'bytes':target.stat().st_size,'sha256':digest,'tag':args.tag,'platform':config['os']+'/'+config['architecture'],'uncompressedBytes':source.stat().st_size}
target.with_suffix('.gz.sha256').write_text(digest+'  '+target.name+'\n',encoding='utf-8')
target.parent.joinpath('IMAGE-MANIFEST.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
