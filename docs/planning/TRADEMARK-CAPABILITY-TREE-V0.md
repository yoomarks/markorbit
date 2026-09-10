# Trademark Professional Capability Tree V0

- **Issue:** #1075
- **Lane:** L2 — Capability / Cordis
- **Planning baseline:** `9a2c7940cb88dfd26fb047e57ebbfda4c0a5494e`
- **Status:** `PLANNING_ONLY / NON_CANONICAL`
- **Companion wall:** `docs/planning/TRADEMARK-CAPABILITY-WALL-V0.md`
- **Production authority:** false

## 1. Purpose

This document maps the trademark professional task space before any new domain Capability is admitted. It is a planning tree, not a Capability registry and not a grant of legal, filing, payment, communication or publication authority.

The locked Capability canon remains:

```text
Capability Domain
  -> Capability
    -> Skill
      -> Action / Invocation
```

and:

```text
Capability = Stable Outcome Contract
           + Governed Implementation
           + Evidence Base
           + Version Lineage
           + Controlled Evolution
```

A task slot in this document is therefore **not** a Capability ID. A current Product/MarkReg contract, Brain Method, workflow, provider or UI surface also does not become a Capability merely because it covers part of a task.

## 2. Planning coordinate model

Each professional task is viewed across four axes:

- **Lifecycle:** intake, search, filing, prosecution, registration/recordal, maintenance, monitoring/dispute, commercialization, publication, service/execution.
- **Jurisdiction:** global/common pattern, national office, Madrid/IR, or a bounded jurisdiction-specific variant such as US.
- **Role:** owner/applicant, attorney/agent, portfolio manager, paralegal/operations, professional reviewer, client-service operator.
- **Work type:** intake, research, reasoning, drafting, evidence, review, execution preparation, protected action, monitoring, communication, reporting.

The slot IDs such as `TM-PRO-FIL-03` are **planning coordinates only**. They must never be used as runtime Capability IDs without a later admission decision.

## 3. Separation of professional tree and foundation dependencies

Trademark professional outcomes sit above shared foundation capabilities and owner substrates. Do not mix these into one taxonomy.

```text
Trademark professional task/outcome
        |
        +--> Capability Runtime / Implementation Profile
        +--> Managed AI Execution where AI assistance is admitted
        +--> Managed Communication where communication is admitted
        +--> Governed Document Understanding when/if released from HOLD
        +--> Governed Retrieval when/if released from HOLD
        +--> Execution / protected-action owner for consequential acts
        +--> MarkReg / Data Engine / Knowledge / Core owner truth
        +--> Social / Media bounded owners for publication-side facts
```

Foundation dependencies support a professional Capability; they do not count as professional coverage by themselves.

## 4. Cordis specialization rule

Workspace-local specialization remains an implementation/context concern, not a reason to fork the professional tree.

For any later admitted trademark Capability:

```text
same stable professional Capability
        |
        +--> Workspace A: MO-default approved implementation/profile
        |
        +--> Workspace B: Workspace-local approved implementation/profile
                            + local Skill
                            + local Case Knowledge
                            + local policy/preferences
```

The browser/product caller must not gain provider/model/endpoint/credential/implementation authority. Workspace-local Knowledge or Skill may specialize reasoning and execution only through governed context and approved Implementation Profiles.

## 5. Professional task tree — 80 planning slots

### A. Intake & Portfolio Context (`TM-PRO-INT-*`)

Candidate outcome family: **Trademark Context Readiness**. This is not an admitted Capability name.

1. `TM-PRO-INT-01` — create/admit a workspace trademark asset anchor.
2. `TM-PRO-INT-02` — capture applicant/owner/client identity context.
3. `TM-PRO-INT-03` — capture target jurisdiction scope and filing/service goal.
4. `TM-PRO-INT-04` — capture mark representation and raw goods/services context.
5. `TM-PRO-INT-05` — bulk portfolio intake/import and duplicate handling.
6. `TM-PRO-INT-06` — surface source freshness, conflict and missing context.
7. `TM-PRO-INT-07` — prepare a missing-information / evidence checklist.
8. `TM-PRO-INT-08` — reconcile workspace context against source-owned official facts for human review.

### B. Search & Clearance (`TM-PRO-CLR-*`)

Candidate outcome family: **Search / Clearance Readiness**. No current canonical trademark clearance Capability is implied.

1. `TM-PRO-CLR-01` — exact/near-exact register knockout search.
2. `TM-PRO-CLR-02` — visual/phonetic/conceptual similarity search.
3. `TM-PRO-CLR-03` — goods/services and class overlap analysis.
4. `TM-PRO-CLR-04` — owner/related-entity and filing-pattern context review.
5. `TM-PRO-CLR-05` — common-law, web, marketplace or non-register evidence research.
6. `TM-PRO-CLR-06` — evidence-backed clearance risk synthesis.
7. `TM-PRO-CLR-07` — clearance report / options preparation.
8. `TM-PRO-CLR-08` — professional clearance review and go/modify/stop decision preparation.

### C. Filing Strategy & Application Preparation (`TM-PRO-FIL-*`)

Candidate outcome family: **Filing Strategy / Readiness**, matching a roadmap-only domain candidate.

1. `TM-PRO-FIL-01` — jurisdiction/route strategy for a new application.
2. `TM-PRO-FIL-02` — mark representation / drawing strategy.
3. `TM-PRO-FIL-03` — filing-basis / entitlement facts review.
4. `TM-PRO-FIL-04` — Nice class and goods/services specification strategy.
5. `TM-PRO-FIL-05` — official-fee and filing-cost fact preparation.
6. `TM-PRO-FIL-06` — application requirements / supporting-document checklist.
7. `TM-PRO-FIL-07` — provider/service-package/quote preparation.
8. `TM-PRO-FIL-08` — application package readiness and protected filing handoff.

### D. Prosecution & Examination (`TM-PRO-PRO-*`)

Candidate outcome family: **Prosecution Response Readiness**.

1. `TM-PRO-PRO-01` — office action / examination notice intake and source verification.
2. `TM-PRO-PRO-02` — objection/refusal issue classification.
3. `TM-PRO-PRO-03` — evidence and missing-fact collection for response.
4. `TM-PRO-PRO-04` — response strategy/options synthesis.
5. `TM-PRO-PRO-05` — amendment, limitation or deletion option preparation.
6. `TM-PRO-PRO-06` — response draft / instruction package preparation.
7. `TM-PRO-PRO-07` — deadline and extension review for professional confirmation.
8. `TM-PRO-PRO-08` — protected response-filing handoff and receipt reconciliation.

### E. Registration, Recordal & Ownership Changes (`TM-PRO-REC-*`)

Candidate outcome family: **Registration / Recordal Readiness**.

1. `TM-PRO-REC-01` — registration/certificate evidence intake and reconciliation.
2. `TM-PRO-REC-02` — certificate reissue/replacement preparation.
3. `TM-PRO-REC-03` — assignment/transfer recordal preparation.
4. `TM-PRO-REC-04` — owner name/address change preparation.
5. `TM-PRO-REC-05` — licence/other recordal preparation.
6. `TM-PRO-REC-06` — restoration/revival preparation.
7. `TM-PRO-REC-07` — Madrid/IR designation/recordal routing and dependency review.
8. `TM-PRO-REC-08` — chain-of-title / recordal evidence reconciliation.

### F. Renewal, Maintenance & Use (`TM-PRO-MNT-*`)

Candidate outcome family: **Renewal / Maintenance Readiness**, matching a roadmap-only domain candidate.

1. `TM-PRO-MNT-01` — renewal eligibility/readiness review.
2. `TM-PRO-MNT-02` — use declaration / maintenance filing readiness.
3. `TM-PRO-MNT-03` — specimen/use-evidence collection and coverage mapping.
4. `TM-PRO-MNT-04` — maintenance deadline proximity and professional deadline review.
5. `TM-PRO-MNT-05` — retained/deleted goods/services review.
6. `TM-PRO-MNT-06` — renewal/maintenance package and quote preparation.
7. `TM-PRO-MNT-07` — protected maintenance filing and receipt reconciliation.
8. `TM-PRO-MNT-08` — multi-jurisdiction portfolio maintenance calendar/readiness view.

### G. Monitoring, Watch & Dispute Readiness (`TM-PRO-MON-*`)

Candidate outcome families include **Trademark Monitoring & Change Interpretation** and **Brand Risk / Protection Assessment**, both roadmap-only today.

1. `TM-PRO-MON-01` — watch/monitoring service intent and target setup.
2. `TM-PRO-MON-02` — source-owned registry/status change detection and explanation.
3. `TM-PRO-MON-03` — deadline/date-proximity attention signal without deadline certification.
4. `TM-PRO-MON-04` — stale/conflicting source triage and verification request.
5. `TM-PRO-MON-05` — third-party similar-mark monitoring and evidence capture.
6. `TM-PRO-MON-06` — opposition/cancellation/invalidity opportunity or threat triage.
7. `TM-PRO-MON-07` — infringement/brand-risk evidence synthesis.
8. `TM-PRO-MON-08` — dispute escalation / counsel-review package preparation.

### H. Commercialization, Licensing & Transactions (`TM-PRO-COM-*`)

Candidate outcome family: **Trademark Transaction Readiness**.

1. `TM-PRO-COM-01` — workspace sale intent / seller-relationship declaration.
2. `TM-PRO-COM-02` — asking-price, negotiability and territory context preparation.
3. `TM-PRO-COM-03` — commercial direction / showcase package preparation.
4. `TM-PRO-COM-04` — acquisition / sale due-diligence checklist and evidence pack.
5. `TM-PRO-COM-05` — assignment transaction readiness and recordal handoff.
6. `TM-PRO-COM-06` — licence transaction readiness and recordal handoff.
7. `TM-PRO-COM-07` — ownership/representation authority verification request and evidence review.
8. `TM-PRO-COM-08` — transaction closing / transfer evidence reconciliation without creating payment or title truth.

### I. Content, Brand & Publication Support (`TM-PRO-PUB-*`)

Candidate outcome family: **Content Intelligence & Publication Preparation**, matching a roadmap-only domain candidate.

1. `TM-PRO-PUB-01` — trademark/brand content candidate preparation from governed asset context.
2. `TM-PRO-PUB-02` — brand narrative / showcase preparation.
3. `TM-PRO-PUB-03` — media asset/rights suitability review for a content package.
4. `TM-PRO-PUB-04` — exact PublishPackage / channel-target preparation.
5. `TM-PRO-PUB-05` — Social distribution intent and target preparation.
6. `TM-PRO-PUB-06` — protected publication execution and platform receipt reconciliation.
7. `TM-PRO-PUB-07` — time-bounded content/social performance observation.
8. `TM-PRO-PUB-08` — comment/inquiry triage and reply-draft preparation without send authority.

### J. Client Service, Execution & Reporting (`TM-PRO-SER-*`)

Candidate outcome family: **Client Opportunity / Service Readiness**, matching a roadmap-only domain candidate where applicable.

1. `TM-PRO-SER-01` — service option/recommendation preparation from admitted source evidence.
2. `TM-PRO-SER-02` — user selection / instruction capture.
3. `TM-PRO-SER-03` — non-binding quote preparation with official/service/disbursement assumptions.
4. `TM-PRO-SER-04` — client information request draft preparation.
5. `TM-PRO-SER-05` — provider enquiry / provider instruction draft preparation.
6. `TM-PRO-SER-06` — explicit execution authorization record and constraints.
7. `TM-PRO-SER-07` — protected-action release / owner-domain handoff.
8. `TM-PRO-SER-08` — execution evidence, recovery, lifecycle handoff and client-facing status/report preparation.

## 6. Current evidence anchors — not Capability admission

Current main already contains useful bounded objects and methods that explain why many wall slots are `CURRENT_PARTIAL` rather than `EMPTY`:

- `markreg-early-funnel.ts` — intake, recommendation-source references, user selection, fee facts and quote artifacts with no automatic professional/legal/filing authority.
- `trademark-asset-workspace.ts` / `trademark-asset-portfolio.ts` — workspace-private asset anchors, source lineage, freshness, attention and portfolio operations without official-truth authority.
- `trademark-asset-management.ts` — management signals, recommendations, dispositions and user-confirmed handoffs without deadline certification, legal conclusion or protected execution.
- `trademark-service-workbench.ts` — service intent, requirement candidates, missing inputs, readiness, non-binding quote and unsent communication preparation.
- `trademark-service-execution.ts` and related execution contracts — explicit authorization, protected-action release, owner handoff, execution evidence and recovery without manufacturing provider acceptance or official truth.
- `brain-us-trademark-mark-representation-method.ts` — one bounded US mark-representation strategy method for human review; it explicitly leaves registrability, clearance, classes, deadlines and legal eligibility unestablished.
- `brain-official-fee-method.ts` — bounded USPTO fee method/evidence lineage; this is a Method, not a trademark professional Capability.
- Trading/Commerce/Product Loop/Media contracts — bounded commercialization, showcase, listing, media and publication-preparation objects; none automatically create legal ownership, valuation, publication or trademark truth.
- Social #1083 audit — owner/authority design only. Proposed Social distribution/comment/performance facts are not implemented professional Capabilities.

## 7. Wall-state semantics

The companion Wall uses only these professional coverage states:

- **`CURRENT_PARTIAL`** — current main has a bounded Product/MarkReg/Brain/Execution object or method that materially covers preparation/evidence/context for the task, but there is **no admitted stable professional Capability** for the full outcome.
- **`ROADMAP_ONLY`** — the Capability Foundation roadmap explicitly names the professional outcome family, but it is not admitted for implementation yet. A slot may also have partial current objects.
- **`EMPTY`** — no sufficiently bounded current professional object/method was found for the core task outcome. Shared foundation infrastructure does not change this to covered.

There is intentionally no `ADMITTED_PROFESSIONAL_CAPABILITY` row in V0 unless a later audit finds an exact accepted Capability definition and release evidence.

## 8. Foundation dependency layer

| Foundation / substrate                      | Current planning status                                      | How the trademark tree may depend on it                            | What it does not prove                                         |
| ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Capability Runtime + Implementation Profile | Current foundation                                           | governed binding/invocation, Workspace-local specialization        | no professional outcome by itself                              |
| `managed-ai-execution`                      | Current foundation; Workspace specialization proved by #1074 | bounded AI-assisted research/drafting/reasoning                    | no legal conclusion, filing, send or official truth            |
| Managed Communication                       | Current foundation contract/runtime line                     | client/provider/authority communication when separately authorized | draft/transport is not professional approval or delivery truth |
| Governed Document Understanding             | Foundation roadmap **HOLD**                                  | future document/evidence extraction dependency                     | not available professional coverage today                      |
| Governed Retrieval                          | Foundation roadmap **HOLD**                                  | future cross-source search/retrieval dependency                    | not trademark search/clearance by itself                       |
| Execution / Protected Action                | Current cross-owner substrate                                | filing/payment/provider/contact/publication handoff                | execution attempt does not equal official acceptance           |
| Data Engine / Knowledge                     | Source owners                                                | authoritative facts / sourced knowledge and provenance             | source data is not professional conclusion                     |
| Brain Methods                               | Current bounded methods                                      | typed, attributable reasoning support                              | Method != Capability; Brain output != canonical truth          |
| Social / Media                              | bounded owner surfaces / planning                            | content rights, distribution, platform observation                 | platform activity != trademark/business/legal truth            |

## 9. Admission rule for a future trademark Capability

A slot may be promoted toward a real Capability only when a separate bounded issue can state:

1. the stable professional outcome and exact non-goals;
2. input/output/evidence/review and authority envelope;
3. owner of professional truth versus source owners;
4. at least one approved Implementation Profile and fallback/fail-closed semantics;
5. Workspace/Principal isolation and Cordis specialization boundary;
6. whether Managed AI, Communication, Document Understanding or Retrieval are implementation dependencies rather than the Capability itself;
7. protected-action boundary for filing, payment, contact, publication or other external consequence;
8. durable provenance, replay and review evidence;
9. cross-product/consumer need if the Capability is proposed as reusable foundation/domain infrastructure;
10. exact-head conformance and controlled release/admission evidence.

Until then, the slot stays a planning coordinate.

## 10. V0 conclusion

The trademark task space is already much broader than the set of current bounded runtime objects. The correct next move is **not** to mint dozens of Capability IDs. The Wall should be used to identify where MarkOrbit already has strong preparation/evidence primitives, where the Foundation roadmap already reserves an outcome family, and where genuine professional capability gaps remain.

The preferred near-term pattern is:

```text
professional task slot
  -> define stable outcome only when justified
  -> reuse current owner facts/methods
  -> reuse Capability Runtime
  -> specialize through Workspace-local context/Profile/Skill/Knowledge
  -> preserve human/protected-action boundaries
  -> admit only with evidence
```
