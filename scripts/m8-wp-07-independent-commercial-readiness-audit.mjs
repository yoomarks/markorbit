import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const auditPath = 'docs/audits/MO-MVP-MILESTONE-008-COMMERCIAL-READINESS-AUDIT.json';
const wp06EvidencePath = '.artifacts/wp06/m8-wp-06-commercial-runtime-reliability.json';
const wp06PrPath = '.artifacts/m8-wp-07-wp06-pr.json';
const candidateRunsPath = '.artifacts/m8-wp-07-candidate-runs.json';
const stripeRunsPath = '.artifacts/m8-wp-07-stripe-runs.json';
const stripeEvidencePath = '.artifacts/stripe/stripe-sandbox-acceptance.json';

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

function readCandidateJson(candidateSha, relativePath) {
  return JSON.parse(readCandidateText(candidateSha, relativePath));
}

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

const audit = await readJson(auditPath);
const candidateSha = process.env.M8_WP07_AUDITED_CANDIDATE_SHA ?? audit.auditedCandidateSha;

invariant(audit.schemaVersion === 1, 'unsupported M8-WP-07 audit schema');
invariant(audit.milestone === 'M8', 'audit milestone must be M8');
invariant(audit.workPackage === 'M8-WP-07', 'audit work package must be M8-WP-07');
invariant(candidateSha === audit.auditedCandidateSha, 'audited candidate SHA drifted');
invariant(
  audit.authority.mergeRequiresExplicitOwnerAction === true,
  'Owner merge lock must remain explicit'
);
invariant(
  audit.authority.releaseRequiresExplicitOwnerAction === true,
  'Owner release lock must remain explicit'
);
invariant(
  audit.authority.auditCreatesMergeReleaseOrDeployment === false,
  'audit may not create merge/release authority'
);
invariant(
  audit.recommendationPolicy.failClosedOnUnpinnedPostCandidateChanges === true,
  'post-candidate change policy must remain fail-closed'
);

const candidate = readCandidateJson(
  candidateSha,
  'infrastructure/rehearsal/m8-wp-06-commercial-runtime.json'
);
const knownLimits = readCandidateJson(
  candidateSha,
  'infrastructure/rehearsal/m8-wp-06-known-limits.json'
);
const scopeLock = readCandidateText(
  candidateSha,
  'docs/tasks/MO-MVP-TASK-033A-MILESTONE-008-SCOPE-LOCK.md'
);
const wp06Task = readCandidateText(
  candidateSha,
  'docs/tasks/MO-MVP-M8-WP-06-COMMERCIAL-RUNTIME-RELIABILITY.md'
);
const agents = readCandidateText(candidateSha, 'AGENTS.md');

invariant(candidate.workPackage === 'M8-WP-06', 'candidate is not M8-WP-06');
invariant(
  candidate.candidateClass === 'MVP_COMMERCIAL_RUNTIME_CANDIDATE',
  'candidate class drifted'
);
invariant(
  candidate.environmentClass === 'NON_PRODUCTION_REHEARSAL',
  'candidate environment drifted'
);
invariant(candidate.exactHeadRequired === true, 'candidate must remain exact-head qualified');
invariant(
  candidate.productionTrafficAllowed === false,
  'candidate must not allow production traffic'
);
invariant(candidate.releaseAuthorized === false, 'candidate must not authorize release');
invariant(candidate.m8Complete === false, 'WP06 candidate may not declare M8 complete');
invariant(candidate.auditRequired === true, 'WP06 candidate must require independent audit');
invariant(candidate.independentAuditComplete === false, 'WP06 candidate may not self-audit');
invariant(candidate.secretsExcluded === true, 'candidate manifest must exclude secrets');

const requiredScopeFragments = [
  'Account Type != Workspace Role',
  'Order != Payment',
  'Payment succeeded != Filing submitted',
  'Payment succeeded != Matter completed',
  'Provider != Professional appointment',
  'Professional Review != Official Truth',
  'Knowledge evidence != Official structured truth'
];
for (const fragment of requiredScopeFragments) {
  invariant(
    scopeLock.includes(fragment),
    `M8 scope lock missing authority distinction: ${fragment}`
  );
}
invariant(
  wp06Task.includes('Commercial Admin != owner database'),
  'WP06 commercial-admin owner lock missing'
);
invariant(
  wp06Task.includes('Green deterministic CI != real Stripe provider acceptance'),
  'WP06 Stripe evidence lock missing'
);
invariant(
  agents.includes('No direct cross-service database reads.'),
  'repository cross-service SQL lock missing'
);

const limitIds = new Set(knownLimits.limits.map((limit) => limit.id));
for (const id of audit.knownLimitIds) {
  invariant(limitIds.has(id), `missing audited WP06 known limit: ${id}`);
}
invariant(
  knownLimits.limits.length === audit.knownLimitIds.length,
  'WP06 known-limit count drifted'
);

const wp06Evidence = await readJson(wp06EvidencePath);
invariant(wp06Evidence.workPackage === 'M8-WP-06', 'downloaded artifact is not WP06 evidence');
invariant(wp06Evidence.exactHeadSha === candidateSha, 'WP06 artifact candidate SHA drifted');
invariant(wp06Evidence.deterministicResult === 'PASS', 'WP06 deterministic matrix did not PASS');
invariant(
  wp06Evidence.candidateConfigFingerprint === audit.candidateConfigFingerprint,
  'WP06 candidate/config fingerprint does not match audit contract'
);
invariant(
  wp06Evidence.stripeRealProviderAcceptance.requiredForM8Completion === true,
  'WP06 artifact no longer requires real Stripe acceptance'
);
invariant(
  wp06Evidence.stripeRealProviderAcceptance.executedByThisGate === false,
  'WP06 deterministic evidence must not masquerade as Stripe provider evidence'
);
invariant(
  wp06Evidence.stripeRealProviderAcceptance.status === 'SEPARATE_EXTERNAL_CREDENTIAL_GATE_REQUIRED',
  'WP06 Stripe external-gate status drifted'
);
for (const field of [
  'independentAuditComplete',
  'm8Complete',
  'releaseAuthorized',
  'productionTrafficAllowed',
  'productionDeploymentPerformed',
  'releaseTagPublished',
  'businessAuthorityCreated',
  'filingSubmitted',
  'officialTruthCreated',
  'commercialAdminBecameOwnerDatabase'
]) {
  invariant(
    wp06Evidence.authority[field] === false,
    `WP06 authority field must remain false: ${field}`
  );
}

const candidateRuns = await readJson(candidateRunsPath);
const runs = candidateRuns.workflow_runs ?? [];
const runsById = new Map(runs.map((run) => [run.id, run]));
for (const required of audit.requiredWorkflowEvidence) {
  const run = runsById.get(required.runId);
  invariant(run, `missing required WP06 workflow run ${required.runId}: ${required.name}`);
  invariant(run.name === required.name, `workflow name mismatch for run ${required.runId}`);
  invariant(run.event === required.event, `workflow event mismatch for run ${required.runId}`);
  invariant(run.head_sha === candidateSha, `workflow head mismatch for run ${required.runId}`);
  invariant(run.status === 'completed', `workflow run ${required.runId} is incomplete`);
  invariant(run.conclusion === 'success', `workflow run ${required.runId} did not succeed`);
}

const changedFiles = git('diff', '--name-only', candidateSha, 'HEAD').split('\n').filter(Boolean);
const allowedAuditPaths = new Set([
  '.github/workflows/m8-wp-07-independent-commercial-readiness-audit.yml',
  'scripts/m8-wp-07-independent-commercial-readiness-audit.mjs',
  'docs/audits/MO-MVP-MILESTONE-008-COMMERCIAL-READINESS-AUDIT.json',
  'docs/audits/MO-MVP-MILESTONE-008-COMMERCIAL-READINESS-AUDIT.md',
  'docs/tasks/MO-MVP-M8-WP-07-INDEPENDENT-COMMERCIAL-READINESS-AUDIT.md'
]);
const postCandidateMaintenance = audit.postCandidateMaintenance ?? [];
const allowedChangedPaths = new Set([
  ...allowedAuditPaths,
  ...postCandidateMaintenance.map((entry) => entry.path)
]);
const verifiedMaintenance = [];
for (const maintenance of postCandidateMaintenance) {
  invariant(
    typeof maintenance.commitSha === 'string' && /^[0-9a-f]{40}$/u.test(maintenance.commitSha),
    'post-candidate maintenance commit must be a full SHA'
  );
  invariant(
    typeof maintenance.path === 'string' && maintenance.path.length > 0,
    'post-candidate maintenance path is required'
  );
  invariant(
    typeof maintenance.blobSha === 'string' && /^[0-9a-f]{40}$/u.test(maintenance.blobSha),
    'post-candidate maintenance blob must be a full SHA'
  );
  invariant(
    typeof maintenance.reason === 'string' && maintenance.reason.length > 0,
    'post-candidate maintenance reason is required'
  );
  try {
    git('merge-base', '--is-ancestor', maintenance.commitSha, 'HEAD');
  } catch {
    invariant(
      false,
      `pinned maintenance commit is not in the audited HEAD: ${maintenance.commitSha}`
    );
  }
  const commitFiles = git('diff-tree', '--no-commit-id', '--name-only', '-r', maintenance.commitSha)
    .split('\n')
    .filter(Boolean);
  invariant(
    commitFiles.length === 1 && commitFiles[0] === maintenance.path,
    `pinned maintenance commit changed unexpected paths: ${maintenance.commitSha}`
  );
  invariant(
    git('rev-parse', `${maintenance.commitSha}:${maintenance.path}`) === maintenance.blobSha,
    `pinned maintenance commit blob drifted: ${maintenance.path}`
  );
  invariant(
    git('rev-parse', `HEAD:${maintenance.path}`) === maintenance.blobSha,
    `pinned maintenance path changed after approved repair: ${maintenance.path}`
  );
  verifiedMaintenance.push({
    commitSha: maintenance.commitSha,
    path: maintenance.path,
    blobSha: maintenance.blobSha
  });
}
for (const changedFile of changedFiles) {
  invariant(allowedChangedPaths.has(changedFile), `WP07 changed out-of-scope file: ${changedFile}`);
}

const blockers = [];
const wp06Pr = await readJson(wp06PrPath);
invariant(wp06Pr.number === audit.wp06PullRequestNumber, 'WP06 PR snapshot number drifted');
invariant(wp06Pr.head?.sha === candidateSha, 'WP06 PR head does not match audited candidate');

let mainlineIdentityVerified = false;
if (!wp06Pr.merged_at) {
  blockers.push('WP06_NOT_MERGED_TO_MAIN');
} else if (!wp06Pr.merge_commit_sha) {
  blockers.push('WP06_MERGE_COMMIT_MISSING');
} else {
  try {
    git('fetch', '--quiet', 'origin', wp06Pr.merge_commit_sha);
    const candidateTree = git('rev-parse', `${candidateSha}^{tree}`);
    const mergedTree = git('rev-parse', `${wp06Pr.merge_commit_sha}^{tree}`);
    if (candidateTree === mergedTree) mainlineIdentityVerified = true;
    else blockers.push('WP06_MERGED_TREE_MISMATCH');
  } catch {
    blockers.push('WP06_MERGE_IDENTITY_UNVERIFIED');
  }
}

const stripeRuns = await readJson(stripeRunsPath);
const successfulStripeRuns = (stripeRuns.workflow_runs ?? [])
  .filter(
    (run) =>
      run.name === audit.stripeAcceptance.workflowName &&
      run.event === audit.stripeAcceptance.requiredEvent &&
      run.head_branch === audit.stripeAcceptance.requiredHeadBranch &&
      run.status === 'completed' &&
      run.conclusion === 'success'
  )
  .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
const stripeRun = successfulStripeRuns[0] ?? null;

let stripeEvidenceVerified = false;
let stripeEvidence = null;
if (!stripeRun) {
  blockers.push('STRIPE_REAL_PROVIDER_ACCEPTANCE_MISSING');
} else if (!(await exists(stripeEvidencePath))) {
  blockers.push('STRIPE_ACCEPTANCE_ARTIFACT_MISSING');
} else {
  try {
    stripeEvidence = await readJson(stripeEvidencePath);
    const stripe = audit.stripeAcceptance;
    const valid =
      stripeEvidence.schemaVersion === 1 &&
      stripeEvidence.provider === stripe.requiredProvider &&
      stripeEvidence.providerMode === stripe.requiredProviderMode &&
      stripeEvidence.paymentStatus === stripe.requiredPaymentStatus &&
      stripeEvidence.refundStatus === stripe.requiredRefundStatus &&
      stripeEvidence.currency === stripe.requiredCurrency &&
      stripeEvidence.amountMinor === stripe.requiredAmountMinor &&
      typeof stripeEvidence.paymentIntentId === 'string' &&
      stripeEvidence.paymentIntentId.startsWith('pi_') &&
      typeof stripeEvidence.refundId === 'string' &&
      stripeEvidence.refundId.startsWith('re_') &&
      typeof stripeEvidence.paymentEventId === 'string' &&
      typeof stripeEvidence.refundEventId === 'string';
    if (valid) stripeEvidenceVerified = true;
    else blockers.push('STRIPE_ACCEPTANCE_EVIDENCE_INVALID');
  } catch {
    blockers.push('STRIPE_ACCEPTANCE_EVIDENCE_UNREADABLE');
  }
}

const finalRecommendation = blockers.length === 0 ? 'GO' : 'FIX';
const evidence = {
  schemaVersion: 1,
  milestone: 'M8',
  workPackage: 'M8-WP-07',
  auditedCandidateSha: candidateSha,
  auditedCandidateTreeSha: git('rev-parse', `${candidateSha}^{tree}`),
  candidateConfigFingerprint: audit.candidateConfigFingerprint,
  deterministicWp06Evidence: 'PASS',
  requiredWorkflowRunsVerified: audit.requiredWorkflowEvidence.length,
  knownLimitsVerified: audit.knownLimitIds.length,
  postCandidateMaintenance: {
    required: postCandidateMaintenance.length,
    verified: verifiedMaintenance.length,
    entries: verifiedMaintenance
  },
  wp06Mainline: {
    pullRequest: audit.wp06PullRequestNumber,
    merged: Boolean(wp06Pr.merged_at),
    mergeCommitSha: wp06Pr.merge_commit_sha ?? null,
    treeIdentityVerified: mainlineIdentityVerified
  },
  stripeRealProviderAcceptance: {
    required: true,
    successfulRunId: stripeRun?.id ?? null,
    successfulRunHeadBranch: stripeRun?.head_branch ?? null,
    artifactEvidenceVerified: stripeEvidenceVerified,
    provider: stripeEvidence?.provider ?? null,
    providerMode: stripeEvidence?.providerMode ?? null
  },
  independentAuditComplete: true,
  finalRecommendation,
  blockers,
  releaseEligibility: {
    eligibleForM8CompletionConsideration: finalRecommendation === 'GO',
    m8Complete: false,
    mergeAuthorized: false,
    releaseAuthorized: false,
    productionTrafficAllowed: false,
    productionDeploymentPerformed: false,
    releaseTagPublished: false,
    businessAuthorityCreated: false,
    filingSubmitted: false,
    officialTruthCreated: false
  }
};

await mkdir(path.join(root, '.artifacts'), { recursive: true });
await writeFile(
  path.join(root, '.artifacts/m8-wp-07-independent-commercial-readiness-audit.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8'
);

console.log(JSON.stringify(evidence));
