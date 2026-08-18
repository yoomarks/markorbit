import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const auditPath = 'docs/audits/MO-MVP-MILESTONE-009-DAILY-WORKSPACE-READINESS-AUDIT.json';
const prSnapshotPath = '.artifacts/m9-wp08-wp07-pr.json';
const candidateRunsPath = '.artifacts/m9-wp08-candidate-runs.json';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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

const audit = await readJson(auditPath);
const candidateSha = process.env.M9_WP08_AUDITED_CANDIDATE_SHA ?? audit.auditedCandidateSha;

invariant(audit.schemaVersion === 1, 'unsupported M9-WP08 audit schema');
invariant(audit.milestone === 'M9', 'audit milestone must be M9');
invariant(audit.workPackage === 'M9-WP-08', 'audit work package must be M9-WP-08');
invariant(candidateSha === audit.auditedCandidateSha, 'audited candidate SHA drifted');
invariant(
  git('rev-parse', `${candidateSha}^{tree}`) === audit.auditedCandidateTreeSha,
  'audited candidate tree drifted'
);
invariant(
  audit.authority.auditCreatesMergeReleaseOrDeployment === false,
  'audit may not create merge/release/deployment authority'
);
invariant(
  audit.authority.auditAuthorizesExternalPublication === false,
  'audit may not authorize external publication'
);
invariant(
  audit.authority.auditCreatesCapabilityEvidence === false,
  'audit may not create Capability evidence'
);

const allowedAuditPaths = new Set([
  '.github/workflows/m9-wp08-independent-daily-workspace-audit.yml',
  'scripts/m9-wp08-independent-daily-workspace-audit.mjs',
  'docs/audits/MO-MVP-MILESTONE-009-DAILY-WORKSPACE-READINESS-AUDIT.json',
  'docs/audits/MO-MVP-MILESTONE-009-DAILY-WORKSPACE-READINESS-AUDIT.md',
  'docs/tasks/MO-MVP-M9-WP-08-RELIABILITY-INDEPENDENT-AUDIT.md'
]);
const auditChangedFiles = git('diff', '--name-only', audit.wp06MainBaselineSha, 'HEAD')
  .split('\n')
  .filter(Boolean);
for (const changedFile of auditChangedFiles) {
  invariant(allowedAuditPaths.has(changedFile), `WP08 changed out-of-scope file: ${changedFile}`);
}

const blockers = [];
const evidence = {
  exactCandidateIdentity: false,
  requiredWorkflowRunsVerified: 0,
  mainlineIdentityVerified: false,
  sourceVocabularyCorrect: false,
  realKnowledgeSourceAcceptanceVerified: false,
  exactProvenanceEvidence: false,
  workspaceIsolationEvidence: false,
  staleSourceRejectionEvidence: false,
  replaySafetyEvidence: false,
  restartRecoveryEvidence: false,
  boundedConcurrencyEvidence: false,
  desktopAndMobileBrowserEvidence: false,
  canonicalRouteInterceptionAbsent: false,
  productFeedbackCapabilitySeparationEvidence: false
};

evidence.exactCandidateIdentity = true;

const candidateRuns = await readJson(candidateRunsPath);
const runs = candidateRuns.workflow_runs ?? [];
const runsById = new Map(runs.map((run) => [run.id, run]));
for (const required of audit.requiredWorkflowEvidence) {
  const run = runsById.get(required.runId);
  invariant(run, `missing required candidate workflow run ${required.runId}: ${required.name}`);
  invariant(run.name === required.name, `workflow name mismatch for run ${required.runId}`);
  invariant(run.head_sha === candidateSha, `workflow head mismatch for run ${required.runId}`);
  invariant(run.status === 'completed', `workflow run ${required.runId} is incomplete`);
  invariant(run.conclusion === 'success', `workflow run ${required.runId} did not succeed`);
  evidence.requiredWorkflowRunsVerified += 1;
}

const wp07Pr = await readJson(prSnapshotPath);
invariant(wp07Pr.number === audit.wp07PullRequestNumber, 'WP07 PR number drifted');
invariant(wp07Pr.head?.sha === candidateSha, 'WP07 PR head does not match audited candidate');
if (!wp07Pr.merged_at) {
  blockers.push('WP07_NOT_MERGED_TO_MAIN');
} else if (!wp07Pr.merge_commit_sha) {
  blockers.push('WP07_MERGE_COMMIT_MISSING');
} else {
  try {
    git('fetch', '--quiet', 'origin', wp07Pr.merge_commit_sha);
    evidence.mainlineIdentityVerified =
      git('rev-parse', `${wp07Pr.merge_commit_sha}^{tree}`) === audit.auditedCandidateTreeSha;
    if (!evidence.mainlineIdentityVerified) blockers.push('WP07_MERGED_TREE_MISMATCH');
  } catch {
    blockers.push('WP07_MERGE_IDENTITY_UNVERIFIED');
  }
}

const browserRuntime = readCandidateText(candidateSha, 'scripts/product-loop-today-real-runtime.ts');
const browserJourney = readCandidateText(
  candidateSha,
  'tests/e2e/product-loop-today-real-runtime.spec.ts'
);
const dailySignalPostgres = readCandidateText(
  candidateSha,
  'services/lite/tests/daily-signal-postgres.test.ts'
);
const preferencePostgres = readCandidateText(
  candidateSha,
  'services/lite/tests/preference-feedback-postgres.test.ts'
);
const visualBridgePostgres = readCandidateText(
  candidateSha,
  'services/lite/tests/visual-bridge-postgres.test.ts'
);

const hasCoreOwner = browserRuntime.includes("owner: 'CORE'");
const hasKnowledgeReadyPackage = browserRuntime.includes("kind: 'KNOWLEDGE_READY_PACKAGE'");
evidence.sourceVocabularyCorrect = hasCoreOwner && hasKnowledgeReadyPackage;
invariant(evidence.sourceVocabularyCorrect, 'canonical browser source vocabulary drifted');

const usesTestLocalSourceAuthority = browserRuntime.includes(
  'const sourceAuthority: ProductLoopSourceAuthority'
);
const directlyInsertsDailySignal = browserRuntime.includes('INSERT INTO lite_daily_signals');
evidence.realKnowledgeSourceAcceptanceVerified =
  !usesTestLocalSourceAuthority && !directlyInsertsDailySignal;
if (!evidence.realKnowledgeSourceAcceptanceVerified) {
  blockers.push('REAL_KNOWLEDGE_SOURCE_ACCEPTANCE_MISSING');
}

evidence.exactProvenanceEvidence =
  dailySignalPostgres.includes('persists exact Core provenance') &&
  dailySignalPostgres.includes('expect(first.source).toEqual(source.source)');
evidence.restartRecoveryEvidence =
  dailySignalPostgres.includes('after store restart') &&
  preferencePostgres.includes('const restarted = store()');
evidence.staleSourceRejectionEvidence =
  dailySignalPostgres.includes('rejects changed immutable source evidence') &&
  dailySignalPostgres.includes('SOURCE_FINGERPRINT_MISMATCH');
evidence.workspaceIsolationEvidence =
  dailySignalPostgres.includes('isolates durable signals by Workspace') &&
  preferencePostgres.includes('otherWorkspaceId');
evidence.replaySafetyEvidence =
  dailySignalPostgres.includes('idempotencyKey') &&
  preferencePostgres.includes('expect(replay).toEqual(first)') &&
  preferencePostgres.includes('IDEMPOTENCY_CONFLICT');

evidence.boundedConcurrencyEvidence = [dailySignalPostgres, preferencePostgres, visualBridgePostgres].some(
  (text) => text.includes('Promise.all(') || text.includes('concurrent') || text.includes('race')
);
if (!evidence.boundedConcurrencyEvidence) {
  blockers.push('BOUNDED_CONCURRENCY_EVIDENCE_MISSING');
}

evidence.desktopAndMobileBrowserEvidence =
  browserJourney.includes('desktop') && browserJourney.includes('mobile');
evidence.canonicalRouteInterceptionAbsent =
  !browserJourney.includes('page.route(') && !browserJourney.includes('route.fulfill(');
evidence.productFeedbackCapabilitySeparationEvidence =
  preferencePostgres.includes('capabilityVerified).toBe(false)') &&
  preferencePostgres.includes('externalActionExecutedByMarkOrbit).toBe(false)') &&
  preferencePostgres.includes('externalOutcomeVerifiedByMarkOrbit).toBe(false)');

for (const [claim, verified] of Object.entries({
  EXACT_PROVENANCE_EVIDENCE_MISSING: evidence.exactProvenanceEvidence,
  WORKSPACE_ISOLATION_EVIDENCE_MISSING: evidence.workspaceIsolationEvidence,
  STALE_SOURCE_REJECTION_EVIDENCE_MISSING: evidence.staleSourceRejectionEvidence,
  REPLAY_SAFETY_EVIDENCE_MISSING: evidence.replaySafetyEvidence,
  RESTART_RECOVERY_EVIDENCE_MISSING: evidence.restartRecoveryEvidence,
  DESKTOP_MOBILE_BROWSER_EVIDENCE_MISSING: evidence.desktopAndMobileBrowserEvidence,
  CANONICAL_ROUTE_INTERCEPTION_PRESENT: evidence.canonicalRouteInterceptionAbsent,
  PRODUCT_FEEDBACK_CAPABILITY_SEPARATION_MISSING:
    evidence.productFeedbackCapabilitySeparationEvidence
})) {
  if (!verified) blockers.push(claim);
}

const uniqueBlockers = [...new Set(blockers)];
const finalRecommendation = uniqueBlockers.length === 0 ? 'GO' : 'FIX';
const result = {
  schemaVersion: 1,
  milestone: 'M9',
  workPackage: 'M9-WP-08',
  auditedCandidateSha: candidateSha,
  auditedCandidateTreeSha: audit.auditedCandidateTreeSha,
  wp07PullRequestNumber: audit.wp07PullRequestNumber,
  evidence,
  independentAuditComplete: true,
  finalRecommendation,
  blockers: uniqueBlockers,
  releaseEligibility: {
    eligibleForM9CompletionConsideration: finalRecommendation === 'GO',
    m9Complete: false,
    mergeAuthorizedByAudit: false,
    releaseAuthorized: false,
    productionTrafficAllowed: false,
    productionDeploymentPerformed: false,
    externalPublicationAuthorized: false,
    providerExecutionAuthorized: false,
    paidExecutionAuthorized: false,
    capabilityVerifiedByAudit: false,
    filingSubmitted: false,
    officialTruthCreated: false
  }
};

await mkdir(path.join(root, '.artifacts'), { recursive: true });
await writeFile(
  path.join(root, '.artifacts/m9-wp08-independent-daily-workspace-audit.json'),
  `${JSON.stringify(result, null, 2)}\n`,
  'utf8'
);

console.log(JSON.stringify(result));
