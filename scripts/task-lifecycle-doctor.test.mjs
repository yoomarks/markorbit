import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GuardError } from './task-freshness.mjs';
import {
  classifyWorktree,
  doctorRepository,
  parseWorktreePorcelain
} from './task-lifecycle-doctor.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

const reportedPath = (path) => path.replaceAll('\\', '/');

function createRepositoryFixture() {
  const root = mkdtempSync(join(tmpdir(), 'markorbit-doctor-'));
  const remote = join(root, 'remote.git');
  const canonical = join(root, 'canonical');
  git(root, 'init', '--bare', remote);
  git(root, 'clone', remote, canonical);
  git(canonical, 'config', 'user.email', 'doctor@example.com');
  git(canonical, 'config', 'user.name', 'Task Doctor');
  writeFileSync(join(canonical, 'README.md'), 'fixture\n');
  writeFileSync(
    join(canonical, 'migration-owners.json'),
    JSON.stringify({ migrations: { '0001_fixture': { owner: 'core' } } })
  );
  git(canonical, 'add', '.');
  git(canonical, 'commit', '-m', 'fixture');
  git(canonical, 'branch', '-M', 'main');
  git(canonical, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const initialSha = git(canonical, 'rev-parse', 'HEAD');
  return { root, remote, canonical, initialSha };
}

function dependencies(overrides = {}) {
  return {
    inspectConcurrentWork: async () => ({ repository: 'fixture/repo', pulls: [] }),
    inspectIssueCoordination: async () => ({
      status: 'PASS',
      reason: 'ISSUE_COORDINATION_CURRENT'
    }),
    readMigrationStateAt: () => ({ tail: '0001', tailName: '0001_fixture', nextSlot: '0002' }),
    ...overrides
  };
}

function writeManifest(worktree, values) {
  const path = git(worktree, 'rev-parse', '--git-path', 'markorbit-task-bootstrap.json');
  writeFileSync(
    path,
    `${JSON.stringify({
      version: 1,
      branch: values.branch,
      worktreePath: worktree,
      baseSha: values.baseSha,
      expectedScope: ['scripts/'],
      issueNumber: values.issueNumber ?? 1293
    })}\n`
  );
}

test('parses attached and detached worktree porcelain records', () => {
  const parsed = parseWorktreePorcelain(
    'worktree C:/repo\nHEAD abc\nbranch refs/heads/main\n\nworktree C:/task\nHEAD def\ndetached\n'
  );
  assert.deepEqual(parsed, [
    { path: 'C:/repo', head: 'abc', branch: 'main', detached: false, prunable: false },
    { path: 'C:/task', head: 'def', branch: null, detached: true, prunable: false }
  ]);
});

test('fresh repository reports authoritative main and protected canonical clone', async () => {
  const fixture = createRepositoryFixture();
  const report = await doctorRepository({ cwd: fixture.canonical }, dependencies());
  assert.equal(report.status, 'PASS');
  assert.equal(report.remoteMain, fixture.initialSha);
  assert.deepEqual(report.canonical, {
    path: reportedPath(fixture.canonical),
    head: fixture.initialSha,
    branch: 'main',
    ahead: 0,
    behind: 0
  });
  assert.equal(report.worktrees[0].classification, 'PROTECTED_CANONICAL');
});

test('stale canonical clone reports its exact remote-main divergence', async () => {
  const fixture = createRepositoryFixture();
  const writer = join(fixture.root, 'writer');
  git(fixture.root, 'clone', fixture.remote, writer);
  git(writer, 'config', 'user.email', 'doctor@example.com');
  git(writer, 'config', 'user.name', 'Task Doctor');
  writeFileSync(join(writer, 'REMOTE.md'), 'advanced\n');
  git(writer, 'add', '.');
  git(writer, 'commit', '-m', 'advance remote');
  git(writer, 'push', 'origin', 'main');

  const report = await doctorRepository({ cwd: fixture.canonical }, dependencies());
  assert.equal(report.canonical.ahead, 0);
  assert.equal(report.canonical.behind, 1);
});

test('merged clean task, dirty task, detached worktree and unknown branch stay distinct', async () => {
  const fixture = createRepositoryFixture();
  const mergedPath = join(fixture.root, 'merged');
  const dirtyPath = join(fixture.root, 'dirty');
  const detachedPath = join(fixture.root, 'detached');
  const unknownPath = join(fixture.root, 'unknown');
  git(fixture.canonical, 'worktree', 'add', '-b', 'task/merged', mergedPath, fixture.initialSha);
  git(fixture.canonical, 'worktree', 'add', '-b', 'task/dirty', dirtyPath, fixture.initialSha);
  git(fixture.canonical, 'worktree', 'add', '--detach', detachedPath, fixture.initialSha);
  git(fixture.canonical, 'worktree', 'add', '-b', 'task/unknown', unknownPath, fixture.initialSha);
  writeManifest(mergedPath, { branch: 'task/merged', baseSha: fixture.initialSha });
  writeManifest(dirtyPath, { branch: 'task/dirty', baseSha: fixture.initialSha });
  writeFileSync(join(dirtyPath, 'DIRTY.md'), 'dirty\n');

  const report = await doctorRepository({ cwd: fixture.canonical }, dependencies());
  const byPath = new Map(report.worktrees.map((entry) => [entry.path, entry]));
  assert.equal(byPath.get(reportedPath(mergedPath)).classification, 'MERGED_CLEAN');
  assert.equal(byPath.get(reportedPath(dirtyPath)).classification, 'DIRTY');
  assert.equal(byPath.get(reportedPath(detachedPath)).classification, 'DETACHED');
  assert.equal(byPath.get(reportedPath(unknownPath)).classification, 'UNKNOWN');
  assert.equal(byPath.get(reportedPath(unknownPath)).reason, 'BOOTSTRAP_MANIFEST_MISSING');
});

test('closed issue without merged task head is CLOSED_UNMERGED', () => {
  assert.equal(
    classifyWorktree({
      canonical: false,
      dirty: false,
      detached: false,
      prunable: false,
      manifestProblem: null,
      merged: false,
      issueAudit: { status: 'BLOCKED', reason: 'ISSUE_CLOSED' }
    }).classification,
    'CLOSED_UNMERGED'
  );
});

test('unavailable remote or pull-request authority fails closed as UNKNOWN', async () => {
  const fixture = createRepositoryFixture();
  const remoteFailure = await doctorRepository(
    { cwd: fixture.canonical },
    dependencies({
      fetchRemoteMain: () => {
        throw new GuardError('REMOTE_FETCH_FAILED');
      }
    })
  );
  assert.equal(remoteFailure.status, 'UNKNOWN');
  assert.equal(remoteFailure.errors[0].reason, 'REMOTE_FETCH_FAILED');

  const apiFailure = await doctorRepository(
    { cwd: fixture.canonical },
    dependencies({
      inspectConcurrentWork: async () => {
        throw new GuardError('PR_METADATA_UNAVAILABLE');
      }
    })
  );
  assert.equal(apiFailure.status, 'UNKNOWN');
  assert.equal(apiFailure.errors[0].reason, 'PR_METADATA_UNAVAILABLE');
});

test('issue API failure makes an otherwise clean task UNKNOWN', async () => {
  const fixture = createRepositoryFixture();
  const taskPath = join(fixture.root, 'task');
  git(fixture.canonical, 'worktree', 'add', '-b', 'task/open', taskPath, fixture.initialSha);
  writeFileSync(join(taskPath, 'TASK.md'), 'task\n');
  git(taskPath, 'add', '.');
  git(taskPath, 'commit', '-m', 'task work');
  writeManifest(taskPath, { branch: 'task/open', baseSha: fixture.initialSha });

  const report = await doctorRepository(
    { cwd: fixture.canonical },
    dependencies({
      inspectIssueCoordination: async () => {
        throw new GuardError('ISSUE_METADATA_UNAVAILABLE');
      }
    })
  );
  const task = report.worktrees.find((entry) => entry.path === reportedPath(taskPath));
  assert.equal(report.status, 'UNKNOWN');
  assert.equal(task.classification, 'UNKNOWN');
  assert.equal(task.reason, 'ISSUE_METADATA_UNAVAILABLE');
});

test('doctor source contains no mutation command path', () => {
  const source = readFileSync(new URL('./task-lifecycle-doctor.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /worktree\s+(?:remove|prune)|branch\s+-[dD]|push[^\n]*--delete/);
});
