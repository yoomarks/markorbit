# M8 External Provider Gate Deferral Note

This note records the Owner decision that real Stripe provider acceptance is temporarily unavailable because no Stripe account exists yet.

The decision does not weaken the M8 completion standard:

- real Stripe test-mode acceptance remains required before M8 can receive final `GO`;
- Stripe readiness may not be claimed from deterministic tests, fake providers, syntactically valid secret prefixes, or skipped sandbox execution;
- `m8Complete`, release authorization and production authority remain false while real-provider evidence is absent.

The decision changes engineering sequencing only:

- the unavailable third-party account is treated as a deferred external dependency;
- unrelated MarkOrbit engineering may continue while the external gate is deferred;
- once a Stripe account exists, the canonical sandbox acceptance and WP07 re-audit must be run before M8 completion status changes.

This note creates no merge, release, deployment, payment, filing or official-truth authority.
