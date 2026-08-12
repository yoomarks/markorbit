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

**Product Loop Closure is complete with GO in PR #83. Milestone 6 WP-01 through WP-07 are merged; M6-WP-08 independent integration and authority audit is the current engineering task in PR #93, with final GO pending explicit Owner merge.**

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

PR #73 established the Product Loop Closure stage, and PLC-WP-08 completed it with a GO recommendation in PR #83. The sequencing gate is closed; M6 runtime implementation subsequently resumed.

The Product Loop Closure stage exists to prove the canonical Lite mainline as a real Product loop:

```text
Today
-> traceable Recommendation
-> Prepared Action
-> explicit User Confirmation
-> Product / Workflow Handoff
-> Outcome / Feedback
```

At least one acceptance journey must close Content and Opportunity into existing work:

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

### Approved Milestone 6 — Durable Capability Learning and Private Reflection

PR #71 merged as `ce5e845ee8350341d478ad5372ac1ccbaffe4fb4`, approving TASK 031A and the direction `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`.

M6-WP-01 through M6-WP-07 are merged. M6-WP-08 in PR #93 independently audited the integrated runtime, found and repaired one bounded real-Execution-source acceptance gap, and records a final **GO** recommendation pending exact-head validation and explicit Owner merge.

The approved M6 loop is:

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

M6 approval is preserved. Only its execution precedence changed:

```text
M1-M5 governed execution backbone
-> Product Loop Closure
-> resume approved M6-WP-01 after Product Loop Closure GO
```

See:

- `docs/audits/MO-MVP-PRODUCT-LOOP-CONFORMANCE-AUDIT.md`;
- `docs/planning/MO-MVP-PRODUCT-LOOP-CLOSURE-PLAN.md`;
- `docs/architecture/PRODUCT-LOOP-AUTHORITY-BOUNDARY.md`;
- `docs/tasks/MO-MVP-PLC-WP-01-PRODUCT-MAINLINE-CONTRACTS-OWNERSHIP.md`;
- `docs/planning/MO-MVP-MILESTONE-006-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-006-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-006-PLAN.json`;
- `docs/planning/MO-MVP-MILESTONE-005-IMPLEMENTATION-TRACEABILITY.md`;
- `docs/audits/MO-MVP-MILESTONE-005-INTEGRATION-AUDIT.md`;
- `AGENTS.md`.
