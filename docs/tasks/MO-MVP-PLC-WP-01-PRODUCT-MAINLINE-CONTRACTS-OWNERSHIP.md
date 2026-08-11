# PLC-WP-01 — Product Mainline, Contracts and Ownership Boundary

## Objective

Freeze the minimum shared transport vocabulary and ownership decisions required for the approved Product Loop Closure direction:

```text
Today
-> Recommendation
-> Prepared Action
-> explicit User Confirmation
-> Product / Workflow Handoff
-> Outcome / Feedback
```

WP-01 is contract/architecture work only. It introduces no migration, durable Product state, Gateway route, UI behavior, external publication, outreach or formal business mutation.

## Approved basis

- TASK 031B accepted by merge of PR #73;
- `docs/audits/MO-MVP-PRODUCT-LOOP-CONFORMANCE-AUDIT.md`;
- `docs/planning/MO-MVP-PRODUCT-LOOP-CLOSURE-PLAN.md`;
- Books 01–07 / Active Architecture Canon;
- Product Loop First, Shared Platform Extraction Second;
- Candidate Before Canonical;
- current M1–M5 Core / Execution / MarkReg / MGSN authority boundaries;
- current persisted Knowledge ReadyPackage content boundary merged in PR #74.

Ownership and semantic evidence is recorded in `docs/architecture/PRODUCT-LOOP-AUTHORITY-BOUNDARY.md`.

## Implemented contract surface

`packages/contracts/src/product-loop.ts` freezes:

- exact Product-loop source provenance;
- Lite Today Recommendation;
- Prepared Action and explicit confirmation boundary;
- Content Opportunity candidate state;
- bounded Lite Content Draft/version state;
- explicit Content Human Review Decision;
- prepared PublishPackage;
- manual/user-reported use/publication feedback;
- Opportunity Candidate;
- explicit Opportunity Qualification Decision;
- bounded MarkReg-owned Formal Trademark Service Opportunity;
- prepared MarkReg Intake handoff;
- false automatic authority consequences;
- bounded AI authority;
- stale/review/authority/concurrency/dependency error vocabulary.

The package is exported as `@markorbit/contracts/product-loop`.

## Reuse findings

### MarkReg Recommended Action

The existing M5 Recommended Action was inspected before defining a new recommendation contract.

It is intentionally not reused as the universal Lite recommendation because it requires:

- a MarkReg Formal Matter;
- an exact Lifecycle View;
- lifecycle-specific policy lineage.

PLC Today Recommendations may instead consume an exact MarkReg Recommended Action as one source family without changing the M5 contract.

### Knowledge ReadyPackage

The new PR #74 ReadyPackage content export/consumption boundary is reused as a governed source family. PLC-WP-01 creates no parallel Knowledge ingestion contract.

### MarkReg Intake

The existing MarkReg intake remains the actual owner entry point. `MarkRegIntakeHandoff` is only a prepared handoff envelope and explicitly retains `intakeCreated = false`.

## Ownership decision

For this bounded trademark-service Product loop:

- Lite owns Recommendation, Prepared Action, Content candidate/draft/package/feedback, Opportunity Candidate and Qualification state;
- MarkReg owns the Formal Trademark Service Opportunity and existing Intake/Order/Matter state;
- Execution continues to govern protected work/review when an action requires that boundary;
- Core continues to own identity/Workspace/Principal/permission truth;
- MGSN continues to own provider/network state;
- Gateway remains transport/composition only.

Formal Opportunity is **not** added to Core and no universal Opportunity service is introduced.

## Frozen semantic separations

1. Today Recommendation != MarkReg lifecycle Recommended Action.
2. Recommendation != authorization.
3. Prepared Action != executed action.
4. Content Opportunity != publishable content.
5. Content Draft != approved content.
6. Human Review approval != publication.
7. PublishPackage != Published.
8. User-reported publication/use != MarkOrbit-executed external action.
9. Opportunity Candidate != Formal Opportunity.
10. Qualification Decision != formal owner mutation.
11. Formal Trademark Service Opportunity != Intake.
12. Intake != Order != Matter != Filing.
13. AI preparation != Human Review/confirmation/qualification.

## Acceptance evidence

`packages/contracts/tests/product-loop-contract.test.ts` verifies:

- Today/mainline vocabulary has no published/contacted/ordered/filed/paid/appointed shortcut states;
- Today Recommendation can consume Knowledge provenance without pretending to be a lifecycle Recommended Action;
- preparation, review, PublishPackage and external publication remain distinct;
- manual feedback does not fabricate external execution or verification;
- explicit qualification precedes a separate MarkReg-owned Formal Opportunity;
- the prepared MarkReg handoff does not create Intake/Order/Matter state;
- automatic authority consequences remain false;
- AI remains assistive only;
- stale/review/authority/concurrency/dependency failures are frozen.

## Non-goals

PLC-WP-01 does not create:

- migrations;
- repositories or service runtime;
- formal Opportunity persistence;
- Content persistence;
- Gateway APIs;
- Lite UI changes;
- automatic publication;
- customer outreach;
- universal Artifact/Opportunity/Workplace services;
- Brain/Value Factory/Intelligence services;
- M6 runtime;
- Payment/Invoice;
- provider appointment;
- external Filing Submission;
- Official Truth.

## Next task

After this PR is merged, `PLC-WP-02 — Durable Product-owned Content preparation state` is the next planned work package. It is not automatically merged or deployed by this task.
