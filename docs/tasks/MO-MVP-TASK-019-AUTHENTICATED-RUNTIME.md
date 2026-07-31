# MO MVP TASK 019 — Authenticated Runtime, Sessions and Gateway Principal

Status: implemented on the dedicated TASK 019 branch. Milestone 2 remains `APPROVED_FOR_IMPLEMENTATION`.

The bounded outcome is Core-owned durable opaque Sessions and portable authenticated/Workspace Principals, plus Gateway cookie, trusted-origin, CSRF, CORS, and Core HTTP client boundaries. Migration `0019_core_sessions.sql` is forward-only. Repository and service tests cover hashing, issuance, resolution, expiry, revocation, disabled Users, permissions, cookies, CSRF, Origin validation, and service credentials.

Configuration: `MO_SESSION_TTL_SECONDS=43200` (300–604800), `MO_INTERNAL_SERVICE_SECRET` (minimum 32 bytes), `WEB_ORIGINS` (explicit comma-separated origins), and optional `MO_MILESTONE_TEST_RUNTIME=1` solely for fixture runtime evidence. No production secret or bootstrap default is committed.

Validation uses `pnpm test:auth`, `pnpm test:identity:postgres`, migrations, and the root quality gate. TASK 020 has not started. Formal Matter, credential flows, product UI, JWT, refresh tokens, and identity-provider integrations are explicit non-goals.

The completed runtime inventory and security construction are maintained in `docs/architecture/AUTHENTICATED-RUNTIME.md`. The shared Session repository suite has seven behavioral cases per implementation; focused Core authentication, Gateway boundary, and real-listener HTTP suites are independently clean-checkout safe. PostgreSQL required mode fails rather than skipping when `AUTH_TEST_DATABASE_URL` is absent. Exact PostgreSQL and CI totals are reported by the PR-head workflow rather than embedded as a timeless claim here.

R2 closes CI database pollution through database-per-suite isolation and complete dependent-table resets without weakening migration collision detection. It also restores exact source/inventory equality at 60 routes and explicitly excludes the test-only bootstrap. Historical Milestone 1 audit counts are not rewritten. TASK 020 remains **NOT STARTED**.
