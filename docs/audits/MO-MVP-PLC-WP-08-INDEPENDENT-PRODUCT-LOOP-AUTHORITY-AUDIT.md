# MO MVP PLC-WP-08 Independent Product-loop and Authority Audit

- **Task:** `PLC-WP-08`
- **Stage:** `MO-MVP-PRODUCT-LOOP-CLOSURE`
- **Audit type:** independent Product-loop / authority / runtime-conformance audit
- **Audited main:** `eb029a104a19b05c2f577956bbd2a4a35f635878`
- **Audited runtime tree:** `23b153a2315f90de77e139bef44ff2a43e4aeb40`
- **Exact runtime evidence head:** `26dcd84dc4e27e9c66536ced168b1efb0c55e036`
- **Recommendation:** `GO`
- **Blocking findings:** none
- **Runtime mutation in WP-08:** none

## 1. Audit question

Does the merged Product Loop Closure implementation now satisfy the publication/Canon requirement **Product Loop First, Shared Platform Extraction Second** while preserving the permanent authority and owner boundaries established by M1–M5 and PLC-WP-01?

The audit must answer `GO` or `FIX` based on implementation and real-runtime evidence rather than planning intent.

## 2. Canon and repository basis

The audit applies the current Product Loop Closure Plan and Product Loop Authority Boundary together with Books 01–07 / Active Canon principles already accepted by the repository:

```text
Product problem
-> Product loop
-> user validation
-> repeated architectural need
-> shared capability extraction
```

The controlling Lite mainline is:

```text
Today
-> Recommendation
-> Prepared Action
-> explicit User Confirmation
-> Product / Workflow Handoff
-> Outcome / Feedback
```

The Product Loop Closure acceptance line is:

```text
Knowledge / governed source
-> Today Recommendation
-> Prepared Action / explicit confirmation
-> Lite Content Opportunity
-> bounded Content Draft
-> Human Review
-> PublishPackage
-> manual Product-loop use feedback
-> Opportunity Candidate
-> explicit Qualification
-> MarkReg Formal Opportunity
-> confirmed MarkReg Intake handoff
-> durable evidence / Today feedback
```

## 3. Independent implementation findings

### 3.1 Today is a real Product mainline

`apps/lite-web/src/features/today/TodayWorkspace.tsx` consumes `@markorbit/contracts/product-loop` and the real Gateway-backed `createTodayClient`. The UI explicitly distinguishes Recommendation from authorization, displays exact provenance, requires confirmation before handoff, records user-reported feedback only after the fact, and states that the evidence is not Capability verification.

`apps/lite-web/src/api/product-loop.ts` uses real HTTP routes, session cookies, Core/Gateway Workspace context, CSRF for mutations and idempotency keys. The acceptance path is therefore not the legacy supporting fixture Opportunity screen.

**Audit result:** `PASS`.

### 3.2 Content preparation preserves Candidate Before Canonical and Human Review

`services/lite/src/content-preparation.ts` is durable PostgreSQL-backed Product state. It resolves owner-produced source provenance rather than trusting request-body identity. Recommendation carries `executionAuthorized: false`; Content Opportunity carries `publishAuthorized: false`; Content Draft carries `humanReviewRequired: true` and `published: false`.

Human Review records exact draft version/fingerprint plus authenticated reviewer Principal. A PublishPackage can be prepared only from an `APPROVED_FOR_PUBLISH_PACKAGE` review decision over that exact draft. The package remains `status: PREPARED` and `externalPublishExecuted: false`.

**Authority lock:** `Content Draft != approved content`; `Human Review approval != publication`; `PublishPackage != Published`.

**Audit result:** `PASS`.

### 3.3 Feedback remains user-reported evidence

The real Today surface labels feedback as user-reported after-the-fact evidence and explicitly says MarkOrbit neither executed nor independently verified the external action. WP-07 proves a reviewed PublishPackage can enter the pending feedback queue, receive authenticated manual feedback, leave the queue, survive reload and return as durable Today evidence.

**Authority lock:** user-reported external use != MarkOrbit-executed external action != independently verified external outcome.

**Audit result:** `PASS`.

### 3.4 Candidate and Qualification remain Lite-owned pre-formal state

`services/lite/src/candidate-qualification.ts` creates Workspace-scoped Candidates only from exact resolved Product-loop sources. It checks customer relationship accessibility, persists exact source provenance and initializes `formalOpportunityCreated: false` and `customerContacted: false`.

Qualification is a separate explicit command carrying exact candidate version/fingerprint, authenticated `decidedByPrincipalId`, rationale and outcome. The decision itself persists `formalOpportunityCreated: false` and `customerContacted: false`; concurrent/duplicate decisions fail closed.

**Authority lock:** `Opportunity Candidate != Formal Opportunity`; `Qualification Decision != formal owner mutation`.

**Audit result:** `PASS`.

### 3.5 MarkReg separately owns Formal Opportunity and Intake handoff

`services/markreg/src/formal-opportunity.ts` declares MarkReg as the owner of `FormalTrademarkServiceOpportunity`. It consumes Candidate + Qualification through the `QualifiedOpportunityAuthority` interface; the implementation contract explicitly states MarkReg never reads Lite SQL.

Before formal creation, MarkReg resolves exact qualified evidence. Formal creation is separately idempotent and records:

```text
owningService = MARKREG
orderCreated = false
matterCreated = false
paymentCreated = false
filingSubmitted = false
customerContactedByCreation = false
```

Preparing an Intake handoff is another separate explicit command with exact formal-opportunity fingerprint, relationship model, customer intent and confirming Principal.

**Authority locks:** `Formal Opportunity != Intake`; `Intake != Order`; `Order != Matter`; `Matter != Filing`.

**Audit result:** `PASS`.

### 3.6 No cross-service SQL / owner boundary preserved

The formal-opportunity code depends on `QualifiedOpportunityAuthority`, not a Lite query client. WP-07's permanent two-owner integration explicitly runs separate Lite and MarkReg PostgreSQL databases and resolves the exact qualified Candidate evidence through `HttpQualifiedOpportunityAuthority` and the Lite HTTP owner boundary.

The current architecture retains Core for identity/permission truth, Lite for Product/pre-formal state, MarkReg for formal trademark-service state, Execution for governed protected work and MGSN for provider-network state.

**Audit result:** `PASS`.

### 3.7 No speculative shared extraction

The closed Product loop is implemented inside the existing Lite, Gateway and MarkReg boundaries. The stage did not require or introduce a universal Workplace service, Brain service, Value Factory, Intelligence service, universal Artifact platform or generic Opportunity platform/service.

The bounded Content and Candidate state remains Product-owned until repeated cross-Product behavior proves extraction is justified.

**Audit result:** `PASS`.

## 4. Runtime / reliability evidence

WP-07 is the permanent reliability proof for the exact runtime tree audited by WP-08.

The merged WP-07 PR head `26dcd84dc4e27e9c66536ced168b1efb0c55e036` has tree `23b153a2315f90de77e139bef44ff2a43e4aeb40`. The audited merged `main` `eb029a104a19b05c2f577956bbd2a4a35f635878` has the same tree. No runtime code delta exists between the tested WP-07 head and the audited main tree.

Hosted exact-tree results:

- Product Loop Closure Reliability `31511957597` — `PASS`.
- validation `31511957587` — `PASS`.
- Browser and Visual Validation `31511957667` — `PASS`.
- Milestone 2 reliability `31511957572` — `PASS`.
- Milestone 3 reliability `31511957565` — `PASS`.
- Milestone 4 integration `31511957570` — `PASS`.
- Milestone 4 reliability `31511957635` — `PASS`.
- Milestone 5 integration `31511957655` — `PASS`.
- Milestone 5 reliability `31511957668` — `PASS`.

The Product Loop Closure Reliability workflow proves two-owner PostgreSQL persistence, restart/recovery, exact replay/idempotency, stale-state/concurrency rejection, Workspace/customer isolation, permission/transport denial, exact provenance and the cross-owner HTTP authority boundary.

The permanent Playwright config contains both a 1440x900 desktop project and a 390x844 mobile project and starts `scripts/product-loop-closure-real-runtime.ts`. The static validator fails if the acceptance spec contains `page.route`, `context.route` or `route.fulfill`.

**Audit result:** `PASS`.

## 5. Authority matrix

- Recommendation != authorization — `PASS`.
- Prepared Action != executed action — `PASS`.
- Content Draft != approved content — `PASS`.
- Human Review approval != publication — `PASS`.
- PublishPackage != Published — `PASS`.
- user-reported use != MarkOrbit-executed action — `PASS`.
- user-reported use != independently verified outcome — `PASS`.
- Opportunity Candidate != Formal Opportunity — `PASS`.
- Qualification Decision != formal owner mutation — `PASS`.
- Formal Opportunity != Intake / Order / Matter / Payment / Filing — `PASS`.
- Evidence Review Decision != Official Truth — `PASS`; inherited M5 lock unaffected.
- reviewed-source admission != Filing Submission — `PASS`; inherited M5 lock unaffected.
- Lifecycle Projection != Official Status — `PASS`; inherited M5 lock unaffected.
- Recommended Action does not authorize execution — `PASS`; inherited M5 lock unaffected.
- Provider Return != Official Truth — `PASS`; inherited M4 lock unaffected.
- Product/work evidence != Capability verification — `PASS`.
- Reflection Candidate != canonical truth — `PASS`; M6 not started.
- no automatic Capability verification — `PASS`.
- no automatic Capability Canon mutation — `PASS`.
- no automatic protected external action — `PASS`.
- no cross-service SQL — `PASS`.

## 6. Product-loop completion matrix

- Real Lite Today-driven journey — `PASS`.
- Traceable Recommendation — `PASS`.
- Durable Prepared Action — `PASS`.
- Explicit confirmation — `PASS`.
- Content preparation with exact provenance — `PASS`.
- Human Review before PublishPackage — `PASS`.
- PublishPackage != Published — `PASS`.
- Durable Candidate — `PASS`.
- Explicit Qualification — `PASS`.
- MarkReg Formal Opportunity owner mutation — `PASS`.
- Confirmed MarkReg Intake handoff — `PASS`.
- Outcome/feedback returns to Today — `PASS`.
- Workspace isolation — `PASS`.
- restart/replay/idempotency/concurrency — `PASS`.
- desktop + 390px real runtime — `PASS`.
- no interception/fixture fallback on acceptance path — `PASS`.
- M2–M5 regression evidence — `PASS`.
- no speculative shared extraction — `PASS`.

## 7. Findings

### `FINDING-01 — NO_BLOCKING_PRODUCT_OR_AUTHORITY_DEFECT`

The prior Product Loop Conformance Audit required Product-loop closure before M6. PLC-WP-01 through PLC-WP-07 now close the missing Content and Opportunity-to-Work behavior with durable state and a real Today-driven acceptance path while preserving the owner and authority separations.

No blocking runtime or authority defect was found.

### `FINDING-02 — DOCUMENTATION_STATUS_DRIFT_NON_BLOCKING`

The merged WP-07 task record still said `IMPLEMENTING` even though PR #82 merged and exact-tree hosted evidence passed. WP-08 reconciles that task status as a bounded documentation correction. It does not change runtime semantics.

### `FINDING-03 — LEGACY_SUPPORTING_FIXTURE_SURFACES_NON_BLOCKING`

The Lite shell still contains older fixture-backed supporting Customers/Opportunities screens. They are not used by the PLC real-runtime acceptance journey. The audited Today/Product-loop path uses real contracts, Gateway HTTP and durable owner state. The existence of those supporting fixture screens does not negate the closed mainline and does not justify expanding WP-08 into unrelated UI cleanup.

## 8. Residual non-goals

`GO` does not authorize or claim:

- automatic publication or customer outreach;
- external filing;
- Payment/Invoice/settlement;
- provider appointment;
- Official Truth;
- automatic Matter completion;
- public Opportunity ranking;
- automatic Capability verification;
- Capability Canon mutation;
- universal Workplace/Brain/Value Factory/Intelligence/Artifact extraction;
- production GA, release or deployment.

## 9. Final verdict

**`GO`**

The Product Loop Closure stage is complete for its approved engineering scope.

After the Owner explicitly merges this WP-08 audit PR, the repository may resume the already-approved `M6-WP-01 — Capability learning contracts and canonical authority boundary`.

The audit itself does not start M6 and must not be auto-merged.
