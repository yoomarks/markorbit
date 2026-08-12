# M6-WP-04 — Private Reflection Candidate generation

- **Milestone:** `MO-MVP-MILESTONE-006`
- **Direction:** `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`
- **Base:** `368241f5d366ac7dfd9b038e7fb3bc7be3f5d1c6` (M6-WP-03 merged)
- **Status:** `IMPLEMENTING`
- **Owner:** Capability Engine

## Objective

Generate explainable private Reflection Candidates from exact Capability Ledger evidence without converting a candidate into verified Capability, accepted reflection, Capability Canon truth, public ranking, permission truth or protected action authority.

## Generation policy

WP-04 deliberately starts with deterministic policy rather than AI generation:

`m6-private-reflection-deterministic-v1`

The policy consumes only Capability Engine-owned durable state:

- one exact Ledger anchor;
- the complete current private Ledger snapshot for the anchor's Workspace, subject user and exact Runtime Capability version;
- the exact accepted Runtime Capability definition/version.

Workspace, subject-user identity, Capability verification state and authority consequences are not accepted from the request body.

The generated narrative states only bounded private-Ledger facts and explicitly preserves that the result is not verification, certification or canonical truth.

## Runtime path

```text
exact private Capability Ledger anchor
-> derive Workspace + subject user + exact Runtime Capability version from owner persistence
-> acquire subject/runtime generation lock
-> re-read the complete current private Ledger snapshot
-> deterministic policy/version + exact Ledger references
-> immutable private Reflection Candidate version
-> candidate SHA-256 fingerprint
-> durable command replay + generation audit
```

No AI provider is called in WP-04. Therefore there is no model/prompt provenance to persist yet; the deterministic `policyVersion` is the complete generation provenance for this path.

## Persistence

Migration `0046_capability_engine_reflection_candidates` is owned by `@markorbit/capability-engine` and adds:

- `capability_reflection_candidates` — immutable private candidate versions with exact Runtime Capability, policy, Ledger-snapshot and candidate fingerprints;
- `capability_reflection_candidate_ledger_entries` — exact ordered Ledger provenance for each candidate;
- `capability_reflection_generation_commands` — durable exact-request idempotency/replay evidence;
- `capability_reflection_generation_audit` — append-only generation/reuse evidence.

Candidate `version` is monotonic per Workspace + subject user + exact Runtime Capability version. A genuinely changed current Ledger snapshot generates a new candidate ID at the next version. The old candidate remains immutable. The same exact snapshot and policy reuses the existing candidate rather than duplicating business state.

## Generation API

Capability Engine exposes trusted-internal-only:

`POST /internal/v1/reflection-candidates/generations`

Required:

- `MO_INTERNAL_SERVICE_SECRET` via internal authorization header;
- `Idempotency-Key`;
- exact `ledgerEntryId` only.

The request is exact-key validated. Caller-supplied Workspace, subject user, verification, permission, role, provider or other authority fields fail closed.

## Durability / regeneration

- exact idempotency key + exact request replays the original candidate;
- exact idempotency key + changed Ledger anchor fails closed;
- a new key over the same current Ledger snapshot reuses the same candidate;
- a new governed Ledger entry produces a new immutable candidate version;
- regenerating from an older anchor still resolves the complete current subject/runtime Ledger snapshot and therefore cannot overwrite a newer candidate with stale evidence;
- concurrent generation for one subject/runtime serializes with a PostgreSQL advisory transaction lock;
- restart/reopen preserves candidate identity, fingerprint and command replay;
- candidate Ledger references and source fingerprints remain exact and durable;
- separate subject histories remain isolated.

## Permanent authority locks

Every Reflection Candidate preserves:

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
Reflection Candidate != accepted private reflection
Reflection Candidate != verified Capability
Reflection Candidate != Capability Canon truth
candidate generation != Core role/permission mutation
candidate generation != public profile/ranking/certification
candidate generation != protected external action
```

## Hosted verification

The dedicated `M6 WP-04 Private Reflection Candidate` workflow uses PostgreSQL 16 and proves:

- Capability Engine migration ownership;
- exact Runtime Capability and Ledger provenance;
- deterministic policy provenance;
- candidate authority flags remain false;
- same-snapshot business dedupe across idempotency keys;
- changed Ledger snapshot appends candidate version history;
- old candidate immutability;
- older-anchor regeneration resolves current Ledger state rather than overwriting newer state;
- caller identity/authority spoof rejection;
- idempotency drift rejection;
- concurrent generation serialization;
- restart/reopen replay;
- subject isolation;
- M6-WP-02 Runtime Registry and M6-WP-03 Observation Ledger PostgreSQL regression suites.

## Non-goals

- M6-WP-05 Reflection disposition;
- accepted private reflection;
- Capability Profile/Twin projection;
- AI-authored reflection generation;
- Capability verification or certification;
- public score/ranking/profile;
- Capability Canon mutation;
- Core role/permission mutation;
- Payment/Invoice;
- legal/professional appointment;
- Filing Submission or Official Truth;
- protected external action.

## Next

After Owner merge only:

`M6-WP-05 — Explicit Reflection Disposition and private Profile/Twin projection`.
