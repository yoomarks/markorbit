# MO-MVP-TASK-031B — Product Loop Conformance Audit and Sequencing

## Task metadata

- **Task ID:** `MO-MVP-TASK-031B`
- **Repository:** `yoomarks/markorbit`
- **Base commit:** `ce5e845ee8350341d478ad5372ac1ccbaffe4fb4`
- **Allowed directories:** `docs/audits`, `docs/planning`, `docs/tasks`, and narrowly bounded status/index documentation if required for approval-state reconciliation
- **Task type:** audit and planning only
- **Expected PR title:** `TASK 031B — Product Loop Conformance Audit and Sequencing`

## Objective and user-visible outcome

Audit the current MarkOrbit MVP implementation against Books 01–07, Active Architecture Canon, the MVP Product Lock and the real runtime, then determine whether approved Milestone 6 should start immediately.

The user-visible outcome of this task is a reviewable repository decision package that:

- records the five Beta-loop maturity state;
- identifies any Product/architecture sequencing drift;
- preserves the valid M1–M5 backbone;
- preserves the approved M6 semantic direction;
- defines the smallest Product-loop closure stage required before M6 runtime work;
- states exactly what owner merge approval authorizes next.

No runtime behavior is created by TASK 031B.

## Canonical sources

- MarkOrbit Books 01–07;
- Active Architecture Canon / accepted owner decision records;
- accepted Capability Canon;
- `AGENTS.md`;
- `docs/product/MVP-PRODUCT-LOCK.md`;
- `docs/planning/FOUR-WEEK-PLAN.md`;
- current M2–M6 planning, implementation traceability and audits;
- current Lite, MarkReg, Execution, MGSN, Knowledge, Capability Engine and Gateway runtime evidence.

Key controlling principles:

```text
Product Loop First
-> Shared Platform Extraction Second
```

```text
Lite:
Today
-> Recommendation
-> Prepared Action
-> User Confirmation
-> Product / Workflow Handoff
```

```text
Observe
-> Explain
-> Recommend
-> Prepare
-> Confirm
-> Execute
-> Learn
```

## Contracts consumed or changed

No runtime contract is changed by this task.

The audit inspects existing Product and authority semantics only. Any future PLC-WP-01 contract work must first reuse compatible existing contracts and must not silently broaden lifecycle-specific semantics.

## Required behavior

TASK 031B must:

1. verify the actual merged state of PR #71 and current `main`;
2. audit the five MVP Beta loops against current runtime evidence;
3. distinguish a Product-loop sequencing issue from a missing generic Workplace platform;
4. detect whether current Lite information architecture conforms to the confirmed mainline;
5. preserve M6 Capability Learning as an approved direction if its semantics remain canonical;
6. define a bounded Product Loop Closure stage before M6 runtime work if required;
7. prohibit speculative universal Workplace, Brain, Value Factory, Intelligence or Artifact extraction;
8. preserve all existing authority locks;
9. make owner approval consequence explicit;
10. create no runtime code, migration, API route, database state, UI behavior or external action.

## State transitions

This task changes planning/audit state only.

Proposed approval transition:

```text
TASK 031B PROPOSED_FOR_OWNER_APPROVAL
-> owner merges TASK 031B PR
-> PRODUCT_LOOP_CLOSURE_APPROVED
-> PLC-WP-01 authorized
```

M6 state is not revoked:

```text
M6 APPROVED_NOT_STARTED
-> sequencing hold while Product Loop Closure executes
-> Product Loop Closure GO
-> M6-WP-01 may resume as the next approved milestone task
```

## UI states

None. TASK 031B contains no UI implementation.

Future PLC-WP-05 is a UI task and must load/follow the repository `ui-design` skill before implementation.

## Events emitted and consumed

None. TASK 031B emits and consumes no runtime events.

## Acceptance tests

The task is accepted when:

- the audit names the exact audited baseline;
- the five Beta-loop matrix is explicit;
- Product-loop depth imbalance is evidenced from current runtime;
- Lite parallel-module mainline drift is explicitly recorded;
- Workplace absence is explicitly rejected as the root defect;
- M6 is explicitly preserved as approved but sequenced later;
- a bounded Today -> Recommendation -> Prepared Action -> Confirmation -> Handoff -> Feedback stage is defined;
- one Content-to-Opportunity-to-Work acceptance scenario is defined;
- authority/non-goal locks are explicit;
- machine-readable audit and plan files agree with the Markdown documents;
- no runtime file is changed;
- repository validation/format checks applicable to documentation pass;
- hosted PR checks pass before the PR is presented as ready.

## Validation commands

Use repository-standard validation on the exact PR head where applicable:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Hosted GitHub Actions remain the source of truth when the local container cannot reproduce the repository environment.

If CI fails, inspect the current failing log and repair only the first real root cause.

## Non-goals

TASK 031B does not:

- implement PLC-WP-01 or any later Product Loop Closure runtime work;
- implement M6-WP-01;
- create a universal Workplace service;
- create Brain, Value Factory or Intelligence services;
- create a universal Artifact table/service;
- add Content/Opportunity modules merely to fill navigation labels;
- change Core authority;
- weaken Execution review/approval;
- publish externally;
- contact customers automatically;
- promote Opportunity Candidates automatically;
- create Order, Matter, Payment, Invoice or filing consequences;
- appoint providers or professionals;
- create Official Truth;
- verify Capability or mutate Capability Canon;
- merge its own PR.

## Expected decision

The audit recommendation is:

`RESEQUENCE_BEFORE_M6_WP01`.

If the owner merges the TASK 031B PR, the immediate next task is `PLC-WP-01 — Product mainline, contracts and ownership boundary`.
