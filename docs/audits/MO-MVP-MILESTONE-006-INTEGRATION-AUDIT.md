# MO MVP Milestone 6 Independent Integration and Authority Audit

**Milestone:** `MO-MVP-MILESTONE-006`  
**Work package:** `M6-WP-08`  
**Approved direction:** `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`  
**Audit PR:** #93  
**Audited merged baseline:** `b903409f9202b7dab043b00b9f97c719d4e6b412`  
**Audited implementation tree:** `029e2b73fc3057f3c8b38d839b00dc2a56531d68`  
**Initial recommendation:** **FIX**  
**Final recommendation after bounded remediation:** **GO**

## 1. Audit conclusion

The approved Milestone 6 semantics and authority model are sound, but the first independent pass found one blocking integration-evidence gap in the merged WP-06/WP-07 acceptance path: the browser harness used an in-process `CapabilityObservationSourceAuthority` fixture instead of traversing the real Execution-owned reviewed-source boundary.

That gap did not mean the owner HTTP contract or the source-verification client was absent. Both existed and were separately tested. The problem was narrower and important: the delivery plan requires one permanent real-runtime acceptance path that proves the chain as one integrated journey. Separate mocked/client and owner-route tests did not prove that requirement.

PR #93 closes the gap without expanding Milestone 6 product scope. The browser runtime now creates a durable Execution Evidence Review Decision in an Execution-owned PostgreSQL database, starts the actual Execution service, exposes the governed internal source route, and makes Capability Engine verify the exact decision through `HttpExecutionCapabilityObservationSourceAuthority` before admitting the Observation.

With that remediation, the audited path is:

```text
accepted Capability Canon projection
-> durable Runtime Capability Definition/version
-> durable Execution Evidence Review Decision
-> real Execution internal HTTP owner-source boundary
-> exact Capability Observation admission
-> Capability Engine-owned private Ledger
-> deterministic private Reflection Candidate
-> explicit authenticated subject-user ACCEPTED disposition
-> deterministic private Capability Profile/Twin
-> authenticated Gateway
-> Lite Capability Center
-> reload/direct-URL/replay evidence
```

No step in this path verifies a professional Capability, mutates Capability Canon, publishes a score/rank/certification, changes Core permissions, authorizes protected execution, creates Payment/Invoice or legal appointment, performs Filing Submission, creates Official Truth, or performs an external action.

## 2. Finding register

### M6-AUD-001 — Permanent browser path stopped before the real Execution source owner

**Initial severity:** blocking  
**Initial status:** open on merged baseline  
**Final status:** remediated in PR #93

The merged browser harness exercised real Core, Gateway, Capability Engine, Lite and PostgreSQL, but constructed an in-process source-authority response. That bypassed the real Execution HTTP source owner inside the single acceptance journey.

Bounded remediation:

- `scripts/m6-wp-06-capability-center-real-runtime.ts` now runs a separate Execution owner database and the real Execution runtime;
- real provider evidence prerequisites are persisted and an explicit `ADMITTED_FOR_INTERNAL_USE` Evidence Review Decision is created through `EvidenceReviewService`;
- Capability Engine verifies the exact decision ID/version/fingerprint through `HttpExecutionCapabilityObservationSourceAuthority`;
- `scripts/validate-m6-capability-center-no-interception.mjs` permanently requires the Execution runtime, durable review repository, real HTTP source-authority client and governed owner route, while rejecting regression to the old in-process fixture;
- WP-06 and Milestone 6 hosted workflows provision the separate Execution browser database.

The repaired browser job already proved desktop and mobile execution on the remediation branch before final documentation reconciliation; the final PR head remains subject to the normal exact-head hosted gates.

### M6-AUD-002 — Milestone status documentation lagged the merged implementation

**Severity:** documentation drift  
**Final status:** remediated in PR #93

After PR #92 merged, implementation traceability still described WP-07 as in progress, WP-08 as not started, and the repository README still described Product Loop Closure / PLC-WP-01 as the current implementation stage. PR #93 reconciles those records to the actual merged sequence.

## 3. Semantic fidelity audit

### Capability Canon and runtime lineage — PASS

Runtime Capability definitions are accepted projections with exact Canon identity/version/fingerprint lineage. Work evidence and AI output are explicitly unable to create or mutate Capability Canon.

### Observation and Ledger provenance — PASS after M6-AUD-001 remediation

Observation admission accepts only a bounded source locator. Workspace, subject and source authority are derived from the owner response. Exact source ID/version/fingerprint is checked and dependency failure is fail-closed. The Ledger is private, append-oriented and Capability Engine-owned.

### Subject attribution and privacy — PASS

The subject derives from the authenticated reviewer principal recorded by the Execution-owned review decision, not from a browser/body-provided subject. Gateway rejects identity/workspace/subject/role/permission spoof fields. Capability Engine returns private not-found semantics for cross-subject/cross-Workspace reads.

### Reflection Candidate semantics — PASS

Candidate generation is deterministic from the private Ledger, exact-versioned, pending by default, and explicitly non-canonical/non-verified. Candidate creation has no execution or Canon authority.

### Explicit disposition authority — PASS

Only the exact authenticated subject user may disposition the exact candidate version/fingerprint as `ACCEPTED`, `REJECTED`, or `DEFERRED`. Stale candidate versions, idempotency conflicts and concurrency races fail safely.

### Private Profile and Twin — PASS

Accepted private reflections deterministically rebuild private Profile/Twin projections. Profile has no public numeric score or verified badge. Twin has no autonomous identity or protected execution authority.

## 4. Owner and relationship audit

- **Core** remains owner of identity, Session, Workspace Principal, roles and permissions.
- **Execution** remains owner of the governed Evidence Review Decision used as the admitted work source.
- **Capability Engine** remains owner of runtime Capability Registry, Observation/Ledger, Reflection Candidate, Disposition, private Profile and Twin.
- **Gateway** remains an authenticated transport/policy boundary and does not own Capability state.
- **Lite** remains the private product projection/action surface and does not acquire Canon or protected execution authority.
- The repaired runtime uses separate Execution and Capability Engine databases and HTTP for the owner boundary; no cross-service SQL is introduced.

## 5. Reliability, privacy and replay audit

The WP-07 matrix remains the permanent executable reliability base. It covers exact-head checkout, contracts/authority, persistence topology, Registry durability, governed source authority, Execution owner source route, Observation/Ledger durability, Candidate durability, Disposition/Profile/Twin durability, Gateway privacy, Lite projection, zero interception, desktop/mobile browser runtime, repeated owner-database projection, and machine evidence inventory.

PR #93 strengthens rather than weakens that matrix: browser acceptance now includes the real Execution owner boundary and a separately owned Execution PostgreSQL database. The browser spec continues to prove desktop `1440x900`, mobile `390x844`, direct `#capability` URL recovery and reload without Playwright route fulfillment/interception.

## 6. Permanent authority audit

All audited outcomes remain false:

- Reflection Candidate becomes canonical truth;
- accepted private reflection becomes verified professional Capability;
- raw Provider Return becomes direct user Capability evidence;
- Provider Supply Capability becomes direct user Capability evidence;
- runtime work evidence or AI output creates/mutates Capability Canon;
- private Profile creates a public score/rank/certification/verified badge;
- Capability Twin obtains autonomous identity or execution authority;
- Capability evidence changes Core role/permission state;
- cross-service SQL becomes allowed;
- Payment or Invoice is created;
- legal appointment is created;
- Filing Submission is performed;
- Official Truth is created;
- protected external action is executed.

The governing shorthand remains:

`ACCEPTED private reflection != verified Capability != Capability Canon truth`.

## 7. Exact-tree and hosted evidence

PR #92 exact head `d7fe1a02a7a84f9c876054b51376acd7a202350f` and merged baseline `b903409f9202b7dab043b00b9f97c719d4e6b412` resolve to the same Git tree `029e2b73fc3057f3c8b38d839b00dc2a56531d68`. The merged implementation therefore matches the WP-07 exact-tree evidence.

On PR #93 remediation, the repaired WP-06 real-runtime browser job passed with the real Execution source boundary, and the Milestone 6 exact-head reliability matrix itself passed before its final workspace check exposed only formatting drift. That formatting drift was normalized without changing the remediation semantics. The final documentation head must pass the full required hosted gate set before PR #93 is treated as ready for Owner merge.

## 8. Recommendation

**GO** for the approved Milestone 6 engineering scope after the bounded M6-AUD-001 integration repair and M6-AUD-002 documentation reconciliation in PR #93.

This recommendation is not a release, deployment, freeze, tag, Capability certification, authority grant or external action. Merging PR #93 remains an explicit Owner action.
