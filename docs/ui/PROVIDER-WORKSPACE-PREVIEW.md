# Provider Workspace runnable preview

## Task shape

- **Task ID:** `PROVIDER-WORKSPACE-RUNNABLE-PREVIEW`
- **Repository / allowed directories:** `apps/provider-web`, `docs/ui`
- **Objective:** connect the governed Provider execution lifecycle to the new MarkOrbit workspace visual system so an authenticated Provider Workspace can understand and perform its next allowed action.
- **Expected PR title:** `feat(provider): add runnable Provider Workspace preview`

## User and job to be done

The user is a member of one Provider Workspace. They need to review their own owner-backed Allocation, explicitly accept or decline it, then record a Provider Return or exact-version correction without gaining customer-contact, filing, payment, appointment or Official Truth authority.

## Canonical sources and ownership

- `packages/contracts/src/provider-execution.ts`
- `packages/contracts/src/provider-work-read-model.ts`
- `docs/tasks/MO-MVP-M4-WP-05-ALLOCATION-PROVIDER-ACCEPTANCE.md`
- `docs/tasks/MO-MVP-M4-WP-06-PROVIDER-RETURN-EVIDENCE-HANDOFF.md`
- MGSN owns Allocation, Provider Acceptance and Provider Return truth.
- Gateway + Core establish current browser session, Workspace membership and action permission.

No contract changes are made. The preview consumes the existing Provider work model and action-console renderer.

## Information architecture

1. Provider Workspace identity and governed-boundary context.
2. Queue summary: response required, Return required, Return recorded and Workspace scope.
3. Private owner-backed work queue.
4. Exact selected Allocation state and next permitted action.
5. Minimum safe context, submitted claim history and technical provenance.

Desktop uses persistent navigation and a queue/detail split. At 820px the queue and detail stack; at 560px metrics, actions and provenance become single-column without hiding authority state.

## State transitions

```text
ACTIVE Allocation + known response absence
→ explicit ACCEPTED or DECLINED response

ACCEPTED + known Return absence
→ Provider Return v1 (claim/evidence only)

CURRENT Provider Return vN
→ correction vN+1 with additive supersession lineage
```

Decline never allocates another Provider. Queue visibility and incoming-data authority never authorize a mutation or protected action.

## UI states

Fixture-backed states cover loading, successful empty, unauthenticated, source unavailable, missing action lineage/partial data, read-without-write permission, exact-version conflict, response success, Return success, correction-ready and terminal/superseded Allocation. Errors use visible status or alert semantics and never convert an unavailable source into empty truth.

## Accessibility

- Semantic header, navigation, main, queue list, headings, labels and live status.
- Keyboard-visible focus inherited by all controls.
- Button names describe the action; selected queue item exposes `aria-pressed`.
- Status is never represented by colour alone.
- Reduced-motion preference disables the loading pulse.
- The 390px acceptance path verifies no horizontal overflow and preserves queue-before-detail reading order.

## Events and authority consequences

The production action console continues to emit existing governed Gateway commands for Provider response and Provider Return. The deterministic preview simulates their owner-backed results locally and emits no network event. It cannot create Provider selection, Allocation, engagement, appointment, protected-action release, external contact, filing, payment, matter completion or Official Truth.

## Acceptance and validation

- Storybook: existing Action Console fixture states plus `Provider Web/Workspace Preview/Governed Work Queue`.
- Playwright: accept → Return, decline terminal, passive/partial states, permission/conflict, and mobile order/overflow.
- Package unit tests, lint/typecheck, build and provider Storybook build.

Validation commands:

```bash
pnpm --filter @markorbit/provider-web test
pnpm --filter @markorbit/provider-web lint
pnpm --filter @markorbit/provider-web typecheck
pnpm --filter @markorbit/provider-web build
pnpm exec playwright test --config apps/provider-web/playwright.provider-workspace-preview.config.ts
pnpm build:provider-storybook
pnpm test:provider-storybook-index
```

## Non-goals

- No provider discovery, ranking, marketplace or bidding.
- No customer relationship or private CRM exposure.
- No legal/professional appointment.
- No external office contact or filing submission.
- No Payment, Invoice, Formal Matter completion or Official Truth.
- No service, Gateway, persistence or shared-contract changes.
