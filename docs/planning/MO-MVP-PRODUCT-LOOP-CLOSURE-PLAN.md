# MO MVP Product Loop Closure Plan

- **Planning task:** `MO-MVP-TASK-031B`
- **Stage:** `MO-MVP-PRODUCT-LOOP-CLOSURE`
- **Status:** `PROPOSED_FOR_OWNER_APPROVAL`
- **Audited baseline:** `ce5e845ee8350341d478ad5372ac1ccbaffe4fb4`
- **Direction:** `REAL_LITE_TODAY_TO_WORK_AND_FEEDBACK_LOOP`
- **Precedence:** after completed M1–M5; before M6-WP-01
- **Runtime implementation in this planning task:** none

## 1. Why this stage exists

Milestones 2–5 established a strong governed application, professional-work, MGSN and lifecycle backbone. TASK 031A then approved Milestone 6 Capability Learning and Private Reflection.

The Product Loop Conformance Audit found that the approved M6 direction remains correct, but the repository should first prove the Product behavior that the Workplace/Product canon says must precede shared extraction and learning infrastructure.

Two MVP Beta loops remain unclosed:

- Content;
- Opportunity.

The same audit found a more important Lite product drift: the confirmed Lite mainline is not a parallel module menu. It is:

```text
Today
-> Recommendation
-> Prepared Action
-> User Confirmation
-> Product / Workflow Handoff
```

This stage exists to prove that line with real governed state and one concrete Content-to-Opportunity-to-Work scenario.

## 2. User and job to be done

Primary user:

- independent trademark professional;
- small trademark agency practitioner/team member operating inside one authorized Workspace.

Primary job:

> Show me what matters now, explain why it matters, prepare the useful next action, let me confirm it, and hand it to the correct Product or governed Workflow without making me understand the platform architecture first.

The stage should demonstrate that Lite helps the practitioner:

1. discover value;
2. organize today;
3. prepare action;
4. confirm intentionally;
5. continue into real professional/business work;
6. see the result return as feedback.

## 3. Required Product loop

The stage must prove this top-level journey:

```text
Today
-> traceable Recommendation
-> Prepared Action
-> explicit User Confirmation
-> Product / Workflow Handoff
-> existing MarkReg / Execution / MGSN path where applicable
-> Outcome / Feedback
-> Today reflects the result
```

At least one acceptance journey must use a Content-to-Opportunity path:

```text
existing trusted trademark / client / work context
-> traceable source
-> Content Opportunity
-> Content draft / bounded Artifact preparation
-> Human Review
-> prepared PublishPackage
-> manual publication/use feedback or business signal
-> Lead / Opportunity Candidate
-> explicit Qualification
-> Formal Opportunity
-> MarkReg / professional-work handoff
-> existing Matter / Execution / outcome path
```

The stage does not need social-network automation to prove the Product loop. A user-confirmed/manual publish or use record is sufficient.

## 4. Product-mainline lock

Lite must be organized around the user journey, not around architecture nouns.

The primary product experience is:

```text
Observe
-> Explain
-> Recommend
-> Prepare
-> Confirm
-> Execute / Handoff
-> Learn
```

Therefore:

- `Today` is the organizing surface;
- Recommendation explains why a concrete item deserves attention;
- Prepared Action contains what MarkOrbit has prepared;
- confirmation is explicit and consequence-aware;
- handoff goes to the correct owning Product/Workflow;
- Content, Opportunity, Marks, Capability and other domain/detail views may exist as supporting surfaces but do not replace the Today-to-Handoff mainline;
- the implementation must not respond to the current gap by merely turning every navigation label into another equal module.

## 5. Semantic locks

### Recommendation

A recommendation is an explainable Product suggestion tied to exact source/provenance.

`Recommendation != authorization`.

WP-01 must first inspect the existing MarkReg Recommended Action contract and reuse it where its semantics are truly compatible. It must not silently broaden lifecycle-specific semantics merely to avoid a bounded Product contract.

### Prepared Action

A Prepared Action is a reviewable package of Product intent and prepared material before execution/handoff.

`Prepared Action != executed action`.

It must state:

- what was prepared;
- from which source/version;
- why it was proposed;
- what confirmation will do;
- which Product/Workflow will receive it;
- what protected action, if any, remains separately gated.

### Content Opportunity

A Content Opportunity is a candidate reason to prepare useful professional communication/content from trusted context.

It is not automatically publishable content and not a formal business Opportunity.

### Content draft / bounded Artifact

Content and Artifact remain distinct. This stage must not create a universal Artifact table or generic Artifact platform merely to support one Lite loop.

A Product-owned bounded draft/version model is permitted if required by the proven journey.

### PublishPackage

A PublishPackage is prepared material that a user can review, copy, download, deliver into a manual workflow or explicitly mark as used/published after the fact.

`PublishPackage != Published`.

Creating a package must never fabricate an external publication event.

### Lead / Opportunity Candidate

A Lead or Opportunity Candidate is pre-qualification business state with exact provenance.

`Opportunity Candidate != Formal Opportunity`.

No candidate may silently contact a customer, create a MarkReg Order/Matter, appoint a professional or trigger protected action.

### Formal Opportunity

Formal Opportunity is created only after explicit qualification/promotion through its owning boundary.

WP-01 must determine the smallest correct Product/Owning-Service placement from current repository and Canon evidence. It must not place organization-specific commercial truth into Core merely for convenience and must not create a new shared service unless the actual Product behavior requires it.

## 6. Ownership and reuse lock

This stage reuses the established constitutional boundaries:

- **Core:** User, Workspace, Membership, Session, Principal and permission truth;
- **Execution:** governed review/approval/protected-action coordination where the action requires it;
- **MarkReg:** existing trademark application, Order, Matter and lifecycle formal state;
- **MGSN:** provider/network execution state where applicable;
- **Gateway:** authenticated browser/API transport and composition;
- **Lite:** Product experience and Product-owned state that has not yet justified shared extraction.

Rules:

- no cross-service SQL;
- no parallel identity/permission model;
- no generic Workplace service;
- no generic Brain/Value Factory/Intelligence service;
- no universal Artifact service/table;
- reuse existing contracts, repositories, review primitives and Gateway patterns where semantics match;
- if a responsibility remains Lite-specific, keep it Product-owned until repeated use proves extraction is justified.

## 7. Work-package graph

### PLC-WP-01 — Product mainline, contracts and ownership boundary

Freeze the minimum semantics and ownership needed for:

- Today Recommendation;
- Prepared Action;
- Content Opportunity;
- bounded Content draft/version and PublishPackage;
- manual publication/use feedback;
- Lead / Opportunity Candidate;
- Qualification / Formal Opportunity;
- handoff into existing MarkReg/professional work.

Before adding a contract, inspect and reuse compatible repository contracts. Resolve the owning boundary for Formal Opportunity from Canon + current implementation rather than inventing a service from logical diagrams.

**No migration or UI behavior in WP-01.**

### PLC-WP-02 — Durable Product-owned Content preparation state

Implement the smallest durable, Workspace-isolated Product state required to move a real recommendation into content preparation with exact provenance and version history.

Requirements include:

- exact source reference/version/fingerprint or equivalent stable provenance;
- bounded draft versioning;
- Human Review state where required;
- prepared PublishPackage;
- idempotency/concurrency/restart behavior;
- no automatic Publish.

Do not introduce a universal Artifact store.

### PLC-WP-03 — Durable candidate and qualification path

Implement durable Lead/Opportunity Candidate state and explicit qualification/promotion.

Requirements include:

- exact provenance back to the originating signal/content/work context;
- Workspace/customer relationship isolation;
- explicit human qualification;
- idempotent exact replay and controlled concurrency;
- `Opportunity Candidate != Formal Opportunity`;
- no automatic outreach, Order, Matter or appointment.

### PLC-WP-04 — Formal Opportunity to existing work handoff

Connect a qualified Formal Opportunity into the existing MarkReg/professional workflow without duplicating the already-proven application backbone.

Preserve the separate relationship model where relevant:

- Channel;
- Relationship Owner;
- Contracting Party;
- Delivery Owner;
- Communication Owner;
- Customer-facing Brand;
- Professional Authority.

The handoff must not imply Quote acceptance, Order creation, Matter creation, Payment, filing or appointment unless those existing owning flows explicitly perform those later steps.

### PLC-WP-05 — Lite Today -> Prepared Action real-runtime journey

Implement the canonical Lite mainline over the real state from WP-02 through WP-04:

```text
Today
-> Recommendation detail / explanation
-> Prepared Action
-> explicit confirmation
-> handoff
-> result / feedback
```

Content and Opportunity detail/index views are supporting surfaces. They must not become the primary Product model.

This UI work must follow the repository `ui-design` skill and include desktop/mobile, loading, empty, stale/partial, permission, error, success and direct-URL/reload states.

### PLC-WP-06 — Feedback and Product-loop observability

Persist the minimum outcome/feedback needed to prove the loop and later support learning, without implementing M6 Capability learning itself.

Examples may include:

- prepared package reviewed;
- user recorded package as externally used/published;
- candidate created from a recorded signal;
- candidate qualified/rejected/deferred;
- Formal Opportunity handed to MarkReg/professional work;
- resulting work/Matter reference where available.

Feedback records remain Product/work evidence, not Capability verification.

### PLC-WP-07 — Reliability and browser matrix

Prove:

- restart/recovery;
- replay/idempotency;
- optimistic concurrency where mutations occur;
- Workspace/subject isolation;
- provenance preservation;
- stale-version rejection;
- permission denial;
- desktop and mobile real-runtime browser paths;
- no interception/fixture fallback on the acceptance journey;
- regression gates for M2–M5.

### PLC-WP-08 — Independent Product-loop and authority audit

Audit the complete stage against:

- Books 01–07 / Active Canon;
- Product Loop First principle;
- Lite Today mainline;
- Candidate Before Canonical;
- Human Review / governed Execution;
- ownership and relationship boundaries;
- absence of speculative shared extraction;
- exact real-runtime integration.

Return `GO` or `FIX` with bounded evidence.

## 8. Dependencies

```text
TASK 031B approval
-> PLC-WP-01
-> PLC-WP-02
-> PLC-WP-03
-> PLC-WP-04
-> PLC-WP-05
-> PLC-WP-06
-> PLC-WP-07
-> PLC-WP-08
-> resume approved M6-WP-01
```

Implementation packages may overlap only when their ownership and contract prerequisites are already merged and the repository one-task/one-branch/one-PR rule remains satisfied.

## 9. Completion gate

The Product Loop Closure stage may be recommended `GO` only when the exact implementation proves:

- real Lite Today-driven Product journey;
- traceable Recommendation;
- Prepared Action with consequence-aware confirmation;
- content preparation with provenance and Human Review;
- `PublishPackage != Published`;
- durable Lead/Opportunity Candidate;
- explicit Qualification before Formal Opportunity;
- `Opportunity Candidate != Formal Opportunity`;
- real Formal Opportunity -> existing work handoff;
- outcome/feedback returning to Product context;
- Workspace/organization isolation;
- restart/replay/idempotency/concurrency safety;
- desktop/mobile real-runtime path with no fixture interception;
- M2–M5 regression gates;
- independent authority audit;
- no speculative universal Workplace/Brain/Value Factory/Artifact extraction.

## 10. Explicit non-goals

This stage does not implement:

- automatic social/media publication;
- bulk outreach;
- autonomous customer Communication;
- a CRM replacement;
- a generic marketing automation engine;
- a universal Artifact platform;
- a universal Workplace service;
- a physical Mo Brain/Value Factory/Intelligence subsystem merely because the publication names those logical responsibilities;
- public Opportunity ranking;
- automatic provider appointment;
- Payment/Invoice/settlement;
- external Filing Submission or Official Truth;
- M6 Capability Ledger/Reflection/Profile/Twin runtime;
- automatic Capability verification or Canon mutation;
- production GA claim.

## 11. M6 sequencing and approval state

PR #71 merged as `ce5e845ee8350341d478ad5372ac1ccbaffe4fb4`. TASK 031A and the Milestone 6 direction are therefore **approved**, even though some proposal-status text in the planning documents was not reconciled after merge.

This plan does not revoke that approval.

It changes only execution precedence:

```text
approved M6
= remains valid

M6 runtime start
= sequenced after Product Loop Closure GO
```

The stale proposal-status wording should be reconciled without rewriting the approved M6 semantic scope.

## 12. Owner approval consequence

Merge of the TASK 031B planning/audit PR means the owner accepts:

- `RESEQUENCE_BEFORE_M6_WP01`;
- the Product Loop Closure stage as the immediate next implementation stage;
- the Lite Today-driven Product mainline as the sequencing constraint;
- `PLC-WP-01` as the next authorized implementation task.

Merge does **not** itself authorize or create runtime Product state, publication, outreach, Opportunity promotion, Order/Matter creation, Payment/Invoice, provider appointment, external filing, Official Truth, Capability verification, Canon mutation, deployment, release or production GA.
