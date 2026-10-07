# MarkOrbit Product Constitution

Status: CURRENT WORKING BASELINE
Effective date: 2026-10-07
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
- Today;
- Customers;
- Trademarks;
- Work;
- Create;
- Messages.

Quote, Filing, Trading and other functions are primarily actions/workbenches reached from the relevant object or task rather than mandatory top-level navigation.

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

### markreg.com

The reference Site of the MarkReg Workspace and the initial direct-customer commercial product.

Initial focus is overseas direct customers and a narrow international-trademark service journey.

The interaction model is Conversation-first, structure-backed.

Conversation guides intent and clarification. Structured objects carry Customer, Intake, Quote, Order, Matter, Payment, Filing and Delivery truth.

## 3. User and identity model

### Platform staff

MO administrators/operators use platform identity and operator authority.

### Workspace staff

Staff identities are globally authenticated but receive business authority only through explicit Workspace Membership and role/permission.

A staff user may belong to more than one Workspace where policy permits.

### Workspace customers

Customer accounts are Site/Workspace scoped business identities.

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

No Workspace may read or mutate another Workspace's business truth by default.

## 5. Platform composition model

MO products are assembled from governed reusable layers.

### Platform Module

A major platform capability domain, such as Brain, Knowledge, Data Engine, Capability Engine, MGSN, Communication, Payment, Content, Video, Sites and Execution.

Module existence/health is not itself user entitlement.

### Capability

A stable outcome that the system can perform, for example:
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

### Channel

A delivery surface or interaction route such as Web, H5, WeChat Mini Program, iOS/Android App, API and Email.

Channel policy can further narrow capabilities already available to a Workspace.

### Product Profile

A versioned composition defining what a product edition exposes.

Examples:
- Lite Basic;
- Lite Pro;
- Lite Creator;
- Sites CN;
- Sites Global;
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

## 11. Permanent product principles

- Product flow before module completeness.
- User language before internal platform vocabulary.
- Preview != Production.
- CI green != release readiness.
- AI draft != protected action.
- Payment != Order != Matter != Filing != Official Truth.
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

## 12. Governance references

The following documents are co-canonical:
- MO-VERSION-ROADMAP.md;
- MO-PRODUCT-GOVERNANCE.md;
- MO-PRODUCT-DECISION-LOG.md;
- MO-IDEA-REGISTER.md;
- MO-MVP-1.0-ACCEPTANCE.md.

Historical product documents remain evidence of prior decisions but do not override this Constitution after acceptance.
