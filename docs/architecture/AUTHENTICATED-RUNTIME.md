# Authenticated runtime

Core Service exclusively owns opaque Sessions, SHA-256 token hashing, absolute expiry, revocation, User eligibility, Membership resolution, role policy, and Principal construction. Gateway never reads the identity database: it forwards the opaque `mo_session` token to Core using the separate `X-MarkOrbit-Internal-Authorization` shared secret.

Sessions use UUIDv7 identifiers, version 1, `ACTIVE`/`REVOKED` state, and contain no Workspace role. Production tokens are 32 cryptographically random bytes encoded as base64url; only their 64-character SHA-256 digest is stored. Absolute TTL defaults to 12 hours and accepts 5 minutes through 7 days (`MO_SESSION_TTL_SECONDS`), with no sliding write or refresh token.

Principals are discriminated as `ANONYMOUS`, `AUTHENTICATED_USER`, or `WORKSPACE`. Workspace scope comes from the route `workspaceId` (or canonical `X-MarkOrbit-Workspace-Id` where no route scope exists), but Core grants it only for an active User, Workspace, and Membership. Permissions are deterministically ordered from Core role policy. The reusable authorization guard fails closed.

The browser boundary uses `mo_session` with `HttpOnly; Path=/; SameSite=Lax`, `Secure` outside local HTTP, and expiry-aligned `Max-Age`. Unsafe requests require both an allowlisted Origin and `X-MarkOrbit-CSRF-Token`, a separate HMAC-bound value. Credentialed CORS reflects only `WEB_ORIGINS`; wildcard credentialed CORS is forbidden. Test bootstrap is permitted only with `MO_MILESTONE_TEST_RUNTIME=1` and provisioned fixture identities.

No signup, password, OAuth, SSO, JWT, refresh token, Formal Matter, or TASK 020 behavior is part of this boundary.
