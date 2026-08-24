# MarkOrbit

MarkOrbit is the new product monorepo for:

- **MarkOrbit Lite** — the professional growth and work product for trademark practitioners;
- **markreg.com** — the direct-customer international trademark filing and lifecycle product;
- independent **Core**, **Lite**, **Knowledge**, **Capability Engine**, **Execution**, **MarkReg**, **MGSN**, and **Payment** services.

This repository is intentionally new. Previous repositories are reference material only and are not runtime dependencies unless a later migration task explicitly admits selected code.

## MVP objective

Deliver a Beta in four weeks that proves three complete loops:

1. trademark or knowledge → content → reviewed publish package;
2. trademark data → opportunity → qualified intake → matter;
3. direct or professional intake → recommendation → order/matter → provider return → evidence → outcome/reflection.

## Repository map

```text
apps/
  lite-web/              Professional product
  markreg-web/           Direct-customer product
  gateway/               Authenticated API aggregation boundary
  operations-console/    Internal operations product
services/
  core/                   Shared semantic and identity service
  lite/                   Professional Product state and governed projections
  knowledge/              Knowledge query and ready-package consumption
  capability-engine/      Capability registry, composition and invocation
  execution/              Plans, work, review, approval, evidence and receipts
  markreg/                International trademark service domain
  mgsn/                   Governed provider network domain
  payment/                Payment lifecycle, provider and reconciliation owner
packages/
  contracts/              Cross-service contracts and event envelopes
  service-kit/            Minimal service runtime shared by service skeletons
  events/                 Event publication/consumption abstractions
  ai/                     Model gateway abstractions
  ui/                     Shared UI foundations; not product-owned screens
  config/                 Shared configuration contracts
  test-kit/               Fixtures and integration-test helpers
  persistence/            Owner-scoped PostgreSQL persistence foundation
infrastructure/
  docker-compose.yml      Local integration dependencies
```

## Start

```bash
corepack enable
corepack prepare pnpm@10.28.1 --activate
pnpm install --no-frozen-lockfile
pnpm check
pnpm dev
```

Local infrastructure:

```bash
pnpm infra:up
pnpm infra:down
```

## Current milestone and sequencing

**Milestone 15 — Execution Sandbox & Release Readiness remains the latest completed engineering milestone, with completion baseline `00993123795254bef8fd84e4cdcb2bf535924660`. A bounded Post-M15 Integration Admission stage is active to reconcile cross-repository state and admit existing integrations through their primary product runtimes before any new business milestone is frozen. MarkOrbit × Data Engine G1 is fully closed, and its bounded `MO-DE-010` Trademark Asset admission is also complete.**

The Post-M15 Integration Admission stage is **not Milestone 16** and does not create a new business domain. Current sequencing facts are:

- M8 Commercial Foundation is engineering-complete except for real Stripe test-mode provider acceptance, which remains `DEFERRED_BY_OWNER_NO_ACCOUNT`; MarkOrbit is not represented as Stripe-ready.
- M9 Daily Workspace, M10 Trademark Asset Workspace, M11 Proactive Asset Management and M12 Trademark Service Workbench are engineering-complete; bounded Daily Workspace continuity hardening through PR #188 is merged on top of the completed M9 baseline.
- M13 established controlled service execution semantics and owner-domain handoffs.
- M14 made those semantics durable and authenticated in the Execution owner domain.
- M15 added non-production environment policy, connector isolation, deterministic simulation, operator readiness evidence, recovery drills and an independent release-readiness audit.
- MarkOrbit × Data Engine `MO-DE-001..005` G0 contract requirements are accepted and frozen.
- `MO-DE-006` real authenticated cross-repository transport/auth acceptance is complete and retains the bounded acceptance-runtime evidence.
- `MO-DE-009` Primary Gateway Protected Query Admission is complete in PR #190 / merge `eebbba5248a3f6ccc8e514700c1dcf555f6fbc06`; the normal `apps/gateway` `createRuntime()` now owns the accepted authenticated read path. Overall Data Engine G1 is complete.
- `MO-DE-010` bounded Trademark Asset On-Demand Product Admission is complete in PR #194 / merge `9600daa6b3ddc8d75cfbfcd443341ee755a30129`; PR #195 / merge `d996b1cd1b3e4f18b4e68b593bb6bfb8d88f2992` repaired and re-proved the cross-repository Lite acceptance gate. This is a narrow M10 detail-path admission, not a global Lite/Data Engine stage unlock.
- `MO-DE-007/008` change-feed/cursor work, Brain Data Engine integration and broader/global Lite Data Engine productization remain deferred and are **not** implicitly authorized by G1 or `MO-DE-010` completion.
- No production deployment, GA, production credentials, live filing, live payment, provider contact, external publication or Official Truth is authorized by these engineering or integration stages.

M5-WP-08 merged in PR #70 as `242b34f806711df608a7178b238104289e65bb00`. The completed governed application/lifecycle path is:

```text
current governed Execution source
-> durable MGSN Service Package
-> deterministic Eligibility
-> explicit Allocation
-> authenticated Provider Acceptance
-> durable Provider Return
-> exact Execution evidence handoff
-> durable PENDING_REVIEW evidence receipt
-> explicit authorized Evidence Review Decision
-> correction OR exact Reviewed Source Admission
-> retry-safe Execution-to-MarkReg handoff
-> durable MarkReg Lifecycle Projection
-> explainable non-executing Recommended Action
-> authenticated customer / operations projection
```

The M5 authority locks remain permanent: Evidence Review Decision is not Official Truth; reviewed-source admission is not Filing Submission; Lifecycle Projection is not Official Status; Recommended Action does not authorize execution; no Payment/Invoice, legal appointment, automatic Matter completion, automatic Capability verification or cross-service SQL follows from the lifecycle path.

### Product Loop Closure — completed sequencing gate

PR #73 established the Product Loop Closure stage, and PLC-WP-08 completed it with a GO recommendation in PR #83. The sequencing gate is closed.

The Product Loop Closure stage proves the canonical Lite mainline as a real Product loop:

```text
Today
-> traceable Recommendation
-> Prepared Action
-> explicit User Confirmation
-> Product / Workflow Handoff
-> Outcome / Feedback
```

At least one accepted journey closes Content and Opportunity into existing work:

```text
trusted trademark / client / work context
-> traceable source
-> Content Opportunity
-> bounded Content preparation
-> Human Review
-> prepared PublishPackage
-> manual use/publication feedback or signal
-> Opportunity Candidate
-> explicit Qualification
-> Formal Trademark Service Opportunity
-> MarkReg intake/work handoff
-> existing Matter / Execution / outcome path
```

The stage does not authorize automatic publication, customer outreach, generic CRM/platform extraction, universal Artifact/Opportunity/Workplace services, Payment/Invoice, provider appointment, external Filing Submission or Official Truth.

### Milestone 6 — Durable Capability Learning and Private Reflection — complete

PR #71 approved TASK 031A and the direction `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`. M6-WP-01 through M6-WP-08 are now merged. PR #93 independently audited the integrated runtime, repaired the bounded real-Execution-source acceptance gap, and completed Milestone 6 with a final **GO** recommendation.

The completed M6 loop is:

```text
accepted Capability Canon version
-> durable runtime Capability definition/version
-> exact governed work observation
-> private append-oriented Capability Ledger
-> explainable private Reflection Candidate
-> explicit subject-user ACCEPTED | REJECTED | DEFERRED disposition
-> deterministic private Capability Profile / Twin projection
-> authenticated Lite Capability Center
```

The M6 authority locks remain:

- Reflection Candidate is not canonical truth;
- accepted private reflection is not verified professional Capability;
- Provider Supply Capability is not user Capability evidence;
- raw Provider Return is not direct user Capability evidence;
- task completion does not automatically verify Capability;
- AI may draft reflection but may not accept it, verify Capability, mutate Canon or change permissions;
- Capability Twin is a private read model, not an autonomous identity or protected-action authority;
- no public rating/ranking, certification, Payment/Invoice, legal appointment, external filing or Official Truth is introduced.

### Milestone 7 — Beta Release Readiness and Operational Hardening — approved

TASK 032A / PR #94 approved the direction `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING` to close the remaining four-week Beta obligations without creating a new business domain.

The bounded delivery graph is:

```text
M7-WP-01 Beta readiness contracts / gap inventory / authority boundary
-> M7-WP-02 bounded Content + Opportunity conversion analytics
-> M7-WP-03 deterministic non-production seeded Beta scenario
-> M7-WP-04 three-loop full-journey real-runtime acceptance
-> M7-WP-05 deployment rehearsal + migration + rollback/recovery evidence
-> M7-WP-06 exact-head Beta RC reliability / responsive / known-limits matrix
-> M7-WP-07 independent Beta readiness and authority audit
```

Milestone 7 preserves the permanent distinctions:

```text
Product metric != business authority
Seeded demo record != customer/provider/official truth
Deployment Rehearsal != Production Deployment
Beta Release Candidate != Released Beta
Green CI != Owner Release Authorization
```

M7-WP-01 froze the Beta readiness semantics and Week 4 gap inventory. M7-WP-02 added the Lite-owned, Workspace-scoped, read-only Content/Opportunity conversion projection. M7-WP-03 added the explicitly enabled TEST/REHEARSAL deterministic owner-separated seed harness. M7-WP-04 merged in PR #98 and composes the three MVP loops through real owner PostgreSQL and real HTTP authority boundaries, including desktop and 390px mobile critical paths without business-route interception. M7-WP-05 merged in PR #99 and established an exact-head non-production candidate rehearsal across the six durable owner databases, using the repository's forward-only immutable-checksum migration model and owner-local logical snapshot restore/reapply recovery procedure; it also made the existing Lite owner-local structural workspace prerequisite explicit. M7-WP-06 now composes the established M2–M6, Product Loop and M7 predecessor gates on one exact candidate head, records a deterministic candidate/config fingerprint, carries machine-readable known limits and keeps `releaseAuthorized: false`. A passing WP-06 matrix means engineering readiness for the independent M7-WP-07 audit only; it does not release Beta or deploy production traffic.

### Milestone 9 — MO Lite Daily Workspace & Content Production — complete

M9 turns the governed Product Loop into the authenticated daily product surface:

```text
real governed Knowledge source
-> Daily Signal
-> explainable Daily Orbit
-> Content Pick
-> existing Content Opportunity / Draft / Human Review / PublishPackage lifecycle
-> Content Kit / platform variants
-> governed Visual Brief / output-reference boundary
-> SEE / CREATE / MOVE Daily Workspace
-> durable Product preference / feedback
```

The parallel MOVE path retains explicit confirmation and owner handoff. The final M9 WP08 post-merge audit run `32164841629` returned `GO` with no blockers and retained real-source, exact-provenance, Workspace-isolation, stale-source, replay/restart/concurrency and desktop/mobile browser evidence. The MOKI production visual runtime transport remains an explicitly deferred external gate and is fail-closed rather than represented as verified.

### Milestone 15 — Execution Sandbox & Release Readiness — complete

M15 proves the bounded non-production execution loop:

```text
durable M14 execution session
-> immutable environment / mode policy
-> protected-action environment binding
-> fail-closed connector and egress isolation
-> deterministic simulation or bounded test connector
-> evidence classification
-> operator readiness bundle
-> correlated recovery / manual review
-> independent authority audit
```

PRs #165–#173 delivered and audited M15. Final WP08 head `acd3918f2440acdce628a91c6f9653cea122705d` passed validation run `32605815199` and Authenticated Capability Center run `32605815191`; its eight-case sandbox authority audit passed in full. The completion baseline is `00993123795254bef8fd84e4cdcb2bf535924660`.

M15 completion means the existing controlled execution path is rehearsable and auditable in non-production. It does not admit a production environment, production credentials, unrestricted egress, live external actions, automatic external-consequence retry, deployment or GA.

See:

- `docs/audits/MO-MVP-PRODUCT-LOOP-CONFORMANCE-AUDIT.md`;
- `docs/planning/MO-MVP-PRODUCT-LOOP-CLOSURE-PLAN.md`;
- `docs/architecture/PRODUCT-LOOP-AUTHORITY-BOUNDARY.md`;
- `docs/audits/MO-MVP-MILESTONE-006-INTEGRATION-AUDIT.{md,json}`;
- `docs/planning/MO-MVP-MILESTONE-006-IMPLEMENTATION-TRACEABILITY.{md,json}`;
- `docs/planning/MO-MVP-MILESTONE-007-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-007-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-007-PLAN.json`;
- `docs/tasks/MO-MVP-TASK-032A-MILESTONE-007-SCOPE-LOCK.md`;
- `docs/tasks/MO-MVP-M7-WP-01-BETA-READINESS-CONTRACTS-AUTHORITY.md`;
- `docs/tasks/MO-MVP-M7-WP-02-BOUNDED-CONVERSION-ANALYTICS.md`;
- `docs/tasks/MO-MVP-M7-WP-03-DETERMINISTIC-SEEDED-BETA-SCENARIO.md`;
- `docs/tasks/MO-MVP-M7-WP-04-THREE-LOOP-FULL-JOURNEY-REAL-RUNTIME.md`;
- `docs/tasks/MO-MVP-M7-WP-05-DEPLOYMENT-REHEARSAL-RECOVERY.md`;
- `docs/tasks/MO-MVP-M7-WP-06-BETA-RC-RELIABILITY-MATRIX.md`;
- `docs/planning/MO-MVP-MILESTONE-009-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-009-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-009-IMPLEMENTATION-TRACEABILITY.{md,json}`;
- `docs/planning/MO-MVP-MILESTONE-010-CLOSEOUT-AUDIT.md`;
- `docs/planning/MO-MVP-MILESTONE-011-CLOSEOUT-AUDIT.md`;
- `docs/planning/MO-MVP-MILESTONE-012-IMPLEMENTATION-TRACEABILITY.{md,json}`;
- `docs/planning/MO-MVP-MILESTONE-013-IMPLEMENTATION-TRACEABILITY.{md,json}`;
- `docs/planning/MO-MVP-MILESTONE-014-IMPLEMENTATION-TRACEABILITY.{md,json}`;
- `docs/planning/MO-MVP-MILESTONE-015-IMPLEMENTATION-TRACEABILITY.{md,json}`;
- `docs/integrations/data-engine/README.md`;
- `docs/integrations/data-engine/requirements.md`;
- `docs/integrations/data-engine/integration-status.yaml`;
- `docs/integrations/data-engine/MO-DE-G1-CLOSEOUT-2026-08-24.md`;
- `docs/integrations/data-engine/MO-DE-010-CLOSEOUT-2026-08-24.md`;
- `docs/architecture/BETA-READINESS-AUTHORITY-BOUNDARY.md`;
- `AGENTS.md`.
