import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GuardError,
  inspectPullRequestsForBranch,
  resolveRepositoryRoot,
  runGit
} from './task-freshness.mjs';
import { doctorRepository } from './task-lifecycle-doctor.mjs';

function normalizedPath(path) {
  return resolve(path).replaceAll('\\', '/').toLowerCase();
}

function block(reason, details = {}) {
  throw new GuardError(reason, details);
}

function assertCloseoutCandidate(target, report) {
  if (target.canonical || target.classification === 'PROTECTED_CANONICAL') {
    block('PROTECTED_CANONICAL');
  }
  if (!target.branch || target.detached) block('DETACHED_PROVENANCE_AMBIGUOUS');
  if (target.branch === report.defaultBranch) block('PROTECTED_BRANCH');
  if (!['MERGED_CLEAN', 'CLOSED_UNMERGED', 'ACTIVE'].includes(target.classification)) {
    block(target.reason ?? 'TASK_CLOSEOUT_BLOCKED', {
      classification: target.classification
    });
  }
}

function isAncestor(repoRoot, ancestor, descendant) {
  if (!ancestor) return false;
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  block('GIT_COMMAND_FAILED', { detail: (result.stderr || result.error?.message || '').trim() });
}

function localBranchHead(repoRoot, branch) {
  try {
    return runGit(repoRoot, ['rev-parse', '--verify', `refs/heads/${branch}`]);
  } catch (error) {
    if (error instanceof GuardError) block('LOCAL_BRANCH_UNAVAILABLE', { branch });
    throw error;
  }
}

function remoteBranchHead(repoRoot, remote, branch) {
  const output = runGit(repoRoot, ['ls-remote', '--heads', remote, `refs/heads/${branch}`], {
    reason: 'REMOTE_BRANCH_UNAVAILABLE'
  });
  if (!output) return null;
  const lines = output.split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) block('REMOTE_BRANCH_AMBIGUOUS', { branch });
  return lines[0].split(/\s+/)[0];
}

function planFingerprint(report, target, pull, remoteHead) {
  return [report.remoteMain, target.head, target.branch, pull.number, remoteHead ?? 'none'].join(
    ':'
  );
}

export async function planTaskCloseout(options = {}, suppliedDependencies = {}) {
  if (!options.worktree) block('TASK_WORKTREE_REQUIRED');
  const dependencies = {
    doctorRepository,
    inspectPullRequestsForBranch,
    ...suppliedDependencies
  };
  const repoRoot = resolveRepositoryRoot(options.cwd ?? process.cwd());
  const report =
    options.report ??
    (await dependencies.doctorRepository(
      { cwd: repoRoot, remote: options.remote },
      dependencies.doctorDependencies
    ));
  const requestedPath = normalizedPath(options.worktree);
  const target = report.worktrees.find((entry) => normalizedPath(entry.path) === requestedPath);
  if (!target) block('TASK_WORKTREE_NOT_FOUND', { worktree: resolve(options.worktree) });
  const globalAuthorityErrors = report.errors.filter(
    (entry) => entry.reason !== 'ISSUE_METADATA_UNAVAILABLE'
  );
  if (!report.remoteMain || !report.defaultBranch || globalAuthorityErrors.length) {
    block('DOCTOR_AUTHORITY_UNKNOWN', { errors: globalAuthorityErrors });
  }
  assertCloseoutCandidate(target, report);

  const branchHead = localBranchHead(repoRoot, target.branch);
  if (branchHead !== target.head) {
    block('BRANCH_HEAD_MISMATCH', { worktreeHead: target.head, branchHead });
  }
  let pullState;
  try {
    pullState = await dependencies.inspectPullRequestsForBranch({
      repoRoot,
      remote: report.remote,
      defaultBranch: report.defaultBranch,
      branch: target.branch
    });
  } catch (error) {
    block(error instanceof GuardError ? error.reason : 'PR_METADATA_UNAVAILABLE');
  }
  const mergedForBranch = pullState.pulls.filter((pull) => pull.mergedAt);
  const exactMerged = mergedForBranch.filter((pull) => pull.headSha === target.head);
  if (!exactMerged.length) {
    block(mergedForBranch.length ? 'BRANCH_HEAD_MISMATCH' : 'PR_NOT_MERGED', {
      branch: target.branch,
      expectedHead: target.head
    });
  }
  if (exactMerged.length !== 1) block('PR_METADATA_AMBIGUOUS', { branch: target.branch });
  const pull = exactMerged[0];
  if (!isAncestor(repoRoot, pull.mergeCommitSha, report.remoteMain)) {
    block('PR_MERGE_NOT_IN_REMOTE_MAIN', {
      mergeCommitSha: pull.mergeCommitSha,
      remoteMain: report.remoteMain
    });
  }

  const remoteHead = remoteBranchHead(repoRoot, report.remote, target.branch);
  if (remoteHead && remoteHead !== target.head) {
    block('BRANCH_HEAD_MISMATCH', {
      expectedHead: target.head,
      remoteHead
    });
  }
  return {
    version: 1,
    status: 'READY',
    mode: 'DRY_RUN',
    repositoryRoot: repoRoot,
    remote: report.remote,
    remoteMain: report.remoteMain,
    worktree: target.path,
    branch: target.branch,
    head: target.head,
    pullRequest: {
      number: pull.number,
      url: pull.url,
      mergedAt: pull.mergedAt,
      mergeCommitSha: pull.mergeCommitSha
    },
    remoteBranch: remoteHead ? { exists: true, head: remoteHead } : { exists: false, head: null },
    deleteRemote: Boolean(options.deleteRemote),
    fingerprint: planFingerprint(report, target, pull, remoteHead)
  };
}

export async function closeoutTask(options = {}, dependencies = {}) {
  const plan = await planTaskCloseout(options, dependencies);
  if (!options.apply) return plan;
  if (normalizedPath(plan.repositoryRoot) === normalizedPath(plan.worktree)) {
    block('CLOSEOUT_MUST_RUN_OUTSIDE_TARGET');
  }

  const revalidated = await planTaskCloseout(options, dependencies);
  if (revalidated.fingerprint !== plan.fingerprint) {
    block('CLOSEOUT_STATE_DRIFT', {
      planned: plan.fingerprint,
      current: revalidated.fingerprint
    });
  }

  if (options.deleteRemote && revalidated.remoteBranch.exists) {
    runGit(
      plan.repositoryRoot,
      [
        'push',
        `--force-with-lease=refs/heads/${plan.branch}:${plan.head}`,
        plan.remote,
        `:refs/heads/${plan.branch}`
      ],
      { reason: 'REMOTE_BRANCH_DELETE_FAILED' }
    );
  }
  runGit(plan.repositoryRoot, ['worktree', 'remove', plan.worktree], {
    reason: 'WORKTREE_REMOVE_FAILED'
  });
  runGit(plan.repositoryRoot, ['update-ref', '-d', `refs/heads/${plan.branch}`, plan.head], {
    reason: 'LOCAL_BRANCH_DELETE_FAILED'
  });
  return {
    ...revalidated,
    status: 'APPLIED',
    mode: 'APPLY',
    remoteBranchDeleted: Boolean(options.deleteRemote && revalidated.remoteBranch.exists)
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') options.apply = true;
    else if (argument === '--delete-remote') options.deleteRemote = true;
    else if (argument === '--remote') options.remote = argv[++index];
    else if (argument === '--worktree') options.worktree = argv[++index];
    else block('INVALID_ARGUMENT', { argument });
  }
  return options;
}

async function main() {
  try {
    const result = await closeoutTask(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result));
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
