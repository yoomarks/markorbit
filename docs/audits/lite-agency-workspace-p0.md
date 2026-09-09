# Lite Agency Workspace P0 — Owner / Reuse / Dependency Freeze

Status: **P0 architecture freeze**  
Parent Epic: #1093  
Audit task: #1094  
Existing change-interpretation lane to reuse: #1092  
Baseline: `main@a3e26117043600c5dfde42678a3fa315d75271db`

## 1. Executive decision

Lite Agency Workspace is a major Lite product line, but it must be built by composing the repository's current owner domains rather than by introducing a generic CRM/IPMS/mail/task/calendar platform.

The product loop is:

`Declare / Intake -> Discover -> Connect -> Understand -> Organize -> Act -> Communicate -> Remember -> Learn`

The user-facing promise is that a trademark professional can begin with only the information already available in real work — applicant/customer names, historical spreadsheets, contracts, images, pasted instructions, and mail — and progressively turn that evidence into governed customer relationships, managed trademark assets, pre-filing work, daily work, watch scopes, communications and Workspace-local operating knowledge.

### Permanent corrections frozen by this audit

1. **Do not create a second formal `FilingIntake` in Lite.** MarkReg `ProductionIntake` already owns the formal pre-filing intake lifecycle. Lite may own acquisition/staging/review state only, then issue a human-confirmed command to MarkReg.
2. **Do not create a second applicant-discovery service.** Applicant portfolio discovery extends the Data Engine discovery owner/boundary and returns provenance-aware candidates to Lite.
3. **Do not create an Outlook-specific mail domain.** Microsoft Graph is a Managed Communication provider adapter, analogous to Gmail.
4. **Do not create a second trademark status/monitoring truth store.** Trademark Asset source/freshness/conflict semantics plus #1092 remain the governing interpretation path.
5. **Do not make Calendar canonical.** Calendar is a projection of owner deadlines and durable operational Work.
6. **A generic Lite operational Work owner is a real gap.** Existing Today/Daily/PreparedAction and MGSN Provider Work are not a durable general task owner.
7. **A Workspace Watch target is distinct from Asset Management's `WATCHED` signal disposition.** Applicant/unmanaged-trademark monitoring needs a bounded Workspace-local target/scope if no existing persisted target owner emerges.
8. **Customer contact details are optional.** A name-only explicit customer relationship can create value immediately. Contact enrichment is progressive and should be motivated by notification/reporting/automation value.

## 2. Product and truth vocabulary

These terms must remain distinct across contracts, APIs and UI:

- **Customer** — a Workspace-explicit business relationship. It may be unverified and may have no contact details.
- **Applicant** — a registry/Data Engine identity associated with trademark records. `Customer != Applicant`; one Customer may map to multiple Applicant identities.
- **Owned / Managed / Represented** — explicit Workspace relationship to a Trademark Asset.
- **Discovered** — Data Engine found a candidate because of an applicant/customer discovery scope; it is not yet a managed relationship.
- **Watched** — a Workspace monitors an applicant or trademark for a bounded purpose; Watch does not imply ownership, representation or management.
- **Lite Intake Staging** — non-formal source/candidate/review state used to prepare owner commands.
- **MarkReg ProductionIntake** — formal early-funnel trademark filing intake owner.
- **Observation / Evidence** — source-bound information about a trademark or work event. It cannot overwrite Official Truth merely because it is newer in the database.
- **Work** — operational responsibility for a human/team; completion does not prove filing or official legal state.
- **Internal due date** — Workspace work-planning date; never equivalent to a certified legal deadline.

## 3. Current-main owner matrix

| Concern | Canonical current owner | Current repository surface | Decision / exact gap |
| --- | --- | --- | --- |
| Workspace trademark asset | Lite Trademark Asset projection with source-owner authority boundaries | `packages/contracts/src/trademark-asset-workspace.ts`; Lite asset services | **REUSE.** Owned/managed/represented remain Asset relationships. Data Engine may be a source. No second portfolio store. |
| Asset portfolio search/import | Lite Trademark Asset Portfolio | `services/lite/src/trademark-asset-portfolio.ts` and existing contracts/API | **REUSE + EXTEND ORCHESTRATION.** Existing bulk admission is bounded; large CSV/XLSX migration needs normalization, preview, chunking, retry/report only. |
| Customer relationship | CustomerContext | `packages/contracts/src/customer-context.ts`; MarkReg customer-relationship integration | **REUSE + MINIMUM EXTENSION.** Name-only relationship is valid. Need only the smallest applicant-identity/contact reference seam after contract-lock review. |
| Applicant / registry discovery | Data Engine | `packages/contracts/src/data-engine-discovery.ts`; Data Engine owner APIs | **EXTEND OWNER.** Add applicant-identity/name discovery/query support under Data Engine provenance/snapshot/cursor discipline. No Lite copy of registry truth. |
| Formal pre-filing intake | MarkReg | `packages/contracts/src/markreg-early-funnel.ts`; `services/markreg/src/production-intake.ts` | **REUSE.** Lite staging commits to MarkReg `ProductionIntake`; do not create a formal Lite filing intake. |
| Mixed-source acquisition/review | No generic user-source staging owner confirmed on baseline | Existing exact source/evidence patterns exist, but no reusable generic user-upload SourceBundle / multi-candidate review owner was found in P0 searches | **NEW MINIMUM in Lite.** `IntakeSession`-like staging may store source references/hashes, extracted candidates, missing fields, corrections, preview and commit results only. Binary storage itself is not invented here. |
| Managed email | Capability Engine Managed Communication | `packages/contracts/src/managed-communication.ts`; `managed-communication-foundation.ts`; Gmail adapter and exchange | **REUSE.** Normalized EMAIL/evidence/checkpoint/send boundary already exists. |
| Outlook / Microsoft mail | No Graph provider on baseline | Gmail provider is the concrete reference adapter | **NEW PROVIDER ONLY.** Implement Microsoft Graph behind existing Managed Communication provider seam. |
| Mailbox per-user limit/ownership | Not explicit in current Workspace account binding | Managed Communication binding is Workspace-scoped | **EXTEND ABOVE PROVIDER.** Add user ownership/entitlement only where product entitlement is already governed; never hard-code plan limits into Graph adapter. |
| Communication-to-business association | No exact reusable owner confirmed | Managed Communication deliberately does not mutate customer/matter/legal truth | **NEW MINIMUM Lite association if final implementation audit still finds none.** Deterministic-first message/thread -> Customer/Asset/Matter/ProductionIntake link with evidence/confidence/review. |
| Daily orchestration | Lite Today / Daily Workspace / Product Loop | `packages/contracts/src/daily-workspace.ts`, `product-loop.ts`, Lite daily services | **REUSE AS PROJECTION/HANDOFF.** Today is not a task database. |
| Prepared governed action | Lite Product Loop PreparedAction | `packages/contracts/src/product-loop.ts`; Lite PreparedAction service | **REUSE SEMANTICS / EXTEND ONLY IF FITS.** Confirmation and exact source-currentness patterns should govern client-communication preparation. |
| Generic operational task | No general Lite durable owner confirmed | `WORK_FOLLOW_UP` is a Today recommendation kind; MGSN Provider Work is provider read model, not agency task truth | **NEW MINIMUM Lite Work Item.** Required for manual+automatic tasks, waiting, assignee, internal due/reminders and projections. |
| Provider work | MGSN provider read model | `packages/contracts/src/provider-work-read-model.ts` | **REJECT AS GENERIC TASK OWNER.** It represents network/provider work, not Workspace operational tasks. |
| Asset attention / conflicts | Trademark Asset Management | `packages/contracts/src/trademark-asset-management.ts` | **REUSE.** Severity, freshness/conflict, recommendation and Watch/Defer/Dismiss/Continue semantics remain governing attention primitives. |
| Workspace trademark change interpretation | Capability/Cordis pilot lane | #1092 | **REUSE / DEPEND.** Agency Workspace consumes #1092; no second monitoring/interpreter system. |
| Standalone applicant/unmanaged-mark watch target | No persisted target owner confirmed | Asset Management `WATCHED` is a disposition on management signals | **NEW MINIMUM Workspace Watch target/scope**, unless a more exact current owner appears before implementation. |
| Official Matter/lifecycle | MarkReg | existing Formal Matter / lifecycle contracts/services | **REUSE.** Lite observations/work cannot certify official state or legal deadlines. |
| Calendar | No need for independent owner | Today/Daily plus future Work/owner deadlines | **PROJECTION ONLY.** No calendar truth store. |
| Client notification | Managed Communication send + Product Loop confirmation semantics exist; no generic client notification template/draft owner confirmed | Managed Communication exchange; PreparedAction | **EXTEND OR NEW MINIMUM PREPARED COMMUNICATION.** Reuse send and confirmation. Do not build a standalone template platform in V1. |
| Workspace personalization | existing Capability Runtime / Workspace-local/Cordis boundaries | Capability/Cordis lanes, including #1092 | **REUSE.** Local aliases, SOP, tone, routing and follow-up preferences may specialize behavior without creating new Capability IDs/runtime. |

## 4. Reuse / extend / new / reject freeze

### REUSE

- Trademark Asset / Portfolio and relationship/source/freshness/conflict semantics.
- CustomerContext explicit Workspace relationship.
- MarkReg `ProductionIntake` for formal early filing intake.
- Data Engine as applicant/registry discovery owner.
- Managed Communication for account binding, normalized messages, evidence, checkpoints and outbound receipts.
- Gmail provider shape as the implementation reference for Microsoft Graph.
- Today / Daily Workspace / Product Loop / PreparedAction confirmation semantics.
- Trademark Asset Management signals/severity/dispositions/handoffs.
- MarkReg formal Matter/lifecycle/deadline authority.
- #1092 for Workspace-local change interpretation.
- Capability Runtime / Cordis for Workspace-local policy and SOP specialization.
- MGSN provider/network identities when a cooperating agent is actually a formal network provider.

### EXTEND

- Data Engine discovery: applicant identity/name queries, provenance-aware result shape and portfolio discovery scope.
- CustomerContext: only the minimum optional applicant-identity and contact-reference seam required by production journeys.
- Trademark Asset admission/orchestration: accept confirmed Data Engine-discovered assets through existing owner APIs.
- Managed Communication: Microsoft Graph provider; possibly account-owner/entitlement metadata at the proper product/core layer.
- Today: project durable operational Work and waiting/follow-up signals.
- PreparedAction: only if client-communication preparation cleanly fits existing confirmation/currentness model.

### NEW MINIMUM

1. **Lite Intake staging/session** — source refs, extraction candidates, missing fields, corrections, preview and commit receipt. Non-formal and non-authoritative; commits to existing owners.
2. **Lite Operational Work Item** — manual/automatic agency task truth with related refs, assignee, status, internal due, waiting/reminder/follow-up.
3. **Workspace Watch Target/Scope** — applicant or unmanaged trademark + bounded purpose + policy; distinct from asset management signal disposition.
4. **Communication Association** — only if no existing exact owner is found at implementation time; message/thread association to business targets with evidence/confidence/user confirmation.
5. **Prepared Client Communication** — only if PreparedAction cannot safely express it; a draft/preparation object, never a second send stack.

### REJECT

- Lite formal `FilingIntake` duplicate.
- Separate applicant-discovery service or copied Data Engine registry database.
- Separate Outlook/mail domain.
- Generic CRM mega-party table.
- Automatic `MANAGED/REPRESENTED` assignment for all marks under an applicant.
- Separate monitoring/status truth store.
- Last-writer-wins trademark status.
- Calendar canonical database.
- AI/provider direct formal truth mutation.
- Autonomous external send by default.
- Workspace-specific Capability IDs or second AI runtime.

## 5. Truth and authority matrix

| Object / fact | May originate from | Canonical/deciding owner | Must not imply |
| --- | --- | --- | --- |
| Customer relationship | Workspace user/import | CustomerContext | verified applicant identity or contact authorization |
| Applicant identity | Data Engine / registry evidence / user candidate | Data Engine/registry identity boundary; Workspace stores refs/aliases only | customer relationship |
| Discovered trademark | Data Engine query | Data Engine evidence + Lite discovery scope | management/representation |
| Managed/represented/owned relation | explicit Workspace action/import confirmation | Trademark Asset Workspace relation | Official legal owner truth beyond source evidence |
| Watch target | explicit Workspace action/policy | Lite Workspace Watch | management/representation |
| Pre-filing extracted field | user source + AI extraction | Lite staging candidate until confirmed | verified formal intake fact |
| Production intake | human-confirmed normalized command | MarkReg ProductionIntake | filed application / office receipt |
| Trademark status observation | Data Engine, email, official API/publication, user | source evidence + owner resolver/MarkReg lifecycle boundary | automatic authoritative status merely by arrival time |
| Current asset attention state | source/freshness/conflict/lifecycle evidence | Trademark Asset Management / owner projection | legal conclusion |
| Certified legal deadline | official/MarkReg governed source | MarkReg/owner lifecycle | email-detected/internal date |
| Internal work due date | user/work policy | Lite Work | legal deadline |
| Work completion | user/team | Lite Work | filing success or Official Truth |
| Email/message | provider | Managed Communication normalized evidence | customer/matter/legal truth |
| Client draft | template/AI/user | Prepared client communication / PreparedAction | send |
| Send receipt | provider | Managed Communication exchange evidence | legal filing/delivery to authority unless separately owned |

## 6. Intake architecture

All four user entry modes share one orchestration pattern:

```text
AI conversation -----+
Bulk CSV/XLSX -------+----> Lite acquisition/staging ----> review/confirmation ----> owner commands
Applicant discovery -+              |                                             |-> CustomerContext
Email intake --------+              |                                             |-> Trademark Asset
                                    |                                             |-> MarkReg ProductionIntake
                                    +--> exact source refs/evidence                |-> Lite Work
```

### AI conversational intake

Input may include contracts, PDFs, DOCX/TXT, spreadsheets, screenshots, trademark images, pasted instructions, messages and attachments. One session may identify multiple filing instructions. AI fills what the evidence supports, marks uncertainty, asks only missing/legally significant questions and preserves provenance.

### Bulk migration

Use the same normalization/review language, but optimize for scale:

`upload -> schema detection -> mapping -> normalize -> dedupe -> preview -> chunk existing asset admission -> durable progress/report/retry`.

The orchestrator must not use spreadsheet row numbers as durable identities and must not bypass existing asset idempotency/conflict checks.

### Applicant/Data Engine discovery

A name-only customer/applicant list is valid onboarding input. Resolution flow:

`Workspace Customer -> candidate Applicant identity refs -> Data Engine portfolio discovery -> discovered marks -> explicit manage/select/watch/ignore`.

One Customer may map to multiple Applicant identities. The user may optionally persist a continuous applicant discovery/watch scope so newly discovered marks become review candidates rather than silently managed assets.

### Watch intake

Target kinds: `TRADEMARK`, `APPLICANT`.

Initial purpose vocabulary: `ENFORCEMENT`, `BUSINESS_DEVELOPMENT`, `COMPETITIVE`, `ACQUISITION`, `CLIENT_MONITORING`, `OTHER`.

Purpose controls recommendations, not legal truth. A competitive watch may generate risk review; a business-development watch may generate an opportunity suggestion. Neither changes the watched entity into a managed asset.

## 7. Multi-source trademark change model

Supported evidence channels include:

1. Data Engine refresh;
2. Managed Communication/email;
3. official API/publication/Gazette;
4. explicit user confirmation.

Permanent processing model:

`Observation/evidence -> authority + freshness + effective time + lifecycle consistency -> conflict/current projection -> change signal -> #1092 interpretation -> Today/Work/notification`.

**Last writer never wins by itself.**

A provider email saying “certificate issued” is evidence and may create a registration observation candidate, a work item and a client-notification recommendation. It cannot directly certify MarkReg lifecycle truth. Likewise Data Engine refresh may update source evidence/freshness and create a change signal, but cannot manufacture legal conclusions outside the owner boundary.

If sources conflict, the UI/workflow must preserve both exact sources and route verification instead of silently selecting one.

## 8. Mail / Inbox architecture

Managed Communication remains the only email capability owner.

### Microsoft Graph

Implement as a provider adapter with parity goals derived from the Gmail adapter:

- OAuth/token lifecycle at provider boundary;
- account/profile identification;
- incremental read/cursor/checkpoint behavior;
- normalized message/thread participants/content;
- attachment metadata/content evidence behavior;
- send/reply through existing governed exchange;
- idempotency and provider receipts.

Per-user “2–3 mailbox” product limits are entitlement policy, not Graph contract semantics.

### Communication association

Association must be deterministic-first:

1. exact application / registration / IR / internal reference;
2. existing confirmed thread inheritance;
3. participant + mark + jurisdiction/context evidence;
4. semantic AI suggestion;
5. human confirmation for ambiguous candidates.

Association is a Workspace link, not a mutation of email evidence or Asset/MarkReg truth.

## 9. Operational Work / Today / Calendar

P0 found no current general Lite durable Work owner. `WORK_FOLLOW_UP` is a recommendation kind and MGSN Provider Work is a provider read model.

The minimum Work Item should support:

- Workspace ID and stable Work ID;
- manual or source-generated origin + exact source ref;
- title/type/status;
- related Customer / Applicant / Asset / Matter / MarkReg ProductionIntake / Communication refs;
- assignee;
- priority/severity aligned with existing semantics where possible;
- `internalDueAt` distinct from owner-certified legal deadline references;
- waiting reasons (`CLIENT`, `PROVIDER`, `COUNSEL`, etc.);
- reminder/follow-up policy;
- restart-safe persistence/idempotency where automatic creation participates;
- Today projection and Calendar projection.

Calendar must read Work and owner deadline references. It does not become a workflow or legal truth owner.

## 10. Client communication loop

V1 flow:

`Change/Work -> recommendation -> prepare customer communication -> template/AI fill -> human review -> governed send -> Managed Communication receipt/evidence -> timeline/waiting/follow-up`.

Contact information remains optional. Missing contact should produce an actionable enrichment prompt only when the user tries to communicate or enable a notification/reporting benefit.

The baseline audit did not find a reusable generic client-notification template/draft owner. Therefore implementation must first attempt to extend existing PreparedAction confirmation/currentness semantics. If that cannot represent a draft safely, add only a small Lite `PreparedClientCommunication` object that references template/profile/source/work and hands off to Managed Communication. Do not build a standalone template-management platform in Agency Workspace V1.

## 11. Workspace-local / Cordis policy

Workspace-local context may specialize:

- customer/applicant aliases;
- confirmed email/thread linking patterns;
- filing checklists and SOP;
- internal due-date policy;
- priority/routing/follow-up rules;
- notification language/tone/salutation/signature/fee language;
- client/provider-specific preferences.

These are implementation preferences and context. They may not create Workspace-specific Capability IDs, bypass Capability Runtime, overwrite Data Engine/MarkReg truth or auto-send externally outside governance.

## 12. Dependency graph and delivery order

```text
P0 owner/reuse freeze (#1094)
 |
 +--> P1A Microsoft Graph provider -------------------------------+
 |                                                                |
 +--> P1B Bulk migration orchestrator ----------------------------+----> early dogfood
 |
 +--[shared contract lock free]--> P2 Applicant discovery / identity refs
 |                                  |
 |                                  +--> Portfolio discovery / Watch scope
 |
 +--[shared contract lock free]--> P3 Lite intake staging
 |                                  |
 |                                  +--> MarkReg ProductionIntake commit
 |
 +--[shared contract lock free]--> P4 Lite Operational Work
 |                                  |
 |                                  +--> Today / Calendar / Waiting
 |
 +--[shared contract lock free]--> P5 Communication association / triage
 |                                  |
 |                                  +--> existing/new filing context
 |
 +-------------------------------> #1092 Change Interpretation
 |                                  |
 |                                  +--> multi-source change recommendations
 |
 +--[after Work + mail]----------> P7 Client communication preparation/send loop
 |
 +-------------------------------> P8 Cordis learning + full dogfood
```

### Shared hot-file discipline

Contract-changing tasks must not start until the active Shared Contracts Lock is explicitly free or ownership is coordinated. P0 is docs-only and intentionally does not participate in that lock. Microsoft Graph provider implementation and a private Lite migration-orchestration spike can begin without changing shared contracts if the current provider/import interfaces are sufficient.

## 13. First production vertical slice

Agency Workspace V1 is not proven by isolated screens. The first slice must demonstrate exact lineage through one real agency journey:

1. create/import one **name-only** Customer;
2. resolve one or more Applicant candidates through Data Engine;
3. discover that applicant's marks;
4. explicitly confirm one mark as managed;
5. upload/paste one mixed-source new-filing instruction into Lite staging;
6. review missing/uncertain fields and commit a MarkReg ProductionIntake;
7. ingest one managed email and associate it with an existing asset/intake using evidence;
8. create one durable Work item / Today projection;
9. receive one Data Engine/email/official-source change and preserve freshness/conflict semantics;
10. consume #1092 to produce governed interpretation/recommendation;
11. prepare one client communication, require human confirmation, send through Managed Communication;
12. reopen Customer/Trademark/work timeline and prove exact source/command/receipt lineage.

## 14. Codex-ready implementation task shapes

These are task shapes, not permission to bypass shared-lock coordination. Every child issue/PR must re-read fresh main and repository `AGENTS.md`.

### LITE-AGENCY-P1A — Microsoft Graph Managed Communication provider

1. **Task ID:** `LITE-AGENCY-P1A`
2. **Allowed directories:** `services/capability-engine/**` plus provider-specific tests/config docs only; avoid shared contracts if current provider seam suffices.
3. **Objective:** bind/read/send/reply an Outlook/Microsoft 365 mailbox through existing Managed Communication semantics.
4. **Canonical sources:** `packages/contracts/src/managed-communication.ts`, Managed Communication foundation/exchange, Gmail adapter.
5. **Contracts:** no new email domain; normalize to existing managed communication types.
6. **Behavior:** Graph provider parity for account identity, incremental read/checkpoint, messages/threads/attachments, outbound send/reply, provider receipts.
7. **Transitions:** provider observations only; no Customer/Asset/Matter/legal truth mutation.
8. **UI states:** N/A in provider slice.
9. **Events:** reuse existing managed communication exchange/read lifecycle only.
10. **Acceptance:** deterministic/idempotent normalized reads, restart-safe checkpointing, send/reply exact receipt, provider failures mapped without truth mutation.
11. **Validation:** affected unit/integration tests, workspace validation, format/check, `git diff --check`, hosted CI.
12. **Non-goals:** Inbox UI, per-plan pricing, communication-to-asset AI linking, autonomous send.
13. **Expected PR title:** `[LITE-AGENCY][P1A] Add Microsoft Graph communication provider`.

### LITE-AGENCY-P1B — Bulk migration orchestration

1. **Task ID:** `LITE-AGENCY-P1B`
2. **Allowed directories:** `services/lite/**` and narrow tests; UI and contracts separate unless proven unnecessary.
3. **Objective:** orchestrate large historical trademark imports over the existing bounded Trademark Asset bulk-import owner.
4. **Canonical sources:** Trademark Asset Workspace/Portfolio contracts and Lite portfolio implementation.
5. **Contracts:** reuse existing admission identity/idempotency/conflict semantics; no second asset importer.
6. **Behavior:** normalized candidate batch -> preview -> chunk <= current owner limit -> durable progress/result/retry; duplicate/rejected rows retain evidence.
7. **Transitions:** only explicit confirmed rows become Asset admissions; no automatic Matter creation.
8. **UI states:** no UI in first service slice.
9. **Events:** reuse existing asset admission behavior; do not introduce new cross-owner events unless proven necessary.
10. **Acceptance:** large synthetic set chunks correctly, resume/retry does not duplicate, conflicts are reported, partial failures are recoverable.
11. **Validation:** affected Lite tests, workspace validation, format/check, `git diff --check`, hosted CI.
12. **Non-goals:** spreadsheet rendering/UI, Applicant discovery, Customer CRM, Data Engine writes.
13. **Expected PR title:** `[LITE-AGENCY][P1B] Add bulk asset migration orchestration`.

### LITE-AGENCY-P2 — Applicant portfolio discovery

1. **Task ID:** `LITE-AGENCY-P2`
2. **Allowed directories:** Data Engine owner/contract + narrow Lite adapter after shared-lock coordination.
3. **Objective:** resolve applicant identities and discover registry trademarks from name-only Workspace customer/applicant input.
4. **Canonical sources:** Data Engine discovery contract/owner, CustomerContext, Trademark Asset.
5. **Contracts:** preserve snapshot/cursor/provenance/budget semantics; Workspace stores applicant refs/aliases, not copied registry truth.
6. **Behavior:** query -> candidate identities -> confirmed identity scope -> discovered trademark candidates -> explicit manage/select/watch/ignore.
7. **Transitions:** discovered does not become managed without explicit Workspace action.
8. **UI states:** separate UI task must include loading/empty/multiple-identity/error/partial/permission/success and read UI skill first.
9. **Events:** source changes may later feed asset management/#1092; no direct legal truth mutation.
10. **Acceptance:** ambiguous names remain reviewable, pagination/snapshot reproducible, provenance exact, no implicit management.
11. **Validation:** Data Engine + Lite contract/service tests, schema/compat checks, hosted CI.
12. **Non-goals:** marketing automation, contact scraping, Data Engine mutation, Watch interpretation logic.
13. **Expected PR title:** `[LITE-AGENCY][P2] Add applicant portfolio discovery boundary`.

### LITE-AGENCY-P3 — Conversational intake staging -> MarkReg ProductionIntake

1. **Task ID:** `LITE-AGENCY-P3`
2. **Allowed directories:** Lite staging/AI adapter + MarkReg public command integration only; coordinate shared contracts.
3. **Objective:** turn mixed evidence into reviewable multi-candidate new-filing instructions and commit confirmed candidates to MarkReg.
4. **Canonical sources:** MarkReg early-funnel/ProductionIntake; Managed AI/Capability Runtime; exact source/evidence patterns.
5. **Contracts:** Lite staging is non-formal; MarkReg ProductionIntake remains formal owner.
6. **Behavior:** source refs -> extraction -> candidates/confidence/missing fields -> user corrections -> preview -> confirmed MarkReg command + receipt.
7. **Transitions:** AI cannot skip review into formal intake; formal status begins only at MarkReg command acceptance.
8. **UI states:** separate UI task with extraction/loading, partial, multiple-candidate, missing-info, error, review, committing, success.
9. **Events:** no direct filing/official event; exact commit reference retained.
10. **Acceptance:** multiple filings from one source set, incomplete records save safely, field provenance retained, retry idempotent, MarkReg is sole formal intake owner.
11. **Validation:** Lite + MarkReg integration/contract tests, workspace validation, format/check, hosted CI.
12. **Non-goals:** OCR/blob-storage reinvention, automated filing, formal Matter creation outside existing MarkReg flow.
13. **Expected PR title:** `[LITE-AGENCY][P3] Add governed conversational intake staging`.

### LITE-AGENCY-P4 — Operational Work owner

1. **Task ID:** `LITE-AGENCY-P4`
2. **Allowed directories:** Lite contract/service/API first; UI projection separate; coordinate shared lock.
3. **Objective:** persist manual/automatic agency work with waiting/follow-up and internal due semantics.
4. **Canonical sources:** Daily Workspace, Product Loop, Trademark Asset Management, MarkReg deadline authority.
5. **Contracts:** new WorkItem only for operational work; reuse existing severity/source refs; distinguish internal due from certified deadlines.
6. **Behavior:** create/update/assign/wait/resume/complete/remind with idempotent source-generated creation.
7. **Transitions:** completion never mutates filing/lifecycle truth; waiting does not dismiss owner signals.
8. **UI states:** separate Today/Work/Calendar UI task after UI skill load.
9. **Events:** bounded work-created/changed signals only if needed by existing Today projection; no duplicate event system.
10. **Acceptance:** restart-safe work, exact related refs, duplicate source event does not duplicate Work, Today/calendar read correct planning time.
11. **Validation:** Lite unit/integration/contract tests, migrations if any, workspace validation, hosted CI.
12. **Non-goals:** timesheets, billing, workflow designer, legal deadline certification.
13. **Expected PR title:** `[LITE-AGENCY][P4] Add durable agency operational work`.

### LITE-AGENCY-P5 — Workspace Watch target

1. **Task ID:** `LITE-AGENCY-P5`
2. **Allowed directories:** Lite contract/service + Data Engine read adapter as required; coordinate shared lock.
3. **Objective:** persist bounded monitoring intent for applicant/unmanaged trademark targets without polluting managed portfolio.
4. **Canonical sources:** Trademark Asset Management dispositions, Data Engine discovery, #1092.
5. **Contracts:** target kind + exact target ref + purpose + policy/status; `WATCH != MANAGED`.
6. **Behavior:** add/pause/remove watch; materialize changes as evidence/signals; interpretation delegated to #1092/Cordis.
7. **Transitions:** watch action cannot assign managed/represented relationship.
8. **UI states:** separate UI task with unsupported/ambiguous target/error/success/paused states.
9. **Events:** consume owner change observations; emit/reuse management recommendation inputs only through governed boundaries.
10. **Acceptance:** applicant watch detects new discovery candidates without bulk-copying portfolio; trademark watch preserves source refs and purpose.
11. **Validation:** Lite/Data Engine integration tests, hosted CI.
12. **Non-goals:** standalone monitoring truth store, automatic enforcement/marketing outreach.
13. **Expected PR title:** `[LITE-AGENCY][P5] Add Workspace trademark and applicant watch targets`.

### LITE-AGENCY-P6 — Communication association and triage

1. **Task ID:** `LITE-AGENCY-P6`
2. **Allowed directories:** Lite association/triage + read-only Managed Communication client boundary; coordinate shared contracts.
3. **Objective:** turn normalized email evidence into reviewable business links and action candidates.
4. **Canonical sources:** Managed Communication, Trademark Asset, CustomerContext, MarkReg ProductionIntake, Work.
5. **Contracts:** exact evidence/confidence/method/status; no source truth mutation.
6. **Behavior:** deterministic-first exact identifiers/thread inheritance, contextual candidate matching, AI semantic fallback, human confirm/reject.
7. **Transitions:** confirmed association may prepare Work/Intake handoff; it cannot alter official lifecycle state.
8. **UI states:** Inbox UI separate, must load UI skill.
9. **Events:** source communication reference preserved for every generated work/change candidate.
10. **Acceptance:** exact ref wins; ambiguous semantic match remains suggested; user correction persists without editing the source message.
11. **Validation:** Lite/communication integration tests, hosted CI.
12. **Non-goals:** email provider implementation, autonomous reply/send, legal deadline certification.
13. **Expected PR title:** `[LITE-AGENCY][P6] Add governed communication association and triage`.

### LITE-AGENCY-P7 — Prepared client communication loop

1. **Task ID:** `LITE-AGENCY-P7`
2. **Allowed directories:** Lite preparation/PreparedAction extension + Managed Communication exchange adapter; coordinate shared contracts.
3. **Objective:** prepare event/work-driven client notifications and require explicit human send confirmation.
4. **Canonical sources:** Product Loop/PreparedAction; Managed Communication exchange; CustomerContext/contact refs; Work/#1092 recommendation refs.
5. **Contracts:** reuse PreparedAction if semantically clean; otherwise minimum PreparedClientCommunication. No second mail stack.
6. **Behavior:** select base template/profile -> fill source-grounded variables -> AI/user edit -> confirm -> send -> receipt -> timeline/waiting/follow-up.
7. **Transitions:** draft != send; send receipt != legal filing; missing contact blocks send but not customer existence.
8. **UI states:** draft/loading/missing-contact/review/send-in-progress/provider-error/sent; UI task must load UI skill.
9. **Events:** exact outbound Managed Communication receipt feeds timeline/work only.
10. **Acceptance:** source refs/fingerprint retained, stale source forces re-review where material, duplicate confirmation does not duplicate send under existing idempotency semantics.
11. **Validation:** Lite + Capability Engine integration tests, hosted CI.
12. **Non-goals:** autonomous campaigns, CRM marketing suite, mass unsolicited outreach, standalone template platform.
13. **Expected PR title:** `[LITE-AGENCY][P7] Add governed client communication preparation`.

## 15. Safe immediate parallel work

Only these implementation lanes should start before shared-contract ownership is free, and only if fresh-main audit confirms they can remain inside existing public interfaces:

### Start now — P1A Microsoft Graph provider

Rationale: Managed Communication already owns the model and Gmail provides a concrete adapter. The first slice can be provider-local with tests and no shared contract mutation.

### Start now — P1B bulk migration orchestration

Rationale: Trademark Asset Portfolio already has bounded admission semantics. A private Lite orchestration/service slice can prove chunking/idempotency/recovery without redesigning Asset contracts or UI.

### Hold behind shared-contract coordination

- P2 applicant-discovery contract changes;
- P3 Intake staging public contract;
- P4 Work Item contract;
- P5 Watch target contract;
- P6 communication association public contract;
- P7 prepared communication public contract.

Do not create parallel competing contracts while the Shared Contracts Lock is owned elsewhere.

## 16. Dogfood order

1. Import MO/company self-owned trademarks and validate `OWNED` relationship.
2. Import a name-only customer/applicant list.
3. Discover applicant portfolios from Data Engine; review ambiguous identities.
4. Explicitly promote selected discovered marks to managed relationships.
5. Connect the two real Outlook mailboxes through Managed Communication Graph provider.
6. Run one real new-filing source bundle through Lite staging -> MarkReg ProductionIntake.
7. Generate one automatic Work/Today item and one waiting-for-client/provider state.
8. Admit one multi-source status/change scenario and prove freshness/conflict + #1092 interpretation.
9. Prepare and human-confirm one real client notification.
10. Review correction data for first Cordis-local alias/routing/SOP learning.

## 17. Exit gates

P0 is complete when this owner map is reviewed against fresh main and later implementation issues obey it.

Agency Workspace V1 is complete only when the first vertical slice is proven with:

- exact owner lineage;
- restart-safe durable state where persistence participates;
- no duplicate domain owners;
- no authority collapse;
- affected tests and hosted CI green;
- real dogfood across portfolio, mail, new filing, work, change interpretation and client communication.

## 18. Permanent architecture locks

- Customer != Applicant.
- Discovered != Managed/Represented.
- Watch != Managed Portfolio.
- Lite intake staging != MarkReg ProductionIntake/formal Asset/Matter.
- AI extraction != verified fact.
- Email/provider observation != Official Truth.
- Data Engine observation != legal conclusion.
- Detected date != certified legal deadline.
- Last writer != authoritative status.
- Work completion != filing success / Official Truth.
- AI/client draft != send.
- Contact presence != customer relationship truth.
- No cross-service SQL.
- No second Capability Runtime.
- No second Managed Communication stack.
- No second Trademark Asset/Portfolio store.
- No second monitoring/status truth store.
- No calendar truth store.
