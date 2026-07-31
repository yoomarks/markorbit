# MO MVP TASK 018 — Identity, Workspace and Membership Contracts

Status: IMPLEMENTED — DRAFT PR

Core owns the durable identity boundary. This task adds portable User, Workspace and Membership contracts, safe typed errors, the fixed four-role/nine-permission policy, identity-owned SQL migration, and matching memory/PostgreSQL repositories with optimistic concurrency and explicit Workspace scope.

Validation: `pnpm validate:workspace`, `pnpm validate:persistence-boundaries`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. PostgreSQL validation uses PostgreSQL 16 and applies/verifies `0018_identity_workspace_membership.sql` from clean state. Shared contracts execute 10 User, 9 Workspace, and 14 Membership behaviors unchanged against both adapters; required PostgreSQL mode forbids a missing URL or silent skips. Real-database verification also covers duplicate races, all three expected-version races, rollback, reconnect, unavailable persistence, and race-safe Membership admission.

Non-goals are authentication, Principal resolution, sessions, credentials, public registration, Gateway/Web integration, Formal Matter, audit, idempotency, outbox, RLS, billing, and external filing. TASK 019 has not started.
