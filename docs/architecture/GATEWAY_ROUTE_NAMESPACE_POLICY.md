# Gateway Route Namespace Policy

**Disposition: m-001 = RESOLVED_BY_POLICY.** This is documentation of intentional compatibility debt, not a route migration.

## Legacy compatibility namespace

Existing `/v1/markreg/*` routes remain compatible. The Execution service's `/v1/executions` is an initial fixture/internal execution-envelope route; it is not exposed by the governed Gateway filing workflow.

## Milestone internal fixture API namespaces

New Milestone 1 routes use the owning `/api/markreg/*`, `/api/lite/*`, or `/api/execution/*` namespace. Existing routes receive no silent breaking rename. The mixed prefixes are intentional compatibility debt, not two equivalent naming standards. Future public API versioning requires a separate ADR and task.

## Legacy execution boundary

`POST /v1/executions` does not create a Filing, Filing Submission, official application, official application number, or trademark-office contact. It is not the TASK 012 Filing Execution Task Draft route. Filing Authorization is not Submission, Execution Release is not Execution, and a Filing Execution Task Draft is not a Filed Application.

**Disposition: m-003 = RESOLVED_BY_DOCUMENTATION_AND_BOUNDARY_TEST.** The pre-existing Execution service regression suite asserts its envelope and false authority consequences; deletion is outside TASK 014.

The route inventory makes authentication explicit route by route: `FIXTURE_ONLY_UNAUTHENTICATED`, limited to `NON_PRODUCTION_MILESTONE_RUNTIME`. Production authentication is a non-goal.

**Disposition: m-002 = RESOLVED_BY_EXPLICIT_INVENTORY.**
