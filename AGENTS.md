# AGENTS.md

These rules apply to ChatGPT, Codex and human contributors working in this repository.

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

## 2. Repository discipline

- One task, one bounded outcome, one branch and one pull request.
- Do not modify unrelated workspaces.
- Do not create a second shared contract when one already exists.
- Services own their data and expose it only through contracts.
- No direct cross-service database reads.
- No copied API types in consumer code. Generate or import them from `packages/contracts`.
- No automatic formal-state mutation from an AI response or Provider Return.
- No automatic Capability verification or canon mutation from task completion.

## 3. UI work

Every UI task MUST load and follow the available `ui-design` skill before implementation.

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

## 4. Codex task shape

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

## 5. Quality gate

A PR is not ready until these pass:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

New behavior requires tests. New contract behavior requires fixtures. New user journeys require Playwright coverage when a UI exists.
