# Governed task lifecycle

MarkOrbit repository work follows one sequence:

`authoritative fetch → bootstrap → work → prepush → refresh when main moved → exact-head PR → merge → doctor → closeout → hygiene report`

The commands below compose the existing governance tools. They do not authorize product, contract, migration or protected-action changes.

## Start a bounded task

Run bootstrap from a clean repository worktree. Declare every file or directory the task may change; add the issue and migration flag when applicable.

```bash
pnpm task:bootstrap -- \
  --branch governance/1296-task-lifecycle-regression \
  --worktree ../markorbit-worktrees/governance-1296-task-lifecycle-regression \
  --scope scripts/task-lifecycle.e2e.test.mjs \
  --scope docs/development/task-lifecycle.md \
  --issue 1296
```

Bootstrap fetches the authoritative default branch, checks declared issue coordination and open-PR overlap, creates the dedicated worktree at that exact base, and records its private task manifest. Do not substitute a stale local `main` or reuse another task worktree.

## Before every push

Commit the intended change, then run:

```bash
pnpm task:prepush
```

If it reports main drift, fetch and integrate the current authoritative main without discarding task work, then record the new base:

```bash
git fetch origin main
git merge origin/main
pnpm task:refresh
pnpm task:prepush
```

Push only the exact head that passed. Open a PR for that head and let affected-scope CI plus exact-head merge readiness complete. A previous CI run for a different head is not reusable.

## After merge

Inventory current state first:

```bash
pnpm task:doctor
```

The doctor is read-only. `UNKNOWN`, `DIRTY`, `DETACHED`, `CLOSED_UNMERGED`, authority errors, or a protected canonical worktree are not cleanup approval.

Preview one exact task closeout from a different worktree:

```bash
pnpm task:closeout -- --worktree ../markorbit-worktrees/governance-1296-task-lifecycle-regression
```

Apply only after the dry-run returns `READY` for the expected path, branch, head and merged PR:

```bash
pnpm task:closeout -- \
  --worktree ../markorbit-worktrees/governance-1296-task-lifecycle-regression \
  --apply
```

Remote branch deletion is separate and opt-in with `--delete-remote`. Closeout re-fetches and revalidates immediately before mutation. It removes only the selected clean worktree and exact local branch; a head mismatch or state drift blocks the operation.

Finish with the repository-wide dry-run:

```bash
pnpm task:hygiene
```

The hygiene report never treats age as disposal evidence. Apply requires one or more exact IDs from the current `SAFE_CLOSEOUT_CANDIDATE` set:

```bash
pnpm task:hygiene -- --apply --select "worktree:D:/exact/task/path"
```

Each selected item delegates to the single-task closeout and is revalidated again. There is no blanket prune or mass branch deletion path.

## Stop conditions

Stop without mutation when any of these is true:

- fetch, GitHub API, issue coordination or PR authority is unavailable;
- the declared task base or exact PR head no longer matches;
- the worktree is dirty, detached, canonical/protected, unknown or referenced ambiguously;
- the PR is not merged, its merge commit is not represented in authoritative main, or branch heads differ;
- migration ownership or a central-surface overlap cannot be resolved from current evidence;
- the requested work would cross into business semantics, owner contracts, migrations or another active governance PR.

Resolve the evidence or obtain the required product/authority decision; never downgrade an anomalous state into a safe cleanup candidate.
