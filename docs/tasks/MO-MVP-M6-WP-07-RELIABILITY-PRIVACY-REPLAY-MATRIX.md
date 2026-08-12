# M6-WP-07 — Reliability, privacy and replay matrix

- **Milestone:** `MO-MVP-MILESTONE-006`
- **Direction:** `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`
- **Base:** `0551fc49a9adb683463162237f71de8970807020` (latest main after merged M6-WP-06 and Core KV2 PR #91)
- **Scope:** reliability orchestration and exact-head evidence only; no new Capability product authority

## Objective

Prove the exact Milestone 6 implementation tree under durability, replay, privacy, subject isolation, concurrency, dependency failure and browser/runtime stress before the independent M6-WP-08 audit.

WP-07 does not create a new Capability state transition. It makes the existing WP-01 through WP-06 guarantees executable as one exact-head gate.

## Reliability path

```text
accepted Capability Canon projection
-> durable Runtime Capability Registry
-> exact governed Observation admission
-> private append-oriented Capability Ledger
-> versioned private Reflection Candidate
-> exact explicit subject-user disposition
-> deterministic private Capability Profile/Twin
-> authenticated Gateway
-> Lite Capability Center
-> restart / replay / direct URL / desktop + mobile
```

## Executable matrix

The source-controlled inventory is:

- `docs/validation/MO-MVP-MILESTONE-006-RELIABILITY-MATRIX.json`

The aggregate runner is:

- `scripts/run-milestone6-reliability.mjs`

The inventory and zero-interception validators are:

- `scripts/validate-milestone6-reliability-matrix.mjs`
- `scripts/validate-m6-capability-center-no-interception.mjs`

The hosted exact-head workflow is:

- `.github/workflows/milestone-6-reliability.yml`

The hosted gate provisions isolated Capability Engine PostgreSQL databases for Registry, Ledger, Candidate, Disposition/Profile/Twin and browser-runtime evidence. It runs the critical durable suites, authenticated/private HTTP boundaries, Lite projection tests, the static no-interception check, and the desktop/390px real-runtime Capability Center journey. The critical Disposition/Profile/Twin suite is then repeated against the same owner database to prove repeatability rather than one-shot success.

## Required evidence

The matrix covers:

- Capability Engine migration ownership and no cross-service SQL;
- accepted Canon runtime definition/version idempotency, conflict rejection and restart safety;
- exact governed source ID/version/fingerprint verification;
- dependent source outage and stale-source fail-closed behavior;
- raw Provider Return and Provider Supply Capability exclusion;
- trusted Workspace/subject attribution and request-body anti-spoofing;
- private Ledger idempotency/replay;
- Reflection Candidate regeneration, immutable version lineage and stale-anchor handling;
- exact candidate disposition idempotency, stale rejection and concurrent conflict serialization;
- deterministic private Profile/Twin rebuild after recreation/restart;
- Workspace/subject isolation and private not-found redaction;
- authenticated Gateway read/mutation controls including Origin/CSRF and existing permission truth;
- Lite private non-verified presentation;
- zero Playwright request interception/fulfillment in the permanent M6 acceptance path;
- direct URL and reload recovery at desktop `1440x900` and mobile `390x844`;
- exact-head Milestone 2, 3, 4 and 5 reliability regressions plus repository validation and Browser/Visual Validation.

## Privacy boundary

Capability learning remains private by default:

- Core is the source of Session, Workspace Principal, Membership and permission truth;
- Capability Engine derives private subject state from the trusted Principal/source relationships;
- a different subject or Workspace cannot enumerate private candidate/Profile/Twin state;
- Gateway does not accept caller-supplied subject, Workspace, role or permission authority;
- Lite is a private projection/action surface and does not own Capability semantics;
- internal provenance remains bounded and Provider Supply/private network truth is not converted into user Capability truth.

## Permanent authority locks

WP-07 must keep all of these false:

```text
runtime work evidence -> Capability Canon version
Capability Observation -> verified Capability
raw Provider Return -> admitted user Capability evidence
Provider Supply Capability -> admitted user Capability evidence
Reflection Candidate -> canonical truth
ACCEPTED private reflection -> verified Capability
private Profile -> public score / verified badge
Capability Twin -> autonomous identity / execution authority
Capability evidence -> Core role or permission mutation
Payment / Invoice
legal appointment
Filing Submission
Official Truth
protected external action
```

The canonical shorthand remains:

`ACCEPTED private reflection != verified Capability != Capability Canon truth`.

## Exit criteria

M6-WP-07 is complete only when:

1. the final PR head passes the dedicated Milestone 6 reliability workflow;
2. the exact same head passes Milestone 2, 3, 4 and 5 reliability gates;
3. repository validation and Browser/Visual Validation pass on that head;
4. the permanent M6 zero-interception browser path passes at desktop and 390px mobile;
5. no temporary bypass, fixture interception or new product authority is left in the final diff;
6. M6 implementation traceability and Task Index reflect WP-01 through WP-07 accurately.

Only after explicit Owner merge may `M6-WP-08 — Independent integration and authority audit` begin.
