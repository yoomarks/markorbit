# M7-WP-01 — Beta readiness contracts, gap inventory and authority boundary

- **Milestone:** `MO-MVP-MILESTONE-007`
- **Direction:** `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`
- **Base:** `ca74da13b294d91b5a8bae5ee0fad3d6fbd2000f` (TASK 032A / PR #94 merged approval)
- **Status:** `COMPLETE_FOR_OWNER_REVIEW`
- **Scope:** contracts, authority fixture, Week 4 gap inventory and architecture boundary only

## Objective

Freeze the smallest shared Beta-readiness contract required by the approved M7 plan before any analytics, seed, Beta-level E2E or deployment-rehearsal runtime change is introduced.

## Required outputs

1. `@markorbit/contracts/beta-readiness` with:
   - bounded Week 4/M7 gap keys and statuses;
   - exact work-package ownership for remaining gaps;
   - non-authoritative Product metric semantics;
   - explicitly non-production seeded-demo semantics;
   - Deployment Rehearsal semantics;
   - Beta Release Candidate semantics;
   - automated-gate / Owner release-authorization separation;
2. a machine-readable authority fixture locking every readiness artifact to false business/release/truth consequences;
3. a typed gap inventory distinguishing already-satisfied M2-M6/PLC obligations from remaining M7 implementation;
4. architecture documentation freezing owner/data boundaries and prohibiting generic analytics/event/demo/deployment extraction;
5. contract tests for vocabulary, gap classification and false authority consequences;
6. no runtime/database migration in this work package.

## Frozen gap classification

Already satisfied and reused:

- private Capability learning loop — M6;
- lifecycle projection / non-executing Recommended Action path — M5;
- permission, isolation, idempotency, retry and recovery baseline — M2-M6/PLC, revalidated later by M7-WP-06.

Remaining implementation:

- M7-WP-02 — bounded Content/Opportunity conversion analytics;
- M7-WP-03 — deterministic non-production seeded Beta scenario;
- M7-WP-04 — one Beta-level three-loop real-runtime acceptance graph;
- M7-WP-05 — deployment/migration/restart/rollback recovery rehearsal;
- M7-WP-06 — exact-head Beta RC readiness / responsive / known-limits matrix;
- M7-WP-07 — independent Beta readiness and authority audit.

## Acceptance locks

```text
Product metric != business authority
Seeded demo record != customer/provider/official truth
Deployment Rehearsal != Production Deployment
Beta Release Candidate != Released Beta
Green CI != Owner Release Authorization
```

Every readiness artifact also preserves the prior permanent locks, including:

```text
Recommendation != authorization
PublishPackage != Published
Candidate != Formal Opportunity
Intake != Order != Matter != Filing
Evidence Review Decision != Official Truth
Provider Return != Official Truth
Product/work evidence != Capability verification
Reflection Candidate != canonical truth
Accepted private reflection != verified Capability
no cross-service SQL
```

## Contract decisions

### Gap inventory

The contract uses only two readiness statuses:

- `SATISFIED_BY_EXISTING_EVIDENCE` — reuse existing milestone evidence rather than rebuild the capability;
- `REMAINS_M7_IMPLEMENTATION` — bounded work remains in the named M7 work package.

This avoids inventing a generic release-management state machine.

### Product metric

A conversion metric is observational only and may not mutate owner business state or authorize a protected action.

### Seeded demo record

A seeded record is valid only in `TEST` or `REHEARSAL`, remains non-production and cannot become customer/provider/Official Truth merely because it exists in an owner database.

### Deployment rehearsal

Rehearsal evidence proves engineering operability only. Production traffic cutover remains false.

### Beta release candidate and green gate

A candidate remains `released: false`; automated gates remain non-authorizing. Explicit Owner release authorization is outside the work package.

## Non-goals

- M7-WP-02 analytics runtime/read model;
- M7-WP-03 seeding/reset implementation;
- M7-WP-04 Beta-level E2E runtime graph;
- M7-WP-05 deployment or migration rehearsal tooling;
- M7-WP-06 RC evidence generation;
- M7-WP-07 final audit;
- production deployment, DNS/traffic cutover, release/tag publication;
- generic analytics/event/demo/deployment platform;
- cross-service SQL;
- Payment/Invoice, legal appointment, external Filing Submission or Official Truth;
- public Capability ranking/certification or automatic Capability verification/Canon mutation.

## Next

After explicit Owner merge only:

`M7-WP-02 — Bounded Content/Opportunity conversion analytics`.
