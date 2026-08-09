# M4-WP-07 — Authenticated Gateway and controlled provider journey

## Task ID

`MO-MVP-M4-WP-07`

## Repository and allowed directories

- `apps/gateway/src`, `apps/gateway/tests`
- `services/mgsn/src`, `services/mgsn/tests`
- `docs/tasks`, `docs/planning`

No UI files are changed by this work package. The repository-required `ui-design` skill is therefore not invoked by WP-07.

## Objective and user-visible outcome

Expose the already-governed MGSN provider-execution lifecycle through one authenticated browser Gateway boundary so an authorized operations Workspace can inspect/control MGSN records and an authenticated Provider Workspace can accept an Allocation and submit a Provider Return without supplying its own provider identity.

## Canonical sources

- `AGENTS.md`
- `packages/contracts/src/auth.ts`
- `packages/contracts/src/identity.ts`
- `packages/contracts/src/provider-execution.ts`
- M4 WP-03 through WP-06 implementation evidence and authority boundaries

## Contracts consumed or changed

WP-07 consumes existing `WorkspacePrincipal`, Provider Execution commands and exact-version references. It does not create a second provider API contract and does not change Provider Return, Allocation, Evidence Handoff or authority semantics.

## Required behavior

1. Browser access requires a valid Core-backed session before any MGSN route is forwarded.
2. Operations reads require `execution:read`; mutations require `execution:manage`.
3. Browser mutations require a trusted Origin and session-bound CSRF token.
4. Gateway forwards only a trusted internal Workspace Principal to MGSN.
5. MGSN independently validates internal service authorization and the forwarded Principal.
6. Operations Workspace and target Workspace remain exact and fail closed on mismatch.
7. Provider routes use the dedicated `x-markorbit-provider-workspace-id` browser context. The customer/target `workspaceId` remains distinct.
8. Provider identity is derived from the authenticated Provider Workspace Principal. `providerId` and `providerWorkspaceId` are forbidden in provider mutation payloads at the Gateway.
9. MGSN injects `actorId` and `providerWorkspaceId` from the trusted Principal when recording Provider Acceptance or Provider Return.
10. Mutations require `Idempotency-Key`; an optional body key must match the header.
11. Cross-provider reads return not-found rather than exposing another Provider Workspace's Allocation or Provider Return.
12. Gateway and MGSN HTTP transport create no Payment, Invoice, legal/professional appointment, filing submission, Official Truth, Formal Matter completion or user Capability verification.

## State transitions

WP-07 introduces no new business state. It only exposes explicit commands already owned by WP-03 through WP-06:

`Service Package -> Eligibility -> Allocation -> Provider Acceptance -> Provider Return -> Evidence Handoff`

Every transition remains owned and validated by its existing domain service.

## UI states

None. WP-07 intentionally makes no UI change. A later UI work package must load the repository `ui-design` skill and provide the required Storybook/Playwright visual states before changing operations-console or provider-facing UI.

## Events emitted and consumed

None added. HTTP transport preserves the existing command/correlation lineage and does not manufacture new event truth.

## Acceptance tests

- MGSN rejects an untrusted internal caller.
- MGSN requires `execution:manage` for mutation and fails closed on Workspace mismatch.
- MGSN binds mutation idempotency to `Idempotency-Key`.
- Provider Acceptance receives authenticated Provider Workspace identity from Principal context.
- A Provider Workspace cannot read another Provider's Allocation.
- Gateway rejects unauthenticated provider reads.
- Gateway requires trusted Origin + CSRF for mutations.
- Gateway denies read-only principals on provider mutations.
- Gateway rejects caller-supplied provider identity before forwarding.
- Gateway-to-MGSN vertical slice proves Provider Acceptance and Provider Return receive the authenticated Provider Workspace identity and header-bound idempotency key.

## Validation commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

## Non-goals

- No operations-console/provider UI.
- No automatic provider selection or Allocation by AI.
- No new Provider Registry, Eligibility, Allocation, Return or Evidence Handoff persistence semantics.
- No cross-service SQL.
- No Payment/Invoice workflow.
- No legal/professional appointment.
- No external filing or trademark-office contact.
- No promotion of Provider Return to Official Truth or Capability evidence.

## Expected PR title

`M4 WP-07 — Authenticated Gateway and controlled provider journey`
