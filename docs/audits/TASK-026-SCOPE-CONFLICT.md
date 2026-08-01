# TASK 026 scope-conflict report

## Decision

Implementation of the requested durable filing-governance vertical slice is
stopped at the repository-approved boundary. No product code, contract,
migration, runtime, UI, or test behavior has been changed.

Owner clarification or an approved planning change is required before the
requested implementation can begin.

## Baseline inspected

- Baseline commit: `baebb68867c036d357e187b904b9ba7c26886109`.
- Baseline tree: `20a42b66bff37c2f65da458f6d66aa8a626c47b3`.
- TASK 025 is present at the baseline as the merged durable Document Package
  and Instruction Ledger change.
- The canonical planning sources inspected were `TASK-INDEX.md`,
  `MO-MVP-MILESTONE-002-DELIVERY-PLAN.md`,
  `MO-MVP-MILESTONE-002-PLAN.json`,
  `MO-MVP-MILESTONE-002-SCOPE-LOCK.md`, and
  `SERVICE-OWNERSHIP.md`.
- The existing Filing Authorization and Execution Release definition and the
  merged TASK 025 architecture, quality map, migration inventory, contracts,
  service code, Gateway code, and Web surfaces were also inspected.

## Material conflict

The repository defines TASK 026 as **Restart, migration and tenant-isolation
matrix**. Its objective is Quality/Platform testing of real processes and
PostgreSQL across recovery and failure scenarios. Its allowed scope is
integration/E2E orchestration, CI services, fixtures/documentation, and
attributable defect fixes. It expressly prohibits new product scope and sizes
the work as a test-harness-focused 400–800-line task.

The supplied task instead asks TASK 026 to introduce substantial new product
scope: four durable governance record types, owner migrations, shared
contracts, permissions, MarkReg and Execution operations, Gateway routes, two
Web workflows, Storybook states, and new browser journeys. Those changes are
not defect fixes or test orchestration and therefore exceed the currently
approved TASK 026 boundary.

The machine-readable plan independently identifies TASK 026 as the restart,
migration, and tenant-isolation matrix and makes it depend on TASK 017 through
TASK 025. The task table and detailed delivery plan agree; this is not an
isolated wording discrepancy.

There is also a direct contract mismatch. The existing frozen Filing
Authorization contract uses `PENDING_CONFIRMATION → AUTHORIZED` and Execution
Release uses `DRAFT → BLOCKED | READY_FOR_RELEASE → RELEASED_FOR_EXECUTION`.
The supplied task expects `DRAFT → CONFIRMED` and
`DRAFT → EVALUATED → RELEASED`, while also instructing the implementation not
to change frozen semantics. Implementing the supplied state names would
silently replace the existing governed contract.

Finally, repository UI rules require the `ui-design` skill to be loaded before
any UI implementation. No `ui-design` skill is available in the current
environment. This is an additional implementation prerequisite, but it does
not alter the primary planning conflict.

## Required resolution

Before implementation, the repository owners must choose and record one of
these outcomes:

1. Keep the approved TASK 026 boundary and replace the supplied product-scope
   request with the restart/migration/isolation matrix; or
2. Approve a planning change that moves or expands the durable filing
   governance vertical slice, reconciles the lifecycle terminology with the
   frozen contract, updates the task index/delivery plan/machine-readable plan,
   and makes the required `ui-design` skill available.

Until that decision is recorded, implementing the requested vertical slice
would violate the instruction not to silently redefine repository-approved
scope. TASK 027 has not been started.
