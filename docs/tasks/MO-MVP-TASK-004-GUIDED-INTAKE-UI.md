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
