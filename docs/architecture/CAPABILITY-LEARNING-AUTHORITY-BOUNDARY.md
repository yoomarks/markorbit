# Capability Learning Authority Boundary

- **Milestone:** `MO-MVP-MILESTONE-006`
- **Work package:** `M6-WP-01`
- **Direction:** `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`
- **Runtime mutation:** none

## 1. Purpose

M6-WP-01 freezes the vocabulary and authority consequences for the private Capability learning loop before persistence or product runtime is added.

```text
accepted Capability Canon version
-> Runtime Capability Definition
-> exact governed Capability Observation
-> private append-oriented Capability Ledger Entry
-> explainable private Reflection Candidate
-> explicit subject-user Reflection Disposition
-> deterministic private Capability Profile / Twin projection
```

The loop is evidence-backed reflection. It is not automatic professional verification, certification, ranking, permission escalation or Canon mutation.

## 2. Ownership

| State / responsibility                                            | Owner                                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| User, Workspace, Membership, Session, Principal, permission truth | Core                                                                    |
| accepted Capability Canon                                         | accepted Canon source / owner-governed publication process              |
| runtime Capability Definition/version projection                  | Capability Engine                                                       |
| admitted Capability Observation                                   | Capability Engine after source-owner verification                       |
| private Capability Ledger                                         | Capability Engine                                                       |
| private Reflection Candidate                                      | Capability Engine                                                       |
| Reflection Disposition                                            | Capability Engine; decision authority is the authenticated subject user |
| private Capability Profile / Twin                                 | Capability Engine                                                       |
| professional/review work evidence                                 | Execution                                                               |
| Formal Matter / reviewed lifecycle source context                 | MarkReg                                                                 |
| Provider Return / Provider Supply Capability                      | MGSN                                                                    |
| authenticated transport policy                                    | Gateway                                                                 |
| private product projection/action surface                         | Lite                                                                    |

No service may read another owning service's database. Cross-service evidence moves through bounded authenticated APIs/contracts with exact source identity/version/fingerprint.

## 3. Runtime Capability Definition

A Runtime Capability Definition is an operational projection of an exact accepted Capability Canon identity/version.

It must preserve:

- capability identity and version;
- Canon identity/version/fingerprint;
- bounded Domain -> Capability -> Skill -> Action / Invocation lineage when present;
- immutable lineage to the accepted Canon source.

It must state:

```text
acceptedCanonProjection = true
createdFromWorkEvidence = false
createdFromAiOutput = false
```

Work evidence, Reflection Candidates, user dispositions and AI output cannot create or rewrite accepted Canon truth.

## 4. Observation admission

A Capability Observation is private evidence that governed work related to a Capability occurred. It does not assert proficiency or verification.

M6-WP-01 permits only reviewed owner-controlled source families in the shared contract:

- Execution Professional Review Decision;
- Execution Evidence Review Decision;
- MarkReg reviewed lifecycle source.

The shared contract deliberately excludes MGSN Provider Return and Provider Supply Capability as direct user Capability evidence.

Every Observation carries exact:

- Workspace;
- subject user;
- runtime Capability ID/version;
- source owner/kind/ID/version/fingerprint;
- source Workspace and subject attribution;
- observation time;
- admission time.

Subject attribution must be derived from owner source truth or a trusted Core Principal relationship, never from an unchecked request-body user/provider/reviewer identifier.

## 5. Ledger

Capability Ledger Entries are private, append-oriented records of admitted observations. Ledger history is evidence history, not Capability Canon truth.

Permanent separation:

```text
Ledger evidence != verified Capability
Ledger evidence != certification
Ledger evidence != permission truth
```

## 6. Reflection Candidate

A Reflection Candidate is private and explainable. It references exact Ledger entries and the exact runtime Capability version.

Generation provenance records a deterministic policy version and, when AI assists narrative drafting, the provider/model/model-version/prompt-version provenance.

AI may draft or explain the candidate. AI may not:

- choose/spoof the subject identity;
- admit ungoverned evidence;
- accept/reject/defer the candidate;
- verify Capability;
- mutate Canon;
- alter roles/permissions;
- publish a profile or score;
- execute protected external action.

## 7. Reflection Disposition

Normal Beta authority belongs only to the authenticated subject user.

Allowed outcomes are exactly:

```text
ACCEPTED
REJECTED
DEFERRED
```

The disposition binds one exact current Candidate version/fingerprint. Acceptance means only: include the private reflection in the subject user's private projection.

Permanent separation:

```text
ACCEPTED private reflection != verified professional Capability
ACCEPTED private reflection != canonical Capability truth
```

## 8. Profile and Twin

Capability Profile and Capability Twin are deterministic private read models from durable Ledger/Candidate/Disposition state.

They may expose bounded evidence count, recency, accepted private reflection text and outstanding candidate state.

They must not expose or imply:

- numeric professional score;
- public rating/ranking;
- verified badge/certification;
- autonomous identity;
- autonomous execution authority;
- legal/professional appointment;
- permission truth.

## 9. Authority consequences

The shared contract freezes the following false consequences for observed evidence, Reflection Candidate and accepted private reflection:

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

These are semantic locks, not optional UI wording.

## 10. Non-goals

M6-WP-01 does not implement:

- database migrations or persistence;
- source adapters or Observation admission runtime;
- Reflection generation runtime;
- disposition/profile/twin persistence;
- Gateway routes;
- Lite Capability Center UI;
- automatic Capability verification;
- Capability Canon authoring/publishing;
- public reputation or marketplace features;
- Payment/Invoice;
- legal appointment;
- provider allocation;
- external Filing Submission;
- Official Truth;
- autonomous Twin execution.

## 11. Next boundary

After Owner merge of M6-WP-01, the next dependency-ordered task is:

`M6-WP-02 — Durable runtime Capability Registry and version lineage`.

M6-WP-02 may implement only the runtime definition/version lineage frozen here. It may not infer Canon definitions from work evidence or AI output.
