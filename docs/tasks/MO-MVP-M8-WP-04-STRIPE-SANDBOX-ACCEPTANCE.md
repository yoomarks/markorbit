# M8 WP04 — Stripe Sandbox Acceptance

This gate is the real-provider evidence required by `MO-MVP-M8-WP-04` before Payment Foundation can be declared complete.

## Provider

- Provider: Stripe PaymentIntents
- API version: `2026-02-25.clover`
- CLI: pinned and checksum-verified by the acceptance workflow
- Mode: Stripe test mode / sandbox only

## Required GitHub secret

Configure `STRIPE_TEST_SECRET_KEY` as a Stripe test-mode server credential. The workflow refuses live-mode credentials. A restricted `rk_test_` key is acceptable only if it has the PaymentIntent, Refund, and event-listener permissions needed by the acceptance path.

Never commit the key or a webhook signing secret. The workflow obtains an ephemeral Stripe CLI webhook signing secret at runtime and masks it.

## Acceptance path

The manual `Payment Stripe Sandbox Acceptance` workflow must complete all of the following against Stripe:

1. create a real test-mode PaymentIntent through `StripePaymentProviderAdapter` using server-derived minor-unit amount/currency, deterministic idempotency, and MarkOrbit correlation metadata;
2. confirm the PaymentIntent with Stripe's test PaymentMethod `pm_card_visa`;
3. receive a real `payment_intent.succeeded` event through Stripe CLI forwarding;
4. verify the forwarded event from the exact raw request bytes and `Stripe-Signature` before normalizing it to `PAYMENT_SUCCEEDED`;
5. retrieve the PaymentIntent through the provider adapter and confirm reconciliation truth;
6. create a full test-mode refund through the provider adapter;
7. receive and verify the corresponding Stripe refund event and normalize it to `REFUND_SUCCEEDED`;
8. retrieve the refund from Stripe and confirm the amount/currency/status;
9. retain a redacted JSON evidence artifact plus a redacted Stripe CLI listener log.

The test charge is fully refunded during the same acceptance run.

## Evidence rule

A skipped test, deterministic fake provider, mocked fetch, missing secret, invalid secret, listener startup failure, webhook timeout, signature failure, provider mismatch, or failed refund does **not** satisfy this gate.

WP04 may only be marked complete after a successful real Stripe sandbox run has an uploaded `stripe-sandbox-acceptance-*` artifact. Until then the task remains explicitly incomplete even if ordinary hosted CI is green.
