# M13 — Implementation Traceability

## Milestone

**M13 — Controlled Trademark Service Execution & Matter Lifecycle**

Implementation status: **COMPLETE ON `main`** at baseline `161b9c7b2549c0670696524781ca6b21538dab59`.

This status means the governed contract/runtime bridge and its tests are merged. It does **not** authorize production credentials, live filing, live payment, provider contact, external publication, production migration, deployment, or GA.

## Implemented loop

`Service Work Package -> Execution Readiness -> Explicit Authorization -> Execution Plan -> Protected Action Gate -> Provider / Channel Handoff -> Evidence & Receipt -> MarkReg Lifecycle Handoff -> Recovery / Next Work`

## Work-package traceability

| Work package                               | Delivery                                                                                                                                                                                                | Authority result                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| WP01 Execution Authorization Contract      | Exact M12 readiness + exact Work Package version are frozen into explicit user authorization with actor, capacity, action scope, optional provider/commercial constraints, expiry and acknowledgements. | Authorization is not submission and creates no Official Truth.                                             |
| WP02 Execution Plan                        | Deterministic owner-routed plan steps are limited to explicitly authorized protected-action kinds.                                                                                                      | Planning performs no external action, provider engagement or Matter mutation.                              |
| WP03 Protected Action Gate                 | Workspace, authorization/plan ownership, exact Work Package version, expiry, scope, evidence and idempotency are checked fail-closed before release.                                                    | Release only admits work to the owner domain; it does not confirm external success or official acceptance. |
| WP04 Provider Engagement Handoff           | Provider instruction release can be translated into an MGSN-targeted handoff request with exact provider/instruction/evidence references.                                                               | Execution does not manufacture Allocation, engagement or Provider Acceptance.                              |
| WP05 Matter Lifecycle Handoff              | Reviewed execution evidence can produce a MarkReg-targeted lifecycle handoff request with explicit owner validation references.                                                                         | Execution does not directly mutate MarkReg Matter lifecycle truth.                                         |
| WP06 Evidence & Receipt                    | Attempts, artifacts, receipts, provider returns and owner validation references are represented independently.                                                                                          | Attempt/provider evidence never becomes Official Truth by implication.                                     |
| WP07 Recovery & Idempotency                | Replay-safe action identity, idempotency conflict rejection, retry/manual-review/terminal classifications and no silent external retries.                                                               | Ambiguous external outcomes fail to manual review; automatic external retry remains forbidden.             |
| WP08 Execution Workbench & Authority Audit | One governed snapshot combines authorization, plan, optional release/handoffs/evidence, recovery and next human action.                                                                                 | Independent audit rejects Workspace or authority promotion; no cross-service SQL.                          |

Primary implementation PR: **#162 — M13: controlled trademark service execution and lifecycle bridge**.

## Implementation surfaces

- `docs/planning/MO-MVP-MILESTONE-013-SCOPE-LOCK.md`
- `packages/contracts/src/trademark-service-execution.ts`
- `packages/contracts/package.json`
- `services/execution/src/trademark-service-execution.ts`
- `services/execution/tests/trademark-service-execution.test.ts`
- `services/execution/package.json`

## Owner-domain preservation

- Lite retains Trademark Asset product context and Service Work Package preparation state only.
- Execution owns authorization/release/protected-action governance and execution evidence workflow.
- MarkReg owns formal Matter lifecycle and legal-owner workflow.
- MGSN/provider owner owns provider identity, allocation, engagement/acceptance and provider delivery truth.
- Capability Engine owns Capability truth.
- Payment owns payment truth.
- Knowledge owns acquisition/provenance only.
- Owner-domain verification is required before evidence can affect official-status projections.
- No cross-service SQL is permitted.

## Final authority locks

The merged implementation preserves these invariants:

- authorization is not filing;
- execution plan is not execution;
- protected-action release is not proof of external success;
- provider handoff is not provider acceptance;
- provider return is not Official Truth;
- receipt evidence is not official acceptance without owner-domain verification;
- Execution does not directly mutate MarkReg Matter lifecycle truth;
- Lite does not authorize or perform protected actions;
- AI/product feedback cannot grant authorization or promote evidence into owner truth;
- protected actions require idempotency;
- automatic external retry remains disabled;
- merge is not production deployment or GA.

## Exact-head CI evidence

PR #162 exact head before merge: `43639961b76ddf1fa1386e0675254a0d0d9cf704`.

Triggered formal workflows all completed successfully:

- `validation`
- `M6 WP-06 Authenticated Capability Center`
- `M8 WP-06 Commercial Runtime Reliability`

Within `validation`, the changed-scope detector, Workspace structure validation, persistence ownership boundary validation, Gateway inventory, Prettier check, affected-workspace validation, Core/Lite/Capability/MarkReg/Execution/MGSN/Payment integration and cross-domain Execution-to-MarkReg handoff all completed successfully where selected.

## Closeout decision

M13 is complete as a governed implementation milestone on `main`. Production execution remains separately gated. No statement in this closeout changes production deployment, credential, payment, provider-contact, filing, publication, migration or GA authority.
