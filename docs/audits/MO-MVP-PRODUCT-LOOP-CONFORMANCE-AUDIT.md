# MO MVP Product Loop Conformance Audit

- **Task:** `MO-MVP-TASK-031B`
- **Audited baseline:** `ce5e845ee8350341d478ad5372ac1ccbaffe4fb4`
- **Audit type:** architecture/product sequencing conformance
- **Status:** `COMPLETE`
- **Recommendation:** `RESEQUENCE_BEFORE_M6_WP01`
- **Runtime mutation:** none

## 1. Audit question

This audit asks one bounded question:

> Does the current MVP implementation sequence still conform to the MarkOrbit publication/Canon principle **Product Loop First, Shared Platform Extraction Second**, or should the approved Milestone 6 Capability Learning work be sequenced after a real Product-loop closure step?

This audit does not reopen the authority boundaries already proven in Milestones 2–5. It does not weaken Core, Execution, MarkReg, MGSN, review, evidence, lifecycle, idempotency, privacy or tenant-isolation requirements.

## 2. Canonical basis

The audit is grounded in the current MarkOrbit Books 01–07, Active Architecture Canon, accepted Capability Canon, repository `AGENTS.md`, `docs/product/MVP-PRODUCT-LOCK.md` and `docs/planning/FOUR-WEEK-PLAN.md`.

The controlling architectural statements are:

- MarkOrbit is an operating system for global brand professional services, not only a trademark database, workflow tool, AI assistant or marketplace;
- each Organization Workplace is an independent Orbit and retains its own clients, data, knowledge, rules, pricing, relationships, commercial autonomy and professional responsibility;
- shared foundations do not require centralized ownership;
- Core defines shared semantics;
- Execution governs coordinated work;
- Workplace supplies authorized organizational context;
- Products compose domain user journeys;
- MGSN connects independent Workplaces;
- Owning Services mutate formal business state;
- human professionals remain accountable;
- AI assists under governance;
- derived outputs remain candidates until explicit validation/promotion;
- **Product value loops should be validated before responsibilities are extracted into shared platform services.**

The Workplace publication explicitly gives the development sequence:

```text
Product problem
-> Product loop
-> user validation
-> repeated architectural need
-> shared capability extraction
```

It also explicitly states that MarkOrbit does **not** need to build a universal Workplace application before validating concrete Product loops.

The confirmed Lite product mainline is equally important:

```text
Today
-> Recommendation
-> Prepared Action
-> User Confirmation
-> Product / Workflow Handoff
```

Lite is meant to help an independent professional **discover value, organize today and prepare action**. Content, Asset, Marks, Quote, Global and Leads are supporting capabilities behind concrete actions; they are not intended to become a set of equal top-level systems that the user must understand before receiving value.

## 3. Repository product lock

The MVP Product Lock requires five Beta loops:

1. Content loop;
2. Opportunity loop;
3. Direct-customer application loop;
4. Professional application loop;
5. Capability learning loop.

The four-week plan also requires the Week 2 product outcome:

```text
one trademark
-> recommendation
-> content package
-> opportunity
with traceable sources
```

and Week 4 learning behavior:

```text
Capability Profile
+ Twin projection
+ Ledger
+ private Reflection Candidate
```

The intended order therefore connects product value creation to later learning rather than treating learning infrastructure as an isolated subsystem.

## 4. Current runtime evidence

### 4.1 Strongly implemented backbone

Milestones 2–5 established substantial governed runtime depth:

- authenticated Core Session / Workspace Principal boundaries;
- durable MarkReg customer confirmation, Matter, document and commercial state;
- durable professional review and Evidence Review Decision;
- durable Order-to-Matter linkage;
- MGSN Provider Registry, Supply Capability, Eligibility, Allocation, Provider Acceptance and Provider Return;
- exact Execution evidence handoff;
- reviewed-source admission and correction path;
- durable MarkReg Lifecycle Projection;
- explainable, non-executing Recommended Action;
- authenticated customer and operations projections;
- restart, replay, idempotency, isolation, redaction, concurrency and browser reliability gates.

This work is architecturally important. The audit does **not** classify Milestones 2–5 as wasted work or premature implementation.

### 4.2 Lite runtime breadth is incomplete

`apps/lite-web/src/App.tsx` currently advertises the navigation concepts:

```text
Today
Matters
Content
Opportunities
Trademarks
Work
Capability
Guide
```

but its current runtime `Surface` union is limited to:

```text
today
matters
customers
opportunities
professional-review
execution-release
```

`Content`, `Trademarks`, `Capability` and `Guide` therefore do not yet have equivalent real runtime journeys.

The current Opportunities implementation is explicitly fixture-backed through:

- `apps/lite-web/src/features/opportunities/fixture-repository.ts`;
- `apps/lite-web/src/features/opportunities/view-models.ts`.

The UI correctly preserves candidate/decision boundaries, but it does not yet prove a durable Opportunity lifecycle or a real Content-to-Opportunity conversion path.

### 4.3 Lite information architecture has drifted from the confirmed product mainline

The problem is not simply that some navigation entries lack implementation.

The confirmed product decision says Lite must not use a set of parallel modules as its mainline. The primary experience is:

```text
Today
-> Recommendation
-> Prepared Action
-> User Confirmation
-> Product / Workflow Handoff
```

The current primary navigation instead presents domain/module concepts such as `Content`, `Opportunities`, `Trademarks`, `Work`, `Capability` and `Guide` beside `Today`.

That is a product-conformance drift risk. Implementing each missing navigation tab as an equal first-class module would deepen the drift rather than close the Product loop.

The next stage must therefore prove the **Today-to-Handoff user loop**. Content and Opportunity behavior may have detail/index surfaces, but those surfaces must support the mainline instead of replacing it.

### 4.4 Knowledge and AI remain skeletons

`services/knowledge/src/index.ts` currently creates only the service runtime/manifest and exposes no substantive knowledge/provenance Product loop.

`packages/ai/src/index.ts` currently exports only the package name.

This is consistent with an early foundation, but it means the current repository does not yet prove the publication-level knowledge/intelligence/content growth path.

The audit explicitly does **not** recommend responding by creating a generic Brain, Value Factory or Intelligence service. The publication defines those as logical responsibilities first and warns against premature platform extraction.

### 4.5 Capability Engine remains an early fixture path

`services/capability-engine/src/index.ts` currently uses an in-memory repository and creates a hard-coded:

```text
capabilityId = trademark-application-recommendation
capabilityVersion = 0.1.0-fixture
```

Milestone 6 was correctly proposed to replace that fixture with durable Capability lineage, observations, ledger, reflection and private profile behavior.

However, that learning path would currently learn mainly from the already-deep application/execution backbone while the Content and Opportunity Product loops remain unvalidated.

## 5. Five-loop conformance matrix

| Beta loop                   | Current evidence                                                                                                                                | Audit state                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Content                     | No real Today -> Prepared Content Action -> review/publish-package -> feedback path                                                             | `NOT_CLOSED`                   |
| Opportunity                 | Fixture-backed list/detail and candidate-safe UX exist; no proven durable candidate -> qualification -> formal Opportunity -> work handoff loop | `NOT_CLOSED`                   |
| Direct-customer application | Durable intake/commercial/Matter/lifecycle path is materially implemented                                                                       | `CLOSED_FOR_CURRENT_MVP_SCOPE` |
| Professional application    | Durable review/admission/execution/provider/evidence/lifecycle path is materially implemented                                                   | `CLOSED_FOR_CURRENT_MVP_SCOPE` |
| Capability learning         | TASK 031A was approved by merge of PR #71, but runtime remains fixture/in-memory and implementation has not started                             | `APPROVED_NOT_STARTED`         |

## 6. Findings

### `FINDING-01 — PRODUCT_LOOP_DEPTH_IMBALANCE`

The repository has developed substantially more depth in transaction/execution/governance than in the attraction/content/opportunity side of the MVP Product Lock.

This is not an authority defect. It is a sequencing defect risk.

If `M6-WP-01` through `M6-WP-08` proceed immediately, MarkOrbit could complete another deep shared subsystem while two earlier Beta Product loops remain fixture-level or absent.

That would move the repository toward the failure mode described by the Workplace principle: shared abstractions becoming more mature than the Product loops that justify them.

### `FINDING-02 — WORKPLACE_ABSENCE_IS_NOT_THE_DEFECT`

The repository does not need a large universal Workplace application before proceeding.

The publication explicitly allows Workplace responsibilities to emerge through concrete Product installations and to be extracted only after repeated/stable needs are observed.

Therefore this audit does **not** recommend creating a new generic `workplace` service, database, application or abstraction layer now.

### `FINDING-03 — M6_DIRECTION_REMAINS_CANONICAL`

`DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION` remains aligned with the ecosystem-learning objective.

The problem is timing, not semantic direction.

The approved M6 scope should be preserved as an approved future milestone rather than rewritten or discarded.

### `FINDING-04 — APPROVAL_STATE_DOCUMENTATION_DRIFT`

PR #71 merged as `ce5e845ee8350341d478ad5372ac1ccbaffe4fb4`, which is owner approval of TASK 031A under the PR's own approval consequence.

At the audited baseline, `docs/planning/TASK-INDEX.md` and the M6 planning documents still describe TASK 031A as proposed/planning-only.

This is documentation drift. The sequencing decision must record the real current state so future agents do not mistake historical proposal language for current authorization state.

### `FINDING-05 — LITE_INFORMATION_ARCHITECTURE_DRIFT`

The confirmed Lite mainline is `Today -> Recommendation -> Prepared Action -> User Confirmation -> Product / Workflow Handoff` and the product decision explicitly rejects a parallel-module menu as the main product model.

The current primary navigation presents multiple product/domain concepts as equal primary destinations.

The corrective action is **not** to implement every missing navigation destination as another equal module. The corrective action is to make Today the organizing product surface and prove that a real recommendation can become a prepared action, receive explicit user confirmation and hand off into the proper Product/Workflow while preserving source, authority and outcome feedback.

## 7. Recommended Product-loop closure target

Before `M6-WP-01`, the audit recommends proving one bounded **Lite Growth-to-Work Product Loop** using the confirmed Lite mainline:

```text
Today
-> traceable Recommendation
-> Prepared Action
   -> content preparation / PublishPackage path
   OR
   -> opportunity qualification / service path
-> explicit User Confirmation
-> Product / Workflow Handoff
-> existing MarkReg / Execution / MGSN path where applicable
-> Outcome / Feedback
-> Today context can reflect the result
```

One concrete content-to-opportunity scenario should prove the deeper growth chain:

```text
trusted trademark / client / work context
-> traceable information or knowledge input
-> Content Opportunity
-> Content draft / Artifact preparation
-> Human Review
-> prepared PublishPackage
-> explicit/manual publication feedback or work signal
-> Lead / Opportunity Candidate
-> explicit human qualification
-> Formal Opportunity
-> MarkReg or professional work handoff
-> existing Matter / Execution / outcome path
```

For this stage, external publishing automation, social-network integrations and broad marketing analytics are not required. A controlled/manual publish-feedback boundary is sufficient if provenance and explicit human decisions are preserved.

The loop must reuse existing Core/Execution/MarkReg/Gateway/Workspace Principal boundaries instead of creating parallel semantics.

## 8. Minimum closure evidence

The Product-loop closure stage should not be declared complete until it proves:

- Today is the organizing Lite surface for the new journey;
- one real Recommendation -> Prepared Action -> Confirmation -> Handoff path;
- one real content-preparation detail path tied to source/provenance;
- explicit Human Review before any publish-ready state;
- `PublishPackage != Published`;
- manual/controlled feedback may record that publication or external use happened, without the system claiming the external action occurred merely because a package was prepared;
- one durable Lead/Opportunity Candidate path;
- explicit qualification/promotion before Formal Opportunity creation;
- `Opportunity Candidate != Formal Opportunity`;
- one real Formal Opportunity -> existing MarkReg/professional work handoff;
- Workspace/organization isolation and active context preservation;
- no automatic customer contact, provider appointment, filing, payment or protected external action;
- browser/reload/restart path for the new Today/Prepared Action journey and supporting detail surfaces;
- outcome/feedback events sufficient for later Capability learning to consume real Product evidence;
- no generic Workplace/Brain/Value-Factory/Artifact service extraction unless repeated Product behavior proves the need.

## 9. Sequencing recommendation

The recommended sequence is:

```text
M1-M5 governed execution backbone (complete)
-> Product Loop Closure stage (Lite Today -> Action -> Work -> Feedback)
-> M6 Capability Learning and Private Reflection
-> later shared extraction only where repeated Product behavior justifies it
```

This preserves the approved M6 scope while restoring the publication order:

```text
Product Loop First
-> Shared Learning / Platform Extraction Second
```

## 10. Authority and non-goals

This audit does not authorize:

- automatic Publish;
- bulk outreach;
- customer contact without explicit authority;
- public Opportunity ranking;
- automatic Opportunity promotion;
- Payment/Invoice;
- legal or professional appointment;
- external Filing Submission;
- Official Truth creation;
- automatic Capability verification;
- Capability Canon mutation;
- public Capability scoring/ranking;
- cross-service SQL;
- a universal Workplace service;
- a universal Brain, Value Factory, Intelligence or Artifact service;
- production GA claim.

## 11. Final recommendation

**Recommendation: `RESEQUENCE_BEFORE_M6_WP01`.**

Do not start M6 runtime implementation from the audited baseline.

First approve and implement a bounded Product Loop Closure stage that proves the canonical Lite `Today -> Recommendation -> Prepared Action -> User Confirmation -> Handoff -> Outcome/Feedback` journey, including one real Content-to-Opportunity-to-Work scenario.

After that stage produces governed real-product evidence, resume the already-approved Milestone 6 Capability Learning scope against that richer evidence base.

This is a sequencing correction, not a rejection of Milestone 6 and not a rewrite of the MarkOrbit constitutional architecture.
