# MarkOrbit Product Decision Log

Status: ACTIVE
Effective date: 2026-10-07

This file records durable product-level decisions. Detailed implementation decisions may live elsewhere but must not contradict these entries.

## D-001 — Rebaseline MVP around real operations

Decision: stop treating module completeness, Preview count and CI success as MVP completion.

1.0 is accepted only when MarkReg can run the first commercial service loop without engineering intervention.

Disposition: 1.0

## D-002 — MarkReg is the reference Workspace

Decision: MarkReg is not a forked system. MarkReg staff use Lite and receive additional maturity/entitlement access as the first dogfood Workspace.

Disposition: 1.0

## D-003 — Separate staff identity from customer account

Decision:
- staff identity uses global authentication + Workspace Membership;
- direct-customer accounts are Site/Workspace scoped;
- customers cannot use a Workspace switcher or discover relationships in another Workspace;
- business data never auto-merges across Workspaces.

Disposition: 1.0

## D-004 — MO Control Center is a control plane, not a super database

Decision: MO operators require broad visibility and governed controls, but all writes remain typed owner commands. No generic cross-service SQL, no universal JSON mutation proxy, no shadow truth store.

Disposition: 1.0

## D-005 — Product flow precedes internal module vocabulary

Decision: Lite and Sites expose customer/staff jobs and business objects. Knowledge Runs, Capability implementation details and Execution internals must not become ordinary-user navigation solely because they exist technically.

Disposition: 1.0

## D-006 — Conversation-first, structure-backed direct customer experience

Decision: markreg.com uses conversation as the primary interaction entry, but Customer, Intake, Quote, Order, Matter, Payment, Filing and Delivery remain structured owner-backed state.

Chat cannot directly authorize payment, filing, official status or protected action.

Disposition: 1.0

## D-007 — Platform capabilities are composable and provider-neutral

Decision: MO controls reusable Modules, Capabilities, Implementations/Providers, Knowledge/Data Packs, Channels and Product Profiles.

Product depends on stable Capability intent rather than hard-coded provider where practical.

Disposition: 1.0 foundation; 2.0/3.0 expansion

## D-008 — Product maturity is explicit

Decision: maturity is:
EXPERIMENTAL → INTERNAL → MARKREG_DOGFOOD → PILOT → GA.

Code completion does not equal product availability.

Disposition: 1.0

## D-009 — Product Profiles are versioned compositions

Decision: Lite/Sites/MarkReg editions are versioned Product Profiles assembled from capabilities/packs/channels/policies.

Examples include Lite Basic, Lite Creator, Sites CN and Sites Global. 1.0 uses controlled templates and bounded overrides rather than an unrestricted graphical product builder.

Disposition: 1.0 template support; 2.0+ greater flexibility

## D-010 — Knowledge/Data/Brain/Capability are governed platform inventory

Decision: these systems are not hidden engineering sandboxes. MO operators must see ownership, versions, dependencies, runs, failures, cost/currentness and rollout. Ordinary Lite/Site users consume their outcomes through product jobs.

Disposition: 1.0 minimum control; 2.0+ advanced authoring

## D-011 — 1.0 excludes broad horizontal expansion

Decision: broad Lite GA, trademark marketplace, mini-program release gate, independent Apps, all-jurisdiction support, autonomous marketing, unrestricted Capability Center and new provider-specific product forks do not block 1.0.

Disposition: 2.0/3.0/PARKED as defined by roadmap

## D-012 — Existing substrate is inventory, not automatic product scope

Decision: current Owner, Preview, Capability, Brain, Channel and Trading work is classified and reused where it helps the active product promise. Prior investment is not sufficient reason to keep a feature in 1.0.

Disposition: 1.0 governance

## D-013 — External providers must degrade boundedly

Decision: AI APIs, email, payment, video/avatar and other external providers must be switchable/replaceable where feasible. One provider outage must not create unrelated system-wide failure.

Disposition: 1.0 platform principle

## D-014 — Trading is not a 1.0 release gate

Decision: Trading substrate may remain in the repository, but a marketplace/full Trading Studio is deferred until the core commercial/fulfillment loop is stable.

Disposition: 2.0 candidate / 3.0 marketplace

## D-015 — Mini-program is demand-gated

Decision: responsive Web is the 1.0 customer-channel requirement. Mini-program enters a later version only when real customer/agency use demonstrates channel value.

Disposition: 2.0 candidate

## D-016 — MarkReg Growth automation begins human-governed

Decision: MarkReg may dogfood growth automation, but early maturity emphasizes research/preparation/approval rather than unrestricted auto-send.

Disposition: 2.0 primary; limited 1.0 internal experiments only if they do not block the core loop


## D-017 — Architecture may run ahead of product

Decision: MarkOrbit deliberately allows a stronger and broader Architecture Runway than the currently released user product. Architecture work may advance composability, governance, owner truth, resilience and future capacity without forcing those concepts into user-facing navigation.

Constraint: Architecture Runway work must remain decoupled from release-critical user journeys and must not delay a validated customer release without an explicit acceptance reason.

Disposition: permanent platform principle

## D-018 — MarkReg-first proof is the default release rule

Decision: Any reusable user-facing capability intended for ordinary Workspace release must normally be used first by the MarkReg Reference Workspace in real operations and demonstrate measurable value, operational supportability and failure behavior.

CI, Preview, Storybook and synthetic acceptance are insufficient for promotion to ordinary Workspace users.

Disposition: 1.0+ release governance

## D-019 — Reference Workspace exception is allowed when MarkReg is not representative

Decision: If a capability is inherently specific to another user segment, jurisdiction, white-label configuration or channel, Product Governance may designate an equivalent Reference Workspace/pilot instead of forcing an artificial MarkReg use case.

The substitute must provide equivalent real-use evidence before wider rollout.

Disposition: permanent governance rule

## D-020 — Separate Architecture, MarkReg and Workspace release trains

Decision: MarkOrbit operates three speeds:
- Architecture Runway — strongest/farthest-ahead internal capacity;
- MarkReg Forward Track — next user-facing capabilities proven in real operation;
- Workspace Release Track — narrower, simpler, stable capabilities released to ordinary Workspace users.

Disposition: permanent release model

## D-021 — Workspace 1.0 is an external-usable release, not a MarkReg-only milestone

Decision: 1.0 denotes the first version that ordinary non-MarkReg Workspaces can use for real daily business. It may launch as a controlled cohort rather than unrestricted GA, but it must be production-usable outside MarkReg.

At WS-1.0 release time, MarkReg should already be running a meaningful forward profile (for example MR-1.5 or MR-2.0-candidate scope) rather than consuming the same exact product horizon.

Disposition: 1.0

## D-022 — Maintain an innovation reserve ahead of public Workspace releases

Decision: Public/ordinary Workspace release must not consume the full validated roadmap. MarkReg should continue dogfooding the next meaningful product wave before or at the time the current Workspace version is released.

The purpose is faster iteration, real-world learning and defensibility against copying/competitive pressure, while keeping ordinary-user experience simpler and more stable.

Disposition: permanent product strategy

## D-023 — Product simplicity is a release requirement

Decision: A stronger platform does not justify a more complex product. Ordinary users receive progressively disclosed, job-oriented workflows. Internal Brain/Capability/Knowledge/Data/Execution complexity remains behind product abstractions unless a user role genuinely needs it.

Disposition: 1.0+


## D-024 — Forward-version reserve is not the moat by itself

Decision: Keeping MarkReg one meaningful release horizon ahead of ordinary Workspaces is a release and learning strategy, not the primary competitive moat.

Long-term defensibility must come from the compounding system around the product:
- real MarkReg operating evidence and workflow learning;
- higher-quality Data and Knowledge with currentness/provenance;
- validated Brain/Capability methods;
- Workspace-specific operating overlays and accumulated private context;
- MGSN/provider/channel relationships;
- faster measured iteration from dogfood to Workspace release;
- supportability, reliability and evidence that competitors cannot reproduce by copying UI.

Product Governance must not delay obviously valuable customer improvements solely to preserve an artificial version gap.

Disposition: permanent strategy rule


## D-025 — Product modules require Owner-approved specifications before implementation

Decision: Every material product module/change must be presented to the Product Owner as a detailed reviewable specification before runtime implementation begins.

The specification must cover user surface, objects, fields, states, actions, permissions, configuration, dependencies, failure/degradation, audit, metrics, acceptance and open decisions.

Approval may be module-level or subsection-level. Only approved/frozen scope may be converted into implementation work. Any later scope change requires a recorded Change Request and re-approval before affected development continues.

Disposition: permanent governance rule
