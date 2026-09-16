import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GuardError,
  evaluateConcurrentOverlap,
  fetchRemoteMain,
  inspectConcurrentWork,
  inspectIssueCoordination,
  readMigrationStateAt,
  resolveRemoteDefaultBranch,
  resolveRepositoryRoot,
  runGit
} from './task-freshness.mjs';

const MANIFEST_NAME = 'markorbit-task-bootstrap.json';

function gitResult(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });
}

function normalizedPath(path) {
  return resolve(path).replaceAll('\\', '/').toLowerCase();
}

export function parseWorktreePorcelain(output) {
  return output
    .trim()
    .split(/\r?\n\r?\n/)
    .filter(Boolean)
    .map((block) => {
      const entry = { path: null, head: null, branch: null, detached: false, prunable: false };
      for (const line of block.split(/\r?\n/)) {
        const separator = line.indexOf(' ');
        const key = separator === -1 ? line : line.slice(0, separator);
        const value = separator === -1 ? null : line.slice(separator + 1);
        if (key === 'worktree') entry.path = value;
        else if (key === 'HEAD') entry.head = value;
        else if (key === 'branch') entry.branch = value?.replace(/^refs\/heads\//, '') ?? null;
        else if (key === 'detached') entry.detached = true;
        else if (key === 'prunable') entry.prunable = true;
      }
      return entry;
    });
}

function readTaskManifest(worktreePath) {
  const manifestPath = runGit(worktreePath, ['rev-parse', '--git-path', MANIFEST_NAME]);
  if (!existsSync(manifestPath)) return { manifestPath, manifest: null, error: null };
  try {
    return { manifestPath, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')), error: null };
  } catch (error) {
    return { manifestPath, manifest: null, error: error.message };
  }
}

function manifestProblem(entry, manifestState) {
  if (manifestState.error) return 'BOOTSTRAP_MANIFEST_INVALID';
  const manifest = manifestState.manifest;
  if (!manifest) return 'BOOTSTRAP_MANIFEST_MISSING';
  if (
    manifest.version !== 1 ||
    typeof manifest.branch !== 'string' ||
    typeof manifest.worktreePath !== 'string' ||
    typeof manifest.baseSha !== 'string' ||
    !Array.isArray(manifest.expectedScope)
  ) {
    return 'BOOTSTRAP_MANIFEST_INVALID';
  }
  if (entry.branch !== manifest.branch) return 'WORKTREE_BRANCH_MISMATCH';
  if (normalizedPath(entry.path) !== normalizedPath(manifest.worktreePath)) {
    return 'WORKTREE_PATH_MISMATCH';
  }
  return null;
}

export function classifyWorktree({
  canonical,
  dirty,
  detached,
  prunable,
  manifestProblem: problem,
  merged,
  issueAudit,
  authorityAvailable = true,
  branchReferencedElsewhere = false
}) {
  if (canonical) return { classification: 'PROTECTED_CANONICAL', reason: 'CANONICAL_WORKTREE' };
  if (!authorityAvailable) return { classification: 'UNKNOWN', reason: 'AUTHORITY_UNAVAILABLE' };
  if (prunable) return { classification: 'UNKNOWN', reason: 'WORKTREE_PRUNABLE' };
  if (dirty) return { classification: 'DIRTY', reason: 'WORKTREE_NOT_CLEAN' };
  if (detached) return { classification: 'DETACHED', reason: 'DETACHED_PROVENANCE_AMBIGUOUS' };
  if (problem) return { classification: 'UNKNOWN', reason: problem };
  if (branchReferencedElsewhere) {
    return { classification: 'UNKNOWN', reason: 'BRANCH_ATTACHED_TO_MULTIPLE_WORKTREES' };
  }
  if (issueAudit?.status === 'UNKNOWN') {
    return { classification: 'UNKNOWN', reason: issueAudit.reason };
  }
  if (merged) return { classification: 'MERGED_CLEAN', reason: 'HEAD_REPRESENTED_IN_REMOTE_MAIN' };
  if (issueAudit?.reason === 'ISSUE_CLOSED') {
    return { classification: 'CLOSED_UNMERGED', reason: 'ISSUE_CLOSED' };
  }
  return { classification: 'ACTIVE', reason: issueAudit?.reason ?? 'TASK_NOT_MERGED' };
}

function divergence(repoRoot, left, right) {
  const output = runGit(repoRoot, ['rev-list', '--left-right', '--count', `${left}...${right}`]);
  const [ahead, behind] = output.split(/\s+/).map(Number);
  return { ahead, behind };
}

function isAncestor(repoRoot, ancestor, descendant) {
  const result = gitResult(repoRoot, ['merge-base', '--is-ancestor', ancestor, descendant]);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new GuardError('GIT_COMMAND_FAILED', {
    command: 'git merge-base --is-ancestor',
    detail: (result.stderr || result.error?.message || '').trim()
  });
}

function safeReason(error, fallback) {
  return error instanceof GuardError ? error.reason : fallback;
}

async function inspectIssue(dependencies, params, issueNumber) {
  if (!issueNumber) return null;
  try {
    return await dependencies.inspectIssueCoordination({ ...params, issueNumber });
  } catch (error) {
    return { status: 'UNKNOWN', reason: safeReason(error, 'ISSUE_METADATA_UNAVAILABLE') };
  }
}

export async function doctorRepository(options = {}, suppliedDependencies = {}) {
  const dependencies = {
    resolveRemoteDefaultBranch,
    fetchRemoteMain,
    inspectConcurrentWork,
    inspectIssueCoordination,
    readMigrationStateAt,
    ...suppliedDependencies
  };
  const repoRoot = resolveRepositoryRoot(options.cwd ?? process.cwd());
  const remote = options.remote ?? 'origin';
  const worktrees = parseWorktreePorcelain(runGit(repoRoot, ['worktree', 'list', '--porcelain']));
  const canonicalPath = worktrees[0]?.path ?? repoRoot;
  const report = {
    version: 1,
    status: 'PASS',
    repositoryRoot: repoRoot,
    remote,
    defaultBranch: null,
    remoteMain: null,
    canonical: null,
    migration: null,
    openPullRequests: [],
    worktrees: [],
    errors: []
  };

  let authorityAvailable = true;
  let concurrentWork = null;
  try {
    report.defaultBranch = await dependencies.resolveRemoteDefaultBranch(repoRoot, remote);
    report.remoteMain = await dependencies.fetchRemoteMain(repoRoot, remote, report.defaultBranch);
    report.migration = dependencies.readMigrationStateAt(repoRoot, report.remoteMain);
  } catch (error) {
    authorityAvailable = false;
    report.status = 'UNKNOWN';
    report.errors.push({ reason: safeReason(error, 'REMOTE_AUTHORITY_UNAVAILABLE') });
  }

  if (authorityAvailable) {
    try {
      concurrentWork = await dependencies.inspectConcurrentWork({
        repoRoot,
        remote,
        baseSha: report.remoteMain,
        defaultBranch: report.defaultBranch
      });
      report.openPullRequests = concurrentWork.pulls.map(
        ({ number, title, url, headRef, files }) => ({
          number,
          title,
          url,
          headRef,
          files
        })
      );
    } catch (error) {
      authorityAvailable = false;
      report.status = 'UNKNOWN';
      report.errors.push({ reason: safeReason(error, 'PR_METADATA_UNAVAILABLE') });
    }
  }

  const branchCounts = new Map();
  for (const entry of worktrees) {
    if (entry.branch) branchCounts.set(entry.branch, (branchCounts.get(entry.branch) ?? 0) + 1);
  }

  for (const entry of worktrees) {
    const canonical = normalizedPath(entry.path) === normalizedPath(canonicalPath);
    if (!existsSync(entry.path)) {
      report.worktrees.push({
        ...entry,
        canonical,
        dirty: null,
        manifest: null,
        issueAudit: null,
        conflicts: [],
        classification: canonical ? 'PROTECTED_CANONICAL' : 'UNKNOWN',
        reason: canonical ? 'CANONICAL_WORKTREE' : 'WORKTREE_PATH_MISSING'
      });
      continue;
    }

    const dirty = Boolean(runGit(entry.path, ['status', '--porcelain']));
    let manifestState = { manifestPath: null, manifest: null, error: null };
    if (!canonical && !entry.detached) manifestState = readTaskManifest(entry.path);
    const problem = canonical || entry.detached ? null : manifestProblem(entry, manifestState);
    const issueAudit =
      authorityAvailable && manifestState.manifest
        ? await inspectIssue(
            dependencies,
            { repoRoot, remote, baseSha: report.remoteMain },
            manifestState.manifest.issueNumber
          )
        : null;
    const merged = authorityAvailable ? isAncestor(repoRoot, entry.head, report.remoteMain) : null;
    const conflicts =
      authorityAvailable && manifestState.manifest && concurrentWork
        ? evaluateConcurrentOverlap(
            manifestState.manifest.expectedScope,
            concurrentWork.pulls,
            entry.branch,
            concurrentWork.repository
          )
        : [];
    const classification = classifyWorktree({
      canonical,
      dirty,
      detached: entry.detached,
      prunable: entry.prunable,
      manifestProblem: problem,
      merged,
      issueAudit,
      authorityAvailable,
      branchReferencedElsewhere: entry.branch && branchCounts.get(entry.branch) > 1
    });
    report.worktrees.push({
      ...entry,
      canonical,
      dirty,
      merged,
      manifest: manifestState.manifest
        ? {
            path: manifestState.manifestPath,
            baseSha: manifestState.manifest.baseSha,
            issueNumber: manifestState.manifest.issueNumber ?? null,
            expectedScope: manifestState.manifest.expectedScope
          }
        : null,
      issueAudit,
      conflicts,
      ...classification
    });
    if (issueAudit?.status === 'UNKNOWN') {
      report.status = 'UNKNOWN';
      if (!report.errors.some((entry) => entry.reason === issueAudit.reason)) {
        report.errors.push({ reason: issueAudit.reason });
      }
    }
  }

  const canonical = report.worktrees.find((entry) => entry.canonical);
  if (canonical && authorityAvailable) {
    report.canonical = {
      path: canonical.path,
      head: canonical.head,
      branch: canonical.branch,
      ...divergence(repoRoot, canonical.head, report.remoteMain)
    };
  } else if (canonical) {
    report.canonical = { path: canonical.path, head: canonical.head, branch: canonical.branch };
  }

  const canonicalUnhealthy =
    canonical?.dirty || (report.canonical && (report.canonical.ahead || report.canonical.behind));
  if (
    report.status === 'PASS' &&
    (canonicalUnhealthy ||
      report.worktrees.some((entry) =>
        ['DIRTY', 'DETACHED', 'UNKNOWN'].includes(entry.classification)
      ))
  ) {
    report.status = 'WARN';
  }
  return report;
}

async function main() {
  const options = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument === '--remote') options.remote = process.argv[++index];
    else if (argument === '--pretty') options.pretty = true;
    else throw new GuardError('INVALID_ARGUMENT', { argument });
  }
  const report = await doctorRepository(options);
  console.log(JSON.stringify(report, null, options.pretty ? 2 : 0));
  if (report.status === 'UNKNOWN') process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    const reason = safeReason(error, 'UNEXPECTED_ERROR');
    console.log(JSON.stringify({ version: 1, status: 'UNKNOWN', errors: [{ reason }] }));
    process.exitCode = 1;
  });
}
