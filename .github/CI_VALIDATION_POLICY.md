# CI Validation Policy

This repository uses one affected-scope map and three validation levels. The purpose is to reduce duplicate work without reducing authority, persistence, security, or durability evidence.

## L1 — Fast PR Gate

L1 answers: **is the changed code locally well-formed and internally valid?**

For ordinary pull requests it runs:

- formatting only for changed files;
- affected workspace lint, typecheck, and unit tests;
- CI scope-map tests and lightweight repository boundary validators when CI/shared governance is affected.

L1 must provide an early useful result. It must not make an owner-local PR fail because an unrelated file elsewhere in the repository is misformatted.

Repository-wide formatting remains an L3 responsibility.

## L2 — Exact-head Merge Gate

L2 answers: **does the exact PR head satisfy every directly affected semantic boundary?**

Depending on the authoritative scope map, L2 selects only the required lanes:

- owner integration and HTTP/boundary tests;
- PostgreSQL durability suites;
- Product Loop producer/consumer edges;
- browser real-runtime suites;
- cross-lane contract or handoff tests.

PostgreSQL and browser jobs are not started for a PR when their dependency scope is not selected. MGSN persistence changes continue to run every convention-discovered `*postgres*.test.ts` suite in an isolated Vitest process.

Specialist workflows own semantic evidence. They must not repeat repository-wide formatting or general lint/typecheck already proved by L1.

## L3 — Full Regression

L3 answers: **is the broader repository still healthy under a high-risk or full-regression change?**

L3 runs on every `main` push and for pull requests that change shared/high-risk surfaces, including:

- shared packages and contracts;
- migrations, schemas, persistence foundations;
- root workspace/dependency/compiler topology;
- CI governance;
- auth, tenant, CSRF, principal, authority, Official Truth, Filing, Payment, Provider, Method activation, and Capability authority surfaces;
- ambiguous or previously unknown paths.

L3 includes repository-wide formatting and full workspace regression. Scheduled specialist reliability workflows remain visible as separate L3 evidence where they own broader durability or browser matrices.

## Fail-closed scope resolution

`scripts/ci-detect-scope.mjs` is the single scope authority for the central merge gate. Unknown or ambiguous root/shared/migration/security paths broaden coverage. A path must never silently disappear from validation merely because it is new.

Scope-map changes are themselves CI-governance changes and therefore require L3.

## Exact-head merge readiness

The central `merge-readiness` job aggregates the L1/L2 selected results for the exact pull-request head and emits a machine-readable summary into the GitHub step summary.

- A selected required gate that is missing, cancelled, or failed makes merge readiness fail closed.
- An unselected PostgreSQL/browser/L3 job may be skipped and is reported as skipped, not as having run.
- L3 is required for shared/high-risk pull requests and is separate from normal owner-local merge readiness.

This aggregation does not replace exact-head freshness checks before merge.

## Lane-owner expectations

- **Ordinary owner-local code:** expect changed-scope formatting plus affected lint/typecheck/unit tests at L1 and only directly affected semantic suites at L2.
- **Gateway route code:** expect Gateway/boundary validation; Product Loop or PostgreSQL suites are added only when the route maps to those dependency edges.
- **UI-only code:** expect affected UI validation and relevant browser scope; unrelated PostgreSQL lanes are not started.
- **MGSN durable persistence:** expect the full MGSN PostgreSQL durability convention suite.
- **Shared contracts, migration/schema, auth/security/authority, root CI/compiler/workspace:** expect conservative Hard Gate coverage and L3.

Performance objectives for ordinary owner-local pull requests are a useful first result in roughly 3–8 minutes and a trustworthy merge-ready result typically within 15–20 minutes. These are engineering targets, never reasons to skip correctness evidence.
