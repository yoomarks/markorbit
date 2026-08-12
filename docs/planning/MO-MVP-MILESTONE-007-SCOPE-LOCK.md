# MO MVP Milestone 7 — Beta Release Readiness and Operational Hardening

**Planning task:** `TASK 032A`  
**Baseline:** M6-WP-08 final GO merge `f63fb857663fc05879c26716169cb3186613f32b` / PR #93  
**Status:** `PROPOSED_FOR_APPROVAL`  
**Proposed direction:** `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`

## 1. Decision

Milestone 7 should close the remaining four-week Beta release obligations rather than introduce a new business domain.

Milestones 2–6 plus Product Loop Closure already prove the durable governed backbone, Product loop, lifecycle/recommended-action path, private Capability learning loop, owner isolation, restart/replay/idempotency and substantial desktop/mobile real-runtime coverage. The remaining Beta-specific gaps are narrower:

1. bounded Content/Opportunity conversion analytics are not yet a formal Product acceptance surface;
2. there is no deterministic, resettable seeded Beta scenario spanning the real owner databases;
3. the repository has strong milestone-local E2E gates but no single Beta-level acceptance graph proving the three declared MVP loops from seeded state;
4. deployment rehearsal, rollback/recovery evidence and Beta release-candidate qualification are not yet a governed gate.

The Week 4 plan explicitly requires content/opportunity conversion analytics, seeded demo, E2E suites and deployment rehearsal, with an exit of a Beta release candidate with three complete loops and explicit known limits.

## 2. What is already complete and must not be rebuilt

Milestone 7 reuses rather than duplicates:

- Core Session, Workspace Principal, role and permission truth;
- Lite Today → Recommendation → Prepared Action → confirmation → Product/workflow handoff → feedback;
- Content Opportunity → bounded preparation → Human Review → PublishPackage → manual-use feedback;
- Opportunity Candidate → explicit Qualification → MarkReg Formal Opportunity → Intake/work handoff;
- MarkReg Intake → Order/Matter → governed Execution/MGSN → Evidence Review → lifecycle projection → Recommended Action;
- private Capability Observation/Ledger → Reflection Candidate → explicit subject disposition → Profile/Twin;
- database-per-owner isolation, durable idempotency, replay, concurrency and restart gates;
- desktop and 390px real-runtime browser acceptance already established by prior milestones.

Milestone 7 does not replace those owner truths with a generic analytics, demo, workflow or release platform.

## 3. Beta outcome

A release candidate can be produced from one exact repository head and one documented environment configuration such that:

```text
reset isolated Beta rehearsal environment
-> seed deterministic demo identities/workspaces/source records through owner-supported paths
-> run the three declared MVP loops through real services and owner databases
-> observe bounded Product conversion metrics from existing owner facts
-> prove desktop/mobile critical journeys
-> exercise restart/replay/migration/rollback recovery
-> produce exact-head Beta readiness evidence + known-limits manifest
-> independent readiness/authority audit
-> Owner decides whether to release
```

A passing Milestone 7 gate creates a **Beta release candidate**, not a production deployment or automatic release authorization.

## 4. Bounded conversion analytics

The four-week plan requires Content and Opportunity conversion analytics. Milestone 7 may add only the minimum Product-owned/read-only projections needed to answer questions such as:

- how many traceable Content Opportunities reached bounded draft preparation;
- how many reached Human Review / PublishPackage;
- how many received user-reported use feedback;
- how many Opportunity Candidates received a Qualification Decision;
- how many qualified candidates produced a Formal Opportunity handoff result.

Rules:

- analytics consume existing durable owner facts or bounded owner APIs/contracts;
- no cross-service SQL;
- no second generic event store is required;
- no universal analytics/event platform is authorized;
- aggregate/read-model output is observational only and cannot authorize publication, qualification, formal opportunity creation, Order/Matter mutation, filing, Capability verification or any protected action;
- user-reported use remains user-reported and is not independently verified external outcome truth.

## 5. Seeded Beta scenario boundary

The seeded demo must be deterministic, resettable and explicitly non-production.

It may seed only the minimum test/rehearsal state necessary to exercise the Beta loops. Seeded identities and records must be visibly attributable to the rehearsal environment and must never be treated as customer, provider, filing, official or verified-Capability truth.

Required safeguards:

- fail closed outside an explicitly enabled test/rehearsal environment;
- database-per-owner seeding rather than cross-service SQL mutation;
- deterministic IDs/fingerprints where useful for replay assertions;
- reset/reseed reproducibility;
- no real credentials, customer outreach, provider appointment, payment or external filing.

## 6. Deployment rehearsal boundary

Milestone 7 may define and execute a non-production deployment rehearsal for the Beta candidate, including configuration validation, migrations, service startup/health, restart, rollback/recovery and evidence capture.

The following remain separate:

```text
Deployment Rehearsal != Production Deployment
Beta Release Candidate != Released Beta
Green CI != Owner Release Authorization
Environment Configuration != Business Authority
```

Release tooling must not bypass Core permissions, Human Review, Execution governance, provider identity, source-admission rules or any owner boundary.

## 7. Permanent authority locks

Milestone 7 preserves every prior authority distinction, including:

- Recommendation != authorization;
- Prepared Action != executed action;
- PublishPackage != Published;
- Candidate != Formal Opportunity;
- Formal Opportunity != Intake;
- Intake != Order != Matter != Filing;
- Evidence Review Decision != Official Truth;
- Lifecycle Projection != Official Status;
- Recommended Action does not authorize execution;
- Provider Return != Official Truth;
- Product/work evidence != Capability verification;
- Reflection Candidate != canonical truth;
- accepted private reflection != verified Capability;
- no automatic Capability Canon mutation;
- no automatic protected external action;
- no cross-service SQL.

Milestone 7 does not add Payment/Invoice, legal appointment, external Filing Submission, Official Truth ingestion, public professional ranking/certification or autonomous Twin authority.

## 8. Work-package graph

- `M7-WP-01` — Beta readiness contracts, gap inventory and authority boundary.
- `M7-WP-02` — Bounded Content/Opportunity conversion analytics.
- `M7-WP-03` — Deterministic non-production seeded Beta scenario.
- `M7-WP-04` — Three-loop full-journey Beta real-runtime acceptance.
- `M7-WP-05` — Deployment rehearsal, migration and rollback/recovery evidence.
- `M7-WP-06` — Exact-head Beta RC reliability, responsive and known-limits matrix.
- `M7-WP-07` — Independent Beta readiness and authority audit.

Implementation starts only after explicit Owner approval of this planning task.

## 9. Milestone 7 GO gate

Milestone 7 is eligible for a final `GO` recommendation only when one exact candidate head proves:

1. bounded conversion analytics derive from existing owner facts without creating business authority;
2. deterministic seed/reset works only in approved non-production rehearsal contexts;
3. all three declared MVP loops run on real services and owner PostgreSQL databases without route interception substituting business APIs;
4. critical product journeys pass on desktop and 390px mobile where applicable;
5. direct URL/reload and durable restart/replay remain sound for critical durable views;
6. migration/startup/restart and rollback/recovery rehearsal is reproducible;
7. M2–M6 and Product Loop regression gates remain green;
8. a machine-readable known-limits/readiness artifact is generated for the exact candidate head;
9. an independent readiness/authority audit returns `GO`;
10. release/deployment authority remains an explicit Owner action.

## 10. Non-goals

- production deployment or DNS/traffic cutover;
- automatic Beta release or tag publication;
- a generic analytics/event/data-warehouse platform;
- a generic demo-data platform;
- redesign of existing Product loops or owner domains;
- speculative Workplace/Brain/Value Factory/Intelligence/universal Artifact services;
- Payment/Invoice or settlement;
- legal appointment;
- external filing or Official Truth;
- public Capability rating/ranking/certification;
- automatic Capability verification or Canon mutation.

## 11. Approval semantics

Merge of the TASK 032A planning PR approves only the Milestone 7 direction and bounded work-package graph. It does not start a production deployment, publish a Beta release, create a tag or authorize any protected business action.

After approval, the next authorized implementation task is `M7-WP-01`.