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

- MarkOrbit is an operating system for global brand professional services, not only a trademark database, workflow tool, AI assistant or marketplace.
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

### 4.2 Lite surface breadth is ahead of runtime breadth

`apps/lite-web/src/App.tsx` advertises the navigation concepts:

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

`Content`, `Trademarks`, `Capability` and `Guide` are therefore not yet independent operating surfaces.

The current Opportunities implementation is explicitly fixture-backed through:

- `apps/lite-web/src/features/opportunities/fixture-repository.ts`;
- `apps/lite-web/src/features/opportunities/view-models.ts`.

The UI correctly preserves candidate/decision boundaries, but it does not yet prove a durable Opportunity lifecycle or a real Content-to-Opportunity conversion path.

### 4.3 Knowledge and AI remain skeletons

`services/knowledge/src/index.ts` currently creates only the service runtime/manifest and exposes no substantive knowledge/provenance product loop.

`packages/ai/src/index.ts` currently exports only the package name.

This is consistent with an early foundation, but it means the current repository does not yet prove the publication-level knowledge/intelligence/content growth path.

### 4.4 Capability Engine remains an early fixture path

`services/capability-engine/src/index.ts` currently uses an in-memory repository and creates a hard-coded:

```text
capabilityId = trademark-application-recommendation
capabilityVersion = 0.1.0-fixture
```

Milestone 6 was correctly proposed to replace that fixture with durable Capability lineage, observations, ledger, reflection and private profile behavior.

However, that learning path would currently learn mainly from the already-deep application/execution backbone while the Content and Opportunity Product loops remain unvalidated.

## 5. Five-loop conformance matrix

| Beta loop | Current evidence | Audit state |
|---|---|---|
| Content | Navigation concept exists; no independent real Lite Content surface; no real content package -> reviewed publish-preparation -> feedback loop | `NOT_CLOSED` |
| Opportunity | Fixture-backed list/detail and candidate-safe UX exist; no proven durable candidate -> qualification -> formal Opportunity -> MarkReg handoff loop | `NOT_CLOSED` |
| Direct-customer application | Durable intake/commercial/Matter/lifecycle path is materially implemented | `CLOSED_FOR_CURRENT_MVP_SCOPE` |
| Professional application | Durable review/admission/execution/provider/evidence/lifecycle path is materially implemented | `CLOSED_FOR_CURRENT_MVP_SCOPE` |
| Capability learning | Approved M6 scope exists, but runtime remains fixture/in-memory and implementation has not started | `APPROVED_NOT_STARTED` |

## 6. Primary finding

### `FINDING-01 — PRODUCT_LOOP_DEPTH_IMBALANCE`

The repository has developed substantially more depth in transaction/execution/governance than in the attraction/content/opportunity side of the MVP Product Lock.

This is not an authority defect. It is a sequencing defect risk.

If `M6-WP-01` through `M6-WP-08` proceed immediately, MarkOrbit could complete another deep shared subsystem while two earlier Beta Product loops remain fixture-level or absent.

That would move the repository toward the failure mode described by the Workplace principle:

> shared abstractions becoming more mature than the Product loops that justify them.

## 7. Secondary findings

### `FINDING-02 — WORKPLACE_ABSENCE_IS_NOT_THE_DEFECT`

The repository does not need a large universal Workplace application before proceeding.

The publication explicitly allows Workplace responsibilities to emerge through concrete Product installations and to be extracted only after repeated/stable needs are observed.

Therefore this audit does **not** recommend creating a new generic `workplace` service, database, application or abstraction layer now.

### `FINDING-03 — M6_DIRECTION_REMAINS_CANONICAL`

`DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION` remains aligned with the ecosystem-learning objective.

The problem is timing, not semantic direction.

The approved M6 scope should be preserved as an approved future milestone rather than rewritten or discarded.

### `FINDING-04 — APPROVAL_STATE_DOCUMENTATION_DRIFT`

PR #71 merged on baseline `ce5e845ee8350341d478ad5372ac1ccbaffe4fb4`, which is owner approval of TASK 031A under the PR's own approval consequence.

At the audited baseline, `docs/planning/TASK-INDEX.md` and the M6 planning documents still describe TASK 031A as proposed/planning-only.

This is documentation drift. It must be reconciled in the sequencing decision work before implementation starts so future agents do not mistake historical proposal text for current authorization state.

## 8. Recommended Product-loop closure target

Before `M6-WP-01`, the audit recommends proving one bounded **Growth-to-Work Product Loop** that closes both the Content and Opportunity gaps without creating a universal platform subsystem:

```text
trusted trademark / client / work context
-> traceable information or knowledge input
-> Content Opportunity
-> Content draft / Artifact preparation
-> Human Review
-> prepared PublishPackage (not automatic publication)
-> audience / relationship / work signal
-> Opportunity Candidate
-> explicit human qualification
-> Formal Opportunity
-> MarkReg or professional work handoff
-> existing Matter / Execution / outcome path
```

For the MVP, external publishing automation, social-network integrations and broad marketing analytics are not required to prove this loop. A controlled/manual publish or feedback boundary is sufficient if provenance and explicit human decisions are preserved.

The loop must reuse existing Core/Execution/MarkReg/Gateway/Workspace Principal boundaries instead of creating parallel semantics.

## 9. Minimum closure evidence

The Product-loop closure stage should not be declared complete until it proves:

- one real Lite Content surface rather than navigation-only state;
- one traceable content preparation path tied to source/provenance;
- explicit Human Review before any publish-ready state;
- `PublishPackage != Published`;
- one durable Opportunity Candidate path;
- explicit qualification/promotion before Formal Opportunity creation;
- `Opportunity Candidate != Formal Opportunity`;
- one real Formal Opportunity -> existing MarkReg/professional intake handoff;
- Workspace/organization isolation and active context preservation;
- no automatic customer contact, provider appointment, filing, payment or protected external action;
- browser/reload/restart path for the new Product surfaces;
- measurable outcome/feedback events sufficient for later Capability learning to consume real Product evidence;
- no generic Workplace/Brain/Value-Factory service extraction unless repeated Product behavior proves the need.

## 10. Sequencing recommendation

The recommended sequence is:

```text
M1-M5 governed execution backbone (complete)
-> Product Loop Closure stage (Content + Opportunity -> Work)
-> M6 Capability Learning and Private Reflection
-> later shared extraction only where repeated Product behavior justifies it
```

This preserves the approved M6 scope while restoring the publication order:

```text
Product Loop First
-> Shared Learning / Platform Extraction Second
```

## 11. Authority and non-goals

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
- a universal Brain/Value Factory service;
- production GA claim.

## 12. Final recommendation

**Recommendation: `RESEQUENCE_BEFORE_M6_WP01`.**

Do not start M6 runtime implementation from the audited baseline.

First approve and implement a bounded Product Loop Closure stage that proves a real Content -> Opportunity -> existing work/outcome path. After that stage produces governed real-product evidence, resume the already-approved Milestone 6 Capability Learning scope against that richer evidence base.

This is a sequencing correction, not a rejection of Milestone 6 and not a rewrite of the MarkOrbit constitutional architecture.
