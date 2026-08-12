import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const candidatePath = 'infrastructure/rehearsal/m7-wp-06-beta-rc.json';
const predecessorGateEvidencePath = '.artifacts/m7-wp-06-required-gates.json';
const requiredKnownLimitIds = [
  'LITE_LOCAL_WORKSPACE_SCOPE_ANCHOR',
  'FORWARD_ONLY_MIGRATIONS_NO_DOWN',
  'NON_PRODUCTION_REHEARSAL_ONLY',
  'EXTERNAL_ACTIONS_NOT_EXECUTED',
  'USER_REPORTED_EXTERNAL_USE_UNVERIFIED',
  'OWNER_RELEASE_ACTION_REQUIRED'
];
const requiredGateIds = [
  'validation',
  'm2-reliability',
  'm3-reliability',
  'm4-reliability',
  'm4-integration',
  'm5-reliability',
  'm5-integration',
  'm6-reliability',
  'product-loop-reliability',
  'browser-responsive',
  'm7-wp-02-conversion-analytics',
  'm7-wp-03-seeded-beta-scenario',
  'm7-wp-04-three-loop-full-journey',
  'm7-wp-05-deployment-rehearsal',
  'm7-wp-06-beta-rc-matrix'
];
const requiredDispatchedWorkflows = [
  'product-loop-closure-reliability.yml',
  'm7-wp-02-conversion-analytics.yml',
  'm7-wp-03-seeded-beta-scenario.yml',
  'm7-wp-04-three-loop-full-journey.yml',
  'm7-wp-05-deployment-rehearsal.yml'
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function requireText(relativePath, requiredFragments) {
  const source = await readFile(path.join(root, relativePath), 'utf8');
  for (const fragment of requiredFragments) {
    invariant(
      source.includes(fragment),
      `${relativePath} is missing required RC evidence fragment: ${fragment}`
    );
  }
}

const expectedHeadSha = process.env.M7_WP06_EXPECTED_HEAD_SHA;
invariant(expectedHeadSha, 'M7_WP06_EXPECTED_HEAD_SHA is required');

const exactHeadSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
invariant(
  exactHeadSha === expectedHeadSha,
  `exact head mismatch: expected ${expectedHeadSha}, got ${exactHeadSha}`
);

const candidate = await readJson(candidatePath);
invariant(candidate.schemaVersion === 1, 'unsupported Beta RC candidate schema version');
invariant(candidate.workPackage === 'M7-WP-06', 'candidate work package must be M7-WP-06');
invariant(
  candidate.candidateClass === 'BETA_RELEASE_CANDIDATE',
  'candidate class must remain BETA_RELEASE_CANDIDATE'
);
invariant(
  candidate.environmentClass === 'NON_PRODUCTION_REHEARSAL',
  'Beta RC evidence must remain non-production'
);
invariant(candidate.exactHeadRequired === true, 'exact-head qualification must remain required');
invariant(candidate.productionTrafficAllowed === false, 'production traffic must remain disabled');
invariant(candidate.releaseAuthorized === false, 'releaseAuthorized must remain false');
invariant(candidate.betaReleased === false, 'Beta must remain unreleased');
invariant(candidate.auditRequired === true, 'independent audit must remain required');
invariant(
  candidate.independentAuditComplete === false,
  'WP-06 may not claim the independent audit is complete'
);
invariant(candidate.secretsExcluded === true, 'candidate manifest must exclude secrets');

const predecessorCandidate = await readJson(candidate.predecessorCandidate);
invariant(
  predecessorCandidate.releaseAuthorized === false,
  'WP-05 predecessor may not authorize release'
);
invariant(
  predecessorCandidate.productionTrafficAllowed === false,
  'WP-05 predecessor may not authorize production traffic'
);
invariant(
  predecessorCandidate.exactHeadRequired === true,
  'WP-05 predecessor must remain exact-head'
);

const knownLimits = await readJson(candidate.knownLimitsFile);
invariant(
  knownLimits.releaseAuthorized === false,
  'known-limits document may not authorize release'
);
const knownLimitIds = new Set(knownLimits.limits.map((limit) => limit.id));
for (const limitId of requiredKnownLimitIds) {
  invariant(knownLimitIds.has(limitId), `missing required known limit: ${limitId}`);
}

const gates = new Map(candidate.requiredGates.map((gate) => [gate.id, gate]));
for (const gateId of requiredGateIds) {
  invariant(gates.has(gateId), `missing required release-candidate gate: ${gateId}`);
}
for (const gate of candidate.requiredGates) {
  invariant(
    Array.isArray(gate.coverage) && gate.coverage.length > 0,
    `gate ${gate.id} must declare coverage`
  );
  await readFile(path.join(root, gate.workflow));
}

for (const [coverage, required] of Object.entries(candidate.requiredCoverage)) {
  invariant(required === true, `required coverage must remain true: ${coverage}`);
}

await requireText('.github/workflows/m7-wp-02-conversion-analytics.yml', [
  'Run real PostgreSQL bounded conversion analytics suite',
  'contents: read'
]);
await requireText('.github/workflows/m7-wp-03-seeded-beta-scenario.yml', [
  "MARKORBIT_BETA_SEED_ENABLED: '1'",
  'Prove fail-closed guards and exact reset/reseed replay',
  'contents: read'
]);
await requireText('.github/workflows/m7-wp-04-three-loop-full-journey.yml', [
  'M7_WP04_EXPECTED_HEAD_SHA',
  '390px mobile',
  'workspaceIsolationCovered',
  'contents: read'
]);
await requireText('.github/workflows/m7-wp-05-deployment-rehearsal.yml', [
  'M7_WP05_EXPECTED_HEAD_SHA',
  'pg_restore',
  'Final workspace check',
  'contents: read'
]);

const predecessorGateEvidence = await readJson(predecessorGateEvidencePath);
invariant(
  predecessorGateEvidence.exactHeadSha === exactHeadSha,
  'predecessor gate evidence must match the exact candidate head'
);
const dispatchedByWorkflow = new Map(
  predecessorGateEvidence.gates.map((gate) => [gate.workflow, gate])
);
for (const workflow of requiredDispatchedWorkflows) {
  const gate = dispatchedByWorkflow.get(workflow);
  invariant(gate, `missing dispatched predecessor result: ${workflow}`);
  invariant(gate.conclusion === 'success', `dispatched predecessor gate must pass: ${workflow}`);
  invariant(
    Number.isInteger(gate.runId) && gate.runId > 0,
    `dispatched predecessor gate must record a run id: ${workflow}`
  );
}

const fingerprintInputs = [];
for (const relativePath of [...candidate.fingerprintInputs].sort()) {
  const content = await readFile(path.join(root, relativePath));
  fingerprintInputs.push({
    path: relativePath,
    sha256: sha256(content)
  });
}

const fingerprintMaterial = fingerprintInputs
  .map((input) => `${input.path}:${input.sha256}`)
  .join('\n');
const candidateConfigFingerprint = `sha256:${sha256(fingerprintMaterial)}`;

const evidence = {
  schemaVersion: 1,
  workPackage: 'M7-WP-06',
  candidateClass: candidate.candidateClass,
  exactHeadSha,
  result: 'PASS',
  candidateConfigFingerprint,
  fingerprintInputs,
  requiredGates: candidate.requiredGates,
  requiredCoverage: candidate.requiredCoverage,
  pathFilteredPredecessorGates: predecessorGateEvidence.gates,
  knownLimits: {
    source: candidate.knownLimitsFile,
    ids: knownLimits.limits.map((limit) => limit.id),
    count: knownLimits.limits.length
  },
  authority: {
    engineeringReadyForIndependentAudit: true,
    independentAuditComplete: false,
    releaseAuthorized: false,
    betaReleased: false,
    productionTrafficAllowed: false,
    productionDeploymentPerformed: false,
    releaseTagPublished: false,
    businessAuthorityCreated: false
  }
};

await mkdir(path.join(root, '.artifacts'), { recursive: true });
await writeFile(
  path.join(root, '.artifacts/m7-wp-06-beta-rc-matrix.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8'
);

console.log(
  JSON.stringify({
    result: evidence.result,
    exactHeadSha,
    candidateConfigFingerprint,
    knownLimits: evidence.knownLimits.count
  })
);
