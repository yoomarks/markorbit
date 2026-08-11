# PLC-WP-06 — Feedback and Product-loop observability

- **Stage:** `MO-MVP-PRODUCT-LOOP-CLOSURE`
- **Work package:** `PLC-WP-06`
- **Status:** `IMPLEMENTING`
- **Base:** current `main` after PLC-WP-05 and DEI-WP-01
- **Owning Product:** Lite

## Objective

Close the minimum feedback edge of the Lite Product mainline without creating Milestone 6 learning infrastructure or a generic event/analytics platform.

```text
Today
-> Recommendation
-> Prepared Action
-> User Confirmation
-> Product / Workflow Handoff
-> Product/work outcome evidence
-> Today reflects the result
```

PLC-WP-06 records only evidence that already belongs to the concrete Product loop. It does not convert that evidence into verified Capability, shared Canon, public ranking, autonomous action or Official Truth.

## Bounded runtime addition

The new durable mutation is one manual, after-the-fact `ProductLoopUseFeedback` record for an exact Lite `PublishPackage`.

The record captures:

- exact Workspace;
- exact PublishPackage id/version/fingerprint;
- user-reported outcome: published, delivered, used or not used;
- optional external reference supplied by the user;
- authoritative Core `WorkspacePrincipal.userId` as recorder;
- durable timestamp and idempotency evidence.

The persisted record keeps the existing constitutional statements:

```text
PublishPackage != Published
User-reported external use != MarkOrbit-executed external action
User-reported external use != independently verified external outcome
Product/work evidence != Capability verification
```

## Reuse rather than duplication

WP-03 through WP-05 already persist the other observable Product-loop facts:

- Opportunity Candidate creation;
- Qualification Decision including qualified/rejected/deferred;
- MarkReg Formal Opportunity creation;
- Prepared Action confirmation;
- owner handoff result.

WP-06 does not copy those facts into a second generic event store. They remain observable from their owning records.

A manual content-use feedback record can be resolved as the already-frozen Product-loop source kind `CONTENT_USE_FEEDBACK`. This allows a later Candidate or Recommendation to cite exact feedback provenance through the existing source contract without introducing a Value Factory, event bus or universal Opportunity service.

## Ownership

- **Core:** User, Session, Workspace Principal and permission truth.
- **Lite:** Product-loop manual-use feedback and its source projection.
- **Gateway:** authenticated browser transport, trusted origin, CSRF, Workspace and idempotency enforcement.
- **MarkReg / Execution / MGSN:** unchanged; their existing owner facts remain authoritative.

No cross-service SQL is introduced.

## Mutation contract

Browser/Gateway:

`POST /api/lite/publish-packages/:publishPackageId/use-feedback`

Lite internal route:

`POST /v1/publish-packages/:publishPackageId/use-feedback`

Required evidence:

- `publishPackageVersion`;
- `expectedPublishPackageFingerprintSha256`;
- `outcome`;
- optional `externalReference`;
- `Idempotency-Key`.

Actor identity is never accepted from the browser body. Gateway rejects `recordedByPrincipalId`, and Lite records the trusted Core Principal.

## Persistence and safety

Migration `0043_lite_product_loop_feedback` owns:

- `lite_product_loop_use_feedback`;
- `lite_product_loop_feedback_commands`.

Safety requirements:

- one final manual-use report per exact PublishPackage version;
- exact package fingerprint check;
- Workspace isolation;
- exact idempotent replay;
- conflicting replay fails closed;
- second, different report for the same exact package fails closed;
- persistence outage does not fabricate feedback;
- MarkOrbit never marks the external action as executed or independently verified.

## Today observability

`GET /v1/today` returns recent manual-use feedback alongside the existing Today snapshot. The Lite UI may render it as supporting Product-loop evidence; it must not become a new parallel top-level module.

## Explicit non-goals

PLC-WP-06 does **not** implement:

- automatic publication or social integrations;
- automatic customer outreach;
- generic event sourcing or analytics infrastructure;
- a universal Artifact or Opportunity store;
- automatic Candidate creation from feedback;
- automatic qualification or Formal Opportunity promotion;
- Order/Matter/Payment/provider appointment/filing mutation;
- Official Truth;
- M6 Capability Ledger, Reflection, Profile or Twin;
- Capability verification or Canon mutation.

## Acceptance gate

The work package is ready for owner review only when the exact PR head proves:

1. ownership and persistence-boundary validation;
2. real PostgreSQL feedback persistence and restart/replay behavior;
3. stale-fingerprint, conflicting replay and Workspace-isolation failure cases;
4. Gateway authentication, CSRF, idempotency and actor-spoof boundaries;
5. existing PLC-WP-05 Today/Prepared Action integration remains green;
6. repository formatting/lint/typecheck/build gates pass;
7. existing M2–M5 regression gates remain green;
8. no speculative shared extraction or M6 runtime is introduced.
