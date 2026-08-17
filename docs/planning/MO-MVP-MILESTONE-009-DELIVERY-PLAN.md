# MO MVP Milestone 9 — Delivery Plan

- **Milestone:** M9 — MO Lite Daily Workspace & Content Production
- **Status:** APPROVED_FOR_IMPLEMENTATION
- **Depends on:** completed Product Loop Closure and current M1-M8 platform/runtime boundaries
- **Primary outcome:** real Daily Workspace that turns trusted inputs into SEE -> CREATE -> MOVE behavior

## 1. Delivery strategy

M9 is delivered as eight bounded work packages. The milestone keeps Lite as the Product owner while using existing owner services and cross-repository contracts.

Implementation order:

```text
WP01 contracts / ownership
-> WP02 Knowledge -> Daily Signal
-> WP03 Personal Daily Orbit
-> WP04 Content Kit / Studio
-> WP05 Visual Bridge
-> WP06 Daily Workspace UI
-> WP07 Preference / Feedback
-> WP08 Reliability / Independent Audit
```

Where a dependency is already frozen, non-conflicting implementation may overlap. One task/branch/PR scope remains preferred so regressions and authority changes remain attributable.

## 2. WP01 — Daily Workspace contracts and scope boundary

### Goal

Freeze the smallest shared/Product vocabulary needed for M9 without creating a parallel content lifecycle.

### Required decisions

- exact mapping from Daily Signal/Orbit/Content Pick to existing Recommendation and Content preparation objects;
- Content Kit as projection/working object rather than publication authority;
- minimum Creator Preference vocabulary;
- Visual Brief and Visual Output Reference boundary;
- interaction/preference event vocabulary;
- AI authority and false automatic consequences;
- no new physical Brain service.

### Acceptance

- contract tests lock lifecycle separations;
- no automatic publish/contact/Order/Matter/Capability shortcuts;
- existing Product Loop contracts remain backward compatible unless explicitly versioned;
- ownership architecture document is updated.

## 3. WP02 — Knowledge to Daily Signal

### Goal

Make a real governed Knowledge item usable by Lite Today without fixture-only bridges.

### Scope

- reuse Core's persisted ReadyPackage content intake;
- create a bounded source projection for Lite rather than cross-service SQL;
- preserve source id/version/fingerprint/observed timestamp;
- derive or carry bounded metadata needed for product ranking:
  - jurisdiction;
  - institution/source family;
  - topic;
  - change type;
  - freshness;
  - time sensitivity;
  - key facts / source excerpt references where the owning contract supports them;
- fail closed on stale/mismatched source evidence.

### Non-goals

- user-specific ranking in Knowledge;
- automatic content writing in Knowledge;
- legal-truth certification merely because a source was captured.

## 4. WP03 — Personal Daily Orbit

### Goal

Turn valid Daily Signals into a real authenticated Workspace-specific Orbit.

### Initial dimensions

```text
importance
personal relevance
time sensitivity
content potential
```

### Product projection

The read model should support at least:

- Today's Orbit / important items;
- For You / related items;
- risks/opportunities when supported by evidence;
- Worth Revisiting;
- Content Picks.

Each ranked item must retain a human-readable reason and exact provenance.

### Initial personalization inputs

Use only bounded, available context. Prefer explicit Workspace/user preferences and already-owned work context over speculative inferred profiles.

## 5. WP04 — Content Kit and Content Studio

### Goal

Make the existing Lite Content lifecycle useful for real daily content creation.

### Product behavior

For a selected Content Pick, expose:

- Summary / key facts;
- Why It Matters;
- Why Publish;
- three to five angles where evidence supports them;
- target audience;
- suggested platform;
- native platform variants;
- draft revision/history;
- save/copy/export;
- Human Review -> PublishPackage path.

### First platform variants

- Moments / short social post;
- Xiaohongshu;
- WeChat Official Account outline;
- WeChat Official Account draft;
- 30-second video script;
- 60-second video script.

No automatic external publication.

## 6. WP05 — Visual Bridge

### Goal

Make visual production a first-class Content Kit output without importing visual-engine internals into MarkOrbit.

### MarkOrbit side

- freeze `VisualBrief`;
- create governed consumer request envelope;
- persist stable request/output references;
- link outputs to the relevant Content Kit / draft context;
- expose no provider/model/payment/QC overrides forbidden by the visual consumer contract.

### Visual repository side

- accept Lite's bounded consumer request;
- reuse certified assets first;
- reuse Mother/reusable bases where applicable;
- compose/adapt through governed recipes;
- generate only through an explicitly governed route on miss;
- return stable consumer-safe references and QC state.

### First output formats

- Xiaohongshu cover;
- WeChat Official Account cover/hero;
- Moments/social card;
- compatible video cover.

## 7. WP06 — Daily Workspace Product UI

### Goal

Replace the current engineering-oriented Today presentation with a product-oriented daily workspace while preserving all existing safety semantics.

### Primary composition

```text
GOOD MORNING / context
TODAY'S ORBIT
CONTENT PICKS
QUICK CREATE
WORTH REVISITING
TODAY ACTIONS
```

### Product mapping

- SEE = Orbit/relevance/provenance;
- CREATE = picks/content/visual;
- MOVE = Prepared Actions/MarkReg/workflow;
- feedback remains available without pretending MarkOrbit performed external work.

### Required states

- desktop/mobile;
- loading;
- empty;
- permission denied;
- partial/stale;
- dependency unavailable;
- success;
- direct URL/reload;
- offline/network failure behavior appropriate to existing UI patterns.

## 8. WP07 — Preference and Feedback Loop

### Goal

Record bounded Product behavior needed for better future Daily relevance.

### Minimum events

- shown;
- opened;
- ignored/dismissed;
- saved;
- content started;
- angle selected;
- platform variant generated;
- draft edited;
- visual requested/generated/selected;
- copied;
- exported;
- user reported published/used/not used.

### Authority rule

These events are Product preference/usage evidence. They are not automatically professional Capability evidence and cannot fabricate external verification.

## 9. WP08 — Reliability and independent audit

### Goal

Prove M9 as a real runtime, not a set of screenshots or fixture stories.

### Required evidence

- real Knowledge-derived source on the acceptance path;
- exact provenance preservation;
- Workspace isolation;
- stale source rejection;
- idempotent/replay-safe mutations;
- restart recovery;
- bounded concurrency behavior;
- real browser flow desktop + mobile;
- no route interception/fixture fallback for canonical acceptance;
- no false publication or Capability claims;
- regression coverage for existing Product Loop and M1-M8 authority boundaries.

## 10. Parallel module execution

M9 does not freeze the rest of the platform.

### markorbit-knowledge

Continue source-supply growth, official/global coverage, source quality, provenance and ReadyPackage production. Prefer changes that directly increase the quality/availability of M9 real inputs without moving user-specific judgment into Knowledge.

### MOKI-Illustration-Skill

Continue universal engine, IP Package separation, Certified Asset Library, Approved Pose, reusable composition/Mother base work and consumer-safe Lite contracts. Do not wait for WP05 to improve independent visual readiness.

### Capability Engine

Continue approved governed learning work. Keep its evidence admission strict. M9 Product preferences remain separate until a later explicit evidence contract exists.

### MarkReg / Execution / MGSN

Continue owner-domain reliability and professional workflow development. Surface reusable read/action projections through contracts rather than by moving owner truth into Lite.

### Data Engine

Continue data ingestion/normalization/data-quality work independently. Any M9 use must be through read-only integration contracts.

## 11. Merge and validation policy

The owner has granted M9 implementation and PR merge authority.

For each WP:

1. inspect existing compatible contracts/runtime before adding new abstractions;
2. implement on a bounded branch;
3. add tests before relying on new state transitions;
4. run affected CI/workflows;
5. fix regressions before merge;
6. merge when the bounded checks are green;
7. rebase/start the next WP from current main;
8. do not treat merge as deployment/GA/external-action authorization.

If an unrelated external credential/account is unavailable, record it as a deferred external gate and continue engineering where semantic dependencies permit.

## 12. Milestone completion definition

M9 is complete only when the end-to-end path from a governed real source to Daily Orbit to Content/Visual preparation to reviewed package and Product feedback is demonstrated in real runtime, and MOVE continues to use the governed Prepared Action owner-handoff line.
