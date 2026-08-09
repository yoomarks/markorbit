# M4-WP-01 — Provider Execution Contracts and Authority Boundary

## Objective

Freeze the minimum shared contract surface for the approved Milestone 4 direction `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`.

WP-01 is a contract/authority work package. It introduces no provider runtime truth, persistence or external action.

## Canonical sources

- `AGENTS.md`;
- `docs/product/MVP-PRODUCT-LOCK.md`;
- `docs/planning/FOUR-WEEK-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-004-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-004-DELIVERY-PLAN.md`;
- existing Filing Authorization / Execution Release / Filing Execution Task Draft / Formal Matter contracts.

Vocabulary audit evidence is recorded in `docs/architecture/PROVIDER-EXECUTION-AUTHORITY-BOUNDARY.md`.

## Implemented contract surface

`packages/contracts/src/provider-execution.ts` defines:

- Provider reference identity bounded to a referenced Core Workspace;
- versioned Provider Supply Capability;
- exact governed Execution source snapshot;
- Service Package;
- deterministic Eligibility Evaluation;
- explicit Allocation;
- separate Provider Acceptance / decline evidence;
- versioned Provider Return with supersession lineage;
- exact Provider Return → Execution Evidence Handoff reference;
- exact-version/fingerprint commands;
- typed provider-execution error vocabulary;
- stage-by-stage authority-consequence fixtures.

The package is exported as `@markorbit/contracts/provider-execution`.

## Authority locks

The following are compile/test-visible invariants:

1. Eligibility does not allocate.
2. Allocation does not equal Provider Acceptance.
3. Provider Acceptance does not equal legal/professional appointment.
4. Provider Return does not equal Official Truth.
5. Evidence Handoff does not equal filing submission or Formal Matter completion.
6. No M4 provider stage implies Payment or Invoice.
7. Provider Supply Capability does not imply user Capability verification.
8. Provider-authenticated response/return payloads do not select their own provider identity.

## Source lineage

Service Package admission preserves exact references for current governed Execution source evidence, including Preparation Lock, Filing Authorization, Execution Release and Filing Execution Task Draft, plus Formal Matter where present, fingerprints and correlation context.

The contract expresses API/reference boundaries only; MGSN may not read MarkReg or Execution databases directly.

## Vocabulary decision

WP-01 freezes object names and semantic separations supported by the approved repository canon. It intentionally does not invent exhaustive enums for provider service types, professional qualification tiers, jurisdiction-specific roles, verification levels or work-status claims where the accepted source material has not defined exact values.

## Acceptance evidence

`packages/contracts/tests/provider-execution-contract.test.ts` verifies:

- bounded status vocabulary contains no paid/filed/official-completion states;
- Core identity references are reused;
- existing Execution/MarkReg ID types remain compatible;
- commands carry expected versions/fingerprints and provider-authenticated response payloads do not carry caller-selected provider identity;
- Provider Return remains evidence/provenance;
- error vocabulary covers staleness, isolation, concurrency and outages;
- every stage preserves false finance/legal/Official-Truth consequences.

## Non-goals

WP-01 does not create:

- PostgreSQL migrations;
- MGSN Provider rows;
- Eligibility runtime logic;
- Allocation or Acceptance runtime state;
- Provider Return runtime state;
- Execution evidence receipts;
- Gateway routes or UI;
- Payment/Invoice;
- legal/professional appointment;
- external filing or trademark-office truth.

## Pull request

Implementation: PR #49 — `M4 WP-01 — Provider execution contracts and authority boundary`.
