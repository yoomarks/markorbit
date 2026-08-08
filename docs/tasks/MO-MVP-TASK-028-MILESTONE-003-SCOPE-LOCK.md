# MO MVP TASK 028 — Milestone 3 scope and architecture lock

- **Task ID:** MO-MVP-TASK-028
- **Baseline:** merged `main` at `cc2a7afcb79056abcf92dbe2fa4467e0c2767f8d` after PR #38.
- **Task type:** planning / architecture decision only.
- **Status:** `PROPOSED_FOR_OWNER_APPROVAL`.
- **Objective:** select and bound the next MVP milestone after the Milestone 2 `GO` audit without starting implementation.
- **Recommended direction:** `DURABLE_COMMERCIAL_ORDER_AND_MATTER_LINKAGE`.

## Canonical inputs

TASK 028 is governed by the repository product lock, the merged Milestone 2 scope/delivery/audit record, and the publication Order canon. The publication semantics remain controlling for the distinction `Order != Matter != Payment != Invoice != Filing`, canonical Order states, protected transitions and Order-to-Matter meaning.

The direct-customer product journey already requires `Quote and Confirmation -> Documents and Customer Actions -> Order / Matter -> Status, Evidence and Lifecycle`. Milestone 2 deliberately stopped before commercial Order authority and kept `orderCreated` false. TASK 028 therefore proposes Order as the next bounded durable business object rather than skipping directly to payment or external filing.

## Proposed Milestone 3 outcome

An authenticated authorized Workspace member can create and confirm a durable trademark-service Order from exact commercial source evidence, evaluate it as ready for Matter, and explicitly create or link the corresponding Formal Matter through a governed MarkReg operation.

The proposal preserves:

- exact Quote and Customer Confirmation lineage;
- Channel and Relationship Model;
- explicit commercial relationship references;
- Workspace isolation and Principal-derived authorization;
- PostgreSQL durability, optimistic concurrency and idempotency;
- atomic Order-to-Matter orchestration where the MarkReg owner boundary permits it;
- append-only protected-mutation audit evidence;
- desktop/mobile real-runtime recovery evidence.

## Explicit authority boundary

Milestone 3 may make `orderCreated = true` only through an explicit governed Order command. An explicit governed Order-to-Matter command may create/link internal Formal Matter truth.

It does not authorize or imply:

- Payment or settlement;
- Invoice issuance;
- professional appointment;
- external provider assignment;
- Filing Submission;
- official application creation or application-number receipt;
- external document dispatch;
- trademark-office contact;
- reliable cross-service event delivery.

`Confirmed` is not paid. `MatterCreated` is not filed.

## Planning outputs

- `docs/planning/MO-MVP-MILESTONE-003-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-003-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-003-PLAN.json`;
- this task record and planning index / README status reconciliation.

The proposed delivery plan uses milestone-local work-package IDs `M3-WP-01` through `M3-WP-08`. Global implementation task numbers are assigned only after TASK 028 is approved, preventing another planning/implementation numbering drift.

## Allowed changes

Planning, architecture, task-index and repository-status documentation only.

## Prohibited changes

No product code, contract implementation, database migration, runtime behavior, UI, CI behavior, Milestone 2 tag/freeze/release or external action is part of TASK 028.

## Acceptance

TASK 028 is complete when the planning documents consistently state one recommended Milestone 3 direction, ownership boundaries, state/authority semantics, work-package dependency graph, acceptance evidence and explicit non-goals, and repository validation passes on the planning branch.

Merging TASK 028 approves the planning direction for implementation; it does not itself implement Order or create a release.