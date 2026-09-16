import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  GuardError,
  bootstrapTask,
  evaluateConcurrentOverlap,
  fetchRemoteMain,
  prepushTask,
  verifyWorktreeBase
} from './task-freshness.mjs';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function write(repo, path, content) {
  const target = join(repo, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function commit(repo, message) {
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

function configure(repo) {
  git(repo, ['config', 'user.name', 'MarkOrbit Guard Test']);
  git(repo, ['config', 'user.email', 'guard-test@markorbit.example']);
  git(repo, ['config', 'core.autocrlf', 'false']);
}

function createFixture(t, { migrations = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'markorbit-task-freshness-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = join(root, 'remote.git');
  const seed = join(root, 'seed');
  const clone = join(root, 'clone');
  git(root, ['init', '--bare', '--initial-branch=main', remote]);
  git(root, ['init', '--initial-branch=main', seed]);
  configure(seed);
  write(seed, 'README.md', 'base\n');
  if (migrations) {
    write(seed, 'infrastructure/persistence/migrations/0124_current.sql', 'SELECT 124;\n');
    write(
      seed,
      'infrastructure/persistence/migration-owners.json',
      `${JSON.stringify({ migrations: { '0124_current': '@markorbit/test' } }, null, 2)}\n`
    );
  }
  const initialSha = commit(seed, 'initial');
  git(seed, ['remote', 'add', 'origin', remote]);
  git(seed, ['push', '-u', 'origin', 'main']);
  git(root, ['clone', remote, clone]);
  configure(clone);

  const advance = (
    path = 'docs/main.txt',
    content = `${Date.now()}\n`,
    message = 'advance main'
  ) => {
    write(seed, path, content);
    const sha = commit(seed, message);
    git(seed, ['push', 'origin', 'main']);
    return sha;
  };

  const inspectConcurrentWork = async () => ({ repository: 'fixture/markorbit', pulls: [] });
  return { root, remote, seed, clone, initialSha, advance, inspectConcurrentWork };
}

function bootstrapOptions(fixture, suffix, extra = {}) {
  return {
    cwd: fixture.clone,
    branch: `test/${suffix}`,
    worktree: join(fixture.root, `worktree-${suffix}`),
    scope: ['services/lite/src/task.ts'],
    ...extra
  };
}

async function assertGuardReason(action, reason) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof GuardError);
    assert.equal(error.reason, reason);
    return true;
  });
}

test('fresh bootstrap creates an exact remote-main worktree and manifest', async (t) => {
  const fixture = createFixture(t);
  const options = bootstrapOptions(fixture, 'happy');
  const result = await bootstrapTask(options, {
    inspectConcurrentWork: fixture.inspectConcurrentWork
  });
  assert.equal(result.manifest.baseSha, fixture.initialSha);
  assert.equal(git(options.worktree, ['rev-parse', 'HEAD']), fixture.initialSha);
  assert.equal(result.manifest.openPullRequestCount, 0);
  const prepush = await prepushTask(
    { cwd: options.worktree },
    { inspectConcurrentWork: fixture.inspectConcurrentWork }
  );
  assert.equal(prepush.status, 'PASS');
});

test('stale local main never becomes the task base', async (t) => {
  const fixture = createFixture(t);
  const remoteMain = fixture.advance();
  assert.equal(git(fixture.clone, ['rev-parse', 'main']), fixture.initialSha);
  assert.equal(git(fixture.clone, ['rev-parse', 'origin/main']), fixture.initialSha);

  const options = bootstrapOptions(fixture, 'stale-local');
  const result = await bootstrapTask(options, {
    inspectConcurrentWork: fixture.inspectConcurrentWork
  });
  assert.equal(result.manifest.baseSha, remoteMain);
  assert.equal(git(options.worktree, ['rev-parse', 'HEAD']), remoteMain);
});

test('failed fetch cannot silently reuse a stale remote-tracking ref', (t) => {
  const fixture = createFixture(t);
  const cached = git(fixture.clone, ['rev-parse', 'origin/main']);
  git(fixture.clone, ['remote', 'set-url', 'origin', join(fixture.root, 'missing.git')]);

  assert.throws(
    () => fetchRemoteMain(fixture.clone, 'origin', 'main'),
    (error) => error instanceof GuardError && error.reason === 'REMOTE_FETCH_FAILED'
  );
  assert.equal(git(fixture.clone, ['rev-parse', 'origin/main']), cached);
});

test('main movement after bootstrap is blocked with changed-file evidence', async (t) => {
  const fixture = createFixture(t);
  const options = bootstrapOptions(fixture, 'main-drift');
  await bootstrapTask(options, { inspectConcurrentWork: fixture.inspectConcurrentWork });
  write(options.worktree, 'services/lite/src/task.ts', 'export const task = true;\n');
  commit(options.worktree, 'task change');
  fixture.advance('docs/main.txt', 'remote change\n');

  await assertGuardReason(
    () =>
      prepushTask(
        { cwd: options.worktree },
        { inspectConcurrentWork: fixture.inspectConcurrentWork }
      ),
    'MAIN_DRIFT_DETECTED'
  );
});

test('migration tail movement invalidates the recorded slot', async (t) => {
  const fixture = createFixture(t, { migrations: true });
  const options = bootstrapOptions(fixture, 'migration-drift', {
    migrationSensitive: true,
    scope: ['infrastructure/persistence/migrations/0125_task.sql']
  });
  const result = await bootstrapTask(options, {
    inspectConcurrentWork: fixture.inspectConcurrentWork
  });
  assert.equal(result.manifest.migrationTail, '0124');
  assert.equal(result.manifest.nextMigrationSlot, '0125');

  write(fixture.seed, 'infrastructure/persistence/migrations/0125_other.sql', 'SELECT 125;\n');
  write(
    fixture.seed,
    'infrastructure/persistence/migration-owners.json',
    `${JSON.stringify(
      {
        migrations: {
          '0124_current': '@markorbit/test',
          '0125_other': '@markorbit/other'
        }
      },
      null,
      2
    )}\n`
  );
  commit(fixture.seed, 'advance migration tail');
  git(fixture.seed, ['push', 'origin', 'main']);

  await assertGuardReason(
    () =>
      prepushTask(
        { cwd: options.worktree },
        { inspectConcurrentWork: fixture.inspectConcurrentWork }
      ),
    'MIGRATION_SLOT_STALE'
  );
});

test('worktree SHA mismatch fails closed', async (t) => {
  const fixture = createFixture(t);
  const remoteMain = fixture.advance();
  const options = bootstrapOptions(fixture, 'sha-mismatch');
  await bootstrapTask(options, { inspectConcurrentWork: fixture.inspectConcurrentWork });
  git(options.worktree, ['reset', '--hard', `${remoteMain}^`]);
  assert.throws(
    () => verifyWorktreeBase(options.worktree, remoteMain),
    (error) => error instanceof GuardError && error.reason === 'WORKTREE_SHA_MISMATCH'
  );
  await assertGuardReason(
    () =>
      prepushTask(
        { cwd: options.worktree },
        { inspectConcurrentWork: fixture.inspectConcurrentWork }
      ),
    'WORKTREE_BASE_MISMATCH'
  );
});

test('declared central overlap with an open PR blocks bootstrap', async (t) => {
  const fixture = createFixture(t);
  const options = bootstrapOptions(fixture, 'pr-conflict', { scope: ['package.json'] });
  const inspectConcurrentWork = async () => ({
    repository: 'fixture/markorbit',
    pulls: [
      {
        number: 42,
        title: 'Change workspace topology',
        url: 'https://example.test/pull/42',
        headRef: 'other/task',
        files: ['pnpm-workspace.yaml']
      }
    ]
  });
  await assertGuardReason(
    () => bootstrapTask(options, { inspectConcurrentWork }),
    'OPEN_PR_CONFLICT'
  );
});

test('non-conflicting ordinary work is not over-blocked', () => {
  const conflicts = evaluateConcurrentOverlap(
    ['services/lite/src/task.ts'],
    [
      {
        number: 7,
        title: 'Unrelated site copy',
        url: 'https://example.test/pull/7',
        headRef: 'site/copy',
        files: ['services/site/docs/copy.md']
      }
    ]
  );
  assert.deepEqual(conflicts, []);
});
