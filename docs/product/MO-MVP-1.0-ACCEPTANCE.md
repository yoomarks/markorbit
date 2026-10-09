# MarkOrbit MVP 1.0 Acceptance

Status: ACTIVE RELEASE GATE
Effective date: 2026-10-09

## 1. Commercial promise

MO 1.0 passes only when the Shared 1.0 Core and both release profiles below pass:

1. MR-1.0 lets MarkReg operate the complete reference commercial loop on markreg.com and the MarkReg WeChat Mini Program; and
2. WS-1.0 lets an ordinary non-MarkReg Workspace run the released Lite and Mini Program Basic product for real daily trademark business without engineering intervention.

MarkReg must also be operating a meaningful forward Product Profile beyond WS-1.0. The ordinary Workspace release is a validated subset of daily operations, not an exposure of the full MarkReg Forward Track.

## 2. Release-train acceptance

WS-1.0 is not a MarkReg-only milestone.

Before WS-1.0 release:

- every ordinary Workspace-facing capability must have MARKREG_DOGFOOD evidence or an approved Reference Workspace exception;
- MarkReg must be running at least one meaningful forward capability wave beyond WS-1.0;
- 1–3 ordinary controlled Workspaces must be able to onboard and run the released flow without engineering-only setup;
- the ordinary Workspace UI must hide experimental/forward capabilities not included in its Product Profile;
- rollback, entitlement and kill-switch behavior must preserve separation between MarkReg forward capabilities and WS-1.0.

A nominal version label is not sufficient. The forward reserve must be visible in real dogfood use, for example an MR-1.5 or MR-2.0-candidate Product Profile while ordinary Workspaces receive WS-1.0.

## 3. Shared 1.0 Core

### Language and interaction

- Simplified Chinese is the default interface language and English is complete across the same released navigation, instructions, forms, validation, states, errors, confirmations, receipts, notifications and accessibility labels.
- Language switching preserves user input, personal and organization names, trademark/source text, object identifiers, money, evidence, filters, route and workflow state.
- Business initiation and guided work use a consistent conversation-plus-structured-workbench pattern. Conversation may explain, ask bounded questions and propose values; structured cards, fields, summaries and owner-backed objects expose editable facts, uncertainty, prices, evidence, approvals and current state.
- Conversation alone cannot authenticate a person, grant access, accept a Quote, authorize Payment, file, publish, complete a trademark transfer or perform another protected action. Each protected action has an explicit review/confirmation surface and a durable receipt.
- Released desktop, mobile Web and applicable Mini Program journeys define loading, empty, partial, stale, conflict, unauthorized, forbidden, recoverable error, blocking error, offline/retry where applicable and success states, plus task-specific states such as expired OTP, WeChat-binding conflict, Payment processing, reconciliation pending, ownership review, partial AI labelling and failed notification.
- Desktop may use list/detail or multi-pane workbenches; mobile Web and Mini Program use touch-safe progressive disclosure rather than a compressed desktop layout. All channels preserve the same object identity and state, and back navigation does not silently discard a draft.
- Shared primitives and the composed released journeys meet WCAG 2.2 AA, including keyboard operation, visible focus, semantic names, contrast, error association, status announcements, text/zoom resilience, non-color status communication and reduced-motion behavior.
- Every released state has deterministic fixtures and a Storybook story; visual review evidence covers representative desktop and mobile widths, applicable Mini Program devices, and Chinese and English expansion; each critical journey has Playwright coverage and no production fixture fallback. Real-channel acceptance remains separately required for WeChat identity, payment and notification behavior.

### Identity, Workspace and Product Profiles

- CustomerAccount is a personal login/security identity. Customer Relationship, Applicant access and trademark access remain explicit, auditable Site/Workspace relationships and are not merged merely because credentials match.
- One CustomerAccount can be granted access to multiple Applicants and may manage explicitly bound Applicant and Trademark Asset actions within the owning Workspace's relationship authority. Every change is permission-checked and audited. Applicant or trademark sharing with Workspace staff records actor, scope, time and revocation; it is not applicant-ownership proof and creates no cross-Workspace discovery or data fusion.
- Staff login, Membership, account recovery, contact verification and basic abuse protection are production-capable. Workspace isolation is proven across UI, API, search, export, logs and audit paths.
- Every released user type is covered by the approved 1.0 MFA policy. Contact verification, one-time-code login and MFA are presented as distinct concepts; if email or SMS OTP is selected as an MFA factor, it applies to every released user type. Approved factors, remembered-device, recovery and sensitive-action behavior are verified for staff and customers.
- China Lite users and customer users can bind, sign in with, recover and unbind WeChat without creating duplicate accounts or silently merging business relationships.
- WS-1.0 binds one organization name to one Workspace. Invitation is the default onboarding route, and the Workspace administrator can manage Lite users, bounded permissions and enabled functions.
- A Workspace owns its team asset library, private Knowledge and approved personalization/configuration; every surface preserves Workspace scope and effective permission.
- Where collection-account verification is required, the small-payment round trip records the exact account and evidence verified. It is not presented as broader legal-entity, beneficial-owner or applicant-ownership proof.
- Released Product Profiles are versioned and visible: Lite Free, Lite Go, Lite Plus, Sites Mini Program Basic and MarkReg Full. Their included functions, limits and prices require an approved commercial matrix. Bundles may be included in priced profiles but are not independently priced runtime owners.

### Commercial and legal-state truth

- Lead/Opportunity, Customer Relationship, Applicant, Trademark, Intake, Quote, Order, Matter, Payment, Filing, Delivery and Transfer are distinct durable objects with lineage where they compose.
- Quote confirmation, Purchase Intent, Inquiry, Offer, Order creation and Payment each have distinct states and receipts.
- Purchase Intent or successful Payment never displays or emits trademark ownership transfer, filing, professional acceptance, service completion or authority. A transfer completes only through its governed Matter, required documents, evidence and authorized completion decision.
- Versioned price source, currency, taxes/invoice treatment, serviceability, delivery route and Data coverage remain separately visible. A price existing for a country does not imply automated filing or Data Engine linkage.
- Every active Inquiry, Opportunity, Quote, Order and Matter has a durable source and owner, timeline, next action and SLA/due state where applicable. Material checklists, upload/reference paths, missing-item and waiting states, and the staff Work/Operations Queue allow normal progression without an engineering script.
- Filed, delivered, transferred and completed states require their accepted evidence; the result/receipt/package is delivered through the authorized relationship and closure/follow-up is recorded.

### Platform, governance and operations

- The MO Control Center has a versioned command inventory in which every command is classified as read-only, executable, approval-required or deferred. Every release-critical command is executable and verified; any deferred normal operator command requires an explicit Product Owner disposition and a documented safe operating path.
- Every Control Center command records actor, authority, reason, before/after state, result and failure receipt. System administrators may hold Support, Finance and Security duties in 1.0; separate role specialization is not a release gate.
- The Control Center exposes Product Profile, maturity and entitlement state; Data/Knowledge currentness and failures; Brain/Capability versions, dependencies and runs; integration health; execution failures/manual intervention and the audit trail. Significant configuration changes are reversible or safely degradable.
- Ordinary Workspace users can upload and manage private Knowledge, and can see the system Knowledge Pack version and usable Knowledge/data volume without seeing another Workspace's content.
- Data Engine links China, United States, Canada, United Kingdom, European Union, Australia, New Zealand and Singapore for the accepted 1.0 coverage. Trademark assets from any jurisdiction can be bulk-imported with a clear `not linked to Data Engine` state when linkage is unavailable.
- Data Pack entitlement is enforceable by jurisdiction, data family, version and permitted use, including independently controlled refusal, opposition, review-decision and publication data where available. UI and APIs show actual coverage and limitations rather than inferring whole-country access or silently reusing retrieval rights for Capability execution, opportunity discovery or marketing.
- Brain exposes governed, versioned reference assets needed by released flows, including official-fee facts, indicative process-stage rulesets and timing estimates. Each output identifies jurisdiction, source, effective window, version/currentness and limitations and is not presented as a timeless constant, Official Truth or professional advice.
- Ordinary Workspace users cannot add custom API keys in WS-1.0. MarkReg can bind approved email and external API credentials through governed secret storage, rotation, audit and disablement. Future BYOK and paid MO-managed-key modes are not implied by 1.0.
- Real-channel evidence proves released WeChat login/binding, payment and subscription-notification behavior; fixtures, Storybook and browser-only mocks do not satisfy those external channel gates.
- Production deployment, monitoring, alerting, backup/restore evidence, incident/support runbooks, export/deletion runbooks and rollback procedures are operational.

## 4. MR-1.0 acceptance

### Canonical MarkReg loop

Visitor / Lead
→ MarkReg CustomerAccount and Customer Relationship
→ structured Intake
→ human qualification and responsibility assignment
→ Recommendation
→ versioned Quote
→ explicit customer confirmation
→ materials / missing information
→ Order / Matter
→ MarkReg Operations Queue
→ MarkReg-operated governed delivery route
→ review / authorization / filing preparation or governed human handoff
→ progress + messages
→ result/evidence
→ customer delivery
→ follow-up/closure

The loop may contain human professional work. Automation is not an acceptance requirement unless explicitly stated.

MR-1.0 additionally requires:

- markreg.com Web and the MarkReg WeChat Mini Program are production-capable, with channel-specific entry and customer guidance but the same owner-backed business state;
- services begin in the common conversation-plus-structured-workbench rather than each service inventing an unrelated long form; service-specific schemas, validation, review and receipts remain structured and testable;
- foundational content generation and SEO publishing are available with draft/review/publish boundaries;
- a direct customer can manage multiple explicitly linked Applicants;
- Web checkout supports PayPal in CNY and USD where merchant and settlement eligibility is proven, with invoice availability and separately calculated tax/fees shown before confirmation; the Mini Program supports WeChat Pay. Stripe is not an MR-1.0 gate;
- the primary Web offer covers China and the accepted advantage-country services; unsupported combinations route to transparent human qualification rather than a false automated promise;
- MarkReg can send and receive external-counsel email, associate it with the correct Matter through reviewable automation and retain the original message/evidence. Marketing use remains subject to consent and contact policy;
- MarkReg email marketing is human-reviewed and retains contact source, applicable consent, suppression/unsubscribe and audit evidence. Growth-assisted candidate scoring, follow-up and higher automation are not MR-1.0 gates;
- customer progress, outbound messages, delivery evidence and closure are visible in the appropriate channel.

## 5. WS-1.0 acceptance

### Ordinary Workspace loop

Workspace invitation and setup
→ staff / customer / Applicant relationship
→ trademark import or creation
→ customer, trademark or Opportunity work
→ Quote / confirmation
→ self-filing or MarkReg delivery route
→ Matter / work progression
→ one-way progress notification
→ evidence / delivery / closure

The for-sale branch may start from a trademark listing and create an Inquiry, Offer or Purchase Intent, but it joins a separately governed commercial and transfer flow before any ownership change.

### Lite information architecture

- Lite exposes seven first-level destinations. The working labels are 今日 / Today, 客户 / Customers, 商标 / Trademarks, 工作 / Work, 创作 / Create, 案件 / Matters and 消息 / Messages; their final bilingual labels have UI/Experience Design Director approval without silently changing the underlying Product-owned meaning. Work is the actionable queue across business objects; Matters is the durable professional record, and the two must not be duplicate lists with indistinguishable lifecycle.
- Today is a reminder, recommendation and quick-entry surface, not the only route. The other six areas and durable business objects are directly addressable; deep links, browser back/forward and reload preserve authorized context.
- Opportunity remains a first-class business concept with a durable direct route, its own contacts and authorized links to Workspace assets, Data Engine trademarks, Lite customers and Site direct customers. It need not create an eighth persistent navigation item. Cross-Workspace Opportunity sharing and ownership economics are not WS-1.0 gates.

### Customers, trademarks and work

- Customer records use the Workspace short code plus a unique sequential/reference number, while retaining an immutable internal identifier.
- A Lite customer's CustomerAccount can be granted multiple Applicant relationships; staff co-management of an Applicant or trademark uses explicit scoped grants.
- Trademark assets support bulk import from any jurisdiction. The eight accepted Data-linked jurisdictions show linked status; every other jurisdiction remains usable with an explicit unlinked/limited state.
- Trademarks includes a separate 待售商标 / Trademarks for Sale area for inventory, listing readiness, inquiries, offers and transaction follow-up.
- A background preparation task performs evidence-bounded ownership-document screening and AI-assisted classification, category, audience and other listing labels. Users can see pending/ready/failed status, inspect and edit suggestions and retry failures; the task does not claim verified title without required evidence and human authority.
- The Create conversation/workbench can use accepted labels as disclosed context to draft a trademark meaning, slogan, story and basic image assets. Generated text/image output remains a draft until user review; digital-presenter and Remotion video generation are not WS-1.0 gates.

### Lite Creator 1.0

- Create is directly addressable and can also open from an authorized Customer, Trademark, Quote, Matter, Opportunity, trademark-for-sale or Knowledge context without forcing the user through Today.
- Every prepared result retains exact source owner, identifier, version, fingerprint and currentness where available. Conversation text does not become a fact source merely because the user or AI mentioned it.
- The target-GA WS-1.0 play set produces reviewable static outcomes for:
  - application/quote decisions, with exact Quote amount, currency, official/service fee separation, tax/invoice treatment, validity, assumptions, limits and material requirements;
  - trademark-for-sale commercialization, with exact source trademark image, jurisdiction, class, status, price/transaction method and listing-readiness evidence, plus Mini Program list/detail and Inquiry/Offer/Purchase Intent handoff;
  - rules/Knowledge outreach, with visible source, jurisdiction, version/as-of date, applicable scope and limitation in the prepared article, carousel, card, SEO page or related static result.
- Portfolio/deadline maintenance and OA/case-action explanation are accepted first as MarkReg dogfood, not as automatically mature ordinary-Workspace plays.
- Trademark images and high-risk identifiers, registration numbers, classes, prices and dates use deterministic source-backed layers. AI must not redraw the source trademark or generate those fields as uncontrolled image content.
- Machine checks and an explicit human review bind to the exact result version. Approval may prepare an owner-backed next object or PublishPackage, but it does not prove external publication, transaction completion or rights transfer.
- The Creator results library is a read projection over exact owner-backed references. It does not create a universal Artifact owner or advance Quote, Trading, Media or Distribution state.
- WS-1.0 China-platform delivery is limited to copy, download, export, open-platform handoff and explicit user confirmation. A user-reported link or use result remains labelled user-reported unless an owning integration independently reconciles it.
- Ordinary WS-1.0 does not require MP4, TTS, talking-head, digital-avatar or automatic external-publishing capability.

### Site Mini Program Basic and transactions

- An ordinary Workspace can configure and publish its Sites Mini Program Basic without engineering intervention.
- The Mini Program supports shareable for-sale trademark list and detail pages and direct customer entry into Buy, Inquiry and Offer actions.
- Accepted Mini Program checkout uses WeChat Pay under the Workspace's approved merchant/collection configuration and shows amount, currency, payee, tax/invoice treatment and reconciliation state before and after payment. An admitted service-order checkout can satisfy the WS-1.0 channel payment gate; collecting money for a trademark sale additionally requires the approved seller-authority, contracting, refund and transfer policy.
- The fixed-price Buy action creates a traceable Purchase Intent; Inquiry and Offer create traceable negotiation records. The Buy confirmation and receipt state the next step and never imply a completed sale or ownership transfer. Purchase Intent may convert to an Order only through a separate explicit policy/evidence gate. Any later Payment advances only its Payment and reconciliation state, and creating or advancing a transfer Matter is another explicit, evidence-gated transition.
- Listing, transaction and transfer states provide clear next action, responsible owner, evidence and recoverable failure paths. A public multi-Workspace marketplace, platform custody/escrow and automated title adjudication are not WS-1.0 gates.

### Pricing, fulfillment and communication

- A Workspace user can download the accepted price template and upload a completed price table through the conversation. Structured validation shows row-level errors, currency/tax treatment, version, activation status and rollback/audit history before prices become usable.
- Pricing configuration can cover application, change, assignment/transfer and renewal for every country. An executable Quote requires a valid Workspace price and viable delivery route; otherwise the UI shows qualification/unsupported state rather than implying serviceability or Data linkage.
- Ordinary WS-1.0 fulfillment offers only self-filing or delivery through MarkReg. Direct provider selection and a provider order/price back office belong to the MarkReg 1.5 gate.
- The system can send Workspace-user and direct-customer notifications through in-product messages and email; Lite can configure an approved sender/outbox for system-originated direct-customer messages. Mini Program users can receive approved WeChat notifications.
- Ordinary WS-1.0 communication is one-way: the recipient sees source object, delivery state and next action, but no non-functional reply affordance. SMS, WeCom and Lite-initiated free-form outbound messaging are not WS-1.0 gates. MarkReg's governed two-way external-counsel email is the explicit exception in MR-1.0.

## 6. Dogfood and external Workspace acceptance

Before WS-1.0 release:

MarkReg reference use:

- run at least 20–30 historical or highly realistic cases to expose operational gaps;
- process at least 10 consecutive real/production-grade cases through the complete reference loop;
- target 5–10 paid Matters where commercial/legal circumstances permit;
- operate continuously for 2–4 weeks without relying on engineers for ordinary case progression;
- record every escape to spreadsheet, personal email, manual script or undocumented note;
- actively dogfood the next meaningful capability wave beyond WS-1.0.

Ordinary Workspace validation:

- onboard 1–3 controlled non-MarkReg Workspaces;
- prove staff can learn the released product without knowledge of internal MO architecture;
- prove the Workspace can complete the intended daily workflow using only its entitled WS-1.0 profile;
- record onboarding time, support requests, workflow abandonment and manual-tool escapes;
- confirm no MarkReg-only or experimental capability leaks through navigation, API or entitlement.

A repeated escape is a product defect or deliberate documented non-goal.

## 7. Quality gates

Release is blocked by:

- an open P0/P1 defect affecting either accepted loop;
- cross-Workspace data leakage or implicit relationship merging;
- customer objects with no durable owner/reference;
- materially incomplete English parity or a language switch that corrupts user/business state;
- a required flow reachable only through Today, or a deep link/reload that loses authorized context;
- conversation content that hides or contradicts the structured owner state;
- quote amount/status without versioned source;
- formal state progression without required evidence;
- Payment or Purchase Intent conflated with confirmation, filing, service completion or trademark ownership transfer;
- a one-way channel presenting a reply control that cannot complete its promise;
- production path requiring fixture data or normal operations requiring direct database edits;
- unavailable critical functionality that cannot be disabled or safely degraded;
- missing required Storybook states, visual-review evidence, Playwright critical path, backup/restore evidence or incident procedure;
- a Creator result that conflicts with its exact owner facts, hides stale/currentness limits or allows uncontrolled AI image content to alter a source trademark or other high-risk field;
- a Creator projection that owns or advances Quote, Trading, Media or Distribution state;
- copy, export, browser handoff or user-reported use presented as independently verified publication.

## 8. Operational targets

Every active inquiry, Opportunity, transaction or Matter should have:

- responsible owner;
- current state;
- next action;
- SLA/due information where applicable;
- recent customer communication state;
- source/evidence for material professional state transitions.

Key 1.0 operating metrics:

- inquiry → qualification time;
- quote turnaround time;
- quote acceptance rate;
- missing-document aging;
- time to matter readiness;
- operator intervention count;
- notification delivery/failure rate;
- customer-response SLA where a response channel is supported;
- paid Matter count;
- delivery completion;
- for-sale listing → Inquiry/Offer/Purchase Intent conversion;
- direct owner-backed handoff/conversion from an exact Creator result to Quote Confirmation, Inquiry, Offer or a qualified Opportunity; cross-channel, campaign and multi-touch attribution remain LC-2.0 work;
- escape-to-manual-tool count.

## 9. Explicit non-gates

The following do not block 1.0 unless a later accepted decision changes this file:

- native App;
- Lite Pro or Business, Sites Web Basic or Mini Program Plus;
- Stripe;
- full public multi-Workspace marketplace, custody/escrow, KYC or settlement;
- automated official filing in every country or all-country Data Engine linkage;
- broad Lite general availability;
- unrestricted automatic marketing;
- advanced Brain authoring or a generic Capability Center;
- multi-provider parity or ordinary Workspace provider selection;
- MarkReg 1.5 provider order/price back office;
- ordinary Lite two-way messaging, SMS or WeCom;
- ordinary Workspace MP4, TTS, talking-head or digital-avatar production;
- multi-platform automatic publishing;
- a universal Artifact platform or lifecycle;
- LC-2.0 Campaign/attribution and LC-3.0 evidence-driven program planning;
- multi-organization binding in one Workspace;
- ordinary Workspace custom API keys;
- full Product Builder.

## 10. Release decision

A green CI suite or merged PR cannot mark 1.0 released.

Final release requires:

- acceptance evidence for the Shared 1.0 Core, MR-1.0 and WS-1.0 sections of this document;
- three-director review;
- Product Owner release decision;
- exact MR-1.0 and WS-1.0 Product Profile versions being released;
- exact MarkReg Forward Product Profile/version currently in dogfood;
- evidence that the MarkReg Forward Track remains ahead rather than collapsing to the same release horizon.
