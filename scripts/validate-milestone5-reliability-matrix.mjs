import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const evidence = JSON.parse(
  await readFile('docs/validation/MO-MVP-MILESTONE-005-RELIABILITY-MATRIX.json', 'utf8')
);
const required = [
  'M5-AUT-001',
  'M5-MIG-001',
  'M5-MIG-002',
  'M5-MIG-003',
  'M5-MIG-004',
  'M5-RST-001',
  'M5-RPL-001',
  'M5-CON-001',
  'M5-CON-002',
  'M5-TEN-001',
  'M5-RED-001',
  'M5-PER-001',
  'M5-SRF-001',
  'M5-SRF-002',
  'M5-BRW-001',
  'M5-BRW-002',
  'M5-REP-001'
];
const records = new Map(evidence.scenarios.map((record) => [record.id, record]));

assert.equal(evidence.workPackage, 'M5-WP-07');
assert.equal(evidence.direction, 'DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION');
assert.equal(evidence.aggregate, 'scripts/run-milestone5-reliability.mjs');
assert.equal(evidence.hostedWorkflow, '.github/workflows/milestone-5-reliability.yml');

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
  evidenceReviewDecisionCreatesOfficialTruth: false,
  reviewAdmissionEqualsFilingSubmission: false,
  lifecycleProjectionCreatesOfficialStatus: false,
  recommendedActionAuthorizesExecution: false,
  crossServiceSqlAllowed: false,
  paymentImplemented: false,
  invoiceImplemented: false,
  legalAppointmentImplemented: false,
  automaticFormalMatterCompletionImplemented: false,
  automaticCapabilityVerificationImplemented: false
});

process.stdout.write(
  `Milestone 5 reliability inventory PASS: ${records.size} executable scenario records.\n`
);
