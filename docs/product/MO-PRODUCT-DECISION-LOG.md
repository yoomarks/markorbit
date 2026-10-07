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
