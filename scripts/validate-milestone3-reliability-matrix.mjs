import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const evidence = JSON.parse(
  await readFile('docs/validation/MO-MVP-MILESTONE-003-RELIABILITY-MATRIX.json', 'utf8')
);
const required = [
  'M3-MIG-001',
  'M3-MIG-002',
  'M3-RST-001',
  'M3-RST-002',
  'M3-OUT-001',
  'M3-OUT-002',
  'M3-OUT-003',
  'M3-CON-001',
  'M3-CON-002',
  'M3-CON-003',
  'M3-CON-004',
  'M3-ATM-001',
  'M3-ATM-002',
  'M3-TEN-001',
  'M3-TEN-002',
  'M3-REP-001',
  'M3-BRW-001'
];
const records = new Map(evidence.scenarios.map((record) => [record.id, record]));

assert.equal(evidence.workPackage, 'M3-WP-07');
assert.equal(evidence.direction, 'DURABLE_COMMERCIAL_ORDER_AND_MATTER_LINKAGE');
assert.equal(evidence.aggregate, 'scripts/run-milestone3-reliability.mjs');
assert.equal(evidence.hostedWorkflow, '.github/workflows/milestone-3-reliability.yml');

for (const id of required) {
  const record = records.get(id);
  assert.ok(record, `${id} is absent`);
  for (const key of [
    'group',
    'testFile',
    'testName',
    'ownerDatabase',
    'requiredMode',
    'expectedEvidence',
    'coverageStatus'
  ]) assert.ok(Object.hasOwn(record, key), `${id}.${key} is absent`);
  assert.equal(record.coverageStatus, 'EXECUTABLE_COVERED');
  await access(record.testFile);
}

assert.equal(records.size, required.length);
assert.deepEqual(evidence.authority, {
  orderIsNotMatter: true,
  confirmedIsNotPaid: true,
  matterCreatedIsNotFiled: true,
  paymentImplemented: false,
  invoiceImplemented: false,
  providerAppointmentImplemented: false,
  externalFilingImplemented: false
});

process.stdout.write(
  `Milestone 3 reliability inventory PASS: ${records.size} executable scenario records.\n`
);
