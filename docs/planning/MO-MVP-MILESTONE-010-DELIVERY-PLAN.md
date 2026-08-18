# MO MVP Milestone 10 — Delivery Plan

- **Milestone:** M10 — Trademark Asset Workspace & Contextual AI Guide
- **Status:** APPROVED_FOR_IMPLEMENTATION_AFTER_SCOPE_MERGE
- **Depends on:** completed M9 Daily Workspace and existing M1-M9 owner/authority boundaries
- **Primary outcome:** a durable private trademark portfolio that can be explained, prioritized and safely assisted by a contextual AI Guide

## 1. Delivery strategy

M10 is delivered as eight bounded work packages:

```text
WP01 contracts / authority
-> WP02 durable Asset projection
-> WP03 owner + read-only data composition
-> WP04 explainable attention
-> WP05 contextual AI Guide
-> WP06 Asset Workspace UI
-> WP07 Today / Content / Work integration + feedback
-> WP08 reliability / independent audit
```

One work package per bounded branch/PR remains preferred. Runtime work begins only after the scope-lock PR is merged.

## 2. WP01 — Asset and AI Guide contracts / authority boundary

### Goal

Freeze the smallest shared vocabulary needed for Trademark Assets and contextual assistance without creating a second registry, Matter lifecycle or execution authority.

### Acceptance

- contract tests distinguish Asset projection from official/owner truth;
- exact source/freshness fields are mandatory where a claim depends on them;
- AI suggestion is explicitly non-executing;
- owner-domain transitions require existing governed boundaries;
- no cross-service SQL or new physical AI service is introduced merely for product naming.

## 3. WP02 — Durable Workspace Trademark Asset projection

### Goal

Persist private, Workspace-scoped Trademark Assets with stable identity and exact source references.

### Scope

- deterministic Asset identity;
- jurisdiction and application/registration identifiers where present;
- exact source references and observation timestamps;
- Workspace-owned tags/notes;
- related owner record references;
- replay-safe admission/update semantics;
- optimistic concurrency where mutation is user-visible;
- direct identifier access isolation.

### Non-goals

- official registry truth creation;
- automatic Matter creation;
- automatic deadline certification.

## 4. WP03 — Owner and Data source composition

### Goal

Make Assets useful by composing current owner projections and approved read-only external/public data contracts.

### Source rules

- MarkReg remains owner of Matter/Lifecycle/Order truth;
- Execution remains owner of protected execution/review evidence;
- Knowledge remains source/provenance owner for rules/notices;
- Data Engine may only be consumed through explicit read-only contracts;
- conflicts are represented, not silently resolved by Lite.

### Acceptance

At least one real Asset composes an existing owner projection through service/read boundaries with exact provenance and no cross-service SQL.

## 5. WP04 — Explainable Asset attention model

### Goal

Turn current Asset context into a small, explainable attention surface.

### Initial dimensions

- time sensitivity;
- source freshness;
- missing context;
- existing MarkReg lifecycle recommendation relevance;
- Knowledge change relevance when exact evidence supports it;
- explicit user priority.

### Acceptance

Every attention item exposes a human-readable reason and exact supporting context. Unknown/stale/conflicting evidence cannot be silently converted into certainty.

## 6. WP05 — Contextual AI Guide runtime

### Goal

Provide grounded assistance over permission-safe Asset context without autonomous legal or execution authority.

### First actions

- explain this asset;
- summarize current work/status projections;
- identify missing information;
- show relevant source/rule material;
- compare selected Assets;
- prepare questions/checklists;
- prepare bounded Product or owner-action candidates;
- explain why a suggestion is shown.

### Required behavior

- compile context only from records the current Principal may access;
- attach exact evidence references to consequential suggestions;
- expose stale/conflict warnings;
- fail closed when required owner/source context is unavailable;
- never represent AI output as official truth, filed work, verified Capability or completed external action.

## 7. WP06 — Trademark Asset Workspace UI

### Goal

Ship the professional private portfolio surface in Lite.

### Initial composition

```text
PORTFOLIO
ATTENTION
ASSET DETAIL
RELATED WORK
PROVENANCE / FRESHNESS
AI GUIDE
```

### Required states

- desktop/mobile;
- loading/empty;
- permission denied;
- stale/partial/conflicting evidence;
- dependency unavailable;
- direct URL/reload;
- success and safe error recovery.

## 8. WP07 — Today / Content / Work integration and feedback

### Goal

Connect Asset context back into existing Product loops without creating automatic consequences.

### Allowed integrations

- save/dismiss Asset attention;
- explicitly add a relevant item to Today/product attention;
- explicitly start a bounded Content candidate from Asset + source context;
- prepare an existing owner-domain action candidate;
- navigate to related Matter/Lifecycle work;
- record Product interaction feedback.

### Authority rule

No integration may bypass explicit confirmation, owner-domain validation, professional review or protected-action gates.

## 9. WP08 — Reliability and independent audit

### Required evidence

- real authenticated Workspace Asset path;
- exact provenance and source freshness;
- Workspace isolation including direct identifier guessing;
- replay/idempotent mutation behavior;
- restart recovery;
- bounded concurrency;
- real desktop/mobile browser journey;
- no canonical route interception or fixture fallback;
- no cross-service SQL;
- no AI authority escalation;
- no false official-status/deadline/filing/Capability claims;
- M1-M9 regression coverage for permanent authority boundaries.

## 10. Parallel development rule

M10 does not freeze other modules.

### Knowledge

Continue official/global source supply and provenance quality. User-specific portfolio judgment remains outside Knowledge.

### Data Engine

Continue ingestion, normalization and matching independently. M10 consumption remains read-only and contract-bound.

### MarkReg / Execution / MGSN

Continue owner-domain reliability. Expose reusable projections/actions rather than moving owner truth into Lite.

### Capability Engine

Continue private capability learning under its existing evidence locks. M10 Asset behavior remains Product evidence unless a later explicit evidence contract says otherwise.

### Visual / MOKI

Continue independent visual-engine work. M10 does not add a new visual production dependency.

## 11. Merge and validation policy

For each WP:

1. inspect existing compatible contracts/runtime first;
2. implement the smallest owner-correct change;
3. add focused tests before depending on new state transitions;
4. run affected CI plus required real PostgreSQL/browser gates;
5. fix failures before merge;
6. merge only when bounded checks are green;
7. start the next WP from current main;
8. do not treat merge as deployment, GA or external-action authorization.

## 12. Milestone completion definition

M10 is complete only when a real authenticated professional can open a durable private trademark portfolio, inspect exact source/owner context, understand why an Asset needs attention, ask a contextual AI Guide for grounded assistance, and explicitly move a chosen next step into an existing governed Product/owner workflow without any fabricated official truth or autonomous execution.
