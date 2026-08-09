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

## Current milestone

**MO MVP Milestone 5 — planning proposed: Durable Evidence Review and Lifecycle Projection**

Milestone 4 completed its approved engineering scope with an independent **GO** recommendation after the PR #58 integration remediation and M4-WP-09 rerun. The durable provider path now ends at an Execution-owned `PENDING_REVIEW` evidence receipt:

```text
current governed Execution source
-> durable MGSN Service Package
-> deterministic Eligibility
-> explicit Allocation
-> authenticated Provider Acceptance
-> durable Provider Return
-> exact Execution evidence handoff
-> durable PENDING_REVIEW evidence receipt
```

TASK 030A now proposes the next bounded milestone direction:

```text
PENDING_REVIEW evidence
-> explicit authorized Evidence Review Decision
-> correction OR admitted reviewed source
-> retry-safe Execution-to-MarkReg handoff
-> durable MarkReg Lifecycle Projection
-> customer-safe status / timeline / evidence view
-> explainable Recommended Action
```

This is a planning proposal only. Implementation must not start until the owner approves the scope by merging the planning PR.

The proposed Milestone 5 authority locks are:

- Evidence Review Decision is internal review truth, not trademark-office acceptance or Official Truth;
- Provider Return remains evidence, not Official Truth;
- customer lifecycle status is a projection of governed internal truth, not a hidden official-status source;
- Recommended Action is advice, not authorization or execution;
- no Payment/Invoice truth follows from review or lifecycle state;
- no automatic legal/professional appointment, provider allocation, external Filing Submission, Formal Matter completion or user Capability verification is introduced;
- no cross-service SQL is permitted.

See:

- `docs/tasks/MO-MVP-TASK-030A-MILESTONE-005-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-005-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-005-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-005-PLAN.json`;
- `docs/audits/MO-MVP-MILESTONE-004-INTEGRATION-AUDIT.md`.

TASK 030A is planning/architecture only. It does not create a database migration, review decision, lifecycle state, Recommended Action, Git tag, GitHub release, deployment freeze, Payment/Invoice authority, legal appointment, external Filing or Official Truth.
