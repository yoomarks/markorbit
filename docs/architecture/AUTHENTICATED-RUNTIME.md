# Authenticated runtime

Core Service exclusively owns opaque Sessions, SHA-256 token hashing, absolute expiry, revocation, User eligibility, Membership resolution, role policy, and Principal construction. Gateway never reads the identity database: it forwards the opaque `mo_session` token to Core using the separate `X-MarkOrbit-Internal-Authorization` shared secret.

Sessions use UUIDv7 identifiers, version 1, `ACTIVE`/`REVOKED` state, and contain no Workspace role. Production tokens are 32 cryptographically random bytes encoded as base64url; only their 64-character SHA-256 digest is stored. Absolute TTL defaults to 12 hours and accepts 5 minutes through 7 days (`MO_SESSION_TTL_SECONDS`), with no sliding write or refresh token.

Principals are discriminated as `ANONYMOUS`, `AUTHENTICATED_USER`, or `WORKSPACE`. Workspace scope comes from the route `workspaceId` (or canonical `X-MarkOrbit-Workspace-Id` where no route scope exists), but Core grants it only for an active User, Workspace, and Membership. Permissions are deterministically ordered from Core role policy. The reusable authorization guard fails closed.

The browser boundary uses `mo_session` with `HttpOnly; Path=/; SameSite=Lax`, `Secure` outside local HTTP, and expiry-aligned `Max-Age`. Unsafe requests require both an allowlisted Origin and `X-MarkOrbit-CSRF-Token`, a separate HMAC-bound value. Credentialed CORS reflects only `WEB_ORIGINS`; wildcard credentialed CORS is forbidden. Test bootstrap is permitted only with `MO_MILESTONE_TEST_RUNTIME=1` and provisioned fixture identities.

No signup, password, OAuth, SSO, JWT, refresh token, Formal Matter, or TASK 020 behavior is part of this boundary.

## HTTP inventory

Core exposes service-credential-protected `POST /internal/auth/sessions`, `POST /internal/auth/sessions/resolve`, `POST /internal/auth/workspace-principals/resolve`, and `POST /internal/auth/sessions/:sessionId/revoke`. The canonical credential header is `X-MarkOrbit-Internal-Authorization`; internal endpoints are not browser routes. Core starts its managed PostgreSQL pool before HTTP and closes both resources on shutdown.

Gateway exposes `GET /api/auth/session`, `POST /api/auth/logout`, and `GET /api/workspaces/:workspaceId/context`. In explicit milestone test runtime only, `POST /__test/auth/session` maps an allowlisted fixture name to a provisioned User, calls Core over HTTP, places the raw token only in `mo_session`, and returns the HMAC-SHA-256 CSRF value bound to Session ID. Logout requires both an allowed `Origin` and `X-MarkOrbit-CSRF-Token`; repeated use of the old cookie fails authentication after the first revocation.

Focused clean-checkout-safe commands are `pnpm test:auth`, `pnpm test:auth:postgres`, and `pnpm test:auth:http`; each first builds its Turbo dependency graph. The shared seven-case repository contract runs unchanged for memory and PostgreSQL. CI supplies PostgreSQL 16, Node 22, pnpm 10.28.1, required-mode database configuration, and explicit non-production secrets/origin. TASK 020 remains **NOT STARTED**.
