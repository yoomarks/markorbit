import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GuardError, resolveRepositoryRoot, runGit } from './task-freshness.mjs';
import { closeoutTask, planTaskCloseout } from './task-lifecycle-closeout.mjs';
import { doctorRepository } from './task-lifecycle-doctor.mjs';

function normalizedPath(path) {
  return resolve(path).replaceAll('\\', '/').toLowerCase();
}

function block(reason, details = {}) {
  throw new GuardError(reason, details);
}

function parseRefs(output) {
  const refs = new Map();
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [name, head] = line.split('\0');
    if (name && head) refs.set(name, head);
  }
  return refs;
}

function localBranches(repoRoot) {
  return parseRefs(
    runGit(repoRoot, ['for-each-ref', '--format=%(refname:short)%00%(objectname)', 'refs/heads'])
  );
}

function remoteBranches(repoRoot, remote) {
  const output = runGit(repoRoot, ['ls-remote', '--heads', remote], {
    reason: 'REMOTE_BRANCH_INVENTORY_UNAVAILABLE'
  });
  const refs = new Map();
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [head, ref] = line.split(/\s+/);
    if (head && ref?.startsWith('refs/heads/')) refs.set(ref.slice('refs/heads/'.length), head);
  }
  return refs;
}

export function classifyHygieneWorktree(entry, closeout = null) {
  if (entry.canonical || entry.classification === 'PROTECTED_CANONICAL') {
    return { category: 'PROTECTED_CANONICAL', reason: 'CANONICAL_WORKTREE' };
  }
  if (entry.dirty || entry.classification === 'DIRTY') {
    return { category: 'DIRTY', reason: 'WORKTREE_NOT_CLEAN' };
  }
  if (entry.detached || entry.classification === 'DETACHED') {
    return { category: 'DETACHED_UNKNOWN', reason: 'DETACHED_PROVENANCE_AMBIGUOUS' };
  }
  if (entry.reason === 'BRANCH_ATTACHED_TO_MULTIPLE_WORKTREES' && entry.merged) {
    return { category: 'MERGED_BUT_REFERENCED', reason: entry.reason };
  }
  if (closeout?.status === 'READY') {
    return { category: 'SAFE_CLOSEOUT_CANDIDATE', reason: 'CLOSEOUT_PROOF_CURRENT' };
  }
  if (entry.classification === 'ACTIVE' || closeout?.reason === 'PR_NOT_MERGED') {
    return { category: 'ACTIVE', reason: closeout?.reason ?? entry.reason };
  }
  return {
    category: 'NEEDS_MANUAL_REVIEW',
    reason: closeout?.reason ?? entry.reason ?? 'UNCLASSIFIED_LIFECYCLE_STATE'
  };
}

function itemId(kind, value) {
  return `${kind}:${value.replaceAll('\\', '/')}`;
}

async function closeoutEvidence(options, dependencies, report, entry) {
  if (
    entry.canonical ||
    entry.dirty ||
    entry.detached ||
    !entry.branch ||
    !entry.manifest ||
    entry.reason === 'BRANCH_ATTACHED_TO_MULTIPLE_WORKTREES'
  ) {
    return null;
  }
  try {
    return await dependencies.planTaskCloseout(
      {
        cwd: report.repositoryRoot,
        remote: report.remote,
        worktree: entry.path,
        report,
        deleteRemote: options.deleteRemote
      },
      dependencies.closeoutDependencies
    );
  } catch (error) {
    return {
      status: 'BLOCKED',
      reason: error instanceof GuardError ? error.reason : 'CLOSEOUT_PROOF_UNAVAILABLE'
    };
  }
}

export async function planRepositoryHygiene(options = {}, suppliedDependencies = {}) {
  const dependencies = {
    doctorRepository,
    planTaskCloseout,
    ...suppliedDependencies
  };
  const repoRoot = resolveRepositoryRoot(options.cwd ?? process.cwd());
  const report = await dependencies.doctorRepository(
    { cwd: repoRoot, remote: options.remote },
    dependencies.doctorDependencies
  );
  if (!report.remoteMain || !report.defaultBranch) {
    block('DOCTOR_AUTHORITY_UNKNOWN', { errors: report.errors });
  }
  const globalError = report.errors.find((entry) => entry.reason !== 'ISSUE_METADATA_UNAVAILABLE');
  if (globalError) block('DOCTOR_AUTHORITY_UNKNOWN', { errors: report.errors });

  const local = localBranches(repoRoot);
  const remote = remoteBranches(repoRoot, report.remote);
  const attachedBranches = new Set(report.worktrees.map((entry) => entry.branch).filter(Boolean));
  const items = [];

  for (const entry of report.worktrees) {
    const closeout = await closeoutEvidence(options, dependencies, report, entry);
    const classification = classifyHygieneWorktree(entry, closeout);
    items.push({
      id: itemId('worktree', entry.path),
      kind: 'worktree',
      path: entry.path,
      branch: entry.branch,
      head: entry.head,
      localBranch: entry.branch ? local.has(entry.branch) : false,
      remoteBranch: entry.branch ? remote.has(entry.branch) : false,
      ...classification,
      closeout: closeout?.status === 'READY' ? closeout : null
    });
  }

  const allBranches = new Set([...local.keys(), ...remote.keys()]);
  for (const branch of allBranches) {
    if (attachedBranches.has(branch)) continue;
    const localHead = local.get(branch) ?? null;
    const remoteHead = remote.get(branch) ?? null;
    let category = 'NEEDS_MANUAL_REVIEW';
    let reason = 'UNATTACHED_BRANCH_REQUIRES_REVIEW';
    if (localHead && !remoteHead) {
      category = 'LOCAL_ONLY';
      reason = 'BRANCH_EXISTS_ONLY_LOCALLY';
    } else if (!localHead && remoteHead) {
      category = 'REMOTE_ONLY';
      reason = 'BRANCH_EXISTS_ONLY_REMOTELY';
    }
    items.push({
      id: itemId('branch', branch),
      kind: 'branch',
      branch,
      localHead,
      remoteHead,
      category,
      reason
    });
  }

  items.sort((left, right) => left.id.localeCompare(right.id));
  const counts = {};
  for (const item of items) counts[item.category] = (counts[item.category] ?? 0) + 1;
  return {
    version: 1,
    status: 'READY',
    mode: 'DRY_RUN',
    repositoryRoot: repoRoot,
    remote: report.remote,
    remoteMain: report.remoteMain,
    deleteRemote: Boolean(options.deleteRemote),
    counts,
    items
  };
}

export async function runRepositoryHygiene(options = {}, suppliedDependencies = {}) {
  const dependencies = { closeoutTask, ...suppliedDependencies };
  const plan = await planRepositoryHygiene(options, suppliedDependencies);
  if (!options.apply) return plan;
  const selected = [...new Set(options.select ?? [])];
  if (!selected.length) block('HYGIENE_SELECTION_REQUIRED');

  const results = [];
  for (const id of selected) {
    const item = plan.items.find((candidate) => candidate.id === id);
    if (!item) {
      results.push({ id, status: 'BLOCKED', reason: 'HYGIENE_ITEM_NOT_FOUND' });
      continue;
    }
    if (item.category !== 'SAFE_CLOSEOUT_CANDIDATE') {
      results.push({ id, status: 'BLOCKED', reason: 'HYGIENE_ITEM_NOT_SAFE' });
      continue;
    }
    try {
      const result = await dependencies.closeoutTask(
        {
          cwd: plan.repositoryRoot,
          remote: plan.remote,
          worktree: item.path,
          apply: true,
          deleteRemote: options.deleteRemote
        },
        dependencies.closeoutDependencies
      );
      results.push({ id, status: result.status, remoteBranchDeleted: result.remoteBranchDeleted });
    } catch (error) {
      results.push({
        id,
        status: 'BLOCKED',
        reason: error instanceof GuardError ? error.reason : 'CLOSEOUT_REVALIDATION_FAILED'
      });
    }
  }
  const applied = results.filter((result) => result.status === 'APPLIED').length;
  return {
    ...plan,
    status: applied === results.length ? 'APPLIED' : applied ? 'PARTIAL' : 'BLOCKED',
    mode: 'APPLY',
    selected: results
  };
}

function parseArgs(argv) {
  const options = { select: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') options.apply = true;
    else if (argument === '--delete-remote') options.deleteRemote = true;
    else if (argument === '--remote') options.remote = argv[++index];
    else if (argument === '--select') options.select.push(argv[++index]);
    else block('INVALID_ARGUMENT', { argument });
  }
  return options;
}

async function main() {
  try {
    console.log(JSON.stringify(await runRepositoryHygiene(parseArgs(process.argv.slice(2)))));
  } catch (error) {
    const guardError =
      error instanceof GuardError
        ? error
        : new GuardError('UNEXPECTED_ERROR', { detail: error.message });
    console.log(
      JSON.stringify({
        version: 1,
        status: 'BLOCKED',
        reason: guardError.reason,
        ...guardError.details
      })
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
