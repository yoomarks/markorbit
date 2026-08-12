# MO MVP TASK 032A — Milestone 7 scope and architecture lock

- **Task ID:** MO-MVP-TASK-032A
- **Baseline:** M6-WP-08 final GO merge `f63fb857663fc05879c26716169cb3186613f32b` / PR #93.
- **Planning PR:** #94.
- **Task type:** planning / architecture decision only.
- **Status:** `PROPOSED_FOR_APPROVAL`.
- **Objective:** bound the final four-week Beta release-readiness milestone without starting runtime implementation or authorizing a release.
- **Proposed direction:** `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`.

## Numbering note

The historical Task Index already reserves `MO-MVP-TASK-032` for Class and Goods Recommendation. This milestone planning task uses `TASK 032A` rather than rewriting or reusing that identifier.

## Canonical basis

TASK 032A is governed by:

- `AGENTS.md` repository locks;
- `docs/product/MVP-PRODUCT-LOCK.md`;
- `docs/planning/FOUR-WEEK-PLAN.md`;
- Product Loop Closure GO in PR #83;
- Milestone 6 final integration/authority GO in PR #93;
- all established owner and authority boundaries from M2–M6.

## Repository gap after Milestone 6

The major Product and governed-work loops are now real, durable and independently audited. The Week 4 Beta plan still contains release-specific obligations that are not represented as one closed milestone:

- Content and Opportunity conversion analytics;
- deterministic seeded demo state;
- a Beta-level three-loop E2E acceptance graph;
- deployment rehearsal with migration/restart/rollback recovery evidence;
- exact-head Beta release-candidate qualification and known limits.

Existing milestone-local reliability, mobile and E2E gates are prerequisites to reuse, not justification for rebuilding them.

## Proposed Milestone 7 outcome

One exact repository head can be reset into an isolated rehearsal environment, deterministically seeded through owner-supported paths, exercised through all three declared MVP loops on real services/databases, observed through bounded conversion metrics, rehearsed through migration/startup/restart/rollback recovery, and independently audited into a Beta release-candidate recommendation with explicit known limits.

The outcome does not itself release or deploy production.

## Proposed work packages

- `M7-WP-01` — Beta readiness contracts, gap inventory and authority boundary.
- `M7-WP-02` — Bounded Content/Opportunity conversion analytics.
- `M7-WP-03` — Deterministic non-production seeded Beta scenario.
- `M7-WP-04` — Three-loop full-journey Beta real-runtime acceptance.
- `M7-WP-05` — Deployment rehearsal, migration and rollback/recovery evidence.
- `M7-WP-06` — Exact-head Beta RC reliability, responsive and known-limits matrix.
- `M7-WP-07` — Independent Beta readiness and authority audit.

## Explicit authority boundary

Milestone 7 may create only bounded readiness evidence and Product observational projections. It must preserve:

```text
Product metric != business authority
Seeded demo record != customer/provider/official truth
Deployment Rehearsal != Production Deployment
Beta Release Candidate != Released Beta
Green CI != Owner Release Authorization
```

All earlier authority locks remain permanent, including `PublishPackage != Published`, `Candidate != Formal Opportunity`, `Intake != Order != Matter != Filing`, `Evidence Review Decision != Official Truth`, `Provider Return != Official Truth`, `Reflection Candidate != canonical truth` and `accepted private reflection != verified Capability`.

TASK 032A does not authorize generic analytics/event infrastructure, cross-service SQL, Payment/Invoice, legal appointment, external Filing Submission, Official Truth, public Capability ranking/certification, automatic Capability verification/Canon mutation or autonomous Twin authority.

## Planning outputs

- `docs/planning/MO-MVP-MILESTONE-007-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-007-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-007-PLAN.json`;
- this task record;
- Task Index and README planning-status reconciliation;
- exact-head hosted validation evidence before Owner approval.

## Allowed changes in TASK 032A

Planning, architecture, task-index and repository-status documentation only.

## Prohibited changes in TASK 032A

No product/runtime code, database migration, analytics record, seeded business data, deployment environment mutation, production secret, traffic cutover, Git tag or release publication is part of TASK 032A itself.

## Approval gate

Merge of the TASK 032A planning PR approves only the Milestone 7 direction and bounded work-package graph. After that merge, the next authorized implementation step is `M7-WP-01`.

Planning approval does not itself create a Beta release candidate, deploy production, publish a release/tag or authorize any protected business action.
