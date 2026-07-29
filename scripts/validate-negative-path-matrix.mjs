import fs from 'node:fs';
import assert from 'node:assert/strict';
const rows = JSON.parse(
  fs.readFileSync('tests/integration/milestone-001-negative-path-matrix.json', 'utf8')
);
assert.equal(rows.length, 17);
assert.equal(new Set(rows.map((x) => x.caseId)).size, 17);
for (const row of rows) {
  assert.equal(row.mutationSideEffectExpectation, 'NO_RECORD_OR_IDEMPOTENCY_MUTATION');
  assert.equal(row.authorityConsequenceExpectation, 'NO_EXTERNAL_AUTHORITY_CONSEQUENCE');
}
console.log(
  'Negative-path descriptor PASS: 17 unique cases; executable 17-case equivalence adapters remain pending'
);
