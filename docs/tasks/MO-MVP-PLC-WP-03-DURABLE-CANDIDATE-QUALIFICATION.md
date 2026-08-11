# PLC-WP-03 — Durable Candidate and Qualification Path

## 1. Task ID

`MO-MVP-PLC-WP-03`

## 2. Repository and allowed directories

Repository: `yoomarks/markorbit`.

Allowed implementation areas:

- `services/lite/**`;
- `infrastructure/persistence/migrations/**` and `migration-owners.json`;
- bounded validation/CI files required to prove this work package;
- this task document and sequencing documentation;
- `packages/contracts/src/product-loop.ts` only if an already-frozen contract proves insufficient.

## 3. Objective

Persist the smallest Lite-owned business-candidate state needed to turn an exact Product signal into an Opportunity Candidate and record an explicit human Qualification Decision without creating a Formal Opportunity or contacting a customer.

The durable path is:

```text
exact Product-loop source(s)
-> Workspace/customer relationship check
-> Opportunity Candidate OPEN
-> explicit human Qualification Decision
-> Opportunity Candidate DISPOSITIONED
-> later MarkReg owner mutation in PLC-WP-04
```

No UI is added in WP-03.

## 4. Approved basis

- Product Loop Closure approved by PR #73;
- PLC-WP-01 Product contracts/ownership boundary;
- PLC-WP-02 durable Lite Product-owned PostgreSQL/service patterns merged in PR #76;
- `packages/contracts/src/product-loop.ts`;
- `docs/architecture/PRODUCT-LOOP-AUTHORITY-BOUNDARY.md`;
- `docs/planning/MO-MVP-PRODUCT-LOOP-CLOSURE-PLAN.md`.

## 5. Ownership decision

WP-03 preserves the frozen ownership boundary:

- Opportunity Candidate: Lite Product-owned state;
- Qualification Decision: Lite Product-owned explicit human disposition;
- Formal Trademark Service Opportunity: MarkReg-owned state, not created in WP-03;
- Customer truth: external owning boundary; Lite checks relationship accessibility through an injected authority and does not copy customer ownership into a parallel model;
- Workspace identity: Core-owned; persistence remains Workspace-scoped and uses Core Workspace UUIDs.

No new Opportunity service, CRM service, Workplace service or Core commercial-state table is introduced.

## 6. Durable state

Migration `0040_lite_candidate_qualification` adds only Lite-owned tables:

- `lite_opportunity_candidates` — immutable version history for candidate Product state;
- `lite_opportunity_qualification_decisions` — immutable human decision over one exact Candidate version/fingerprint;
- `lite_candidate_qualification_commands` — Workspace-scoped idempotency replay ledger.

The owning package remains `@markorbit/lite-service`.

## 7. Provenance and customer relationship rules

Candidate commands provide source locators only. Exact source version/fingerprint provenance is resolved through the existing injected `ProductLoopSourceAuthority` pattern from WP-02.

Rules:

1. between one and eight exact sources are required;
2. unsupported or mismatched source authority responses fail closed;
3. duplicate exact sources are rejected;
4. exact resolved sources are persisted in the Candidate document;
5. when a `customerId` is present, `ProductLoopCustomerRelationshipAuthority` must confirm that customer is accessible in the requested Workspace before Candidate creation;
6. no cross-service SQL is used to inspect customer truth.

## 8. Qualification semantics

WP-03 intentionally does not create a separate review workflow merely to consume the `UNDER_REVIEW` vocabulary.

The minimum proven path is:

```text
Candidate version N: OPEN (or future compatible UNDER_REVIEW)
-> exact expected version + fingerprint
-> explicit human Qualification Decision
-> Candidate version N+1: DISPOSITIONED
```

The decision records:

- exact Candidate ID/version;
- exact expected Candidate fingerprint;
- `QUALIFIED_FOR_MARKREG | REJECTED | DEFERRED`;
- deciding Principal ID;
- rationale;
- decision time.

The Candidate update and Qualification Decision are committed atomically under one advisory-lock protected transaction.

`QUALIFIED_FOR_MARKREG` means only that the Lite Candidate is eligible for the later MarkReg owner mutation. It does not create that Formal Opportunity.

## 9. Permanent authority locks

For every WP-03 state:

- `Opportunity Candidate != Formal Opportunity`;
- `Qualification Decision != Formal Opportunity creation`;
- `QUALIFIED_FOR_MARKREG != MarkReg Intake`;
- no automatic customer outreach;
- no Order;
- no Matter;
- no Payment/Invoice;
- no provider appointment;
- no Filing Submission;
- no Official Truth;
- no AI qualification authority.

Both Candidate and Qualification Decision retain `formalOpportunityCreated=false` and `customerContacted=false` in WP-03.

## 10. Reliability requirements

The dedicated PostgreSQL suite must prove:

- exact provenance survives restart/store recreation;
- Candidate immutable version history survives restart;
- exact idempotency replay returns the prior result;
- idempotency payload drift fails with a typed conflict;
- competing qualifications over one expected Candidate version serialize to one winner;
- stale competing mutation fails with controlled version conflict;
- one Candidate has at most one Qualification Decision in this bounded path;
- another Workspace cannot read Candidate state;
- inaccessible Workspace/customer relationship fails before persistence;
- qualified/rejected/deferred dispositions never create Formal Opportunity or outreach effects.

## 11. Explicit non-goals

WP-03 does not add:

- Formal Trademark Service Opportunity persistence;
- MarkReg owner mutation;
- MarkReg Intake handoff;
- Gateway routes;
- Lite UI;
- automatic content-use feedback generation;
- automatic customer contact;
- CRM automation;
- public Opportunity ranking;
- universal Opportunity/Artifact/Workplace services;
- Payment/Invoice;
- provider appointment;
- external filing;
- Official Truth;
- M6 Capability learning runtime.

## 12. Acceptance consequence

Merge of the WP-03 PR accepts only the durable Lite Candidate + explicit Qualification boundary.

After merge, the next planned package is `PLC-WP-04 — Formal Opportunity to existing work handoff`. WP-04 must create formal commercial state through the MarkReg owning boundary rather than mutating Lite Candidate state into a MarkReg record by implication.
