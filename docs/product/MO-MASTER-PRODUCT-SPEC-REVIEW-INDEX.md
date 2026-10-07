# MarkOrbit Master Product Spec — Owner Review Index

Status: DRAFT / IN_REVIEW
Effective date: 2026-10-08
Runtime development gate: CLOSED until Product Owner approval

This index defines the module set for the first full owner-review specification. Detailed module specifications are reviewed outside runtime implementation and become implementation authority only after explicit approval.

## Approval rule

For each module the Product Owner may choose:
- APPROVED;
- CHANGE_REQUESTED;
- DEFER / REASSIGN VERSION.

Approval may apply to a whole module or explicitly named subsections.

No runtime product Issue/PR may be admitted solely from historical Issues, current code, Preview pages or CI status.

## Module set

- M01 MO Control Center / Platform Control Plane
- M02 Identity / Accounts / Security
- M03 Workspace / Membership / Organization
- M04 Product Profiles / Entitlements / Release Control
- M05 Lite Shell / Daily Operations
- M06 MarkReg Operations / Reference Workspace
- M07 Sites Runtime / Workspace Customer Surface
- M08 markreg.com / Direct Customer Experience
- M09 Customers / Leads / Contacts / Consent
- M10 Trademark Assets / Applicant / Portfolio
- M11 Quote / Pricing / Commercial / Order
- M12 Payment / Reconciliation
- M13 Filing / Matter / Work / Delivery
- M14 MGSN / Provider Network
- M15 Messages / Email / Customer Communication
- M16 Content / Creator / Media
- M17 Growth / Automated Marketing
- M18 Trading / Trademark Commercialization
- M19 Knowledge
- M20 Data Engine
- M21 Brain
- M22 Capabilities
- M23 External Providers / Integrations
- M24 Execution / Protected Actions
- M25 Observability / Audit / Backup / Incident / Support
- M26 Versioning / Approval / Development Gate

## Mandatory specification sections per module

1. Purpose
2. Users
3. Entry points/pages/information architecture
4. Canonical objects
5. Fields/information
6. States/state machine
7. User/system actions
8. Permissions
9. Feature/profile/channel/provider controls
10. Dependencies/owner boundaries
11. Failure/degradation
12. Audit/evidence
13. Metrics
14. Acceptance criteria
15. Product Owner decisions still required
16. Existing-development reuse / rewire / productize / defer assessment

## Recommended review order

1. M01–M04 — platform boundary and release control
2. M05–M08 — user-facing products
3. M09–M15 — WS-1.0 commercial/delivery loop
4. M19–M24 — intelligence/data/execution substrate
5. M16–M18 — MarkReg Forward / later product waves
6. M25–M26 — production operations and governance

The detailed v0.1 specification is intentionally not treated as approved until Product Owner review is complete.
