import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const auditPath = 'docs/audits/MO-MVP-MILESTONE-007-BETA-READINESS-AUDIT.json';
const wp06MatrixPath = '.artifacts/wp06/m7-wp-06-beta-rc-matrix.json';
const wp06GatePath = '.artifacts/wp06/m7-wp-06-required-gates.json';
const runInventoryPath = '.artifacts/m7-wp-07-run-inventory.json';

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function readCandidateText(candidateSha, relativePath) {
  return git('show', `${candidateSha}:${relativePath}`);
}

function readCandidateJson(candidateSha, relativePath) {
  return JSON.parse(readCandidateText(candidateSha, relativePath));
}

const audit = await readJson(auditPath);
const candidateSha = process.env.M7_WP07_AUDITED_CANDIDATE_SHA ?? audit.auditedCandidateSha;
const mergedBaselineSha =
  process.env.M7_WP07_MERGED_BASELINE_SHA ?? audit.auditedMergedBaselineSha;
const expectedTreeSha = process.env.M7_WP07_EXPECTED_TREE_SHA ?? audit.auditedTreeSha;

invariant(audit.schemaVersion === 1, 'unsupported M7-WP-07 audit schema');
invariant(audit.workPackage === 'M7-WP-07', 'audit work package must be M7-WP-07');
invariant(audit.finalRecommendation === 'GO', 'committed audit recommendation must be GO');
invariant(candidateSha === audit.auditedCandidateSha, 'audited candidate SHA drifted');
invariant(mergedBaselineSha === audit.auditedMergedBaselineSha, 'merged baseline SHA drifted');
invariant(expectedTreeSha === audit.auditedTreeSha, 'audited tree SHA drifted');

const candidateTreeSha = git('rev-parse', `${candidateSha}^{tree}`);
const mergedTreeSha = git('rev-parse', `${mergedBaselineSha}^{tree}`);
invariant(candidateTreeSha === expectedTreeSha, 'candidate tree does not match audited tree');
invariant(mergedTreeSha === expectedTreeSha, 'merged WP-06 tree does not match audited candidate tree');

const candidate = readCandidateJson(
  candidateSha,
  'infrastructure/rehearsal/m7-wp-06-beta-rc.json'
);
const knownLimits = readCandidateJson(
  candidateSha,
  'infrastructure/rehearsal/m7-wp-06-known-limits.json'
);
const agents = readCandidateText(candidateSha, 'AGENTS.md');
const scopeLock = readCandidateText(
  candidateSha,
  'docs/planning/MO-MVP-MILESTONE-007-SCOPE-LOCK.md'
);
const deliveryPlan = readCandidateText(
  candidateSha,
  'docs/planning/MO-MVP-MILESTONE-007-DELIVERY-PLAN.md'
);
const authorityBoundary = readCandidateText(
  candidateSha,
  'docs/architecture/BETA-READINESS-AUTHORITY-BOUNDARY.md'
);

invariant(candidate.candidateClass === 'BETA_RELEASE_CANDIDATE', 'candidate class drifted');
invariant(candidate.environmentClass === 'NON_PRODUCTION_REHEARSAL', 'candidate environment drifted');
invariant(candidate.exactHeadRequired === true, 'candidate must remain exact-head qualified');
invariant(candidate.productionTrafficAllowed === false, 'production traffic must remain disabled');
invariant(candidate.releaseAuthorized === false, 'WP-06 candidate may not authorize release');
invariant(candidate.betaReleased === false, 'WP-06 candidate may not claim released Beta');
invariant(candidate.auditRequired === true, 'WP-06 candidate must require independent audit');
invariant(
  candidate.independentAuditComplete === false,
  'WP-06 candidate itself may not claim the later audit is complete'
);
invariant(candidate.secretsExcluded === true, 'candidate manifest must exclude secrets');

const requiredAuthorityFragments = [
  'Recommendation != authorization',
  'Prepared Action != executed action',
  'PublishPackage != Published',
  'Candidate != Formal Opportunity',
  'Formal Opportunity != Intake',
  'Intake != Order != Matter != Filing',
  'Evidence Review Decision != Official Truth',
  'Lifecycle Projection != Official Status',
  'Provider Return != Official Truth',
  'Product/work evidence != Capability verification',
  'Reflection Candidate != canonical truth',
  'accepted private reflection != verified Capability'
];
for (const fragment of requiredAuthorityFragments) {
  invariant(scopeLock.includes(fragment), `scope lock missing authority distinction: ${fragment}`);
}
invariant(agents.includes('No direct cross-service database reads.'), 'AGENTS owner-SQL lock missing');
invariant(scopeLock.includes('no cross-service SQL'), 'M7 scope lock cross-service SQL lock missing');
invariant(
  authorityBoundary.includes('Product metric != business authority'),
  'analytics non-authority distinction missing'
);
invariant(
  authorityBoundary.includes('Seeded demo record != customer/provider/official truth'),
  'seed isolation distinction missing'
);
invariant(
  authorityBoundary.includes('Deployment Rehearsal != Production Deployment'),
  'deployment rehearsal distinction missing'
);
invariant(
  authorityBoundary.includes('Beta Release Candidate != Released Beta'),
  'release-candidate distinction missing'
);
invariant(
  deliveryPlan.includes('M7-WP-07 independent Beta readiness and authority audit'),
  'approved delivery plan no longer points to M7-WP-07'
);

const limitIds = new Set(knownLimits.limits.map((limit) => limit.id));
for (const limitId of audit.knownLimitIds) {
  invariant(limitIds.has(limitId), `missing audited known limit: ${limitId}`);
}
invariant(
  knownLimits.limits.length === audit.knownLimitIds.length,
  'known-limit count changed without updating the independent audit'
);
for (const limit of knownLimits.limits) {
  invariant(limit.impact?.length > 0, `known limit ${limit.id} is missing impact`);
  invariant(limit.mitigation?.length > 0, `known limit ${limit.id} is missing mitigation`);
}

const wp06Matrix = await readJson(wp06MatrixPath);
const wp06Gates = await readJson(wp06GatePath);
invariant(wp06Matrix.result === 'PASS', 'WP-06 matrix must be PASS');
invariant(wp06Matrix.exactHeadSha === candidateSha, 'WP-06 matrix head does not match audited candidate');
invariant(
  wp06Matrix.candidateConfigFingerprint === audit.candidateConfigFingerprint,
  'candidate/config fingerprint does not match the independent audit record'
);
invariant(wp06Matrix.authority.independentAuditComplete === false, 'WP-06 artifact may not self-audit');
invariant(wp06Matrix.authority.releaseAuthorized === false, 'WP-06 artifact may not authorize release');
invariant(wp06Matrix.authority.betaReleased === false, 'WP-06 artifact may not claim released Beta');
invariant(
  wp06Matrix.authority.productionDeploymentPerformed === false,
  'WP-06 artifact may not claim production deployment'
);
invariant(wp06Gates.exactHeadSha === candidateSha, 'WP-06 predecessor evidence head drifted');

const runInventory = await readJson(runInventoryPath);
const runs = runInventory.workflow_runs ?? [];
const runsById = new Map(runs.map((run) => [run.id, run]));
for (const required of audit.requiredWorkflowEvidence) {
  const run = runsById.get(required.runId);
  invariant(run, `missing required workflow run ${required.runId}: ${required.name}`);
  invariant(run.name === required.name, `workflow name mismatch for run ${required.runId}`);
  invariant(run.event === required.event, `workflow event mismatch for run ${required.runId}`);
  invariant(run.head_sha === candidateSha, `workflow head mismatch for run ${required.runId}`);
  invariant(run.status === 'completed', `workflow run ${required.runId} is not complete`);
  invariant(run.conclusion === 'success', `workflow run ${required.runId} did not succeed`);
}

const dispatchedRuns = new Map(
  wp06Matrix.pathFilteredPredecessorGates.map((gate) => [gate.runId, gate])
);
for (const required of audit.requiredWorkflowEvidence.filter(
  (evidence) => evidence.event === 'workflow_dispatch'
)) {
  const gate = dispatchedRuns.get(required.runId);
  invariant(gate, `WP-06 artifact omitted dispatched run ${required.runId}`);
  invariant(gate.conclusion === 'success', `WP-06 dispatched run ${required.runId} did not pass`);
}

const falseAuthorityFields = [
  'recommendationAuthorizesAction',
  'preparedActionIsExecutedAction',
  'publishPackageIsPublished',
  'candidateIsFormalOpportunity',
  'formalOpportunityIsIntake',
  'intakeIsOrderMatterOrFiling',
  'evidenceReviewDecisionIsOfficialTruth',
  'lifecycleProjectionIsOfficialStatus',
  'providerReturnIsOfficialTruth',
  'productWorkEvidenceVerifiesCapability',
  'reflectionCandidateIsCanonicalTruth',
  'acceptedPrivateReflectionIsVerifiedCapability',
  'deploymentRehearsalIsProductionDeployment',
  'betaReleaseCandidateIsReleasedBeta',
  'crossServiceSqlAllowed',
  'paymentOrInvoiceCreated',
  'legalAppointmentCreated',
  'filingSubmitted',
  'officialTruthCreated',
  'capabilityVerifiedAutomatically',
  'capabilityCanonMutatedAutomatically',
  'publicCapabilityRankingOrCertificationCreated',
  'autonomousTwinProtectedActionAuthorityCreated'
];
for (const field of falseAuthorityFields) {
  invariant(audit.authorityLocks[field] === false, `audit authority lock must remain false: ${field}`);
}

invariant(
  audit.releaseEligibility.eligibleForExplicitOwnerReleaseConsideration === true,
  'GO audit must make the candidate eligible for Owner consideration'
);
invariant(audit.releaseEligibility.independentAuditComplete === true, 'independent audit must be complete');
for (const field of [
  'releaseAuthorized',
  'betaReleased',
  'productionDeploymentPerformed',
  'productionTrafficCutover',
  'releaseTagPublished',
  'businessAuthorityCreated'
]) {
  invariant(
    audit.releaseEligibility[field] === false,
    `independent audit may not create release/deployment authority: ${field}`
  );
}
invariant(audit.mergeRequiresExplicitOwnerAction === true, 'audit merge must require explicit Owner action');
invariant(audit.auditCreatesReleaseOrDeployment === false, 'audit may not create release/deployment');

const changedFiles = git('diff', '--name-only', `${mergedBaselineSha}...HEAD`)
  .split('\n')
  .filter(Boolean);
const allowedAuditPaths = [
  '.github/workflows/m7-wp-06-beta-rc.yml',
  '.github/workflows/m7-wp-07-independent-beta-audit.yml',
  'scripts/m7-wp-07-independent-beta-audit.mjs',
  'docs/audits/MO-MVP-MILESTONE-007-BETA-READINESS-AUDIT.json',
  'docs/audits/MO-MVP-MILESTONE-007-BETA-READINESS-AUDIT.md',
  'docs/tasks/MO-MVP-M7-WP-07-INDEPENDENT-BETA-READINESS-AUDIT.md',
  'README.md'
];
for (const changedFile of changedFiles) {
  invariant(allowedAuditPaths.includes(changedFile), `WP-07 changed out-of-scope file: ${changedFile}`);
}

const evidence = {
  schemaVersion: 1,
  milestone: audit.milestone,
  workPackage: audit.workPackage,
  auditedCandidateSha: candidateSha,
  auditedMergedBaselineSha: mergedBaselineSha,
  auditedTreeSha: expectedTreeSha,
  candidateConfigFingerprint: audit.candidateConfigFingerprint,
  requiredWorkflowRunsVerified: audit.requiredWorkflowEvidence.length,
  knownLimitsVerified: audit.knownLimitIds.length,
  repositoryBoundaryValidatorsRequired: true,
  finalRecommendation: 'GO',
  releaseEligibility: audit.releaseEligibility
};

await mkdir(path.join(root, '.artifacts'), { recursive: true });
await writeFile(
  path.join(root, '.artifacts/m7-wp-07-independent-beta-audit.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8'
);

console.log(JSON.stringify(evidence));
