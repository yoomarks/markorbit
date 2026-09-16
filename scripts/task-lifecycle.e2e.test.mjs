import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GuardError, bootstrapTask, prepushTask, refreshTask } from './task-freshness.mjs';
import { closeoutTask } from './task-lifecycle-closeout.mjs';
import { doctorRepository } from './task-lifecycle-doctor.mjs';
import { planRepositoryHygiene } from './task-lifecycle-hygiene.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function configureGit(cwd) {
  git(cwd, 'config', 'user.email', 'lifecycle@example.com');
  git(cwd, 'config', 'user.name', 'Lifecycle Regression');
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'markorbit-lifecycle-'));
  const remote = join(root, 'remote.git');
  const canonical = join(root, 'canonical');
  git(root, 'init', '--bare', remote);
  git(root, 'clone', remote, canonical);
  configureGit(canonical);
  mkdirSync(join(canonical, 'infrastructure', 'persistence', 'migrations'), { recursive: true });
  writeFileSync(join(canonical, 'README.md'), 'fixture\n');
  writeFileSync(
    join(canonical, 'infrastructure', 'persistence', 'migrations', '0001_fixture.sql'),
    'select 1;\n'
  );
  writeFileSync(
    join(canonical, 'infrastructure', 'persistence', 'migration-owners.json'),
    `${JSON.stringify({ migrations: { '0001_fixture': { owner: 'core' } } })}\n`
  );
  git(canonical, 'add', '.');
  git(canonical, 'commit', '-m', 'fixture');
  git(canonical, 'branch', '-M', 'main');
  git(canonical, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  return { root, remote, canonical };
}

const concurrentWork = async () => ({ repository: 'fixture/repo', pulls: [] });
const openIssue = async () => ({ status: 'PASS', reason: 'ISSUE_COORDINATION_CURRENT' });
const closedIssue = async () => ({ status: 'BLOCKED', reason: 'ISSUE_CLOSED' });

test('governed task lifecycle remains deterministic from bootstrap through hygiene', async () => {
  const fixture = createFixture();
  const task = join(fixture.root, 'task');
  const dirty = join(fixture.root, 'dirty');
  const unknown = join(fixture.root, 'unknown');

  const bootstrap = await bootstrapTask(
    {
      cwd: fixture.canonical,
      branch: 'task/lifecycle',
      worktree: task,
      scope: ['TASK.md'],
      issue: 1296
    },
    { inspectConcurrentWork: concurrentWork, inspectIssueCoordination: openIssue }
  );
  assert.equal(git(task, 'rev-parse', 'HEAD'), bootstrap.manifest.baseSha);

  writeFileSync(join(task, 'TASK.md'), 'governed work\n');
  git(task, 'add', '.');
  git(task, 'commit', '-m', 'task work');
  await prepushTask(
    { cwd: task },
    { inspectConcurrentWork: concurrentWork, inspectIssueCoordination: openIssue }
  );

  const writer = join(fixture.root, 'writer');
  git(fixture.root, 'clone', fixture.remote, writer);
  configureGit(writer);
  writeFileSync(join(writer, 'DRIFT.md'), 'main moved\n');
  git(writer, 'add', '.');
  git(writer, 'commit', '-m', 'main drift');
  git(writer, 'push', 'origin', 'main');
  await assert.rejects(
    prepushTask(
      { cwd: task },
      { inspectConcurrentWork: concurrentWork, inspectIssueCoordination: openIssue }
    ),
    (error) => error instanceof GuardError && error.reason === 'MAIN_DRIFT_DETECTED'
  );

  git(task, 'fetch', 'origin', 'main');
  git(task, 'merge', '--no-edit', 'origin/main');
  await refreshTask(
    { cwd: task },
    { inspectConcurrentWork: concurrentWork, inspectIssueCoordination: openIssue }
  );
  await prepushTask(
    { cwd: task },
    { inspectConcurrentWork: concurrentWork, inspectIssueCoordination: openIssue }
  );
  git(task, 'push', '-u', 'origin', 'task/lifecycle');
  const exactHead = git(task, 'rev-parse', 'HEAD');

  const integrator = join(fixture.root, 'integrator');
  git(fixture.root, 'clone', fixture.remote, integrator);
  configureGit(integrator);
  git(integrator, 'fetch', 'origin', 'task/lifecycle');
  git(integrator, 'merge', '--squash', 'origin/task/lifecycle');
  git(integrator, 'commit', '-m', 'squash merge task');
  git(integrator, 'push', 'origin', 'main');
  const mergeCommitSha = git(integrator, 'rev-parse', 'HEAD');

  git(fixture.canonical, 'fetch', 'origin', 'main');
  git(fixture.canonical, 'worktree', 'add', '-b', 'task/dirty', dirty, 'origin/main');
  writeFileSync(join(dirty, 'DIRTY.md'), 'must stay\n');
  git(fixture.canonical, 'worktree', 'add', '-b', 'task/unknown', unknown, 'origin/main');

  const doctorDependencies = {
    inspectConcurrentWork: concurrentWork,
    inspectIssueCoordination: closedIssue
  };
  const report = await doctorRepository({ cwd: fixture.canonical }, doctorDependencies);
  const byPath = new Map(report.worktrees.map((entry) => [entry.path, entry]));
  assert.equal(byPath.get(task.replaceAll('\\', '/')).classification, 'CLOSED_UNMERGED');
  assert.equal(byPath.get(dirty.replaceAll('\\', '/')).classification, 'DIRTY');
  assert.equal(byPath.get(unknown.replaceAll('\\', '/')).classification, 'UNKNOWN');

  const pullInspector = async () => ({
    repository: 'fixture/repo',
    pulls: [
      {
        number: 1,
        state: 'closed',
        mergedAt: '2026-09-16T00:00:00Z',
        mergeCommitSha,
        headSha: exactHead,
        headRef: 'task/lifecycle',
        baseRef: 'main',
        url: 'https://example.test/pull/1'
      }
    ]
  });
  const closeoutDependencies = {
    doctorDependencies,
    inspectPullRequestsForBranch: pullInspector
  };
  const closed = await closeoutTask(
    { cwd: fixture.canonical, worktree: task, apply: true },
    closeoutDependencies
  );
  assert.equal(closed.status, 'APPLIED');
  await assert.rejects(
    closeoutTask({ cwd: fixture.canonical, worktree: dirty, apply: true }, closeoutDependencies),
    (error) => error instanceof GuardError && error.reason === 'WORKTREE_NOT_CLEAN'
  );
  await assert.rejects(
    closeoutTask({ cwd: fixture.canonical, worktree: unknown, apply: true }, closeoutDependencies),
    (error) => error instanceof GuardError && error.reason === 'BOOTSTRAP_MANIFEST_MISSING'
  );

  const hygiene = await planRepositoryHygiene(
    { cwd: fixture.canonical },
    { doctorDependencies, closeoutDependencies }
  );
  assert.equal(
    hygiene.items.find((item) => item.id === 'branch:task/lifecycle').category,
    'REMOTE_ONLY'
  );
  assert.equal(
    hygiene.items.some((item) => item.category === 'DIRTY'),
    true
  );
  assert.equal(
    hygiene.items.some((item) => item.category === 'NEEDS_MANUAL_REVIEW'),
    true
  );

  const unavailable = await doctorRepository(
    { cwd: fixture.canonical },
    {
      ...doctorDependencies,
      fetchRemoteMain: () => {
        throw new GuardError('REMOTE_FETCH_FAILED');
      }
    }
  );
  assert.equal(unavailable.status, 'UNKNOWN');
  assert.equal(unavailable.errors[0].reason, 'REMOTE_FETCH_FAILED');
});
