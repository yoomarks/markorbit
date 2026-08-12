import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const inventory = JSON.parse(
  await readFile('docs/validation/MO-MVP-MILESTONE-006-RELIABILITY-MATRIX.json', 'utf8')
);
const required = [
  'M6-AUT-001',
  'M6-MIG-001',
  'M6-REG-001',
  'M6-SRC-001',
  'M6-LED-001',
  'M6-CAN-001',
  'M6-DSP-001',
  'M6-RST-001',
  'M6-PRV-001',
  'M6-GAT-001',
  'M6-RED-001',
  'M6-ZIT-001',
  'M6-BRW-001',
  'M6-BRW-002',
  'M6-REP-001'
];
const records = new Map(inventory.scenarios.map((record) => [record.id, record]));

assert.equal(inventory.workPackage, 'M6-WP-07');
assert.equal(inventory.direction, 'DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION');
assert.equal(inventory.aggregate, 'scripts/run-milestone6-reliability.mjs');
assert.equal(inventory.inventoryValidator, 'scripts/validate-milestone6-reliability-matrix.mjs');
assert.equal(inventory.hostedWorkflow, '.github/workflows/milestone-6-reliability.yml');

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

assert.deepEqual(inventory.authority, {
  runtimeWorkEvidenceCreatesCanonVersion: false,
  observationCreatesVerifiedCapability: false,
  rawProviderReturnAdmitted: false,
  providerSupplyCapabilityAdmitted: false,
  reflectionCandidateCreatesCanonicalTruth: false,
  acceptedReflectionCreatesVerifiedCapability: false,
  profilePublishesPublicScore: false,
  profilePublishesVerifiedBadge: false,
  twinHasAutonomousIdentity: false,
  twinHasAutonomousExecutionAuthority: false,
  permissionOrRoleChanged: false,
  crossServiceSqlAllowed: false,
  paymentOrInvoiceCreated: false,
  legalAppointmentCreated: false,
  filingSubmitted: false,
  officialTruthCreated: false,
  externalActionExecuted: false
});

const requiredRegressionIds = ['M2', 'M3', 'M4', 'M5', 'VALIDATION', 'BROWSER_VISUAL'];
assert.deepEqual(
  inventory.hostedRegressionGates.map((gate) => gate.id),
  requiredRegressionIds
);
for (const gate of inventory.hostedRegressionGates) {
  assert.equal(gate.requiredOnExactHead, true);
  await access(gate.workflow);
}

process.stdout.write(
  `Milestone 6 reliability inventory PASS: ${records.size} executable scenarios and ${inventory.hostedRegressionGates.length} exact-head hosted regression gates.\n`
);
