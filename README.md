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

**MO MVP Milestone 4 — Durable Governed Provider Execution and Return — GO**

TASK 029 was approved by merge of PR #48. M4-WP-01 through M4-WP-08 were implemented in PRs #49 through #56. M4-WP-09 performed an independent integration/authority audit in PR #57 and initially returned `FIX` for three bounded runtime-integration findings. PR #58 remediated all three findings and was merged to `main` as `327b61a22ad800250a2d9babe5997eb5a6a9e8eb`.

The remediation exact-head tree and merged `main` tree are identical: `79efcbe2580e7fa372f0c7f5ebefe6f744216416`. On the exact remediation head, Milestone 4 integration, validation, M4 reliability, M3 reliability regression, M2 reliability regression and Browser/Visual Validation all passed. After merge, `main` independently passed Milestone 4 integration `31323865361`, validation `31323865372` and Browser and Visual Validation `31323865383`.

The post-remediation M4-WP-09 rerun recommends **GO**. The approved durable path is now composed and permanently tested:

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

The established authority locks remain in force:

- Provider Supply Capability is not user Capability evidence;
- Provider Return is not Official Truth;
- Payment is not performance, authority, acceptance or completion;
- MGSN Allocation/Acceptance is not automatically legal/professional appointment;
- evidence handoff is not Filing Submission or Formal Matter completion;
- automatic provider selection and official filing remain outside the M4 authority boundary;
- no cross-service SQL is permitted.

See:

- `docs/planning/MO-MVP-MILESTONE-004-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-004-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-004-IMPLEMENTATION-TRACEABILITY.md`;
- `docs/validation/MO-MVP-MILESTONE-004-RELIABILITY-MATRIX.json`;
- `docs/audits/MO-MVP-MILESTONE-004-INTEGRATION-AUDIT.md`;
- `docs/tasks/MO-MVP-M4-WP-09-INTEGRATION-AUTHORITY-AUDIT.md`.

The GO recommendation closes the approved Milestone 4 engineering scope. It does not itself create a Git tag, GitHub release, deployment freeze, Payment/Invoice authority, legal provider appointment, external Filing or Official Truth. Those remain separate explicit owner actions.
