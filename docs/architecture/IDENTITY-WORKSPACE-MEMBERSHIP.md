# Identity, Workspace and Membership

## Ownership

Core Service (`@markorbit/core-service`) is the single owner of User, Workspace, Workspace Membership, fixed role policy, repositories, and the `core` migrations. Portable contracts and typed errors live in `@markorbit/contracts`; `@markorbit/persistence` remains infrastructure only. Other services consume contracts and must not query Core tables.

## Durable models and policy

Users retain display email plus a deterministically trimmed/lower-cased unique email, have `ACTIVE` or `DISABLED` status, and are never hard deleted. Workspaces are the public product object and tenant boundary; their normalized slug is unique and status is `ACTIVE` or `ARCHIVED`. A Workspace Membership is unique per `(workspaceId, userId)`, has an `ACTIVE` or `SUSPENDED` status, and is always addressed with explicit Workspace scope. All aggregates begin at version 1 and mutations atomically compare and increment the expected version.

| Role              | Permissions                                                                      |
| ----------------- | -------------------------------------------------------------------------------- |
| `WORKSPACE_ADMIN` | all nine permissions                                                             |
| `MATTER_MANAGER`  | `workspace:read`, `matter:read`, `matter:create`, `matter:manage`, `review:read` |
| `REVIEWER`        | `workspace:read`, `matter:read`, `review:read`, `review:perform`                 |
| `READ_ONLY`       | `workspace:read`, `matter:read`, `review:read`                                   |

The vocabulary is `workspace:read`, `workspace:manage`, `membership:read`, `membership:manage`, `matter:read`, `matter:create`, `matter:manage`, `review:read`, and `review:perform`. Unknown values fail closed. Disabled Users and suspended Memberships grant nothing. Archived Workspaces retain reads but deny mutation permissions and new Memberships.

## Persistence and isolation

The SQL-first migration creates `users`, `workspaces`, and `workspace_memberships`, with UUID primary keys, status/role/version checks, unique normalized identifiers, membership uniqueness, and Core-owned foreign keys. In-memory and PostgreSQL adapters implement the same domain-specific interfaces. PostgreSQL clients are injected (including transaction clients); adapters neither create pools nor import-connect. Membership lookup and mutation include `workspaceId`, lists are deterministically ordered, and no RLS guarantee is claimed.

Administrator provisioning means explicit creation through the internal repository boundary. There is no production default account, credential, registration, login, session, cookie, token, Gateway route, or Web behavior.

## Operations and removal boundary

Run `pnpm --filter @markorbit/core-service test`, the workspace quality gates, and persistence migration status/verification. A rollback removes the Core adapters/contracts only after consumers are removed; deployed SQL is forward-oriented and must receive a new corrective migration rather than editing the applied migration.

TASK 019 will introduce runtime Principal/session behavior. It has not started here.
