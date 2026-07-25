# Engineering Baseline Audit — MO-MVP-TASK-001

## Defects corrected from the prepared bootstrap

1. Service modules started network listeners during import. Entry points are now split into an import-safe library module and an explicit `main.ts` process entry.
2. Shared-package exports pointed to TypeScript source files, which would fail when built services ran under Node. Exports now target `dist` JavaScript and declarations.
3. The initial contracts had compile-time unions but no runtime boundary validation. Controlled values now have explicit parse and type-guard functions.
4. Runtime tests checked only manifest values. Tests now cover start, idempotent stop, the health response and governed 404 behavior.
5. The repository lacked an executable cross-workspace ownership check. `scripts/validate-workspace.mjs` now verifies required workspaces and prohibits service-to-service implementation dependencies.
6. Docker Compose lacked health checks for NATS and MinIO. These are now included.
7. CI initially allowed an unfrozen install. The final switch to `--frozen-lockfile` is blocked until a real `pnpm-lock.yaml` can be generated in a network-enabled environment; no lockfile has been fabricated.

## Remaining environment limitation

The build environment used for this audit cannot resolve the npm registry. Dependency installation, lockfile generation and the dependency-based quality suite therefore require the first network-enabled checkout. Static JSON, workspace, ownership and configuration validation has been run locally.
