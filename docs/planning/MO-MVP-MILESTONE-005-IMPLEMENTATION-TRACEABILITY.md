# MO MVP Milestone 5 Implementation Traceability

**Approved direction:** `DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION`  
**Scope approval:** PR #60, merge `0de33333246b66d825b56137f87c32266fb5583c`  
**Current work package:** `M5-WP-08` — independent integration and authority audit  
**Milestone status:** `ENGINEERING_SCOPE_COMPLETE_GO`

The Milestone 5 engineering scope is complete with a final independent **GO** recommendation. PR #70 merged the WP-08 bounded remediation and audit evidence as `242b34f806711df608a7178b238104289e65bb00`; the final documentation head passed all required hosted gates before merge.

## Work package status

- **M5-WP-01 — Evidence review, lifecycle and recommendation contracts plus canonical authority boundary:** `IMPLEMENTED_IN_PR_61`. Evidence: `packages/contracts/src/evidence-lifecycle.ts`, contract tests and authority boundary docs.
- **M5-WP-02 — Durable authenticated Execution Evidence Review Decision and correction-request state:** `IMPLEMENTED_IN_PR_62`. Evidence: migration `0033_execution_evidence_review`, Execution review service/repository and PostgreSQL acceptance tests.
- **M5-WP-03 — Durable MarkReg Lifecycle Projection from exact admitted reviewed sources:** `IMPLEMENTED_IN_PR_64`. Evidence: migration `0034_markreg_lifecycle_projection`, MarkReg lifecycle projection repository/service, PostgreSQL acceptance tests and WP-03 task record.
- **M5-WP-04 — Explainable Recommended Action candidates and acknowledgement/suppression semantics:** `IMPLEMENTED_IN_PR_65`. Evidence: migration `0035_markreg_recommended_actions`, deterministic policy/repository/service, PostgreSQL acceptance tests and WP-04 task record.
- **M5-WP-05 — Retry-safe Execution-to-MarkReg reviewed-evidence handoff and correction/replay loop:** `IMPLEMENTED_IN_PR_66`. Evidence: migration `0036_execution_reviewed_source_handoff`, trusted Execution/MarkReg HTTP bridge, dual-database real-runtime acceptance suite and WP-05 task record.
- **M5-WP-06 — Authenticated Gateway, operations review surface and markreg.com lifecycle/status journey:** `IMPLEMENTED_IN_PR_67`. Evidence: MarkReg lifecycle surface, Execution provenance surface, Gateway lifecycle HTTP boundary, markreg.com `LifecyclePanel`, operations console integration and focused HTTP/UI tests.
- **M5-WP-07 — Migration, restart, replay, isolation, redaction, concurrency and browser reliability matrix:** `MERGED_IN_PR_69`. Merge: `48a3c223a51b381da83d181f9d0cb70bb812a82c`. Evidence: machine-readable reliability matrix, exact-head runner, inventory validator, dedicated hosted workflow and WP-07 task record.
- **M5-WP-08 — Independent Milestone 5 integration and authority audit:** `MERGED_IN_PR_70_AUDIT_GO`. Merge: `242b34f806711df608a7178b238104289e65bb00`. Initial audit returned `FIX` for two bounded integration findings; PR #70 closed them. Final documentation head `4807c4d13759e11b954b896daf4b10aa841700e0` passed all eight hosted gates. Evidence: `docs/audits/MO-MVP-MILESTONE-005-INTEGRATION-AUDIT.{md,json}` and the permanent Milestone 5 integration gate.

## WP-01 canonical contract lock

The shared M5 contract freezes the exact source chain:

```text
Provider Return
-> Evidence Handoff
-> exact Evidence Receipt ID/version/fingerprint
-> explicit Evidence Review Decision
-> exact Reviewed Source Admission
-> MarkReg Lifecycle Event / Current Lifecycle View
-> non-executing Recommended Action
```

The contract keeps these truths separate:

- Evidence Review Decision is not Provider Return or Official Truth;
- `ADMITTED_FOR_INTERNAL_USE` is not Filing Submission or office acceptance;
- Lifecycle Projection is not Official Status;
- Recommended Action is advice and does not authorize or execute the action;
- no Payment/Invoice/legal appointment/automatic Matter completion/user Capability verification follows from M5 internal state.

## WP-02 durable review boundary

Execution owns durable review state over exact M4 evidence receipts:

```text
PENDING_REVIEW receipt
-> authenticated reviewer Principal
-> stable receipt ID/version/fingerprint capture
-> exact freshness check
-> explicit review command
-> ADMITTED_FOR_INTERNAL_USE | CORRECTION_REQUIRED | REJECTED
-> immutable decision + append-only audit
-> optional durable correction request
```

The reviewer identity is taken from the authenticated Principal rather than request-body identity. Review reads require `review:read`; authoritative review decisions require `review:perform`.

The source remains exact and fail-closed: receipt ID/version/fingerprint, Evidence Handoff, Provider Return ID/version/fingerprint, Workspace and correlation lineage are retained. A newer receipt for the same Provider Return lineage makes an older review source stale. Concurrent conflicting decisions cannot both become authoritative, and idempotent retries replay the previously committed result.

`CORRECTION_REQUIRED` creates a separate correction-request record; it does not mutate the historical Provider Return or M4 evidence receipt.

## WP-03 durable lifecycle projection boundary

MarkReg owns durable lifecycle projection over one exact canonical `ReviewedSourceAdmissionEnvelope`:

```text
exact Reviewed Source Admission
-> validate Workspace / admission version / fingerprint / correlation lineage
-> validate exact local Formal Matter ID/version
-> append immutable Lifecycle Event Projection
-> deterministically select Current Lifecycle View
-> durable command replay / exact-admission deduplication
```

Every lifecycle event retains the exact Reviewed Source Admission, Evidence Review Decision, Evidence Receipt, Provider Return and Formal Matter references. MarkReg consumes that bounded envelope through a reader contract and does not read Execution persistence.

Lifecycle events are append-only. The current view is deterministic: later `occurredAt` wins; equal timestamps use explicit lifecycle-state precedence and then stable admission identity. Historical older events remain durable without silently replacing newer current state.

Exact command retries replay the committed event/view result. A second key for the same exact semantic admission reuses the existing event; conflicting semantics for an already-consumed admission fail closed. Cross-Workspace source/read access, admission version/fingerprint mismatch, Formal Matter version mismatch and correlation mismatch fail closed.

`officialStatusVerified` remains fixed to `false`. Lifecycle Projection does not create filing, official application/application-number, office acceptance or Official Truth.

## WP-04 durable Recommended Action boundary

MarkReg evaluates one fixed deterministic policy over the exact current `CurrentLifecycleView`:

```text
exact current Lifecycle View ID/version/fingerprint
-> recommended-action-policy-v1
-> deterministic candidate or no candidate
-> one durable Workspace/Formal Matter action slot
-> OPEN | ACKNOWLEDGED | DISMISSED | SUPPRESSED
-> append-oriented audit + durable command replay
```

`CUSTOMER_ACTION_NEEDED` deterministically yields `CUSTOMER_ACTION_REQUIRED`. `CORRECTION_OR_REVIEW_ISSUE` deterministically yields `REVIEW_CORRECTION_ISSUE`. Other current lifecycle states yield no recommendation candidate. The policy does not infer a due date when governed lifecycle evidence contains none; `timingBasis` explicitly records that no deadline was inferred.

Every persisted recommendation remains bound to the exact source Lifecycle View ID/version/fingerprint and deterministic policy version. A newer lifecycle view makes a prior recommendation stale for first-use status transitions. Re-evaluation against a newer no-action state suppresses the current action; a later actionable lifecycle state regenerates the same stable action slot with a new version and exact new provenance.

Regeneration and status transitions are durable and idempotent. Repository mutation locks the current Lifecycle View before recommendation mutation. Concurrent identical first-use regeneration converges on one business action and one authoritative audit result; exact command retries replay their committed result without authorizing execution.

Customer-safe projection hides internal source fingerprint and policy provenance and omits suppressed actions. Operations-safe reads retain governed provenance. `executionAuthorized` is fixed to `false` in the shared contract and database constraint.

Recommended Action persistence does not contact a trademark office, submit a filing, create Payment/Invoice truth, mutate Official Truth, appoint a legal representative, complete a Formal Matter automatically or verify user Capability. AI output is not accepted as authoritative recommendation persistence input in WP-04.

## WP-05 retry-safe reviewed-source handoff boundary

Execution persists the exact Reviewed Source Admission and one durable sender handoff before any MarkReg network call:

```text
ADMITTED_FOR_INTERNAL_USE review decision
-> exact Reviewed Source Admission
-> durable PENDING sender handoff + stable MarkReg idempotency key
-> trusted Workspace-scoped HTTP
-> MarkReg LifecycleProjectionService
-> DELIVERED response snapshot or retryable PENDING state
```

Receiver unavailability after sender persistence leaves the handoff retryable. Response loss after MarkReg commits is recovered by replaying the same MarkReg idempotency key, so receiver restart and sender restart do not duplicate lifecycle business state. A changed retry payload fails closed and cross-Workspace delivery is rejected at the internal transport boundary.

Correction history remains immutable. `CORRECTION_REQUIRED` decisions cannot be admitted. Corrected newer provider evidence must create a new Evidence Receipt, explicit review decision and distinct Reviewed Source Admission. Once the newer admission is current in MarkReg, replay of an older already-committed handoff returns its stored result and does not replace the newer Current Lifecycle View.

Execution and MarkReg use independent owner databases in the acceptance suite. MarkReg reads the exact reviewed-source envelope through Execution HTTP rather than SQL. The transport retains decision/receipt/Provider Return/Formal Matter/fingerprint/correlation provenance and never creates Filing Submission, Payment/Invoice truth or Official Truth.

## WP-06 authenticated lifecycle surfaces

WP-06 exposes the governed M5 truth through bounded authenticated surfaces without moving semantic ownership into Gateway or UI:

```text
MarkReg Lifecycle Projection / Recommended Action
-> trusted MarkReg lifecycle HTTP surface
-> authenticated Gateway customer lifecycle API
-> customer-safe markreg.com LifecyclePanel

Execution review provenance
-> trusted Execution provenance HTTP surface
-> Gateway operations-only provenance API
-> operations review surface
```

Customer reads receive redacted lifecycle/status/timeline and Recommended Action projections. Internal source fingerprints and provider-return provenance remain outside the customer projection. Operations provenance requires the stronger review permission. Mutations retain authenticated Session/Workspace Principal, Origin/CSRF and exact-version checks; Recommended Action acknowledgement remains a status transition, not execution authorization.

## WP-07 exact-head reliability gate

WP-07 adds no new product state. It composes the existing M5 contract, PostgreSQL acceptance, retry/restart, concurrency, isolation, HTTP/UI and real-runtime browser tests into one mandatory exact-head evidence chain.

The machine-readable inventory is `docs/validation/MO-MVP-MILESTONE-005-RELIABILITY-MATRIX.json`. `scripts/run-milestone5-reliability.mjs` refuses a checkout that does not match `M5_EXPECTED_HEAD_SHA`, runs the focused groups, repeats critical durable suites against the same owner databases and writes `.artifacts/milestone-5-reliability-evidence.json`. `.github/workflows/milestone-5-reliability.yml` provisions separate Execution and MarkReg PostgreSQL databases and installs Chromium for the existing desktop/mobile real-runtime Playwright path.

The gate explicitly preserves the permanent M5 authority consequences: review is not Official Truth, admission is not Filing Submission, lifecycle projection is not Official Status, Recommended Action is not execution authority, and no Payment/Invoice/legal appointment/automatic completion/Capability verification/cross-service SQL is introduced.

## WP-08 independent integration and authority audit

The independent audit initially returned `FIX` for two bounded integration gaps: the approved Operations review workflow was not operable through the governed browser/API boundary, and the real MarkReg lifecycle handoff did not compose the already-implemented deterministic Recommended Action regeneration.

PR #70 remediated only those approved-scope gaps. Operations now runs an explicit human-governed sequence over real Core identity and Execution persistence: `PENDING_REVIEW queue -> exact source capture -> explicit review/correction -> explicit Reviewed Source Admission -> explicit lifecycle handoff`. The MarkReg handoff regenerates a Recommended Action only when the newly projected event is the current Lifecycle View. Reviewer identity is derived from the authenticated Workspace Principal, actor spoofing is rejected, correlation lineage is preserved, and no cross-service SQL is introduced.

A permanent zero-interception gate, `.github/workflows/milestone-5-integration.yml`, starts Core, Execution, MarkReg and Gateway with separate Core/Execution/MarkReg PostgreSQL databases and proves the complete M5 path plus the correction-not-admissible branch. The audited code head `f79002d81329de2ae80c777e391f1b025f014e79` passed Milestone 5 integration `31447652716`, Milestone 5 reliability `31447652734`, validation `31447652680`, Browser and Visual Validation `31447652689`, Milestone 4 integration `31447652685`, Milestone 4 reliability `31447652678`, Milestone 3 reliability `31447652687` and Milestone 2 reliability `31447652705`.

The re-audit recommendation is **GO**. Evidence Review remains internal governed truth, admission remains non-filing, Lifecycle Projection remains non-official, Recommended Action remains non-executing, and no Payment/Invoice/legal appointment/automatic completion/Capability verification/external filing/Official Truth is introduced.

## Ownership boundary

- Core owns identity, Workspace, Session, Principal and permission truth.
- Execution owns evidence receipts, Evidence Review Decisions, correction provenance and Reviewed Source Admission.
- MGSN continues to own Provider Return.
- MarkReg owns Formal Matter, lifecycle projection and Recommended Action.
- Gateway/UI do not become semantic owners.
- no cross-service SQL is permitted.

## AI boundary

AI may summarize evidence, highlight inconsistencies, draft review notes, explain lifecycle state and suggest Recommended Action candidates. AI may not record authoritative review decisions, admit reviewed sources, execute Recommended Actions, submit filings or create Official Truth.

## Audit outcome and next milestone

M5-WP-08 is merged with a final **GO** recommendation. Final PR head `4807c4d13759e11b954b896daf4b10aa841700e0` passed Milestone 5 integration `31448370214`, Milestone 5 reliability `31448370139`, validation `31448370194`, Browser and Visual Validation `31448370136`, Milestone 4 integration `31448370159`, Milestone 4 reliability `31448370144`, Milestone 3 reliability `31448370168` and Milestone 2 reliability `31448370132` before merge.

There is no additional implementation work package inside Milestone 5. The next proposed owner decision is TASK 031A / Milestone 6 scope approval for `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`. No M6 runtime work starts before that planning proposal is approved by merge.
