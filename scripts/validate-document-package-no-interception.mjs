import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'apps/lite-web/src/api/document-package.ts',
  'apps/lite-web/src/features/document-package/DocumentPackageWorkspace.tsx'
];
const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const forbidden of ['page' + '.route(', 'context' + '.route(', 'route' + '.fulfill('])
  assert.ok(!source.includes(forbidden), `TASK 025 runtime sources must not use ${forbidden}`);
assert.match(source, /credentials:\s*'include'/u, 'Production Package HTTP must send credentials.');
assert.match(source, /idempotency-key/u, 'Package mutations must carry idempotency evidence.');
console.log('TASK 025 browser source PASS: credentialed Gateway HTTP and no interception');
