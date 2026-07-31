# MO MVP TASK 019 — Authenticated Runtime, Sessions and Gateway Principal

Status: implemented on the dedicated TASK 019 branch. Milestone 2 remains `APPROVED_FOR_IMPLEMENTATION`.

The bounded outcome is Core-owned durable opaque Sessions and portable authenticated/Workspace Principals, plus Gateway cookie, trusted-origin, CSRF, CORS, and Core HTTP client boundaries. Migration `0019_core_sessions.sql` is forward-only. Repository and service tests cover hashing, issuance, resolution, expiry, revocation, disabled Users, permissions, cookies, CSRF, Origin validation, and service credentials.

Configuration: `MO_SESSION_TTL_SECONDS=43200` (300–604800), `MO_INTERNAL_SERVICE_SECRET` (minimum 32 bytes), `WEB_ORIGINS` (explicit comma-separated origins), and optional `MO_MILESTONE_TEST_RUNTIME=1` solely for fixture runtime evidence. No production secret or bootstrap default is committed.

Validation uses `pnpm test:auth`, `pnpm test:identity:postgres`, migrations, and the root quality gate. TASK 020 has not started. Formal Matter, credential flows, product UI, JWT, refresh tokens, and identity-provider integrations are explicit non-goals.
