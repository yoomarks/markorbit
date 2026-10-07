# MarkOrbit Version Roadmap

Status: CURRENT WORKING ROADMAP
Effective date: 2026-10-07

This roadmap is version-oriented rather than module-oriented. New ideas must be placed into a version, parked, or rejected. They do not become implementation work merely because they are technically attractive.

## Release trains

MarkOrbit uses three coordinated but non-identical release tracks.

### Architecture Runway

No customer-facing semantic version is required.

Purpose:
- keep architecture stronger than current product needs;
- advance owner truth, composability, observability, provider abstraction, Data/Knowledge/Brain/Capability governance and recovery;
- create future product capacity without forcing immediate exposure.

Architecture Runway work must not become an excuse to delay a validated user-facing release.

### MarkReg Forward Track

Naming convention: `MR-x.y`.

MarkReg is the default Reference Workspace and should run ahead of the external Workspace release.

At the time `WS-1.0` is released, MarkReg should normally be operating a meaningful forward profile such as `MR-1.5` or an `MR-2.0-candidate`, containing the next validated/dogfooded product wave.

The exact numeric label is less important than the invariant:

> MarkReg must maintain a real-use innovation reserve ahead of ordinary Workspaces.

### Workspace Release Track

Naming convention: `WS-x.y`.

This is the version ordinary Workspace users receive.

A Workspace release is narrower and more conservative than the MarkReg Forward Track. It contains only capabilities already proven through MarkReg or an explicitly designated equivalent Reference Workspace.

## WS-1.0 — First Ordinary Workspace Release

### Release promise

WS-1.0 is the first version that an ordinary external Workspace can use for real day-to-day trademark business.

Before WS-1.0 ships:
- MarkReg must already run the WS-1.0 capability set in real operations;
- MarkReg must have a forward capability reserve beyond WS-1.0;
- 1–3 controlled ordinary Workspaces should be able to onboard without engineering intervention;
- the released product must stay simpler than the underlying platform and MarkReg Forward Track.

The external Workspace promise is:

A professional trademark Workspace can onboard, manage customers and trademark work, prepare/send quotes, create/manage filing work, communicate with customers, track work/status and complete normal daily operations using the validated subset of MO capabilities.

MarkReg simultaneously remains the reference operator for the direct-customer commercial loop:

qualified overseas inquiry
→ Customer
→ Intake
→ Qualification
→ Quote
→ Confirmation
→ Materials
→ Order/Matter
→ Delivery Route
→ Communication
→ Evidence
→ Delivery.

### Required product surfaces

#### MO Control Center
Minimum production control for:
- MarkReg/reference Workspace and selected pilot Workspaces;
- staff roles and access;
- product profile/maturity/entitlement;
- kill switch and bounded rollout;
- Data/Knowledge currentness and failures;
- Brain/Capability version, dependency and run visibility;
- integration readiness and disablement;
- Execution/MGSN/Payment operational inspection;
- audit and recovery.

#### Lite / MarkReg Operations
Required:
- Today / operations queue;
- Customers;
- Trademarks where needed by the first service;
- Work;
- Messages;
- Quote and Filing workbenches;
- materials/missing-information handling;
- delivery/closure evidence.

MarkReg receives the forward/dogfood Product Profile.

WS-1.0 ordinary Workspace release should begin with a controlled external cohort rather than unrestricted scale. Broad GA is a later promotion decision, but WS-1.0 must already be usable by real non-MarkReg Workspaces.

#### markreg.com
Required:
- responsive Web;
- overseas direct-customer entry;
- conversation-first, structure-backed intake;
- Customer Account bound to MarkReg Site/Workspace;
- quote/confirmation;
- material submission/status;
- customer-facing matter progress;
- message/notification projection;
- final delivery package.

### Service scope

Start with one Hero Filing Package and optionally one supporting package after a Service Package Selection Audit.

Do not make all jurisdictions a 1.0 requirement.

### Fulfillment

Support governed internal routing:
- MarkReg self-operated/manual professional delivery;
- MGSN handoff when applicable.

External filing may remain human-operated if state, authority, evidence and receipt are durable.

### Payment

Production payment automation is optional for 1.0 if not ready.

Manual/off-platform payment is acceptable only through a governed Payment-owner evidence/reconciliation flow. No ad-hoc paid=true state.

### AI/platform composition required in 1.0

Must support:
- versioned Product Profiles;
- maturity levels;
- Workspace entitlement;
- basic Workspace Intelligence Profile bindings;
- Brain/Capability/Knowledge/Data dependency visibility;
- provider disablement/degradation;
- audit.

1.0 does not require a fully free-form graphical AI/product builder.

### WS-1.0 explicit non-goals

- broad Lite GA;
- trademark marketplace;
- full Trading Studio deep-build;
- WeChat Mini Program as a release gate;
- independent native Apps;
- all jurisdictions;
- automatic official filing;
- autonomous marketing at scale;
- generic Capability Center for ordinary Lite users;
- unrestricted custom Brain composition;
- multi-channel marketing matrix;
- new horizontal platform domains without an active 1.0 journey need.

## WS-2.0 — Validated Workspace Platform

WS-2.0 begins after WS-1.0 external use plus MarkReg forward-track evidence demonstrate stable reusable product/operations patterns.

Primary objectives:
- 2+ real China agency Workspaces using validated Lite workflows;
- production Customer/Quote/Filing/Messages reused beyond MarkReg;
- Workspace-configurable Product Profiles and approved overlays;
- Sites CN / Sites Global as supported profiles;
- optional WeChat Mini Program where validated demand exists;
- broader jurisdiction/service packs;
- Content production and Asset management promoted based on real use;
- MarkReg Growth Operations with prepare/approve and bounded policy automation;
- capability bundles such as International Filing Pack and Creator Pack;
- richer Workspace private Knowledge management;
- provider routing/fallback policies exposed safely to MO operators;
- usage-based limits/cost controls;
- customer-development flows proven with consent/governance.

Potential 2.0 candidates subject to validation:
- Lite video production;
- talking-head video;
- digital-avatar video;
- selected social publishing;
- basic trademark-for-sale listing and inquiry flow;
- second/third Site profile;
- deeper mini-program customer interaction.

## WS-3.0 — Composable Trademark Business Platform

3.0 is the platform-scale phase, not a commitment to implement every listed item.

Target capabilities:
- custom Product Profile composition with validation/admission;
- independent iOS/Android App profiles where commercially justified;
- multi-channel Site delivery;
- richer provider marketplace/routing;
- broader MGSN network automation;
- advanced Brain orchestration with governed self-improvement evidence;
- Capability composition and validated Workspace-specific methods;
- large-scale cross-jurisdiction data/knowledge packs;
- mature Growth automation with policy control;
- trading/marketplace capability if ownership/KYC/contracts/payment/transfer fulfillment are proven;
- advanced usage/billing models by Product/Pack/Capability/Channel;
- APIs for selected external partners;
- reusable industry packs derived from proven MarkReg/Lite operations.

## Parked until evidence

The following are not assigned to a version merely because they are possible:
- unrestricted autonomous filing;
- unrestricted autonomous legal decisions;
- generic wallet/escrow;
- unbounded cross-Workspace identity/data fusion;
- universal all-country launch;
- drag-and-drop arbitrary Brain/Capability combinations without admission;
- new provider-specific product forks.

A parked idea can be promoted only through the product governance process.
