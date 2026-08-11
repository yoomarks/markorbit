# M6-WP-02 — Durable runtime Capability Registry and version lineage

- **Milestone:** `MO-MVP-MILESTONE-006`
- **Direction:** `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`
- **Base:** `75c42d1ada4d44f40becf8be3c404877549ed371` (M6-WP-01 merged)
- **Status:** `IMPLEMENTING`
- **Owner:** Capability Engine

## Objective

Replace M6 Capability learning's dependence on the historical in-memory `0.1.0-fixture` request record with a Capability Engine-owned PostgreSQL runtime registry that projects only exact accepted Capability Canon identities and versions.

The legacy `/v1/capability-requests` fixture remains compatibility-only and is explicitly excluded from M6 runtime Capability version lineage.

## Implemented boundary

```text
accepted Capability Canon identity/version/fingerprint
-> authenticated internal import
-> exact normalized definition fingerprint
-> stable Runtime Capability identity
-> immutable Runtime Capability version
-> durable Capability Engine PostgreSQL lineage
```

The runtime definition always persists:

```text
acceptedCanonProjection = true
createdFromWorkEvidence = false
createdFromAiOutput = false
```

No Workspace, subject user, work evidence or AI output is accepted as authority for global accepted runtime definition truth.

## Persistence

Migration `0044_capability_engine_runtime_registry` is owned by `@markorbit/capability-engine` and creates:

- `capability_runtime_identities` — one stable runtime identity per Capability identity;
- `capability_runtime_definitions` — immutable accepted Canon-backed versions;
- `capability_runtime_definition_imports` — durable exact-request idempotency evidence.

The accepted runtime-definition tables intentionally contain no `workspace_id` column. Workspace-private evidence begins only in later M6 work packages.

## Runtime admission rules

- source authority must be exactly `ACCEPTED_CAPABILITY_CANON`;
- exact Capability identity/version is required;
- exact Canon ID/version/source SHA-256 fingerprint is required;
- bounded Domain -> Capability -> Skill -> Action/Invocation lineage is retained when present;
- `lineage.capabilityId` must equal the admitted Capability identity;
- the historical `0.1.0-fixture` version is rejected from M6 lineage;
- unsupported caller fields, including Workspace/subject/AI/work-evidence authority fields, fail closed;
- same idempotency key + same exact request replays;
- same idempotency key + changed request fails closed;
- same Canon identity/version + same exact payload replays without duplicate business state;
- same Canon identity/version + changed payload fails closed;
- a new accepted Canon version increments runtime version while retaining the same runtime identity.

## Internal runtime surface

Capability Engine exposes trusted-internal-only routes:

- `POST /internal/v1/runtime-capabilities/imports`;
- `GET /internal/v1/runtime-capabilities/by-capability/:capabilityId/current`;
- `GET /internal/v1/runtime-capabilities/:runtimeCapabilityDefinitionId/versions/:version`.

These routes require `MO_INTERNAL_SERVICE_SECRET`. Import additionally requires `Idempotency-Key`.

## Verification

The dedicated hosted workflow `M6 WP-02 Capability Registry` runs against PostgreSQL 16 and proves:

- owner migration application;
- accepted Canon import;
- exact idempotent replay;
- same-Canon conflict rejection;
- stable identity with version advancement;
- restart/reopen recovery;
- conflicting concurrent import serialization;
- absence of Workspace-scoped columns from global accepted definition truth;
- legacy fixture/AI/work-evidence/Workspace spoofing rejection in normal unit tests.

The final PR head must also pass repository validation and existing milestone regression workflows triggered by the diff.

## Permanent authority locks

```text
Runtime Capability Definition != work evidence
Runtime Capability Definition != AI output
Runtime Capability Definition != Workspace-private state
Reflection Candidate != canonical truth
accepted private reflection != verified Capability
Provider Supply Capability != user Capability evidence
raw Provider Return != user Capability evidence
no automatic Capability verification
no automatic Capability Canon mutation
no cross-service SQL
no Payment / Invoice / legal appointment / Filing Submission / Official Truth / protected external action
```

## Non-goals

- M6-WP-03 Observation admission or Capability Ledger;
- private subject-user evidence;
- Reflection Candidate generation;
- Reflection Disposition;
- Profile/Twin projection;
- Gateway/Lite Capability Center;
- public ranking or certification;
- Canon authoring/publishing;
- permission mutation;
- external action.

## Next

After Owner merge only:

`M6-WP-03 — Durable Capability Observation Ledger and governed source admission`.
