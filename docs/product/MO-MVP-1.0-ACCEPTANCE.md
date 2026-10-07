# MarkOrbit MVP 1.0 Acceptance

Status: ACTIVE RELEASE GATE
Effective date: 2026-10-07

## 1. Commercial promise

MVP 1.0 passes only when:

MarkReg can convert a qualified overseas trademark inquiry into a professionally managed, quoted, documented, traceable and deliverable trademark matter without engineering intervention.

## 2. Canonical Golden Business Loop

Visitor / Lead
→ MarkReg Customer Account / Customer Relationship
→ structured Intake
→ human qualification / responsibility assignment
→ Recommendation
→ versioned Quote
→ customer confirmation
→ materials / missing information
→ Order / Matter
→ MarkReg Operations Queue
→ self-operated or MGSN delivery route
→ review / authorization / filing preparation or governed human handoff
→ progress + messages
→ result/evidence
→ customer delivery
→ follow-up/closure

The loop may contain human professional work. Automation is not an acceptance requirement unless explicitly stated.

## 3. Required 1.0 product capabilities

### Identity and Workspace
- MarkReg Reference Workspace exists as a normal governed Workspace with special entitlements;
- staff login and Membership are production-capable;
- customer accounts are Site/Workspace scoped;
- no customer Workspace switch/discovery;
- Workspace isolation proven in UI/API/search/export/log/audit paths;
- password recovery/email verification/basic abuse protection are operational.

### Customer operations
- durable Customer Relationship;
- contact details needed for the hero service;
- responsible staff/owner;
- SLA/next action;
- customer timeline;
- no orphan lead/customer/quote/message.

### Commercial
- structured Intake;
- qualification state;
- recommendation;
- versioned Quote;
- expiry/revocation as applicable;
- explicit customer confirmation;
- Order/Matter creation with lineage.

### Materials and work
- material checklist;
- missing-item state;
- upload/reference path;
- staff Work/Operations Queue;
- waiting-on-customer/provider states;
- clear next action;
- no engineering script required to advance normal business.

### Communication
- one real external notification channel;
- portal/customer-visible messages or status;
- object-linked message history;
- customer reply/response can be associated with the correct business object;
- consent/contact evidence remains distinct.

### Delivery
- internal delivery route is explicit;
- MGSN may be used where applicable;
- manual filing/professional handoff is acceptable if governed;
- filed/completed states require evidence;
- result/receipt/package delivered to customer;
- closure/follow-up recorded.

### MO Control Center
- Workspace and staff inspection/administration;
- Product Profile/maturity/entitlement visibility;
- critical feature kill switch/disablement;
- Data/Knowledge freshness/failure visibility;
- Brain/Capability version/dependency/run visibility;
- integration health;
- execution failure/manual intervention visibility;
- audit trail.

### Product/platform composition
- Product Profile is versioned;
- MarkReg profile is explicit;
- basic Workspace Intelligence Profile binding exists;
- external providers can be disabled/degraded without unrelated system collapse;
- significant configuration changes are audited.

### Operations
- production deployment path;
- monitoring and alerting;
- backup and restore evidence;
- incident and support runbook;
- data export/deletion runbook;
- rollback/kill-switch procedure;
- no production fixture fallback.

## 4. Dogfood acceptance

Before release:
- run at least 20–30 historical or highly realistic MarkReg cases to expose operational gaps;
- then process at least 10 consecutive real/production-grade cases through the complete loop;
- target 5–10 paid Matters where commercial/legal circumstances permit;
- operate continuously for 2–4 weeks without relying on engineers for ordinary case progression;
- record every escape to spreadsheet, personal email, manual script or undocumented note.

A repeated escape is a product defect or deliberate documented non-goal.

## 5. Quality gates

Release is blocked by:
- open P0/P1 defect affecting the Golden Business Loop;
- cross-Workspace data leakage;
- customer objects with no durable owner/reference;
- quote amount/status without versioned source;
- formal state progression without required evidence;
- payment state conflated with confirmation/order/matter/filing;
- production path requiring fixture data;
- normal operations requiring direct database edits;
- unavailable critical feature that cannot be disabled or safely degraded;
- missing backup/restore or incident procedure.

## 6. Operational targets

Every active inquiry/matter should have:
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
- customer-response SLA;
- paid Matter count;
- delivery completion;
- escape-to-manual-tool count.

## 7. Explicit non-gates

The following do not block 1.0 unless a later accepted decision changes this file:
- Mini Program;
- native App;
- full Trading Studio/marketplace;
- all countries;
- automatic official filing;
- broad Lite GA;
- unrestricted auto-marketing;
- advanced Brain authoring;
- generic Capability Center;
- multi-provider parity;
- full Product Builder.

## 8. Release decision

A green CI suite or merged PR cannot mark 1.0 released.

Final release requires:
- acceptance evidence for this document;
- three-director review;
- Product Owner release decision;
- recorded version/profile being released.
