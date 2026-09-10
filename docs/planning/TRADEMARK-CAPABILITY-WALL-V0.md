# Trademark Professional Capability Wall V0

- **Issue:** #1075
- **Lane:** L2 — Capability / Cordis
- **Planning baseline:** `9a2c7940cb88dfd26fb047e57ebbfda4c0a5494e`
- **Status:** `PLANNING_ONLY / NON_CANONICAL`
- **Tree:** `docs/planning/TRADEMARK-CAPABILITY-TREE-V0.md`
- **Slot count:** 80
- **Production authority:** false

## 1. How to read this Wall

This is a living coverage map for trademark professional work. Slot IDs are planning coordinates only; they are **not Capability IDs**.

Professional wall states:

- `CURRENT_PARTIAL` — bounded current object/method exists for context, preparation, evidence or handoff, but no admitted stable professional Capability covers the full outcome.
- `ROADMAP_ONLY` — the Capability Foundation roadmap names the outcome family, but domain implementation/admission remains deferred. Partial current objects may still exist.
- `EMPTY` — no sufficiently bounded current professional object/method covers the core outcome found in the current-main audit.

There are **zero V0 rows labeled as an admitted trademark professional Capability**. Shared foundation capabilities are listed only in the dependency column and do not count as professional coverage.

Dependency abbreviations:

- `CR` — Capability Runtime / Implementation Profile.
- `MAI` — Managed AI Execution.
- `MCOM` — Managed Communication.
- `GDU` — Governed Document Understanding, currently HOLD in Foundation roadmap.
- `GRET` — Governed Retrieval, currently HOLD in Foundation roadmap.
- `EXEC` — existing protected-action / Execution owner substrate.
- `DE/K` — Data Engine / Knowledge source-owner evidence.
- `SOC/MEDIA` — Social/Media bounded owner surfaces; Social is planning/audit where noted.

## 2. Coverage summary

| Professional domain                         |  Slots | Current partial | Roadmap only |  Empty |
| ------------------------------------------- | -----: | --------------: | -----------: | -----: |
| Intake & Portfolio Context                  |      8 |               8 |            0 |      0 |
| Search & Clearance                          |      8 |               1 |            2 |      5 |
| Filing Strategy & Application Preparation   |      8 |               5 |            3 |      0 |
| Prosecution & Examination                   |      8 |               5 |            0 |      3 |
| Registration, Recordal & Ownership Changes  |      8 |               6 |            0 |      2 |
| Renewal, Maintenance & Use                  |      8 |               3 |            5 |      0 |
| Monitoring, Watch & Dispute Readiness       |      8 |               4 |            4 |      0 |
| Commercialization, Licensing & Transactions |      8 |               5 |            0 |      3 |
| Content, Brand & Publication Support        |      8 |               4 |            2 |      2 |
| Client Service, Execution & Reporting       |      8 |               8 |            0 |      0 |
| **Total**                                   | **80** |          **49** |       **16** | **15** |

`CURRENT_PARTIAL` is deliberately conservative: it means “we have a useful bounded primitive,” not “this professional capability is done.”

## 3. Wall

### A. Intake & Portfolio Context

| Slot          | Professional task                                               | Scope  | Primary role           | Work type           | Wall state      | Current evidence                                                   | Foundation deps | Authority hold                                            |
| ------------- | --------------------------------------------------------------- | ------ | ---------------------- | ------------------- | --------------- | ------------------------------------------------------------------ | --------------- | --------------------------------------------------------- |
| TM-PRO-INT-01 | Create/admit workspace trademark asset anchor                   | Global | Portfolio manager      | Intake              | CURRENT_PARTIAL | `trademark-asset-workspace.ts` private Asset Anchor                | CR, DE/K        | Does not verify official status or ownership              |
| TM-PRO-INT-02 | Capture applicant/owner/client identity context                 | Global | Agent / client service | Intake              | CURRENT_PARTIAL | `markreg-early-funnel.ts` applicant input; asset owner/client refs | CR              | Identity/context does not create representation authority |
| TM-PRO-INT-03 | Capture jurisdiction scope and filing/service goal              | Global | Agent                  | Intake              | CURRENT_PARTIAL | ProductionIntake + TrademarkServiceIntent                          | CR              | Goal is not legal strategy approval                       |
| TM-PRO-INT-04 | Capture mark representation and raw goods/services context      | Global | Agent / paralegal      | Intake              | CURRENT_PARTIAL | ProductionIntake trademark + goods/services source text            | CR              | Customer-supplied facts are not office determinations     |
| TM-PRO-INT-05 | Bulk portfolio intake/import and duplicate handling             | Global | Portfolio manager      | Intake / operations | CURRENT_PARTIAL | `trademark-asset-portfolio.ts` bulk import result                  | CR, DE/K        | Import does not create Matter or official truth           |
| TM-PRO-INT-06 | Surface source freshness, conflict and missing context          | Global | Portfolio manager      | Evidence / review   | CURRENT_PARTIAL | Asset freshness + Management Signal dimensions                     | CR, DE/K        | Cannot resolve source conflict or verify official truth   |
| TM-PRO-INT-07 | Prepare missing-information/evidence checklist                  | Global | Paralegal / agent      | Preparation         | CURRENT_PARTIAL | AiGuide checklist + Workbench missing inputs/requirements          | MAI, CR         | Checklist is assistive; no professional approval          |
| TM-PRO-INT-08 | Reconcile workspace context against source-owned official facts | Global | Professional reviewer  | Review              | CURRENT_PARTIAL | source refs + freshness/conflict model                             | DE/K, CR        | Owner source/professional review must establish truth     |

### B. Search & Clearance

| Slot          | Professional task                                      | Scope                 | Primary role          | Work type          | Wall state      | Current evidence                                                           | Foundation deps       | Authority hold                                             |
| ------------- | ------------------------------------------------------ | --------------------- | --------------------- | ------------------ | --------------- | -------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------- |
| TM-PRO-CLR-01 | Exact/near-exact register knockout search              | Multi-jurisdiction    | Agent / searcher      | Research           | CURRENT_PARTIAL | Workbench can prepare `SEARCH_OR_CLEARANCE` service intent only            | GRET, DE/K, CR        | No current governed search outcome or clearance conclusion |
| TM-PRO-CLR-02 | Visual/phonetic/conceptual similarity search           | Multi-jurisdiction    | Agent / searcher      | Research           | EMPTY           | No bounded professional similarity-search outcome found                    | GRET, MAI, DE/K, CR   | Similarity assessment requires evidence + review           |
| TM-PRO-CLR-03 | Goods/services and class overlap analysis              | Multi-jurisdiction    | Agent                 | Reasoning          | EMPTY           | Raw goods/services and class facts exist, but no clearance overlap outcome | GRET, MAI, DE/K, CR   | No registrability/confusion conclusion implied             |
| TM-PRO-CLR-04 | Owner/related-entity and filing-pattern context review | Multi-jurisdiction    | Agent                 | Research           | EMPTY           | Source/asset references exist, not a search synthesis                      | GRET, DE/K            | Identity patterns are not legal conclusions                |
| TM-PRO-CLR-05 | Common-law/web/marketplace evidence research           | Jurisdiction-specific | Searcher / agent      | Research           | EMPTY           | Social acquisition is audit-only; Governed Retrieval is HOLD               | GRET, DE/K, SOC/MEDIA | Acquisition/retrieval does not prove rights or ownership   |
| TM-PRO-CLR-06 | Evidence-backed clearance risk synthesis               | Multi-jurisdiction    | Attorney / agent      | Reasoning / review | ROADMAP_ONLY    | Roadmap: Brand Risk / Protection Assessment                                | MAI, GRET, DE/K, CR   | Professional risk conclusion must remain reviewable        |
| TM-PRO-CLR-07 | Clearance report/options preparation                   | Multi-jurisdiction    | Attorney / agent      | Drafting           | ROADMAP_ONLY    | Roadmap risk + filing-strategy families; no admitted outcome               | MAI, GRET, CR         | Report draft does not create go/no-go authority            |
| TM-PRO-CLR-08 | Go/modify/stop clearance decision preparation          | Multi-jurisdiction    | Professional reviewer | Review             | EMPTY           | No bounded decision object found                                           | MAI, CR               | Human/professional decision required                       |

### C. Filing Strategy & Application Preparation

| Slot          | Professional task                                          | Scope                    | Primary role           | Work type               | Wall state      | Current evidence                                                        | Foundation deps     | Authority hold                                                        |
| ------------- | ---------------------------------------------------------- | ------------------------ | ---------------------- | ----------------------- | --------------- | ----------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| TM-PRO-FIL-01 | Jurisdiction/route strategy for new application            | Global                   | Attorney / agent       | Strategy                | ROADMAP_ONLY    | Roadmap: Filing Strategy / Readiness; intake captures targets           | MAI, GRET, DE/K, CR | Strategy is not filing authorization                                  |
| TM-PRO-FIL-02 | Mark representation/drawing strategy                       | US bounded today         | Attorney / agent       | Reasoning               | CURRENT_PARTIAL | `brain-us-trademark-mark-representation-method.ts`                      | MAI, DE/K, CR       | Method supports human review; legal eligibility unestablished         |
| TM-PRO-FIL-03 | Filing-basis/entitlement facts review                      | US/common pattern        | Attorney / agent       | Review                  | CURRENT_PARTIAL | ProductionFeeFacts stores professionally established filing basis       | DE/K, CR            | Storage of fact does not create a legal-basis method                  |
| TM-PRO-FIL-04 | Nice class and goods/services specification strategy       | Global                   | Attorney / agent       | Strategy / drafting     | ROADMAP_ONLY    | Workbench requirements/intake exist; no admitted strategy outcome       | MAI, GRET, DE/K, CR | Classification/specification requires professional review             |
| TM-PRO-FIL-05 | Official-fee and filing-cost fact preparation              | US pilot / global future | Operations / agent     | Research / calculation  | CURRENT_PARTIAL | `brain-official-fee-method.ts` bounded USPTO fee method + quote objects | DE/K, CR            | Fee fact is not quote/payment/filing authority                        |
| TM-PRO-FIL-06 | Application requirements/supporting-document checklist     | Global                   | Paralegal / agent      | Preparation             | CURRENT_PARTIAL | Workbench requirement candidates + missing inputs                       | GDU, DE/K, CR       | Candidate requirement is not certified legal requirement              |
| TM-PRO-FIL-07 | Provider/service-package/quote preparation                 | Global                   | Client service / agent | Preparation             | CURRENT_PARTIAL | Workbench provider/package/quote candidates + early funnel quote        | MCOM, CR            | Candidate does not engage provider or bind quote                      |
| TM-PRO-FIL-08 | Application package readiness and protected filing handoff | Global                   | Agent / operations     | Review / execution prep | ROADMAP_ONLY    | Filing Strategy/Readiness roadmap + Workbench/Execution handoff         | EXEC, CR            | Explicit authorization/protected action required; acceptance unproven |

### D. Prosecution & Examination

| Slot          | Professional task                                               | Scope                 | Primary role         | Work type              | Wall state      | Current evidence                                                      | Foundation deps          | Authority hold                                              |
| ------------- | --------------------------------------------------------------- | --------------------- | -------------------- | ---------------------- | --------------- | --------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| TM-PRO-PRO-01 | Office action/examination notice intake and source verification | Global                | Paralegal / agent    | Intake / evidence      | CURRENT_PARTIAL | Workbench intent `OFFICE_ACTION_RESPONSE`; source refs/evidence model | GDU, DE/K, CR            | Notice interpretation/official status must be source-backed |
| TM-PRO-PRO-02 | Objection/refusal issue classification                          | Jurisdiction-specific | Attorney / agent     | Reasoning              | EMPTY           | No bounded prosecution-classification outcome found                   | MAI, GDU, GRET, DE/K, CR | Legal issue classification requires professional review     |
| TM-PRO-PRO-03 | Evidence and missing-fact collection for response               | Global                | Paralegal / agent    | Evidence / preparation | CURRENT_PARTIAL | Workbench requirement/missing-input model                             | GDU, DE/K, CR            | Evidence completeness does not establish argument validity  |
| TM-PRO-PRO-04 | Response strategy/options synthesis                             | Jurisdiction-specific | Attorney / agent     | Strategy               | EMPTY           | No admitted response strategy outcome found                           | MAI, GRET, DE/K, CR      | Professional/legal review required                          |
| TM-PRO-PRO-05 | Amendment/limitation/deletion option preparation                | Jurisdiction-specific | Attorney / agent     | Drafting / review      | EMPTY           | Generic Workbench preparation only; no substantive option method      | MAI, DE/K, CR            | Amendment scope/effect is professional decision             |
| TM-PRO-PRO-06 | Response draft/instruction package preparation                  | Jurisdiction-specific | Attorney / agent     | Drafting               | CURRENT_PARTIAL | Workbench communication/provider instruction drafts                   | MAI, MCOM, CR            | Draft != approval != send/file                              |
| TM-PRO-PRO-07 | Deadline/extension review for professional confirmation         | Jurisdiction-specific | Attorney / docketing | Review                 | CURRENT_PARTIAL | timing/deadline requirement + Asset date-proximity signal             | DE/K, CR                 | System explicitly cannot certify legal deadline             |
| TM-PRO-PRO-08 | Protected response filing and receipt reconciliation            | Jurisdiction-specific | Operations / agent   | Protected action       | CURRENT_PARTIAL | Trademark Service Execution release/evidence/lifecycle handoff        | EXEC, CR                 | Attempt/provider return != official acceptance              |

### E. Registration, Recordal & Ownership Changes

| Slot          | Professional task                                            | Scope     | Primary role             | Work type              | Wall state      | Current evidence                                                     | Foundation deps           | Authority hold                                            |
| ------------- | ------------------------------------------------------------ | --------- | ------------------------ | ---------------------- | --------------- | -------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------- |
| TM-PRO-REC-01 | Registration/certificate evidence intake and reconciliation  | Global    | Portfolio manager        | Evidence               | CURRENT_PARTIAL | Asset source refs/external identifiers + freshness                   | GDU, DE/K, CR             | Lite does not verify official certificate/status truth    |
| TM-PRO-REC-02 | Certificate reissue/replacement preparation                  | Global    | Agent / operations       | Preparation            | CURRENT_PARTIAL | Workbench intent `CERTIFICATE_REISSUE`                               | GDU, MCOM, CR             | Requirements remain candidates until owner/pro review     |
| TM-PRO-REC-03 | Assignment/transfer recordal preparation                     | Global    | Attorney / agent         | Preparation            | CURRENT_PARTIAL | Workbench intent `ASSIGNMENT_OR_TRANSFER_RECORDAL`                   | GDU, MCOM, EXEC, CR       | Preparation does not prove ownership/title change         |
| TM-PRO-REC-04 | Owner name/address change preparation                        | Global    | Agent / operations       | Preparation            | CURRENT_PARTIAL | Workbench intent `OWNER_NAME_OR_ADDRESS_CHANGE`                      | GDU, MCOM, EXEC, CR       | No automatic official record change                       |
| TM-PRO-REC-05 | Licence/other recordal preparation                           | Global    | Attorney / agent         | Preparation            | CURRENT_PARTIAL | Workbench intent `LICENSE_OR_OTHER_RECORDAL`                         | GDU, MCOM, EXEC, CR       | Licence validity/authority not established                |
| TM-PRO-REC-06 | Restoration/revival preparation                              | Global    | Attorney / agent         | Preparation            | CURRENT_PARTIAL | Workbench intent `RESTORATION_OR_REVIVAL`                            | GDU, DE/K, MCOM, EXEC, CR | Eligibility/deadline remains professional/official review |
| TM-PRO-REC-07 | Madrid/IR designation/recordal routing and dependency review | Madrid/IR | International agent      | Strategy / preparation | EMPTY           | Generic service intent only; no Madrid-specific bounded method found | GRET, DE/K, MCOM, CR      | WIPO/national dependency requires specialist review       |
| TM-PRO-REC-08 | Chain-of-title / recordal evidence reconciliation            | Global    | Attorney / due diligence | Evidence / review      | EMPTY           | Source refs exist but no chain-of-title outcome found                | GDU, GRET, DE/K, CR       | Evidence set does not establish legal title               |

### F. Renewal, Maintenance & Use

| Slot          | Professional task                                                | Scope                 | Primary role                | Work type              | Wall state      | Current evidence                                                     | Foundation deps     | Authority hold                                            |
| ------------- | ---------------------------------------------------------------- | --------------------- | --------------------------- | ---------------------- | --------------- | -------------------------------------------------------------------- | ------------------- | --------------------------------------------------------- |
| TM-PRO-MNT-01 | Renewal eligibility/readiness review                             | Global                | Portfolio manager / agent   | Review                 | ROADMAP_ONLY    | Roadmap: Renewal / Maintenance Readiness; Workbench `RENEWAL` intent | GRET, DE/K, CR      | No current capability may certify eligibility/deadline    |
| TM-PRO-MNT-02 | Use declaration/maintenance filing readiness                     | Jurisdiction-specific | Attorney / agent            | Review / preparation   | ROADMAP_ONLY    | Workbench `USE_DECLARATION` intent                                   | GDU, DE/K, CR       | Use sufficiency/legal eligibility requires review         |
| TM-PRO-MNT-03 | Specimen/use-evidence collection and coverage mapping            | Jurisdiction-specific | Attorney / paralegal        | Evidence               | ROADMAP_ONLY    | Workbench `EVIDENCE_PREPARATION`; no substantive coverage method     | GDU, MAI, DE/K, CR  | Evidence presence != acceptable specimen/use proof        |
| TM-PRO-MNT-04 | Maintenance deadline proximity and professional deadline review  | Global                | Docketing / agent           | Monitoring / review    | ROADMAP_ONLY    | Asset management date-proximity signal exists                        | DE/K, CR            | Signal explicitly cannot certify legal deadline           |
| TM-PRO-MNT-05 | Retained/deleted goods/services review                           | Jurisdiction-specific | Attorney / agent            | Review                 | ROADMAP_ONLY    | No bounded maintenance goods-retention outcome found                 | MAI, GRET, DE/K, CR | Scope deletion/retention is professional decision         |
| TM-PRO-MNT-06 | Renewal/maintenance package and quote preparation                | Global                | Client service / operations | Preparation            | CURRENT_PARTIAL | Workbench requirements/provider/package/quote candidates             | MCOM, CR            | Quote non-binding; package not filing authority           |
| TM-PRO-MNT-07 | Protected maintenance filing and receipt reconciliation          | Global                | Operations / agent          | Protected action       | CURRENT_PARTIAL | Service Execution protected release/evidence/recovery                | EXEC, CR            | Filing attempt != official acceptance                     |
| TM-PRO-MNT-08 | Multi-jurisdiction portfolio maintenance calendar/readiness view | Global portfolio      | Portfolio manager           | Monitoring / reporting | CURRENT_PARTIAL | Portfolio + management signals provide private attention context     | DE/K, CR            | Calendar/attention is not certified docket/deadline truth |

### G. Monitoring, Watch & Dispute Readiness

| Slot          | Professional task                                               | Scope                 | Primary role                  | Work type          | Wall state      | Current evidence                                                          | Foundation deps     | Authority hold                                           |
| ------------- | --------------------------------------------------------------- | --------------------- | ----------------------------- | ------------------ | --------------- | ------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------- |
| TM-PRO-MON-01 | Watch/monitoring service intent and target setup                | Global                | Portfolio manager             | Preparation        | CURRENT_PARTIAL | Workbench `WATCH_OR_MONITORING` intent                                    | GRET, DE/K, CR      | Intent does not prove monitoring coverage                |
| TM-PRO-MON-02 | Source-owned registry/status change detection and explanation   | Global                | Portfolio manager             | Monitoring         | CURRENT_PARTIAL | Asset Management change kinds/signals                                     | DE/K, MAI, CR       | Change observation does not verify official truth        |
| TM-PRO-MON-03 | Deadline/date-proximity attention signal                        | Global                | Portfolio manager / docketing | Monitoring         | CURRENT_PARTIAL | Management signal `OBSERVED_DATE_PROXIMITY`                               | DE/K, CR            | No legal deadline certification                          |
| TM-PRO-MON-04 | Stale/conflicting source triage and verification request        | Global                | Portfolio manager / agent     | Review             | CURRENT_PARTIAL | Management signals + `VERIFY_SOURCE_OR_DEADLINE` recommendation           | DE/K, MCOM, CR      | Lite cannot resolve source conflict                      |
| TM-PRO-MON-05 | Third-party similar-mark monitoring and evidence capture        | Multi-jurisdiction    | Watch specialist / agent      | Monitoring         | ROADMAP_ONLY    | Roadmap: Trademark Monitoring & Change Interpretation                     | GRET, DE/K, CR      | Observation != confusion/infringement conclusion         |
| TM-PRO-MON-06 | Opposition/cancellation/invalidity opportunity or threat triage | Jurisdiction-specific | Attorney / agent              | Reasoning / review | ROADMAP_ONLY    | Workbench has opposition/cancellation service intents, not triage outcome | MAI, GRET, DE/K, CR | Litigation/dispute position requires professional review |
| TM-PRO-MON-07 | Infringement/brand-risk evidence synthesis                      | Multi-jurisdiction    | Attorney                      | Reasoning          | ROADMAP_ONLY    | Roadmap: Brand Risk / Protection Assessment                               | MAI, GRET, DE/K, CR | Risk synthesis cannot create legal finding               |
| TM-PRO-MON-08 | Dispute escalation/counsel-review package preparation           | Jurisdiction-specific | Attorney / operations         | Preparation        | ROADMAP_ONLY    | Workbench can prepare requirements/handoff, but no dispute capability     | GDU, MCOM, EXEC, CR | Filing/contact/payment require separate authorization    |

### H. Commercialization, Licensing & Transactions

| Slot          | Professional task                                                           | Scope  | Primary role                   | Work type               | Wall state      | Current evidence                                                                | Foundation deps     | Authority hold                                               |
| ------------- | --------------------------------------------------------------------------- | ------ | ------------------------------ | ----------------------- | --------------- | ------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------ |
| TM-PRO-COM-01 | Sale intent / seller-relationship declaration                               | Global | Owner / broker                 | Commercial intake       | CURRENT_PARTIAL | `trademark-asset-commerce.ts` sale intent + seller role                         | CR                  | Declaration does not verify ownership/representation         |
| TM-PRO-COM-02 | Asking-price, negotiability and territory context                           | Global | Owner / broker                 | Commercial prep         | CURRENT_PARTIAL | Commerce Profile price/negotiability/territories                                | MAI, CR             | Asking price is not valuation or accepted market price       |
| TM-PRO-COM-03 | Commercial direction / showcase package preparation                         | Global | Brand/commercial operator      | Preparation             | CURRENT_PARTIAL | Trading commercial direction/Brand DNA/Showcase contracts                       | MAI, MEDIA, CR      | Presentation does not create trademark/market truth          |
| TM-PRO-COM-04 | Acquisition/sale due-diligence checklist and evidence pack                  | Global | Counsel / buyer / seller       | Due diligence           | EMPTY           | No bounded transaction diligence outcome found                                  | GDU, GRET, DE/K, CR | Professional title/risk review required                      |
| TM-PRO-COM-05 | Assignment transaction readiness and recordal handoff                       | Global | Counsel / agent                | Preparation / execution | CURRENT_PARTIAL | Workbench assignment intent + Execution handoff                                 | GDU, MCOM, EXEC, CR | Handoff does not create title transfer/official recordal     |
| TM-PRO-COM-06 | Licence transaction readiness and recordal handoff                          | Global | Counsel / agent                | Preparation / execution | CURRENT_PARTIAL | Workbench licence/recordal intent + Execution substrate                         | GDU, MCOM, EXEC, CR | No automatic licence validity/recordal truth                 |
| TM-PRO-COM-07 | Ownership/representation authority verification request and evidence review | Global | Counsel / marketplace reviewer | Evidence / review       | EMPTY           | Commerce explicitly refuses ownership verification                              | GDU, GRET, DE/K, CR | Seller role != verified title/authority                      |
| TM-PRO-COM-08 | Transaction closing/transfer evidence reconciliation                        | Global | Counsel / operations           | Evidence / reporting    | EMPTY           | Execution evidence exists generically, no trademark transaction-closing outcome | GDU, EXEC, DE/K, CR | Payment/transfer evidence does not itself create title truth |

### I. Content, Brand & Publication Support

| Slot          | Professional task                                                   | Scope             | Primary role             | Work type            | Wall state      | Current evidence                                                     | Foundation deps          | Authority hold                                      |
| ------------- | ------------------------------------------------------------------- | ----------------- | ------------------------ | -------------------- | --------------- | -------------------------------------------------------------------- | ------------------------ | --------------------------------------------------- |
| TM-PRO-PUB-01 | Trademark/brand content candidate from governed asset context       | Global            | Brand/operator           | Drafting             | CURRENT_PARTIAL | Asset Management/AiGuide can prepare content candidate               | MAI, CR                  | Candidate is not publication authorization          |
| TM-PRO-PUB-02 | Brand narrative / showcase preparation                              | Global            | Brand/operator           | Creative preparation | CURRENT_PARTIAL | Trading Brand DNA/Showcase objects                                   | MAI, MEDIA, CR           | Brand presentation does not mutate trademark truth  |
| TM-PRO-PUB-03 | Media asset/rights suitability review for content package           | Global            | Brand/media reviewer     | Evidence / review    | CURRENT_PARTIAL | Media + Media Rights bounded contracts                               | GDU, MEDIA, CR           | Rights evidence does not create execution authority |
| TM-PRO-PUB-04 | Exact PublishPackage / channel-target preparation                   | Global            | Content operator         | Preparation          | CURRENT_PARTIAL | Product Loop exact PublishPackage lineage                            | MAI, MEDIA, CR           | PublishPackage != Published                         |
| TM-PRO-PUB-05 | Social distribution intent and target preparation                   | Platform-specific | Content operator         | Preparation          | ROADMAP_ONLY    | #1083 defines proposed Social owner boundary only                    | SOC/MEDIA, CR            | Intent != authorize != execute                      |
| TM-PRO-PUB-06 | Protected publication execution and platform receipt reconciliation | Platform-specific | Content operator         | Protected action     | ROADMAP_ONLY    | #1083 adopts execution/reconciliation pattern; no runtime yet        | SOC/MEDIA, EXEC, CR      | Execution success != platform Published             |
| TM-PRO-PUB-07 | Time-bounded content/social performance observation                 | Platform-specific | Brand/analytics operator | Observation          | EMPTY           | #1083 proposes `SocialPerformanceObservationV1`, not implemented     | SOC/MEDIA, DE/K          | Metrics != market demand/valuation/trademark truth  |
| TM-PRO-PUB-08 | Comment/inquiry triage and reply-draft preparation                  | Platform-specific | Client/brand operator    | Review / drafting    | EMPTY           | #1083 proposes CommentEvent/ReplyDraft; no professional workflow yet | MAI, MCOM, SOC/MEDIA, CR | AI Draft != Send; inquiry != CRM/client truth       |

### J. Client Service, Execution & Reporting

| Slot          | Professional task                                                              | Scope  | Primary role                | Work type             | Wall state      | Current evidence                                             | Foundation deps | Authority hold                                                 |
| ------------- | ------------------------------------------------------------------------------ | ------ | --------------------------- | --------------------- | --------------- | ------------------------------------------------------------ | --------------- | -------------------------------------------------------------- |
| TM-PRO-SER-01 | Service option/recommendation preparation                                      | Global | Client service / agent      | Recommendation        | CURRENT_PARTIAL | Early Funnel RecommendationArtifact with admitted source ref | MAI, DE/K, CR   | Recommendation does not create customer selection/pro approval |
| TM-PRO-SER-02 | User selection / instruction capture                                           | Global | Client / agent              | Decision capture      | CURRENT_PARTIAL | `UserSelectionV1`                                            | CR              | Selection is not filing/protected-action authorization         |
| TM-PRO-SER-03 | Non-binding quote preparation                                                  | Global | Client service              | Commercial prep       | CURRENT_PARTIAL | Early Funnel QuoteArtifact + Workbench quote candidate       | DE/K, CR        | Quote candidate is non-binding; no payment authority           |
| TM-PRO-SER-04 | Client information request draft                                               | Global | Client service / paralegal  | Communication prep    | CURRENT_PARTIAL | Workbench `CLIENT_INFORMATION_REQUEST` draft                 | MAI, MCOM, CR   | Draft is unsent and unauthorized externally                    |
| TM-PRO-SER-05 | Provider enquiry/instruction draft                                             | Global | Agent / operations          | Communication prep    | CURRENT_PARTIAL | Workbench provider enquiry/instruction drafts                | MAI, MCOM, CR   | Draft != provider engagement/send                              |
| TM-PRO-SER-06 | Explicit execution authorization record and constraints                        | Global | Authorized user / agent     | Authorization         | CURRENT_PARTIAL | TrademarkServiceExecutionAuthorization                       | EXEC, CR        | Authorization record acknowledges it is not submission         |
| TM-PRO-SER-07 | Protected-action release / owner-domain handoff                                | Global | Operations                  | Protected action prep | CURRENT_PARTIAL | ProtectedActionRelease + provider/lifecycle handoff          | EXEC, MCOM, CR  | Release to owner != external success/acceptance                |
| TM-PRO-SER-08 | Execution evidence/recovery/lifecycle handoff/client-facing status preparation | Global | Operations / client service | Evidence / reporting  | CURRENT_PARTIAL | ExecutionEvidence + RecoveryState + lifecycle handoff        | EXEC, DE/K, CR  | Attempt/provider return != official truth/completion           |

## 4. What the Wall says about current architecture

### 4.1 Strongest current coverage is preparation and governance

Current main is already strong at:

- Workspace-private trademark asset/context composition;
- source provenance/freshness/conflict visibility;
- service-intent and requirement preparation;
- explicit human selection and authorization records;
- protected-action handoff and execution evidence;
- bounded commercialization/showcase preparation;
- a small number of evidence-backed Brain Methods.

This is valuable substrate, but it is intentionally not equivalent to professional Capability admission.

### 4.2 Largest professional gaps are substantive reasoning and cross-source research

The densest `EMPTY` areas are:

- true search/clearance retrieval and similarity analysis;
- prosecution issue classification and response strategy;
- chain-of-title and transaction diligence;
- verified ownership/representation review;
- platform-side performance/inquiry workflows.

These gaps should not be solved by making Product objects authoritative. Most will need stronger Knowledge/Data/retrieval/document evidence plus explicit professional review.

### 4.3 Roadmap families should stay families until one outcome is proven

Current Foundation roadmap already reserves six useful domain directions:

- Trademark Monitoring & Change Interpretation;
- Renewal / Maintenance Readiness;
- Filing Strategy / Readiness;
- Brand Risk / Protection Assessment;
- Content Intelligence & Publication Preparation;
- Client Opportunity / Service Readiness.

V0 does **not** turn those labels into canonical IDs. A future implementation should pick one narrow, high-value outcome and prove it end-to-end rather than opening all six families at once.

## 5. Cordis implications

The Wall is intentionally Workspace-neutral. Cordis specialization attaches below an admitted professional Capability:

- Workspace-specific Skills may encode drafting/checklist/review method preferences;
- Workspace Case Knowledge may contribute precedent and local experience;
- Workspace implementation preference may choose an approved Implementation Profile;
- local policy may narrow routing or review burden;
- none of these create a new Capability or weaken source/professional/protected-action authority.

A later Capability should therefore be tested as:

```text
same professional outcome contract
+ different Workspace governed context/Profile/Skill/Knowledge
= different approved execution behavior
```

not as separate Workspace-specific Capability IDs.

## 6. Candidate prioritization lens for later issues

When choosing the first domain Capability from this Wall, prefer a slot/family that:

1. solves a frequent, economically meaningful professional task;
2. can reuse existing current objects rather than create another platform;
3. has explicit source/evidence boundaries;
4. can return a reviewable outcome without autonomous filing/contact/payment;
5. benefits materially from Workspace-local Skill/Knowledge specialization;
6. can be tested across at least two Workspaces or independent product consumers;
7. does not require Governed Retrieval/Document Understanding to be prematurely declared production-ready if they remain HOLD.

This means the first domain Capability should probably be a **readiness / interpretation / preparation** outcome, not a fully autonomous external-action capability.

## 7. Non-canon guardrails

- Do not register `TM-PRO-*` identifiers in Capability Runtime.
- Do not expose `TM-PRO-*` identifiers to product callers as Capability IDs.
- Do not infer that a `CURRENT_PARTIAL` slot is production-complete.
- Do not infer that a `ROADMAP_ONLY` slot is authorized for development.
- Do not count `managed-ai-execution`, Managed Communication, Execution, Data Engine or Knowledge as professional trademark coverage.
- Do not turn Brain Method activation into Capability admission.
- Do not promote Social/Media observations into trademark, ownership, valuation, official or legal truth.
- Do not collapse `prepare -> authorize -> execute -> official/platform-confirmed` into one state.

## 8. Update protocol

This Wall should change only when exact evidence changes. A future update should record:

- current main SHA;
- exact slot(s) affected;
- evidence path/Capability definition/release that changed coverage;
- state transition, for example `EMPTY -> CURRENT_PARTIAL` or `CURRENT_PARTIAL -> ADMITTED_PROFESSIONAL_CAPABILITY`;
- whether the change is professional coverage or only a foundation dependency improvement;
- authority/review implications;
- admission/release evidence if a real Capability is claimed.

Any future `ADMITTED_PROFESSIONAL_CAPABILITY` state requires an exact accepted Capability definition and governed release evidence; it cannot be created by editing this planning document alone.
