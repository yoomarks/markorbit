# MO-MVP-TASK-033A — Milestone 8 Scope Lock

## Milestone

`M8 — MVP Commercial Foundation`

## Objective

Move MarkOrbit from an engineering-ready governed core to a usable MVP commercial system. A new real user must be able to enter the product without fixture identities, establish a governed account, progress into a Workspace, select and order a service, pay through a real payment boundary, and be visible to internal operations.

## Required platform path

`Register -> Login -> Account classification -> Workspace/Role -> Product/Price -> Quote -> Order -> Checkout -> Payment -> Matter -> Admin operations -> Customer status`

The path is not complete while any required user step depends on milestone fixtures, direct database edits, or engineer-issued sessions.

## Work packages

1. **WP01 — Real Account Access**
   - self-service CUSTOMER and PROFESSIONAL registration;
   - password credential storage using a memory-hard one-way hash;
   - real password login;
   - Account Type remains distinct from Workspace Role;
   - HttpOnly browser session through Gateway;
   - PROVIDER and INTERNAL are not self-service account types.
2. **WP02 — Account Onboarding and Workspace Entry**
   - browser registration/login UI;
   - first Workspace creation/join flow;
   - account profile and Workspace context.
3. **WP03 — Product, Pricing and Checkout Foundation**
   - governed products/prices and checkout initiation.
4. **WP04 — Payment Foundation**
   - Payment as a distinct domain from Order;
   - real provider integration, webhook verification, refund state and reconciliation.
5. **WP05 — Commercial Admin**
   - users, workspaces, customers/professionals/providers, orders, payments and matters administration.
6. **WP06 — Commercial Runtime Reliability**
   - failure handling, audit, security hardening, migration/recovery and real-runtime E2E.
7. **WP07 — Independent MVP Commercial Readiness Audit**
   - new-user-to-admin acceptance without fixtures or manual database intervention.

## Locked boundaries

- `Account Type != Workspace Role`.
- `Order != Payment`.
- `Payment succeeded != Filing submitted`.
- `Payment succeeded != Matter completed`.
- `Provider != Professional appointment`.
- `Professional Review != Official Truth`.
- `Knowledge evidence != Official structured truth`.
- No public self-registration for `PROVIDER` or `INTERNAL`.
- No plaintext or reversibly encrypted passwords.
- Browser authentication uses the canonical HttpOnly session cookie and existing CSRF/origin boundary.
- Existing M7 authority locks remain in force.

## Milestone completion gate

M8 cannot be declared MVP Beta Ready until a completely new user can complete the required commercial path without test fixtures, engineering intervention or direct database mutation, and an authorized internal user can see and operate the resulting commercial records in the admin product.
