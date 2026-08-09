# MO MVP TASK 029 — Milestone 4 scope and architecture lock

- **Task ID:** MO-MVP-TASK-029
- **Baseline:** merged `main` at `505962ff146980a64b9cf6e08259068146612d05` after M3-WP-08 / PR #47.
- **Task type:** planning / architecture decision only.
- **Status:** `PROPOSED_FOR_OWNER_APPROVAL`.
- **Objective:** select and bound the next MVP milestone after the Milestone 3 `GO` audit without starting implementation.
- **Recommended direction:** `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`.

## Canonical basis

TASK 029 is governed by:

- `AGENTS.md` repository locks;
- `docs/product/MVP-PRODUCT-LOCK.md`;
- `docs/planning/FOUR-WEEK-PLAN.md`;
- the Milestone 3 scope, delivery, reliability and audit record;
- the existing Execution Filing Authorization / Execution Release / Filing Execution Task Draft semantics;
- the MGSN service ownership statement.

The controlling semantic locks include:

- Provider Supply Capability is not user Capability evidence;
- Provider Return is not Official Truth;
- Payment is not performance, authority, acceptance or completion;
- protected external actions require explicit review and approval;
- automatic official filing is an MVP non-goal.

## Repository gap after Milestone 3

Milestone 3 closes the durable commercial bridge:

```text
confirmed commercial source
-> durable Order
-> ReadyForMatter
-> Formal Matter
```

The Beta delivery loop still lacks durable governed provider execution:

```text
governed execution source
-> Service Package
-> eligible provider
-> Allocation
-> Provider Acceptance
-> Provider Return
-> evidence handoff / review
```

The current Execution service already contains useful Filing Authorization / Execution Release semantics but still uses in-memory filing-governance persistence. MGSN is still a deployable service skeleton and owns no durable provider-network state yet.

## Proposed Milestone 4 outcome

An authenticated authorized actor can take an exact current governed Execution source, create a durable MGSN Service Package, evaluate provider eligibility, explicitly allocate one eligible provider, record provider acceptance, receive a durable Provider Return, and hand the exact return/evidence to Execution for review.

The outcome preserves:

- Core identity / Workspace / Principal ownership;
- MarkReg Order/Matter/document ownership;
- Execution filing-governance and evidence-review ownership;
- MGSN provider-network ownership;
- database-per-owner isolation;
- exact source IDs/versions/fingerprints;
- deterministic idempotency and optimistic concurrency;
- provider and Workspace isolation;
- provider provenance and correction/supersession evidence;
- no automatic finance, legal appointment, external filing or Official Truth consequence.

## Direction decision

TASK 029 selects provider execution/return instead of Payment/Invoice or trademark-office submission because:

1. it directly closes the next missing MVP Beta loop;
2. the repository already has durable Matter truth suitable as an upstream boundary;
3. the existing Execution governance semantics provide a bounded source to harden rather than a blank design;
4. MGSN is explicitly the service owner for provider registry, eligibility, allocation, acceptance and return;
5. Payment/Invoice are not prerequisites for proving provider delivery authority;
6. external filing remains a higher-risk protected-action milestone that should consume reviewed durable provider/execution evidence rather than precede it.

## Planned work packages

- `M4-WP-01` — Provider execution contracts and canonical authority boundary.
- `M4-WP-02` — Durable authenticated Execution filing-governance source.
- `M4-WP-03` — Durable MGSN Provider Registry and Supply Capability.
- `M4-WP-04` — Service Package and deterministic Eligibility.
- `M4-WP-05` — Explicit Allocation and authenticated Provider Acceptance.
- `M4-WP-06` — Provider Return and exact Execution evidence handoff.
- `M4-WP-07` — Authenticated Gateway and controlled operations/provider journey.
- `M4-WP-08` — Reliability and migration matrix.
- `M4-WP-09` — Independent integration and authority audit.

## Explicit authority boundary

TASK 029 may approve implementation that creates internal provider-operational truth only through explicit governed commands:

- Service Package;
- Eligibility Evaluation;
- Allocation;
- Provider Acceptance / decline;
- Provider Return;
- evidence handoff/review record.

It does not approve or imply:

- payment or settlement;
- invoice issuance;
- legal/professional representative appointment;
- external trademark-office transmission;
- official application creation;
- application-number truth;
- trademark-office acceptance;
- automatic Matter completion;
- user Capability verification/canon mutation from provider performance.

A Provider Return may contain a provider assertion that an external action occurred, but that assertion remains evidence until a later separately scoped official-truth workflow validates and owns it.

## Planning outputs

- `docs/planning/MO-MVP-MILESTONE-004-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-004-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-004-PLAN.json`;
- this task record;
- Task Index and README status reconciliation.

## Allowed changes

Planning, architecture, task-index and repository-status documentation only.

## Prohibited changes

No product code, shared runtime contract implementation, database migration, provider record, allocation, Provider Return, Gateway route, UI behavior, payment/invoice integration, external filing, Git tag, release or deployment freeze is part of TASK 029.

## Acceptance

TASK 029 is complete when the planning documents consistently state:

- one selected Milestone 4 direction;
- why it follows Milestone 3;
- owner boundaries across Core / MarkReg / Execution / MGSN / Gateway;
- exact source and provider identity rules;
- allocation/acceptance/return semantics;
- Provider Return != Official Truth;
- work-package dependency graph;
- reliability/audit evidence requirements;
- explicit finance/legal-appointment/external-filing non-goals;
- repository validation passes on the planning branch.

Merging TASK 029 approves the planning direction for implementation. It does not itself implement provider execution or create a release.
