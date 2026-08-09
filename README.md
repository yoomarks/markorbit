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

**MO MVP Milestone 4 planning — Durable Governed Provider Execution and Return**

Milestone 3 completed its independent integration/authority audit with a **GO** recommendation. TASK 029 now proposes the next bounded direction: `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`.

The proposed Milestone 4 closes the next missing Beta delivery loop:

```text
current governed Execution source
-> durable MGSN Service Package
-> deterministic Eligibility
-> explicit Allocation
-> authenticated Provider Acceptance
-> durable Provider Return
-> exact Execution evidence handoff
```

The proposal preserves the repository locks:

- Provider Supply Capability is not user Capability evidence;
- Provider Return is not Official Truth;
- Payment is not performance, authority, acceptance or completion;
- MGSN Allocation/Acceptance is not automatically legal/professional appointment;
- automatic official filing remains outside the MVP authority boundary.

See:

- `docs/planning/MO-MVP-MILESTONE-004-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-004-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-004-PLAN.json`;
- `docs/tasks/MO-MVP-TASK-029-MILESTONE-004-SCOPE-LOCK.md`;
- `docs/audits/MO-MVP-MILESTONE-003-INTEGRATION-AUDIT.md` for the predecessor GO evidence.

TASK 029 is planning-only. No Milestone 4 implementation, real provider allocation, Payment, Invoice, legal appointment, external Filing, Git tag, release or deployment freeze occurs until the scope decision is approved and later work packages explicitly implement the bounded capability.
