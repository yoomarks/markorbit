import fs from 'node:fs';

const descriptors = JSON.parse(
  fs.readFileSync('tests/integration/milestone-001-negative-path-matrix.json', 'utf8')
);

for (const descriptor of descriptors) console.log(descriptor.caseId);
