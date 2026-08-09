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

**MO MVP Milestone 4 — Durable Governed Provider Execution and Return**

TASK 029 was approved by merge of PR #48. M4-WP-01 through M4-WP-08 were subsequently implemented in PRs #49 through #56. The merged implementation now contains the domain contracts, owner-specific persistence, provider supply truth, Service Package / Eligibility, explicit Allocation / authenticated Provider Acceptance, Provider Return / Execution evidence receipt components, authenticated Gateway/MGSN transport and an exact-head reliability matrix.

The final M4-WP-08 head and merged `main` baseline have the same implementation tree. On that exact tree, validation, Milestone 4 reliability, Milestone 3 reliability regression, Milestone 2 reliability regression and Browser and Visual Validation all passed.

M4-WP-09 is now performing the independent integration and authority audit. The audit recommendation is currently **FIX**, because the normal durable MGSN process does not yet compose the WP03–WP06 services, the normal Execution runtime does not yet expose the Provider Return evidence-handoff service, and the repository does not yet prove the approved zero-interception Core + Gateway + Execution + MGSN + owner-PostgreSQL provider path through `PENDING_REVIEW` evidence state.

The required remediation is integration-only and must preserve the established locks:

```text
current governed Execution source
-> durable MGSN Service Package
-> deterministic Eligibility
-> explicit Allocation
-> authenticated Provider Acceptance
-> durable Provider Return
-> exact Execution evidence handoff
```

- Provider Supply Capability is not user Capability evidence;
- Provider Return is not Official Truth;
- Payment is not performance, authority, acceptance or completion;
- MGSN Allocation/Acceptance is not automatically legal/professional appointment;
- evidence handoff is not Filing Submission or Formal Matter completion;
- automatic official filing remains outside the MVP authority boundary;
- no cross-service SQL is permitted.

See:

- `docs/planning/MO-MVP-MILESTONE-004-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-004-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-004-IMPLEMENTATION-TRACEABILITY.md`;
- `docs/validation/MO-MVP-MILESTONE-004-RELIABILITY-MATRIX.json`;
- `docs/audits/MO-MVP-MILESTONE-004-INTEGRATION-AUDIT.md`;
- `docs/tasks/MO-MVP-M4-WP-09-INTEGRATION-AUTHORITY-AUDIT.md`.

No Milestone 4 Git tag, GitHub release, deployment freeze, Payment/Invoice authority, legal provider appointment, external Filing or Official Truth is created by the implementation or audit unless a separate explicit owner action and later bounded scope authorizes it.
