import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { centralSurfacesForFiles } from './ci-detect-scope.mjs';

const MANIFEST_NAME = 'markorbit-task-bootstrap.json';
const VERSION = 1;

export class GuardError extends Error {
  constructor(reason, details = {}) {
    super(reason);
    this.name = 'GuardError';
    this.reason = reason;
    this.details = details;
  }
}

function normalizePath(value) {
  return value
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/\/\*\*$/, '');
}

function samePath(left, right) {
  const normalize = (value) => resolve(value).replaceAll('\\', '/').toLowerCase();
  return normalize(left) === normalize(right);
}

export function runGit(cwd, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe'
  });
  if (result.error || result.status !== 0) {
    const detail = (result.stderr || result.error?.message || '').trim();
    throw new GuardError(options.reason ?? 'GIT_COMMAND_FAILED', {
      command: `git ${args.join(' ')}`,
      detail
    });
  }
  return (result.stdout ?? '').trim();
}

function gitSucceeds(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).status === 0;
}

export function resolveRepositoryRoot(cwd) {
  return runGit(cwd, ['rev-parse', '--show-toplevel'], { reason: 'NOT_A_GIT_REPOSITORY' });
}

export function resolveRemoteDefaultBranch(repoRoot, remote) {
  const output = runGit(repoRoot, ['ls-remote', '--symref', remote, 'HEAD'], {
    reason: 'REMOTE_DEFAULT_BRANCH_UNAVAILABLE'
  });
  const match = output.match(/^ref:\s+refs\/heads\/([^\s]+)\s+HEAD$/m);
  if (!match) throw new GuardError('REMOTE_DEFAULT_BRANCH_UNAVAILABLE', { remote });
  return match[1];
}

export function fetchRemoteMain(repoRoot, remote, defaultBranch) {
  const trackingRef = `refs/remotes/${remote}/${defaultBranch}`;
  runGit(repoRoot, ['fetch', '--no-tags', remote, `+refs/heads/${defaultBranch}:${trackingRef}`], {
    reason: 'REMOTE_FETCH_FAILED'
  });
  return runGit(repoRoot, ['rev-parse', '--verify', trackingRef], {
    reason: 'REMOTE_MAIN_UNRESOLVED'
  });
}

function parseGitHubRepository(remoteUrl) {
  const match = remoteUrl.match(
    /(?:https?:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+)\/([^/]+?)(?:\.git)?$/
  );
  if (!match)
    throw new GuardError('PR_METADATA_UNAVAILABLE', { detail: 'Unsupported remote URL.' });
  return { owner: match[1], name: match[2], slug: `${match[1]}/${match[2]}` };
}

async function githubJson(url, unavailableReason = 'PR_METADATA_UNAVAILABLE') {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'markorbit-task-freshness',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    throw new GuardError(unavailableReason, { detail: error.message });
  }
  if (!response.ok) {
    throw new GuardError(unavailableReason, {
      detail: `GitHub API returned HTTP ${response.status}.`
    });
  }
  try {
    return await response.json();
  } catch (error) {
    throw new GuardError(unavailableReason, {
      detail: `Malformed GitHub payload: ${error.message}`
    });
  }
}

const COORDINATION_FENCE = /```markorbit-coordination\s*\r?\n([\s\S]*?)\r?\n```/g;
const COORDINATION_FIELDS = new Set([
  'version',
  'status',
  'base_sha',
  'migration_sensitive',
  'reserved_migration',
  'blocked_by'
]);

export function parseIssueCoordination(body) {
  const source = String(body ?? '');
  const blocks = [...source.matchAll(COORDINATION_FENCE)];
  if (!blocks.length) {
    if (source.includes('```markorbit-coordination')) {
      throw new GuardError('ISSUE_COORDINATION_MALFORMED', {
        detail: 'The markorbit-coordination fence is incomplete.'
      });
    }
    return null;
  }
  if (blocks.length !== 1) {
    throw new GuardError('ISSUE_COORDINATION_MALFORMED', {
      detail: 'Exactly one markorbit-coordination block is allowed.'
    });
  }

  let declaration;
  try {
    declaration = JSON.parse(blocks[0][1]);
  } catch (error) {
    throw new GuardError('ISSUE_COORDINATION_MALFORMED', { detail: error.message });
  }
  if (!declaration || Array.isArray(declaration) || typeof declaration !== 'object') {
    throw new GuardError('ISSUE_COORDINATION_MALFORMED', {
      detail: 'The coordination declaration must be a JSON object.'
    });
  }
  const unknownFields = Object.keys(declaration).filter((field) => !COORDINATION_FIELDS.has(field));
  const validStatus = declaration.status === 'ready' || declaration.status === 'blocked';
  const validBase =
    declaration.base_sha === null || /^[0-9a-f]{40}$/.test(declaration.base_sha ?? '');
  const validReservation =
    declaration.reserved_migration === 'none' ||
    /^\d{4}$/.test(declaration.reserved_migration ?? '');
  const validBlockers =
    Array.isArray(declaration.blocked_by) &&
    declaration.blocked_by.length <= 10 &&
    declaration.blocked_by.every(
      (blocker) =>
        blocker &&
        !Array.isArray(blocker) &&
        Object.keys(blocker).length === 2 &&
        (blocker.type === 'issue' || blocker.type === 'pr') &&
        Number.isSafeInteger(blocker.number) &&
        blocker.number > 0
    );
  if (
    unknownFields.length ||
    declaration.version !== 1 ||
    !validStatus ||
    !validBase ||
    typeof declaration.migration_sensitive !== 'boolean' ||
    !validReservation ||
    !validBlockers ||
    (!declaration.migration_sensitive && declaration.reserved_migration !== 'none')
  ) {
    throw new GuardError('ISSUE_COORDINATION_MALFORMED', {
      detail:
        unknownFields.length > 0
          ? `Unknown fields: ${unknownFields.join(', ')}`
          : 'Declaration does not match the version 1 coordination schema.'
    });
  }
  return declaration;
}

function issueAudit(status, reason, details = {}) {
  return { status, reason, ...details };
}

function assertIssuePayload(issue, issueNumber) {
  if (
    !issue ||
    issue.number !== issueNumber ||
    (issue.body !== null && typeof issue.body !== 'string') ||
    !['open', 'closed'].includes(issue.state) ||
    issue.pull_request
  ) {
    throw new GuardError('ISSUE_METADATA_UNAVAILABLE', {
      detail: `GitHub returned an invalid payload for issue #${issueNumber}.`
    });
  }
}

export async function evaluateIssueCoordination({
  issue,
  issueNumber,
  baseSha,
  repoRoot,
  loadBlocker
}) {
  assertIssuePayload(issue, issueNumber);
  if (issue.state === 'closed') return issueAudit('BLOCKED', 'ISSUE_CLOSED');

  const declaration = parseIssueCoordination(issue.body);
  if (!declaration) return issueAudit('WARN', 'ISSUE_COORDINATION_UNDECLARED');
  if (declaration.status === 'blocked') return issueAudit('BLOCKED', 'ISSUE_DECLARED_BLOCKED');
  if (declaration.base_sha && declaration.base_sha !== baseSha) {
    return issueAudit('BLOCKED', 'ISSUE_BASE_STALE', {
      declaredBaseSha: declaration.base_sha,
      currentBaseSha: baseSha
    });
  }

  const satisfiedBlockers = [];
  for (const blocker of declaration.blocked_by) {
    const metadata = await loadBlocker(blocker);
    const validState =
      metadata?.number === blocker.number && ['open', 'closed'].includes(metadata.state);
    const validKind = blocker.type === 'pr' ? metadata?.kind === 'pr' : metadata?.kind === 'issue';
    if (!validState || !validKind) {
      throw new GuardError('ISSUE_METADATA_UNAVAILABLE', {
        detail: `GitHub returned an invalid payload for ${blocker.type} #${blocker.number}.`
      });
    }
    if (metadata.state === 'open') {
      return issueAudit('BLOCKED', 'ISSUE_BLOCKER_OPEN', {
        blockerType: blocker.type,
        blockerNumber: blocker.number
      });
    }
    satisfiedBlockers.push(`${blocker.type}#${blocker.number}`);
  }

  if (declaration.migration_sensitive && declaration.reserved_migration !== 'none') {
    const migration = readMigrationStateAt(repoRoot, baseSha);
    if (Number(declaration.reserved_migration) <= Number(migration.tail)) {
      return issueAudit('BLOCKED', 'ISSUE_MIGRATION_STALE', {
        reservedMigration: declaration.reserved_migration,
        currentMigrationTail: migration.tail,
        currentNextSlot: migration.nextSlot
      });
    }
  }
  if (satisfiedBlockers.length) {
    return issueAudit('WARN', 'ISSUE_BLOCKER_STALE', { satisfiedBlockers });
  }
  return issueAudit('PASS', 'ISSUE_COORDINATION_CURRENT', {
    migrationSensitive: declaration.migration_sensitive,
    reservedMigration: declaration.reserved_migration
  });
}

export async function inspectIssueCoordination({ repoRoot, remote, baseSha, issueNumber }) {
  const remoteUrl = runGit(repoRoot, ['remote', 'get-url', remote]);
  let repository;
  try {
    repository = parseGitHubRepository(remoteUrl);
  } catch (error) {
    throw new GuardError('ISSUE_METADATA_UNAVAILABLE', { detail: error.details?.detail });
  }
  const apiRoot = `https://api.github.com/repos/${repository.owner}/${repository.name}`;
  const issue = await githubJson(`${apiRoot}/issues/${issueNumber}`, 'ISSUE_METADATA_UNAVAILABLE');
  return evaluateIssueCoordination({
    issue,
    issueNumber,
    baseSha,
    repoRoot,
    loadBlocker: async (blocker) => {
      if (blocker.type === 'pr') {
        const pull = await githubJson(
          `${apiRoot}/pulls/${blocker.number}`,
          'ISSUE_METADATA_UNAVAILABLE'
        );
        return {
          kind: 'pr',
          number: pull.number,
          state: pull.state,
          merged: pull.merged_at !== null
        };
      }
      const blockedIssue = await githubJson(
        `${apiRoot}/issues/${blocker.number}`,
        'ISSUE_METADATA_UNAVAILABLE'
      );
      return {
        kind: blockedIssue.pull_request ? 'pr' : 'issue',
        number: blockedIssue.number,
        state: blockedIssue.state
      };
    }
  });
}

export async function inspectConcurrentWork({ repoRoot, remote, baseSha, defaultBranch }) {
  const remoteUrl = runGit(repoRoot, ['remote', 'get-url', remote]);
  const repository = parseGitHubRepository(remoteUrl);
  const pulls = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await githubJson(
      `https://api.github.com/repos/${repository.owner}/${repository.name}/pulls?state=open&base=${encodeURIComponent(defaultBranch)}&per_page=100&page=${page}`
    );
    pulls.push(...batch);
    if (batch.length < 100) break;
    if (page === 10) {
      throw new GuardError('PR_METADATA_UNAVAILABLE', {
        detail: 'Open pull request inventory exceeds the bounded 1000-PR scan.'
      });
    }
  }
  const summaries = [];
  for (const pull of pulls) {
    runGit(
      repoRoot,
      [
        'fetch',
        '--no-tags',
        remote,
        `+refs/pull/${pull.number}/head:refs/task-bootstrap/pulls/${pull.number}`
      ],
      { reason: 'PR_METADATA_UNAVAILABLE' }
    );
    const headSha = runGit(repoRoot, [
      'rev-parse',
      '--verify',
      `refs/task-bootstrap/pulls/${pull.number}`
    ]);
    const files = runGit(repoRoot, ['diff', '--name-only', `${baseSha}...${headSha}`])
      .split(/\r?\n/)
      .filter(Boolean);
    summaries.push({
      number: pull.number,
      title: pull.title,
      url: pull.html_url,
      headRef: pull.head.ref,
      headRepository: pull.head.repo?.full_name ?? null,
      files
    });
  }
  return { repository: repository.slug, pulls: summaries };
}

function scopeMatchesFile(scope, file) {
  const expected = normalizePath(scope);
  const actual = normalizePath(file);
  return actual === expected || (scope.endsWith('/') && actual.startsWith(expected));
}

export function evaluateConcurrentOverlap(
  expectedScope,
  pulls,
  currentBranch = null,
  currentRepository = null
) {
  const taskSurfaces = new Set(centralSurfacesForFiles(expectedScope));
  const conflicts = [];
  for (const pull of pulls) {
    if (
      currentBranch &&
      currentRepository &&
      pull.headRef === currentBranch &&
      pull.headRepository === currentRepository
    ) {
      continue;
    }
    const exactFiles = pull.files.filter((file) =>
      expectedScope.some((scope) => scopeMatchesFile(scope, file))
    );
    const pullSurfaces = centralSurfacesForFiles(pull.files);
    const centralSurfaces = pullSurfaces.filter((surface) => taskSurfaces.has(surface));
    if (exactFiles.length || centralSurfaces.length) {
      conflicts.push({
        number: pull.number,
        title: pull.title,
        url: pull.url,
        exactFiles,
        centralSurfaces
      });
    }
  }
  return conflicts;
}

export function readMigrationStateAt(repoRoot, sha) {
  const migrationFiles = runGit(repoRoot, [
    'ls-tree',
    '-r',
    '--name-only',
    sha,
    '--',
    'infrastructure/persistence/migrations'
  ])
    .split(/\r?\n/)
    .filter((path) => /^infrastructure\/persistence\/migrations\/\d{4}_.+\.sql$/.test(path));
  if (!migrationFiles.length) throw new GuardError('MIGRATION_TAIL_UNAVAILABLE');

  let registry;
  try {
    registry = JSON.parse(
      runGit(repoRoot, ['show', `${sha}:infrastructure/persistence/migration-owners.json`])
    );
  } catch (error) {
    if (error instanceof GuardError) {
      throw new GuardError('MIGRATION_TAIL_UNAVAILABLE', { detail: error.details.detail });
    }
    throw error;
  }

  const entries = migrationFiles.map((path) => ({
    path,
    name: basename(path, '.sql'),
    number: Number.parseInt(basename(path).slice(0, 4), 10)
  }));
  const tail = entries.reduce((latest, entry) => (entry.number > latest.number ? entry : latest));
  if (!registry.migrations || !registry.migrations[tail.name]) {
    throw new GuardError('MIGRATION_TAIL_UNAVAILABLE', {
      detail: `Migration tail ${tail.name} is absent from migration-owners.json.`
    });
  }
  return {
    tail: String(tail.number).padStart(4, '0'),
    tailName: tail.name,
    nextSlot: String(tail.number + 1).padStart(4, '0')
  };
}

function manifestPath(repoRoot) {
  return runGit(repoRoot, ['rev-parse', '--git-path', MANIFEST_NAME]);
}

function writeManifest(worktreePath, manifest) {
  const path = manifestPath(worktreePath);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return path;
}

function readManifest(repoRoot) {
  const path = manifestPath(repoRoot);
  if (!existsSync(path)) throw new GuardError('BOOTSTRAP_MANIFEST_MISSING', { manifest: path });
  try {
    return { path, manifest: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (error) {
    throw new GuardError('BOOTSTRAP_MANIFEST_INVALID', { detail: error.message });
  }
}

export function verifyWorktreeBase(worktreePath, baseSha) {
  const head = runGit(worktreePath, ['rev-parse', 'HEAD']);
  if (head !== baseSha)
    throw new GuardError('WORKTREE_SHA_MISMATCH', { expected: baseSha, actual: head });
  return head;
}

function assertCleanWorktree(repoRoot) {
  const status = runGit(repoRoot, ['status', '--porcelain']);
  if (status) throw new GuardError('WORKTREE_NOT_CLEAN');
}

function validateManifestContext(repoRoot, manifest) {
  const branch = runGit(repoRoot, ['branch', '--show-current']);
  if (branch !== manifest.branch) {
    throw new GuardError('WORKTREE_BRANCH_MISMATCH', { expected: manifest.branch, actual: branch });
  }
  if (!samePath(repoRoot, manifest.worktreePath)) {
    throw new GuardError('WORKTREE_PATH_MISMATCH', {
      expected: manifest.worktreePath,
      actual: repoRoot
    });
  }
}

function changedFiles(repoRoot, range) {
  const output = runGit(repoRoot, ['diff', '--name-only', range]);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

export function evaluateDriftOverlap(mainChangedFiles, taskChangedFiles) {
  const sameFiles = taskChangedFiles.filter((file) => mainChangedFiles.includes(file));
  const mainSurfaces = new Set(centralSurfacesForFiles(mainChangedFiles));
  const centralSurfaces = centralSurfacesForFiles(taskChangedFiles).filter((surface) =>
    mainSurfaces.has(surface)
  );
  return { sameFiles, centralSurfaces };
}

async function concurrencyState(params, expectedScope, currentBranch, inspector) {
  const state = await inspector(params);
  const conflicts = evaluateConcurrentOverlap(
    expectedScope,
    state.pulls,
    currentBranch,
    state.repository
  );
  return { ...state, conflicts };
}

async function issueState(params, options, dependencies = {}) {
  if (!options.issue) return null;
  const inspector = dependencies.inspectIssueCoordination ?? inspectIssueCoordination;
  let audit;
  try {
    audit = await inspector({ ...params, issueNumber: options.issue });
  } catch (error) {
    if (
      error instanceof GuardError &&
      !options.strictIssue &&
      ['ISSUE_COORDINATION_MALFORMED', 'ISSUE_METADATA_UNAVAILABLE'].includes(error.reason)
    ) {
      return issueAudit('WARN', error.reason, error.details);
    }
    throw error;
  }
  if (options.strictIssue && audit.reason === 'ISSUE_COORDINATION_UNDECLARED') {
    throw new GuardError(audit.reason);
  }
  if (audit.status === 'BLOCKED') {
    const { status, reason, ...details } = audit;
    throw new GuardError(reason, details);
  }
  return audit;
}

export async function auditIssueTask(options, dependencies = {}) {
  const repoRoot = resolveRepositoryRoot(options.cwd ?? process.cwd());
  const remote = options.remote ?? 'origin';
  const defaultBranch = resolveRemoteDefaultBranch(repoRoot, remote);
  const baseSha = fetchRemoteMain(repoRoot, remote, defaultBranch);
  if (!options.issue) throw new GuardError('TASK_ISSUE_REQUIRED');
  const inspector = dependencies.inspectIssueCoordination ?? inspectIssueCoordination;
  const audit = await inspector({ repoRoot, remote, baseSha, issueNumber: options.issue });
  if (options.strictIssue && audit.reason === 'ISSUE_COORDINATION_UNDECLARED') {
    throw new GuardError(audit.reason);
  }
  return { audit, baseSha };
}

export async function bootstrapTask(options, dependencies = {}) {
  const repoRoot = resolveRepositoryRoot(options.cwd ?? process.cwd());
  const remote = options.remote ?? 'origin';
  const defaultBranch = resolveRemoteDefaultBranch(repoRoot, remote);
  const baseSha = fetchRemoteMain(repoRoot, remote, defaultBranch);
  const expectedScope = [...new Set((options.scope ?? []).map(normalizePath).filter(Boolean))];
  if (!expectedScope.length) throw new GuardError('TASK_SCOPE_REQUIRED');
  if (!options.branch) throw new GuardError('TASK_BRANCH_REQUIRED');
  if (!options.worktree) throw new GuardError('TASK_WORKTREE_REQUIRED');

  const issueAuditResult = await issueState({ repoRoot, remote, baseSha }, options, dependencies);

  const worktreePath = isAbsolute(options.worktree)
    ? resolve(options.worktree)
    : resolve(repoRoot, options.worktree);
  if (existsSync(worktreePath))
    throw new GuardError('WORKTREE_PATH_EXISTS', { worktree: worktreePath });
  if (gitSucceeds(repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${options.branch}`])) {
    throw new GuardError('TASK_BRANCH_EXISTS', { branch: options.branch });
  }

  const inspector = dependencies.inspectConcurrentWork ?? inspectConcurrentWork;
  const concurrency = await concurrencyState(
    { repoRoot, remote, baseSha, defaultBranch },
    expectedScope,
    options.branch,
    inspector
  );
  if (concurrency.conflicts.length) {
    throw new GuardError('OPEN_PR_CONFLICT', { conflicts: concurrency.conflicts });
  }

  const migrationSensitive =
    Boolean(options.migrationSensitive) ||
    expectedScope.some((path) => path.startsWith('infrastructure/persistence/migrations/'));
  const migration = migrationSensitive ? readMigrationStateAt(repoRoot, baseSha) : null;

  runGit(repoRoot, ['worktree', 'add', '-b', options.branch, worktreePath, baseSha], {
    reason: 'WORKTREE_CREATE_FAILED'
  });
  verifyWorktreeBase(worktreePath, baseSha);

  const manifest = {
    version: VERSION,
    repository: concurrency.repository,
    remote,
    defaultBranch,
    initialBaseSha: baseSha,
    baseSha,
    branch: options.branch,
    worktreePath,
    bootstrapTimestamp: new Date().toISOString(),
    migrationSensitive,
    migrationTail: migration?.tail ?? null,
    nextMigrationSlot: migration?.nextSlot ?? null,
    expectedScope,
    openPullRequestCount: concurrency.pulls.length,
    issueNumber: options.issue ?? null,
    issueAudit: issueAuditResult
  };
  writeManifest(worktreePath, manifest);
  return { manifest, openPullRequests: concurrency.pulls.length, issueAudit: issueAuditResult };
}

async function loadFreshState(options, dependencies = {}) {
  const repoRoot = resolveRepositoryRoot(options.cwd ?? process.cwd());
  const { path, manifest } = readManifest(repoRoot);
  validateManifestContext(repoRoot, manifest);
  assertCleanWorktree(repoRoot);
  const currentRemoteMainSha = fetchRemoteMain(repoRoot, manifest.remote, manifest.defaultBranch);
  const inspector = dependencies.inspectConcurrentWork ?? inspectConcurrentWork;
  const concurrency = await concurrencyState(
    {
      repoRoot,
      remote: manifest.remote,
      baseSha: currentRemoteMainSha,
      defaultBranch: manifest.defaultBranch
    },
    manifest.expectedScope,
    manifest.branch,
    inspector
  );
  if (concurrency.conflicts.length) {
    throw new GuardError('OPEN_PR_CONFLICT', { conflicts: concurrency.conflicts });
  }
  return { repoRoot, path, manifest, currentRemoteMainSha, concurrency };
}

export async function prepushTask(options = {}, dependencies = {}) {
  const state = await loadFreshState(options, dependencies);
  const { repoRoot, manifest, currentRemoteMainSha, concurrency } = state;
  const headSha = runGit(repoRoot, ['rev-parse', 'HEAD']);
  if (!gitSucceeds(repoRoot, ['merge-base', '--is-ancestor', manifest.baseSha, headSha])) {
    throw new GuardError('WORKTREE_BASE_MISMATCH', {
      expectedBaseSha: manifest.baseSha,
      headSha
    });
  }
  if (currentRemoteMainSha === manifest.baseSha) {
    return {
      status: 'PASS',
      manifest,
      currentRemoteMainSha,
      headSha,
      openPullRequests: concurrency.pulls.length
    };
  }

  const mainChangedFiles = changedFiles(repoRoot, `${manifest.baseSha}..${currentRemoteMainSha}`);
  const taskChangedFiles = changedFiles(repoRoot, `${manifest.baseSha}...${headSha}`);
  const overlap = evaluateDriftOverlap(mainChangedFiles, taskChangedFiles);
  const migration = manifest.migrationSensitive
    ? readMigrationStateAt(repoRoot, currentRemoteMainSha)
    : null;
  const details = {
    oldBaseSha: manifest.baseSha,
    currentRemoteMainSha,
    mainChangedFiles,
    taskChangedFiles,
    overlap
  };
  if (migration && migration.tail !== manifest.migrationTail) {
    throw new GuardError('MIGRATION_SLOT_STALE', {
      ...details,
      recordedTail: manifest.migrationTail,
      currentTail: migration.tail,
      currentNextSlot: migration.nextSlot
    });
  }
  throw new GuardError(
    overlap.sameFiles.length || overlap.centralSurfaces.length
      ? 'MAIN_DRIFT_OVERLAP'
      : 'MAIN_DRIFT_DETECTED',
    details
  );
}

export async function refreshTask(options = {}, dependencies = {}) {
  const state = await loadFreshState(options, dependencies);
  const { repoRoot, path, manifest, currentRemoteMainSha, concurrency } = state;
  const headSha = runGit(repoRoot, ['rev-parse', 'HEAD']);
  if (!gitSucceeds(repoRoot, ['merge-base', '--is-ancestor', currentRemoteMainSha, headSha])) {
    throw new GuardError('BRANCH_NOT_REFRESHED', {
      currentRemoteMainSha,
      headSha
    });
  }

  const taskChangedFiles = changedFiles(repoRoot, `${currentRemoteMainSha}...${headSha}`);
  const migration = manifest.migrationSensitive
    ? readMigrationStateAt(repoRoot, currentRemoteMainSha)
    : null;
  if (migration) {
    const taskMigrationSlots = taskChangedFiles
      .map((file) => file.match(/^infrastructure\/persistence\/migrations\/(\d{4})_.+\.sql$/)?.[1])
      .filter(Boolean);
    const staleSlot = taskMigrationSlots.find((slot) => Number(slot) <= Number(migration.tail));
    if (staleSlot) {
      throw new GuardError('MIGRATION_SLOT_STALE', {
        recordedTail: manifest.migrationTail,
        currentTail: migration.tail,
        staleSlot,
        currentNextSlot: migration.nextSlot
      });
    }
    if (
      taskMigrationSlots.length &&
      Math.min(...taskMigrationSlots.map(Number)) !== Number(migration.nextSlot)
    ) {
      throw new GuardError('MIGRATION_SLOT_INVALID', {
        currentTail: migration.tail,
        currentNextSlot: migration.nextSlot,
        taskMigrationSlots
      });
    }
  }

  const refreshed = {
    ...manifest,
    baseSha: currentRemoteMainSha,
    refreshedAt: new Date().toISOString(),
    migrationTail: migration?.tail ?? null,
    nextMigrationSlot: migration?.nextSlot ?? null,
    openPullRequestCount: concurrency.pulls.length
  };
  writeFileSync(path, `${JSON.stringify(refreshed, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return { status: 'PASS', manifest: refreshed, headSha, taskChangedFiles };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { scope: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--') continue;
    if (arg === '--migration-sensitive') options.migrationSensitive = true;
    else if (arg === '--strict-issue') options.strictIssue = true;
    else if (arg === '--remote') options.remote = rest[++index];
    else if (arg === '--issue') {
      options.issue = Number(rest[++index]);
      if (!Number.isSafeInteger(options.issue) || options.issue <= 0) {
        throw new GuardError('INVALID_ARGUMENT', { argument: '--issue' });
      }
    } else if (arg === '--branch') options.branch = rest[++index];
    else if (arg === '--worktree') options.worktree = rest[++index];
    else if (arg === '--scope') options.scope.push(rest[++index]);
    else throw new GuardError('INVALID_ARGUMENT', { argument: arg });
  }
  return { command, options };
}

function scalar(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return JSON.stringify(value);
  return value === null || value === undefined ? 'none' : String(value);
}

function emit(label, status, fields) {
  console.log(`${label} ${status}`);
  for (const [key, value] of Object.entries(fields)) console.log(`${key}: ${scalar(value)}`);
}

async function main() {
  let command = process.argv[2];
  try {
    const parsed = parseArgs(process.argv.slice(2));
    command = parsed.command;
    if (command === 'bootstrap') {
      const result = await bootstrapTask(parsed.options);
      emit('FRESH_MAIN_BOOTSTRAP', 'PASS', {
        repo: result.manifest.repository,
        remote_main: result.manifest.baseSha,
        branch: result.manifest.branch,
        worktree: result.manifest.worktreePath,
        open_prs: result.openPullRequests,
        migration_sensitive: result.manifest.migrationSensitive,
        migration_tail: result.manifest.migrationTail,
        next_migration_slot: result.manifest.nextMigrationSlot,
        issue: result.manifest.issueNumber,
        issue_audit_status: result.issueAudit?.status ?? 'NOT_REQUESTED',
        issue_audit_reason: result.issueAudit?.reason ?? 'none',
        base_fresh: true
      });
      return;
    }
    if (command === 'audit') {
      const result = await auditIssueTask(parsed.options);
      emit('ISSUE_AUDIT', result.audit.status, {
        issue: parsed.options.issue,
        reason: result.audit.reason,
        remote_main: result.baseSha,
        ...Object.fromEntries(
          Object.entries(result.audit).filter(([key]) => !['status', 'reason'].includes(key))
        )
      });
      return;
    }
    if (command === 'prepush') {
      const result = await prepushTask(parsed.options);
      emit('PRE_PUSH_FRESHNESS', 'PASS', {
        remote_main: result.currentRemoteMainSha,
        task_base: result.manifest.baseSha,
        head: result.headSha,
        open_prs: result.openPullRequests,
        base_fresh: true
      });
      return;
    }
    if (command === 'refresh') {
      const result = await refreshTask(parsed.options);
      emit('TASK_BASE_REFRESH', 'PASS', {
        remote_main: result.manifest.baseSha,
        head: result.headSha,
        migration_tail: result.manifest.migrationTail,
        next_migration_slot: result.manifest.nextMigrationSlot
      });
      return;
    }
    throw new GuardError('INVALID_COMMAND', { command: command ?? 'none' });
  } catch (error) {
    const guardError =
      error instanceof GuardError
        ? error
        : new GuardError('UNEXPECTED_ERROR', { detail: error.message });
    const label =
      command === 'bootstrap'
        ? 'FRESH_MAIN_BOOTSTRAP'
        : command === 'audit'
          ? 'ISSUE_AUDIT'
          : command === 'refresh'
            ? 'TASK_BASE_REFRESH'
            : 'PRE_PUSH_FRESHNESS';
    emit(label, 'BLOCKED', {
      reason: guardError.reason,
      ...guardError.details
    });
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
