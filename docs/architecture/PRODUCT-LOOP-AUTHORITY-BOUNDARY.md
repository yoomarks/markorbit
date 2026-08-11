# Product Loop Authority Boundary

- **Stage:** `MO-MVP-PRODUCT-LOOP-CLOSURE`
- **Work package:** `PLC-WP-01`
- **Direction:** `REAL_LITE_TODAY_TO_WORK_AND_FEEDBACK_LOOP`
- **Runtime mutation:** none

## 1. Purpose

PLC-WP-01 freezes the smallest semantic and ownership boundary needed to implement the approved Lite Product mainline:

```text
Today
-> Recommendation
-> Prepared Action
-> explicit User Confirmation
-> Product / Workflow Handoff
-> Outcome / Feedback
```

The contract exists to prevent the Product Loop Closure stage from drifting into either of two failure modes:

1. turning Lite into a collection of equal architecture/module menus; or
2. introducing generic platform services before a real Product loop proves that extraction is justified.

## 2. Reuse decisions

### Existing MarkReg Recommended Action is not silently generalized

Milestone 5 `RecommendedAction` is MarkReg-owned and explicitly bound to an exact Formal Matter and Lifecycle View. That semantic contract is correct for lifecycle advice, but it cannot represent every Lite Today recommendation, including Knowledge/content and pre-qualification opportunities.

PLC-WP-01 therefore introduces a bounded `TodayRecommendation` Product contract rather than broadening `RecommendedAction` beyond its approved lifecycle semantics.

A lifecycle Recommended Action may still be consumed as one exact source of a Today Recommendation through `MARKREG_RECOMMENDED_ACTION` provenance.

### Existing Knowledge ReadyPackage content is reused

PR #74 made ReadyPackage content consumable through the existing governed Knowledge/Core boundary. PLC-WP-01 recognizes `KNOWLEDGE_READY_PACKAGE` as one Product-loop source family.

No new Knowledge object, Brain service, Value Factory service or parallel document ingestion path is created.

### Existing MarkReg Intake remains the service-entry contract

The Product loop does not invent a second trademark intake model. A qualified formal trademark-service Opportunity prepares a `MARKREG_INTAKE` handoff and the existing MarkReg intake owner remains responsible for actually creating Intake state.

`MarkRegIntakeHandoff != Intake`.

## 3. Ownership decision

The bounded MVP ownership decision is:

| State / responsibility               | Owner                                  | Reason                                                                                                                                                        |
| ------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today Recommendation                 | Lite Product                           | Product-specific prioritization/explanation before shared extraction is justified                                                                             |
| Prepared Action                      | Lite Product                           | Product intent/preparation before confirmation or owner mutation                                                                                              |
| Content Opportunity                  | Lite Product                           | Candidate reason to prepare content; not canonical or formal commercial truth                                                                                 |
| bounded Content Draft/version        | Lite Product                           | Concrete Product artifact preparation; no universal Artifact platform                                                                                         |
| Content Human Review record          | Lite Product in this bounded loop      | Review of a Product draft before package preparation; does not itself execute external communication                                                          |
| PublishPackage                       | Lite Product                           | Prepared package only; no external publication authority                                                                                                      |
| manual use/publication feedback      | Lite Product                           | User-reported Product evidence; not independently verified external truth                                                                                     |
| Opportunity Candidate                | Lite Product                           | Pre-qualification candidate state                                                                                                                             |
| Qualification Decision               | Lite Product, explicit human Principal | Explicit decision over candidate; still not formal Opportunity mutation                                                                                       |
| Formal Trademark Service Opportunity | **MarkReg**                            | In this bounded trademark-service loop it is formal service-domain business state and the Canon example routes confirmed trademark opportunities into MarkReg |
| MarkReg Intake                       | MarkReg                                | Existing owner and existing intake semantics                                                                                                                  |
| Order / Matter / lifecycle           | MarkReg                                | Existing proven owner boundaries                                                                                                                              |
| protected work/review where required | Execution                              | Existing governed execution boundary                                                                                                                          |

### Why Formal Opportunity is not added to Core

The approved architecture says formal business facts are changed by the proper Owning Service, while Products compose journeys and must not absorb system authority. The current Product evidence is specific to a trademark-service conversion path, and the Canon's concrete trademark-opportunity example ends with MarkReg creating the formal business record.

Therefore PLC-WP-01 does **not** create a universal Core `Opportunity` object or shared Opportunity service.

Future Products may prove a repeated cross-Product Opportunity responsibility. Only then may shared extraction be considered.

## 4. Canonical state line

```text
exact governed source(s)
-> Lite Today Recommendation
-> Lite Prepared Action
-> explicit user confirmation
-> Lite candidate/preparation state
-> explicit Human Review / Qualification where required
-> proper Owning Service handoff
-> MarkReg formal trademark-service Opportunity / Intake
-> existing Order / Matter / Execution / outcome path
-> Lite Product feedback
```

The line deliberately separates candidate/preparation state from formal mutation.

## 5. Content line

```text
Content Opportunity
!= publishable content

Content Draft
!= approved content

Human Review approval
= approval to prepare PublishPackage only

PublishPackage
!= Published

USER_REPORTED_PUBLISHED feedback
!= MarkOrbit executed publication
!= independently verified publication truth
```

No stage in PLC-WP-01 authorizes social posting, customer communication or other external action.

## 6. Opportunity line

```text
Opportunity Candidate
-> explicit human Qualification Decision
-> separate MarkReg owner mutation
-> Formal Trademark Service Opportunity
-> separately confirmed MarkReg Intake handoff
```

Permanent separations:

```text
Opportunity Candidate != Formal Opportunity
Qualification Decision != Formal Opportunity mutation
Formal Opportunity != Intake
Intake != Order
Order != Matter
Matter != Filing
```

Creating the formal Opportunity does not contact a customer, create an Order/Matter, make a Payment, appoint a provider or file anything.

## 7. Today Recommendation versus lifecycle Recommended Action

The two concepts are related but intentionally not identical.

### MarkReg Recommended Action

- owner: MarkReg;
- source: exact Lifecycle View;
- requires Formal Matter lineage;
- purpose: lifecycle advice;
- `executionAuthorized = false`.

### Lite Today Recommendation

- owner: Lite Product;
- source: one or more exact governed Product-loop sources;
- may originate from Knowledge, trademark/customer context, lifecycle advice, manual work signals or feedback;
- purpose: explain what deserves attention and what Product action can be prepared next;
- `executionAuthorized = false`.

This preserves existing Milestone 5 semantics instead of widening them for implementation convenience.

## 8. Human Review boundary

PLC-WP-01 requires explicit Human Review before a Content Draft may produce a PublishPackage.

The bounded content-review record:

- records exact draft version/fingerprint;
- records authenticated reviewer Principal identity;
- records rationale/outcome;
- may approve only package preparation;
- does not publish externally.

PLC-WP-01 does not claim that every content review must use the existing Matter-specific Execution Professional Review workflow. If a later Product action becomes a protected external Communication, that action must use the appropriate governed Execution boundary before it can execute.

## 9. Source and provenance lock

Every recommendation/candidate/preparation record that depends on upstream facts must retain stable owner-produced provenance:

- source owner;
- source kind;
- source identifier;
- source version or equivalent stable version token;
- SHA-256 fingerprint or equivalent stable owner-produced fingerprint;
- observed time;
- correlation lineage where available.

Request-body identity does not become source authority merely because a Product received it.

No cross-service SQL is permitted.

## 10. AI authority

AI may:

- summarize governed sources;
- explain why a Today item matters;
- recommend a bounded next step;
- draft Content;
- prepare candidate material.

AI may not:

- confirm on behalf of the user;
- approve Content;
- publish externally;
- contact a customer;
- qualify an Opportunity Candidate;
- create a Formal Opportunity;
- create Order/Matter state;
- appoint a provider;
- perform Payment;
- submit a filing;
- create Official Truth.

## 11. No-automatic-consequence lock

Candidate/preparation/confirmation contracts retain false consequences for:

- external publication;
- automatic customer contact;
- automatic Formal Opportunity creation;
- automatic Order creation;
- automatic Matter creation;
- Payment;
- provider appointment;
- Filing Submission;
- Official Truth.

The proper Owning Service may later perform an explicitly authorized formal mutation. That mutation is not implied by the prior Product state.

## 12. Non-goals

PLC-WP-01 does not create:

- database migrations;
- Lite runtime repositories;
- MarkReg Opportunity runtime persistence;
- Gateway routes;
- UI changes;
- automatic publishing;
- outreach automation;
- a CRM platform;
- a universal Artifact table/service;
- a universal Opportunity service;
- a generic Workplace service;
- a physical Brain/Value Factory/Intelligence service;
- M6 Capability learning runtime;
- Payment/Invoice;
- provider appointment;
- external Filing Submission;
- Official Truth.

## 13. Next implementation boundary

After PLC-WP-01 is merged, the next authorized stage item is `PLC-WP-02 — Durable Product-owned Content preparation state` only after the owner authorizes continuation under the repository task/PR rules.
