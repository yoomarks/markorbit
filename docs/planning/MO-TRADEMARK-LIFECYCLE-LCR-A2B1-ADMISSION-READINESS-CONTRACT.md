# LCR-A2b1 — Trademark Lifecycle Rule Pack admission-readiness contract

- **Task ID:** `LCR-A2b1`
- **Status:** `CONTRACT_ONLY / CURRENT_CANDIDATE_INCOMPLETE`
- **Repository:** `yoomarks/markorbit`
- **Baseline:** `8c045b629a5177590a3cfc736135b499c9c54038`
- **Candidate branch:** `CN / CNIPA / TRADEMARK_APPLICATION / FILING_TO_PRELIMINARY_PUBLICATION / basis ANY / source-recorded completed history only`
- **Current readiness:** `INCOMPLETE`
- **Current admission consequence:** `NOT_ADMITTED`
- **Highest status defined here:** `READY_FOR_INDEPENDENT_ADMISSION_REVIEW`
- **Expected PR title:** `feat(contracts): add lifecycle Rule Pack readiness boundary`

## 1. Repository and allowed paths

This is a bounded shared-contract task. Its allowed paths are:

- `packages/contracts/src/trademark-lifecycle.ts`;
- `packages/contracts/tests/trademark-lifecycle-rule-pack-readiness-contract.test.ts`;
- `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B1-ADMISSION-READINESS-CONTRACT.md`.

No policy, Method package, runtime, persistence, service, API, fixture-backed UI or product workflow may be changed by this task.

## 2. Objective and user-visible outcome

LCR-A2b1 defines the smallest deterministic contract for assessing whether the evidence for one exact Trademark Lifecycle Rule Pack branch is complete enough to be sent to an independent admission review.

The contract prevents evidence collection from being confused with admission. Its highest possible result, `READY_FOR_INDEPENDENT_ADMISSION_REVIEW`, means only that all ten A0 evidence gates have evidence available for a separate reviewer. It does not admit a Rule Pack, promote a source, activate a Method, verify a Capability, authorize projection persistence or create any business, legal or execution authority.

This task has no direct user-visible UI change. Its later user-visible protection is fail-closed behavior: an incomplete candidate cannot produce a plausible-looking lifecycle rail, current position, legal deadline, recommendation or preparation action.

The current CN/CNIPA filing-to-preliminary-publication candidate remains:

```text
readiness status = INCOMPLETE
admission consequence = NOT_ADMITTED
```

## 3. Canonical sources

This contract is bounded by the following repository sources at the stated baseline:

1. `AGENTS.md`, especially the Capability, authority, owner and task-scope locks.
2. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A0-SCOPE-LOCK.md`, especially section 10 and its ten-gate Rule Pack admission procedure.
3. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2A-COMPUTATION-CONTRACT.md`, especially the first-candidate audit and its `NOT_ADMITTED` consequence.
4. `packages/contracts/src/trademark-lifecycle.ts`, which owns the accepted A1 semantic/read boundary and A2a transient computation contracts.
5. `packages/contracts/src/brain-method.ts`, which owns `MethodApplicabilityV1`, the `TEMPORAL_RESOLUTION` Method family and ACTIVE executable-package selection semantics.
6. `services/capability-engine/src/executable-method-runtime.ts`, which fails closed when an exact executable kind has no admitted runner.
7. `services/capability-engine/src/source-admission-policy-catalog.ts`, whose current exact policy classifies CN preliminary-publication discovery as `PILOT` rather than `PRODUCTION_ADMISSIBLE`.
8. `packages/contracts/src/data-engine-discovery.ts`, which supplies candidate CN filing/preliminary-publication fact fields and provenance but does not itself admit lifecycle use.

No text in this task record overrides those sources. Repository evidence may be superseded only by a later exact, current and independently reviewed source/version; a changed file name, passing test or successful execution cannot silently promote evidence.

## 4. Contracts consumed and changed

### 4.1 Consumed

LCR-A2b1 reuses without redefining:

- `MethodApplicabilityV1` for the exact candidate scope;
- `ExactOwnerReferenceV1` for evidence references;
- the A0 ten-gate order and meanings;
- the A1 authority boundary;
- the A2a separation between transient computation and MarkReg projection identity/retention;
- current Brain Method lifecycle and executable-runner fail-closed behavior;
- current Capability source-use policy as the owner of production source-use admission.

### 4.2 Added shared contract

The task adds the strict, renderer-independent `TrademarkLifecycleRulePackAdmissionReadinessV1` assessment contract and its parser/fingerprint helpers. Its exact top-level fields are:

```text
schemaVersion
assessedAt
applicability
applicabilityFingerprintSha256
gates
status
assessmentFingerprintSha256
authority
```

The contract intentionally has no `readinessId`, admission ID, receipt ID or other receipt identity. `assessedAt` is assessment time, and `assessmentFingerprintSha256` proves normalized content integrity; neither is a durable admission receipt or identity. Evidence references identify their existing owner evidence only and do not turn the readiness assessment into an owner decision.

No A1 projection/read or A2a computation field changes meaning. In particular, the readiness assessment has no projection ID/version/head, no Capability execution receipt and no persistence authority.

## 5. Required behavior

### 5.1 Exact applicability and fingerprints

- `schemaVersion` is exactly `1`.
- `assessedAt` is a valid instant and records when the evidence set was assessed.
- `applicability` is a strict `MethodApplicabilityV1`; the assessment cannot use a looser country-only or authority-only scope.
- `jurisdictions`, `authorities`, `procedures` and `filingBases` each contain exactly one value, so one assessment cannot create blanket readiness across multiple A0 branches.
- `applicabilityFingerprintSha256` binds the complete normalized applicability, including jurisdiction, authority, object, operation, procedure, stages, basis, segment, required data and effective window.
- `assessmentFingerprintSha256` binds the complete normalized assessment other than that fingerprint itself, including applicability, all gate results, status and the false authority object.
- A changed applicability, evidence reference, reason, gate state, assessment time, status or authority field changes the assessment fingerprint.
- Gates normalize into A0 order, while exact evidence references and reason codes normalize into deterministic order. Reordering the same semantically unordered entries does not create a different assessment.
- Unknown fields, duplicate values where the owner contract requires uniqueness, malformed references and fingerprint drift fail closed.

### 5.2 Ten gates, exactly once and in A0 order

`gates` contains exactly the following ten codes once each and normalizes them into this A0 order:

1. `APPLICABILITY`
2. `EXECUTABLE_METHOD`
3. `LEGAL_SOURCE_PROVENANCE`
4. `FACT_PATH`
5. `DETERMINISTIC_CONTRACT`
6. `PROFESSIONAL_RESPONSIBILITY`
7. `FIXTURE_MATRIX`
8. `CURRENT_PRODUCTION_ADMISSION`
9. `DEGRADATION`
10. `FULL_USABLE_OUTPUT_COST`

Every gate contains exactly:

```text
gateCode
state
evidenceReferences
reasonCodes
```

The allowed evidence states are:

- `EVIDENCE_AVAILABLE` — the gate has at least one exact owner evidence reference and no reason code;
- `EVIDENCE_MISSING` — required evidence does not yet exist or is incomplete;
- `EVIDENCE_REJECTED` — exact current owner evidence affirmatively prevents the gate from passing;
- `DEPENDENCY_UNAVAILABLE` — required owner evidence cannot currently be read or validated.

Every non-available state has at least one stable reason code. It may retain exact references that prove the missing, rejected or unavailable conclusion. A file path, free-text assertion, placeholder receipt, fixture-only object or execution success is not a substitute for exact owner evidence.

### 5.3 Readiness derivation

Only two readiness statuses exist:

- `INCOMPLETE`;
- `READY_FOR_INDEPENDENT_ADMISSION_REVIEW`.

The derivation is closed and deterministic:

```text
all ten gates are EVIDENCE_AVAILABLE
-> READY_FOR_INDEPENDENT_ADMISSION_REVIEW

any gate is EVIDENCE_MISSING, EVIDENCE_REJECTED or DEPENDENCY_UNAVAILABLE
-> INCOMPLETE
```

`READY_FOR_INDEPENDENT_ADMISSION_REVIEW` is not an admission state. This contract deliberately defines no `ADMITTED` result and no transition from readiness to admission. A separate admission authority must revalidate the exact evidence, currentness and unchanged fingerprints and issue its own independently governed decision before any branch may become active.

### 5.4 Fixed authority boundary

Every assessment carries exactly these consequences, all permanently `false`:

```text
rulePackAdmitted: false
sourceUsePromoted: false
methodActivated: false
capabilityVerified: false
projectionPersistenceAuthorized: false
productBusinessStateCreated: false
officialTruthCreated: false
legalDeadlineCertified: false
executionAuthorized: false
```

Missing, additional or `true` authority fields are invalid. A readiness result cannot be composed with another non-authorizing result to manufacture authority.

## 6. A0 ten-gate mapping and current evidence

| Order | Gate code                      | A0 evidence requirement                                                                                                                         | Current CN/CNIPA candidate evidence and boundary                                                                                                                                                                                                                                                                                                  |
| ----: | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | `APPLICABILITY`                | Exact jurisdiction, authority, object, operation, procedure, basis, stages, effective window and required inputs.                               | The candidate tuple is bounded to CN/CNIPA, Trademark Application, filing-to-preliminary-publication, basis ANY and source-recorded completed history only. That label is not by itself complete Method applicability evidence; exact required inputs and effective applicability must be supplied by the candidate Method evidence.              |
|     2 | `EXECUTABLE_METHOD`            | One exact ACTIVE `TEMPORAL_RESOLUTION` executable Method package, strict schemas, unambiguous selection and a supported runner.                 | No exact ACTIVE temporal Method package exists for this branch, and no lifecycle executable runner is registered. The generic runtime interface is reusable infrastructure, not runner admission.                                                                                                                                                 |
|     3 | `LEGAL_SOURCE_PROVENANCE`      | Exact Knowledge/source references and versions, effective dates, invalidation trigger and exact materialized dependencies for any rule/window.  | The Data Engine discovery contract carries fact provenance, but no complete exact lifecycle legal/reference package, effective rule version and invalidation path has been admitted for this branch. Source-recorded historical dates cannot be promoted into rule windows or deadlines.                                                          |
|     4 | `FACT_PATH`                    | Exact source owner plus strict distinction among observed empty, not observed, not covered and unavailable.                                     | `CN_CASE_CURRENT_PRELIMINARY_PUBLICATION_DISCOVERY_V2` supplies candidate filing/preliminary-publication facts and provenance. This is candidate fact-path evidence only; it does not override its `PILOT` source-use policy or prove complete lifecycle coverage.                                                                                |
|     5 | `DETERMINISTIC_CONTRACT`       | Strict inputs/outputs, stable reason codes, coverage, limitations, fallback and lineage.                                                        | A1 and A2a provide strict generic semantic and transient-computation boundaries. The exact branch still needs the complete admitted Method/rule behavior and lineage; a self-consistent transient object is not branch admission.                                                                                                                 |
|     6 | `PROFESSIONAL_RESPONSIBILITY`  | Named review role, exact review receipt, reviewed-timing boundary and currentness/revocation path.                                              | No exact lifecycle Rule Pack professional-review receipt, review-currentness contract or revocation path exists. Existing professional-review objects for other workflows cannot be relabelled or used as placeholders.                                                                                                                           |
|     7 | `FIXTURE_MATRIX`               | Positive, historical-rule-version, basis-difference, boundary-day, grace-period, missing, stale, conflict, unavailable and negative-fact cases. | The A1/A2a negative semantic tests are reusable, but the branch-specific A0 fixture matrix remains incomplete. In particular, generic parser tests do not prove historical rule versions, basis differences, boundary/grace behavior or production source degradation.                                                                            |
|     8 | `CURRENT_PRODUCTION_ADMISSION` | Method/package/reference/source-use admission and currentness valid at selection, computation, persistence, read and handoff time.              | The current exact source policy `source-admission-policy.cn-preliminary-publication-discovery.v1` is `PILOT`. Therefore this gate is `EVIDENCE_REJECTED` with reason `SOURCE_POLICY_PILOT`; it cannot become available by renaming the pilot or citing successful pilot execution. Missing Method and review currentness are additional blockers. |
|     9 | `DEGRADATION`                  | Unsupported branches fail closed to partial, limited/manual, not covered or unavailable without an invented timeline.                           | A1 defines the generic adverse-state vocabulary, but exact branch degradation behavior and fixtures remain to be proven with the source, Method, reference and review dependencies together. No fallback may fabricate a current position.                                                                                                        |
|    10 | `FULL_USABLE_OUTPUT_COST`      | Observed production latency and full usable-output cost within an approved release envelope.                                                    | No production source-read latency plus end-to-end full usable-output cost evidence exists for this branch. Unit-test or isolated computation duration is not usable-output cost evidence.                                                                                                                                                         |

The table is an evidence inventory, not an admission decision. The exact current serialized assessment must include all ten gate objects. Its known source-use rejection and the other identified missing evidence force `status: INCOMPLETE`; the branch remains `NOT_ADMITTED`.

## 7. Current CN candidate lock

The only candidate assessed by this task is:

```text
jurisdiction: CN
authority: CNIPA
object: TRADEMARK_APPLICATION
procedure: FILING_TO_PRELIMINARY_PUBLICATION
basis: ANY
permitted semantic scope: source-recorded completed history only
```

Current positive evidence is limited to candidate filing/preliminary-publication facts, provenance and the reusable generic A1/A2a contract boundaries. It does not support a current procedural position, Rule Pack window, legal deadline or grace period, prediction, recommendation, CTA or projection.

Current blockers are explicit:

- source use remains `PILOT`, so `CURRENT_PRODUCTION_ADMISSION` is `EVIDENCE_REJECTED` with `SOURCE_POLICY_PILOT`;
- there is no exact ACTIVE `TEMPORAL_RESOLUTION` Method package and no admitted lifecycle runner;
- there is no exact professional-review receipt with currentness and revocation semantics for this Rule Pack;
- the required branch-specific fixture matrix is incomplete;
- there is no observed full usable-output cost and production latency admission.

Consequently:

```text
current readiness = INCOMPLETE
current branch = NOT_ADMITTED
projection persistence = prohibited
runtime exposure = prohibited
```

## 8. State transitions

The assessment is a pure, content-addressed evaluation, not a mutable product state machine:

```text
exact evidence snapshot changes
-> re-read all ten owner evidence gates
-> validate exact applicability
-> derive all gate states
-> derive readiness status
-> calculate a new assessment fingerprint
```

Allowed readiness transitions are recomputation results only:

```text
INCOMPLETE
-> INCOMPLETE

INCOMPLETE
-> READY_FOR_INDEPENDENT_ADMISSION_REVIEW
   only when every gate is EVIDENCE_AVAILABLE

READY_FOR_INDEPENDENT_ADMISSION_REVIEW
-> INCOMPLETE
   when evidence is missing, rejected, unavailable, expired, revoked or changed
```

There is no transition to `ADMITTED`. Assessment does not create, activate, promote, persist, supersede or revoke a Rule Pack, Method, source policy, Capability, projection, Work, Matter, professional review or Execution object. A separate reviewer must revalidate current evidence; an earlier ready assessment cannot be replayed after any bound evidence or applicability changes.

## 9. UI states

Not applicable. LCR-A2b1 adds no page, route, component, Storybook fixture, responsive behavior or Playwright journey. It does not replace the current HIFI lifecycle fixtures or expose internal readiness evidence to a customer.

A future administrative review UI, if approved, must treat `INCOMPLETE`, dependency unavailability and independent-review readiness as evidence states, never as customer lifecycle position or admission. That future UI is outside this task.

## 10. Events emitted and consumed

None.

The assessment is a pure shared contract. It emits no outbox/integration event, consumes no event, creates no notification and triggers no admission, persistence, handoff or external action. A gate becoming available is evidence change, not a product or integration event.

## 11. Acceptance tests

1. A complete schema-version-1 assessment with the exact eight top-level fields parses and reproduces both fingerprints.
2. The parser rejects any readiness/admission/receipt identity field, projection identity, current-head field or unsupported extra field.
3. Applicability uses strict `MethodApplicabilityV1`; its jurisdiction, authority, procedure and basis axes are single-value, and any applicability change invalidates both its applicability fingerprint and the containing assessment fingerprint.
4. The gate list contains exactly the ten A0 codes once each and returns them in canonical order; missing, duplicate or unknown gates fail closed, while input order alone has no semantic effect.
5. `EVIDENCE_AVAILABLE` requires at least one exact evidence reference and no reason code.
6. `EVIDENCE_MISSING`, `EVIDENCE_REJECTED` and `DEPENDENCY_UNAVAILABLE` each require at least one reason code; malformed or placeholder evidence references are rejected.
7. Only ten `EVIDENCE_AVAILABLE` gates permit `READY_FOR_INDEPENDENT_ADMISSION_REVIEW`; any blocked gate requires `INCOMPLETE`.
8. No input can produce `ADMITTED`, promote source use, activate a Method, verify a Capability or authorize projection persistence.
9. The current CN/CNIPA fixture remains `INCOMPLETE`; `CURRENT_PRODUCTION_ADMISSION` is `EVIDENCE_REJECTED` with `SOURCE_POLICY_PILOT` while the exact source policy is `PILOT`.
10. The authority object contains exactly the nine fixed false fields; any missing, additional or true authority consequence is rejected.
11. Tampering with assessment time, applicability, gate state, evidence/reference content, reason-code content, readiness status or authority invalidates the assessment fingerprint; semantically unordered collections normalize deterministically.
12. Existing A1 projection/read and A2a computation contract tests remain green and their authority/persistence boundaries do not change.

## 12. Validation commands

Run from the dedicated LCR-A2b1 worktree:

```text
pnpm --filter @markorbit/contracts lint
pnpm --filter @markorbit/contracts typecheck
pnpm --filter @markorbit/contracts test
pnpm --filter @markorbit/contracts build
pnpm format:check
pnpm task:prepush
```

## 13. Non-goals

LCR-A2b1 does not:

- admit the CN candidate or any other Rule Pack;
- promote `PILOT` source use or change a source-admission policy;
- create or activate a Brain Method/package, lifecycle runner, Capability Definition/Profile or Capability Canon entry;
- implement legal rules, rule windows, deadline/grace calculations, current-position inference, predictions, recommendations or CTA eligibility;
- create a professional-review receipt, choose a reviewer or invent currentness/revocation semantics;
- complete the missing fixture matrix or manufacture production cost evidence;
- create a readiness/admission receipt identity, Registry, database table, migration, API route, event or audit ledger;
- authorize or implement MarkReg projection persistence/current head, Gateway composition, Lite UI, Work/Matter mutation or Execution;
- modify policy, Method, runtime, persistence or UI code;
- cover USPTO, EUIPO, IPOS, IPOPHL or any CN procedure outside the exact candidate tuple;
- create Official Truth, certify a legal deadline, authorize execution or mutate Product business state.

An independently governed admission task may begin only after an assessment reaches `READY_FOR_INDEPENDENT_ADMISSION_REVIEW` on exact current evidence. Even then, that status supplies material for review and remains `NOT_ADMITTED` until the separate authority decision is complete.
