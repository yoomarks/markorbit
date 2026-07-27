# MO-MVP-TASK-004 — markreg.com Guided Intake and Recommendation UI

## Scope and outcome

This task connects markreg.com's anonymous guided consultation to the Task 002 HTTP path. The user is an enterprise, brand owner, founder, or ordinary applicant whose job is to translate an international protection goal into a cautious next planning choice. The implemented information architecture is Consultation Start → Applicant → Trademark → Markets → Goods / Services → Filing Goal → Review → Loading → A/B/C Recommendation → Select Plan. Desktop uses a spacious form and three-column comparison; mobile stacks fields, review controls, and recommendation cards.

## Contract and API boundary

The web client imports `IntakeCreateCommand` and `IntakeRecommendationResponse` from `packages/contracts`; it does not create a competing transport contract. It posts to the publicly configured `VITE_MARKREG_GATEWAY_URL` at Gateway `POST /v1/markreg/intakes`. Only `Content-Type`, `Idempotency-Key`, and `X-Correlation-ID` are sent. Applicant detail fields needed only for this guided experience are translated into the existing Customer Intent boundary. No secret or internal service topology is exposed, and trace data remains diagnostic rather than customer-facing.

## State machine and idempotency

The product states are Initial, Editing, Reviewing, Submitting, Ready, Recoverable Error, Blocking Error, and Offline. Submitting coalesces clicks in the UI. A fingerprint binds one generated idempotency key and correlation ID to one payload. Retry retains both; changing an answer invalidates them and creates fresh identifiers at the next submission. Draft and successful response recovery use `sessionStorage`; applicant data is never written to `localStorage`.

## Errors, fixture integrity, and accessibility

Network failure, timeout, offline status, retryable SafeError, and 502 retain answers and allow retry. A 400 or 422 directs the user to correct information; a 409 explains the idempotency conflict; an unknown unsafe failure blocks continuation. Raw exceptions, URLs, stacks, and internal service names are never displayed. Every surface retains the prominent FixtureBanner, the response must remain `FIXTURE_ONLY`, and copy disclaims legal advice, official review, filing, and formal recommendation.

The stepper exposes `aria-current`; every field has a label and associated error; validation focuses the first invalid field; submission errors are live; and recommendation buttons use `aria-pressed` for keyboard-operable selection. Recommended, selected, fixture, and error meaning is textual as well as visual. Fixture-backed Storybook includes full-width and small-screen states. The acceptance path is start → complete each focused step → edit from review → submit → read assumptions and limitations → choose A/B/C by keyboard.

## Known limitations and non-goals

The richer guided fields are encoded into the existing Task 002 customer-intent description until a governed contract revision admits them. The deterministic recommendation remains fixture data, not jurisdiction analysis. Account, authentication, payment, quote, documents, uploads, orders, professional review, filing, fulfillment, customer portal, durable recovery, and automatic formal-state or Capability mutation are excluded.

## Next task recommendation

Add the governed quote boundary and explicit plan confirmation only after the intake contract has a reviewed evolution path and the recommendation can distinguish evidence-backed professional review from fixture output.

## Final acceptance audit

Final acceptance ran with Node.js `v22.22.2` and pnpm `10.28.1`. A frozen install, format/write and format check, workspace lint, typecheck, test, and build, the UI package build and Storybook static build, the markreg-web production build, the Gateway integration suite, the aggregate `pnpm -w check`, and `git diff --check` all completed successfully. The workspace test run contains 59 passing tests; markreg-web contributes 14 and the Gateway suite contributes 10. The real-client HTTP test starts Gateway, MarkReg, Capability Engine, and Execution on dynamic ports, verifies the correlated A/B/C `FIXTURE_ONLY` response, and the shared `afterEach` shuts every runtime down. A post-test process/listener audit found no residual product runtime or known development port.

The three former web-app `tests/manifest.test.ts` files were removed by Task 003, before this task. They imported the deleted bootstrap `productManifest` module and therefore are no longer valid tests to restore. Their UI-skill flag assertion is superseded by the repository `AGENTS.md` rule, the Task 003 UI foundation documentation, shared UI behavior/axe tests, fixture-backed Storybook builds, and—for markreg-web—the journey, accessibility, fixture-integrity, session-storage, idempotency, and safe-error tests added here. Task 004 does not remove any Task 003 test.

Automated browser tooling and a browser executable are not available in this container, so screenshot evidence could not be produced. **Manual visual review pending:** desktop 1440px and mobile 390px review of Consultation Start, a middle intake step, Review, Loading, A/B/C Recommendation, Recoverable Error, and Blocking Error must be completed before the Draft PR is marked ready. Storybook and production builds prove compilation only and are not represented as completed visual acceptance.
