import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const evidence = JSON.parse(
  await readFile('docs/validation/MO-MVP-MILESTONE-004-RELIABILITY-MATRIX.json', 'utf8')
);
const required = [
  'M4-AUT-001',
  'M4-MIG-001',
  'M4-MIG-002',
  'M4-FSH-001',
  'M4-CON-001',
  'M4-IDM-001',
  'M4-IDN-001',
  'M4-HIS-001',
  'M4-RET-001',
  'M4-RET-002',
  'M4-HOF-001',
  'M4-HOF-002',
  'M4-AUD-001',
  'M4-TEN-001',
  'M4-GWY-001',
  'M4-OUT-001',
  'M4-REP-001'
];
const records = new Map(evidence.scenarios.map((record) => [record.id, record]));

assert.equal(evidence.workPackage, 'M4-WP-08');
assert.equal(evidence.direction, 'DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN');
assert.equal(evidence.aggregate, 'scripts/run-milestone4-reliability.mjs');
assert.equal(evidence.hostedWorkflow, '.github/workflows/milestone-4-reliability.yml');

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
  ])
    assert.ok(Object.hasOwn(record, key), `${id}.${key} is absent`);
  assert.equal(record.coverageStatus, 'EXECUTABLE_COVERED');
  await access(record.testFile);
}

assert.equal(records.size, required.length);
assert.deepEqual(evidence.authority, {
  eligibilityIsNotAllocation: true,
  allocationIsNotProviderAcceptance: true,
  providerAcceptanceIsNotLegalAppointment: true,
  providerReturnIsNotOfficialTruth: true,
  evidenceHandoffIsNotFilingSubmission: true,
  paymentImplemented: false,
  invoiceImplemented: false,
  automaticProviderSelectionImplemented: false,
  externalFilingImplemented: false,
  officialTruthPromotionImplemented: false
});

process.stdout.write(
  `Milestone 4 reliability inventory PASS: ${records.size} executable scenario records.\n`
);
