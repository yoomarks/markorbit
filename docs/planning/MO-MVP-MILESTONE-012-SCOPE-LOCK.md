# MO MVP Milestone 12 — Scope Lock

- **Milestone:** M12 — Trademark Service Workbench & Governed Service Preparation
- **Direction:** `TRADEMARK_SERVICE_WORKBENCH_AND_GOVERNED_SERVICE_PREPARATION`
- **Primary product:** MO Lite
- **Baseline:** post-M11 audited `main`
- **Status:** scope frozen for implementation

## 1. Problem statement

M10 established durable Trademark Assets and contextual AI assistance. M11 made those Assets proactively manageable through source-aware change detection, Management Signals, reviewable recommendations, governed handoff, disposition/watch state and replay-safe recovery.

The next gap is operational: a recommendation can reach Today, Work or Matter, but professional users still need to translate that recommendation into a service-ready package that answers what service is being prepared, which jurisdiction requirements apply, what evidence is present or missing, which capability/provider may be needed, whether commercial review is required, and whether the work is ready to cross the protected Execution boundary.

M12 therefore answers:

> Given a reviewed Trademark Asset management recommendation or an existing Matter, can MarkOrbit prepare a complete, explainable and governed professional service work package without inventing legal truth, bypassing owner-domain validation, autonomously quoting, contacting, paying or executing?

## 2. Completion definition

M12 is complete when a real authenticated Workspace can move from a reviewed service need to a governed execution-ready preparation loop:

`Asset/Matter context -> Service Intent -> jurisdiction requirement candidates -> evidence/readiness assessment -> missing information -> capability/provider/package candidates -> commercial/client/provider preparation -> professional review -> execution-readiness gate -> Execution preparation reference`

Completion requires:

- Service Intent is explicit and reviewable rather than inferred execution authority;
- requirements retain source, jurisdiction, freshness, uncertainty and review status;
- Knowledge supplies acquired/provenanced material only; user-specific legal judgment remains outside Knowledge;
- readiness describes preparation completeness, not success probability or legal validity;
- missing client/provider/owner-domain inputs are explicit;
- Capability/Provider/Service Package matching is candidate-only until owner validation;
- quotes, client requests and provider instructions are prepared drafts until explicitly reviewed;
- a Service Work Package composes existing Asset, Matter, Capability, Provider, Order/Payment and Execution references rather than creating a parallel case system;
- the execution-readiness gate cannot authorize filing, contact, payment or publication by itself;
- real authenticated desktop/mobile journeys are independently audited for workspace isolation, replay safety and authority boundaries.

## 3. Work packages

### M12-WP01 — Service Intent, Requirement & Authority Contracts

Freeze Service Intent vocabulary, requirement/evidence envelopes, readiness states, missing-input reasons, Service Work Package references, candidate matching, draft preparation and execution-readiness authority locks.

### M12-WP02 — Durable Service Work Package

Add a Lite-owned, workspace-scoped durable Service Work Package linked to existing Trademark Asset and/or MarkReg Matter references. Do not create a second Matter/case lifecycle.

### M12-WP03 — Jurisdiction Requirement Composition

Compose bounded requirement candidates from Knowledge provenance, existing source references, Capability metadata and Matter/Asset context. Requirements remain candidates until professional/owner review where necessary.

### M12-WP04 — Readiness & Missing Information Engine

Assess preparation completeness across identity, jurisdiction, documents, evidence, owner-domain review, provider/capability and commercial prerequisites. Readiness must never represent legal outcome probability.

### M12-WP05 — Capability / Provider / Service Package Matching

Match reviewed Service Intent to existing Capability Engine and MGSN/provider truth through contracts/APIs. Produce ranked or eligible candidates without silently verifying Capability or selecting/engaging a provider.

### M12-WP06 — Quote & Client/Provider Preparation

Prepare bounded quote candidates, client-information requests, provider enquiry/instruction drafts and document-package candidates. No automatic sending, binding price commitment, payment or provider engagement.

### M12-WP07 — Professional Service Workbench UX

Expose one compositional workbench answering: what service is being prepared, why, source basis, what is present/missing, who/what can fulfil it, commercial preparation, review state and the next governed action.

### M12-WP08 — Execution Readiness & Independent Authority Audit

Independently prove the authenticated end-to-end preparation loop, replay/restart safety, workspace isolation, no fixture fallback, no cross-service SQL, and preservation of MarkReg/Capability/MGSN/Order/Payment/Execution authority.

## 4. Initial Service Intent vocabulary

Initial bounded categories include:

- NEW_APPLICATION
- RENEWAL
- USE_DECLARATION
- OFFICE_ACTION_RESPONSE
- OPPOSITION_RESPONSE
- CANCELLATION_OR_INVALIDATION
- ASSIGNMENT_OR_TRANSFER_RECORDAL
- OWNER_NAME_OR_ADDRESS_CHANGE
- LICENSE_OR_OTHER_RECORDAL
- CERTIFICATE_REISSUE
- RESTORATION_OR_REVIVAL
- SEARCH_OR_CLEARANCE
- WATCH_OR_MONITORING
- EVIDENCE_PREPARATION
- OTHER_REVIEW_REQUIRED

The vocabulary identifies preparation category only. It is not a legal conclusion that the service is available, required, timely or sufficient.

## 5. Service Readiness states

Initial states:

`DRAFT -> CONTEXT_INCOMPLETE -> REQUIREMENTS_REVIEW_REQUIRED -> MISSING_CLIENT_INPUT -> PROVIDER_INPUT_REQUIRED -> COMMERCIAL_REVIEW_REQUIRED -> READY_FOR_USER_CONFIRMATION -> READY_FOR_EXECUTION_PREPARATION`

A readiness state expresses preparation completeness only. It does not certify filing eligibility, legal deadline compliance, registrability, success probability or official acceptance.

## 6. Source ownership

M12 composes existing owners instead of replacing them:

- **Trademark Asset / Service Work Package Product context:** Lite;
- **identity / Workspace / account:** Core;
- **Matter / Lifecycle / owner-domain legal workflow:** MarkReg;
- **Knowledge acquisition/provenance:** external Knowledge pipeline;
- **structured registry/fact evidence:** Data Engine through read-only contract-bound APIs;
- **Capability truth:** Capability Engine;
- **Provider truth:** MGSN / relevant provider owner;
- **Order/commercial transaction truth:** Order/commercial owner;
- **Payment truth:** Payment owner;
- **protected external execution:** Execution.

No cross-service SQL is permitted.

## 7. Permanent authority locks

M12 must preserve all earlier authority boundaries and additionally freeze:

- `ServiceIntent != legal conclusion`;
- `RequirementCandidate != certified legal requirement`;
- `ReadinessScore/State != success probability`;
- `MissingInputDetection != legal insufficiency finding`;
- `CapabilityCandidate != verified Capability`;
- `ProviderCandidate != provider engagement`;
- `QuoteCandidate != binding quote`;
- `ClientRequestDraft != sent communication`;
- `ProviderInstructionDraft != provider instruction sent`;
- `ExecutionReadiness != execution authorization`;
- no automatic filing, contact, publication, transfer, payment or provider engagement;
- no Product feedback or AI output may promote itself into owner-domain truth;
- merge does not equal production deployment or GA.

## 8. Explicit non-goals

M12 does not silently add:

- autonomous legal advice or final legal conclusion;
- certified deadline calculation;
- official registry truth verification by Lite;
- final professional requirement approval by AI;
- autonomous client/provider/authority communication;
- autonomous provider selection or engagement;
- autonomous quote commitment or discount approval;
- autonomous payment;
- autonomous filing/publication/recordal;
- production deployment or GA authorization.

## 9. Product principle

The UX grammar is:

`Need identified -> Service Intent -> What is required -> What we have -> What is missing -> Who/what can fulfil it -> Commercial preparation -> Human review -> Ready to prepare execution`

M12 should make professional service work materially faster while keeping the final authoritative and protected steps in their existing owner domains.
