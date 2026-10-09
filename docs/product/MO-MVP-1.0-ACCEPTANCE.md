# MarkOrbit MVP 1.0 Acceptance

Status: ACTIVE RELEASE GATE
Effective date: 2026-10-09

## 1. Commercial promise

MO 1.0 passes only when the Shared 1.0 Core and both release profiles below pass:

1. MR-1.0 lets MarkReg operate the complete reference commercial loop on markreg.com and the MarkReg WeChat Mini Program; and
2. WS-1.0 lets an ordinary non-MarkReg Workspace run the released Lite and Mini Program Basic product for real daily trademark business without engineering intervention.

MarkReg must also be operating a meaningful MarkReg Ultimate Product Profile version with an active Forward configuration beyond WS-1.0. The ordinary Workspace release is a validated subset of daily operations, not an exposure of the full MarkReg Forward Track.

## 2. Release-train acceptance

WS-1.0 is not a MarkReg-only milestone.

Before WS-1.0 release:

- every ordinary Workspace-facing capability must have MARKREG_DOGFOOD evidence or an approved Reference Workspace exception;
- MarkReg must be running at least one meaningful forward capability wave beyond WS-1.0;
- 1–3 ordinary controlled Workspaces must be able to onboard and run the released flow without engineering-only setup;
- the ordinary Workspace UI must hide experimental/forward capabilities not included in its Product Profile;
- rollback, entitlement and kill-switch behavior must preserve separation between MarkReg forward capabilities and WS-1.0.

A nominal version label is not sufficient. The forward reserve must be visible in real dogfood use, for example an MR-1.5 or MR-2.0-candidate MarkReg Ultimate version with active Forward Entitlements while ordinary Workspaces receive WS-1.0.

## 3. Shared 1.0 Core

### Language and interaction

- Simplified Chinese is the default interface language and English is complete across the same released navigation, instructions, forms, validation, states, errors, confirmations, receipts, notifications and accessibility labels.
- Language switching preserves user input, personal and organization names, trademark/source text, object identifiers, money, evidence, filters, route and workflow state.
- Released journeys use the task-appropriate entry surface: Conversation Work Mode, object page, list, search, structured form or wizard, card or direct action. Where conversation is useful it shares the same structured workbench; it is not mandatory or the only entry. Structured cards, fields, summaries and owner-backed objects expose editable facts, uncertainty, prices, evidence, approvals and current state.
- Conversation alone cannot authenticate a person, grant access, accept a Quote, authorize Payment, file, publish, complete a trademark transfer or perform another protected action. Each protected action has an explicit review/confirmation surface and a durable receipt.
- Every started in-scope Lite or Site business conversation has one durable Conversation Work Session identity. Its structured checkpoint records workflow and object references, answered fields, missing items, attachment references, draft version and external-action state. Resume from Today, Work, the owning object or the session list preserves identity and uses concurrency and idempotency controls; it cannot duplicate Work, Order, Payment, charge or external action. Only explicitly defined cancellation, expiry or anonymous-security states may prevent resume. Session state is not Message, Customer Communication or formal owner truth. An anonymous draft must be securely claimed by an authenticated account before sensitive access or owner commands.
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
- WS-1.0 binds one legal-organization record/name to one Workspace. Invitation is the default onboarding route, the Workspace administrator can manage Lite users, bounded permissions and enabled functions, and ordinary onboarding does not require paid third-party organization certification.
- A Workspace owns its team asset library, private Knowledge and approved personalization/configuration; every surface preserves Workspace scope and effective permission.
- Account security, organization identity, collection-account control, channel-subject control, merchant control and any future deposit are displayed as separate claims with separate evidence. Enabling a Workspace Mini Program requires its current authoritative WeChat-certified legal-subject identifier to exactly match the Workspace organization regardless of any other verification path; that exact-match evidence may also satisfy organization verification. Name-only or screenshot matching does not. Electronic-business-license integration and a transaction deposit are not WS-1.0 gates, and a deposit is never identity evidence.
- Released Product Profiles are versioned and visible. Free, Go, Plus, Pro and Business are the locked public Lite names; WS-1.0 exposes Free, Go and Plus, while Pro and Business belong to WS-2.0. MarkReg Ultimate is the non-public MarkReg-only profile, and Forward is a maturity/release track expressed through versions and Entitlements. Sites Mini Program Basic is the ordinary WS-1.0 Site profile. Included functions, limits and prices require an approved commercial matrix. Bundles may be included in priced profiles but are not independently priced runtime owners.

### Commercial and legal-state truth

- Lead/Opportunity, Customer Relationship, Applicant, Trademark, Intake, Quote, Order, Matter, Payment, Filing, Delivery and Transfer are distinct durable objects with lineage where they compose.
- Opportunity references Contact and Organization records in the shared Workspace Contact Library through explicit relationship, role, provenance, allowed-use and consent state. Closing an Opportunity does not delete Contact/Organization truth, and an Opportunity cannot own a competing contact copy.
- Quote confirmation, Purchase Intent, Inquiry, Offer, Order creation and Payment each have distinct states and receipts.
- Purchase Intent or successful Payment never displays or emits trademark ownership transfer, filing, professional acceptance, service completion or authority. A transfer completes only through its governed Matter, required documents, evidence and authorized completion decision.
- The exact admitted MGSN Supply Offer, versioned official-fee reference, MarkReg Price Book, Workspace Price Book and immutable Customer Quote snapshot lineage is inspectable where applicable. Upstream changes produce stale/diff/new-draft behavior and never rewrite an issued Quote. Currency, taxes/invoice treatment, serviceability, delivery route and Data coverage remain separately visible. A price existing for a country does not imply automated filing or Data Engine linkage.
- Invoice Request and the applied versioned Tax Rule are distinct from Payment. A 1.0 manual fulfilment path may record request, responsible entity, status and evidence without presenting automatic invoice issuance or tax compliance as complete.
- Every active Inquiry, Opportunity, Quote, Order and Matter has a durable source and owner, timeline, next action and SLA/due state where applicable. Material checklists, upload/reference paths, missing-item and waiting states, and the staff Work/Operations Queue allow normal progression without an engineering script.
- Filed, delivered, transferred and completed states require their accepted evidence; the result/receipt/package is delivered through the authorized relationship and closure/follow-up is recorded.

### Platform, governance and operations

- The MO Control Center has a versioned command inventory in which every command is classified as read-only, executable, approval-required or deferred. Every release-critical command is executable and verified; any deferred normal operator command requires an explicit Product Owner disposition and a documented safe operating path.
- Every Control Center command records actor, authority, reason, before/after state, result and failure receipt. System administrators may hold Support, Finance and Security duties in 1.0; separate role specialization is not a release gate.
- The Control Center exposes Product Profile, maturity and entitlement state; Data/Knowledge currentness and failures; Brain/Capability versions, dependencies and runs; integration health; execution failures/manual intervention and the audit trail. Significant configuration changes are reversible or safely degradable.
- Ordinary Workspace users can upload and manage private Knowledge, and can see the system Knowledge Pack version and usable Knowledge/data volume without seeing another Workspace's content.
- Data Engine links China, United States, Canada, United Kingdom, European Union, Australia, New Zealand and Singapore for the accepted 1.0 coverage. Trademark assets from any jurisdiction can be bulk-imported with a clear `not linked to Data Engine` state when linkage is unavailable.
- Data Pack entitlement is enforceable by jurisdiction, data family, version and permitted use, including independently controlled refusal, opposition, review-decision and publication data where available. UI and APIs show actual coverage and limitations rather than inferring whole-country access or silently reusing retrieval rights for Capability execution, opportunity discovery or marketing.
- The bounded D-032 reference-output slice remains the only Brain-backed ordinary WS-1.0 obligation: released consumers receive governed, versioned official-fee facts, indicative process-stage rulesets and timing estimates through an admitted Brain Method and the existing Core/Capability reference materialization path. Each output identifies jurisdiction, source, effective window, method/package version, currentness and limitations and is not presented as a Brain-owned source fact, timeless constant, Official Truth or professional advice.
- D-042 separately approves the first B1.0 product direction for MarkReg Ultimate: **申请资料核对 / Application Materials Review** for the bounded US direct-application scope. Before any production run, BRN-A0 and D-025 must prove the real owner/currentness/Method/Capability/handler-review/receipt path. Every used value retains exact source/version/fingerprint; missing, unknown, conflicting, unverified, stale, not-applicable and review-required states remain explicit; source or Method change creates a new version and diff. Approved negative fixtures must produce zero false-ready outcomes and zero fabricated facts. The result may be prepared for handler review but cannot provide legal advice, become `APPROVED_FOR_FILING`, mutate Matter/Professional Review state, send questions, authorize filing or submit an application. This is not an ordinary WS-1.0 gate.
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
- supported services may begin from Conversation, a structured service route, an object page, search, a card or a direct action according to the task. Conversation-assisted journeys reuse the common structured workbench rather than inventing unrelated chat-only state; service-specific schemas, validation, review and receipts remain structured and testable;
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

- Lite exposes seven baseline first-level destinations. The working labels are 今日 / Today, 客户 / Customers, 商标 / Trademarks, 工作 / Work, 创作 / Create, 案件 / Matters and 消息 / Messages; their final bilingual labels have UI/Experience Design Director approval without silently changing the underlying Product-owned meaning. Work is the actionable queue across business objects; Matters is the durable professional record, and the two must not be duplicate lists with indistinguishable lifecycle.
- Today is a reminder, recommendation and quick-entry surface, not the only route. The other six areas and durable business objects are directly addressable; deep links, browser back/forward and reload preserve authorized context.
- Opportunity is a conditional first-level destination for Lite Plus and MarkReg Ultimate when Forward Entitlement is enabled; Pro and Business inherit it unless their approved matrix excludes it. Free and Go retain contextual and deep-link access to authorized records. Opportunity links to the shared Workspace Contact Library and does not own separate Contact/Organization candidates. Cross-Workspace Opportunity sharing and ownership economics are not WS-1.0 gates.

### Customers, trademarks and work

- Customer records use the Workspace short code plus a unique sequential/reference number, while retaining an immutable internal identifier.
- A Lite customer's CustomerAccount can be granted multiple Applicant relationships; staff co-management of an Applicant or trademark uses explicit scoped grants.
- Trademark assets support bulk import from any jurisdiction. The eight accepted Data-linked jurisdictions show linked status; every other jurisdiction remains usable with an explicit unlinked/limited state.
- Every admitted asset detail shows a concise two-layer Trademark Lifecycle Rail: a default phase view and an expandable jurisdiction/procedure milestone view. Asset lists show a compact textual current-stage and next-item/risk cue; neither surface implies percentage completion.
- Registration is not treated as the endpoint where the admitted Rule Pack contains maintenance, declaration or renewal obligations.
- Source-recorded facts, professionally reviewed deadlines, admitted rule windows, estimates and typical ranges are visually, textually and semantically distinct. The current phase, the “today” time cursor and an Action Required milestone remain separate and do not rely on color alone.
- Milestone details expose the exact source/evidence locator, as-of and recent-sync information, Rule Pack/version/effective window, applicability, currentness, missing inputs, conflicts and limitations. Predictions also expose their method/as-of basis and never use official/deadline language.
- US, EUIPO, Singapore, the Philippines and China are independently accepted for their declared WS-1.0 Rule Pack scopes. An unadmitted procedure or missing source degrades visibly to limited, manual, not covered or unavailable; the Philippines must not be presented as Data-linked without a later D-029 change.
- A negative fact or zero count is shown only when the admitted source read is complete for the stated scope and displays source, as-of and currentness. `NOT_OBSERVED`, `NOT_COVERED`, `PARTIAL` and `UNAVAILABLE` are not rendered as zero or “no event”.
- Selecting an Action Milestone opens evidence or deep-links into the correct authorized workbench while preserving asset and milestone context. It does not by itself create a Work/Matter, authorize a filing, execute an external action or certify completion.
- Desktop supports the concise horizontal/two-layer view; 390px and Mini Program use an accessible collapsible or vertical representation. Chinese-primary and complete English labels, semantic list structure, keyboard/focus behavior, screen-reader names, 200% text/zoom resilience and non-color status cues pass acceptance.
- The rail renders deterministically from a versioned semantic projection and remains usable in an admitted no-prediction degradation mode; opening an asset page does not require a live LLM call.
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

D-041 freezes MO-managed runtime plus controlled publishing as the only supported dynamic WS-1.0 Sites mode. The Workspace retains its channel account, certified subject, AppID, merchant account and domain. Static exports and a signed thin-client build handoff may be supported, but no full dynamic self-hosted package or customer-operated server is offered in WS-1.0.

- An ordinary Workspace can configure and publish its Sites Mini Program Basic without engineering intervention.
- The Mini Program supports shareable for-sale trademark list and detail pages and direct customer entry into **提交购买意向 / Submit Purchase Intent**, Inquiry and Offer actions.
- A Listing cannot be made public until the exact Trademark Asset, Commerce Profile, seller-authority evidence assessment, public assets, price/method and review version are current. A source change, authority revocation or conflict fails closed and requires re-review.
- The public detail distinguishes canonical trademark facts, seller declarations, reviewed authority evidence, actual included assets, AI commercial inference and AI concept visualizations. `REAL ASSET` and `POSSIBLE FUTURE` remain understandable without relying on colour alone; no unverified market-value, ownership or business-performance claim is shown.
- Internal Listing admission and external channel delivery are separate. Each target records submitted, succeeded, failed, unknown, paused or revoked behavior with a durable receipt/reconciliation path; `UNKNOWN` never renders as published and does not trigger an uncontrolled duplicate submission.
- Accepted Mini Program checkout uses WeChat Pay under the Workspace's approved merchant/collection configuration and shows amount, currency, payee, tax/invoice treatment and reconciliation state before and after payment. An admitted service-order checkout can satisfy the WS-1.0 channel payment gate; collecting money for a trademark sale additionally requires the approved seller-authority, contracting, refund and transfer policy.
- The fixed-price **提交购买意向 / Submit Purchase Intent** action creates a traceable Purchase Intent; Inquiry and Offer create distinct durable records. Each binds the exact Listing version, Workspace, actor/contact context and idempotency key and supports its applicable acknowledgement, assignment, withdrawal, rejection, counter, expiry and closure states without using BuyerBehavior as the business owner.
- The Purchase Intent confirmation and receipt state the next step and never imply a completed sale or ownership transfer. Accepted Offer means accepted commercial terms only. Purchase Intent or accepted terms may convert to an Order only through a separate explicit policy/evidence gate. Any later Payment advances only its Payment and reconciliation state, and creating or advancing a transfer Matter is another explicit, evidence-gated transition.
- An Inquiry, Offer or Purchase Intent does not automatically create an Opportunity. Only after explicit staff or admitted-rule qualification may an authorized operator link it to an existing Formal Opportunity or create one, and that Opportunity references the shared Contact/Organization records instead of copying them.
- A suspended or withdrawn Listing rejects new intents while retaining historical intent, receipt and audit records. A price change creates a new Listing version and never rewrites the amount or conditions captured by an existing Offer or Purchase Intent.
- Listing, transaction and transfer states provide clear next action, responsible owner, evidence and recoverable failure paths. A public multi-Workspace marketplace, platform custody/escrow and automated title adjudication are not WS-1.0 gates.

### Pricing, fulfillment and communication

- A WS-1.0 Workspace starts from the published MarkReg Price Book, can download the accepted price template and upload a completed price table through Conversation or a direct structured route. Structured validation shows row-level errors, currency/tax treatment, version, activation status and rollback/audit history before prices become usable.
- The exact reviewed MGSN Supply Offer, official-fee reference, MarkReg Price Book, Workspace Price Book and immutable Quote snapshot lineage is retained. An upstream change marks affected drafts stale, shows a diff and creates a new version; it never mutates an issued Quote. A Provider supply price cannot become effective without authorized MarkReg/MO review and publication.
- Pricing configuration can cover application, change, assignment/transfer and renewal for every country. An executable Quote requires a valid Workspace price and viable delivery route; otherwise the UI shows qualification/unsupported state rather than implying serviceability or Data linkage.
- Ordinary WS-1.0 fulfillment offers only self-filing or delivery through MarkReg. Direct provider selection and a provider order/price back office belong to the MarkReg 1.5 gate.
- Invoice Request and versioned Tax Rule handling are available for an admitted 1.0 transaction. Payment, invoice-request, invoice-fulfilment and tax-rule states remain separate; manual fulfilment records status, responsible entity and evidence.
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
- for the Trading slice, prove one real, non-fixture Workspace asset can move through current seller-authority/readiness review, exact-version Listing, actual Mini Program delivery, an external buyer session and a durable Purchase Intent into assigned Work; Inquiry and Offer retain their own positive and negative acceptance paths. Reload/resume, stale blocking and cross-Workspace isolation must also pass.

A repeated escape is a product defect or deliberate documented non-goal.

## 7. Quality gates

Release is blocked by:

- an open P0/P1 defect affecting either accepted loop;
- cross-Workspace data leakage or implicit relationship merging;
- organization verification inferred from account, merchant, Payment or deposit evidence without the admitted matching organization evidence;
- an Opportunity that creates competing Contact/Organization truth or whose closure deletes a shared Contact;
- a buyer intent that automatically creates an Opportunity without explicit qualification, or, if trading buyer/contact enrichment is enabled, paid enrichment that lacks budget/provenance/consent/suppression gates, converts provider failure into a negative fact or invents contact data;
- customer objects with no durable owner/reference;
- materially incomplete English parity or a language switch that corrupts user/business state;
- a required flow reachable only through Today, or a deep link/reload that loses authorized context;
- conversation content that hides or contradicts the structured owner state;
- a resumable Conversation Work Session that loses its checkpoint or duplicates Work, Order, Payment, charge or external action;
- quote amount/status without versioned source;
- an unreviewed Provider supply price becoming effective, or an issued Quote changing after an upstream price update;
- formal state progression without required evidence;
- Payment or Purchase Intent conflated with confirmation, filing, service completion or trademark ownership transfer;
- Payment displayed as invoice issued or tax compliance completed;
- a one-way channel presenting a reply control that cannot complete its promise;
- production path requiring fixture data or normal operations requiring direct database edits;
- unavailable critical functionality that cannot be disabled or safely degraded;
- missing required Storybook states, visual-review evidence, Playwright critical path, backup/restore evidence or incident procedure;
- a Creator result that conflicts with its exact owner facts, hides stale/currentness limits or allows uncontrolled AI image content to alter a source trademark or other high-risk field;
- a Creator projection that owns or advances Quote, Trading, Media or Distribution state;
- copy, export, browser handoff or user-reported use presented as independently verified publication.
- a lifecycle estimate, typical range or internal due date presented as an official date or certified legal deadline;
- a lifecycle deadline without an admitted exact source, rule version/effective window, applicability and responsible review;
- a zero/negative lifecycle fact without complete-read evidence, or an unlinked/unsupported source presented as current official status;
- jurisdiction rules hard-coded in the browser, a renderer or live model output that invents milestones, dates, confidence or CTA eligibility;
- a lifecycle CTA that bypasses permission/currentness/entitlement checks, creates duplicate formal work or executes a protected action without explicit review and authorization.
- a D-042 preparation result that loses exact provenance, turns unknown into no, produces a false-ready result despite blocking missing/conflicting/stale input, sends a question, changes formal state, grants authority or submits a filing automatically, or advances without an exact-version accountable handler/professional-review receipt.

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
- authorized for-sale asset → current reviewed Listing → successful channel delivery completion;
- qualified-intent rate and time to first qualified intent, with views/Favorites reported separately from buyer intent;
- serious fact/authority/content misstatement rate and total attributable cost per usable Listing and per qualified intent;
- direct owner-backed handoff/conversion from an exact Creator result to Quote Confirmation, Inquiry, Offer or a qualified Opportunity; cross-channel, campaign and multi-touch attribution remain LC-2.0 work;
- escape-to-manual-tool count.

## 9. Explicit non-gates

The following do not block 1.0 unless a later accepted decision changes this file:

- native App;
- Lite Pro or Business, Sites Web Basic or Mini Program Plus;
- Stripe;
- full public multi-Workspace marketplace, custody/escrow, KYC or settlement;
- full Trading Studio Deep Build, three-direction/six-proposal delivery, numerical AI valuation, automatic repricing, Transaction Room or trademark-sale collection/transfer execution;
- automated official filing in every country or all-country Data Engine linkage;
- complete Lifecycle Rule Packs for every jurisdiction; WS-1.0 gates only the separately declared scopes for the US, EUIPO, Singapore, the Philippines and China;
- ordinary-Workspace Portfolio Timeline, 30/60/90-day Upcoming Actions or comparative Lifecycle Intelligence, which remain MR-1.5 dogfood and WS-2.0/WS-3.0 candidates;
- broad Lite general availability;
- unrestricted automatic marketing;
- advanced Brain authoring or a generic Capability Center;
- any Brain case-analysis job, substantive OA method or private-Workspace method overlay not separately admitted through an approved M21 scope;
- Candidate B price/service mapping, complex US application types, jurisdictions beyond the approved D-042 slice and substantive OA work;
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

- D-041 is recorded: M07 managed hosting and the staged M18 product route are approved. External credentials, seller-authority evidence, professional review, collection/settlement, transfer and operating evidence remain acceptance gates, not additional Product Owner questions for the bounded WS-1.0 intent loop;
- D-042 is recorded: Candidate A is the approved first bounded Brain-job direction. BRN-A0 may begin without another Product Owner choice, while its exact US Method/Package, source/currentness, reviewer roster, evidence and runtime remain separately admission-gated;
- acceptance evidence for the Shared 1.0 Core, MR-1.0 and WS-1.0 sections of this document;
- three-director review;
- Product Owner release decision;
- exact MR-1.0 and WS-1.0 Product Profile versions being released;
- the exact MarkReg Ultimate Product Profile version and its active Forward configuration/Entitlements currently in dogfood;
- evidence that the MarkReg Forward Track remains ahead rather than collapsing to the same release horizon.
