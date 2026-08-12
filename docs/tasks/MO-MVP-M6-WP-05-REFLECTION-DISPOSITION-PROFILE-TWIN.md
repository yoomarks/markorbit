# MO MVP M6-WP-05 — Explicit Reflection Disposition and private Profile/Twin projection

- **Milestone:** `MO-MVP-MILESTONE-006`
- **Work package:** `M6-WP-05`
- **Status:** `IMPLEMENTING`
- **Base:** merged M6-WP-04 main `16b9e368ac5026b1dbd4560ecd7d2459c370e240`
- **Owner:** Capability Engine

## Objective

Allow one authenticated Core Workspace Principal to explicitly accept, reject or defer one exact current private Reflection Candidate and deterministically project the subject user's private Capability Profile and Capability Twin from Capability Engine-owned persistence.

## Runtime path

```text
Core Workspace Principal
-> exact current Reflection Candidate ID / version / SHA-256
-> explicit subject-user ACCEPTED | REJECTED | DEFERRED
-> immutable Reflection Disposition
-> deterministic private Capability Profile
-> deterministic private Capability Twin
```

No Gateway or Lite product surface is added in WP-05. M6-WP-06 remains responsible for controlled browser/API exposure.

## Implemented boundary

- migration `0047_capability_engine_reflection_disposition_profile_twin` is Capability Engine-owned;
- request-body Workspace, subject identity and authority fields are rejected;
- trusted internal HTTP receives the existing Core `WorkspacePrincipal` envelope and requires matching Workspace context;
- normal Beta disposition authority is the exact candidate subject user only;
- mutations bind exact Candidate ID, version and SHA-256 fingerprint;
- only the latest candidate in one subject/runtime Capability learning line may be dispositioned;
- `ACCEPTED`, `REJECTED` and `DEFERRED` are the only supported consequences;
- one exact Candidate version has at most one authoritative disposition;
- PostgreSQL advisory locking serializes competing subject dispositions;
- exact-request idempotency and same-business-state replay are durable;
- Candidate and Ledger history remain immutable;
- Profile and Twin are rebuilt from durable Ledger/Candidate/Disposition owner state, not caller claims;
- deterministic state fingerprints prevent duplicate projection versions for unchanged owner state;
- Profile/Twin can rebuild after process/database restart.

## Projection semantics

Private Capability Profile may expose:

- exact Runtime Capability ID/version;
- governed evidence count;
- latest evidence time;
- accepted private reflection references and text;
- current outstanding candidate when no disposition exists or the current candidate is deferred;
- exact subject-private authority consequences.

Private Capability Twin aggregates the subject's latest private Capability Profile projections deterministically. It remains a read model, not an autonomous identity or execution actor.

## Permanent authority locks

Every disposition, Profile and Twin preserves:

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

Additional permanent meanings:

- `ACCEPTED private reflection != verified professional Capability`;
- `ACCEPTED private reflection != Capability Canon truth`;
- `REJECTED` or `DEFERRED` does not erase Candidate/Ledger evidence;
- Profile has `numericProfessionalScore = null` and `verifiedBadge = false`;
- Twin has `autonomousIdentity = false` and `autonomousExecutionAuthority = false`;
- no Core role, permission or Membership mutation;
- no public score/rating/ranking/certification;
- no Payment/Invoice, legal appointment, Filing Submission, Official Truth or protected external action;
- no cross-service SQL.

## Executable acceptance

The dedicated PostgreSQL gate proves:

- exact accepted candidate -> immutable disposition -> private Profile/Twin;
- exact idempotency replay and same-business-state replay;
- non-subject and cross-Workspace principals fail private/not-found;
- fingerprint mismatch fails closed;
- body identity/authority spoofing fails closed;
- stale Candidate version fails closed after a newer candidate exists;
- concurrent conflicting disposition commands produce one authoritative winner only;
- rejection/defer retain Ledger/Candidate history and never create verification;
- deferred current candidate remains outstanding;
- deterministic Profile/Twin rebuild after database restart;
- M6-WP-02, WP-03 and WP-04 durable regressions remain green against isolated PostgreSQL databases.

## Non-goals

WP-05 does not implement:

- Gateway Capability routes;
- Lite Capability Center;
- public Capability profile or ranking;
- Capability verification/certification;
- Capability Canon mutation;
- AI-authored or AI-decided disposition;
- Payment/Invoice;
- legal appointment;
- Filing Submission;
- Official Truth;
- autonomous Twin execution;
- protected external action.

## Next

After explicit Owner merge of M6-WP-05, the dependency-ordered next work package is:

`M6-WP-06 — Authenticated Gateway and Lite Capability Center`.
