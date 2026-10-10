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
