import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GuardError } from './task-freshness.mjs';
import {
  classifyHygieneWorktree,
  planRepositoryHygiene,
  runRepositoryHygiene
} from './task-lifecycle-hygiene.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'markorbit-hygiene-'));
  const remote = join(root, 'remote.git');
  const canonical = join(root, 'canonical');
  git(root, 'init', '--bare', remote);
  git(root, 'clone', remote, canonical);
  git(canonical, 'config', 'user.email', 'hygiene@example.com');
  git(canonical, 'config', 'user.name', 'Repository Hygiene');
  writeFileSync(join(canonical, 'README.md'), 'fixture\n');
  git(canonical, 'add', '.');
  git(canonical, 'commit', '-m', 'fixture');
  git(canonical, 'branch', '-M', 'main');
  git(canonical, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const head = git(canonical, 'rev-parse', 'HEAD');
  for (const branch of ['task/safe', 'task/dirty', 'task/active', 'task/unknown', 'local-only']) {
    git(canonical, 'branch', branch, head);
  }
  git(canonical, 'push', 'origin', 'task/safe');
  git(canonical, 'branch', 'remote-only', head);
  git(canonical, 'push', 'origin', 'remote-only');
  git(canonical, 'branch', '-D', 'remote-only');
  const path = (name) => join(root, name).replaceAll('\\', '/');
  const manifest = { baseSha: head, issueNumber: 1295, expectedScope: ['scripts/'] };
  const report = {
    version: 1,
    status: 'WARN',
    repositoryRoot: canonical.replaceAll('\\', '/'),
    remote: 'origin',
    defaultBranch: 'main',
    remoteMain: head,
    errors: [],
    worktrees: [
      {
        path: canonical.replaceAll('\\', '/'),
        branch: 'main',
        head,
        canonical: true,
        dirty: false,
        detached: false,
        merged: true,
        manifest: null,
        classification: 'PROTECTED_CANONICAL',
        reason: 'CANONICAL_WORKTREE'
      },
      {
        path: path('safe'),
        branch: 'task/safe',
        head,
        canonical: false,
        dirty: false,
        detached: false,
        merged: false,
        manifest,
        classification: 'CLOSED_UNMERGED',
        reason: 'ISSUE_CLOSED'
      },
      {
        path: path('dirty'),
        branch: 'task/dirty',
        head,
        canonical: false,
        dirty: true,
        detached: false,
        merged: false,
        manifest,
        classification: 'DIRTY',
        reason: 'WORKTREE_NOT_CLEAN'
      },
      {
        path: path('detached'),
        branch: null,
        head,
        canonical: false,
        dirty: false,
        detached: true,
        merged: true,
        manifest: null,
        classification: 'DETACHED',
        reason: 'DETACHED_PROVENANCE_AMBIGUOUS'
      },
      {
        path: path('active'),
        branch: 'task/active',
        head,
        canonical: false,
        dirty: false,
        detached: false,
        merged: false,
        manifest,
        classification: 'ACTIVE',
        reason: 'TASK_NOT_MERGED'
      },
      {
        path: path('unknown'),
        branch: 'task/unknown',
        head,
        canonical: false,
        dirty: false,
        detached: false,
        merged: false,
        manifest: null,
        classification: 'UNKNOWN',
        reason: 'BOOTSTRAP_MANIFEST_MISSING'
      }
    ]
  };
  return { root, canonical, head, report };
}

function dependencies(fixture, overrides = {}) {
  return {
    doctorRepository: async () => fixture.report,
    planTaskCloseout: async ({ worktree }) => {
      if (worktree.endsWith('/active')) throw new GuardError('PR_NOT_MERGED');
      return {
        status: 'READY',
        mode: 'DRY_RUN',
        worktree,
        branch: 'task/safe',
        head: fixture.head
      };
    },
    ...overrides
  };
}

test('hygiene plan deterministically separates worktrees and branch drift', async () => {
  const fixture = createFixture();
  const plan = await planRepositoryHygiene({ cwd: fixture.canonical }, dependencies(fixture));
  const worktreeCategory = (suffix) =>
    plan.items.find((item) => item.kind === 'worktree' && item.path.endsWith(suffix)).category;
  assert.equal(worktreeCategory('/safe'), 'SAFE_CLOSEOUT_CANDIDATE');
  assert.equal(worktreeCategory('/dirty'), 'DIRTY');
  assert.equal(worktreeCategory('/detached'), 'DETACHED_UNKNOWN');
  assert.equal(worktreeCategory('/active'), 'ACTIVE');
  assert.equal(worktreeCategory('/unknown'), 'NEEDS_MANUAL_REVIEW');
  assert.equal(plan.items.find((item) => item.id === 'branch:local-only').category, 'LOCAL_ONLY');
  assert.equal(plan.items.find((item) => item.id === 'branch:remote-only').category, 'REMOTE_ONLY');
  assert.deepEqual(
    plan.items.map((item) => item.id),
    [...plan.items.map((item) => item.id)].sort((left, right) => left.localeCompare(right))
  );
});

test('merged branch referenced by multiple worktrees is never safe', () => {
  assert.deepEqual(
    classifyHygieneWorktree({
      canonical: false,
      dirty: false,
      detached: false,
      merged: true,
      reason: 'BRANCH_ATTACHED_TO_MULTIPLE_WORKTREES'
    }),
    {
      category: 'MERGED_BUT_REFERENCED',
      reason: 'BRANCH_ATTACHED_TO_MULTIPLE_WORKTREES'
    }
  );
});

test('apply requires explicit safe selections', async () => {
  const fixture = createFixture();
  const deps = dependencies(fixture, {
    closeoutTask: async () => {
      throw new Error('unsafe item must not reach closeout');
    }
  });
  await assert.rejects(
    runRepositoryHygiene({ cwd: fixture.canonical, apply: true }, deps),
    (error) => error instanceof GuardError && error.reason === 'HYGIENE_SELECTION_REQUIRED'
  );
  const plan = await planRepositoryHygiene({ cwd: fixture.canonical }, deps);
  const dirty = plan.items.find((item) => item.category === 'DIRTY');
  const result = await runRepositoryHygiene(
    { cwd: fixture.canonical, apply: true, select: [dirty.id] },
    deps
  );
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.selected[0].reason, 'HYGIENE_ITEM_NOT_SAFE');
});

test('selected safe item delegates mutation and preserves revalidation failure', async () => {
  const fixture = createFixture();
  let calls = 0;
  const deps = dependencies(fixture, {
    closeoutTask: async () => {
      calls += 1;
      throw new GuardError('CLOSEOUT_STATE_DRIFT');
    }
  });
  const plan = await planRepositoryHygiene({ cwd: fixture.canonical }, deps);
  const safe = plan.items.find((item) => item.category === 'SAFE_CLOSEOUT_CANDIDATE');
  const result = await runRepositoryHygiene(
    { cwd: fixture.canonical, apply: true, select: [safe.id] },
    deps
  );
  assert.equal(calls, 1);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.selected[0].reason, 'CLOSEOUT_STATE_DRIFT');
});
