# LCR-A2b2c — CN observed-history Capability / Method / runner candidate

## 1. Task record

- **Task ID:** `LCR-A2b2c`
- **Repository:** `yoomarks/markorbit`
- **Authoritative base:** `78f303d5e48402f556df93ce50718f8b51a26848`
- **Status:** `CANDIDATE_EVIDENCE_ONLY / NOT_ACTIVATED / NOT_ADMITTED`
- **Exact branch:** `CN / CNIPA / TRADEMARK_APPLICATION / FILING_TO_PRELIMINARY_PUBLICATION / ANY / SOURCE_RECORDED_COMPLETED_HISTORY`
- **Expected PR title:** `feat(capability): add CN lifecycle observed-history candidate`

Allowed implementation paths are limited to the new Brain candidate contract and tests, its package export/build entry, the Capability candidate runner and tests, the Capability package export, and this record. No persistence, transport, policy, UI or Product-owned workflow path is in scope.

## 2. Objective and Product outcome

Define the smallest deterministic candidate that can turn exact owner-observed CN filing and preliminary-publication dates into an honest, transient history result. The candidate proves that source-recorded facts can become `OCCURRED` lifecycle nodes without inventing the application's current position, future path, legal deadline, prediction, recommendation or action.

This task has no customer-visible runtime release. Its Product value is reviewable evidence for a later independently admitted rail computation. Until that admission, no Lite, MarkReg, Gateway or persistence consumer may treat this candidate as a Rule Pack or current lifecycle projection.

## 3. Canonical sources

This task consumes and does not replace:

1. `MO-TRADEMARK-LIFECYCLE-LCR-A0-SCOPE-LOCK.md`, especially the exact-branch gates, source-fact semantics and no-authority boundary.
2. `MO-TRADEMARK-LIFECYCLE-LCR-A2A-COMPUTATION-CONTRACT.md`, which owns the transient computation input/output contract.
3. `MO-TRADEMARK-LIFECYCLE-LCR-A2B1-ADMISSION-READINESS-CONTRACT.md` and `MO-TRADEMARK-LIFECYCLE-LCR-A2B2A-EVIDENCE-TRUTH-REPAIR.md`, which keep the branch `INCOMPLETE / NOT_ADMITTED`.
4. `MO-TRADEMARK-LIFECYCLE-LCR-A2B2B-SOURCE-READ-RECEIPT-V3.md`, whose external owner producer remains undeployed and whose contract does not authenticate its own issuer.
5. `packages/contracts/src/brain-method.ts`, `brain-method-activation.ts` and `trademark-lifecycle.ts`.
6. `services/capability-engine/src/executable-method-runtime.ts`.

## 4. Contracts consumed and changed

The task adds one exact Brain candidate contract for this branch. It reuses:

- `BrainMethodContractV1` and `ExecutableMethodPackageV1`;
- `ExecutableMethodPackageActivationDecisionV1` as a required external activation boundary;
- `TrademarkLifecycleComputationInputV1` and the strict
  `TrademarkLifecycleComputationResultV1 = COMPUTED | NOT_COMPUTED` union;
- `CapabilityRequestV2`, `ImplementationBinding` and `ExecutableMethodPackageRunnerV1`.

The checked-in Brain Method and executable package remain `VALIDATED`, never `ACTIVE`. This task creates no `RuntimeCapabilityDefinition`, `ImplementationProfile`, activation decision, Capability Canon entry, runtime registration or Product entitlement.

## 5. Required behavior

### 5.1 Exact applicability

The candidate is limited to:

```text
method family: TEMPORAL_RESOLUTION
jurisdiction: CN
authority: CNIPA
object: TRADEMARK_APPLICATION
operation: PROJECT_TRADEMARK_LIFECYCLE
procedure: FILING_TO_PRELIMINARY_PUBLICATION
stage: SOURCE_RECORDED_COMPLETED_HISTORY
filing basis: ANY
segment: SOURCE_RECORDED_COMPLETED_HISTORY
```

Jurisdiction, authority, object, operation, procedure, stage, basis, segment, schema, package identity or dependency drift fails closed. A checked-in `VALIDATED` package is deliberately not selectable by the generic runtime, which selects exact `ACTIVE` packages only.

### 5.2 Candidate runner boundary

The runner implements the existing executable runner interface but is not bootstrapped or registered. Construction requires a separately supplied `APPROVED` activation decision. Execution requires the exact ACTIVE successor package and revalidates package, Method, evaluation, schema, executable kind, limitations and activation lineage. The ACTIVE successor must carry its exact `activatedAt`, and `request.receivedAt` must be at or after that activation instant; a missing activation clock or a request predating activation fails closed.

The resolver and runner both enforce the exact request/binding boundary. The request must use the fixed candidate Capability id/version and input/output schemas, the caller Workspace must equal the normalized input Workspace, the binding must retain the exact request id, and its runtime Capability id/version must match the fixed request Capability id/version. A fixture may vary ordinary request identity only when its binding varies to the same exact identity; neither side may be accepted independently after drift.

Tests may construct an explicitly fixture-only activation to prove determinism. A test fixture is not Brain Governance evidence, cannot be persisted as an owner decision and cannot change the checked-in candidate's lifecycle.

### 5.3 Honest history mapping

Only owner-observed facts already admitted by the normalized computation input may produce a `COMPUTED` branch:

- `FILING_DATE` may produce `FILING / APPLICATION_FILED / OCCURRED`;
- `PRELIMINARY_PUBLICATION_DATE` may produce `PRELIMINARY_PUBLICATION / PRELIMINARY_PUBLICATION_RECORDED / OCCURRED`.

Every emitted time assertion is `SOURCE_RECORDED / RECORDED_FACT`, retains exact owner references and has `legalDeadlineCertified = false`. The runner must not emit `CURRENT`, `UPCOMING` or `FUTURE`, rule windows, grace periods, predictions, typical ranges, recommendations, destinations or CTA authority.

Completed-history admission is deliberately narrow. The candidate requires exactly one exact-scope Data Engine read. An `AVAILABLE` fact definitely after `input.asOf` fails closed. When both filing and preliminary-publication facts are `AVAILABLE`, V1 requires the same declared precision and jurisdiction time zone and rejects a publication value earlier than the filing value; it does not repair, reorder or infer dates.

On the `COMPUTED` branch, `currentPosition` always remains unsupported with null current references and `CURRENT_POSITION_NOT_INFERRED`. `lastUndisputedPosition`, when present, is historical context only. The observed-history slice may report that it produced no next item, but it must retain the limitation that historical facts do not establish the application's current position or overall absence of work or risk.

### 5.4 Degradation

Missing, stale, conflicting or non-positive owner evidence must not create plausible history:

- stale evidence remains visibly stale;
- conflicting source dates keep current position unknown and expose the conflict;
- a pure adverse input contains exactly one `NOT_OBSERVED`, `NOT_COVERED` or `UNAVAILABLE` source read, carries zero positive source references and produces `NOT_COMPUTED`, never a synthetic projection;
- `NOT_OBSERVED` maps to `PARTIAL / UNKNOWN / AVAILABLE` with `SOURCE_FACT_NOT_OBSERVED_WITHOUT_COMPLETE_SCOPE_EVIDENCE`;
- `NOT_COVERED` maps to `NOT_COVERED / UNKNOWN / AVAILABLE` with `SOURCE_SCOPE_NOT_COVERED`;
- `UNAVAILABLE` maps to `PARTIAL / UNKNOWN / UNAVAILABLE` with `SOURCE_READ_UNAVAILABLE` and dependency reason `SOURCE_DEPENDENCY_UNAVAILABLE`;
- every adverse result carries `NOT_COMPUTED_DOES_NOT_ESTABLISH_NO_EVENT_DEADLINE_RISK_OR_ACTION`, all authority consequences remain false, and projection/current-position/next-item/recommendation/action fields are absent;
- an adverse read may not borrow an older or parallel `OBSERVED` scope to manufacture an unknown stage: mixed `OBSERVED + adverse`, multiple scopes and adverse reads with positive references fail closed;
- A1 continues to reject lifecycle `EMPTY`;
- unsupported basis, historical-version substitution, boundary-day requests and grace-period requests fail closed because this slice contains no legal-window logic.

## 6. State transitions

This task authorizes no canonical state transition. The only candidate evaluation path is:

```text
exact normalized transient input
-> exact ACTIVE successor selected only after an external approved activation decision exists
-> activation-gated candidate runner
-> OBSERVED evidence: deterministic transient COMPUTED history output
   OR
   pure single-read adverse evidence: deterministic transient NOT_COMPUTED result
-> all authority consequences false
```

The repository itself stops before the first transition: it stores only a `VALIDATED` candidate and an unregistered runner. It does not activate a Method, verify a Capability, admit a Rule Pack, promote a source, persist a projection or advance a current head.

## 7. UI states

Not applicable. This task adds no route, Storybook story, Playwright journey or renderable fixture. The output must remain sufficient for later UI states such as partial, stale, conflict, unavailable and not covered, but those states are not exposed by this PR.

## 8. Events

No event is emitted or consumed. A transient candidate result is not an integration event and no outbox is added.

## 9. Acceptance tests

1. Strict candidate parsing accepts only the exact fixed Method/package identities, schemas, applicability, executable kind, reason codes, limitations and deterministic fingerprints.
2. The checked-in Method and package are `VALIDATED`; the generic selector returns `NOT_APPLICABLE` because no ACTIVE package is supplied.
3. Runner construction rejects a rejected, malformed or mismatched activation decision.
4. Runner execution rejects package, Method, version, evaluation, missing/future activation time, schema, applicability, executable and limitation drift.
5. Exact observed filing and preliminary-publication facts become only `OCCURRED` historical nodes with source-recorded time assertions; future facts, chronologically inverted pairs and V1-incomparable precision/time-zone pairs fail closed.
6. Current position remains unknown; no future node, deadline, prediction, recommendation, action or authority is emitted.
7. Pure single-read zero-reference `NOT_OBSERVED`, `NOT_COVERED` and `UNAVAILABLE` fixtures return the exact `NOT_COMPUTED` mapping, never projection-shaped output or an all-clear claim.
8. Mixed `OBSERVED + adverse`, multiple scopes (including multiple `OBSERVED` scopes), positive-reference adverse reads, borrowed observed scope, historical-version, basis-difference, boundary-day and grace-period fixtures fail closed.
9. Resolver and runner tests lock exact request identity, fixed Capability id/version, input/output schema, caller Workspace, binding request id and runtime Capability id/version.
10. `EMPTY` remains rejected by the A1/A2a computation boundary.
11. All result authority consequences remain false and no code registers the candidate with a production runtime.
12. Existing readiness truth remains nine `EVIDENCE_MISSING` gates plus `CURRENT_PRODUCTION_ADMISSION = EVIDENCE_REJECTED / SOURCE_POLICY_PILOT`.

## 10. Validation commands

```bash
pnpm --filter @markorbit/contracts exec vitest run tests/brain-cn-trademark-lifecycle-history.test.ts tests/trademark-lifecycle-computation-contract.test.ts tests/trademark-lifecycle-rule-pack-readiness-contract.test.ts
pnpm --filter @markorbit/capability-engine exec vitest run tests/cn-trademark-lifecycle-history-candidate.test.ts tests/executable-method-runtime.test.ts
pnpm --filter @markorbit/contracts lint
pnpm --filter @markorbit/contracts typecheck
pnpm --filter @markorbit/contracts build
pnpm --filter @markorbit/capability-engine lint
pnpm --filter @markorbit/capability-engine typecheck
pnpm --filter @markorbit/capability-engine test
pnpm --filter @markorbit/capability-engine build
pnpm validate:workspace
pnpm validate:persistence-boundaries
pnpm task:prepush
```

## 11. Non-goals and stop conditions

This task does not:

- implement or impersonate the external Data Engine V3 producer;
- treat structural receipt parsing or a self-consistent hash as owner authentication;
- change the current source policy from `PILOT` or make `FACT_PATH` available;
- unlock lifecycle `EMPTY` or equate `EMPTY` with legal nonexistence;
- borrow an `OBSERVED` source scope to serialize a pure adverse result as a projection;
- create LCR-A2b2d professional-review evidence, LCR-A2b2e production evidence or LCR-A2c admission;
- add a service endpoint, network client, direct cross-service database read, event, persistence, migration, Gateway composition or UI;
- expand beyond the exact CN observed-history slice;
- create Official Truth, a certified deadline, legal advice, Product business state or execution authority.

Stop rather than weaken the boundary if implementation would require a locally issued Data Engine receipt, a fabricated reviewer/activation authority, direct owner-database access, source promotion, ACTIVE checked-in package, runtime registration, persistence or UI exposure.

## 12. Completion consequence

Completion must preserve:

```text
checked-in Method/package = VALIDATED candidate only
runtime registration = none
Data Engine owner producer deployed = no
current source policy = PILOT
current FACT_PATH = EVIDENCE_MISSING
current Rule Pack = NOT_ADMITTED
lifecycle EMPTY unlocked = no
runtime service/persistence/API/event/UI change = none
```
