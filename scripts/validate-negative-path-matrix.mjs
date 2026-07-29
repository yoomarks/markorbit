import fs from 'node:fs';
import assert from 'node:assert/strict';
import { milestoneNegativePathAdapters as adapters } from '../tests/integration/milestone-negative-path-adapters.mjs';
const rows = JSON.parse(
  fs.readFileSync('tests/integration/milestone-001-negative-path-matrix.json', 'utf8')
);
const descriptorIds = rows.map((x) => x.caseId).sort();
const adapterIds = adapters.map((x) => x.caseId).sort();
assert.equal(rows.length, 17);
assert.equal(new Set(descriptorIds).size, 17);
assert.deepEqual(adapterIds, descriptorIds, 'descriptor and Service/Gateway adapter IDs differ');
for (const adapter of adapters)
  for (const boundary of ['service', 'gateway']) {
    const evidence = adapter[boundary];
    const source = fs.readFileSync(evidence.file, 'utf8');
    assert.ok(
      source.includes(evidence.pattern),
      `${adapter.caseId} ${boundary} evidence is missing: ${evidence.pattern}`
    );
  }
for (const row of rows) {
  assert.equal(row.mutationSideEffectExpectation, 'NO_RECORD_OR_IDEMPOTENCY_MUTATION');
  assert.equal(row.authorityConsequenceExpectation, 'NO_EXTERNAL_AUTHORITY_CONSEQUENCE');
}
console.log('17 descriptors registered');
console.log('17 Service evidence references registered');
console.log('17 Gateway evidence references registered');
console.log('0 missing registry IDs');
console.log('WARNING: registry validation does not establish per-case executable equivalence');
