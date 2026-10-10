# LCR-A2b2a — CN lifecycle Rule Pack owner-evidence truth repair

- **Task ID:** `LCR-A2b2a`
- **Status:** `CONTRACT_FIXTURE_TRUTH_REPAIR / CURRENT_CANDIDATE_INCOMPLETE`
- **Repository:** `yoomarks/markorbit`
- **Baseline:** `d9e3a95a264f11962020a9069cfff0fec6220e9d`
- **Candidate branch:** `CN / CNIPA / TRADEMARK_APPLICATION / FILING_TO_PRELIMINARY_PUBLICATION / basis ANY / source-recorded completed history only`
- **Current evidence result:** nine gates `EVIDENCE_MISSING`; `CURRENT_PRODUCTION_ADMISSION` `EVIDENCE_REJECTED / SOURCE_POLICY_PILOT`
- **Current readiness:** `INCOMPLETE`
- **Current admission consequence:** `NOT_ADMITTED`
- **Expected PR title:** `fix(contracts): ground CN lifecycle readiness in owner evidence`

## 1. Repository and allowed paths

LCR-A2b2a is a bounded contract-fixture and task-record repair. Its allowed paths are:

- `packages/contracts/tests/trademark-lifecycle-rule-pack-readiness-contract.test.ts`;
- `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B1-ADMISSION-READINESS-CONTRACT.md`;
- `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B2A-EVIDENCE-TRUTH-REPAIR.md`.

The task does not change the A2b1 schema or parser. It does not change a Capability definition, Method package, runner, source-admission policy, service bootstrap, persistence owner, API, event, UI or Product workflow.

## 2. Objective and user-visible outcome

The objective is to repair the current CN/CNIPA readiness fixture so that every one of the ten A0 gates reports only evidence that can be attributed to the correct owner and is actually sufficient for that gate.

The A2b1 contract correctly validates assessment shape, normalization, fingerprints, status derivation and false authority consequences. Its parser does not dereference `ExactOwnerReferenceV1`, prove that referenced evidence is reachable, verify that the named owner issued it, or decide that its semantics and currentness satisfy a gate. The A2b1 test's synthetic all-available helper and opaque references are schema fixtures only. They are not evidence that the current CN branch passed those gates.

LCR-A2b2a therefore replaces the misleading five-available/five-blocked current-candidate fixture with the evidence-backed result:

```text
APPLICABILITY                  EVIDENCE_MISSING
EXECUTABLE_METHOD              EVIDENCE_MISSING
LEGAL_SOURCE_PROVENANCE        EVIDENCE_MISSING
FACT_PATH                      EVIDENCE_MISSING
DETERMINISTIC_CONTRACT         EVIDENCE_MISSING
PROFESSIONAL_RESPONSIBILITY    EVIDENCE_MISSING
FIXTURE_MATRIX                 EVIDENCE_MISSING
CURRENT_PRODUCTION_ADMISSION   EVIDENCE_REJECTED / SOURCE_POLICY_PILOT
DEGRADATION                    EVIDENCE_MISSING
FULL_USABLE_OUTPUT_COST        EVIDENCE_MISSING

readiness                      INCOMPLETE
admission consequence          NOT_ADMITTED
```

There is no direct UI change. The later user-visible protection is that a structurally valid but externally unverified reference cannot make an unadmitted lifecycle rail, current position, deadline, recommendation or action appear trustworthy.

## 3. Canonical sources

The repair is bounded by these sources at the stated baseline:

1. `AGENTS.md`, especially the Capability, evidence-owner, authority, service-boundary and minimum-change locks.
2. `docs/product/MO-PRODUCT-CONSTITUTION.md`, which prevents Provider Return, payment, AI output or implementation success from becoming authority or Official Truth.
3. `docs/product/MO-PRODUCT-DECISION-LOG.md`, especially D-039 and D-043: `trademark.lifecycle.project` remains a candidate and the lifecycle scope/admission sequence remains locked.
4. `docs/product/MO-MVP-1.0-ACCEPTANCE.md`, which does not authorize a lifecycle Rule Pack, source promotion or customer-facing lifecycle projection without its exact evidence and owner boundaries.
5. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A0-SCOPE-LOCK.md`, especially the ten-gate Rule Pack admission procedure and the CN/CNIPA first-candidate boundary.
6. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2A-COMPUTATION-CONTRACT.md`, which keeps computation transient and the candidate `NOT_ADMITTED`.
7. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B1-ADMISSION-READINESS-CONTRACT.md`, which defines assessment structure and caps its result at independent-review readiness rather than admission.
8. `packages/contracts/src/trademark-lifecycle.ts`, which owns the A1/A2a/A2b1 contracts and fixed false authority consequences.
9. `packages/contracts/src/brain-method.ts` and `packages/contracts/src/brain-method-activation.ts`, which own exact Method applicability, ACTIVE executable package selection and governed activation.
10. `services/capability-engine/src/executable-method-runtime.ts`, which supplies reusable fail-closed runtime infrastructure but no admitted lifecycle runner.
11. `services/capability-engine/src/current-source-admission.ts` and `services/capability-engine/src/source-admission-policy-catalog.ts`, which own current producer source-use evaluation and classify the exact CN preliminary-publication discovery policy as `PILOT`.
12. `packages/contracts/src/data-engine-discovery.ts` and `services/capability-engine/src/cn-preliminary-publication-discovery-pilot.ts`, which provide candidate observed facts and provenance but not complete lifecycle fact-path or production-use admission.
13. `services/capability-engine/CAPABILITY_PRODUCTION_MATURITY_CHECKPOINT_2026-09-01.md`, which retains the CN discovery and duration implementations as pilots rather than production lifecycle authority.

If those sources disagree, the stricter owner and authority boundary wins. A test helper, repository path, successful execution or self-authored assessment cannot supersede an owner decision.

## 4. Contracts consumed and changed

### 4.1 Consumed without semantic change

LCR-A2b2a consumes:

- `TrademarkLifecycleRulePackAdmissionReadinessV1`;
- `TrademarkLifecycleRulePackAdmissionGateV1`;
- the ten canonical gate codes and their order;
- the four gate evidence states;
- `ExactOwnerReferenceV1` structural identity;
- applicability and assessment fingerprint helpers;
- the two readiness statuses, `INCOMPLETE` and `READY_FOR_INDEPENDENT_ADMISSION_REVIEW`;
- the exact nine permanently false authority consequences.

### 4.2 Changed fixture truth, not the parser

The current CN fixture is changed so it no longer uses synthetic structurally valid references as proof that a gate has real owner evidence. No production contract field, parser rule, status, reason-code namespace or fingerprint algorithm changes.

The boundary is explicit:

```text
A2b1 parser responsibility
= validate closed structure, exact references, normalization,
  fingerprint integrity, gate completeness, readiness derivation
  and fixed false authority

external evidence assessment responsibility
= resolve the reference through its owner boundary, authenticate its issuer,
  verify version/fingerprint/currentness/revocation, and decide whether
  its semantics satisfy the exact gate for the exact applicability
```

`ExactOwnerReferenceV1` is an address-shaped claim, not proof of reachability or sufficiency. A2b2a does not add network, database or service access to the pure parser. Later work must produce the owner evidence; it must not weaken this distinction by teaching a shared parser to guess external state.

## 5. Required behavior

### 5.1 Exact candidate lock

The repaired fixture covers exactly one branch:

```text
jurisdiction: CN
authority: CNIPA
object: TRADEMARK_APPLICATION
operation: PROJECT_TRADEMARK_LIFECYCLE
procedure: FILING_TO_PRELIMINARY_PUBLICATION
basis: ANY
segment: SOURCE_RECORDED_COMPLETED_HISTORY
permitted output: source-recorded filing and preliminary-publication history only
```

It does not cover another jurisdiction, authority, procedure, basis or lifecycle stage. It does not authorize current-position inference, a rule window, deadline or grace period, prediction, recommendation or CTA.

### 5.2 Owner-evidence rule

A gate may become `EVIDENCE_AVAILABLE` only when the assessment can bind exact evidence that:

1. is issued or accepted by the owner responsible for that evidence class;
2. is retrievable through the owner's contract or controlled evidence path;
3. binds the exact applicability, version and fingerprint used by the candidate;
4. proves the complete semantic requirement of that gate rather than a related implementation detail;
5. is current at assessment time and exposes the required expiry, supersession, invalidation or revocation semantics;
6. has not been manufactured by the readiness assessment, its test fixture, an AI response or successful runtime execution.

If evidence does not exist or is incomplete, the gate is `EVIDENCE_MISSING`. If an exact current owner decision affirmatively prevents use, the gate is `EVIDENCE_REJECTED`. If required owner evidence is known to exist but cannot be read or validated at assessment time, the gate is `DEPENDENCY_UNAVAILABLE`. A2b2a does not use `DEPENDENCY_UNAVAILABLE` to soften evidence that has never been produced.

Candidate artifacts may be listed as leads for later work, but they do not make a gate available. In particular:

- A1/A2a schemas do not prove branch-specific deterministic legal behavior;
- the Data Engine observed-fact contract does not prove complete fact-path coverage or production source use;
- the generic executable-method interface does not prove an ACTIVE lifecycle Method or supported runner;
- Matter Draft professional review does not prove lifecycle Rule Pack review;
- unit tests do not prove a production fixture matrix, production currentness or full usable-output cost;
- `READY_FOR_INDEPENDENT_ADMISSION_REVIEW`, if later reached, would still not be admission.

### 5.3 Current ten-gate truth

| Order | Gate                           | Current state and reason                                                             | Evidence truth at baseline                                                                                                                                                                                                                          |
| ----: | ------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | `APPLICABILITY`                | `EVIDENCE_MISSING / EXACT_APPLICABILITY_OWNER_EVIDENCE_MISSING`                      | The task has a bounded candidate tuple, but no owner-issued exact Method applicability/effective-window evidence for the lifecycle Rule Pack. A scope label is not that evidence.                                                                   |
|     2 | `EXECUTABLE_METHOD`            | `EVIDENCE_MISSING / ACTIVE_METHOD_NOT_FOUND, SUPPORTED_RUNNER_NOT_FOUND`             | No exact ACTIVE `TEMPORAL_RESOLUTION` package or admitted lifecycle executable runner exists. Generic Method and runner infrastructure is not branch evidence.                                                                                      |
|     3 | `LEGAL_SOURCE_PROVENANCE`      | `EVIDENCE_MISSING / EXACT_LEGAL_SOURCE_PROVENANCE_MISSING`                           | Candidate fact provenance exists, but no exact lifecycle legal/reference package with effective version and invalidation/currentness semantics is owner-evidenced.                                                                                  |
|     4 | `FACT_PATH`                    | `EVIDENCE_MISSING / EXACT_SCOPE_COMPLETENESS_RECEIPT_MISSING`                        | The V2 discovery pilot is positive candidate evidence only. It does not prove the complete exact-scope distinction among observed, empty, not observed, not covered and unavailable, and it remains pilot use.                                      |
|     5 | `DETERMINISTIC_CONTRACT`       | `EVIDENCE_MISSING / EXACT_BRANCH_DETERMINISTIC_EVIDENCE_MISSING`                     | A1/A2a/A2b1 are strict generic boundaries, but no exact branch Method/rule behavior and lineage package has been produced and owner-evidenced.                                                                                                      |
|     6 | `PROFESSIONAL_RESPONSIBILITY`  | `EVIDENCE_MISSING / CURRENT_REVIEW_RECEIPT_NOT_FOUND, REVOCATION_EVIDENCE_NOT_FOUND` | There is no lifecycle-specific immutable professional-review receipt, reviewer authority, validity/currentness check or revocation path.                                                                                                            |
|     7 | `FIXTURE_MATRIX`               | `EVIDENCE_MISSING / BRANCH_FIXTURE_MATRIX_INCOMPLETE`                                | No owner-bound branch matrix proves positive, historical-rule-version, basis-difference, boundary-day, grace-period, missing, stale, conflict, unavailable and negative-fact behavior.                                                              |
|     8 | `CURRENT_PRODUCTION_ADMISSION` | `EVIDENCE_REJECTED / SOURCE_POLICY_PILOT`                                            | The exact current owner policy `source-admission-policy.cn-preliminary-publication-discovery.v1` classifies source use as `PILOT`. The fixture identifies that owner policy by its exact ID/version and does not manufacture a content fingerprint. |
|     9 | `DEGRADATION`                  | `EVIDENCE_MISSING / EXACT_BRANCH_DEGRADATION_EVIDENCE_MISSING`                       | Generic adverse-state vocabulary exists, but the exact source, Method, reference and review dependency combinations have not been proven to fail closed without fabricating a timeline.                                                             |
|    10 | `FULL_USABLE_OUTPUT_COST`      | `EVIDENCE_MISSING / PRODUCTION_COST_EVIDENCE_MISSING`                                | No production-equivalent end-to-end observation binds usable-output rate, source read, Method execution, latency distribution, attributable cost and failure classes to an approved release envelope.                                               |

The current fixture contains no `EVIDENCE_AVAILABLE` gate. The source-policy rejection retains its exact owner policy ID/version because that owner catalog entry proves rejection, not availability; it deliberately omits a fingerprint that this task has not obtained from a content-addressed owner receipt. Every missing gate has a non-empty reason list and no invented passing reference.

### 5.4 Readiness and authority consequence

The repaired current assessment must derive:

```text
status = INCOMPLETE
```

It must retain all nine authority consequences as `false`:

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

No readiness ID, admission receipt, projection identity, current head or execution receipt is created.

## 6. State transitions

This repair corrects an evidence assertion; it does not mutate a Product, Capability, Method or admission state.

```text
A2b1 current-candidate test representation
  five synthetic EVIDENCE_AVAILABLE gates
  plus five blocked gates

owner-evidence audit
  dereference/sufficiency is not proven by the structural parser

A2b2a current-candidate truth
  nine EVIDENCE_MISSING gates
  plus CURRENT_PRODUCTION_ADMISSION EVIDENCE_REJECTED
  -> INCOMPLETE / NOT_ADMITTED
```

The earlier fixture was not an owner-issued readiness decision, so this correction is not a revocation or downgrade of an admitted state. No admitted state existed.

Future evidence may change a gate only after the exact owner evidence is produced and revalidated. Any missing, rejected, unavailable, expired, superseded, revoked, mismatched or unreachable evidence keeps the overall result `INCOMPLETE`. Ten real `EVIDENCE_AVAILABLE` gates may produce only `READY_FOR_INDEPENDENT_ADMISSION_REVIEW`; only LCR-A2c may consider a separate admission decision.

## 7. UI states

Not applicable. LCR-A2b2a changes no page, route, component, Storybook story, fixture-backed customer view, responsive layout or Playwright journey.

No internal gate label may be exposed as a customer lifecycle position. In particular, `INCOMPLETE`, `EVIDENCE_MISSING`, `EVIDENCE_REJECTED` and `SOURCE_POLICY_PILOT` are readiness evidence states, not filing-office status.

## 8. Events emitted and consumed

None.

The repair is a contract fixture and task record. It emits no domain, outbox, audit, notification, handoff or integration event and consumes no event. A corrected gate state is not a Product event and cannot trigger source promotion, Method activation, projection persistence or external action.

## 9. Acceptance tests

1. The current CN/CNIPA fixture contains exactly the ten A0 gates once each in canonical order.
2. Exactly nine current gates are `EVIDENCE_MISSING`; none is `EVIDENCE_AVAILABLE` or `DEPENDENCY_UNAVAILABLE`.
3. `CURRENT_PRODUCTION_ADMISSION` is exactly `EVIDENCE_REJECTED` with `SOURCE_POLICY_PILOT` and an exact ID/version reference to the current PILOT policy; the fixture does not invent a content fingerprint.
4. The current fixture derives `INCOMPLETE` and cannot parse as `READY_FOR_INDEPENDENT_ADMISSION_REVIEW`.
5. Each missing gate has the explicit reason code or codes recorded in section 5.3 and contains no synthetic passing evidence reference.
6. The source-policy rejection reference proves only rejection; it cannot make `sourceUsePromoted`, `rulePackAdmitted` or any other authority consequence true.
7. The test names and helpers distinguish a synthetic schema-conformance all-available fixture from the current evidence fixture. The former tests only A2b1 parser behavior and is never described as current owner evidence.
8. A structurally valid `ExactOwnerReferenceV1` is not asserted to be reachable, current or semantically sufficient merely because the pure parser accepts it; the task record and current fixture preserve that boundary.
9. The exact candidate applicability remains CN/CNIPA, Trademark Application, filing-to-preliminary-publication, basis ANY and source-recorded completed history only.
10. All nine authority fields remain exactly `false`; the fixture contains no readiness/admission receipt identity, projection identity, current head or execution authority.
11. Existing A2b1 structural coverage remains intact: all ten genuinely available gates are still required for independent-review readiness, malformed assessments fail closed and fingerprints remain deterministic.
12. Existing A1 and A2a tests remain green; no runtime, source policy, persistence or UI behavior changes.

## 10. Validation commands

Run from the dedicated LCR-A2b2a worktree:

```text
pnpm --filter @markorbit/contracts exec vitest run tests/trademark-lifecycle-rule-pack-readiness-contract.test.ts
pnpm --filter @markorbit/contracts lint
pnpm --filter @markorbit/contracts typecheck
pnpm --filter @markorbit/contracts build
pnpm exec prettier --check packages/contracts/tests/trademark-lifecycle-rule-pack-readiness-contract.test.ts docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B1-ADMISSION-READINESS-CONTRACT.md docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B2A-EVIDENCE-TRUTH-REPAIR.md
pnpm validate:workspace
pnpm validate:persistence-boundaries
pnpm task:prepush
```

## 11. Required follow-up order

LCR-A2b2a does not collapse multiple authorities into one PR. Follow-up work proceeds in this order:

1. **LCR-A2b2b — CN exact-scope source-read receipt V3, still PILOT.** Add the source-owner contract and consumer adapters needed to distinguish `OBSERVED`, typed complete exact-scope `EMPTY`, `NOT_OBSERVED`, `NOT_COVERED` and `UNAVAILABLE`, bound to the exact query, snapshot/source version, producer package and fingerprint. MarkOrbit may implement only its contract and consumers; an external Data Engine producer must issue the receipt before `FACT_PATH` can pass. This task cannot promote source use.
2. **LCR-A2b2c — lifecycle Capability/Method/runner candidate and complete fixtures.** Define the exact lifecycle Capability candidate, exact executable `TEMPORAL_RESOLUTION` package and supported runner, then prove the branch matrix and fail-closed degradation. This task may produce candidate evidence; it cannot self-activate the Method or self-admit the Capability.
3. **LCR-A2b2d — professional-review receipt/currentness/revocation boundary.** Add a lifecycle-specific owner contract for named reviewer responsibility, immutable reviewed scope and fingerprints, validity/currentness and explicit supersession/revocation. Existing Matter Draft review cannot be renamed into this evidence.
4. **LCR-A2b2e — production-equivalent latency/cost evidence and source/Method promotion readiness.** Observe the complete source-to-usable-output path against an approved release envelope and assemble exact source-governance and activation evidence for independent review. Historical PILOT policy remains immutable, and this task cannot manufacture a promotion or activation by changing a constant.
5. **LCR-A2c — independent admission review.** Begin only after all ten gates have real, reachable, current and semantically sufficient owner evidence. Revalidate the unchanged applicability and every exact evidence fingerprint. `READY_FOR_INDEPENDENT_ADMISSION_REVIEW` is input to this review, not its decision.

If a follow-up cannot produce its required owner evidence, the affected gate remains missing or rejected and the sequence stops before LCR-A2c. LCR-A3 persistence and A4 UI work remain blocked until a separate LCR-A2c authority admits the exact branch.

## 12. Non-goals

LCR-A2b2a does not:

- admit a Rule Pack, Capability, Method, runner, source, projection or Product workflow;
- create or promote a source-admission policy or change the current CN policy from `PILOT`;
- define, activate or retire a Method package or register a lifecycle runner;
- add network evidence resolution, owner lookups or side effects to the A2b1 pure parser;
- create a professional-review receipt or reuse Matter Draft review under a lifecycle name;
- claim the branch-specific fixture matrix or production full usable-output cost has been completed;
- implement current-position inference, rule windows, deadlines, grace periods, predictions, recommendations, CTA eligibility or Execution behavior;
- create a Capability Canon entry or treat `discovery.cn-preliminary-publication-facts` as `trademark.lifecycle.project`;
- add or change a service, runtime binding, API, event, database table, migration, audit ledger or persistence owner;
- create MarkReg/Lite projection persistence, current head, Gateway composition, UI route, Storybook state or Playwright journey;
- broaden the exact CN/CNIPA candidate to another basis, procedure, authority or jurisdiction;
- treat a file path, test pass, runtime success, AI/agent statement, Provider Return or readiness assessment as owner authority;
- create Official Truth, certify a legal deadline, mutate Product business state or authorize execution.

## 13. Completion and PR boundary

LCR-A2b2a is complete only when the current CN fixture and this record agree on the ten-gate owner-evidence truth, the targeted contract test passes, and the diff contains only the allowed files. Completion preserves:

```text
current readiness = INCOMPLETE
current admission consequence = NOT_ADMITTED
runtime/policy/persistence/UI change = none
```

The PR title is:

```text
fix(contracts): ground CN lifecycle readiness in owner evidence
```
