# M6-WP-03 — Durable Capability Observation Ledger and governed source admission

- **Milestone:** `MO-MVP-MILESTONE-006`
- **Direction:** `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`
- **Base:** `8111e44e99c4800f999a25af0b75b0fd4f78d91c` (M6-WP-02 merged)
- **Status:** `IMPLEMENTING`
- **Owner:** Capability Engine

## Objective

Create private append-oriented Capability Ledger evidence from one exact governed work-outcome source family without converting reviewed work into verified Capability, Canon truth, public ranking, permission truth or protected action authority.

## Initial governed source family

WP-03 intentionally chooses the smallest approved owner-controlled source set:

`Execution Evidence Review Decision`

The source is accepted only through an authenticated internal Execution owner API using the exact:

- `evidenceReviewDecisionId`;
- decision version;
- owner-produced `decisionFingerprintSha256`.

Execution returns the authoritative Workspace, reviewer Principal used as the subject user for this initial family, review timestamp and correlation lineage. Capability Engine does not accept Workspace, subject user, reviewer or provider identity from the admission request body.

This work package does **not** admit:

- raw Provider Return;
- Provider Supply Capability;
- Payment or Invoice state;
- unreviewed task-completion evidence;
- caller-authored Workspace/subject identity;
- AI output as governed work evidence.

## Runtime path

```text
exact accepted Runtime Capability definition/version
-> internal Capability Observation admission command
-> exact Execution Evidence Review Decision locator
-> trusted Execution owner-source HTTP verification
-> owner-derived Workspace + subject user + observedAt
-> Capability Engine-owned durable Capability Observation
-> Capability Engine-owned private append-only Capability Ledger Entry
-> durable admission command replay + append-only admission audit
```

No cross-service SQL is used. Capability Engine never opens the Execution database.

## Persistence

Migration `0045_capability_engine_observation_ledger` is owned by `@markorbit/capability-engine` and adds:

- `capability_observations` — exact runtime Capability version + exact governed owner source;
- `capability_ledger_entries` — private append-only one-to-one evidence entry for each admitted Observation;
- `capability_observation_admission_commands` — durable exact-request idempotency/replay evidence;
- `capability_observation_admission_audit` — append-only `ACCEPTED` / `DENIED` admission evidence.

The Observation business key is unique across exact Runtime Capability identity/version plus exact owner/source ID/version/fingerprint. A second idempotency key for the same exact governed source reuses the existing Observation/Ledger business state.

## Admission API

Capability Engine exposes trusted-internal-only:

`POST /internal/v1/capability-observations/admissions`

Required:

- `MO_INTERNAL_SERVICE_SECRET` via internal authorization header;
- `Idempotency-Key`;
- exact Runtime Capability ID/version;
- exact Execution owner source ID/version/SHA-256 fingerprint.

The request object is exact-key validated. Unsupported identity or authority fields fail closed.

Execution exposes trusted-internal-only read authority:

`GET /internal/v1/capability-observation-sources/evidence-review-decisions/:sourceId/versions/:version`

The request must include the exact expected source fingerprint. Execution validates the current persisted decision before returning owner-controlled source attribution.

## Durability / replay

- exact idempotency key + exact request replays without contacting Execution again;
- exact idempotency key + changed request fails closed;
- a new key for the same exact Runtime Capability/source cannot duplicate Observation or Ledger business state;
- concurrent duplicate-source admissions serialize on a PostgreSQL advisory transaction lock;
- restart/reopen preserves exact Observation/Ledger identity and replay;
- source version/fingerprint mismatch fails closed;
- dependency outage fails closed;
- denied governed source checks append denial audit evidence when persistence is available.

## Permanent authority locks

Every Observation and Ledger Entry preserves the M6 no-authority fixture:

```text
canonicalTruth = false
capabilityVerified = false
publicProfilePublished = false
publicScoreCreated = false
permissionChanged = false
roleChanged = false
providerSupplyCapabilityConverted = false
rawProviderReturnConverted = false
paymentOrInvoiceCreated = false
legalAppointmentCreated = false
filingSubmitted = false
officialTruthCreated = false
externalActionExecuted = false
```

Therefore:

```text
reviewed work evidence != verified Capability
Capability Observation != Capability Canon truth
Capability Ledger != certification
reviewer Principal attribution != permission escalation
Observation admission != external action
```

## Hosted verification

The dedicated `M6 WP-03 Capability Observation Ledger` workflow runs PostgreSQL 16 and proves:

- owner migration validation;
- exact Runtime Capability FK binding;
- owner-derived Workspace/subject attribution;
- caller identity spoof rejection;
- raw Provider Return / Provider Supply source-family rejection;
- exact source version/fingerprint rejection and denial audit;
- dependency-outage fail closed;
- durable replay without owner recontact;
- duplicate-source dedupe across new keys;
- idempotency drift rejection;
- restart/reopen replay;
- concurrent duplicate-source serialization;
- Capability Engine and Execution adapter lint/typecheck;
- zero cross-service database coupling in the implemented path.

## Non-goals

- M6-WP-04 Reflection Candidate generation;
- additional MarkReg Observation source families;
- Capability verification or certification;
- public score/ranking/profile;
- Canon mutation;
- Core role or permission mutation;
- Payment/Invoice;
- professional/legal appointment;
- Filing Submission or Official Truth;
- protected external action.

## Next

After Owner merge only:

`M6-WP-04 — Private Reflection Candidate generation`.
