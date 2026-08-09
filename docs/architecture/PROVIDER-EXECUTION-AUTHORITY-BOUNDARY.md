# Provider Execution Authority Boundary

## Status

Milestone 4 WP-01 contract lock for `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`.

This document records the vocabulary audit and semantic decisions used by the shared contract in `packages/contracts/src/provider-execution.ts`.

## Canon and accepted repository vocabulary reviewed

The WP-01 contract is constrained by the accepted repository canon in `AGENTS.md`, the MVP Product Lock, the Four-week Beta Plan, the Milestone 4 scope lock/delivery plan and the already-implemented Execution filing-governance contracts.

The following terms are accepted and therefore safe to freeze as cross-service object vocabulary:

- Provider;
- Provider Supply Capability;
- Service Package;
- Eligibility Evaluation;
- Allocation;
- Provider Acceptance / decline;
- Provider Return;
- Evidence Handoff;
- Filing Authorization;
- Execution Release;
- Filing Execution Task Draft;
- Formal Matter;
- Workspace / Principal;
- Channel / Relationship Model;
- Official Truth.

The following semantic statements are mandatory:

- Provider Supply Capability is private supply-side operational evidence, not user Capability evidence.
- Eligibility is deterministic suitability truth, not Allocation.
- Allocation is internal MGSN operational assignment truth, not Provider Acceptance.
- Provider Acceptance is the provider's authenticated response to an Allocation, not legal/professional appointment and not office acceptance.
- Provider Return is structured provider claim/evidence, not Official Truth.
- Evidence Handoff creates reviewable internal evidence transfer only; it does not complete Formal Matter or create filing truth.
- Payment is not performance, authority, acceptance or completion.
- AI may recommend or compare eligible options but cannot create Allocation, Provider Acceptance, certification or Official Truth.

## Deliberately not canonized in WP-01

The accepted repository material does not yet provide a complete canonical taxonomy for every provider service type, qualification tier, verification level, jurisdiction-specific provider role or work-status claim.

WP-01 therefore does **not** invent authoritative enums for those concepts. The shared contract keeps these values as bounded strings/references until a later work package has an approved source for the exact vocabulary.

This prevents an implementation convenience from silently becoming product canon.

## Identity boundary

`ProviderReference` contains an MGSN Provider ID plus a referenced Core Workspace identity. It is not a second user/organization identity model.

Core remains owner of identity, Workspace, Membership and authenticated Principal truth. MGSN owns provider-network operational truth only.

Provider-authenticated commands such as Allocation response and Provider Return intentionally do not accept caller-selected provider identity in their command payload. Runtime implementations must bind the provider from authenticated Principal/provider context.

## Exact source lineage

A Service Package admits one exact governed Execution source snapshot. The contract carries versioned references for:

- Formal Matter where present;
- Preparation Lock;
- Filing Authorization;
- Execution Release;
- Filing Execution Task Draft;
- document and instruction references;
- execution window;
- Channel / Relationship Model where applicable;
- source fingerprint and correlation ID.

MGSN receives these through bounded APIs. Cross-service database reads remain prohibited.

## State separation

### Service Package

`ADMITTED`, `STALE`, `CANCELLED` describe MGSN source admission only.

### Eligibility

`ELIGIBLE` / `INELIGIBLE` describe deterministic suitability only. Evaluation cannot create Allocation.

### Allocation

`ACTIVE`, `CANCELLED`, `SUPERSEDED` describe the internal assignment decision only. Acceptance is a separate record.

### Provider Acceptance

`ACCEPTED` / `DECLINED` describe the provider response only. They do not create payment, legal appointment, filing submission or office acceptance.

### Provider Return

`CURRENT` / `SUPERSEDED` describe provider evidence lineage. Corrections are represented by new versioned/superseding evidence, not destructive mutation of history.

## Authority consequences

The contract includes explicit stage fixtures proving the following boundaries:

| Explicit internal stage | May become true | Must remain false automatically |
| --- | --- | --- |
| Service Package | `servicePackageCreated` | Payment, Invoice, legal appointment, filing/Official Truth, Matter completion, user Capability verification |
| Eligibility | `eligibilityEvaluated` | Allocation and all external/financial consequences |
| Allocation | `providerAllocated` | Provider Acceptance, legal appointment and all external/financial consequences |
| Provider Acceptance | `providerAccepted` | Provider Return, legal appointment and all external/financial consequences |
| Provider Return | `providerReturnCreated` | Evidence Handoff, filing/Official Truth, Matter completion |
| Evidence Handoff | `executionEvidenceHandedOff` | filing/Official Truth, Matter completion, Payment/Invoice, user Capability verification |

No WP-01 state is equivalent to paid, invoiced, professionally appointed, filed, officially accepted or completed.

## Typed failure vocabulary

The shared error vocabulary reserves explicit failures for:

- stale source/version/fingerprint;
- permission/policy denial;
- idempotency and optimistic-version conflict;
- missing/suspended provider or inactive Supply Capability;
- provider ineligibility;
- competing active Allocation;
- stale Allocation;
- provider identity mismatch;
- superseded Return;
- owner persistence or dependency outage.

Later work packages must map their runtime errors to these bounded semantics rather than expose database or transport implementation details as domain truth.

## WP-01 non-goals

WP-01 creates no:

- database migration;
- durable Provider record;
- real Eligibility evaluation;
- Allocation;
- Provider Acceptance;
- Provider Return;
- Evidence Handoff;
- Gateway route or UI;
- Payment/Invoice behavior;
- legal/professional appointment;
- external filing;
- trademark-office truth.
