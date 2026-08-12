# MO MVP Milestone 7 Delivery Plan

**Milestone:** `MO-MVP-MILESTONE-007`  
**Planning task:** `TASK 032A`  
**Direction:** `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`  
**Baseline:** M6-WP-08 final GO merge `f63fb857663fc05879c26716169cb3186613f32b`

Milestone 7 closes the remaining four-week Beta release obligations without inventing a new business domain. Existing owner facts, Product loops and authority boundaries remain canonical.

## Delivery order

```text
TASK 032A approved
-> M7-WP-01 Beta readiness contracts / gap inventory / authority boundary
-> M7-WP-02 bounded Content + Opportunity conversion analytics
-> M7-WP-03 deterministic non-production seeded Beta scenario
-> M7-WP-04 three-loop full-journey real-runtime acceptance
-> M7-WP-05 deployment rehearsal + migration + rollback/recovery
-> M7-WP-06 exact-head Beta RC reliability/responsive/known-limits matrix
-> M7-WP-07 independent Beta readiness and authority audit
```

## M7-WP-01 — Beta readiness contracts, gap inventory and authority boundary

Freeze the Beta-specific vocabulary and remaining-gap inventory before runtime changes.

Required distinctions:

- Product conversion metric = observational projection, not authority;
- seeded demo record = non-production rehearsal evidence, not customer/provider/official truth;
- deployment rehearsal != production deployment;
- Beta release candidate != released Beta;
- green automated gate != Owner release authorization.

The work package must document which Week 4 objectives are already satisfied by M2–M6/PLC and which remain implementation work. It must not create a generic analytics, event, demo or deployment platform.

## M7-WP-02 — Bounded Content/Opportunity conversion analytics

Implement the minimum Product-owned/read-only conversion projection required by the four-week plan.

Minimum funnel facts should be derived from existing durable owner state:

```text
Content Opportunity
-> bounded preparation
-> Human Review / PublishPackage
-> manual use feedback

Opportunity Candidate
-> Qualification Decision
-> Formal Opportunity handoff result
```

Acceptance requirements:

- Workspace isolation;
- exact source/provenance where the projection crosses owner boundaries;
- no cross-service SQL;
- no generic event warehouse requirement;
- no mutation consequence from metrics;
- user-reported external use remains non-verified.

## M7-WP-03 — Deterministic non-production seeded Beta scenario

Create a deterministic reset/reseed path for the smallest useful Beta demonstration dataset.

The seed should cover:

- Core demo identity, Workspace and memberships;
- traceable Product-loop source state;
- Content and Opportunity paths;
- one MarkReg governed work path;
- one Capability-learning path where needed for the third Beta loop.

Safeguards:

- explicit rehearsal/test enablement;
- hard refusal in normal production configuration;
- per-owner supported seed/reset paths;
- no cross-service SQL;
- no real provider/customer credentials or external actions;
- repeatable IDs/fingerprints or another stable replay strategy.

## M7-WP-04 — Three-loop full-journey Beta real-runtime acceptance

Create one Beta-level acceptance graph that composes the already-built owner runtimes and proves the README MVP objective:

1. trademark/knowledge → content → reviewed PublishPackage;
2. trademark data/Product feedback → Candidate → qualified Formal Opportunity → Intake/Matter path;
3. direct/professional Intake → recommendation → Order/Matter → provider return → evidence/lifecycle → outcome/reflection.

The gate must use real service endpoints and owner PostgreSQL databases. Browser route interception/fulfillment may not substitute business APIs in the acceptance path.

Critical web journeys must retain desktop and 390px mobile coverage, direct URL/reload recovery and Workspace isolation.

## M7-WP-05 — Deployment rehearsal, migration and rollback/recovery evidence

Define one non-production candidate topology and prove that an exact repository head can be rehearsed reproducibly.

Minimum evidence:

- validated environment/config manifest with secrets excluded;
- database-per-owner migration order and health checks;
- service startup dependency behavior;
- restart recovery;
- forward migration rehearsal;
- bounded rollback/recovery procedure appropriate to the repository's migration model;
- evidence that failure does not fabricate business success or bypass authority.

This work package does not deploy production traffic and does not create release authority.

## M7-WP-06 — Exact-head Beta RC reliability, responsive and known-limits matrix

Build the release-candidate gate around one exact head SHA.

The matrix must include:

- M2–M6 and Product Loop regressions;
- M7 analytics/seed/full-journey/deployment-rehearsal gates;
- desktop/mobile critical-path evidence;
- restart/replay/isolation/idempotency checks;
- candidate environment/config fingerprint or equivalent stable evidence;
- machine-readable known limits;
- explicit `releaseAuthorized: false` until Owner action.

A passing matrix means engineering readiness for independent audit, not released Beta.

## M7-WP-07 — Independent Beta readiness and authority audit

Audit the exact WP-06 candidate against:

- `AGENTS.md` and Product Lock;
- four-week Beta objective and Week 4 exit;
- all permanent authority locks from M2–M6/PLC;
- owner boundaries and no-cross-service-SQL rule;
- analytics non-authority semantics;
- non-production seed isolation;
- real-runtime three-loop evidence;
- deployment/rollback rehearsal evidence;
- known-limits completeness.

The audit may return `GO` or `FIX`. `GO` means the exact candidate is eligible for explicit Owner release consideration. It does not itself deploy or release.

## Cross-cutting authority locks

Every work package must preserve:

```text
Recommendation != authorization
Prepared Action != executed action
PublishPackage != Published
Candidate != Formal Opportunity
Formal Opportunity != Intake
Intake != Order != Matter != Filing
Evidence Review Decision != Official Truth
Lifecycle Projection != Official Status
Provider Return != Official Truth
Product/work evidence != Capability verification
Reflection Candidate != canonical truth
Accepted private reflection != verified Capability
Deployment Rehearsal != Production Deployment
Beta Release Candidate != Released Beta
```

No work package may introduce automatic Capability verification/Canon mutation, public ranking/certification, Payment/Invoice, legal appointment, Filing Submission, Official Truth, autonomous Twin execution or cross-service SQL.
