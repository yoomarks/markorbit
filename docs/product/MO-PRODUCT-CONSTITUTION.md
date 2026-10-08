# MarkOrbit Product Constitution

Status: CURRENT WORKING BASELINE
Effective date: 2026-10-08
Authority: Product Director + Design Director + Technical Director, subject to Product Owner revision
Scope: MarkOrbit platform, MO Control Center, Lite, Sites, markreg.com, shared owners and external integrations

## 1. Purpose

MarkOrbit is not a collection of independent feature modules. It is a governed product and intelligence operating platform for trademark businesses.

The platform must be able to assemble, expose and control different products from reusable capabilities, data, knowledge, AI, execution and external-service components while preserving exact Workspace isolation and owner truth.

The first commercial proof is MarkReg. MarkReg is the reference Workspace and first real operator of the platform, not a separate architecture.

## 2. Product surfaces

### MO Control Center

Internal platform control plane for MO administrators and operators.

It must make the platform observable, governable and recoverable without becoming a cross-service database editor.

Primary responsibilities:

- Workspace, staff, role and access administration;
- product profile, maturity, entitlement and rollout control;
- Data Engine and Knowledge source/plan/run visibility and governed commands;
- Brain and Capability inventory, versions, dependencies, runs, cost, quality and rollout;
- external integration/provider readiness, degradation and disablement;
- Execution, MGSN and Payment operational visibility;
- audit, incident, recovery and rollback evidence.

Permanent rule: One operator UI, distributed owner truth.

Every mutation is a typed owner command with authority, validation, result evidence and audit.

### Lite

The professional operating product for Workspace staff.

Lite is organized around user jobs and business objects, not internal platform modules.

Target first-level product vocabulary:

- 今日 / Today;
- 客户 / Customers;
- 商标 / Trademarks;
- 工作 / Work;
- 创作 / Create;
- 案件 / Matters;
- 消息 / Messages.

These are working labels. The UI/Experience Design Director validates the final Chinese and English names before navigation lock; changing a label must not silently change the underlying Product-owned meaning.

Today is a reminder/recommendation and quick-entry surface, not the only way into the product. Customers, Trademarks, Work, Create, Matters and Messages remain directly addressable and preserve deep-link/reload context.

Work is the actionable queue across business objects. Matters is the durable professional record for an accepted service or legal/professional work item. A task may point to a Matter, but the two surfaces must not become duplicate lists with indistinguishable ownership or lifecycle.

Quote, Filing and other functions are primarily actions/workbenches reached from the relevant object or task rather than mandatory top-level navigation. Trademarks includes a clearly separated trademark-for-sale inventory rather than hiding sale work inside a generic portfolio.

MarkReg staff use Lite. MarkReg may receive additional pilot entitlements such as Growth Operations.

### Sites

Workspace-owned customer-facing projections.

A Site is bound to exactly one Workspace. Site configuration does not own Customer, Quote, Order, Matter, Payment or Trademark truth.

Sites may vary by Product Profile:

- language;
- jurisdiction/business scope;
- channel;
- payment method;
- customer-facing Brain profile;
- enabled capabilities;
- mini-program or future App availability.

WS-1.0 includes a bounded WeChat Mini Program Basic profile for ordinary Workspaces. A reusable Workspace Web Basic profile and richer mini-program editions belong to later release decisions.

### markreg.com

The reference Site of the MarkReg Workspace and the initial direct-customer commercial product.

Initial focus is overseas direct customers and a narrow international-trademark service journey.

The interaction model is Conversation-first, structure-backed.

Conversation guides intent and clarification. Structured objects carry Customer, Intake, Quote, Order, Matter, Payment, Filing and Delivery truth.

### Cross-product language and interaction

All product surfaces are Chinese-first and fully bilingual. Simplified Chinese is the default authored interface; English must cover the same navigation, instructions, forms, states, errors, confirmations, receipts and accessibility labels. Switching language must not rewrite user input, names, trademarks, source text, object identifiers, money, evidence or workflow state.

Business initiation and guided work use one consistent conversation-plus-structured-workbench pattern. Conversation explains, asks bounded questions and orchestrates work. Structured cards, fields, summaries and owner-backed objects retain editable facts, uncertainty, prices, evidence, approvals and state. A chat message cannot authenticate a person, grant access, accept a Quote, authorize Payment, complete a trademark transfer, file, publish or perform another protected action.

## 3. User and identity model

### Platform staff

MO administrators/operators use platform identity and operator authority.

### Workspace staff

Staff identities are globally authenticated but receive business authority only through explicit Workspace Membership and role/permission.

A staff user may belong to more than one Workspace where policy permits.

### Workspace customers

CustomerAccount is primarily a personal login/security account. It may bind verified email, phone and, for supported China users, WeChat credentials. Authentication reuse does not create or merge business relationships.

Customer Relationships, Applicant links, trademark access and customer-visible business objects remain explicitly Site/Workspace scoped. A customer may manage its explicitly bound Applicants and Trademark Assets within the owning Workspace's granted actions; all changes remain permission-checked and audited. Applicant and trademark sharing with Workspace staff is an explicit, auditable relationship/permission action; it is not identity matching, applicant ownership proof or cross-Workspace data fusion.

A customer session is bound to the current Site and Workspace. It must not expose Workspace selection, cross-Workspace discovery, cross-Workspace search, or implicit relationship merging.

The same natural person or enterprise may have separate Customer Relationships in multiple Workspaces. Business data remains independent even if a lower-level identity/security service can detect that credentials or identity evidence refer to the same real-world subject.

### Core separation

Staff Identity != Customer Account.
Customer != Applicant.
Customer Relationship != global customer truth.
Workspace membership != customer relationship.

## 4. Workspace model

Workspace is the primary business isolation boundary.

MarkReg is a special reference Workspace by entitlement and maturity policy, not by forked code.

Workspace-owned/private concerns include:

- staff membership and role;
- customer relationships;
- contacts and business communications;
- private knowledge;
- pricing/operating preferences;
- managed trademark relationships;
- matters, work and files subject to exact owner boundaries;
- Site configuration;
- Workspace overlays for approved AI behavior.

WS-1.0 binds one organization name to one Workspace. The Workspace administrator manages Lite users, invitations, bounded permissions and enabled product functions. Institution or collection-account verification, when required, records exactly what evidence was verified; a small-payment round trip must not be presented as broader legal identity proof than its accepted policy supports.

No Workspace may read or mutate another Workspace's business truth by default.

## 5. Platform composition model

MO products are assembled from governed reusable layers.

### Platform Module

A major platform capability domain, such as Brain, Knowledge, Data Engine, Capability Engine, MGSN, Communication, Payment, Content, Video, Sites and Execution.

Module existence/health is not itself user entitlement.

### Capability

At the product layer, Capability is shorthand for the repository's canonical definition: Stable Outcome Contract + Governed Implementation + Evidence Base + Version Lineage + Controlled Evolution. The hierarchy remains Domain → Capability → Skill → Action / Invocation, and a composition has exactly one Primary, zero to three Supporting and zero or one Critic capability.

Examples of provider-neutral stable outcomes include:

- TRADEMARK_QUOTE;
- US_FILING_PREPARATION;
- CUSTOMER_EMAIL_DRAFT;
- CONTENT_IMAGE_GENERATION;
- VIDEO_GENERATION;
- TALKING_HEAD_VIDEO;
- DIGITAL_AVATAR_VIDEO;
- MGSN_HANDOFF;
- WECHAT_NOTIFICATION;
- PAYMENT_COLLECTION.

A Capability is provider-neutral.

### Implementation / Provider

A concrete implementation of a Capability, such as:

- OpenAI / Google / Anthropic / DeepSeek;
- Gmail / Microsoft Graph / SMTP;
- Stripe / PayPal / WeChat Pay / Alipay / manual transfer;
- HeyGen or another video/avatar provider.

Products depend on Capabilities, not directly on providers where avoidable.

Provider failure must degrade the bounded Capability, not collapse unrelated product functions.

For MGSN, a Provider price/quote is supply-side truth, not the customer Quote; Provider Supply Capability is not user Capability evidence; and a Provider Return is reviewable input/evidence, not Official Truth or automatic completion.

Ordinary Workspace users do not manage custom API keys in WS-1.0. MarkReg may bind approved email or external API credentials under its governed profile. Future products may support either approved bring-your-own-key use or paid use of MO-managed keys, but secrets remain provider bindings and never become front-end business truth.

### Knowledge/Data Pack

A governed package of information or structured data made available to a Brain/Product Profile, such as:

- CN trademark knowledge;
- US filing knowledge;
- EU/GB/WIPO packs;
- Nice Classification;
- global trademark data by jurisdiction;
- MarkReg internal SOP;
- Workspace private knowledge.

Access is always filtered by exact Workspace, channel and object authority.

Data Pack authorization may be narrower than a jurisdiction and is governed by jurisdiction, dataset family, version and permitted use. Distinct data families, such as refusal, opposition, review-decision and publication data, may carry separate availability and entitlement. Workspace users see only approved coverage and limitations, not an inferred whole-country entitlement; access for one use does not silently authorize Capability execution, opportunity discovery or marketing.

### Channel

A delivery surface or interaction route such as Web, H5, WeChat Mini Program, iOS/Android App, API and Email.

Channel policy can further narrow capabilities already available to a Workspace.

### Product Profile

A versioned composition defining what a product edition exposes.

Examples:

- Lite Free;
- Lite Go;
- Lite Plus;
- Sites Mini Program Basic;
- Lite Pro / Business and Sites Web Basic / Mini Program Plus in later releases;
- MarkReg Full.

A Product Profile references Modules/Capabilities/Packs/Channels and policy. It is not a copy of their underlying truth.

### Bundle

A reusable commercial/configuration package such as:

- China Trademark Pack;
- International Filing Pack;
- Creator Video Pack;
- Creator Avatar Pack;
- Mini Program Pack;
- MGSN Pack.

Bundles simplify configuration without creating duplicate runtime owners.

Bundles are not independent pricing subjects. They may be included and described inside a priced Product Profile or offer, while entitlement and runtime composition remain versioned and auditable.

## 6. Effective access model

Effective access must be the intersection of independent controls:

Platform Availability
AND Maturity / Release Level
AND Product Installation
AND Workspace Entitlement
AND User Role/Permission
AND Channel Policy
AND External Dependency Readiness

No single boolean may bypass the remaining controls.

## 7. Product maturity model

Every product capability or profile must declare maturity:

1. EXPERIMENTAL — engineering/internal exploration only;
2. INTERNAL — available to authorized MO internal use;
3. MARKREG_DOGFOOD — real MarkReg use;
4. PILOT — selected Workspace allowlist;
5. GA — generally available within its entitled product.

A capability being implemented or CI-green does not automatically advance maturity.

Promotion requires explicit evidence and decision. Rollback must be possible.

## 8. Brain / Capability / Knowledge / Data / Execution separation

Data Engine answers primarily: what structured facts are currently known?

Knowledge answers primarily: what information/evidence/rules do we know and why?

Capability answers primarily: what bounded outcome can the system produce?

Brain answers primarily: how should the system reason, select sources/capabilities and orchestrate work?

Execution answers primarily: what protected action is authorized to actually happen?

These responsibilities may compose but must not collapse.

Brain may also produce governed, versioned reference assets—facts, estimates and rulesets such as official-fee tables, expected process stages and indicative timing ranges—so product workflows do not repeatedly rediscover the same inputs. These are not timeless constants: they require source, version, jurisdiction, effective window, currentness and limitation evidence and remain distinct from Official Truth or a professional decision.

## 9. Workspace Intelligence Profile

A Workspace may be assigned one or more governed Intelligence Profiles.

A profile can define:

- Brain versions;
- allowed Capabilities;
- approved implementation profiles/providers;
- Knowledge/Data Packs;
- jurisdiction scope;
- channel scope;
- automation level;
- usage/budget limits;
- approval policy.

Platform definitions remain shared. A Workspace uses bindings and overlays rather than private forks.

Workspace overlays may express bounded business preferences such as pricing rules, review requirements, bilingual communication preference, private SOP references and approved templates.

A modified composition that falls outside an already validated combination becomes NEEDS_VALIDATION and cannot silently inherit production maturity.

## 10. First commercial operating principle

MO 1.0 exists to prove a real MarkReg commercial service loop before platform breadth.

The first proof is not "all platform modules exist". The first proof is:

MarkReg can convert a qualified overseas trademark inquiry into a professionally managed, quoted, documented, traceable and deliverable trademark matter without engineering intervention.

## 11. Release-speed principle

MarkOrbit deliberately runs three different speeds.

### Architecture Runway

The platform architecture may run materially ahead of the released product.

It may build stronger owner boundaries, composability, provider abstraction, Brain/Capability governance, Knowledge/Data infrastructure, MGSN, observability and recovery before those capabilities are exposed to ordinary Workspace users.

Architecture advancement is valuable only when it:

- preserves product simplicity;
- stays decoupled from release-critical user flows;
- does not force internal concepts into user navigation;
- does not block product iteration;
- has a clear future platform use, safety value or operating-cost benefit.

Architecture sophistication is not a reason to expose complexity to users.

### MarkReg Forward Track

MarkReg is the default Reference Workspace and first real user of reusable Workspace-facing capabilities.

Before a capability is promoted to ordinary Workspace users, MarkReg should normally:

- use it in real operations;
- produce measurable value or remove real friction;
- expose failure modes and manual escape paths;
- provide feedback for UX and policy correction;
- prove that the capability can be supported operationally.

MarkReg should intentionally operate ahead of the ordinary Workspace release train so MO retains a tested innovation reserve.

### Workspace Release Track

Ordinary Workspace users receive a deliberately narrower, simpler and more stable product.

The product should use progressive disclosure and staged rollout. Users see the capability appropriate to their job, plan, market and maturity level rather than the full power of the underlying platform.

The goal is not to make users learn MO architecture. The goal is to let users complete valuable trademark work faster than their current methods.

### Reference-workspace exception

The "MarkReg first" rule is a default proof rule, not a ritual.

If a capability is inherently not representative for MarkReg — for example a China-agency-specific workflow, a particular white-label channel or another market-specific operating model — Product Governance must designate an equivalent Reference Workspace or controlled pilot that can provide real-use evidence before wider release.

No feature may skip real-use proof merely because MarkReg is not the correct tester.

## 12. Product iteration and innovation reserve

MO should maintain a deliberate gap between what the architecture can support, what MarkReg is currently proving, and what ordinary Workspace users receive.

At the time a Workspace release is made broadly available or sold as a stable version:

- the released functions must already have real-use evidence;
- MarkReg should be operating at least one meaningful product horizon ahead;
- the next release wave should already contain tested or actively dogfooded improvements;
- public release must not consume the entire innovation backlog.

This reserve is not secrecy for its own sake. It exists to maintain iteration speed, absorb competitor copying, and ensure that customer-facing releases arrive as a continuous sequence of improvements rather than one large static launch.

Product simplicity remains mandatory even when the architecture and MarkReg Forward Track are significantly more advanced.

## 13. Permanent product principles

- Product flow before module completeness.
- User language before internal platform vocabulary.
- Chinese by default and complete English across every released surface.
- Conversation guides work; structured owner state carries business truth.
- Preview != Production.
- CI green != release readiness.
- AI draft != protected action.
- Payment != performance, authority, acceptance, Order, Matter, Filing, completion or Official Truth.
- Purchase Intent or Payment != completed trademark transaction or rights transfer.
- Source fact != legal conclusion.
- Customer != Applicant.
- Contact data != marketing consent.
- Site != Customer/Order/Matter owner.
- Capability != Provider.
- Brain != autonomous authority.
- Workspace isolation is mandatory.
- Owner truth must not be replaced by cross-service SQL or a super-admin shadow database.
- Optional providers/APIs must fail boundedly and be disableable.
- New horizontal platform work requires evidence that a current product journey needs it.

## 14. Governance references

The following documents are co-canonical:

- MO-VERSION-ROADMAP.md;
- MO-PRODUCT-GOVERNANCE.md;
- MO-PRODUCT-DECISION-LOG.md;
- MO-IDEA-REGISTER.md;
- MO-MVP-1.0-ACCEPTANCE.md.

Historical product documents remain evidence of prior decisions but do not override this Constitution after acceptance.
