# MO-MVP-TASK-006 — Lite Customer and Opportunity Workspace

## Outcome and structure

For trademark practitioners reviewing multi-customer work, Lite now provides **Work → Customers** list/detail/activity/related-work surfaces and **Opportunities** list/detail/evidence surfaces. The fixed navigation remains Today, Content, Opportunities, Trademarks, Work, Capability, Guide; Customers is deliberately not a top-level item.

Desktop uses filter controls above dense rows and two-column detail cards. At 760px and below, filters, rows, and detail cards stack; text wraps without hiding meaning. The primary decision is whether a fixture signal deserves professional review—not whether to contact a customer or create an order.

## View model and fixture boundary

App-owned typed view models are `CustomerSummary`, `CustomerDetail`, `CustomerActivityItem`, `OpportunitySummary`, `OpportunityDetail`, `OpportunityStatus`, and `EvidenceSummary`. They are presentation models, not platform domain contracts. `LiteWorkspaceRepository` is the future client seam. Its current fixture implementation is separate from JSX, asynchronous-compatible, explicitly labelled, and performs no storage or network access.

Opportunity statuses are NEW, REVIEWING, QUALIFIED, DEFERRED, and DISMISSED. They do not imply payment, filing, performance, appointment, or completion.

## States and accessibility

Stories cover customer and opportunity lists/details, loading, empty, stale, recoverable error, long content, and a 390px viewport. Ready is the normal fixture view; stale retains last-known records and blocks protected action; recoverable error retains component state and offers retry. Permission, partial-data, offline, forbidden, and not-found states remain governed by the shared page-state model and are future API concerns because this task has no authentication or API.

Landmarks, labelled search/select controls, textual status, visible focus, native buttons/links, logical keyboard order, responsive reflow, and automated axe coverage form the accessibility contract. The acceptance path is: keyboard-open Work → Customers, search/filter, open and return with filters retained; open Opportunities, filter, inspect evidence, and confirm suggested action cannot execute.

## Safety locks and non-goals

- Opportunity ≠ Confirmed Demand.
- Suggested Action ≠ Customer Instruction.
- Recommendation ≠ Appointment.
- Customer Record ≠ Verified Legal Identity.
- Fixtures are not live, verified, official, or legal advice.
- No automatic contact, bulk outreach, order creation, protected action, formal-state mutation, production API, local storage, contract change, or backend work.

The required `ui-design` skill was not present in the available skill registry or filesystem; the repository UI design standard and product briefs were followed directly instead.

## Hardening audit

Repository results are readonly and defensively cloned. Fixture startup validates every opportunity customer reference, while missing related collections render an explicit empty state. Pages consume only `LiteWorkspaceRepository`, so a future API-backed implementation can replace fixtures without rewriting list or detail components. No fixture is embedded in JSX, mutated by the UI, persisted locally, or presented as live network data.

Customer and opportunity filters are independent. Returning from detail restores the originating filters and focus; unknown fixture IDs render a safe Not Found state through the same application component. Strict TypeScript includes product and TypeScript test sources without `allowJs`, `checkJs`, `skipLibCheck`, exclusions, weakened strictness, or lint suppressions.

Following TASK 007 integration, Playwright covers the 1440 × 900 customer/opportunity lists, 390 × 844 customer/opportunity details, filter and focus retention, fixture visibility, disabled suggested action, overflow, console errors, and failed static resources. Screenshots are generated only in the ignored artifact directory and are not committed.
