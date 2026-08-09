# Evidence Review and Lifecycle Authority Boundary

## Status

Milestone 5 WP-01 contract lock for `DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION`.

This document records the canonical vocabulary, ownership and AI-authority decisions implemented by `packages/contracts/src/evidence-lifecycle.ts`.

## Governing sources

The contract is constrained by:

- `AGENTS.md`;
- `docs/product/MVP-PRODUCT-LOCK.md`;
- `docs/planning/FOUR-WEEK-PLAN.md`;
- approved Milestone 5 scope and delivery plan;
- Milestone 4 Provider Return and Execution evidence-handoff contracts;
- the existing MarkReg Formal Matter boundary.

## Canonical vocabulary

Milestone 5 freezes the following shared terms:

- Evidence Review Source;
- Evidence Receipt;
- Evidence Review Decision;
- Reviewed Source Admission;
- Lifecycle Projection Source;
- Lifecycle Event Projection;
- Current Lifecycle View;
- Recommended Action.

These terms are deliberately distinct from Provider Return, Filing Submission, trademark-office acceptance and Official Truth.

## Evidence Review Source

An Evidence Review Source identifies one exact Execution-owned reviewable receipt and preserves the exact M4 Provider Return provenance beneath it.

The shared source identity carries:

- Workspace identity;
- Evidence Receipt ID/version/fingerprint;
- Evidence Handoff ID;
- Provider Return ID/version/fingerprint;
- Provider ID;
- correlation identity and capture time.

The Evidence Receipt is a distinct review object. It is not the Provider Return itself and does not certify any Provider assertion.

## Evidence Review Decision

Execution owns Evidence Review Decision truth.

The canonical outcomes are:

- `ADMITTED_FOR_INTERNAL_USE`;
- `CORRECTION_REQUIRED`;
- `REJECTED`.

A recorded decision binds the exact Evidence Review Source plus the authenticated reviewer Principal recorded by the owning runtime.

The mutation command intentionally does not accept caller-selected reviewer identity. Runtime code must resolve reviewer authority from authenticated Principal/permission context.

An `ADMITTED_FOR_INTERNAL_USE` decision means only that the exact reviewed evidence may be used by bounded downstream internal product logic. It does not mean:

- the Provider Return is Official Truth;
- a trademark office was contacted;
- a filing occurred;
- an application or application number exists;
- an office accepted anything;
- a Formal Matter is completed.

`CORRECTION_REQUIRED` and `REJECTED` remain review outcomes against immutable evidence lineage. Later correction must preserve historical Provider Return and receipt provenance.

## Reviewed Source Admission

Reviewed Source Admission is the exact cross-service envelope that may pass from Execution to MarkReg after an admissible review decision.

It binds:

- one exact Evidence Review Decision ID/version/fingerprint;
- the exact Evidence Review Source;
- one exact Formal Matter reference;
- the admitted evidence references;
- an admission fingerprint and correlation identity.

Admission is not Filing Submission, office acceptance, Official Truth or Matter completion.

Execution owns review/admission truth. MarkReg consumes the bounded envelope; it does not read the Execution database.

## Lifecycle Projection

MarkReg owns lifecycle projection truth.

The minimum frozen lifecycle states are:

- `INTERNAL_PROCESSING`;
- `REVIEWED_PROVIDER_EVIDENCE`;
- `CUSTOMER_ACTION_NEEDED`;
- `WAITING_NO_ACTION`;
- `CORRECTION_OR_REVIEW_ISSUE`.

Each Lifecycle Event Projection retains exact source provenance through Reviewed Source Admission, Evidence Review Decision, Evidence Receipt, Provider Return and Formal Matter references.

`officialStatusVerified` is fixed to `false` for this M5 internal reviewed-evidence contract. A future official-source subsystem must use a separate governed source-of-truth architecture rather than reinterpret this field.

Current Lifecycle View is a deterministic MarkReg read model derived from durable lifecycle events. It is not a second source of external-office truth.

## Recommended Action

Recommended Action is MarkReg-owned advisory state derived from one exact Current Lifecycle View and policy version.

The frozen record statuses are:

- `OPEN`;
- `ACKNOWLEDGED`;
- `DISMISSED`;
- `SUPPRESSED`.

The action record preserves source lifecycle version/fingerprint, policy version, explanation and optional timing basis.

`executionAuthorized` is fixed to `false` in the M5 contract. Creating, displaying, acknowledging or dismissing a Recommended Action does not authorize or execute the underlying action.

## Ownership lock

- **Core** owns User, Workspace, Membership, Session, Principal and permission truth.
- **Execution** owns Evidence Receipt, Evidence Review Decision, correction provenance and Reviewed Source Admission.
- **MGSN** continues to own Provider Return and provider-network truth.
- **MarkReg** owns Formal Matter, Lifecycle Event Projection, Current Lifecycle View and Recommended Action records.
- **Gateway/UI** are authenticated transport and projection surfaces only.

No service may read another service's database. Cross-service transfer uses exact IDs, versions, fingerprints and bounded contracts.

## Authority consequence lock

The shared fixtures make the following consequences test-visible:

| Internal stage | May become true | Must remain false automatically |
| --- | --- | --- |
| Evidence Review Decision | review decision recorded | Provider Return certification, Payment/Invoice, legal appointment, Filing Submission, Official Truth, Matter completion, Capability verification |
| Reviewed Source Admission | reviewed source admitted | all external/financial consequences and office truth |
| Lifecycle Projection | lifecycle projection created | official application/application-number/office acceptance truth and automatic completion |
| Recommended Action | recommendation created | recommendation execution, protected external action, Payment/Invoice, legal appointment, filing, Official Truth |

No M5 internal state means paid, invoiced, professionally appointed, filed, officially accepted, officially registered or completed.

## AI authority lock

AI may:

- summarize evidence;
- highlight inconsistencies;
- draft review notes;
- explain lifecycle state;
- suggest Recommended Action candidates.

AI may not:

- record the authoritative Evidence Review Decision;
- admit a reviewed source;
- certify a Provider Return;
- execute a Recommended Action;
- submit a filing;
- contact a trademark office as verified action;
- create Official Truth;
- create Payment/Invoice truth;
- complete a Formal Matter;
- automatically verify user Capability.

The contract exports an explicit AI-authority fixture so these boundaries are test-visible rather than documentation-only.

## Typed failure vocabulary

The shared contract reserves controlled failures for:

- stale source;
- source version/fingerprint mismatch;
- permission/policy denial;
- idempotency and version conflict;
- non-admissible review decision;
- lifecycle source not admitted;
- stale recommendation source;
- owner persistence outage;
- bounded dependency outage.

Later runtime work must map implementation failures into these semantics rather than expose database/transport details as domain truth.

## Deliberately not canonized in WP-01

WP-01 does not invent exhaustive enums for:

- jurisdiction-specific review reason taxonomies;
- every lifecycle event code;
- every Recommended Action code;
- every deadline/reminder policy;
- external trademark-office status vocabulary.

Those remain bounded strings or later governed policies until an approved source defines the taxonomy.

## WP-01 non-goals

WP-01 creates no:

- database migration;
- durable review decision;
- durable lifecycle event/view;
- durable Recommended Action;
- Gateway route or UI;
- Payment/Invoice behavior;
- legal/professional appointment;
- provider allocation/acceptance;
- external filing;
- trademark-office Official Truth;
- automatic Formal Matter completion;
- automatic Capability verification.
