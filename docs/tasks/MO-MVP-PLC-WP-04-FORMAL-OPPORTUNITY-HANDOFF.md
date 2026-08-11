# PLC-WP-04 — Formal Opportunity to Existing Work Handoff

## 1. Task ID

`MO-MVP-PLC-WP-04`

## 2. Repository and allowed directories

Repository: `yoomarks/markorbit`.

Allowed implementation areas:

- `services/markreg/**`;
- `infrastructure/persistence/migrations/**` and `migration-owners.json`;
- bounded validation/CI files required to prove this work package;
- this task document;
- `packages/contracts/src/product-loop.ts` only if an already-frozen contract proves insufficient.

## 3. Objective

Implement the smallest MarkReg-owned durable boundary that turns an exact Lite Candidate + explicit `QUALIFIED_FOR_MARKREG` decision into a Formal Trademark Service Opportunity and then, after a separate explicit confirmation, prepares the existing MarkReg Intake handoff.

The bounded path is:

```text
Lite Candidate exact qualified version
+ Lite current DISPOSITIONED Candidate
+ exact human Qualification Decision
-> separate MarkReg owner mutation
-> Formal Trademark Service Opportunity QUALIFIED
-> separate explicit handoff confirmation
-> durable MarkRegIntakeHandoff
-> Formal Opportunity HANDED_OFF_TO_INTAKE
```

This package does not create Intake, Quote, Order, Matter, Payment, provider appointment, Filing Submission or Official Truth.

## 4. Approved basis

- Product Loop Closure approved by PR #73;
- PLC-WP-01 Product contracts and authority boundary;
- PLC-WP-03 durable Candidate/Qualification boundary merged in PR #77;
- `packages/contracts/src/product-loop.ts`;
- `docs/architecture/PRODUCT-LOOP-AUTHORITY-BOUNDARY.md`;
- `docs/planning/MO-MVP-PRODUCT-LOOP-CLOSURE-PLAN.md`.

## 5. Owner and source boundaries

WP-04 preserves the frozen ownership split:

- Lite owns Opportunity Candidate and Qualification Decision;
- MarkReg owns Formal Trademark Service Opportunity and the prepared MarkReg Intake handoff;
- the existing MarkReg Intake owner remains responsible for actual Intake creation;
- no cross-service SQL is permitted.

MarkReg consumes Candidate/Qualification evidence through injected `QualifiedOpportunityAuthority`:

- exact Candidate ID/version/fingerprint reviewed by the human decision;
- exact Qualification Decision ID/version;
- current Lite Candidate proving the disposition remains `DISPOSITIONED`;
- same Workspace throughout;
- outcome exactly `QUALIFIED_FOR_MARKREG`.

The service fails closed if Lite source authority is unavailable, stale, mismatched, cross-Workspace, rejected/deferred or claims a Formal Opportunity/customer-contact consequence inside Candidate state.

## 6. Formal Opportunity owner mutation

A Formal Opportunity can be created only from the exact qualified evidence and a separate MarkReg owner command containing:

- Workspace;
- exact Candidate ID/version/fingerprint;
- exact Qualification Decision ID/version;
- relationship model;
- optional proposed Customer Intent;
- promoting Principal identity;
- idempotency key.

Creation produces MarkReg-owned `FormalTrademarkServiceOpportunity` version 1 with:

- `status = QUALIFIED`;
- exact Candidate and Qualification references;
- customer ID only when supplied by the Lite-owned Candidate;
- service need copied from the exact Candidate;
- preserved relationship model;
- all automatic downstream consequences false.

One exact Qualification Decision can create at most one Formal Opportunity.

## 7. Intake handoff boundary

The handoff is a second, explicit mutation over one exact Formal Opportunity version/fingerprint.

The user-confirmed handoff preserves:

- `channel = LITE_PROFESSIONAL`;
- relationship model;
- Customer Intent;
- confirming Principal;
- confirmation timestamp;
- exact Formal Opportunity source version/fingerprint.

The immutable `MarkRegIntakeHandoff` retains:

- `intakeCreated = false`;
- `orderCreated = false`;
- `matterCreated = false`.

The MarkReg-owned Formal Opportunity advances to version 2 with `status = HANDED_OFF_TO_INTAKE`, but no `intakeId` is fabricated.

### Existing Intake compatibility finding

The current MarkReg `POST /v1/intakes` runtime still calls `assertDirectIntake` and explicitly supports only `MARKREG_DIRECT + DIRECT`.

The frozen PLC handoff contract uses `LITE_PROFESSIONAL` and may preserve `DIRECT`, `CO_DELIVERY`, `WHITE_LABEL`, `REFERRAL` or `PLATFORM_ASSISTED` relationship semantics.

WP-04 therefore does **not** bypass `assertDirectIntake`, disguise a Lite professional handoff as direct traffic, or broaden the existing Intake contract without a separately proven requirement. It prepares the durable owner handoff; actual Intake creation remains an explicit later MarkReg owner action.

## 8. Relationship-model lock

WP-04 preserves the already-separated relationship semantics and does not collapse them into “customer owner”. The Formal Opportunity retains the existing `RelationshipModel` contract. The confirmed handoff must match that relationship model and cannot silently change a proposed Customer Intent.

Where later flows need Channel, Relationship Owner, Contracting Party, Delivery Owner, Communication Owner, Customer-facing Brand or Professional Authority, those dimensions remain separate; WP-04 does not invent or infer missing values.

## 9. Durable state

Migration `0041_markreg_formal_opportunity_handoff` adds only MarkReg-owned tables:

- `markreg_formal_trademark_service_opportunities` — immutable version history;
- `markreg_intake_handoffs` — one confirmed prepared Intake handoff per bounded Formal Opportunity;
- `markreg_formal_opportunity_commands` — Workspace-scoped exact idempotency replay ledger.

The implementation uses PostgreSQL advisory transaction locks for:

- idempotency key serialization;
- one Formal Opportunity per exact Qualification Decision;
- one handoff winner per exact Formal Opportunity version.

## 10. Reliability requirements

The dedicated PostgreSQL suite proves:

- exact qualified source references survive restart/store recreation;
- Formal Opportunity exact replay survives restart;
- one Qualification Decision produces one Formal Opportunity winner under concurrency;
- idempotency payload drift fails closed;
- rejected/deferred/stale Candidate evidence cannot create Formal Opportunity;
- exact handoff survives restart;
- competing handoffs serialize to one winner;
- stale Formal Opportunity version/fingerprint is rejected;
- another Workspace cannot read Formal Opportunity or handoff state;
- dependency failure is distinct from persistence state;
- Formal Opportunity creation and handoff never imply Intake, Order, Matter, Payment, filing, appointment or customer outreach.

Historical reliability suites that enumerate the **current** MarkReg-owned migration set are extended additively for `0041` and its three owner-local relations. Frozen milestone behavior and evidence semantics are not rewritten.

## 11. Explicit non-goals

WP-04 does not add:

- Lite UI or Today surface;
- Gateway/browser routes;
- automatic customer outreach;
- automatic MarkReg Intake creation;
- Quote acceptance;
- Order creation;
- Matter creation;
- Payment/Invoice;
- provider appointment;
- Filing Submission;
- Official Truth;
- universal Opportunity/CRM/Workplace service;
- M6 Capability learning runtime.

## 12. Acceptance consequence

Merge of the WP-04 PR accepts only:

- separate MarkReg Formal Opportunity owner mutation after exact human Qualification;
- durable explicit Intake handoff preparation;
- preserved relationship and authority boundaries;
- no automatic downstream business/protected action.

After merge, the next planned package is `PLC-WP-05 — Lite Today -> Prepared Action real-runtime journey`. It is not started or merged by WP-04.
