import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const entry = require.resolve('testcafe-hammerhead');
const root = dirname(dirname(entry));
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (manifest.version !== '31.7.8') {
  throw new Error(`Expected testcafe-hammerhead 31.7.8, found ${manifest.version}. Review the TLS patch before upgrading.`);
}

const patches = [
  {
    path: join(root, 'lib/request-pipeline/request-options.js'),
    before: 'ignoreSSLAuth() {\n        this.rejectUnauthorized = false;',
    after: 'ignoreSSLAuth() {\n        this.rejectUnauthorized = true;',
  },
  {
    path: join(root, 'lib/request-pipeline/destination-request/agent.js'),
    before: 'httpsOverHttp({\n            proxy,\n            rejectUnauthorized: false,',
    after: 'httpsOverHttp({\n            proxy,\n            rejectUnauthorized: true,',
  },
];

for (const patch of patches) {
  const source = await readFile(patch.path, 'utf8');
  if (source.includes(patch.after)) continue;
  const occurrences = source.split(patch.before).length - 1;
  if (occurrences !== 1) throw new Error(`Expected one reviewed TLS marker in ${patch.path}, found ${occurrences}.`);
  await writeFile(patch.path, source.replace(patch.before, patch.after));
}

console.log('Rammerhead destination TLS verification enforced for testcafe-hammerhead 31.7.8.');

// Wisp 0.5 stores streams in an object, but its enabled per-host limiter
// iterates that object directly. The first permitted stream then never starts.
const wispRoot = dirname(dirname(require.resolve('@mercuryworkshop/wisp-js')));
const wispManifest = JSON.parse(await readFile(join(wispRoot, 'package.json'), 'utf8'));
if (wispManifest.version !== '0.5.0') throw new Error('Review Wisp stream limiter patch before upgrading');
const filterPath = join(wispRoot, 'src/server/filter.mjs');
const filterSource = await readFile(filterPath, 'utf8');
const broken = 'for (let stream of connection.streams) {';
const fixed = 'for (let stream of Object.values(connection.streams)) {';
if (!filterSource.includes(fixed)) {
  if (filterSource.split(broken).length !== 2) throw new Error('Wisp limiter marker changed');
  await writeFile(filterPath, filterSource.replace(broken, fixed));
}
console.log('Wisp 0.5 per-host stream limiter supports its stream object.');
