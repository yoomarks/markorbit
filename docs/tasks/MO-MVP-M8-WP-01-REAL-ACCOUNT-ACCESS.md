# MO-MVP-M8-WP-01 — Real Account Access

## 1. Task ID

`MO-MVP-M8-WP-01`

## 2. Repository and allowed directories

Repository: `yoomarks/markorbit`

Allowed scope:

- `packages/contracts`
- `services/core`
- `apps/gateway`
- `infrastructure/persistence`
- `docs/tasks`

## 3. Objective and user-visible outcome

Replace milestone-only fixture login as the only practical browser entry with real self-service registration and password login. A CUSTOMER or PROFESSIONAL can establish a real Core identity and durable Session through the Gateway browser boundary.

## 4. Canonical sources

- `AGENTS.md`
- `docs/tasks/MO-MVP-TASK-019-AUTHENTICATED-RUNTIME.md`
- `docs/tasks/MO-MVP-TASK-033A-MILESTONE-008-SCOPE-LOCK.md`
- existing `User`, `Workspace`, `WorkspaceMembership`, Session and RBAC contracts

## 5. Contracts consumed or changed

Changed:

- account type vocabulary and self-service subset;
- register/login transport commands;
- browser-safe account/session response contract;
- authentication error vocabulary.

Consumed:

- User identity;
- existing Session contract;
- existing Gateway cookie/CSRF/origin boundary.

## 6. Required behavior

- Account types: CUSTOMER, PROFESSIONAL, PROVIDER, INTERNAL.
- Only CUSTOMER and PROFESSIONAL may self-register.
- Account Type does not replace Workspace Role.
- Normalize email using the existing Core identity rule.
- Reject duplicate normalized email.
- Password credentials use Node scrypt with a unique random salt and are never stored or returned in plaintext.
- Login uses one generic invalid-credentials outcome for unknown email and incorrect password.
- Successful register/login creates a real durable Session.
- Core exposes registration/login only behind the internal service-secret boundary.
- Gateway exposes `/api/auth/register` and `/api/auth/login` to trusted browser origins.
- Gateway stores the raw session token only in the canonical HttpOnly SameSite cookie and never returns it in JSON.

## 7. State transitions

Registration:

`No account -> ACTIVE User + AccountProfile + PasswordCredential -> ACTIVE Session`

Login:

`Existing ACTIVE account + valid credential -> new ACTIVE Session`

No Workspace membership or Order is automatically created by WP01.

## 8. UI states

No dedicated visual page is added in WP01. WP02 owns browser registration/login UI. WP01 must provide complete browser APIs for that UI.

## 9. Events emitted and consumed

No new event bus behavior in WP01.

## 10. Acceptance tests

- CUSTOMER registration succeeds.
- PROFESSIONAL registration succeeds.
- PROVIDER and INTERNAL self-registration fail.
- weak password fails before persistence.
- normalized duplicate email fails.
- password hash verifies but does not contain the password.
- correct login creates a fresh Session.
- unknown email and wrong password share the same public error.
- PostgreSQL survives restart and can authenticate the account.
- duplicate registration leaves no partial profile or credential.
- Gateway register/login require trusted Origin.
- Gateway register/login return browser-safe JSON and HttpOnly session cookie.

## 11. Validation commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:auth:postgres
```

## 12. Non-goals

- password reset/change;
- email verification;
- social login;
- MFA;
- Workspace creation/join UI;
- payment;
- admin user management;
- provider/internal onboarding UI.

## 13. Expected PR title

`M8 WP01: add real account registration and login`
