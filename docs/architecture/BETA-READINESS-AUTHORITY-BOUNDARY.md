# Beta Readiness Authority Boundary

**Milestone:** `MO-MVP-MILESTONE-007`  
**Work package:** `M7-WP-01`  
**Direction:** `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`

## Purpose

Freeze the smallest Beta-specific vocabulary, remaining-gap inventory and authority semantics required before Milestone 7 runtime work begins.

Milestone 7 is release-readiness work over existing Product and owner runtimes. It does not create a new business domain, generic analytics/event platform, demo-data platform or deployment authority service.

## Canonical Beta readiness distinctions

```text
Product metric != business authority
Seeded demo record != customer/provider/official truth
Deployment Rehearsal != Production Deployment
Beta Release Candidate != Released Beta
Green CI != Owner Release Authorization
```

These distinctions are represented by `@markorbit/contracts/beta-readiness` and must remain explicit in later M7 work packages.

## Week 4 gap inventory

| Week 4 objective                                                             | M7-WP-01 classification          | Evidence / next owner                                                     |
| ---------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| Capability Profile, Twin projection, Ledger and private Reflection Candidate | `SATISFIED_BY_EXISTING_EVIDENCE` | M6-WP-01..08 and PR #93 GO; reuse only                                    |
| Content and Opportunity conversion analytics                                 | `REMAINS_M7_IMPLEMENTATION`      | M7-WP-02                                                                  |
| Lifecycle reminders / recommended actions                                    | `SATISFIED_BY_EXISTING_EVIDENCE` | M5 lifecycle projection + non-executing Recommended Action; reuse only    |
| Permission, isolation, idempotency, retry and recovery tests                 | `SATISFIED_BY_EXISTING_EVIDENCE` | existing M2-M6/PLC reliability gates; exact-head revalidation in M7-WP-06 |
| Seeded demo                                                                  | `REMAINS_M7_IMPLEMENTATION`      | M7-WP-03                                                                  |
| E2E suites proving all three declared MVP loops as one Beta graph            | `REMAINS_M7_IMPLEMENTATION`      | M7-WP-04; compose existing real runtimes                                  |
| Deployment rehearsal / migration / rollback recovery                         | `REMAINS_M7_IMPLEMENTATION`      | M7-WP-05                                                                  |
| Exact-head Beta release candidate with explicit known limits                 | `REMAINS_M7_IMPLEMENTATION`      | M7-WP-06, then independent M7-WP-07 audit                                 |

The gap inventory deliberately distinguishes reuse from new implementation. Existing milestone-local runtimes and reliability gates must not be rebuilt merely to make M7 look self-contained.

## Product conversion metrics

A Product conversion metric is an observational projection from existing durable owner facts or bounded owner APIs/contracts.

It does not:

- authorize publication, qualification or Formal Opportunity creation;
- create Intake, Order, Matter or Filing state;
- mutate Capability verification or Canon;
- create customer, provider or Official Truth;
- execute a protected action.

M7-WP-02 may add only the minimum read-only projection required by the approved Week 4 objective. No generic event warehouse or cross-service SQL is authorized.

## Seeded demo records

A seeded demo record exists only in an explicitly enabled `TEST` or `REHEARSAL` environment.

It is not customer, provider, filing, Official Truth or verified Capability evidence. Later seeding must:

- fail closed outside approved non-production contexts;
- use owner-supported database/API paths rather than cross-service SQL;
- avoid real credentials, outreach, provider appointment, payment or filing;
- support deterministic replay/reset without granting business authority.

## Deployment rehearsal

Deployment rehearsal is non-production evidence that an exact candidate can be configured, migrated, started, restarted and recovered.

It does not imply:

- production traffic cutover;
- DNS or production environment mutation;
- released Beta status;
- Owner release authorization;
- bypass of Core permissions, Human Review, Execution governance or owner boundaries.

## Beta release candidate and automated gates

A Beta release candidate is an engineering readiness state attached to one exact repository head plus explicit readiness evidence and known limits.

`released: false` and `ownerAuthorizationRequired: true` remain invariant until a separate explicit Owner action.

A green automated gate provides engineering evidence only. It cannot authorize release or deployment and cannot grant business authority.

## Owner and data boundaries

Milestone 7 preserves all existing owner boundaries:

- Core owns identity, Workspace Principal, roles and permissions;
- Lite owns Product-owned pre-formal Product-loop state;
- MarkReg owns formal trademark-service state;
- Execution governs protected execution/review evidence;
- MGSN owns provider-network state;
- Capability Engine owns private Capability learning runtime state.

Release-readiness projections may consume bounded contracts/APIs but may not read another owner's database directly.

## Permanent authority locks inherited from earlier milestones

The following remain permanent:

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
```

Milestone 7 adds no Payment/Invoice, legal appointment, Filing Submission, Official Truth, public Capability ranking/certification, automatic Capability verification/Canon mutation or autonomous Twin authority.

## M7-WP-01 runtime boundary

M7-WP-01 adds contracts, fixtures, tests and documentation only.

It adds no:

- database migration or persistent runtime state;
- Gateway or service route;
- Product UI behavior;
- analytics calculation;
- seeded record;
- deployment environment mutation;
- release/tag/publication.

After explicit Owner merge of M7-WP-01, the next authorized implementation step is `M7-WP-02 — Bounded Content/Opportunity conversion analytics`.
