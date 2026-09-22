# Lite Agency production dogfood runbook

Issue: #1169.

This runbook provisions and preflights the existing Agency vertical slice. It does **not** create a new Agency primitive, timeline store, contract, migration, mailbox abstraction, credential flow, or authority boundary.

## Safety locks

- Use a bounded representative real cohort, not historical bulk migration.
- Never paste secret values, message bodies, refresh tokens, API keys, database credentials, or mailbox contents into logs or issue comments.
- Applicant/owner/agent source facts are not Customer Relationship truth.
- Discovered marks are not managed until an explicit existing admission path commits them.
- Conversation/drafts/prepared actions are not mutations until the existing exact structured confirmation path commits them.
- Provider dispatch authorization is separate from mailbox credentials and separate from the human confirmation of the exact client notification.
- No cross-service SQL. Use existing owner HTTP/runtime boundaries and exact receipt/source references.
- If a real run proves a code defect, stop and open one bounded defect instead of expanding this runbook.

## Required runtime composition

1. MarkOrbit PostgreSQL with current owner migrations.
2. Data Engine API + PostgreSQL + ClickHouse, plus its normal worker where current source data requires it.
3. Core on its configured URL (local default `:4101`).
4. Capability Engine with exactly one Microsoft Graph poller/account (local default `:4103`).
5. MarkReg (local default `:4105`).
6. Lite (local default `:4107`).
7. Gateway (local default `:4000`).
8. Optional Lite Web for presentation only.

Execution, Payment, MGSN, a separate Calendar service, and a separate timeline runtime are not required for this acceptance.

## Strict provisioning order

1. **Choose the real tenant boundary.** The Workspace owner selects one authorized PROFESSIONAL account, one real ACTIVE Workspace, and one controlled Outlook mailbox/recipient cohort. Record only safe identifiers.
2. **Provision persistence.** Inject owner database URLs through the approved secret boundary. Apply current forward migrations using the repository migration commands, then run `pnpm db:migrate:status` and `pnpm db:migrate:verify`.
3. **Provision Data Engine.** Require `INTEGRATION_AUTH_MODE=required` and a protected integration API key. The authenticated `/api/v1/health` and `/api/v1/contract` responses must identify `MARKORBIT_DATA_ENGINE_INTEGRATION_V1` / `MARKORBIT_DATA_ENGINE`. Unauthenticated contract access must be rejected.
4. **Build fresh main.** Run `pnpm install --frozen-lockfile` and `pnpm build` from a clean worktree whose `HEAD` equals `origin/main`.
5. **Start Core.** Require a successful `/health` response before onboarding.
6. **Create or select the real Workspace through supported product paths.** Register/login through Gateway, list Workspaces, create one only if needed, and verify its existing context endpoint. Do not seed identity tables directly.
7. **Provision the Outlook Account Binding and start Capability Engine with dispatch disabled.** The runtime must exact-validate the Workspace/account/provider binding, call Graph `/me`, complete the initial Inbox delta sync, and persist its checkpoint before the mailbox is considered ready.
8. **Start MarkReg, Lite and Gateway.** Require successful `/health` responses from each.
9. **Preflight the authenticated Data Engine bridge through Gateway** and resolve the trusted Workspace principal through the existing authenticated endpoint.
10. **Enable provider dispatch only for step 8 of the dogfood.** Restart Capability Engine after separate owner authorization. The exact Prepared Action still requires the existing HUMAN confirmation before send.

## Secrets-safe automated preflight

Run after `git fetch origin main` from the exact fresh-main worktree. Load deployment variables through the approved process/secret manager. On Node 22+, a local ignored env file may be loaded without printing it:

```powershell
node --env-file=.env scripts/lite-agency-dogfood-preflight.mjs
```

Use `--json` for machine-readable output. Use `--strict` only when every prerequisite is expected to be ready; it exits with code 2 when any row is not `READY`.

The script only reports status and non-secret diagnostics. It never prints environment variable values, Workspace IDs, mailbox identifiers, API keys, tokens, message bodies, or database credentials.

Expected statuses:

- `READY`: the script can verify the prerequisite through the existing boundary.
- `MISSING_RUNTIME`: the required process/health/contract boundary is not reachable or does not pass.
- `MISSING_OPERATOR_ACTION`: a human/deployment owner must provision or authorize an existing boundary.
- `UNKNOWN`: the script intentionally cannot infer the condition without authenticated product interaction.

A generic Capability Engine `/health` response is not sufficient if the required Managed Communication binding inputs are absent. A Data Engine contract that succeeds without authentication is not accepted for production dogfood.

## Nine-step acceptance journey

1. Create/import a name-only customer/applicant through Workspace Directory.
2. Discover Data Engine marks for that reviewed subject.
3. Explicitly admit one discovered mark as `MANAGED`.
4. Ingest mixed-source new-filing staging and commit the reviewed Production Intake handoff.
5. Ingest one real Outlook email and explicitly associate it through the existing Communication Link path.
6. Create Work and observe it in Daily Workspace/Calendar projection.
7. Trigger one multi-source trademark refresh/change and inspect freshness/conflict semantics.
8. Prepare one client notification, review the exact draft/recipient/business references, HUMAN-confirm it, then send through the already-authorized bound mailbox.
9. Reopen the read-only Agency lineage projection and verify exact provenance, owner references, work/communication/change evidence and send receipt chain.

## Evidence to retain

For every step, retain only safe identifiers and receipts needed to prove the chain:

- Workspace and owner-record IDs that are safe to log.
- Source/reference fingerprints and currentness/version identifiers.
- Existing Prepared Action / confirmation / send receipt IDs.
- Lineage projection result states: `RESULTS`, `EMPTY`, `UNAVAILABLE`, `NOT_APPLICABLE`.
- Restart/replay evidence where persistence participates.
- Every escape to spreadsheet, direct mailbox use, or manual notes as `ESCAPE_REASON=<bounded reason>`.

Do not store copied mailbox content, credentials, or secret values as dogfood evidence.

## Exit criteria

Close #1169 only after a **real** nine-step journey completes on fresh main with:

- Workspace isolation preserved;
- no synthetic/mock evidence counted as production readiness;
- exact source/receipt references visible at the end;
- partial/unavailable secondary-owner states remaining explicit;
- no authority collapse or cross-service SQL;
- restart/replay evidence for persistent owners;
- step 8 sent only after both provider dispatch authorization and exact human confirmation;
- the final lineage projection proving the real provenance/action chain.

If the preflight is blocked, keep #1169 open and record the smallest missing operator/runtime inputs. Do not replace the real journey with a fixture or topology rehearsal.

## Current owner actions that automation cannot invent

The Workspace/deployment owner must provide or authorize, as applicable:

- one real authorized Workspace/operator account;
- production database/runtime endpoints and approved migration target;
- authenticated Data Engine URL/key with integration auth enforced;
- Azure/Graph tenant consent and securely injected tenant/client/refresh-token material;
- the exact mailbox identity for the durable Account Binding;
- one controlled inbound email and one controlled recipient;
- separate provider-dispatch authorization for dogfood step 8;
- the final product-level HUMAN confirmation of the exact notification.

Once those inputs exist, automation may run the build, health/contract probes, supported onboarding/runtime flows, steps 1–7 and 9, and present step 8 for the required human confirmation.
