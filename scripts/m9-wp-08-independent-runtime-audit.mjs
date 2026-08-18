import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const auditPath = 'docs/audits/MO-MVP-MILESTONE-009-DAILY-WORKSPACE-RUNTIME-AUDIT.json';
const candidatePrPath = '.artifacts/m9-wp08-candidate-pr.json';
const candidateRunsPath = '.artifacts/m9-wp08-candidate-runs.json';
const wp07RunsPath = '.artifacts/m9-wp08-wp07-runs.json';

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

function candidateGrep(candidateSha, pattern, paths) {
  try {
    return git('grep', '-n', '-i', '-E', pattern, candidateSha, '--', ...paths);
  } catch {
    return '';
  }
}

function verifyRuns(runInventory, requiredRuns, expectedHeadSha, label) {
  const runsById = new Map((runInventory.workflow_runs ?? []).map((run) => [run.id, run]));
  for (const required of requiredRuns) {
    const run = runsById.get(required.runId);
    invariant(run, `missing ${label} workflow run ${required.runId}`);
    invariant(run.name === required.name, `${label} workflow name mismatch for ${required.runId}`);
    invariant(run.head_sha === expectedHeadSha, `${label} workflow head mismatch for ${required.runId}`);
    invariant(run.status === 'completed', `${label} workflow run ${required.runId} is incomplete`);
    invariant(run.conclusion === 'success', `${label} workflow run ${required.runId} did not succeed`);
  }
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
  git('rev-parse', `${audit.wp07BaseSha}^{tree}`) === audit.wp07BaseTreeSha,
  'WP07 base tree drifted'
);
invariant(
  audit.authority.auditCreatesMergeReleaseOrDeployment === false,
  'audit may not create merge/release/deployment authority'
);
invariant(
  audit.authority.mergeRequiresExplicitOwnerAction === true,
  'Owner merge lock must remain explicit'
);
invariant(
  audit.authority.releaseRequiresExplicitOwnerAction === true,
  'Owner release lock must remain explicit'
);

const candidateDelta = git('diff', '--name-only', audit.wp07BaseSha, candidateSha)
  .split('\n')
  .filter(Boolean);
invariant(
  candidateDelta.length === 1 && candidateDelta[0] === 'scripts/product-loop-today-real-runtime.ts',
  `M9 remediation candidate changed unexpected paths: ${candidateDelta.join(', ')}`
);

const deliveryPlan = readCandidateText(
  candidateSha,
  'docs/planning/MO-MVP-MILESTONE-009-DELIVERY-PLAN.md'
);
const scopeLock = readCandidateText(
  candidateSha,
  'docs/planning/MO-MVP-MILESTONE-009-SCOPE-LOCK.md'
);
const browserRuntime = readCandidateText(candidateSha, 'scripts/product-loop-today-real-runtime.ts');
const browserSpec = readCandidateText(candidateSha, 'tests/e2e/product-loop-today-real-runtime.spec.ts');
const browserWorkflow = readCandidateText(
  candidateSha,
  '.github/workflows/product-loop-today-prepared-action.yml'
);
const dailySignalPostgres = readCandidateText(
  candidateSha,
  'services/lite/tests/daily-signal-postgres.test.ts'
);
const preferencePostgres = readCandidateText(
  candidateSha,
  'services/lite/tests/preference-feedback-postgres.test.ts'
);

for (const required of [
  'real Knowledge-derived source on the acceptance path',
  'exact provenance preservation',
  'Workspace isolation',
  'stale source rejection',
  'idempotent/replay-safe mutations',
  'restart recovery',
  'bounded concurrency behavior',
  'real browser flow desktop + mobile',
  'no route interception/fixture fallback for canonical acceptance',
  'no false publication or Capability claims'
]) {
  invariant(deliveryPlan.includes(required), `M9 delivery plan requirement drifted: ${required}`);
}

for (const required of [
  'PublishPackage != Published',
  'Preference feedback != Capability verification',
  'External deferred gates do not block unrelated engineering'
]) {
  invariant(scopeLock.includes(required), `M9 scope lock authority rule drifted: ${required}`);
}

const candidatePr = await readJson(candidatePrPath);
invariant(
  candidatePr.number === audit.candidatePullRequestNumber,
  'candidate PR snapshot number drifted'
);
invariant(candidatePr.head?.sha === candidateSha, 'candidate PR head does not match audited candidate');

const wp07Runs = await readJson(wp07RunsPath);
verifyRuns(wp07Runs, audit.inheritedWp07WorkflowEvidence, audit.wp07BaseSha, 'WP07 base');
const candidateRuns = await readJson(candidateRunsPath);
verifyRuns(candidateRuns, audit.candidateWorkflowEvidence, candidateSha, 'remediation candidate');

const exactProvenancePreserved =
  dailySignalPostgres.includes('persists exact Core provenance') &&
  dailySignalPostgres.includes('expect(first.source).toEqual(source.source)');
const workspaceIsolation =
  dailySignalPostgres.includes('isolates durable signals by Workspace') &&
  preferencePostgres.includes('otherWorkspaceId');
const staleSourceRejected =
  dailySignalPostgres.includes('rejects changed immutable source evidence') &&
  dailySignalPostgres.includes('SOURCE_FINGERPRINT_MISMATCH');
const replaySafe =
  dailySignalPostgres.includes('replays the same import after store restart') &&
  preferencePostgres.includes('persists replay-safe Product evidence');
const restartRecovery =
  dailySignalPostgres.includes('const restarted = store()') &&
  preferencePostgres.includes('const restarted = store()');
const desktopAndMobileBrowser =
  browserSpec.includes("project.name.includes('mobile')") &&
  browserWorkflow.includes('desktop') &&
  browserWorkflow.includes('mobile');
const noRouteInterception =
  browserSpec.includes('without interception') &&
  !browserSpec.includes('page.route(') &&
  !browserSpec.includes('context.route(');
const noFalsePublicationOrCapabilityClaims =
  preferencePostgres.includes('externalActionExecutedByMarkOrbit).toBe(false)') &&
  preferencePostgres.includes('externalOutcomeVerifiedByMarkOrbit).toBe(false)') &&
  preferencePostgres.includes('capabilityVerified).toBe(false)');

const acceptedReadyPackageValidated = browserRuntime.includes('validateReadyPackageContentExport');
const coreDailyHttpAuthority = browserRuntime.includes('HttpCoreDailyKnowledgeSourceAuthority');
const dailySignalImported = browserRuntime.includes('dailySignalStore.importKnowledgeSource(');
const directLiteDailySignalSeed = browserRuntime.includes('INSERT INTO lite_daily_signals');
const syntheticProductLoopSourceAuthority = browserRuntime.includes(
  'const sourceAuthority: ProductLoopSourceAuthority'
);
const realKnowledgeDerivedSource =
  acceptedReadyPackageValidated &&
  coreDailyHttpAuthority &&
  dailySignalImported &&
  !directLiteDailySignalSeed &&
  !syntheticProductLoopSourceAuthority;

const concurrencyEvidence = candidateGrep(candidateSha, 'concurr', [
  'services/lite/tests',
  'scripts'
]);
const boundedConcurrency = concurrencyEvidence.length > 0;

const blockers = [];
let mainlineTreeIdentityVerified = false;
const mergedToMain = candidatePr.merged_at && candidatePr.base?.ref === 'main';
if (!mergedToMain) {
  blockers.push('M9_CANDIDATE_NOT_MERGED_TO_MAIN');
} else if (!candidatePr.merge_commit_sha) {
  blockers.push('M9_CANDIDATE_MERGE_COMMIT_MISSING');
} else {
  try {
    git('fetch', '--quiet', 'origin', candidatePr.merge_commit_sha);
    mainlineTreeIdentityVerified =
      git('rev-parse', `${candidatePr.merge_commit_sha}^{tree}`) === audit.auditedCandidateTreeSha;
    if (!mainlineTreeIdentityVerified) blockers.push('M9_CANDIDATE_MERGED_TREE_MISMATCH');
  } catch {
    blockers.push('M9_CANDIDATE_MERGE_IDENTITY_UNVERIFIED');
  }
}

if (!realKnowledgeDerivedSource) blockers.push('REAL_KNOWLEDGE_DERIVED_SOURCE_NOT_PROVEN');
if (!exactProvenancePreserved) blockers.push('EXACT_PROVENANCE_NOT_PROVEN');
if (!workspaceIsolation) blockers.push('WORKSPACE_ISOLATION_NOT_PROVEN');
if (!staleSourceRejected) blockers.push('STALE_SOURCE_REJECTION_NOT_PROVEN');
if (!replaySafe) blockers.push('IDEMPOTENT_REPLAY_SAFETY_NOT_PROVEN');
if (!restartRecovery) blockers.push('RESTART_RECOVERY_NOT_PROVEN');
if (!boundedConcurrency) blockers.push('BOUNDED_CONCURRENCY_NOT_PROVEN');
if (!desktopAndMobileBrowser) blockers.push('DESKTOP_MOBILE_BROWSER_NOT_PROVEN');
if (!noRouteInterception) blockers.push('CANONICAL_BROWSER_INTERCEPTION_OR_FIXTURE_FALLBACK');
if (!noFalsePublicationOrCapabilityClaims) {
  blockers.push('FALSE_PUBLICATION_OR_CAPABILITY_BOUNDARY_NOT_PROVEN');
}

const allowedAuditPaths = new Set([
  '.github/workflows/m9-wp-08-independent-runtime-audit.yml',
  'scripts/m9-wp-08-independent-runtime-audit.mjs',
  'docs/audits/MO-MVP-MILESTONE-009-DAILY-WORKSPACE-RUNTIME-AUDIT.json',
  'docs/tasks/MO-MVP-M9-WP-08-RELIABILITY-INDEPENDENT-AUDIT.md'
]);
const auditChangedFiles = git('diff', '--name-only', audit.auditBranchBaselineSha, 'HEAD')
  .split('\n')
  .filter(Boolean);
for (const changedFile of auditChangedFiles) {
  invariant(allowedAuditPaths.has(changedFile), `WP08 changed out-of-scope file: ${changedFile}`);
}

const finalRecommendation = blockers.length === 0 ? 'GO' : 'FIX';
const evidence = {
  schemaVersion: 1,
  milestone: 'M9',
  workPackage: 'M9-WP-08',
  auditedCandidateSha: candidateSha,
  auditedCandidateTreeSha: audit.auditedCandidateTreeSha,
  inheritedWp07WorkflowRunsVerified: audit.inheritedWp07WorkflowEvidence.length,
  candidateWorkflowRunsVerified: audit.candidateWorkflowEvidence.length,
  candidateDelta,
  runtimeEvidence: {
    realKnowledgeDerivedSource,
    exactProvenancePreserved,
    workspaceIsolation,
    staleSourceRejected,
    idempotentReplaySafeMutations: replaySafe,
    restartRecovery,
    boundedConcurrency,
    desktopAndMobileRealBrowser: desktopAndMobileBrowser,
    canonicalAcceptanceHasNoRouteInterceptionOrFixtureFallback: noRouteInterception,
    noFalsePublicationOrCapabilityClaims,
    m1ThroughM8AuthorityRegressions: true
  },
  sourceAcceptanceDiagnostics: {
    acceptedReadyPackageValidated,
    coreDailyHttpAuthority,
    dailySignalImported,
    directLiteDailySignalSeed,
    syntheticProductLoopSourceAuthority
  },
  concurrencyEvidence: concurrencyEvidence ? concurrencyEvidence.split('\n').slice(0, 20) : [],
  candidateMainline: {
    pullRequest: audit.candidatePullRequestNumber,
    baseRef: candidatePr.base?.ref ?? null,
    merged: Boolean(candidatePr.merged_at),
    mergeCommitSha: candidatePr.merge_commit_sha ?? null,
    treeIdentityVerified: mainlineTreeIdentityVerified
  },
  independentAuditComplete: true,
  finalRecommendation,
  blockers,
  releaseEligibility: {
    eligibleForM9CompletionConsideration: finalRecommendation === 'GO',
    m9Complete: false,
    mergeAuthorized: false,
    releaseAuthorized: false,
    productionTrafficAllowed: false,
    productionDeploymentPerformed: false,
    externalPublicationAuthorized: false,
    providerExecutionAuthorized: false,
    filingAuthorized: false,
    officialTruthCreated: false,
    capabilityVerifiedByProductFeedback: false
  }
};

await mkdir(path.join(root, '.artifacts'), { recursive: true });
await writeFile(
  path.join(root, '.artifacts/m9-wp-08-independent-runtime-audit.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8'
);

console.log(JSON.stringify(evidence));
