# MO MVP M8-WP-07 — Independent Commercial Readiness Audit

- **Work package:** `M8-WP-07`
- **Milestone:** `M8 — MVP Commercial Foundation`
- **Audited candidate:** `6f4596a5172bd75702131361c85f90ddca0eac52`
- **Candidate fingerprint:** `sha256:381b2e11355d51667536774eda575ae1a28ae9c52c164531cc9bfc973c6d21a9`
- **WP06 PR:** `#110`
- **Status:** `AUDITING`

## Objective

Independently audit the exact M8-WP-06 commercial-runtime candidate against the M8 scope lock, permanent owner/authority boundaries, hosted candidate evidence, machine-readable known limits, real-provider acceptance and mainline identity.

The required commercial path remains:

`Register -> Login -> Account classification -> Workspace/Role -> Product/Price -> Quote -> Order -> Checkout -> Payment -> Matter -> Admin operations -> Customer status`

The audit may return `GO` or `FIX`.

`GO` means only that the audited commercial candidate has satisfied the M8 completion evidence and is eligible for explicit Owner merge/release consideration. It does not merge, release, deploy production traffic, submit a Filing or create Official Truth.

## Independence rule

WP07 does not silently create a replacement candidate. It audits the exact WP06 head and downloaded WP06 evidence artifact, then independently re-runs repository boundary checks and full workspace `pnpm check` on the audit branch.

The audit also queries GitHub at runtime for:

- PR #110 merge state and merge commit identity;
- the exact candidate's required hosted workflow runs;
- successful `Payment Stripe Sandbox Acceptance` workflow-dispatch evidence on `main`;
- the retained Stripe sandbox evidence artifact when such a successful run exists.

## Current expected blockers

At creation time:

- WP05 / #109 is merged into `main`;
- WP06 / #110 is green but not merged;
- there is no successful `workflow_dispatch` record for the Stripe real-provider acceptance workflow.

Therefore the first independent audit is expected to return `FIX`, while the audit workflow itself should still pass if it correctly identifies those blockers.

## Required audit checks

1. exact WP06 candidate SHA and candidate/config fingerprint match the retained WP06 artifact;
2. required candidate workflow runs are completed successfully on the exact candidate;
3. all WP06 known limits remain explicit;
4. M8 scope and owner-authority distinctions remain intact;
5. audit-only changes stay inside the bounded WP07 workflow/script/audit/task paths;
6. repository workspace, persistence-boundary, gateway-inventory and full `pnpm check` pass;
7. PR #110 must be merged before final `GO`, and the merged tree must match the audited candidate tree;
8. a successful Stripe test-mode workflow-dispatch run on `main` must exist;
9. its retained `stripe-sandbox-acceptance.json` must prove Stripe test mode, successful payment, successful refund, USD minor-unit amount and non-live provider mode;
10. audit result must keep merge/release/production authority false.

## Permanent authority locks

```text
Independent Audit GO != Owner Merge Authorization
Independent Audit GO != Owner Release Authorization
Green CI != M8 complete
Deterministic Stripe tests != real-provider acceptance
Order != Payment
Payment succeeded != Filing submitted
Payment succeeded != Matter completed
Commercial Admin != owner database
Deployment/Rehearsal != Production Deployment
```

## Exit gate

WP07 is complete when its hosted independent-audit workflow produces a retained machine-readable audit artifact for the exact candidate.

M8 receives a final `GO` recommendation only when the audit finds no blockers. A `FIX` result is a valid completed audit result and must remain `FIX` until the missing evidence is actually supplied and the audit is re-run.

No WP07 result auto-merges or auto-releases anything.
