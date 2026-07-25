# MO-MVP-TASK-001 — Repository Constitution and Monorepo Bootstrap

## Repository

`yoomarks/markorbit`

## Branch

`feat/mo-mvp-task-001-monorepo-bootstrap`

## Objective

Initialize the new MarkOrbit product monorepo from this bootstrap package and produce a clean, validated first pull request.

## Required work

1. Copy the complete bootstrap contents into the repository root.
2. Install dependencies with Node.js 22 and pnpm 10.28.1.
3. Generate and commit `pnpm-lock.yaml`.
4. Change CI from `pnpm install --no-frozen-lockfile` to `pnpm install --frozen-lockfile`.
5. Run every validation command and correct actual errors without weakening strict settings.
6. Confirm every service has an independent runtime entrypoint and service identity.
7. Confirm Product workspaces are placeholders only; do not start page implementation in this task.
8. Confirm no previous repository is added as a Git submodule or runtime dependency.

## Allowed changes

The entire repository is allowed because this is the first bootstrap task. Changes must remain within the accepted repository map and must not add product functionality beyond the service health and package scaffolds.

## Required validation

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run:

```bash
pnpm infra:up
# verify PostgreSQL, Redis, NATS and MinIO are healthy
pnpm infra:down
```

## Acceptance

- clean installation from a fresh checkout;
- committed lockfile;
- all validation commands pass;
- CI uses a frozen lockfile;
- no cross-service implementation imports;
- no direct cross-service database access;
- README, AGENTS, development documentation and ADR are present;
- the next task document is present and remains bounded.

## Non-goals

- Next.js UI implementation;
- authentication;
- database migrations;
- real AI invocation;
- real trademark recommendations;
- external filing, payments or communication sending;
- migration of old repositories.

## Expected pull request title

`MO MVP — repository constitution and monorepo bootstrap`
