# MO-MVP-TASK-013 — Real Runtime Golden Path

## Purpose and audit remediation

This task supplies the Node 22 remote-validation definition and a deterministic runtime harness requested by audit blockers B-001 and B-002. The original audit remains an historical FAIL: B-001 is not resolved until the remote job is green, and B-002 is not resolved until the complete desktop and mobile journey passes without interception.

The user is a Milestone reviewer whose job is to verify governed handoffs across real HTTP boundaries without confusing preparation with authority or submission.

## Topology and health

| Runtime           | Port | Health/readiness |
| ----------------- | ---: | ---------------- |
| Gateway           | 4300 | `GET /health`    |
| Capability Engine | 4302 | `GET /health`    |
| Execution         | 4304 | `GET /health`    |
| MarkReg           | 4305 | `GET /health`    |
| Lite Web          | 4371 | `GET /`          |
| MarkReg Web       | 4372 | `GET /`          |

The harness supplies `MARKREG_URL` and `EXECUTION_URL` to Gateway and supplies `VITE_MARKREG_GATEWAY_URL` / `VITE_LITE_GATEWAY_URL` to the Web runtimes. It starts downstream services before Gateway, waits on every explicit readiness URL, rejects occupied ports and early child exits, and handles SIGINT/SIGTERM. Per-process logs are retained under ignored `.artifacts/milestone-runtime/` for diagnostics.

## Scenario and lineage

The logical journey uses `milestone-001-desktop` and `milestone-001-mobile` namespaces. Server repositories begin clean on each harness start; there is no test bootstrap or production reset endpoint. `MilestoneLineageRecorder` records Customer, Opportunity, Plan, Quote, Customer Confirmation, Matter Draft, Professional Review Case and decision, Document Package, Instruction Ledger, Preparation Lock, Filing Authorization, Execution Release, and Filing Execution Task Draft identities and versions.

No fixture bootstrap endpoint is exposed. Fixture semantics remain incapable of external filing. The desktop browser path completes the full chain through real Gateway-backed applications. The 390px path currently reaches Filing Authorization but still exposes a normal-click overlap defect in the acknowledgement list, so B-002 remains open until that path is green.

## Commands and CI

- `pnpm test:runtime` runs orchestration failure, readiness, startup, and graceful-shutdown checks.
- `pnpm test:e2e` keeps the focused browser suite unchanged.
- `pnpm test:e2e:real-runtime` selects only the desktop and 390px real-runtime project.
- `pnpm test:visual` runs established visual-tagged cases.

The **Milestone Real Runtime Validation** job uses Node 22, pnpm 10.28.1, a frozen lockfile, Chromium system dependencies, workspace validation, typecheck, runtime tests, real-runtime E2E, and then visual tests. Logs and Playwright diagnostics upload only on failure.

## Authority restrictions and non-goals

The harness adds no Order, Payment, Invoice, formal Matter, appointment, provider assignment, Filing, Filing Submission, official application or number, message, dispatch, or office contact. It does not add production persistence, authentication, deployment redesign, government integration, or a test-reset endpoint. A Filing Execution Task Draft, once covered end-to-end, must remain `PREPARED`; `FILED`, `SUBMITTED`, `OFFICE_ACCEPTED`, and `REGISTERED` are prohibited.
