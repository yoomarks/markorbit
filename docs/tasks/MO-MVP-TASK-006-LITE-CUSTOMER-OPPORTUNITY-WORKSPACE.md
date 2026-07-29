# MO-MVP-TASK-006 — Lite Customer and Opportunity Workspace

## Task shape

- **Repository / allowed directories:** `yoomarks/markorbit`; Lite-owned files in `apps/lite-web` and this task record only.
- **Objective and user-visible outcome:** trademark practitioners can search and filter fixture customers and evidence-aware opportunities, inspect details, and return without losing list filters.
- **Canonical sources:** `MVP-PRODUCT-LOCK.md`, UI Foundation, Lite UI Brief, Page State Model, Task 003, Books 01–07, and the Capability Canon.
- **Contracts consumed or changed:** no platform domain or transport contract is consumed or changed. Lite-owned typed view models are presentation contracts only.
- **Events:** no domain, analytics, contact, order, appointment, or protected-action event is emitted or consumed.
- **Acceptance:** fixture-backed Storybook states and Lite tests cover the repository seam, search/filter semantics, details, safe statuses, evidence limitations, advisory actions, responsive layout, keyboard-reachable native controls, visible textual status, and Storybook a11y checks.
- **Validation:** the workspace quality gate plus Lite build and UI Storybook build.
- **Expected PR:** `MO MVP — Lite customer and opportunity workspace` (Draft; do not merge).

## User, job, and information architecture

The user is a trademark practitioner or small professional team. Their job is to retain customer relationship context, triage observations, inspect the evidence and limitations behind a possible opportunity, and decide a governed human next step.

Lite's seven-item top-level navigation remains exactly **Today, Content, Opportunities, Trademarks, Work, Capability, Guide**. Customers are subordinate to **Work → Customers**; there is no top-level Customers destination. Opportunities retain their top-level destination. Desktop uses the existing persistent rail, dense list/filter surfaces, and two/three-column detail groupings. At 760 px and below—including the 390 px story—the navigation scrolls, filters and cards stack, long content wraps, and controls retain their labels.

## Page structure and view models

Customer list leads to customer detail, activity, related intakes, related recommendations, and related opportunities. Opportunity list leads to source, customer, country/region, trademark, suggested next action, confidence/evidence, status, and related intake or matter preview.

Lite owns `CustomerSummary`, `CustomerDetail`, `CustomerActivityItem`, `OpportunitySummary`, `OpportunityDetail`, `OpportunityStatus`, and `EvidenceSummary`. `OpportunityStatus` is limited to `NEW`, `REVIEWING`, `QUALIFIED`, `DEFERRED`, and `DISMISSED`; it does not infer a win, payment, filing, demand, authority, acceptance, or completion.

## Fixture boundary and future API seam

Fixture objects live in feature repository modules, separate from JSX. `CustomerRepository` and `OpportunityRepository` expose asynchronous `list`/`get` methods so a later generated client adapter can implement the same Lite-facing seam. This implementation does not create a production API, persist to `localStorage`, pretend the data is live, read another service's database, or change shared contracts. The persistent fixture banner, per-page fixture state, and “Not live data” context identify provenance.

## States and transitions

The app supplies ready/success, loading, empty, stale, and recoverable-error fixtures. Stale retains last-known data with its timestamp and warning; retry changes only the display fixture to ready. Error retry retains the workspace rather than mutating a formal record. Search, status, and country/region filters are component state. Opening and closing a detail does not remount its list surface, so those values remain. Partial and permission states are documented by the shared state model but are non-goals without an authenticated or multi-source client; no fixture implies permission.

## Accessibility and visual review

The pages preserve shell landmarks, heading hierarchy, labeled native text/select controls, explicit buttons, live result regions, visible focus from the shared foundation, and native tab order. Every opportunity status includes its uppercase text as well as a symbol/text status badge, never color alone. Alerts explain consequences. Storybook includes customer list/detail, opportunity list/detail, empty, loading, stale, error, long-text, and 390 px fixtures and enables the configured a11y addon. Visual review should capture the desktop list/detail and 390 px story; the Playwright acceptance path is: keyboard through the seven primary links → open Work / Customers → filter and inspect a customer → return with filters retained → open Opportunities → filter and inspect evidence → mark a suggestion reviewed → verify that no external action occurred. Existing Playwright infrastructure is not expanded by this bounded parallel task.

## Safety locks and non-goals

- Opportunity ≠ Confirmed Demand.
- Suggested Action ≠ Customer Instruction.
- Recommendation ≠ Appointment.
- Customer Record ≠ Verified Legal Identity.
- A suggested-action acknowledgement is local component memory only; it never contacts anyone or creates an order, appointment, filing, payment, or formal-state change.
- No automatic contact, bulk outreach, order creation, production API, storage, authentication, contract change, backend, shared UI change, markreg change, or canon mutation is included.
