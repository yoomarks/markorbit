# LCR-A2b2d — CN Lifecycle Rule Pack review evidence boundary

- **Task ID:** `LCR-A2b2d`
- **Status:** `CONTRACT_ONLY / OWNER_EVIDENCE_NOT_ISSUED / NOT_ADMITTED`
- **Repository:** `yoomarks/markorbit`
- **Baseline:** `3f30643e387d2bd2942707f1a3d5052018b0e67c`
- **Candidate branch:** `CN / CNIPA / TRADEMARK_APPLICATION / FILING_TO_PRELIMINARY_PUBLICATION / basis ANY / source-recorded completed history only`
- **Rule-assessment owner:** MarkReg
- **Current professional-responsibility evidence:** `EVIDENCE_MISSING`
- **Current admission consequence:** `NOT_ADMITTED`
- **Expected PR title:** `feat(contracts): define lifecycle Rule Pack review evidence`

## 1. Repository and allowed paths

LCR-A2b2d is a bounded shared-contract task. Its allowed paths are exactly:

- `packages/contracts/package.json`;
- `packages/contracts/src/trademark-lifecycle-rule-pack-review.ts`;
- `packages/contracts/tests/trademark-lifecycle-rule-pack-review.test.ts`; and
- `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B2D-RULE-PACK-REVIEW.md`.

Those paths must be declared during fresh bootstrap. This task must not modify a service, candidate
runner, runtime registration, source policy, persistence owner, API, event, UI or Product workflow.

## 2. Objective and user-visible outcome

The objective is to define the smallest MarkReg-owned rule-assessment evidence boundary for the
exact CN Lifecycle Rule Pack candidate. The boundary has exactly three owner objects:

1. an immutable Rule Pack review receipt;
2. an immutable revocation decision; and
3. an exact-time currentness readback.

These are Lifecycle Rule Pack rule-assessment objects. They are not Execution
`ProfessionalReviewCase` objects and do not review a Matter Draft, filing package or protected
action.

The contract must prevent these false equivalences:

- structural validity is not proof that MarkReg issued an object;
- a review receipt is not proof that reviewer authority or reviewed scope remains current;
- `ACCEPTABLE_FOR_INDEPENDENT_ADMISSION_REVIEW` is not Rule Pack admission;
- review of source-recorded completed history is not certification of a legal deadline; and
- a currentness result is not a reusable snapshot or timeless runtime dependency.

There is no direct customer-facing change. The later user-visible protection is fail-closed
degradation: missing, rejected, superseded, revoked, expired, authority-invalid, scope-changed,
unavailable or integrity-failed review evidence cannot support a plausible-looking Lifecycle Rail.
Until real owner-issued evidence and all other gates exist, Lite, Gateway and MarkReg projection
persistence cannot treat the CN candidate as admitted or current Product truth.

## 3. Canonical sources

This task is governed by:

1. `AGENTS.md`, especially owner authority, Capability evidence, protected-action and
   cross-service contract rules.
2. `docs/product/MO-PRODUCT-CONSTITUTION.md`.
3. D-039 and D-043 in `docs/product/MO-PRODUCT-DECISION-LOG.md`.
4. `docs/product/MO-VERSION-ROADMAP.md` and
   `docs/product/MO-MVP-1.0-ACCEPTANCE.md`.
5. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A0-SCOPE-LOCK.md`, especially its ownership
   matrix and ten-gate Rule Pack admission procedure.
6. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2A-COMPUTATION-CONTRACT.md` and
   `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2A1-ADVERSE-UNKNOWN-CONTRACT-REPAIR.md`,
   which preserve exact computation lineage but do not authenticate Rule Pack review evidence.
7. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B1-ADMISSION-READINESS-CONTRACT.md`,
   whose `PROFESSIONAL_RESPONSIBILITY` gate remains missing.
8. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B2A-EVIDENCE-TRUTH-REPAIR.md`, which
   orders this task after source-receipt and candidate-runner work and before production evidence
   and independent admission.
9. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B2B-SOURCE-READ-RECEIPT-V3.md`, whose
   Data Engine receipt is a separate owner object and remains external and `PILOT`.
10. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B2C-CANDIDATE-RUNNER.md` and
    `packages/contracts/src/brain-cn-trademark-lifecycle-history.ts`, which lock the candidate to
    source-recorded completed history and keep current-position, future, deadline, prediction,
    recommendation, action and persistence authority false.
11. `packages/contracts/src/trademark-lifecycle.ts`, including `ExactOwnerReferenceV1`, the
    readiness authority constants and the existing lifecycle semantic vocabulary.

MarkReg owns professional lifecycle semantics and the Rule Pack rule-assessment objects in this
task. Core continues to own reviewer identity, membership and authority. Execution continues to own
its distinct preparation and protected-action review workflow. No owner is transferred or copied.

## 4. Contracts consumed and changed

### 4.1 Consumed without semantic change

LCR-A2b2d reuses:

- `ExactOwnerReferenceV1` with a required fingerprint for exact candidate, reviewer, authority,
  successor and revocation references;
- the fixed CN applicability fingerprint, Method reference and executable-package reference from
  the LCR-A2b2c candidate;
- the exact lifecycle semantics `SOURCE_RECORDED_COMPLETED_HISTORY_ONLY`, `SOURCE_RECORDED` and
  `RECORDED_FACT`;
- `noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1` as the minimum false-authority
  boundary; and
- existing deterministic browser-safe fingerprint infrastructure.

The task does not change `TrademarkLifecycleComputationInputV1`, the A2b1 readiness parser, the
candidate Method/package or any runtime interface.

### 4.2 Added contract module

The shared module defines:

- `TrademarkLifecycleRulePackReviewReceiptV1`;
- `TrademarkLifecycleRulePackReviewRevocationV1`;
- `TrademarkLifecycleRulePackReviewCurrentnessV1`;
- strict parsers, deterministic fingerprint helpers and exact-reference helpers for those objects;
  and
- closed outcome, revocation-reason and currentness-result vocabularies.

The module defines no repository, producer, network reader, cache, runtime dependency resolver or
admission command.

### 4.3 Receipt boundary

The immutable receipt contains only the bounded evidence needed for this rule assessment:

- contract/schema version, fixed owner `MARKREG`, fixed receipt kind, receipt ID/version and receipt
  fingerprint;
- exact candidate:
  - applicability fingerprint;
  - exact Method reference with fingerprint; and
  - exact executable-package reference with fingerprint;
- `reviewedBoundary`, containing exactly:
  - `resultSemantics = SOURCE_RECORDED_COMPLETED_HISTORY_ONLY`;
  - `timeAssertionClass = SOURCE_RECORDED`; and
  - `timePresentationMeaning = RECORDED_FACT`;
- `reviewedScopeFingerprintSha256`, deterministically derived from the exact candidate and exact
  three-field reviewed boundary;
- exact Core-owned reviewer-principal and professional-review-authority references, each with a
  fingerprint; the object remains a Rule Pack assessment rather than an Execution review case;
- `reviewedAt`;
- `expiresAt: string | null`;
- an exact `supersedesReceiptReference` or `null`;
- outcome `ACCEPTABLE_FOR_INDEPENDENT_ADMISSION_REVIEW` or `REJECTED`;
- stable reason codes consistent with the outcome; and
- the fixed false-authority consequences in section 5.5.

The receipt has no `validFrom`, `validUntil`, mutable currentness field,
`materializedReferenceDependencies`, runtime dependency list or open extension bag.

`expiresAt: null` means only that the receipt has no scheduled expiry time. It does not mean that
the receipt is permanently current. A non-null `expiresAt` must be later than `reviewedAt`.

`ACCEPTABLE_FOR_INDEPENDENT_ADMISSION_REVIEW` means that the exact candidate and reviewed boundary
were acceptable material for a later independent admission review. `REJECTED` means they were not.
Neither outcome admits a Rule Pack or satisfies another gate.

### 4.4 Revocation boundary

Revocation is a separate immutable MarkReg object, never a mutation of the receipt. It contains:

- fixed owner/kind, revocation ID/version and deterministic revocation fingerprint;
- the exact target receipt reference and fingerprint;
- `revokedAt`;
- exact Core-owned revoking-principal and revoking-authority references;
- one closed reason code; and
- the same fixed false-authority consequences.

The closed revocation reasons are `GOVERNANCE_WITHDRAWAL`, `REVIEW_DEFECT`,
`REVIEWER_AUTHORITY_INVALIDATED` and `REVIEWED_SCOPE_INVALIDATED`. There is no generic `OTHER`
reason.

Revocation cannot predate the target receipt's `reviewedAt`. Parsing a revocation proves shape and
integrity only; it does not authenticate MarkReg or the referenced Core authority.

### 4.5 Currentness boundary

Currentness is one MarkReg-owned common envelope plus one closed discriminated result union. The
common envelope contains:

- contract/schema version and fixed owner/kind;
- the exact requested receipt reference and fingerprint;
- exact `asOf`;
- one result branch; and
- fixed false-authority consequences; and
- an observation ID plus deterministic currentness fingerprint over the entire envelope and result.

The result union is exactly:

- `CURRENT`;
- `SUPERSEDED`;
- `REVOKED`;
- `EXPIRED`;
- `REVIEWER_AUTHORITY_NOT_CURRENT`;
- `REVIEWED_SCOPE_CHANGED`;
- `NOT_FOUND`;
- `UNAVAILABLE`; or
- `INTEGRITY_FAILURE`.

There is no currentness TTL, `validUntil`, `freshUntil`, observation reuse window or implicit cache
permission. `asOf` is the exact consumer evaluation time. A currentness result produced for another
instant cannot be reused as if it answered the new instant.

The union carries only evidence required by its branch:

- `CURRENT` binds the exact head receipt, reviewer-authority reference and reviewed-scope
  fingerprint, and relation validation rejects scheduled expiry. A future authenticated MarkReg
  producer remains responsible for reading head, revocation, Core authority and reviewed-scope truth
  at `asOf`; the structural parser does not discover the absence of those changes;
- `SUPERSEDED` carries the exact successor receipt reference; relation validation requires the
  successor's `reviewedAt` to be later than the target, its `supersedesReceiptReference` to point to
  the target and its `reviewedAt` not to be after `asOf`;
- `REVOKED` carries the exact revocation reference; relation validation requires the revocation to
  target the requested receipt and its `revokedAt` not to be after `asOf`;
- `EXPIRED` requires non-null `expiresAt` and `asOf >= expiresAt`;
- `REVIEWER_AUTHORITY_NOT_CURRENT` retains the exact receipt and the exact Core authority reference
  whose current owner evidence no longer supports the reviewer at `asOf`;
- `REVIEWED_SCOPE_CHANGED` retains the exact receipt and an observed reviewed-scope fingerprint that
  is demonstrably different from `reviewedScopeFingerprintSha256`;
- `NOT_FOUND` carries no receipt-shaped substitute;
- `UNAVAILABLE` does not claim absence; and
- `INTEGRITY_FAILURE` does not repair, select or prefer untrusted evidence.

These branches do not introduce separate head, revocation, authority or scope “snapshot” contracts.
The currentness union reports one result from exact owner reads; it does not create four parallel
state machines or a second review truth.

## 5. Required behavior

### 5.1 Exact candidate lock

The contract is limited to:

```text
jurisdiction = CN
authority = CNIPA
object = TRADEMARK_APPLICATION
operation = PROJECT_TRADEMARK_LIFECYCLE
procedure = FILING_TO_PRELIMINARY_PUBLICATION
basis = ANY
stage/segment = SOURCE_RECORDED_COMPLETED_HISTORY
```

The exact applicability fingerprint, Method reference, package reference and reviewed-scope
fingerprint carry that lock. Candidate, owner, kind, version or fingerprint drift fails closed. The
contract is not an open generic envelope for another jurisdiction, procedure, basis or Rule Pack.

### 5.2 Structural integrity is not owner authority

Strict parsers reject unknown or missing fields, malformed timestamps, unsupported states, illegal
state-field combinations, non-canonical reason ordering and fingerprint mismatch. Canonically
equivalent material reproduces the same fingerprint.

That structural result does not prove that MarkReg issued the object, that Core issued or still
supports reviewer authority, that referenced objects are reachable, that the source is production
admissible or that an independent admission authority accepted the candidate. Synthetic fixtures
prove parser behavior only.

### 5.3 Receipt invariants

- `reviewedScopeFingerprintSha256` must equal the deterministic fingerprint of the exact candidate
  and reviewed boundary.
- An acceptable receipt carries no rejection reason; a rejected receipt carries at least one
  canonical stable rejection reason.
- `reviewedAt` cannot be in the future relative to a currentness `asOf` that uses the receipt.
- Non-null `expiresAt` must be later than `reviewedAt`.
- A successor must have a later `reviewedAt`, point explicitly to the exact superseded receipt and
  preserve its own immutable identity and fingerprint.
- The exact Core reviewer references are evidence addresses, not copied Core identity or authority
  truth.

### 5.4 Exact-time currentness

Currentness and review outcome are orthogonal: `CURRENT` may truthfully mean that a current MarkReg
decision is `REJECTED`. Only `CURRENT` plus an `ACCEPTABLE_FOR_INDEPENDENT_ADMISSION_REVIEW` receipt
for the exact consumer `asOf` can be structurally eligible for later consumption. The currentness
relation validator rejects a receipt not yet reviewed at `asOf`, scheduled expiry reached at `asOf`,
or mismatched head, authority and scope references; the consumer helper additionally rejects a
`REJECTED` outcome. A future authenticated MarkReg producer must return the corresponding
non-current branch when a qualifying successor or revocation took effect, reviewer authority is not
current, reviewed scope changed, an owner read is unavailable or an integrity check failed. This
contract does not pretend that a pure parser can discover those external facts.

The contract does not invent a freshness duration. Callers cannot compare wall-clock age against an
ad hoc TTL, cannot extend `CURRENT` to another time and cannot turn lack of evidence into currentness.

### 5.5 Fixed false-authority consequences

Every Receipt, Revocation and Currentness object fixes these existing authority consequences to
false:

```text
rulePackAdmitted = false
sourceUsePromoted = false
methodActivated = false
capabilityVerified = false
projectionPersistenceAuthorized = false
productBusinessStateCreated = false
officialTruthCreated = false
legalDeadlineCertified = false
executionAuthorized = false
reviewedTimingUnlocked = false
professionalAdviceProvided = false
runtimeExposureAuthorized = false
workOrMatterMutationAuthorized = false
```

They are constants, not caller options. The contract cannot unlock `REVIEWED_TIMING`, current
position, a future path, rule window, grace period, prediction, recommendation, CTA, Work/Matter
mutation, filing or any protected action.

### 5.6 No runtime dependency or admission consequence

The three objects contain no materialized runtime dependencies. This task does not alter the A2a
computation input, teach the A2b2c runner to fetch or trust review evidence, register the runner or
make the receipt a selectable runtime dependency.

The repository contains no authenticated MarkReg producer/readback service and no real receipt,
revocation or currentness evidence for this candidate. Completion therefore preserves:

```text
PROFESSIONAL_RESPONSIBILITY = EVIDENCE_MISSING
FACT_PATH = EVIDENCE_MISSING
CURRENT_PRODUCTION_ADMISSION = EVIDENCE_REJECTED / SOURCE_POLICY_PILOT
checked-in Method/package = VALIDATED candidate only
runner registration = none
current Rule Pack = NOT_ADMITTED
```

The A2b1 current fixture remains nine `EVIDENCE_MISSING` gates plus the exact
`SOURCE_POLICY_PILOT` rejection.

## 6. State transitions

This task authorizes no canonical Product, Method, Capability, Rule Pack, Work, Matter, projection,
review or execution transition. Parsing and fingerprinting are pure operations.

The contract can represent a future owner-controlled evidence history:

```text
MarkReg issues immutable Receipt A
-> MarkReg may later issue Receipt B that explicitly supersedes A
-> MarkReg may separately issue a Revocation targeting an exact receipt
-> MarkReg answers Currentness for one exact receipt and one exact asOf
```

Receipt A is never mutated. A currentness result reports the owner read at `asOf`; it does not
become a durable status machine, admission decision or new source of reviewer authority.

## 7. UI and interaction states

Not applicable. LCR-A2b2d adds no page, route, component, Storybook fixture, responsive behavior or
Playwright journey. It does not expose rule-assessment evidence to customers and does not replace
the current non-canonical Lifecycle Rail fixtures.

A later admitted read/UI task must degrade when required rule-assessment evidence is not current and
must not describe source-recorded history as a certified deadline. That work remains blocked behind
LCR-A2c, LCR-A3 and LCR-A4.

## 8. Events emitted and consumed

None. The shared contract emits no event, consumes no event and adds no outbox. Future owner
issuance, revocation and currentness serving require separate implementation and admission; this
task does not simulate them as events.

## 9. Acceptance tests

The implementation must prove:

1. Receipt parsing accepts only fixed MarkReg ownership, the exact candidate tuple, the exact
   three-field reviewed boundary, exact Core reviewer references and one of the two outcomes.
2. Receipt, Revocation and Currentness fingerprints reproduce deterministically, and mutation of
   any fingerprint material fails closed.
3. `reviewedScopeFingerprintSha256` is derived only from the exact candidate and reviewed boundary;
   a scope-change fixture uses a genuinely different fingerprint.
4. The receipt has `reviewedAt`, nullable `expiresAt` and nullable exact supersedes reference, but no
   `validFrom`, `validUntil`, currentness, runtime dependencies or extension bag.
5. Non-null `expiresAt <= reviewedAt` is rejected; `expiresAt: null` never proves timeless
   currentness.
6. Only `ACCEPTABLE_FOR_INDEPENDENT_ADMISSION_REVIEW` or `REJECTED` parses, with exact
   outcome/reason invariants.
7. Revocation targets one exact receipt, cannot predate it and accepts no generic `OTHER` reason.
8. Currentness uses one common envelope and exactly the nine result branches defined in section
   4.5; unknown status or illegal branch fields fail closed.
9. The currentness `asOf` is exact. No TTL, reuse window, `validUntil`, pseudo-snapshot or implicit
   cache rule is accepted.
10. A successor has a later `reviewedAt`, explicitly supersedes the target and takes effect no later
    than `asOf`; otherwise `SUPERSEDED` is rejected.
11. A revocation explicitly targets the receipt and takes effect no later than `asOf`; otherwise
    `REVOKED` is rejected.
12. `EXPIRED` requires non-null `expiresAt` and `asOf >= expiresAt`.
13. `REVIEWER_AUTHORITY_NOT_CURRENT` retains exact Core authority evidence;
    `REVIEWED_SCOPE_CHANGED` proves a fingerprint different from the receipt scope.
14. `NOT_FOUND`, `UNAVAILABLE` and `INTEGRITY_FAILURE` cannot carry a positive receipt-shaped
    substitute or become `CURRENT`.
15. Every authority consequence is false, and any attempted escalation is rejected.
16. Parsing a synthetic fixture does not authenticate its issuer, prove Core authority, change the
    A2b1 readiness fixture or satisfy `PROFESSIONAL_RESPONSIBILITY`.
17. Existing A1, A2a/A2a1, A2b1, Data Engine V3 and A2b2c candidate tests remain green.
18. No runner, source policy, persistence, migration, API, event or UI behavior changes.

## 10. Validation commands

Run from the dedicated task worktree:

```bash
pnpm --filter @markorbit/contracts exec vitest run tests/trademark-lifecycle-rule-pack-review.test.ts tests/trademark-lifecycle-computation-contract.test.ts tests/trademark-lifecycle-rule-pack-readiness-contract.test.ts tests/brain-cn-trademark-lifecycle-history.test.ts
pnpm --filter @markorbit/contracts lint
pnpm --filter @markorbit/contracts typecheck
pnpm --filter @markorbit/contracts test
pnpm --filter @markorbit/contracts build
pnpm --filter @markorbit/capability-engine exec vitest run tests/cn-trademark-lifecycle-history-candidate.test.ts tests/executable-method-runtime.test.ts
pnpm format:check
pnpm validate:workspace
pnpm validate:persistence-boundaries
pnpm task:prepush
```

Full affected CI remains authoritative.

## 11. Non-goals and stop conditions

LCR-A2b2d does not:

- implement or impersonate a MarkReg Receipt, Revocation or Currentness producer;
- authenticate an issuer or dereference reviewer authority inside a structural parser;
- create a repository, service, currentness cache, HTTP route, database table or migration;
- reuse, rename or extend Execution's `ProfessionalReviewCase` as Rule Pack rule assessment;
- copy Core reviewer identity, membership or authority into MarkReg ownership;
- create materialized runtime dependencies or modify the A2a computation schema;
- wire, bootstrap or register the CN candidate runner;
- activate the checked-in Method/package or create an ACTIVE successor;
- promote the current CN source policy from `PILOT`, deploy the external Data Engine V3 producer or
  make `FACT_PATH` available;
- admit or verify a Capability, admit a Rule Pack or create a Capability Canon entry;
- establish Official Truth, certify a legal deadline, provide legal advice or authorize a CTA,
  Work/Matter mutation, filing or protected action;
- add lifecycle projection persistence/current head, Gateway composition, Lite UI, API, event or
  external action;
- define TTL-based currentness, observation `validUntil` or parallel pseudo-snapshot contracts;
- expand beyond the exact CN/CNIPA source-recorded completed-history candidate; or
- implement LCR-A2b2e production evidence, LCR-A2c admission, LCR-A3 persistence or LCR-A4 UI.

Stop rather than weaken the boundary if implementation would require a fabricated owner receipt, a
fixture presented as authority evidence, a mutable receipt, direct foreign-database access, local
currentness inference, TTL reuse, source promotion, Method activation, runtime registration,
persistence or UI exposure.

## 12. Required follow-up order and completion consequence

Completion preserves the locked sequence:

1. **LCR-A2b2e — production-equivalent latency/cost and promotion-readiness evidence.** Assemble
   real source, Method, rule-assessment currentness and full usable-output evidence against an
   approved release envelope without manufacturing source promotion or activation.
2. **LCR-A2c — independent admission review.** Begin only when all ten gates have real, reachable,
   current and semantically sufficient owner evidence with unchanged fingerprints.
3. **LCR-A3 — MarkReg projection retention and authorized read.** Remains blocked until LCR-A2c
   admits the exact branch.
4. **LCR-A4 — Gateway interaction overlay and HIFI integration.** Remains blocked behind exact
   admission and the MarkReg-owned projection/read path.

If real MarkReg rule-assessment evidence cannot be produced, the sequence stops before LCR-A2c. A
contract parser, fixture, test pass, agent statement or pull-request merge is not owner evidence.

LCR-A2b2d is complete only when the three-object contract, strict parsers/fingerprints,
adversarial tests and this record agree on exact ownership, time and false-authority boundaries; all
applicable validation passes; and the diff contains only declared task paths. Completion means:

```text
contract boundary = available
real MarkReg Receipt/Revocation/Currentness evidence = absent
PROFESSIONAL_RESPONSIBILITY = EVIDENCE_MISSING
Rule Pack = NOT_ADMITTED
runtime/persistence/API/event/UI change = none
```
