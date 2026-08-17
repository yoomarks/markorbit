import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const candidatePath = 'infrastructure/rehearsal/m8-wp-06-commercial-runtime.json';
const requiredKnownLimitIds = [
  'STRIPE_TEST_CREDENTIAL_REQUIRED',
  'FORWARD_ONLY_MIGRATIONS_NO_DOWN',
  'NON_PRODUCTION_REHEARSAL_ONLY',
  'COMMERCIAL_ADMIN_OWNER_ROUTING_ONLY',
  'EXTERNAL_PROTECTED_ACTIONS_NOT_EXECUTED',
  'OWNER_MERGE_RELEASE_ACTION_REQUIRED'
];
const requiredGateIds = [
  'validation',
  'browser-responsive',
  'product-loop-reliability',
  'm7-deployment-recovery',
  'm7-exact-head-candidate',
  'stripe-real-provider-acceptance',
  'm8-wp06-commercial-runtime-reliability'
];
const requiredReliabilityTests = [
  'services/core/tests/account-access-postgres.test.ts',
  'services/core/tests/account-onboarding-postgres.test.ts',
  'services/core/tests/commercial-admin-account.test.ts',
  'services/markreg/tests/commercial-admin-read.test.ts',
  'services/markreg/tests/commercial-checkout-postgres.test.ts',
  'services/markreg/tests/audit-postgres.test.ts',
  'services/payment/tests/payment-admin-http.test.ts',
  'services/payment/tests/payment-postgres.test.ts',
  'services/payment/tests/payment-lifecycle-postgres.test.ts',
  'services/payment/tests/stripe-provider.test.ts',
  'apps/gateway/tests/commercial-admin-account-http.test.ts',
  'apps/gateway/tests/commercial-admin-markreg-http.test.ts',
  'apps/gateway/tests/commercial-admin-mgsn-http.test.ts',
  'apps/gateway/tests/commercial-admin-payment-http.test.ts',
  'apps/gateway/tests/commercial-checkout-boundary.test.ts'
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function requireText(relativePath, fragments) {
  const source = await readFile(path.join(root, relativePath), 'utf8');
  for (const fragment of fragments) {
    invariant(
      source.includes(fragment),
      `${relativePath} is missing required fragment: ${fragment}`
    );
  }
}

const expectedHeadSha = process.env.M8_WP06_EXPECTED_HEAD_SHA;
invariant(expectedHeadSha, 'M8_WP06_EXPECTED_HEAD_SHA is required');

const exactHeadSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
invariant(
  exactHeadSha === expectedHeadSha,
  `exact head mismatch: expected ${expectedHeadSha}, got ${exactHeadSha}`
);

const candidate = await readJson(candidatePath);
invariant(candidate.schemaVersion === 1, 'unsupported M8-WP-06 candidate schema version');
invariant(candidate.workPackage === 'M8-WP-06', 'candidate work package must be M8-WP-06');
invariant(
  candidate.candidateClass === 'MVP_COMMERCIAL_RUNTIME_CANDIDATE',
  'candidate class must remain MVP_COMMERCIAL_RUNTIME_CANDIDATE'
);
invariant(
  candidate.environmentClass === 'NON_PRODUCTION_REHEARSAL',
  'commercial reliability evidence must remain non-production'
);
invariant(candidate.exactHeadRequired === true, 'exact-head qualification must remain required');
invariant(candidate.productionTrafficAllowed === false, 'production traffic must remain disabled');
invariant(candidate.releaseAuthorized === false, 'releaseAuthorized must remain false');
invariant(candidate.m8Complete === false, 'WP06 may not declare M8 complete');
invariant(candidate.auditRequired === true, 'independent audit must remain required');
invariant(
  candidate.independentAuditComplete === false,
  'WP06 may not claim the independent audit is complete'
);
invariant(candidate.secretsExcluded === true, 'candidate manifest must exclude secrets');

const providerGate = candidate.externalProviderAcceptance;
invariant(
  providerGate.workflow === '.github/workflows/payment-stripe-sandbox-acceptance.yml',
  'Stripe real-provider workflow must remain the canonical external gate'
);
invariant(
  providerGate.credentialSecretName === 'STRIPE_TEST_SECRET_KEY',
  'Stripe test credential contract changed unexpectedly'
);
invariant(
  providerGate.requiredForM8Completion === true,
  'real Stripe acceptance must gate M8 completion'
);
invariant(
  providerGate.mayBeUnresolvedForDeterministicWP06 === true,
  'deterministic WP06 must not forge external provider completion'
);
invariant(
  providerGate.fakeProviderCounts === false,
  'fake provider may not count as Stripe acceptance'
);
invariant(
  providerGate.mockedFetchCounts === false,
  'mocked fetch may not count as Stripe acceptance'
);
invariant(
  providerGate.skippedTestCounts === false,
  'skipped sandbox test may not count as Stripe acceptance'
);

const knownLimits = await readJson(candidate.knownLimitsFile);
invariant(knownLimits.schemaVersion === 1, 'unsupported WP06 known-limits schema version');
invariant(knownLimits.workPackage === 'M8-WP-06', 'known limits must belong to M8-WP-06');
invariant(knownLimits.releaseAuthorized === false, 'known limits may not authorize release');
invariant(
  knownLimits.productionTrafficAllowed === false,
  'known limits may not authorize production traffic'
);
invariant(knownLimits.m8Complete === false, 'known limits may not declare M8 complete');
const knownLimitIds = new Set(knownLimits.limits.map((limit) => limit.id));
for (const id of requiredKnownLimitIds) {
  invariant(knownLimitIds.has(id), `missing required known limit: ${id}`);
}

const serializedBoundedEvidence = JSON.stringify({ candidate, knownLimits });
const secretValuePattern = /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}/;
invariant(
  !secretValuePattern.test(serializedBoundedEvidence),
  'candidate or known-limits evidence contains a credential-like secret value'
);

const gates = new Map(candidate.requiredGates.map((gate) => [gate.id, gate]));
for (const gateId of requiredGateIds) {
  invariant(gates.has(gateId), `missing required commercial reliability gate: ${gateId}`);
}
for (const gate of candidate.requiredGates) {
  invariant(
    Array.isArray(gate.coverage) && gate.coverage.length > 0,
    `gate ${gate.id} must declare coverage`
  );
  await readFile(path.join(root, gate.workflow));
}
for (const [coverage, required] of Object.entries(candidate.requiredCoverage)) {
  invariant(required === true, `required commercial coverage must remain true: ${coverage}`);
}

for (const testPath of requiredReliabilityTests) {
  await readFile(path.join(root, testPath));
}

await requireText('.github/workflows/ci.yml', [
  'Payment integration',
  "PAYMENT_POSTGRES_REQUIRED: '1'",
  'pnpm test:gateway-inventory'
]);
await requireText('.github/workflows/payment-stripe-sandbox-acceptance.yml', [
  'STRIPE_TEST_SECRET_KEY',
  "STRIPE_SANDBOX_ACCEPTANCE: '1'",
  'sk_test_',
  'rk_test_',
  'whsec_'
]);
await requireText('apps/operations-console/src/commercial-admin.tsx', [
  'commercial-admin:read',
  '/api/internal/commercial-admin/payments/',
  '/api/internal/commercial-admin/providers'
]);
await requireText('services/payment/src/stripe-provider.ts', [
  'STRIPE_API_VERSION',
  'payment_intent.succeeded',
  'refund.created'
]);

const fingerprintInputs = [];
for (const relativePath of [...candidate.fingerprintInputs].sort()) {
  const content = await readFile(path.join(root, relativePath));
  fingerprintInputs.push({ path: relativePath, sha256: sha256(content) });
}
const fingerprintMaterial = fingerprintInputs
  .map((input) => `${input.path}:${input.sha256}`)
  .join('\n');
const candidateConfigFingerprint = `sha256:${sha256(fingerprintMaterial)}`;

const evidence = {
  schemaVersion: 1,
  workPackage: 'M8-WP-06',
  candidateClass: candidate.candidateClass,
  exactHeadSha,
  deterministicResult: 'PASS',
  candidateConfigFingerprint,
  fingerprintInputs,
  requiredGates: candidate.requiredGates,
  requiredCoverage: candidate.requiredCoverage,
  requiredReliabilityTests,
  knownLimits: {
    source: candidate.knownLimitsFile,
    ids: knownLimits.limits.map((limit) => limit.id),
    count: knownLimits.limits.length
  },
  stripeRealProviderAcceptance: {
    workflow: providerGate.workflow,
    requiredForM8Completion: true,
    executedByThisGate: false,
    status: 'SEPARATE_EXTERNAL_CREDENTIAL_GATE_REQUIRED'
  },
  authority: {
    engineeringReadyForIndependentAuditMayBeTrue: true,
    independentAuditComplete: false,
    m8Complete: false,
    releaseAuthorized: false,
    productionTrafficAllowed: false,
    productionDeploymentPerformed: false,
    releaseTagPublished: false,
    businessAuthorityCreated: false,
    filingSubmitted: false,
    officialTruthCreated: false,
    commercialAdminBecameOwnerDatabase: false
  }
};

await mkdir(path.join(root, '.artifacts'), { recursive: true });
await writeFile(
  path.join(root, '.artifacts/m8-wp-06-commercial-runtime-reliability.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8'
);

console.log(
  JSON.stringify({
    deterministicResult: evidence.deterministicResult,
    exactHeadSha,
    candidateConfigFingerprint,
    knownLimits: evidence.knownLimits.count,
    stripeRealProviderAcceptance: evidence.stripeRealProviderAcceptance.status
  })
);
