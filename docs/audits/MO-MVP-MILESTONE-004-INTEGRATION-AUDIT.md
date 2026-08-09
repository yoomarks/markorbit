# MO MVP Milestone 4 integration and authority audit

- **Work package:** `M4-WP-09`
- **Audit date:** 2026-08-09
- **Audited merged baseline:** `f1fd652cf4882cd1e0996bd9846995443ca5e967`
- **Audited implementation tree:** `fc5b44772dcd51f10f9aaac5495a2d1f33d13e8a`
- **M4-WP-08 exact-head evidence commit:** `016cb221cf57733df04f56a815eefeb55dffe839`
- **M4-WP-08 implementation tree:** `fc5b44772dcd51f10f9aaac5495a2d1f33d13e8a`
- **M4-WP-08 PR:** #56, merged
- **Audit recommendation:** **FIX**
- **Freeze / tag / release action:** **NOT PERFORMED** — those remain explicit owner actions.

## 1. Executive conclusion

Milestone 4 is **not yet recommended GO** for its approved scope `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`.

The audit confirms that the merged implementation has strong domain-level building blocks and exact-head evidence for Provider Registry, Supply Capability, Service Package admission, deterministic Eligibility, explicit Allocation, authenticated Provider Acceptance, versioned Provider Return, Execution evidence receipt persistence, Gateway authentication, isolation, idempotency, outage behavior and repeatability.

The final M4-WP-08 head `016cb221cf57733df04f56a815eefeb55dffe839` and merged `main` baseline `f1fd652cf4882cd1e0996bd9846995443ca5e967` have the same Git tree `fc5b44772dcd51f10f9aaac5495a2d1f33d13e8a`. Hosted exact-head evidence therefore validates the exact implementation contents merged to `main`.

However, the independent integration audit found one release-blocking integration class with three linked manifestations:

1. the production/durable MGSN process starts `createRuntime()` without constructing `MgsnHttpServices`, so protected provider-execution routes fail closed as `MGSN_RUNTIME_UNCONFIGURED` rather than reaching the durable MGSN repositories;
2. the durable Execution runtime does not compose `ProviderReturnEvidenceService` / `PostgresExecutionProviderReturnEvidenceRepository` into an HTTP boundary that MGSN can call for the exact evidence handoff;
3. the current Gateway provider-journey test runs live Gateway and MGSN HTTP servers but injects stub domain services and a stub Core authentication client. There is no exact-head acceptance path using real Core + Gateway + Execution + MGSN + owner PostgreSQL databases with zero request interception, as required by the approved M4 delivery plan.

As a result, the repository proves the pieces but does not yet prove the approved integrated runtime loop:

```text
current governed Execution source
-> durable MGSN Service Package
-> deterministic Eligibility
-> explicit Allocation
-> authenticated Provider Acceptance
-> durable Provider Return
-> exact Execution evidence handoff
-> reviewable evidence state
-> restart/recovery
```

The correct audit disposition is therefore **FIX**, not HOLD: no authority corruption or destructive migration defect was found, and the missing work is bounded runtime composition plus exact real-runtime evidence. After that remediation is merged and the exact implementation tree passes the repository gates, M4-WP-09 should be rerun against the remediated merged baseline before any GO recommendation.

## 2. Audit scope

This audit evaluates the exact merged Milestone 4 implementation against:

- `docs/planning/MO-MVP-MILESTONE-004-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-004-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-004-PLAN.json`;
- TASK 029 / PR #48 planning approval;
- M4-WP-01 through M4-WP-08, PRs #49 through #56;
- `packages/contracts/src/provider-execution.ts` and its contract tests;
- Execution migrations `0027` and `0032`;
- MGSN migrations `0028` through `0031`;
- durable Provider Registry, Service Package/Eligibility, Allocation/Acceptance and Provider Return repositories/services;
- Execution Provider Return evidence receipt persistence;
- authenticated Gateway and trusted MGSN HTTP boundaries;
- the M4-WP-08 reliability inventory, runner and hosted exact-head evidence;
- the explicit no-finance/no-legal-appointment/no-Official-Truth boundary.

M4-WP-09 is an audit work package. This PR does not repair the blocking runtime integration, add a migration, introduce product behavior, weaken tests, create a Git tag, publish a release or perform an external action.

## 3. Approved Milestone 4 outcome

The approved primary path is:

```text
Authenticated Workspace / controlled operator
-> exact current Execution source
-> durable MGSN Service Package
-> deterministic Eligibility
-> explicit Allocation
-> authenticated Provider Acceptance
-> durable Provider Return
-> exact Evidence Handoff to Execution
-> reviewable evidence state
-> restart/reload
```

The path must preserve exact versions/fingerprints, Workspace and Provider isolation, provider identity, idempotency, optimistic concurrency, owner-specific persistence and explicit authority separation.

Audit finding: **FIX REQUIRED — domain components exist, but the durable service processes are not yet composed into this complete runtime path.**

## 4. Content identity of merged main and tested head

The final M4-WP-08 PR head is:

`016cb221cf57733df04f56a815eefeb55dffe839`

Its Git tree is:

`fc5b44772dcd51f10f9aaac5495a2d1f33d13e8a`

The merged `main` baseline is:

`f1fd652cf4882cd1e0996bd9846995443ca5e967`

Its Git tree is also:

`fc5b44772dcd51f10f9aaac5495a2d1f33d13e8a`

Audit finding: **PASS — exact implementation-tree identity established.**

## 5. Hosted exact-head gate evidence

The final M4-WP-08 head passed the required hosted workflow families:

- validation run `31319610739`: **PASS**;
- Milestone 4 reliability run `31319610700`: **PASS**;
- Milestone 3 reliability regression run `31319610717`: **PASS**;
- Milestone 2 reliability regression run `31319610695`: **PASS**;
- Browser and Visual Validation run `31319610698`: **PASS**.

The M4 reliability inventory contains 17 executable scenario records covering canonical authority fixtures, owner migrations, stale-source fail-closed behavior, concurrent Allocation serialization, durable idempotency, Provider identity binding, decline/reallocation history, Provider Return correction history, exact evidence receipt behavior, append-only audit, Workspace/Provider isolation, Gateway outages and repeatability.

Audit finding: **PASS for the scenarios actually represented by the matrix.** The matrix does not substitute for the missing full durable multi-service runtime path identified in section 16.

## 6. Work-package integration trace

The audited implementation sequence is:

1. PR #48 — TASK 029 Milestone 4 scope and architecture lock.
2. PR #49 — M4-WP-01 Provider execution contracts and authority boundary.
3. PR #50 — M4-WP-02 durable authenticated Execution filing-governance source.
4. PR #51 — M4-WP-03 durable MGSN Provider Registry and Supply Capability.
5. PR #52 — M4-WP-04 Service Package and deterministic Eligibility.
6. PR #53 — M4-WP-05 explicit Allocation and authenticated Provider Acceptance.
7. PR #54 — M4-WP-06 Provider Return and exact Execution evidence persistence/handoff components.
8. PR #55 — M4-WP-07 authenticated Gateway and trusted MGSN HTTP boundaries.
9. PR #56 — M4-WP-08 exact-head reliability matrix.

The dependency order follows the approved plan and no migration owner is assigned to the wrong service.

Audit finding: **PASS for implementation order and ownership prerequisites.**

## 7. Provider and Supply Capability semantic fidelity

MGSN Provider identity references Core Workspace identity rather than defining a second authentication or membership system. Provider Supply Capability is versioned private supply-side evidence with operational status, jurisdictions, service types, effective period, capacity/availability and supply-only verification state.

The eligibility helper requires an active Provider, active capability, positive availability and effective-period coverage. Supply verification is explicitly `VERIFIED_FOR_SUPPLY`; it is not user Capability evidence and does not update Capability Engine truth.

Audit finding: **PASS.**

### Non-blocking vocabulary drift

Two service-local exported test/helper consequence objects (`providerRegistryAuthorityConsequences` and `servicePackageEligibilityAuthorityConsequences`) retain earlier field names such as `legalProfessionalAppointmentCreated` / `officialTruthCreated`, while the canonical shared `ProviderExecutionAuthorityConsequences` uses the frozen WP-01 vocabulary such as `professionalLegallyAppointedAutomatically` and the explicit Official Truth consequence fields.

The service-local objects are not used to authorize mutations and all of their external consequences are false. The cross-service contract remains the canonical authority source, so this is **non-blocking semantic-metadata drift**, not an authority escalation. A later cleanup should remove or align duplicate consequence metadata rather than create a second canon.

## 8. Service Package source lineage

Service Package admission consumes Execution truth only through the bounded `ExecutionSourceAdmissionSource` dependency. Admission normalizes the source, requires the command Workspace and correlation lineage to match, verifies the source is current and requires an exact fingerprint match.

Eligibility re-verifies the current Execution source before evaluating Provider truth. The admitted snapshot preserves exact Preparation Lock, Filing Authorization, Execution Release, Filing Execution Task Draft, optional Formal Matter, execution window, document/instruction references, Channel/Relationship Model where available and correlation context.

Audit finding: **PASS.**

## 9. Deterministic Eligibility

Eligibility uses the exact current Service Package version/fingerprint and exact current Supply Capability version/fingerprint. The policy records explainable blocking checks for source currency, Provider match/status, Supply status/verification, jurisdiction, service type, effective window and availability.

The deterministic fingerprint includes the policy version, exact package/provider/supply versions and resulting checks. Evaluation creates no Allocation as a side effect.

Audit finding: **PASS.**

## 10. Allocation versus Provider Acceptance

Allocation is an explicit authenticated operator command. The service re-checks current Execution source truth after Eligibility, verifies exact Eligibility/Provider/Supply lineage and prevents more than one current active Allocation for the bounded Service Package path. PostgreSQL constraints and concurrency tests reinforce the service guard.

Provider Acceptance is a separate record. Provider response identity is derived from the authenticated Provider Workspace principal; the provider ID is not accepted from the provider response payload. Decline preserves history, supersedes the active Allocation and permits a later explicit reallocation.

Audit finding: **PASS.**

## 11. Provider Return provenance and correction semantics

Provider Return requires the exact current active Allocation, exact authenticated `ACCEPTED` Provider Acceptance and exact admitted Service Package. The authenticated Provider Workspace must resolve to the allocated Provider.

A Return must include at least one artifact or structured assertion. Corrections require an explicit `supersedes` reference to the current return and cannot change the accepted Allocation/Acceptance/Service Package lineage. Historical versions remain durable.

A provider assertion such as an external filing claim remains an assertion inside Provider Return evidence. It is not promoted into Official Truth.

Audit finding: **PASS.**

## 12. Execution evidence receipt semantics

`ProviderReturnEvidenceService` accepts only the exact current Provider Return ID/version/fingerprint and matching correlation lineage. It re-checks the exact Execution Release, requires `RELEASED_FOR_EXECUTION`, verifies the prepared Filing Execution Task Draft lineage and persists a receipt with `reviewStatus = PENDING_REVIEW`.

The receipt uses the canonical `evidenceHandoffAuthorityConsequences` fixture, which keeps Payment, Invoice, legal appointment, filing submission, official application/application number, office acceptance/contact, automatic Matter completion and automatic user Capability verification false.

The PostgreSQL repository and M4 reliability evidence prove idempotent replay, response-loss recovery, stale/fingerprint/cross-Workspace rejection and append-only evidence audit.

Audit finding: **PASS at the service/repository boundary; runtime composition is blocking and covered separately in section 16.**

## 13. Authentication, Workspace and Provider isolation

Gateway MGSN routes require a browser session resolved through Core Workspace Principal truth. Mutations require trusted Origin, CSRF and `execution:manage`; reads require `execution:read`. Gateway forwards a trusted internal secret and encoded Principal to MGSN.

Provider-facing routes use a distinct Provider Workspace context. Provider mutations reject caller-supplied `providerId` and `providerWorkspaceId`; MGSN derives provider actor/workspace from the trusted Principal and fails closed on cross-provider reads.

MGSN independently validates the trusted internal caller and Principal rather than trusting Gateway request bodies as authority.

Audit finding: **PASS.**

## 14. Persistence ownership and cross-service SQL

Migration ownership is explicit:

- Execution: `0027_execution_filing_governance`, `0032_execution_provider_return_evidence`;
- MGSN: `0028_mgsn_provider_registry`, `0029_mgsn_service_package_eligibility`, `0030_mgsn_allocation_provider_acceptance`, `0031_mgsn_provider_return`.

MGSN consumes Core/Execution truth through bounded interfaces/HTTP context and does not read their databases directly. Execution evidence persistence does not write MGSN tables.

The repository persistence-boundary validator and owner-specific PostgreSQL suites pass.

Audit finding: **PASS — no cross-service SQL or semantic owner transfer identified.**

## 15. Authority-consequence audit

The canonical shared contract permits the following internal truths to progress only through their explicit governed commands:

- Service Package created;
- Eligibility evaluated;
- Provider allocated;
- Provider accepted;
- Provider Return created;
- Execution evidence handed off.

The following remain false automatically throughout the audited path:

- Payment created;
- Invoice created;
- professional/legal appointment inferred automatically;
- filing submitted;
- official application created;
- official application number received;
- trademark-office acceptance;
- trademark-office contact as verified truth;
- automatic Formal Matter completion;
- automatic user Capability verification.

No AI path creates Allocation, Provider Acceptance, Provider Return certification or Official Truth.

Audit finding: **PASS — no financial, legal-representation or Official Truth escalation found.**

## 16. Blocking integration findings

### M4-INT-001 — Durable MGSN runtime is not composed

`services/mgsn/src/main.ts` starts `createRuntime()` without supplying `MgsnHttpServices`.

`createMgsnHttpRoutes()` intentionally fails closed with `503 MGSN_RUNTIME_UNCONFIGURED` when those services are absent. This fail-closed behavior is correct as a safety guard, but it means the normal MGSN process cannot currently execute the durable Provider Registry -> Service Package -> Eligibility -> Allocation -> Acceptance -> Provider Return path implemented in the service/repository modules.

**Classification: RELEASE BLOCKING.**

Required remediation: construct the MGSN durable runtime from the MGSN database, owned PostgreSQL repositories, a bounded Core Workspace identity source, a bounded Execution source-verification client and a bounded Execution evidence-handoff client; preserve database-per-owner isolation and the trusted internal authorization boundary.

### M4-INT-002 — Execution evidence handoff has no durable runtime HTTP boundary

`ProviderReturnEvidenceService` and its PostgreSQL repository exist and are tested, but the normal Execution runtime does not compose them into a protected route that MGSN can call. `services/execution/src/main.ts` wires durable Professional Review and Filing Governance repositories only.

Therefore the cross-service MGSN -> Execution handoff remains an injected service dependency in tests rather than a runnable durable service-to-service path.

**Classification: RELEASE BLOCKING.**

Required remediation: expose a trusted internal Execution evidence-handoff endpoint that binds owner persistence, exact current source validation and idempotency, then make the MGSN handoff adapter call it through the bounded service contract. Do not add cross-service SQL or reinterpret the evidence receipt as Official Truth.

### M4-E2E-001 — Approved full real-runtime acceptance path is missing

The M4 delivery plan requires a real-runtime acceptance path using real Core + Gateway + Execution + MGSN + owner PostgreSQL databases with zero request interception.

`apps/gateway/tests/mgsn-provider-journey.test.ts` starts live Gateway and MGSN HTTP servers, which is useful transport evidence, but injects an in-memory/stub `MgsnHttpServices` object and a stub `CoreAuthenticationClient`. It proves browser-facing policy transport but not the complete durable provider-execution loop.

The M4-WP-08 reliability matrix separately proves durable owner components, but it does not contain a full multi-service durable path that bridges the missing runtime composition above.

**Classification: RELEASE BLOCKING.**

Required remediation: add one exact-head zero-interception integration/real-runtime path that exercises the normal durable service composition through Core/Gateway/Execution/MGSN and owner PostgreSQL databases, including restart/recovery and the final `PENDING_REVIEW` evidence receipt.

## 17. Documentation drift

The audit found repository-status documentation lagging behind merged implementation truth:

- `README.md` still describes Milestone 4 as planning/proposal-only;
- `docs/planning/TASK-INDEX.md` stops current M4 status after WP-04;
- TASK 029 still says `PROPOSED_FOR_OWNER_APPROVAL` although PR #48 approved it;
- M4 implementation traceability still lists WP-08 as current and WP-09 as not started.

This is **non-blocking documentation drift**. The M4-WP-09 audit branch reconciles those current-status documents without rewriting the historical proposal-state meaning of the original scope-lock/delivery-plan/plan artifacts.

Audit classification: **NON-BLOCKING DOCUMENTATION DRIFT — REMEDIATED BY M4-WP-09.**

## 18. Reproducibility statement

The repository already provides reproducible component evidence through:

```bash
pnpm check
node scripts/run-milestone4-reliability.mjs
```

and the owner-specific PostgreSQL modes used by `.github/workflows/milestone-4-reliability.yml`.

Hosted evidence for the audited exact implementation tree is recorded by the successful run IDs in section 5.

After runtime-integration remediation, the remediation must add a repository-defined command for the full durable multi-service provider execution path and place it in hosted exact-head CI. The final audit must cite that exact tested head/tree and successful run.

## 19. Required remediation acceptance

Milestone 4 may be re-audited for GO when one exact merged implementation tree proves all of the following:

1. normal durable MGSN startup constructs Provider Registry, Service Package/Eligibility, Allocation/Acceptance and Provider Return services from MGSN-owned persistence;
2. MGSN uses bounded HTTP/service adapters for Core identity and Execution source/evidence dependencies, never cross-service SQL;
3. normal durable Execution startup exposes and persists the exact Provider Return evidence-handoff boundary;
4. a real authenticated Gateway path reaches the durable MGSN service and provider identity remains Principal-derived;
5. one zero-interception exact-head integration path reaches `PENDING_REVIEW` Execution evidence through real Core + Gateway + Execution + MGSN + owner PostgreSQL databases;
6. restart/replay remains deterministic and all existing M2/M3/M4 reliability/browser gates remain green;
7. canonical no-finance/no-legal-appointment/no-Official-Truth consequences remain false.

No new Payment, Invoice, external filing, trademark-office credential or Official Truth scope is needed to close these findings.

## 20. Final recommendation

### Decision: FIX

Milestone 4's domain model, persistence ownership, source lineage, identity boundaries, idempotency/concurrency controls and authority separation are strong enough to continue with bounded remediation. No evidence supports a HOLD for data corruption, owner-boundary violation or authority escalation.

The milestone nevertheless cannot receive GO while the approved provider-execution loop is not composed in the normal durable service runtime and the required full real-runtime evidence does not exist.

The next repository action should therefore be a narrowly scoped Milestone 4 integration remediation that closes `M4-INT-001`, `M4-INT-002` and `M4-E2E-001`, followed by a rerun of this independent audit against the remediated merged baseline.

### Owner actions not performed by this audit

M4-WP-09 does not itself:

- create a Git tag;
- publish a GitHub release;
- freeze a production deployment;
- authorize provider compensation or Payment/Invoice truth;
- legally appoint a professional/provider;
- transmit a trademark filing;
- create official application/application-number truth;
- contact a trademark office.
