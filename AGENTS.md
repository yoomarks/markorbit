# AGENTS.md

These rules apply to ChatGPT, Codex, AI Agents and human contributors working in this repository.

`AGENTS.md` is the single authoritative repository-level engineering and Agent instruction source. Do not create parallel `CLAUDE.md`, duplicate Agent rule files, or competing engineering standards unless a future tool requires a narrow compatibility shim that points back here.

Default engineering behavior:

**Root cause + Minimum change + Reuse + Verification + Scope discipline**

Core principle:

**Use the smallest, most direct, verifiable change that solves the real problem. Do not add code, abstraction, files, dependencies or architecture merely to make an implementation look more sophisticated.**

## 1. Canonical basis

Product semantics come from the current MarkOrbit Books 01–07 and the accepted Capability Canon. Do not silently replace their terminology with generic SaaS terminology.

Key locks:

- Capability = Stable Outcome Contract + Governed Implementation + Evidence Base + Version Lineage + Controlled Evolution.
- Capability hierarchy = Domain → Capability → Skill → Action / Invocation.
- Capability composition has exactly one Primary, zero to three Supporting, and zero or one Critic capability.
- Reflection Candidate is not canonical truth.
- Provider Supply Capability is not user Capability evidence.
- Provider Return is not Official Truth.
- Payment is not performance, authority, acceptance or completion.
- External protected actions require explicit review and approval.
- A Workplace retains its customer relationship, private context and permissions.

## 2. Repository and scope discipline

- One task, one bounded outcome, one branch and one pull request.
- Before changing code, identify the actual failure, execution path, SQL/config/workflow involved and confirmed root cause.
- Do not make broad changes before the root cause is known.
- Prefer root-cause repair over local compatibility handling, and local compatibility handling over temporary workarounds.
- Do not swallow errors, skip critical logic, delete tests, relax failure conditions, bypass integrity checks, or hard-code around a real defect just to make tests pass.
- Make only changes required for the current goal. If three lines solve the problem, do not change thirty.
- Do not opportunistically refactor directories, rewrite modules, add frameworks or abstraction layers, rename unrelated code, format the whole repository, or clean unrelated technical debt.
- If another issue blocks the task, fix it. If it does not block the task, record it and keep it out of scope.
- Do not modify unrelated workspaces.
- Do not create a second shared contract when one already exists.
- Services own their data and expose it only through contracts.
- No direct cross-service database reads.
- No copied API types in consumer code. Generate or import them from `packages/contracts`.
- No automatic formal-state mutation from an AI response or Provider Return.
- No automatic Capability verification or canon mutation from task completion.

## 3. Reuse and complexity control

Before adding implementation, use this order:

1. Reuse an existing repository implementation if one exists.
2. Reuse an existing function, module, tool or infrastructure capability.
3. Prefer the language/runtime standard library or native platform capability.
4. Prefer an already-installed dependency.
5. Add a new dependency or subsystem only when the verified problem actually requires it.

Avoid unnecessary wrappers, one-off abstraction layers, speculative plugin systems, premature generalization, premature modularization, or code written for imagined future requirements.

**Solve today's verified problem, not tomorrow's imagined problem.**

Minimum change never means reduced engineering quality. Do not weaken data integrity, security checks, permissions, required error handling, transaction consistency, idempotency, backward compatibility, required logging, tests, migration safety, API contracts, or user-data protection.

Before every commit or PR update, perform a complexity review:

> Is this implementation more complex than the current verified problem requires?

If yes, simplify it. Check specifically for unnecessary abstractions, files, dependencies, duplicated capabilities, unrelated edits and speculative future-facing code.

## 4. UI work

Every UI task MUST load and follow the canonical repository `ui-design` skill at `.agents/skills/ui-design/SKILL.md` before implementation. This repository-owned path is authoritative for MarkOrbit UI workflow; a user-level, plugin, or similarly named skill does not replace it.

If that file cannot be resolved in a fresh worktree, the UI task is blocked. Do not silently bypass the requirement or substitute Figma, memory, an external skill, or ad hoc design guidance.

A UI task must define:

- user and job-to-be-done;
- information architecture;
- desktop and mobile behavior;
- loading, empty, error, permission, partial-data and success states;
- accessibility behavior;
- fixture-backed Storybook states;
- visual review evidence;
- Playwright acceptance path.

Use the shared UI package for primitives, not for Product-owned workflow meaning. Lite and markreg.com may share primitives but must not share the same information architecture or user experience.

Figma is a design handoff and Code Connect surface. It is not a substitute for the `ui-design` skill, contracts, Storybook or tests.

## 5. Codex / Agent task shape and execution behavior

Every task prompt must include:

1. Task ID
2. Repository and allowed directories
3. Objective and user-visible outcome
4. Canonical sources
5. Contracts consumed or changed
6. Required behavior
7. State transitions
8. UI states when applicable
9. Events emitted and consumed
10. Acceptance tests
11. Validation commands
12. Non-goals
13. Expected PR title

Agents should act by default when the task is clear and required repository access is available. Information that can be confirmed from the repository, logs, tests, CI or project documentation should be read directly instead of repeatedly asking the user.

Default execution loop:

**Read → locate → confirm root cause → modify → test → fix → retest → complete.**

Avoid replacing execution with long speculative discussion. Ask the user only when a genuine product, authority, destructive-action or scope decision cannot be resolved from existing sources.

## 6. Verification and CI

A change is not complete because the code looks correct. Run the checks that apply to the change, including unit/integration tests, lint, typecheck, build, Docker/database/migration validation and hosted GitHub Actions where relevant.

For bug fixes, reproduce when practical:

**failure before fix → change → passing verification after fix**

PR validation uses affected-scope testing rather than treating every PR as a release candidate:

- always run repository/workspace boundary validation, formatting and the CI scope-detector tests;
- run Turbo lint, typecheck, test and build for changed packages plus their affected dependency graph;
- run PostgreSQL/HTTP integration only for affected owners (`core`, `lite`, `capability`, `markreg`, `execution`, `mgsn`, `payment`) and affected Gateway/Persistence boundaries;
- owner-specific migrations select their owner plus Persistence; unknown/shared migrations, `packages/persistence`, shared runtime packages and generic shared contracts conservatively expand downstream coverage;
- UI/browser checks run only for affected UI/Playwright/Storybook surfaces;
- root workspace topology changes may intentionally upgrade a PR to full-workspace validation.

Full workspace regression remains mandatory on `main` and for explicit release-candidate/reliability workflows. Release-level reliability, full-journey and browser matrices must not be used as unconditional ordinary-PR gates.

The canonical full regression remains:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Selective CI is a scheduling policy, not reduced quality. Do not skip a relevant test to make a PR faster; fix scope detection or escalate the affected domain when ownership is uncertain.

New behavior requires tests. New contract behavior requires fixtures. New user journeys require Playwright coverage when a UI exists.

When CI fails:

1. Read the current failing log.
2. Identify the first real root cause.
3. Make the smallest correct fix.
4. Validate in the relevant local or hosted environment.
5. Re-run CI.
6. Repeat until the required checks pass.

Do not merely explain a CI failure without fixing it when the task and access permit execution. Do not refactor an entire related module because one CI check failed.

## 7. Git and pull-request discipline

Before commit or PR update, inspect the diff and confirm:

- only necessary files changed;
- no unrelated edits or generated junk are present;
- no temporary debug code, files or workflows remain;
- no dependency or lockfile change exists without a real need;
- the implementation cannot be made materially simpler without weakening correctness.

PR descriptions should focus on:

- the problem;
- the root cause;
- the necessary change;
- validation performed;
- explicit non-goals or remaining blockers when relevant.

Avoid process-heavy narration that does not help review the change.

## 8. Reporting behavior

Reduce fragmented progress reporting during development. Unless a real user decision is required, complete a coherent stage before reporting.

Final development reports should stay concise and state:

- what was completed;
- the key files or behavior changed;
- whether tests and CI passed;
- any remaining blocker;
- the next approved step.

Do not narrate every search, command or internal reasoning step.