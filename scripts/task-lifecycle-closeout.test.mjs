import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GuardError } from './task-freshness.mjs';
import { closeoutTask, planTaskCloseout } from './task-lifecycle-closeout.mjs';
import { doctorRepository } from './task-lifecycle-doctor.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function createMergedTaskFixture() {
  const root = mkdtempSync(join(tmpdir(), 'markorbit-closeout-'));
  const remote = join(root, 'remote.git');
  const canonical = join(root, 'canonical');
  const task = join(root, 'task');
  git(root, 'init', '--bare', remote);
  git(root, 'clone', remote, canonical);
  git(canonical, 'config', 'user.email', 'closeout@example.com');
  git(canonical, 'config', 'user.name', 'Task Closeout');
  writeFileSync(join(canonical, 'README.md'), 'fixture\n');
  git(canonical, 'add', '.');
  git(canonical, 'commit', '-m', 'fixture');
  git(canonical, 'branch', '-M', 'main');
  git(canonical, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const baseSha = git(canonical, 'rev-parse', 'HEAD');
  git(canonical, 'worktree', 'add', '-b', 'task/merged', task, baseSha);
  writeFileSync(join(task, 'TASK.md'), 'task\n');
  git(task, 'add', '.');
  git(task, 'commit', '-m', 'task');
  const taskHead = git(task, 'rev-parse', 'HEAD');
  git(task, 'push', '-u', 'origin', 'task/merged');
  const manifestPath = git(task, 'rev-parse', '--git-path', 'markorbit-task-bootstrap.json');
  writeFileSync(
    manifestPath,
    `${JSON.stringify({
      version: 1,
      branch: 'task/merged',
      worktreePath: task,
      baseSha,
      expectedScope: ['scripts/'],
      issueNumber: 1294
    })}\n`
  );
  git(canonical, 'merge', '--squash', 'task/merged');
  git(canonical, 'commit', '-m', 'squash merge task');
  const mergeCommitSha = git(canonical, 'rev-parse', 'HEAD');
  git(canonical, 'push', 'origin', 'main');
  return { root, remote, canonical, task, baseSha, taskHead, mergeCommitSha };
}

function dependencies(fixture, overrides = {}) {
  return {
    doctorDependencies: {
      inspectConcurrentWork: async () => ({ repository: 'fixture/repo', pulls: [] }),
      inspectIssueCoordination: async () => ({ status: 'BLOCKED', reason: 'ISSUE_CLOSED' }),
      readMigrationStateAt: () => ({ tail: '0001', tailName: '0001_fixture', nextSlot: '0002' })
    },
    inspectPullRequestsForBranch: async () => ({
      repository: 'fixture/repo',
      pulls: [
        {
          number: 1,
          state: 'closed',
          mergedAt: '2026-09-16T00:00:00Z',
          mergeCommitSha: fixture.mergeCommitSha,
          headSha: fixture.taskHead,
          headRef: 'task/merged',
          baseRef: 'main',
          url: 'https://example.test/pull/1'
        }
      ]
    }),
    ...overrides
  };
}

test('default dry-run proves a merged clean task without mutating it', async () => {
  const fixture = createMergedTaskFixture();
  const plan = await closeoutTask(
    { cwd: fixture.canonical, worktree: fixture.task },
    dependencies(fixture)
  );
  assert.equal(plan.status, 'READY');
  assert.equal(plan.mode, 'DRY_RUN');
  assert.equal(plan.head, fixture.taskHead);
  assert.equal(existsSync(fixture.task), true);
  assert.equal(git(fixture.canonical, 'rev-parse', 'refs/heads/task/merged'), fixture.taskHead);
  assert.equal(
    git(fixture.canonical, 'ls-remote', '--heads', 'origin', 'task/merged').length > 0,
    true
  );
});

test('apply removes only the exact worktree and local branch', async () => {
  const fixture = createMergedTaskFixture();
  const result = await closeoutTask(
    { cwd: fixture.canonical, worktree: fixture.task, apply: true },
    dependencies(fixture)
  );
  assert.equal(result.status, 'APPLIED');
  assert.equal(existsSync(fixture.task), false);
  assert.equal(
    spawnSync('git', ['rev-parse', '--verify', 'refs/heads/task/merged'], {
      cwd: fixture.canonical
    }).status,
    128
  );
  assert.equal(
    git(fixture.canonical, 'ls-remote', '--heads', 'origin', 'task/merged').length > 0,
    true
  );
});

test('remote branch deletion requires explicit opt-in', async () => {
  const fixture = createMergedTaskFixture();
  const result = await closeoutTask(
    { cwd: fixture.canonical, worktree: fixture.task, apply: true, deleteRemote: true },
    dependencies(fixture)
  );
  assert.equal(result.remoteBranchDeleted, true);
  assert.equal(git(fixture.canonical, 'ls-remote', '--heads', 'origin', 'task/merged'), '');
});

test('dirty, canonical and unknown targets fail closed', async (t) => {
  await t.test('dirty', async () => {
    const fixture = createMergedTaskFixture();
    writeFileSync(join(fixture.task, 'DIRTY.md'), 'dirty\n');
    await assert.rejects(
      planTaskCloseout({ cwd: fixture.canonical, worktree: fixture.task }, dependencies(fixture)),
      (error) => error instanceof GuardError && error.reason === 'WORKTREE_NOT_CLEAN'
    );
  });

  await t.test('canonical', async () => {
    const fixture = createMergedTaskFixture();
    await assert.rejects(
      planTaskCloseout(
        { cwd: fixture.canonical, worktree: fixture.canonical },
        dependencies(fixture)
      ),
      (error) => error instanceof GuardError && error.reason === 'PROTECTED_CANONICAL'
    );
  });

  await t.test('unknown', async () => {
    const fixture = createMergedTaskFixture();
    const unknown = join(fixture.root, 'unknown');
    git(fixture.canonical, 'worktree', 'add', '-b', 'task/unknown', unknown, fixture.baseSha);
    await assert.rejects(
      planTaskCloseout({ cwd: fixture.canonical, worktree: unknown }, dependencies(fixture)),
      (error) => error instanceof GuardError && error.reason === 'BOOTSTRAP_MANIFEST_MISSING'
    );
  });
});

test('merged PR head mismatch blocks closeout', async () => {
  const fixture = createMergedTaskFixture();
  const deps = dependencies(fixture);
  deps.inspectPullRequestsForBranch = async () => ({
    repository: 'fixture/repo',
    pulls: [
      {
        number: 1,
        mergedAt: '2026-09-16T00:00:00Z',
        mergeCommitSha: fixture.mergeCommitSha,
        headSha: fixture.baseSha
      }
    ]
  });
  await assert.rejects(
    planTaskCloseout({ cwd: fixture.canonical, worktree: fixture.task }, deps),
    (error) => error instanceof GuardError && error.reason === 'BRANCH_HEAD_MISMATCH'
  );
});

test('unrelated issue API failure does not hide an authoritative target', async () => {
  const fixture = createMergedTaskFixture();
  const deps = dependencies(fixture);
  deps.doctorRepository = async (...args) => {
    const report = await doctorRepository(...args);
    return {
      ...report,
      status: 'UNKNOWN',
      errors: [...report.errors, { reason: 'ISSUE_METADATA_UNAVAILABLE' }]
    };
  };
  const plan = await planTaskCloseout({ cwd: fixture.canonical, worktree: fixture.task }, deps);
  assert.equal(plan.status, 'READY');
});

test('apply revalidates and blocks mutation-time drift', async () => {
  const fixture = createMergedTaskFixture();
  const deps = dependencies(fixture);
  let calls = 0;
  deps.doctorRepository = async (...args) => {
    calls += 1;
    if (calls === 2) writeFileSync(join(fixture.task, 'LATE-DIRTY.md'), 'drift\n');
    return doctorRepository(...args);
  };
  await assert.rejects(
    closeoutTask({ cwd: fixture.canonical, worktree: fixture.task, apply: true }, deps),
    (error) => error instanceof GuardError && error.reason === 'WORKTREE_NOT_CLEAN'
  );
  assert.equal(existsSync(fixture.task), true);
  assert.equal(git(fixture.canonical, 'rev-parse', 'refs/heads/task/merged'), fixture.taskHead);
});
