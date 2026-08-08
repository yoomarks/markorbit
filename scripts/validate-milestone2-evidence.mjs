import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
const evidence = JSON.parse(
  await readFile('docs/validation/MO-MVP-MILESTONE-002-RELIABILITY-MATRIX.json', 'utf8')
);
const required = [
  'MIG-001',
  'MIG-002',
  'MIG-003',
  'MIG-004',
  'MIG-005',
  'MIG-006',
  'RST-001',
  'RST-002',
  'RST-003',
  ...Array.from({ length: 9 }, (_, i) => `OUT-${String(i + 1).padStart(3, '0')}`),
  'CON-CORE-001',
  'CON-CORE-002',
  ...Array.from({ length: 9 }, (_, i) => `CON-MR-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 4 }, (_, i) => `CON-EX-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `TEN-${String(i + 1).padStart(3, '0')}`)
];
const records = new Map(evidence.scenarios.map((record) => [record.id, record]));
for (const id of required) {
  const record = records.get(id);
  assert.ok(record, `${id} is absent`);
  for (const key of [
    'testFile',
    'testName',
    'command',
    'ownerDatabase',
    'requiredMode',
    'expectedEvidence',
    'status',
    'totals'
  ])
    assert.ok(Object.hasOwn(record, key), `${id}.${key} is absent`);
  assert.match(
    record.status,
    /^(IMPLEMENTED_NOT_EXECUTED|PASSED_LOCAL|PASSED_HOSTED_EXACT_HEAD|FAILED|BLOCKED_ENVIRONMENT)$/u
  );
  await access(record.testFile);
}
for (const id of [
  'OUT-001',
  'OUT-002',
  'OUT-003',
  'TEN-001',
  'TEN-002',
  'TEN-003',
  'TEN-004',
  'TEN-005',
  'TEN-006',
  'TEN-007'
])
  assert.equal(
    records.get(id).coverageStatus,
    'EXECUTABLE_COVERED',
    `${id} must not regress to partial or missing implementation`
  );
assert.equal(
  evidence.eventDeliveryStatement,
  'audit persistence does not imply durable event delivery. There remains no outbox, broker, queue or crash-recovery delivery guarantee.'
);
process.stdout.write(
  `Milestone 2 evidence inventory PASS: ${records.size} executable scenario records.\n`
);
