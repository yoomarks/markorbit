# MO MVP M8-WP-07 — Independent Commercial Readiness Audit

- **Work package:** `M8-WP-07`
- **Milestone:** `M8 — MVP Commercial Foundation`
- **Audited candidate:** `6f4596a5172bd75702131361c85f90ddca0eac52`
- **Candidate fingerprint:** `sha256:381b2e11355d51667536774eda575ae1a28ae9c52c164531cc9bfc973c6d21a9`
- **WP06 PR:** `#110`
- **WP06 main merge:** `4695e2c3de54abd7f73438a91425621646b4c318`
- **Status:** `AUDIT_IMPLEMENTED_EXTERNAL_GATE_DEFERRED_ENGINEERING_CONTINUATION_ALLOWED`

## Objective

Independently audit the exact M8-WP-06 commercial-runtime candidate against the M8 scope lock, permanent owner/authority boundaries, hosted candidate evidence, machine-readable known limits, real-provider acceptance and mainline identity.

The required commercial path remains:

`Register -> Login -> Account classification -> Workspace/Role -> Product/Price -> Quote -> Order -> Checkout -> Payment -> Matter -> Admin operations -> Customer status`

The audit may return `GO` or `FIX`.

`GO` means only that the audited commercial candidate has satisfied the M8 completion evidence and is eligible for explicit Owner release consideration. It does not release, deploy production traffic, submit a Filing or create Official Truth.

## Independence rule

WP07 does not silently create a replacement candidate. It audits the exact WP06 head and downloaded WP06 evidence artifact, then independently re-runs repository boundary checks and full workspace `pnpm check` on the audit head.

The audit also queries GitHub at runtime for:

- PR #110 merge state and merge commit identity;
- the exact candidate's required hosted workflow runs;
- successful `Payment Stripe Sandbox Acceptance` workflow-dispatch evidence on `main`;
- the retained Stripe sandbox evidence artifact when such a successful run exists.

Post-candidate repository changes remain fail-closed. Audit implementation files may change inside the bounded WP07 paths. Any other post-candidate maintenance must be explicitly pinned in the machine-readable audit contract by commit SHA, sole changed path and exact Git blob SHA; the pinned commit must be an ancestor of the audited HEAD and the HEAD blob must still match. Unpinned changes remain an audit failure.

## Current verified state

- WP05 / #109 is merged into `main`;
- WP06 / #110 is merged into `main` as `4695e2c3de54abd7f73438a91425621646b4c318`;
- the WP06 merge tree matches the audited WP06 candidate tree by construction of the clean main-relative merge;
- WP07 / #111 is merged into `main`;
- post-WP07 repair #113 is merged as `20fbf41cad472b862fd247c77f8e76fc6904bf79`; it changed only `scripts/milestone3-reliability-command.test.mjs`, restoring the hosted Milestone 3 trigger assertion without changing commercial runtime or authority behavior;
- that repair is pinned by commit and exact blob identity so future M8 re-audits remain repeatable without weakening the out-of-scope change gate;
- the canonical `Payment Stripe Sandbox Acceptance` workflow has been dispatched on `main` multiple times;
- latest observed run `32072472856` passed the syntactic test-mode credential guard and Stripe CLI installation, then failed at `Resolve ephemeral webhook signing secret`; no real payment/refund acceptance evidence was produced;
- the Owner has confirmed there is currently no Stripe account and therefore cannot supply a real Stripe test-mode secret for provider acceptance;
- deterministic Payment implementation remains complete, while real Stripe provider verification is intentionally deferred as an external dependency.

Until a real Stripe account/test-mode credential exists and the canonical workflow succeeds with retained provider evidence, the independent audit must continue to return `FIX` and `m8Complete` must remain false.

## Deferred external gate and engineering continuation

The deferred Stripe gate is now explicit policy rather than an ambiguous engineering blocker:

- `STRIPE_REAL_PROVIDER_ACCEPTANCE_DEFERRED` means the real external provider path has not been verified;
- the deferral **does block M8 completion / Stripe-ready claims**;
- the deferral **does not block subsequent MarkOrbit engineering work** that does not depend on claiming real Stripe readiness;
- deterministic tests, fake providers, a syntactically valid secret prefix, or skipped sandbox execution never count as real-provider verification;
- when a Stripe account becomes available, configure a genuine test-mode credential, run the canonical sandbox acceptance, retain its evidence, and re-run WP07 before changing M8 completion status.

This separation prevents an unavailable third-party account from freezing unrelated product development without weakening the provider-verification standard.

## Required audit checks

1. exact WP06 candidate SHA and candidate/config fingerprint match the retained WP06 artifact;
2. required candidate workflow runs are completed successfully on the exact candidate;
3. all WP06 known limits remain explicit;
4. M8 scope and owner-authority distinctions remain intact;
5. audit-only changes stay inside the bounded WP07 workflow/script/audit/task paths, while any non-audit post-candidate maintenance must match its pinned commit, sole path and exact blob identity;
6. repository workspace, persistence-boundary, gateway-inventory and full `pnpm check` pass;
7. PR #110 must be merged before final `GO`, and the merged tree must match the audited candidate tree;
8. a successful Stripe test-mode workflow-dispatch run on `main` must exist before M8 completion;
9. its retained `stripe-sandbox-acceptance.json` must prove Stripe test mode, successful payment, successful refund, USD minor-unit amount and non-live provider mode;
10. audit result must keep release/production authority false.

For squash-merged WP06, WP07 compares the audited candidate tree directly with the WP06 merge tree for commercial-candidate identity. Re-audits may run after bounded repository maintenance, but no later change is silently accepted: every non-WP07 path in the candidate-to-HEAD diff must be explicitly pinned and identity-verified.

## Permanent authority locks

```text
Independent Audit GO != Owner Release Authorization
Green CI != M8 complete
Engineering continuation != M8 completion
Deferred Stripe verification != Stripe-ready
Deterministic Stripe tests != real-provider acceptance
Order != Payment
Payment succeeded != Filing submitted
Payment succeeded != Matter completed
Commercial Admin != owner database
Deployment/Rehearsal != Production Deployment
```

## Exit gate

WP07 audit implementation is complete when its hosted independent-audit workflow produces a retained machine-readable audit artifact for the exact candidate.

M8 receives a final `GO` recommendation only when the audit finds no blockers. A `FIX` result is a valid completed audit result and remains the M8 completion result while real Stripe evidence is absent. The explicit external-gate deferral permits unrelated engineering progression; it does not convert `FIX` into `GO` and does not make Stripe verified.

No WP07 result auto-releases or deploys production traffic.
