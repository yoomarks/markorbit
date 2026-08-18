# MarkOrbit

MarkOrbit is the new product monorepo for:

- **MarkOrbit Lite** — the professional growth and work product for trademark practitioners;
- **markreg.com** — the direct-customer international trademark filing and lifecycle product;
- independent **Core**, **Knowledge**, **Capability Engine**, **Execution**, **MarkReg**, and **MGSN** services.

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
  knowledge/              Knowledge query and ready-package consumption
  capability-engine/      Capability registry, composition and invocation
  execution/              Plans, work, review, approval, evidence and receipts
  markreg/                International trademark service domain
  mgsn/                   Governed provider network domain
packages/
  contracts/              Cross-service contracts and event envelopes
  service-kit/            Minimal service runtime shared by service skeletons
  events/                 Event publication/consumption abstractions
  ai/                     Model gateway abstractions
  ui/                     Shared UI foundations; not product-owned screens
  config/                 Shared configuration contracts
  test-kit/               Fixtures and integration-test helpers
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

**Milestone 9 — MO Lite Daily Workspace & Content Production is complete with a final engineering GO recommendation. M9-WP-01 through M9-WP-07 merged in PRs #117–#123; M9-WP-08 completed its bounded remediation and post-merge independent audit in PR #129. Completion main is `b5b05c439284376e0afb2f275ca1ca51229305b7`. No production deployment, GA, external publication, provider execution, paid execution, filing or Official Truth is authorized by this engineering completion.**

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

### Milestone 7 — Beta Release Readiness and Operational Hardening — complete

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

Milestone 7 closed the Beta engineering-readiness scope while preserving release/deployment authority as a separate owner decision.

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

See:

- `docs/audits/MO-MVP-PRODUCT-LOOP-CONFORMANCE-AUDIT.md`;
- `docs/planning/MO-MVP-PRODUCT-LOOP-CLOSURE-PLAN.md`;
- `docs/architecture/PRODUCT-LOOP-AUTHORITY-BOUNDARY.md`;
- `docs/audits/MO-MVP-MILESTONE-006-INTEGRATION-AUDIT.{md,json}`;
- `docs/planning/MO-MVP-MILESTONE-006-IMPLEMENTATION-TRACEABILITY.{md,json}`;
- `docs/planning/MO-MVP-MILESTONE-007-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-007-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-007-PLAN.json`;
- `docs/planning/MO-MVP-MILESTONE-009-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-009-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-009-IMPLEMENTATION-TRACEABILITY.{md,json}`;
- `docs/architecture/BETA-READINESS-AUTHORITY-BOUNDARY.md`;
- `AGENTS.md`.
