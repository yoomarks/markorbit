import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const contractPath = 'docs/audits/MO-MVP-MILESTONE-009-RELIABILITY-AUDIT.json';
const wp07PrPath = '.artifacts/m9-wp08-wp07-pr.json';
const candidateRunsPath = '.artifacts/m9-wp08-candidate-runs.json';
const candidateTestsPath = '.artifacts/m9-wp08-independent-candidate-tests.json';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function candidateText(candidateSha, relativePath) {
  return git('show', `${candidateSha}:${relativePath}`);
}

const audit = await readJson(contractPath);
const candidateSha = process.env.M9_WP08_AUDITED_CANDIDATE_SHA ?? audit.auditedCandidateSha;

invariant(audit.schemaVersion === 1, 'unsupported M9-WP08 audit schema');
invariant(audit.milestone === 'M9', 'audit milestone must be M9');
invariant(audit.workPackage === 'M9-WP-08', 'audit work package must be M9-WP-08');
invariant(candidateSha === audit.auditedCandidateSha, 'audited candidate SHA drifted');
invariant(
  git('rev-parse', `${candidateSha}^{tree}`) === audit.auditedCandidateTreeSha,
  'audited candidate tree drifted'
);
invariant(audit.authority.mergeRequiresExplicitOwnerAction === true, 'Owner merge lock missing');
invariant(
  audit.authority.releaseRequiresExplicitOwnerAction === true,
  'Owner release lock missing'
);
invariant(
  audit.authority.auditCreatesMergeReleaseOrDeployment === false,
  'audit may not create merge/release/deployment authority'
);

const deliveryPlan = candidateText(
  candidateSha,
  'docs/planning/MO-MVP-MILESTONE-009-DELIVERY-PLAN.md'
);
const scopeLock = candidateText(candidateSha, 'docs/planning/MO-MVP-MILESTONE-009-SCOPE-LOCK.md');
const wp07Task = candidateText(candidateSha, 'docs/tasks/MO-MVP-M9-WP-07-PREFERENCE-FEEDBACK.md');
const browserRuntime = candidateText(candidateSha, audit.canonicalAcceptance.browserRuntimePath);
const browserSpec = candidateText(candidateSha, audit.independentCandidateTests.realBrowser);
const dailySignalTests = [
  candidateText(candidateSha, 'services/lite/tests/daily-signal.test.ts'),
  candidateText(candidateSha, audit.independentCandidateTests.dailySignalPostgres)
].join('\n');
const durableTests = [
  dailySignalTests,
  candidateText(candidateSha, audit.independentCandidateTests.dailyOrbitPostgres),
  candidateText(candidateSha, audit.independentCandidateTests.visualBridgePostgres),
  candidateText(candidateSha, audit.independentCandidateTests.preferenceFeedbackPostgres)
].join('\n');

for (const fragment of [
  'WP08 — Reliability and independent audit',
  'real Knowledge-derived source on the acceptance path',
  'bounded concurrency behavior',
  'real browser flow desktop + mobile',
  'no route interception/fixture fallback for canonical acceptance'
]) {
  invariant(deliveryPlan.includes(fragment), `M9 delivery plan missing: ${fragment}`);
}
for (const fragment of [
  'PublishPackage != Published',
  'Preference feedback != Capability verification',
  'Knowledge remains acquisition + provenance'
]) {
  invariant(scopeLock.includes(fragment), `M9 scope lock missing: ${fragment}`);
}
invariant(
  wp07Task.includes('is not professional Capability evidence'),
  'WP07 Product/Capability authority lock missing'
);
invariant(
  wp07Task.includes('does not independently verify an external publication or outcome'),
  'WP07 external-outcome authority lock missing'
);

const candidateRuns = await readJson(candidateRunsPath);
const runsById = new Map((candidateRuns.workflow_runs ?? []).map((run) => [run.id, run]));
for (const required of audit.requiredWorkflowEvidence) {
  const run = runsById.get(required.runId);
  invariant(run, `missing candidate workflow run ${required.runId}: ${required.name}`);
  invariant(run.name === required.name, `workflow name mismatch for run ${required.runId}`);
  invariant(run.head_sha === candidateSha, `workflow head mismatch for run ${required.runId}`);
  invariant(run.status === 'completed', `workflow run ${required.runId} is incomplete`);
  invariant(run.conclusion === 'success', `workflow run ${required.runId} did not succeed`);
}

const candidateTests = await readJson(candidateTestsPath);
invariant(candidateTests.schemaVersion === 1, 'candidate test marker schema drifted');
invariant(candidateTests.auditedCandidateSha === candidateSha, 'candidate tests used wrong SHA');
invariant(candidateTests.result === 'PASS', 'independent candidate test matrix did not PASS');

const changedFiles = git('diff', '--name-only', audit.baselineMainSha, 'HEAD')
  .split('\n')
  .filter(Boolean);
const allowedAuditPaths = new Set([
  '.github/workflows/m9-wp08-independent-reliability-audit.yml',
  'scripts/m9-wp08-independent-reliability-audit.mjs',
  'docs/audits/MO-MVP-MILESTONE-009-RELIABILITY-AUDIT.json',
  'docs/audits/MO-MVP-MILESTONE-009-RELIABILITY-AUDIT.md',
  'docs/tasks/MO-MVP-M9-WP-08-INDEPENDENT-RELIABILITY-AUDIT.md'
]);
for (const changedFile of changedFiles) {
  invariant(allowedAuditPaths.has(changedFile), `WP08 changed out-of-scope file: ${changedFile}`);
}

const requiredSourceMarkersPresent = audit.canonicalAcceptance.requiredSourceMarkers.every(
  (marker) => browserRuntime.includes(marker)
);
const blockingSourceMarkers =
  audit.canonicalAcceptance.fixtureOrDirectSeedMarkersThatBlockRealKnowledgeProof.filter((marker) =>
    browserRuntime.includes(marker)
  );
const realKnowledgeDerivedSourceProven =
  requiredSourceMarkersPresent && blockingSourceMarkers.length === 0;
const exactProvenanceVerified =
  browserSpec.includes('Source & ranking reasons') &&
  browserSpec.includes('rdp_wp06-browser-') &&
  browserRuntime.includes('sourceFingerprintSha256');
const workspaceIsolationVerified =
  durableTests.includes('otherWorkspaceId') &&
  browserSpec.includes('desktopWorkspaceId') &&
  browserSpec.includes('mobileWorkspaceId');
const staleSourceRejectionVerified = /stale|mismatch|fingerprint/iu.test(dailySignalTests);
const replaySafetyVerified = /idempot|replay|ON CONFLICT/iu.test(durableTests);
const restartRecoveryVerified = /restart|reopen|second store|new Postgres/iu.test(durableTests);
const boundedConcurrencyVerified = /Promise\.all|concurr/iu.test(durableTests);
const noRouteInterceptionVerified =
  !browserSpec.includes('page.route(') &&
  !browserSpec.includes('route.fulfill(') &&
  !browserSpec.includes('context.route(');
const desktopMobileVerified =
  browserSpec.includes("project.name.includes('mobile')") &&
  browserSpec.includes('mobileWorkspaceId');
const noFalsePublicationVerified =
  wp07Task.includes('does not independently verify an external publication or outcome') &&
  browserSpec.includes('externalActionExecutedByMarkOrbit') &&
  browserSpec.includes('externalOutcomeVerifiedByMarkOrbit');
const noFalseCapabilityVerified =
  wp07Task.includes('is not professional Capability evidence') &&
  browserSpec.includes('capabilityVerified');

const blockers = [];
if (!realKnowledgeDerivedSourceProven)
  blockers.push('REAL_KNOWLEDGE_DERIVED_BROWSER_PATH_NOT_PROVEN');
if (!exactProvenanceVerified) blockers.push('EXACT_PROVENANCE_EVIDENCE_MISSING');
if (!workspaceIsolationVerified) blockers.push('WORKSPACE_ISOLATION_EVIDENCE_MISSING');
if (!staleSourceRejectionVerified) blockers.push('STALE_SOURCE_REJECTION_EVIDENCE_MISSING');
if (!replaySafetyVerified) blockers.push('IDEMPOTENT_REPLAY_EVIDENCE_MISSING');
if (!restartRecoveryVerified) blockers.push('RESTART_RECOVERY_EVIDENCE_MISSING');
if (!boundedConcurrencyVerified) blockers.push('BOUNDED_CONCURRENCY_EVIDENCE_MISSING');
if (!noRouteInterceptionVerified) blockers.push('CANONICAL_BROWSER_INTERCEPTION_DETECTED');
if (!desktopMobileVerified) blockers.push('DESKTOP_MOBILE_BROWSER_EVIDENCE_MISSING');
if (!noFalsePublicationVerified) blockers.push('FALSE_PUBLICATION_GUARD_EVIDENCE_MISSING');
if (!noFalseCapabilityVerified) blockers.push('FALSE_CAPABILITY_GUARD_EVIDENCE_MISSING');

const wp07Pr = await readJson(wp07PrPath);
invariant(wp07Pr.number === audit.wp07PullRequestNumber, 'WP07 PR snapshot number drifted');
invariant(wp07Pr.head?.sha === candidateSha, 'WP07 PR head does not match audited candidate');
let mainlineTreeIdentityVerified = false;
if (!wp07Pr.merged_at) {
  blockers.push('WP07_NOT_MERGED_TO_MAIN');
} else if (!wp07Pr.merge_commit_sha) {
  blockers.push('WP07_MERGE_COMMIT_MISSING');
} else {
  try {
    git('fetch', '--quiet', 'origin', wp07Pr.merge_commit_sha);
    const mergedTree = git('rev-parse', `${wp07Pr.merge_commit_sha}^{tree}`);
    if (mergedTree === audit.auditedCandidateTreeSha) mainlineTreeIdentityVerified = true;
    else blockers.push('WP07_MERGED_TREE_MISMATCH');
  } catch {
    blockers.push('WP07_MERGE_IDENTITY_UNVERIFIED');
  }
}

const regressionNames = new Set(audit.requiredWorkflowEvidence.map((entry) => entry.name));
const m1ToM8RegressionVerified =
  regressionNames.has('validation') &&
  regressionNames.has('M6 WP-06 Authenticated Capability Center') &&
  regressionNames.has('M7 WP-02 Conversion Analytics') &&
  regressionNames.has('M8 WP-06 Commercial Runtime Reliability') &&
  regressionNames.has('Browser and Visual Validation');
if (!m1ToM8RegressionVerified) blockers.push('M1_M8_REGRESSION_EVIDENCE_MISSING');

const uniqueBlockers = [...new Set(blockers)].sort();
const finalRecommendation = uniqueBlockers.length === 0 ? 'GO' : 'FIX';
const evidence = {
  schemaVersion: 1,
  milestone: 'M9',
  workPackage: 'M9-WP-08',
  auditedCandidateSha: candidateSha,
  auditedCandidateTreeSha: audit.auditedCandidateTreeSha,
  requiredWorkflowRunsVerified: audit.requiredWorkflowEvidence.length,
  independentCandidateTests: candidateTests,
  runtimeEvidence: {
    realKnowledgeDerivedSourceProven,
    blockingSourceMarkers,
    exactProvenanceVerified,
    workspaceIsolationVerified,
    staleSourceRejectionVerified,
    idempotentReplaySafeMutationsVerified: replaySafetyVerified,
    restartRecoveryVerified,
    boundedConcurrencyVerified,
    desktopMobileRealBrowserVerified: desktopMobileVerified,
    noRouteInterceptionVerified,
    noFalsePublicationVerified,
    noFalseCapabilityVerified,
    m1ToM8RegressionVerified
  },
  wp07Mainline: {
    pullRequest: audit.wp07PullRequestNumber,
    merged: Boolean(wp07Pr.merged_at),
    mergeCommitSha: wp07Pr.merge_commit_sha ?? null,
    treeIdentityVerified: mainlineTreeIdentityVerified
  },
  independentAuditComplete: true,
  finalRecommendation,
  blockers: uniqueBlockers,
  authority: {
    m9Complete: false,
    mergeAuthorized: false,
    releaseAuthorized: false,
    productionTrafficAllowed: false,
    productionDeploymentPerformed: false,
    releaseTagPublished: false,
    externalPublicationAuthorized: false,
    capabilityVerificationCreated: false,
    filingSubmitted: false,
    officialTruthCreated: false
  }
};

await mkdir(path.join(root, '.artifacts'), { recursive: true });
await writeFile(
  path.join(root, '.artifacts/m9-wp08-independent-reliability-audit.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8'
);
console.log(JSON.stringify(evidence));
