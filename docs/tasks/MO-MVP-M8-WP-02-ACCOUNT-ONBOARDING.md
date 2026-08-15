# MO-MVP-M8-WP-02 — Account Onboarding and Workspace Entry

## 1. Task ID

`MO-MVP-M8-WP-02`

## 2. Repository and allowed directories

Repository: `yoomarks/markorbit`

Allowed scope:

- `packages/contracts`
- `services/core`
- `apps/gateway`
- `apps/markreg-web`
- `apps/lite-web`
- `.env.example`
- `docs/tasks`

## 3. Objective and user-visible outcome

A real CUSTOMER can open MarkReg, register or sign in, create or select a Workspace and enter the customer product. A real PROFESSIONAL can do the equivalent in Lite with professional-specific copy and information architecture. No milestone fixture identity, direct database edit or engineer-issued Session is required.

## 4. Canonical sources

- `AGENTS.md`
- `docs/tasks/MO-MVP-TASK-019-AUTHENTICATED-RUNTIME.md`
- `docs/tasks/MO-MVP-TASK-033A-MILESTONE-008-SCOPE-LOCK.md`
- `docs/tasks/MO-MVP-M8-WP-01-REAL-ACCOUNT-ACCESS.md`
- existing User / Workspace / Membership / Session / RBAC contracts
- existing shared `@markorbit/ui` primitives

## 5. Contracts consumed or changed

Changed:

- `CreateWorkspaceCommand`
- `WorkspaceEntry`

Consumed:

- Account Type created by WP01;
- User / Workspace / WorkspaceMembership;
- HttpOnly Session cookie;
- CSRF and trusted-Origin boundary;
- Workspace Role and permission matrix.

## 6. Required behavior

- Workspace creation is owned by Core identity boundaries.
- A newly created Workspace receives exactly one creator membership with role `WORKSPACE_ADMIN`.
- Workspace + creator membership are created transactionally in PostgreSQL.
- Browser never supplies the authoritative User ID for Workspace creation; Gateway resolves the user from the Session.
- Workspace mutation requires trusted Origin and the canonical CSRF token.
- Default self-service Workspace slugs are collision-safe while remaining readable.
- MarkReg registration creates CUSTOMER accounts only.
- Lite registration creates PROFESSIONAL accounts only.
- MarkReg and Lite keep distinct product-owned entry UX and copy while sharing only backend protocol and UI primitives.
- Existing governed query-route acceptance paths remain available and are not silently rewritten.
- Normal product roots are gated by real Session + Workspace entry.
- Local Vite development proxies `/api` to Gateway so credentialed browser requests remain same-origin at the product surface.

## 7. State transitions

Browser entry:

`Checking Session -> Anonymous | Authenticated`

Anonymous:

`Register/Login -> ACTIVE Session -> Workspace discovery`

Workspace discovery:

- zero active Workspaces -> `Workspace setup`
- one active Workspace -> `Product ready`
- multiple active Workspaces -> `Workspace selection -> Product ready`

Workspace create:

`ACTIVE User -> ACTIVE Workspace + ACTIVE WORKSPACE_ADMIN Membership`

No Order, Payment, Matter, professional appointment or Filing is created by WP02.

## 8. UI states

Both MarkReg and Lite must implement:

- session checking;
- sign in;
- registration;
- busy state;
- invalid credential / duplicate account / weak password error;
- service unavailable error;
- first Workspace setup;
- Workspace creation error;
- multiple Workspace selection;
- ready/product state;
- mobile layout;
- accessible labels and live loading/error feedback.

Storybook fixture states are required for anonymous, first-Workspace and multiple-Workspace entry.

## 9. Events emitted and consumed

No new event-bus contract in WP02.

## 10. Acceptance tests

- ACTIVE user creates Workspace + WORKSPACE_ADMIN membership.
- disabled user cannot create Workspace.
- active Workspace discovery survives PostgreSQL reconnect.
- duplicate explicit slug leaves no partial Workspace or membership.
- Gateway derives authoritative User ID from Session.
- Workspace POST rejects missing CSRF.
- MarkReg new customer completes register -> first Workspace -> product-ready UI.
- Lite new professional completes register -> first Workspace -> product-ready UI.
- existing special governed query routes remain outside the normal root account gate.

## 11. Validation commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:auth:postgres
```

Hosted Browser and Visual Validation must also pass.

## 12. Non-goals

- invitations and team-member email flows;
- password reset/change;
- email verification;
- MFA/social login;
- Provider onboarding;
- Internal admin onboarding;
- products/prices;
- checkout/payment;
- commercial admin pages.

## 13. Expected PR title

`M8 WP02: add real account onboarding and workspace entry`
