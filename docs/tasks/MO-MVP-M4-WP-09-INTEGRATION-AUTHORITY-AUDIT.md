# MO MVP M4-WP-09 — Independent integration and authority audit

- **Work package:** M4-WP-09
- **Type:** integration / authority audit
- **Audited baseline:** `f1fd652cf4882cd1e0996bd9846995443ca5e967`
- **Audited tree:** `fc5b44772dcd51f10f9aaac5495a2d1f33d13e8a`
- **Predecessor:** M4-WP-08 / PR #56 merged
- **Recommendation:** `FIX`

## Objective

Independently audit the exact merged Milestone 4 provider-execution implementation against the approved scope, canonical semantics, owner boundaries, authority consequences and reproducibility requirements.

This work package is an audit. It does not add business capability, change a migration, weaken a test, tag a release or perform an external action.

## Audit result

The merged implementation passes the domain-level audit for:

- Provider / Provider Supply Capability semantic separation;
- exact Service Package source lineage;
- deterministic non-allocating Eligibility;
- explicit Allocation versus Provider Acceptance separation;
- authenticated Provider Workspace identity and spoof rejection;
- MGSN / Execution persistence ownership and no cross-service SQL;
- Provider Return provenance and correction/supersession history;
- exact retry-safe Execution evidence receipt semantics;
- Workspace / Provider isolation;
- no user Capability contamination;
- no Payment / Invoice consequence;
- no legal/professional appointment inference;
- no Filing Submission / Official Truth inference;
- exact-tree component CI and repeatability evidence.

The audit nevertheless found a release-blocking integration gap:

1. normal `services/mgsn/src/main.ts` does not construct durable `MgsnHttpServices` and therefore fails closed as `MGSN_RUNTIME_UNCONFIGURED`;
2. normal durable Execution runtime does not expose `ProviderReturnEvidenceService` through a trusted HTTP boundary backed by `0032` persistence;
3. existing Gateway provider-journey evidence uses live Gateway/MGSN transport but injected service/authentication stubs, not the approved full Core + Gateway + Execution + MGSN + owner PostgreSQL zero-interception path.

The detailed findings are recorded in:

- `docs/audits/MO-MVP-MILESTONE-004-INTEGRATION-AUDIT.md`;
- `docs/audits/MO-MVP-MILESTONE-004-INTEGRATION-AUDIT.json`.

## Required remediation before GO

A bounded M4 integration remediation must:

- compose the normal durable MGSN runtime from MGSN-owned repositories;
- add bounded Core Workspace identity and Execution source-verification adapters;
- expose a trusted internal durable Execution Provider Return evidence-handoff endpoint;
- connect MGSN evidence handoff to that Execution endpoint without cross-service SQL;
- prove one real authenticated zero-interception provider execution path through real service processes and owner PostgreSQL databases;
- prove restart/replay and final `PENDING_REVIEW` evidence receipt;
- keep all existing Milestone 2, Milestone 3, Milestone 4 and browser gates green.

After that remediation is merged, this independent audit must be rerun against the remediated merged baseline. Only that rerun may recommend Milestone 4 `GO`.

## Non-blocking drift

The audit also records:

- stale README / Task Index / TASK 029 / implementation-status documentation, reconciled by this audit branch;
- two service-local authority helper fixtures that use older field names while all external consequences remain false. The canonical cross-service authority vocabulary remains `packages/contracts/src/provider-execution.ts`. This metadata drift does not authorize runtime behavior and is not the reason for the `FIX` recommendation.

## Authority boundary

Neither this audit nor the required remediation authorizes:

- Payment or settlement;
- Invoice issuance;
- legal/professional representative appointment;
- automatic provider selection by AI;
- external trademark-office transmission;
- official application creation;
- application-number truth;
- trademark-office acceptance/contact;
- automatic Formal Matter completion;
- automatic user Capability verification.

`Provider Return != Official Truth`; `Evidence Handoff != Filing Submission`.

## Owner actions not performed

M4-WP-09 does not create a Git tag, publish a release, freeze production, appoint a provider legally, authorize financial settlement or submit/contact a trademark office.
