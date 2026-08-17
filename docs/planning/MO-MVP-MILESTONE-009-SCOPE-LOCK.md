# MO MVP Milestone 9 — MO Lite Daily Workspace & Content Production Scope Lock

- **Milestone:** M9
- **Status:** APPROVED_FOR_IMPLEMENTATION
- **Owner authorization:** explicit owner instruction on 2026-08-18 to proceed continuously, including PR merge authority
- **Baseline:** `51a2ce5a35ec0dd01e1a41e7d46b8b87bf632a4e`
- **Primary product:** MO Lite
- **Product mainline:** `SEE -> CREATE -> MOVE`
- **Architecture basis:** existing Product Loop Closure, current Core/Knowledge/Lite/MarkReg/Execution/Capability boundaries

## 1. Objective

M9 turns the already-governed Lite Product Loop into a daily product that professional-service users can actually begin work from every day.

The milestone does **not** rebuild Lite from zero. It deepens the existing runtime:

```text
Today
-> Recommendation
-> Prepared Action
-> explicit confirmation
-> owner handoff
-> outcome / feedback
```

into the user-facing product model:

```text
SEE
Daily Orbit / what matters now

CREATE
Content Picks / Content Kit / Content Studio / Visual

MOVE
Prepared Action / MarkReg / governed workflow / follow-up
```

The permanent product promise for this milestone is:

> Help the user know what matters, create what is worth expressing, and move the right work forward.

## 2. Existing implementation that M9 must reuse

M9 must preserve and extend, not replace:

- `TodayRecommendation`;
- `PreparedAction` and explicit confirmation;
- `ContentOpportunity`;
- `ContentDraft` and bounded versioning;
- `ContentReviewDecision`;
- `PublishPackage`;
- `ProductLoopUseFeedback`;
- `OpportunityCandidate` and explicit Qualification;
- MarkReg-owned Formal Trademark Service Opportunity;
- Core-owned User / Workspace / Membership / Principal / permission truth;
- Knowledge ReadyPackage provenance and Core intake integrity validation;
- Capability Engine's governed evidence boundary;
- current Gateway composition/authentication patterns.

No second content lifecycle, publication truth model, identity system, permission system, Opportunity system or universal Artifact platform may be introduced.

## 3. Product locks

### 3.1 Today remains the organizing surface

Daily Orbit, Content Picks, Content Studio and Actions are product sections inside the Today-led experience. They are not equal top-level architecture modules.

### 3.2 SEE / CREATE / MOVE is product language, not service topology

No `services/brain`, `services/daily-orbit`, `services/content-kit` or equivalent physical service may be created merely because the product uses those names.

### 3.3 Brain is a logical intelligence responsibility in M9

M9 may add ranking, explanation, relevance and content-potential logic at the smallest correct owner boundary. Reusable extraction is deferred until repeated cross-Product use proves it is justified.

### 3.4 Knowledge remains acquisition + provenance

Knowledge may discover, fetch, normalize, preserve and export source material with provenance. It must not become the owner of personalized recommendation, content angle selection or user-specific editorial judgment.

### 3.5 Lite owns Product recommendation and content-preparation state

Until repeated reuse proves otherwise, the following remain Lite Product responsibilities:

- Daily Candidate projection;
- Daily Orbit ranking/projection;
- Content Pick projection;
- Content Kit working state;
- platform-specific draft preparation;
- content preference / product feedback;
- Visual request linkage.

### 3.6 Content Kit is not a second lifecycle

`Content Kit` is a Product working projection that groups useful preparation around an existing Lite content line.

It may reference:

- source Recommendation / Content Opportunity;
- Why It Matters;
- Why Publish;
- angles;
- audience;
- platform variants;
- Visual Brief / Visual Output references.

It must not replace or duplicate `ContentDraft`, `ContentReviewDecision`, `PublishPackage` or publication feedback.

### 3.7 PublishPackage != Published

M9 does not silently turn prepared content into an external publication. Automatic social publication is out of scope.

### 3.8 Visual is a governed production dependency

MarkOrbit owns the Lite Product request and linkage. `MOKI-Illustration-Skill` / its universal engine owns visual production internals, governed assets, IP packages, recipes, provider routing and QC.

Lite must not expose provider/model/payment/QC override controls that violate the visual consumer contract.

### 3.9 Preference feedback != Capability verification

Click, save, ignore, draft, edit, visual selection, copy/export and user-reported publication are Product preference/usage evidence. They do not automatically become professional Capability evidence.

### 3.10 External deferred gates do not block unrelated engineering

A missing external credential or account may remain a clearly recorded external acceptance gate. Engineering may proceed when the missing gate is not semantically required for the next work package. No deferred gate may be misrepresented as verified readiness.

## 4. M9 canonical product journey

M9 must prove this real-runtime journey:

```text
Knowledge source / trusted work context
-> exact governed source reference
-> Daily Candidate
-> Daily Orbit ranking / explanation
-> Content Pick
-> existing Content Opportunity line
-> Content Kit
-> platform draft variant
-> Human Review where required
-> Visual Brief
-> governed Visual request / reuse-first output
-> prepared PublishPackage
-> user copy/export/manual use or reported publication
-> Product feedback
-> future Daily relevance can consume that feedback
```

A parallel MOVE branch must remain available:

```text
Today Recommendation
-> Prepared Action
-> explicit confirmation
-> correct Product / workflow handoff
-> returned outcome / feedback
```

## 5. M9 product objects to introduce or formalize

WP01 must freeze the minimum vocabulary for:

- `DailySignal` or equivalently named governed source-derived candidate input;
- `DailyOrbitItem` read/projection vocabulary;
- `ContentPick` read/projection vocabulary;
- `ContentKit` bounded Product working projection;
- `ContentAngle`;
- `PlatformVariant`;
- `CreatorPreference` minimum profile/preferences;
- `VisualBrief`;
- `VisualOutputReference`;
- Product interaction / preference events required by WP07.

Names may change during WP01 if repository semantics require it, but the lifecycle separations in this scope lock may not be weakened.

## 6. Daily Orbit minimum ranking dimensions

M9 begins with a small explainable ranking surface:

- importance;
- personal relevance;
- time sensitivity;
- content potential.

The first implementation must prefer explainability and provenance over opaque high-dimensional ranking.

The UI should be able to explain why an item is present without fabricating certainty.

## 7. Creator Preference minimum scope

M9 may introduce only the minimum preference/context needed to avoid obviously generic content generation, such as:

- professional role / organization type;
- primary jurisdictions;
- professional topics;
- target audience;
- preferred content channels;
- tone / brand-expression preferences where explicitly configured or learned from bounded Product feedback.

Do not build a universal CRM/profile warehouse in M9.

## 8. Content production minimum scope

M9 first-phase text output supports:

- WeChat Moments / short social post;
- Xiaohongshu;
- WeChat Official Account outline;
- WeChat Official Account draft;
- 30-second video script;
- 60-second video script.

Platform output must be native variants, not merely one generic article with labels changed.

## 9. Visual minimum scope

First-phase output targets:

- Xiaohongshu cover;
- WeChat Official Account hero/cover;
- share/social card suitable for Moments;
- video cover where the same bounded composition contract can support it.

The preferred route is reuse-first:

```text
Approved / Certified Asset
-> Mother / reusable base where available
-> composition / recipe variant
-> governed generation only when reuse is insufficient
-> QC
-> Visual Output
```

M9 does not require a Photoshop-style editor or unrestricted AI-image control surface.

## 10. Cross-module ownership matrix

| Responsibility | Owner in M9 |
|---|---|
| source discovery/fetch/provenance | markorbit-knowledge |
| trusted Knowledge intake/integrity | Core |
| Workspace/User/Principal/permissions | Core |
| Daily Orbit Product state/projection | Lite |
| Content Opportunity/Draft/Review/PublishPackage | Lite |
| personalization/ranking for Lite | Lite-owned logical intelligence in M9 |
| visual production internals/assets/recipes/QC | MOKI universal visual engine |
| trademark professional work / formal opportunity | MarkReg |
| protected action governance | Execution where applicable |
| provider/network truth | MGSN |
| professional Capability evidence/learning | Capability Engine |
| trademark bulk/public data | Data Engine, via read-only contract only |
| browser/API composition | Gateway |

## 11. Work packages

### M9-WP01 — Daily Workspace contracts and scope boundary

Freeze the minimum vocabulary, ownership, lifecycle mapping and authority rules. No parallel lifecycle.

### M9-WP02 — Knowledge to Daily Signal

Admit real Knowledge ReadyPackage content into an explainable source-derived Daily candidate path with exact provenance, jurisdiction/topic/change/freshness/time-sensitivity metadata and fail-closed source handling.

### M9-WP03 — Personal Daily Orbit

Implement explainable importance/relevance/time-sensitivity/content-potential ranking and a real Daily Orbit read model with Content Picks.

### M9-WP04 — Content Kit and Content Studio

Productize the existing content lifecycle with angles, Why It Matters, Why Publish, platform-native variants, revision/save/copy/export and Human Review integration.

### M9-WP05 — Visual Bridge

Connect Lite Content Kit -> Visual Brief -> governed visual consumer request -> Visual Output Reference. Reuse the universal visual engine; do not embed its internals into Lite.

### M9-WP06 — Daily Workspace Product UI

Transform the current governed Today console into the real SEE / CREATE / MOVE daily workspace while retaining existing provenance, confirmation and owner-handoff semantics.

### M9-WP07 — Preference and Feedback Loop

Persist bounded Product interaction/usage feedback and make it available for future relevance adjustment without fabricating Capability verification or external publication truth.

### M9-WP08 — Reliability and independent M9 audit

Prove real sources, Workspace isolation, provenance, restart/replay/idempotency/concurrency/stale handling, desktop/mobile paths, no fixture fallback, no false publication claims and cross-module authority conformance.

## 12. Parallel-track rule

M9 is the primary Product-development line, but dependent and independent modules continue in parallel.

### Knowledge track

Continue expanding representative global source supply, official offices, industry sources, provenance and ReadyPackage quality. Changes must remain acquisition/provenance focused.

### Visual track

Continue universal-engine extraction, certified assets, Approved Pose, reusable compositions, Mother/reusable bases and Lite consumer safety. Changes must remain compatible with the governed Lite consumer boundary.

### Capability track

Continue the approved capability-learning route independently. Product preference data does not enter governed Capability evidence without a separately approved evidence contract.

### MarkReg / Execution / MGSN track

Continue reliability and professional-work evolution. M9 may consume their existing owner projections/actions but must not duplicate them.

### Data Engine track

Continue independent ingestion, normalization and data quality work. MarkOrbit may consume only through explicit read-only integration contracts; no cross-repository database access.

## 13. Explicit non-goals

M9 does not implement:

- automatic posting to Xiaohongshu, WeChat, Douyin, LinkedIn or other social networks;
- a universal marketing automation engine;
- a Photoshop replacement;
- unrestricted provider/model image controls;
- full video production / digital humans / talking avatars;
- a universal Brain service;
- a universal Artifact service;
- a universal Opportunity service;
- a universal CRM/profile warehouse;
- a second identity or permission system;
- automatic customer outreach;
- automatic formal Opportunity promotion;
- automatic protected-action execution;
- automatic Capability verification;
- public/professional truth fabrication;
- production GA claim.

## 14. Completion gate

M9 may be recommended complete only when an authenticated Workspace can prove, with real runtime and durable evidence:

1. at least one real governed Knowledge-derived source enters Daily candidate processing;
2. Daily Orbit ranks/explains items with exact provenance;
3. a Content Pick enters the existing Lite content lifecycle;
4. Content Kit generates at least the approved first-phase platform variants;
5. Human Review and PublishPackage separation remain intact;
6. a Visual Brief can reach the governed visual consumer boundary and return a stable output reference or governed reuse result;
7. SEE / CREATE / MOVE is usable on desktop and mobile;
8. Product interaction feedback is durable and Workspace-isolated;
9. feedback does not fabricate external publication or Capability verification;
10. reliability/audit gates pass with no fixture-only acceptance path;
11. existing M1-M8 authority locks continue to hold;
12. deferred external gates remain accurately labelled rather than silently waived.

## 15. Authorization consequence

The owner's 2026-08-18 instruction authorizes continuous M9 engineering and PR merges when the bounded implementation and relevant validation are green.

This authorization does **not** authorize:

- production deployment or GA by implication;
- external publication/outreach;
- spending through paid providers without a governed approval boundary;
- weakening protected-action gates;
- fabricating external readiness where credentials/accounts are unavailable.
