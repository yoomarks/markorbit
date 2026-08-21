# M13 — Controlled Trademark Service Execution & Matter Lifecycle

## Scope lock

M13 connects the M12 Trademark Service Workbench to the existing owner-domain execution, provider-delivery, evidence, and MarkReg lifecycle capabilities without creating a parallel filing system in Lite.

The milestone loop is:

`Service Work Package -> Execution Readiness -> Explicit Authorization -> Execution Plan -> Protected Action Gate -> Provider / Channel Handoff -> Evidence & Receipt -> MarkReg Lifecycle Handoff -> Recovery / Next Work`

M12 readiness remains preparation-only. M13 is the first milestone that may admit an explicitly authorized protected action into the Execution owner domain. A successful internal call, provider assertion, or execution attempt never becomes Official Truth by implication.

## Problems to solve

### WP01 — Execution Authorization Contract

Freeze an exact Service Work Package version and M12 Execution Readiness reference into an explicit user authorization. Record actor, capacity, allowed protected-action kinds, optional commercial ceiling, provider restriction, expiry, conditions, and acknowledgement that authorization is not submission or official acceptance.

### WP02 — Execution Plan

Create a deterministic plan from the frozen authorization. Every step identifies the owner domain responsible for the consequence. Planning alone performs no external action and creates no official fact.

### WP03 — Protected Action Gate

Admit protected actions only when authorization is current, the action is in scope, the exact Work Package version is unchanged, required evidence is present, and an idempotency key is supplied. Fail closed for stale, expired, out-of-scope, cross-Workspace, or evidence-incomplete requests.

### WP04 — Provider Engagement Handoff

Translate an admitted provider action into an MGSN/provider-owner handoff request. Execution may request engagement; it must not manufacture MGSN Allocation, Provider Acceptance, or provider identity truth.

### WP05 — Matter Lifecycle Handoff

Translate verified execution evidence into a MarkReg lifecycle handoff request. Execution must never mutate MarkReg lifecycle truth directly and Lite must never create a parallel Matter lifecycle.

### WP06 — Evidence & Receipt

Represent execution attempts, provider returns, artifacts, receipts, and owner-domain verification references separately. `attempted != submitted`, `submitted claim != official acceptance`, and evidence without owner verification remains evidence only.

### WP07 — Recovery & Idempotency

Make protected actions replay-safe. The same idempotency key and fingerprint returns the same release; a conflicting fingerprint is rejected. Failures classify into retryable, manual-review-required, or terminal states without silently repeating an external consequence.

### WP08 — End-to-End Execution Workbench & Authority Audit

Expose one governed execution snapshot suitable for the professional workbench: authorization, plan, gate decision, provider handoff, lifecycle handoff, evidence, recovery state, and next required human action. Independently audit that no owner-domain authority has been promoted.

## Owner-domain boundaries

- **Lite** owns Trademark Asset product context and Service Work Package preparation state only.
- **Execution** owns authorization/release/protected-action governance and execution evidence workflow.
- **MarkReg** owns formal Matter lifecycle and legal-owner workflow.
- **MGSN/provider owner** owns provider identity, allocation, engagement/acceptance, and provider delivery truth.
- **Capability Engine** owns Capability truth.
- **Payment** owns payment truth.
- **Knowledge** owns acquisition/provenance only; it does not create legal conclusions.
- **Official authority evidence** must be verified by the appropriate owner-domain process before it can affect official-status projections.
- No cross-service SQL is permitted.

## Permanent authority locks

M13 must preserve all of the following:

- authorization is not filing;
- execution plan is not execution;
- protected-action release is not proof of external success;
- provider handoff is not provider acceptance;
- provider return is not Official Truth;
- receipt evidence is not official acceptance unless owner-domain verification says so;
- Execution does not directly mutate MarkReg Matter lifecycle truth;
- Lite does not authorize or perform protected actions;
- AI/product feedback cannot grant authorization or promote evidence into owner truth;
- idempotency cannot be bypassed for protected actions;
- merge is not production deployment or GA.

## Completion definition

M13 is complete when all eight work packages are represented by tested contracts/runtime behavior and the exact-head CI is green. Completion does not authorize production credentials, live filing, live payment, live provider contact, external publication, production migration, production deployment, or GA.
