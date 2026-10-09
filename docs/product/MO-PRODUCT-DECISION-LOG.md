# MarkOrbit Product Decision Log

Status: ACTIVE
Effective date: 2026-10-09

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

Status note (2026-10-08): partially superseded by D-028. CustomerAccount is a personal login/security identity. Site/Workspace scoping applies to the active customer session, Customer Relationship, Applicant/Trademark authority and business data; matching or reused credentials never expose, discover or merge relationships across Workspaces.

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

Status note (2026-10-08): partially superseded by D-027 for the named WS-1.0 and 2.0 Plan/Profile/channel composition. The versioned-composition principle remains active.

## D-010 — Knowledge/Data/Brain/Capability are governed platform inventory

Decision: these systems are not hidden engineering sandboxes. MO operators must see ownership, versions, dependencies, runs, failures, cost/currentness and rollout. Ordinary Lite/Site users consume their outcomes through product jobs.

Disposition: 1.0 minimum control; 2.0+ advanced authoring

## D-011 — 1.0 excludes broad horizontal expansion

Decision: broad Lite GA, trademark marketplace, mini-program release gate, independent Apps, all-jurisdiction support, autonomous marketing, unrestricted Capability Center and new provider-specific product forks do not block 1.0.

Disposition: 2.0/3.0/PARKED as defined by roadmap

Status note (2026-10-08): partially superseded by D-027, D-029 and D-031 for the bounded Mini Program, jurisdiction/data, quote and trademark-for-sale scope explicitly reassigned to WS-1.0. Broad GA, all-jurisdiction Data Engine coverage, full marketplace and unrestricted automation remain excluded.

## D-012 — Existing substrate is inventory, not automatic product scope

Decision: current Owner, Preview, Capability, Brain, Channel and Trading work is classified and reused where it helps the active product promise. Prior investment is not sufficient reason to keep a feature in 1.0.

Disposition: 1.0 governance

## D-013 — External providers must degrade boundedly

Decision: AI APIs, email, payment, video/avatar and other external providers must be switchable/replaceable where feasible. One provider outage must not create unrelated system-wide failure.

Disposition: 1.0 platform principle

## D-014 — Trading is not a 1.0 release gate

Decision: Trading substrate may remain in the repository, but a marketplace/full Trading Studio is deferred until the core commercial/fulfillment loop is stable.

Disposition: 2.0 candidate / 3.0 marketplace

Status note (2026-10-08): partially superseded by D-031. Bounded trademark-for-sale management and transaction handoff enter WS-1.0; a full marketplace and any ungoverned ownership/settlement claim remain later scope.

## D-015 — Mini-program is demand-gated

Decision: responsive Web is the 1.0 customer-channel requirement. Mini-program enters a later version only when real customer/agency use demonstrates channel value.

Disposition: 2.0 candidate

Status note (2026-10-08): superseded by D-027. Mini Program Basic is part of the WS-1.0 channel profile.

## D-016 — MarkReg Growth automation begins human-governed

Decision: MarkReg may dogfood growth automation, but early maturity emphasizes research/preparation/approval rather than unrestricted auto-send.

Disposition: 2.0 primary; limited 1.0 internal experiments only if they do not block the core loop

Status note (2026-10-08): partially superseded by D-030. Human-governed Growth remains the rule, but its first committed dogfood horizon is the MarkReg Forward Track / MR-1.5 rather than WS-2.0.

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

The decisions below record only the explicit directions and version assignments established through Product Owner feedback. They do not approve M01-M25 as complete modules. Any subsection not explicitly decided remains CHANGE_REQUESTED or IN_REVIEW under D-025.

## D-026 — Released products are Chinese-first bilingual and conversation-first, structure-backed

Decision:

- all released MarkOrbit user and operator surfaces support Chinese and English, with Chinese as the primary/default language and complete English functional coverage;
- a unified conversation/work surface is the primary interaction model for service workflows, while Today, object pages and other direct entries remain available;
- Customer, Applicant, Trademark, Opportunity, Quote, Order, Matter, Payment, Filing, Message and Delivery remain structured owner-backed state;
- conversation may prepare and explain an action but cannot by itself establish payment, authority, acceptance, filing, transfer, completion or Official Truth.

This extends D-006 beyond the markreg.com entry experience without weakening its authority boundary.

Disposition: Shared 1.0 product principle

## D-027 — WS-1.0 fixes the first Plan/Profile, channel and payment composition

Decision:

- WS-1.0 Lite launch Product Profiles are Free, Go and Plus;
- WS-1.0 Sites exposes Mini Program Basic, and the MarkReg reference experience operates Web and Mini Program as distinct governed channels;
- Bundles describe included capability/pack/channel composition but are not independently priced;
- MR-1.0 MarkReg Web payment uses PayPal with CNY and USD where eligible; MR-1.0 and WS-1.0 Mini Program payments use WeChat Pay; invoice/tax handling remains distinct from payment status;
- Stripe, Lite Pro/Business, Sites Web Basic and Mini Program Plus belong to the 2.0 horizon unless reassigned by a later decision.

This decision assigns product scope only. Provider, merchant, compliance and release-readiness gates remain mandatory.

Disposition: WS-1.0 composition; 2.0 expansion

## D-028 — Personal Customer Accounts, Applicants and Workspace authority remain distinct

Decision:

- staff authentication remains global, while business authority comes from explicit Workspace Membership;
- CustomerAccount is a personal login/security identity; its active session, Customer Relationships and Applicant/Trademark authority are strictly Site/Workspace scoped. A CustomerAccount may be explicitly linked to multiple Applicants without making Customer and Applicant the same object;
- Applicant and Trademark access may be shared with authorized Workspace staff through explicit, revocable authority rather than implicit relationship merging;
- Workspace administrators may manage Lite users, permissions and available functions only within the Workspace's effective Product Profile and Entitlements;
- Chinese Lite and Customer users require a governed WeChat binding/login path; any email/SMS OTP chosen as MFA applies to all released user types, while the exact factor and recovery policy remains subject to approved security specification;
- WS-1.0 binds one organization record/name to one Workspace and is invitation-led. Its verification status is separate: payment-account confirmation evidence must not silently replace organization-identity evidence required by policy.

Disposition: WS-1.0 identity and Workspace boundary

## D-029 — Data coverage, asset import and quote coverage are deliberately separate

Decision:

- initial Data Engine-linked trademark jurisdictions are China, United States, Canada, United Kingdom, European Union, Australia, New Zealand and Singapore;
- Workspace users may bulk import trademark assets from any jurisdiction; assets outside linked Data Engine coverage remain managed assets without implied Data Engine or Official Truth verification;
- WS-1.0 supports governed Workspace pricing for filing, change, assignment and renewal services in any country where a valid versioned price and viable delivery route are confirmed;
- Workspace pricing may be supplied through the approved template/conversation flow, but every Quote must retain its exact governed pricing lineage;
- the ability to quote a jurisdiction does not claim equivalent Data Engine coverage, automated legal analysis or provider availability.

Disposition: WS-1.0 bounded data and commercial coverage

## D-030 — WS-1.0 communication and fulfillment stay bounded while MarkReg advances on the Forward Track

Decision:

- WS-1.0 supports system-to-user/customer in-product messages and email, Workspace-configured sending identity where entitled, and Mini Program WeChat notifications; ordinary Lite does not promise general bidirectional communication in 1.0;
- MarkReg may send and receive foreign-counsel email, associate it with governed business records and operate consent-governed email marketing;
- ordinary WS-1.0 fulfillment offers self-filing or delivery through MarkReg, without direct provider selection;
- on the MarkReg Forward Track / MR-1.5, MarkReg may select an MGSN provider and providers receive a bounded order/quote-management workspace;
- MarkReg Growth begins in MR-1.5 as human-governed opportunity preparation, scoring, outreach review and follow-up, using shared platform capabilities rather than a MarkReg-only fork.

Disposition: WS-1.0 bounded communication/fulfillment; MR-1.5 / FORWARD expansion

## D-031 — WS-1.0 includes bounded trademark-for-sale workflows, not an unqualified marketplace claim

Decision:

- Lite and Sites expose a distinct trademark-for-sale area with governed asset review, AI-assisted classification/tagging and approved content/media preparation;
- Mini Program Basic supports list and single-asset presentation plus fixed-price purchase intent, inquiry and offer workflows;
- payment, seller declaration or an accepted offer alone does not prove ownership, representation authority, agreement, transfer or completion; those remain separate evidence-backed states with explicit review and handoff;
- MR-1.5 may add multiple presentation templates and trademark recommendation video after WS-1.0 evidence;
- a full marketplace, escrow-like settlement or automatic title-transfer claim remains outside this decision.

Disposition: WS-1.0 bounded Trading; MR-1.5 / FORWARD presentation expansion; full marketplace later

## D-032 — Knowledge, Data, Brain, Capabilities and credentials remain governed layers

Decision:

- WS-1.0 Workspace users may upload and manage private Knowledge and see the exact system Pack version and authorized data volume available to their product;
- Data Pack entitlement may be finer than jurisdiction, including distinct corpus/resource classes, versions and permitted uses; it may gate effective Capability availability and Opportunity discovery scope without rewriting Capability Canon, while exact commercial slices remain subject to three-director specification and data-rights review;
- Brain's first explicit reusable outputs include versioned, currentness-aware reference values such as official fees, expected timing and process guidance. Broader Brain output remains RESEARCH until a bounded consumer and evidence standard are approved;
- Capabilities integrate the stable outcomes required by approved product workflows; technical existence alone does not grant Product Profile exposure or maturity;
- ordinary Workspace users do not receive custom API-key configuration in WS-1.0. MarkReg may use governed custom email/provider credentials. A later offering may support either Workspace-provided credentials or paid MO-managed credentials, subject to usage, privacy, cost and routing policy.

Disposition: WS-1.0 governed consumption; MR-1.5 / FORWARD dogfood where assigned; later credential expansion

## D-033 — Admit bounded Lite Creator into WS-1.0

Decision:

- Create is one directly addressable, business-object-bound workbench for preparing governed trademark-industry outcomes;
- Lite Creator 1.0 enters WS-1.0 as a bounded static-outcome slice, not as a generic media studio;
- Artifact, Render, Edit and Publish are internal preparation stages rather than independent user modules or truth owners;
- Creator version assignment does not itself promote a play, Capability or implementation to a higher maturity level.

Disposition: WS-1.0 bounded product scope

## D-034 — Freeze the first Creator play set

Decision:

- the WS-1.0 target-GA Creator play set is limited to application/quote decision outcomes, trademark-for-sale commercialization outcomes and rules/knowledge outreach outcomes;
- portfolio/deadline maintenance and OA/case-action explanation require governed MarkReg dogfood before broader release;
- every play binds exact owner facts, source/currentness, target audience, CTA, cost policy and an owner-backed business outcome;
- output count, engagement and AI scoring alone do not validate a play.

`Target-GA` identifies the intended released play set. It does not claim that the play has already passed maturity promotion or release acceptance.

Disposition: WS-1.0 target-GA play set; MR-1.5 dogfood for the named later plays

## D-035 — Lite Creator 1.5 is a MarkReg maturity line

Decision:

- Lite Creator 1.5 maps to MR-1.5 MarkReg dogfood and is not an ordinary Workspace release promise;
- template video, talking-head editing, recommendation video, digital-avatar samples, batch production and local scene revision remain entitlement-, rights-, quality-, capacity-, cost- and evidence-gated;
- promotion into WS-2.0 requires an explicit maturity decision supported by real-use evidence;
- a video or voice Provider failure must not prevent export of the approved source, static result, captions or already prepared evidence.

Disposition: MR-1.5 / FORWARD; WS-2.0 candidate after evidence

## D-036 — Creator results remain an owner-backed projection

Decision:

- the Creator results library aggregates authorized exact owner, identifier, version and fingerprint references;
- ContentKit remains a bounded working projection over the existing Content lifecycle;
- Quote, Document Package, Trading Listing, Media Artifact, PublishReceipt and other domain owners retain their own truth and lifecycle;
- no universal Artifact table, service, owner or lifecycle is authorized.

Disposition: permanent owner boundary

## D-037 — Distribution is official-API-first and single-platform-first

Decision:

- governed distribution follows exact reviewed source, DistributionIntent, exact target/channel binding, human review/protected action, Execution, adapter, PublishReceipt and independent reconciliation;
- MO advances one official-API platform pilot at a time;
- WS-1.0 supports copy, download, export, open-platform handoff and explicit user confirmation without presenting those steps as verified publication;
- China-platform automation remains RESEARCH until an approved official path or separately governed policy and security path exists;
- browser cookies, browser form completion and user-reported use are not canonical publication evidence.

Disposition: WS-1.0 manual handoff; MR-1.5 official-API pilot; selected WS-2.0 promotion after evidence

## D-038 — Brain is governed method intelligence, not a second truth or action owner

Decision:

- Knowledge retains documentary sources and evidence; Data Engine retains structured facts, history and reproducible datasets; Brain researches, evaluates, compiles and governs reusable Methods; Brain-backed Capabilities execute admitted Methods, while other Capabilities retain their own Stable Outcome Contracts; consuming product owners retain case-specific interpretations and formal business state; Execution retains protected-action authority;
- within the bounded reference-output slice already admitted by D-032, stable references such as official fees are resolved by an admitted Brain Method and materialized/read through the existing Core/Capability reference path rather than a second Brain-owned source registry; broader catalog and job admission still require a later decision;
- Brain-backed ordinary work uses ACTIVE executable packages and current authorized inputs. New method research, evaluation, shadow/pilot and activation remain a separate governed slow path, and no result or feedback may auto-promote a Method to ACTIVE;
- a persisted case result pins method/package, source or dataset, object and input versions. Re-evaluation creates a new result and diff instead of rewriting history;
- a user-visible DecisionPath records evidence, condition states, applicable branches, missing/conflicting inputs, stop/review points and re-evaluation conditions. It is not hidden model chain-of-thought and grants no action authority;
- the attached Brain research archive and proposed B1.0–B3.0 line are selectively absorbed as research input. They do not approve a first job, jurisdiction/service scope, substantive OA family, professional-review responsibility, private-feedback license or runtime implementation.

Disposition: permanent architecture guardrails for ownership, method lifecycle, history pinning and DecisionPath; D-032 reference-output admission unchanged; M21 detailed roadmap remains CHANGE_REQUESTED / IN_REVIEW
