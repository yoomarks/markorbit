# MARKREG-RECOMMENDED-ACTION-RUNNABLE-PREVIEW

## Task shape

- Repository and allowed directories: `apps/markreg-web`, `docs/ui`.
- Objective: give an authenticated customer a clear, usable view of the current governed lifecycle and Recommended Action for one Formal Matter.
- User-visible outcome: the customer can understand guidance, inspect timing basis and lifecycle context, and acknowledge or dismiss only the advisory state.
- Canonical sources: Books 01–07, Capability Canon, `MO-MVP-M5-WP-04-RECOMMENDED-ACTIONS`, `MO-MVP-M5-WP-06-AUTHENTICATED-LIFECYCLE-SURFACES`, and `EVIDENCE-REVIEW-LIFECYCLE-AUTHORITY-BOUNDARY`.
- Contracts consumed: `CustomerLifecycleSurface`, `CustomerRecommendedAction`, and the existing acknowledge/dismiss HTTP client. No contract changes.
- Expected PR title: `feat(markreg): add runnable Recommended Action preview`.

## User and job

The user is an authenticated customer with access to a Formal Matter. Their job is to understand what the governed MarkReg lifecycle currently recommends and record whether they have acknowledged or dismissed that advice, without mistaking it for official-office truth or granting external execution authority.

## Information architecture

1. Authenticated customer relationship and Matter identity.
2. Explicit authority boundary.
3. Recommended Action, status, explanation, timing basis, exact version and advisory controls.
4. Current Lifecycle View.
5. Collapsed lifecycle history.
6. Exact Matter reference and return path.

Desktop uses a persistent relationship-aware sidebar and a two-column guidance area. At 900px and below the recommendation precedes lifecycle context in one column. At 560px controls become full-width and all long identifiers wrap without horizontal overflow.

## States and transitions

- Loading: labelled progress only; no empty or action state is inferred.
- Open: acknowledge/dismiss are enabled only with manage authority.
- Acknowledged or dismissed: status is visible and transition controls are removed.
- No action: explicitly states that no customer action is currently recommended.
- Empty: distinguishes no lifecycle record from policy-owned no-action.
- Read only: guidance remains visible; transition controls are disabled.
- Partial: current recommendation remains visible while missing history is disclosed.
- Unauthorized: access-required state, not empty.
- Unavailable: owner-unavailable state, not empty.
- Stale version or mutation error: fails closed, preserves the current recommendation for review and confirms that no external action occurred.

`OPEN → ACKNOWLEDGED` and `OPEN → DISMISSED` pass the exact recommendation version. There is no UI transition to filing, payment, provider contact, office contact, completion, legal appointment or Official Truth. `executionAuthorized` remains false.

## Accessibility and evidence

- Skip link, labelled navigation and main landmark.
- Native headings, buttons, disclosure widgets and live regions.
- Visible focus behavior from shared primitives; reduced-motion media rule.
- Status is expressed in text, never by color alone.
- Storybook fixtures cover open, acknowledged, dismissed, no-action, empty, read-only, partial, unauthorized, unavailable and mobile.
- Playwright covers the advisory boundary, exact-version transitions, distinct passive states, stale conflict, read-only behavior and 390px order/overflow.

## Events

The browser consumes the current customer-safe lifecycle surface. It may request acknowledge or dismiss with the exact action ID/version and stable idempotency key. It emits no filing, payment, provider, office, completion or canon mutation event.

## Validation

```text
pnpm --filter @markorbit/markreg-web lint
pnpm --filter @markorbit/markreg-web typecheck
pnpm --filter @markorbit/markreg-web test
pnpm --filter @markorbit/markreg-web build
pnpm exec playwright test -c apps/markreg-web/playwright.recommended-action-preview.config.ts
pnpm task:prepush
```

## Non-goals

- Creating or regenerating Recommended Actions in the browser.
- Inferring deadlines, urgency or official-office status.
- Executing protected external actions.
- Changing MarkReg, Gateway or persistence contracts.
- Redesigning the wider customer portal.
