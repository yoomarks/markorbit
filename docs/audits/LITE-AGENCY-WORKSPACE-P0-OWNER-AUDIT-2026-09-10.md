# Lite Agency Workspace P0 Owner Audit

Date: 2026-09-10

Parent Epic: #1093  
Audit Issue: #1094  
Current-main audit baseline: `a3e26117043600c5dfde42678a3fa315d75271db`  
Related existing lane: #1092  
Current Shared Contracts writer: PR #1088

## 1. Decision summary

Agency Workspace should be built as a thin orchestration and operating layer over existing Mark Orbit owners, not as a new CRM/IPMS/mail/calendar stack.

The product loop is:

`Move In -> Connect -> Understand -> Organize -> Act -> Communicate -> Remember -> Learn`

The repository already owns most of the durable business truth needed for this loop. P1+ should introduce only the missing seams:

1. Workspace-private Directory for optional people/organization/contact/role context;
2. migration job/orchestration over the existing Trademark Asset bulk-import boundary;
3. Microsoft Graph provider under Managed Communication;
4. Lite-owned Communication Link/Resolver between exact communication evidence and business refs;
5. Lite-owned generic operational Work Item because no general user-task owner currently exists;
6. bounded Agency source-extraction/review orchestration before human-confirmed handoff to existing MarkReg Production Intake when new-filing instructions originate in files/email/chat.

The audit explicitly rejects a second durable Lite `FilingIntake` / `TrademarkDraft` owner. MarkReg already owns durable production pre-filing input through `ProductionIntakeV1`.

## 2. Current-main owner matrix

| Concept | Canonical owner | Current repository evidence | Decision | Exact gap |
| --- | --- | --- | --- | --- |
| Workspace customer relationship | MarkReg / Customer Context | `packages/contracts/src/customer-context.ts` | REUSE | Name-first relationship exists; optional contact/org directory does not. |
| Workspace-local contact / organization / operational role | none found as a general owner | Customer Context deliberately has no contact-authority semantics | NEW MINIMUM | Workspace Directory only; no CRM pipeline. |
| Cooperating provider/network identity | MGSN | `packages/contracts/src/network-participation.ts`, `packages/contracts/src/provider-execution.ts` | REUSE BY REFERENCE | Offline counsel may remain a local Directory entry; do not force Provider enrollment. |
| Applicant / registry owner identity | Data Engine / official sources | external facts referenced from Asset/Data Engine boundaries | REFERENCE ONLY | Need local alias/mapping refs; do not copy legal identity into a verified local truth store. |
| Trademark workspace asset | Lite Trademark Asset | `packages/contracts/src/trademark-asset-workspace.ts`, `services/lite/src/trademark-asset.ts` | REUSE | None at owner level. |
| Portfolio search/bulk admission | Lite Trademark Asset Portfolio | `packages/contracts/src/trademark-asset-portfolio.ts`, `services/lite/src/trademark-asset-portfolio.ts` | REUSE | Existing bulk admission is 1-100 assets/call; large migration needs orchestration. |
| Durable pre-filing/new-application intake | MarkReg Early Funnel | `packages/contracts/src/markreg-early-funnel.ts`, durable MarkReg Production Intake runtime | REUSE | Source extraction/review before confirmed MarkReg command only. |
| Trademark-service preparation/readiness | Lite Trademark Service Workbench | `packages/contracts/src/trademark-service-workbench.ts`, `services/lite/src/trademark-service-*` | REUSE | Not a generic internal task owner. |
| Managed email/account/message/evidence/checkpoint/send | Capability Engine Managed Communication | `packages/contracts/src/managed-communication.ts`, `services/capability-engine/src/managed-communication-*` | REUSE | Microsoft Graph provider missing; product account ownership/entitlement seam later. |
| Gmail provider | Capability Engine | `managed-communication-gmail.ts` plus anchor/reconciliation/runtime | REUSE PATTERN | Add Graph adapter, not a new email system. |
| Message/thread -> business object association | none found | no current canonical link owner between Managed Communication and Customer/Asset/Matter/Production Intake | NEW MINIMUM | Lite Communication Link/Resolver. |
| Asset attention / urgency / observed-date handling | Lite Asset Management | `packages/contracts/src/trademark-asset-management.ts`, Lite signal/recommendation/handoff services | REUSE/EXTEND | Feed communication-derived candidates into existing governed signal/recommendation model. |
| Daily orchestration | Lite Today/Product Loop/Daily Workspace | `packages/contracts/src/product-loop.ts`, `packages/contracts/src/daily-workspace.ts` | REUSE | Needs a durable generic Work owner to project real operational tasks. |
| Generic internal operational task | none found | provider work/read models and trademark service workbench are purpose-specific | NEW MINIMUM | Lite Work Item. |
| Calendar | none required | Today/Daily Workspace already expresses time sensitivity; legal deadline remains owner truth | REJECT NEW OWNER | Calendar is a read projection only. |
| Trademark change interpretation | Capability/Cordis pilot | #1092 | REUSE | Consume; do not create a second monitoring/interpretation stack. |
| Client/provider communication draft | Lite Trademark Service Workbench | `TrademarkServiceCommunicationDraft` in `packages/contracts/src/trademark-service-workbench.ts` | REUSE/EXTEND FIRST | Event-notification draft may require additive intent later, but no second draft owner now. |
| External send | Managed Communication | provider-neutral prepared-send/dispatch boundary | REUSE | Human-confirmed product handoff only. |
| Generic file/DMS truth | none justified | communication attachments are evidence; no generic DMS owner is needed for migration | REJECT | Keep bounded input source refs/hash only. |
| Workspace-local personalization | Capability/Cordis | Workspace implementation preference and approved context boundaries | REUSE | Learn corrected aliases, linking, due policy, tone/routing/follow-up after explicit feedback. |

## 3. Reuse vs new-object decisions

### REUSE

- Trademark Asset and its Portfolio search/bulk admission.
- MarkReg Production Intake as the durable pre-filing/new-application input owner.
- Customer Context for explicit Workspace customer relationship.
- MGSN Provider/Network Participation for network provider truth when applicable.
- Managed Communication for account binding, normalized email, attachments, exact evidence, checkpoints and governed send.
- Trademark Asset Management for freshness/conflict/severity/recommendation/disposition semantics.
- Today/Product Loop/Daily Workspace for daily orchestration.
- Trademark Service Workbench for service readiness and unsent client/provider communication draft.
- #1092 for Workspace-local trademark change interpretation.
- existing Capability/Cordis Workspace-local preference/context mechanisms.

### EXTEND

- Managed Communication with Microsoft Graph provider implementation only.
- Trademark Asset migration ingress with an orchestration layer above existing `bulkImport()`.
- Trademark Service communication draft intent only if the client-notification vertical slice proves the current intent vocabulary insufficient.
- Today/Calendar read projections after Work Item exists.

### NEW MINIMUM

- Workspace Directory.
- Bulk Migration Job / migration orchestration metadata if durable retry/progress is required.
- Communication Link/Resolver.
- Lite Work Item.
- optional Agency Intake Session/Candidate only if source extraction/review must survive restart before the user confirms a MarkReg Production Intake command.

### REJECT

- new CRM.
- new IPMS portfolio owner.
- new Lite Filing Intake / Trademark Draft durable business owner.
- new mailbox store/domain.
- new monitoring/status truth store.
- new canonical Calendar state machine.
- generic DMS introduced as a side effect of migration.
- autonomous notification sender.

## 4. Critical pre-filing correction

`ProductionIntakeV1` already owns production-grade pre-filing input with:

- Workspace identity;
- version and fingerprint;
- status `RECEIVED | RECOMMENDATION_READY`;
- business context;
- applicant type/name/country;
- trademark type/representation text;
- target jurisdictions;
- goods/services source text;
- filing goal;
- source class `CUSTOMER_SUPPLIED`;
- explicit false authority consequences for professional approval, legal conclusion, filing authorization, protected action, Order, Payment, Invoice, filing and Official Truth.

Therefore Agency Workspace must use:

```text
source files / email / chat
        |
        v
Lite extraction candidate + exact provenance
        |
        v
human review / missing information
        |
        v
explicit confirmation
        |
        v
existing MarkReg Production Intake command
```

It must not use:

```text
Lite FilingIntake -> Lite filing lifecycle -> MarkReg filing lifecycle
```

If a durable pre-confirmation object is required, its authority is limited to source/candidate/review state. Suggested neutral naming: `AgencyIntakeSession` / `AgencyIntakeCandidate`.

## 5. Truth and authority matrix

| Object/fact | Truth class | May become authoritative by itself? | Required rule |
| --- | --- | --- | --- |
| Customer Relationship | Workspace explicit relationship | No legal identity authority | `Customer != Applicant`. |
| Directory person/org/contact | Workspace-private operational context | No | contact presence does not establish contact authorization or legal identity. |
| Applicant ref | external/Data Engine/official reference | Only owner source can establish its own fact | Lite stores refs/aliases, not copied verification truth. |
| Discovered trademark | Data Engine discovery candidate | No management authority | `DISCOVERED != MANAGED/REPRESENTED/OWNED`. |
| Managed/Represented/Owned Asset relationship | explicit Workspace decision | Yes only for Workspace relationship meaning | does not certify official registry state. |
| Watch target/disposition | Workspace attention intent | No management relationship | `WATCH != MANAGED`. |
| Agency extraction candidate | source-derived candidate | No | AI extraction != verified fact / customer instruction. |
| MarkReg Production Intake | durable customer-supplied case input | Yes for exact supplied intake material only | Intake != Recommendation/Matter/Filing/Official Truth. |
| Formal Matter/lifecycle | MarkReg owner truth | bounded owner authority | Matter/lifecycle projection != Official office status unless separately established. |
| Email/provider observation | Managed Communication evidence | No business/legal truth | may support link/action/date candidates only. |
| Detected date | observation/candidate | No | detected date != certified legal deadline. |
| Certified/legal deadline | MarkReg/owner exact source | Yes only through owner rules | Lite can project, not certify. |
| Work Item | Workspace operational commitment | Yes for internal work state | Work completion != filing or external-action success. |
| Communication draft | preparation | No external action | draft != send. |
| Managed Communication send receipt/evidence | external communication evidence | Yes for send evidence only | send does not mutate legal/customer/trademark truth by itself. |
| Trademark change interpretation | bounded Capability/Cordis interpretation | No Official Truth | consume #1092; last writer != authoritative status. |

## 6. Source and file boundary

Agency Workspace needs source provenance, not a general document management subsystem.

For migration/intake sources, retain only what is necessary for replay/audit, for example:

- source type;
- opaque file/message reference;
- SHA-256 where bytes are available under the owning boundary;
- schema/parser version;
- mapping version;
- source row/record locator;
- import/session batch identity;
- extraction candidate provenance;
- timestamps and actor/Workspace provenance from trusted context.

Do not make upload row numbers or original filenames durable business identities. Do not copy Managed Communication attachment bytes into Lite merely to associate them.

Current `services/lite/package.json` has no generic CSV/XLSX parsing dependency. The Migration Center must therefore keep the file-format edge separate from Lite durable owner logic. Do not casually add spreadsheet parsing/DMS dependencies to Lite service.

## 7. Managed Communication / Outlook boundary

Current Managed Communication already provides provider-neutral normalized email/evidence/send semantics and Gmail implementation with client, inbound, sender and polling/runtime pieces.

Microsoft 365 work is therefore a provider adapter only. First child: #1098.

Provider work may:

- authenticate to Microsoft Graph through a bounded credential source;
- read incrementally via provider cursor/delta semantics;
- normalize participants/body/attachments/provider IDs;
- admit exact evidence through current foundation;
- prepare/dispatch governed send/reply through current sender boundary.

Provider work may not:

- decide customer/trademark association;
- classify legal work;
- certify a deadline;
- create Work/Today;
- send client notifications autonomously;
- implement user plan/mailbox-count policy.

Per-user mailbox ownership/quota is a product entitlement seam above provider implementation. It should be provider-neutral.

## 8. Communication Link Resolver boundary

No canonical existing owner was found for normalized communication -> Customer/Asset/Matter/Production Intake association.

The minimum Lite-owned association should preserve:

- exact communication key: account/message/thread normalized/provider evidence refs;
- target owner/kind/id/version where applicable;
- method: exact identifier, thread inheritance, participant/Directory context, bounded AI semantic suggestion, human confirmation;
- confidence/evidence;
- status: suggested/confirmed/rejected;
- confirmer/provenance when human-reviewed.

Resolution priority must be deterministic-first:

1. exact application/registration/IR/internal-reference identifier;
2. confirmed thread inheritance;
3. confirmed Directory participant/alias + mark/jurisdiction context;
4. bounded AI semantic candidate;
5. unresolved/manual review.

AI semantic resolution never mutates Asset/Matter legal truth.

## 9. Work / Today / Calendar boundary

Audit found no general Workspace user task owner. Existing provider work and trademark service workbench are purpose-specific. `WORK_FOLLOW_UP` exists as a Today recommendation kind but is not a durable generic task object.

A minimum Lite Work Item is justified. Required semantics should include:

- Workspace-scoped stable Work Item identity/version;
- source: MANUAL or SYSTEM_PREPARED, with exact source refs;
- title/type;
- status including actionable and waiting states;
- assignee where present;
- priority/severity;
- `internalDueAt` distinct from owner-certified legal deadline;
- optional reminder/follow-up time;
- exact related refs to Customer/Directory/Applicant/Asset/Matter/Production Intake/Communication;
- idempotent automatic preparation/creation semantics;
- audit/history sufficient for Today and waiting/follow-up projections.

Calendar remains a projection over:

- Work Item internal due/reminder/follow-up;
- exact owner-certified deadlines;
- explicitly labeled observed/detected date candidates.

No independent Calendar write truth should be introduced.

## 10. Customer / Directory / Applicant boundary

Customer Context already provides an explicit Workspace customer relationship and intentionally does not establish legal identity or contact authority.

Workspace Directory fills only the operational gap:

- ORGANIZATION / PERSON;
- display name and aliases;
- optional email/phone/address/contact points;
- Workspace-local roles such as client contact, trademark owner contact, instructing agent, cooperating agent, foreign counsel, billing contact, internal owner;
- optional reference to existing CustomerRelationship;
- optional reference to existing MGSN Provider;
- optional applicant/Data Engine identity references/aliases.

It must not add sales funnel, lead scoring, billing ledger, opportunity pipeline or global Party ownership.

## 11. Migration boundary

Trademark Asset Portfolio bulk admission is the only asset import owner. Existing Lite `bulkImport()` handles up to 100 assets per call and returns created/duplicate/rejected outcomes without automatically creating Matters.

Agency migration adds orchestration only:

```text
CSV/XLSX/structured source edge
  -> column/schema detection
  -> explicit mapping preview
  -> normalization
  -> customer/directory/applicant reference resolution candidates
  -> duplicate preview
  -> confirmed chunk orchestration
  -> existing Trademark Asset bulkImport (<=100/call)
  -> durable progress/report/retry if required
```

Recommended migration-job facts, if durable persistence is needed:

- workspaceId;
- sourceRef/sourceFingerprint;
- mapping/schema versions;
- status;
- received/normalized/admitted/duplicate/rejected/needs-review counts;
- safe cursor/chunk progress;
- exact retry/idempotency identity;
- bounded error report refs.

Migration Job never becomes Trademark Asset truth and never creates Matter automatically.

## 12. Client communication loop

Reuse the current unsent `TrademarkServiceCommunicationDraft` before proposing another draft owner.

Target loop:

```text
Change / Work
  -> recommendation
  -> user chooses Notify Client
  -> existing/extended trademark-service communication draft
  -> AI/template fills bounded content
  -> human review
  -> explicit send handoff
  -> Managed Communication provider dispatch
  -> exact send evidence
  -> Work/timeline projection
```

No default autonomous external send.

Cordis may later specialize tone, language, signature, fee wording and follow-up policy but cannot bypass confirmation/authority boundaries.

## 13. Dependency graph

```text
#1094 P0 owner audit
      |
      +---------------------> #1098 Microsoft Graph provider [START NOW]
      |
      +---- Shared Contracts Lock #1088 released
      |             |
      |             +--> Workspace Directory vocabulary/persistence
      |             |
      |             +--> Lite Work Item vocabulary/persistence
      |             |
      |             +--> durable Migration Job vocabulary/persistence if required
      |
      +--> Trademark portfolio migration orchestration
      |
      +--> Communication Link/Resolver
      |             |
      |             +--> Unified Inbox classification/action candidates
      |                            |
      |                            +--> Work Item / Today
      |                                         |
      |                                         +--> Calendar projection
      |
      +--> MarkReg Production Intake handoff from confirmed source review
      |
      +--> #1092 trademark change interpretation
                    |
                    +--> client communication draft -> human-confirmed send
                                                   |
                                                   +--> timeline / Cordis feedback
```

## 14. Shared-hot-file / concurrency decision

PR #1088 currently owns the Shared Contracts Lock. Agency Workspace must not start contract-changing child PRs until that lock is released.

Safe now:

- #1098 `services/capability-engine/**` Microsoft Graph provider;
- docs-only architecture work;
- owner-local spikes that do not require `packages/**`, migrations or shared root files.

Hold until lock release:

- Workspace Directory shared contract;
- generic Work Item shared contract;
- shared migration-job vocabulary;
- shared Communication Link vocabulary if owner-local Lite types prove insufficient.

Every implementation task must stop and file a narrow dependency if its accepted path scope proves insufficient.

## 15. First production vertical slice

The first end-to-end proof should be deliberately small:

1. create/import one name-only customer relationship;
2. add minimal Directory aliases/contact only if available;
3. resolve one applicant against Data Engine and display discovered marks;
4. explicitly mark one discovered trademark as MANAGED;
5. receive one mixed-source new-filing instruction and extract a review candidate;
6. user confirms the candidate into existing MarkReg Production Intake;
7. ingest one Outlook email through Managed Communication;
8. resolver links the email to exact Customer/Asset or Production Intake context;
9. system prepares one Work Item with internal due/follow-up and Today projection;
10. one evidence change passes through existing freshness/conflict semantics and #1092 interpretation;
11. prepare one client communication draft;
12. human explicitly confirms send through Managed Communication;
13. reopen Customer/Asset/Work timeline projection and prove exact lineage to source evidence and send evidence.

Success means the user can operate a real agency case without switching between spreadsheet, Outlook, standalone calendar and human memory for the core follow-up loop.

## 16. Codex-ready first task shapes

### A. Microsoft Graph provider — #1098

1. Task ID: `LITE-AGENCY-P1-MICROSOFT-GRAPH`.
2. Allowed paths: `services/capability-engine/**` only.
3. Outcome: Outlook provider parity under Managed Communication.
4. Canonical sources: Managed Communication contract/foundation/exact evidence/exchange/Gmail implementation.
5. Contracts: consume existing only.
6. Behavior: Graph auth, delta sync, normalize, attachment evidence, send/reply, restart-safe checkpoint.
7. State: provider observation/checkpoint/send only.
8. UI: none.
9. Events: existing Managed Communication only.
10. Acceptance: provider normalization/replay/error/send tests; Gmail regression green.
11. Validation: Capability focused/full + workspace/format/diff/hosted affected CI.
12. Non-goals: OAuth UI, quotas, Inbox AI, linking, Work, legal truth.
13. PR title: `[CAPABILITY][LITE-AGENCY-P1] Add Microsoft Graph Managed Communication provider`.

### B. Workspace Directory contract/persistence — BLOCKED BY #1088

1. Task ID: `LITE-AGENCY-P1-DIRECTORY`.
2. Expected paths: minimum shared contract + Lite persistence owner, split into Integration contract/migration and Lite owner PRs if repository governance requires it.
3. Outcome: name-first Workspace-local org/person/contact/role context.
4. Canonical sources: Customer Context, MGSN Provider/Network Participation, Trademark Asset refs, #1094.
5. Contracts: additive V1 only; never replace CustomerRelationship/Provider/applicant truth.
6. Behavior: local org/person, optional contact points/aliases/roles, exact external owner refs, archive, version/idempotency/Workspace isolation.
7. State: ACTIVE/ARCHIVED operational directory only.
8. UI: none in owner PR.
9. Events: none unless an existing pattern requires them.
10. Acceptance: no CRM/legal identity/contact-authority implication; restart-safe and isolated.
11. Validation: contract + Lite PostgreSQL/persistence/boundary suites.
12. Non-goals: CRM pipeline, billing, global Party registry, Provider enrollment.
13. PR title: `[LITE-AGENCY][P1] Add Workspace Directory owner boundary`.

### C. Portfolio Migration Job/orchestration — prepare after owner contract decision

1. Task ID: `LITE-AGENCY-P1-MIGRATION`.
2. Paths: Lite owner first; file-format/browser adapters separately.
3. Outcome: large legacy portfolio migration without bypassing existing Asset bulkImport.
4. Canonical sources: Trademark Asset Workspace/Portfolio and Lite `bulkImport()`.
5. Contracts: reuse asset import; add only migration-job vocabulary if durability requires it.
6. Behavior: mapping/normalize/preview/chunk/retry/report/progress; never create Matter automatically.
7. State: intake job state only, not asset truth.
8. UI: separate Migration Center issue after owner API.
9. Events: no new cross-owner event by default.
10. Acceptance: tens-of-thousands simulated in chunks; deterministic retry; duplicate/rejected reporting.
11. Validation: Lite unit/PostgreSQL plus existing asset portfolio regression.
12. Non-goals: DMS, second importer, cross-service SQL, automatic management relationship guessing.
13. PR title: `[LITE-AGENCY][P1] Add portfolio migration orchestration`.

### D. Communication Link/Resolver

1. Task ID: `LITE-AGENCY-P2-COMM-LINK`.
2. Paths: Lite owner; shared contract only through separate Integration dependency if truly required.
3. Outcome: exact communication -> business-context association with explainable review.
4. Canonical sources: Managed Communication, Customer Context/Directory, Trademark Asset, MarkReg exact refs.
5. Contracts: consume existing refs; new minimum association only.
6. Behavior: deterministic-first candidates, confidence/evidence, suggested/confirmed/rejected, thread inheritance after confirmation.
7. State: association truth only, never business/legal truth mutation.
8. UI: separate Inbox review issue later.
9. Events: none/new only if required by existing Product Loop pattern.
10. Acceptance: exact-ID positive, thread inheritance, ambiguous participant/manual review, AI-only never auto-authoritative.
11. Validation: Lite unit/persistence/boundary tests.
12. Non-goals: inbox rendering, Work creation, deadline certification, Asset/Matter mutation.
13. PR title: `[LITE-AGENCY][P2] Add governed Communication Link resolver`.

### E. Generic Lite Work Item — BLOCKED BY #1088

1. Task ID: `LITE-AGENCY-P2-WORK-ITEM`.
2. Expected paths: minimum shared V1 + Lite persistence owner, split by repository governance.
3. Outcome: durable internal daily work for manual/system-prepared follow-up.
4. Canonical sources: Product Loop, Daily Workspace, Asset Management handoff; exclude provider-work/service-work owners.
5. Contracts: new minimum V1 only.
6. Behavior: source/manual, type/title, priority, status/waiting, assignee, internalDueAt, reminder/follow-up, exact related refs, idempotent system preparation.
7. State: operational work lifecycle only.
8. UI: separate Work/Today/Calendar consumer issue.
9. Events: reuse Today/Product Loop handoff patterns; no protected-action event.
10. Acceptance: manual/automatic/replay/waiting/reschedule/complete; internal due never masquerades as certified deadline.
11. Validation: contracts + Lite PostgreSQL + Today projection regression.
12. Non-goals: filing state, provider work truth, calendar truth, external send.
13. PR title: `[LITE-AGENCY][P2] Add durable Lite Work Item`.

## 17. Product UI sequence after owner APIs

Do not begin broad UI construction before the relevant owner APIs exist. Each UI issue must load `.agents/skills/ui-design/SKILL.md` and define loading/empty/error/permission/partial/success states plus Storybook/Playwright evidence.

Recommended user-facing order:

1. Migration Center;
2. Connected Accounts / Outlook onboarding;
3. Unified Inbox + association review;
4. Today upgrade;
5. Work: Tasks / Waiting;
6. Calendar projection;
7. Customer and Trademark detail timelines;
8. client-notification review/send loop.

The user-facing shell should expose jobs and decisions, not architecture jargon. A future IA may converge toward `Today / Inbox / Trademarks / Customers / Work / Create / More` without requiring an immediate all-at-once navigation rewrite.

## 18. Exit gate for #1094

P0 is considered architecturally frozen when:

- this document is merged from fresh main;
- #1093 reflects the no-duplicate-`FilingIntake` correction;
- #1098 is accepted as the first path-disjoint implementation issue;
- Directory and Work Item remain blocked from shared-contract writes until #1088 releases the lock;
- no child issue introduces a second Asset, Customer legal identity, Provider, email, monitoring, Calendar, DMS, Capability runtime or filing-intake owner;
- future changes continue to obey `Root cause + Minimum change + Reuse + Verification + Scope discipline`.
