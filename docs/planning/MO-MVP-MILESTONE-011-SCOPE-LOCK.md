# MO MVP Milestone 11 — Scope Lock

- **Milestone:** M11 — Proactive Trademark Asset Management
- **Direction:** `PROACTIVE_TRADEMARK_ASSET_MANAGEMENT_AND_GOVERNED_ACTION_LOOP`
- **Primary product:** MO Lite
- **Baseline:** post-M10 audited `main`
- **Status:** scope frozen for implementation

## 1. Problem statement

M10 made Trademark Assets durable, explainable, source-aware and actionable through explicit handoff into existing governed surfaces. The next product problem is no longer whether MarkOrbit can display and explain an Asset. It is whether MarkOrbit can continuously help a professional user manage a portfolio over time without silently creating legal truth or bypassing owner/execution authority.

M11 therefore answers:

> Given a real private Trademark Asset portfolio, can MarkOrbit continuously detect management-relevant change, explain why it matters, prepare the right next step, and place that next step into an existing governed workflow while preserving evidence, uncertainty and explicit user control?

M11 is not defined as a standalone retry/dead-letter milestone. Recovery and replay are required, but they are a reliability work package supporting the product loop rather than the product goal itself.

## 2. Completion definition

M11 is complete when a real authenticated Lite Workspace can continuously manage a real Trademark Asset portfolio through a bounded loop:

`Asset observations -> management signal -> explainable risk/opportunity -> user-reviewed recommendation -> governed next-step preparation -> Today/Work/Matter handoff -> feedback -> refreshed Asset context`

Completion requires all of the following:

- portfolio-level management signals are derived from source-owned observations rather than invented official truth;
- observed dates, statuses and changes retain provenance, freshness and uncertainty;
- the system can distinguish likely time-sensitive, stale, conflicting, missing, lifecycle-relevant and user-priority management conditions;
- recommendations are explicit and reviewable;
- selected next steps enter existing governed Product/owner/execution surfaces rather than directly filing, contacting, paying or publishing;
- user disposition and workflow outcomes feed back into the private Product context without becoming official truth or verified Capability;
- failed refresh/preparation work is retryable, recoverable and replay-safe;
- the real authenticated portfolio journey is independently validated for workspace isolation, restart/replay safety and authority boundaries.

## 3. Work packages

### M11-WP01 — Management Signal & Authority Contracts

Freeze contracts for portfolio management signals, signal dimensions, severity, source/freshness envelopes, recommendation candidates, user disposition and governed handoff references.

Permanent locks:

- management signal != official status;
- observed date != certified legal deadline;
- recommendation != filing instruction or authorization;
- user disposition != verified legal conclusion;
- no cross-service SQL;
- source owners remain authoritative for their own domains.

### M11-WP02 — Portfolio Change Detection & Refresh Ledger

Add durable, workspace-scoped observation/change tracking so the Product can tell what changed since the previous useful view.

Required dimensions include source freshness, added/removed/changed observations, unresolved conflicts, owner-domain lifecycle change, Knowledge relevance and user-maintained priority changes.

The ledger records source references and versions. It does not decide legal truth.

### M11-WP03 — Time-Sensitive & Risk/Opportunity Management Signals

Build bounded signal derivation over current and changed observations.

Initial dimensions:

- observed-date proximity;
- stale or missing consequential context;
- conflicting consequential observations;
- lifecycle recommendation relevance;
- Knowledge/rule-change relevance;
- user priority;
- portfolio concentration / repeated-condition signals where supported by existing evidence.

Signals must explain why they exist and expose supporting evidence. They must never certify a deadline, status or legal outcome.

### M11-WP04 — Management Recommendation Preparer

Prepare reviewable next-step candidates from Management Signals and existing M10 AI Guide context.

Examples of bounded outputs:

- verify source / deadline candidate;
- gather missing information;
- review lifecycle recommendation;
- prepare renewal/declaration/OA/opposition-related work candidate when source context supports the category;
- prepare Content/Today/Work candidate;
- defer/dismiss/watch candidate.

The preparer does not file, contact an authority/provider/customer, spend money or resolve conflicts.

### M11-WP05 — Governed Asset Action Handoff

Turn a user-selected recommendation into an explicit handoff to existing governed surfaces.

Reuse existing Today, Work/Matter, Order and Execution authority instead of creating a parallel execution stack.

Requirements:

- user confirmation before handoff;
- source/evidence snapshot travels with the handoff;
- no protected action is authorized merely because an Asset signal exists;
- owner-domain validation remains mandatory where applicable;
- external execution remains separately authorized.

### M11-WP06 — Proactive Portfolio Workspace UX

Extend the Trademark Asset Portfolio into an active management workspace.

Required product surfaces:

- portfolio attention/risk summary;
- what changed since last review;
- why this needs attention;
- evidence/freshness/conflict visibility;
- recommended next step;
- explicit watch/defer/dismiss/continue controls;
- clear distinction between observed fact, Product signal, AI/recommendation and governed work state.

No dark-pattern urgency and no presentation of Product inference as official truth.

### M11-WP07 — Feedback, Watch State & Recovery / Dead-Letter Reliability

Persist private management disposition and watch state, then make refresh/preparation failures recoverable.

Product feedback includes watched, deferred, dismissed, continued and resolved-by-workflow references.

Reliability includes:

- bounded retry policy;
- durable failure/dead-letter record;
- failure reason and source context;
- idempotent replay;
- operator-visible recovery state;
- successful replay re-enters the normal pipeline without duplicating Product state;
- no failure path silently drops a consequential management observation.

Retry/dead-letter is intentionally a supporting WP inside M11 rather than the milestone goal.

### M11-WP08 — Real Runtime Reliability & Independent Authority Audit

Independently prove the complete authenticated management loop.

Minimum audit matrix:

- authenticated Workspace isolation;
- direct-ID guessing protection;
- source provenance and freshness retained;
- conflicting observations remain explicit;
- observed dates are not represented as certified legal deadlines;
- recommendation cannot directly trigger filing/contact/payment/publication;
- user confirmation required for governed handoff;
- restart/retry/replay is idempotent;
- dead-letter recovery does not duplicate signals/actions;
- desktop/mobile real browser journey;
- no fixture fallback in the audited path;
- no cross-service SQL;
- M1-M10 authority boundaries remain intact.

## 4. Explicit non-goals

M11 does not silently add:

- official registry truth verification by Lite;
- certified legal deadline calculation;
- autonomous legal advice or legal conclusion;
- autonomous filing;
- autonomous customer/provider/authority contact;
- autonomous payment;
- Marketplace publication or transaction execution;
- transfer/assignment execution;
- automatic conflict resolution;
- verified Capability promotion from Product feedback;
- production deployment or GA authorization.

Any of these requires a separately frozen milestone or existing owner/execution authority.

## 5. Source ownership

M11 consumes but does not replace existing owners:

- **Trademark Asset / Product context:** Lite;
- **identity / Workspace / account:** Core;
- **Matter / Lifecycle / official workflow preparation:** MarkReg;
- **protected external execution:** Execution;
- **raw Knowledge acquisition/provenance:** external Knowledge pipeline;
- **structured registry/fact evidence:** Data Engine through read-only contract-bound APIs;
- **Capability truth:** Capability Engine;
- **provider truth:** MGSN / relevant owner service.

Cross-domain composition occurs through contracts/APIs, never cross-service SQL.

## 6. Product principles

M11 should make MarkOrbit feel proactive without pretending certainty.

The UX grammar is:

`Observed -> Changed -> Needs attention -> Why -> Suggested next step -> User decides -> Governed work`

Every consequential surface should make it possible to answer:

1. What changed?
2. Which source says so?
3. How fresh is it?
4. Is there conflict or missing context?
5. Why does MarkOrbit think it deserves attention?
6. What can the user safely do next?
7. Which system owns the next authoritative step?

## 7. Milestone exit state

M11 exit does not mean production deployment or GA. It means the proactive Trademark Asset management loop is engineering-complete, independently audited and safe to become the foundation for later service automation, commercial execution or production-release milestones.
