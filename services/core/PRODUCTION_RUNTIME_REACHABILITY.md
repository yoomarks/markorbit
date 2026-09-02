# Core Production Runtime Reachability — 2026-09-03

Parent: #655  
Baseline: `main@92a61ac1b81d1a8805178d648eea76757e048789`

This checkpoint distinguishes code presence from production reachability. A component is not considered production-ready merely because its implementation, tests, or PostgreSQL adapter exist.

## Classification vocabulary

- `PRODUCTION_REACHABLE` — production process/bootstrap constructs the durable owner dependency and exposes or invokes it through the intended authenticated owner boundary.
- `INTERNAL_ONLY_REACHABLE` — production-capable owner implementation exists as an explicit package/runtime construction boundary, but it is intentionally not mounted as a general service route or current product-facing process path.
- `IMPLEMENTED_NOT_BOOTSTRAPPED` — owner implementation exists, but current production process/bootstrap does not construct the complete path needed for real use.
- `BOOTSTRAPPED_NOT_EXPOSED` — production bootstrap constructs the dependency, but no intended invocation/read boundary is currently reachable.
- `DURABILITY_INCOMPLETE` — governed logic exists, but current owner truth cannot survive the required restart boundary.
- `BLOCKED_BY_SHARED_DEPENDENCY` — owner-local runtime cannot legally complete without Shared/Integration work.
- `INTENTIONALLY_NON_PRODUCTION` — fixture/pilot/research-only path is intentionally excluded from production use.

## Current reachability matrix

| Subsystem | Implementation | Durable owner state | Production construction | Intended invocation boundary | Classification | Current next action |
| --- | --- | --- | --- | --- | --- | --- |
| Brain Asset Registry / ACTIVE resolution | `brain-asset-registry.ts`, `brain-asset-registry-postgres.ts` | PostgreSQL registry exists | not constructed by `services/core/src/main.ts`; exported as Core package subpath | owner-library resolution boundary | `INTERNAL_ONLY_REACHABLE` | Keep internal until a real consumer requires an owner route; do not add HTTP by analogy. |
| Brain Build Runtime | `brain-build-runtime.ts` | derived/recomputable build output; registry adapter exists separately | not constructed by `main.ts`; built/exported as subpath | owner-library build boundary | `INTERNAL_ONLY_REACHABLE` | Wait for a real governed Build consumer; ordinary Capability hot paths must not run Brain research/build. |
| Brain Self Audit + BrainGap Registry | `brain-build-self-audit-observation.ts`, `brain-build-self-audit-runtime.ts`, `brain-gap-registry-postgres.ts` | durable PostgreSQL BrainGap registry | `createPostgresBrainBuildSelfAuditRuntimeV1(database)` is an explicit production-capable constructor; not mounted in `main.ts` | internal Brain Build self-audit observation | `INTERNAL_ONLY_REACHABLE` | No generic route. Use the durable constructor from the actual Brain Build owner path when a production Build run is invoked. |
| PERFORMANCE_GAP Method Improvement admission | `method-improvement.ts` + HTTP routes | PostgreSQL repository | `main.ts` constructs `PostgresMethodImprovementAdmissionRepositoryV1` and service | authenticated internal Method Improvement route through `createRuntime` | `PRODUCTION_REACHABLE` | Preserve current strict predecessor/report semantics. |
| COVERAGE_GAP Method Improvement admission | `method-improvement-coverage-gap.ts` | in-memory repository only in accepted #512 slice | not wired to durable production bootstrap | owner-local coordinator only | `DURABILITY_INCOMPLETE` | Shared persistence foundation #657, then Core PostgreSQL adapter/bootstrap follow-on. |
| Method Outcome Evidence admission | `method-outcome-evidence.ts` + HTTP | PostgreSQL | constructed in `main.ts` | authenticated internal route | `PRODUCTION_REACHABLE` | No owner-local reachability gap found. |
| Method Outcome Reports | `method-outcome-report.ts` + HTTP | PostgreSQL reader | constructed in `main.ts` | authenticated internal route | `PRODUCTION_REACHABLE` | No owner-local reachability gap found. |
| Official Fee Reference Store / current reference read | `official-fee-reference-store.ts`, `official-fee-reference-store-postgres.ts` | PostgreSQL | not constructed by Core `main.ts`; explicit package subpaths are built/exported | controlled owner-library reference read/materialization boundary | `INTERNAL_ONLY_REACHABLE` | Keep behind bounded resolver/currentness adapters; do not create generic fee HTTP truth. |
| Capability Runtime + current Runtime Capability / Implementation Profile | Capability Engine registry/profile/runtime stack | PostgreSQL | Capability Engine `main.ts` constructs registry, implementation profiles and governed runtime | Capability Engine authenticated runtime | `PRODUCTION_REACHABLE` | No generic maturity promotion implied by runtime reachability. |
| Capability observation / quality telemetry | observation ledger + quality telemetry | PostgreSQL/telemetry sink where configured | Capability Engine `main.ts` constructs observation ledger and wraps governed runtime when telemetry configured | owner runtime observation path | `PRODUCTION_REACHABLE` | Keep execution quality separate from method correctness. |
| Managed AI runtime | managed AI bootstrap | durable/runtime-specific dependencies | Capability Engine `main.ts` creates runtime bindings when configuration is complete | governed Capability execution only | `PRODUCTION_REACHABLE` | No authority expansion; missing config remains disabled/fail-closed. |
| Managed Communication | managed communication bootstrap + Gmail runtime | PostgreSQL + provider state | Capability Engine `main.ts` constructs bindings and optional Gmail sender after #305 | existing authenticated managed-communication owner boundary | `PRODUCTION_REACHABLE` | Live-provider authority remains configuration/account bounded. |
| Capability source-admission/currentness/source-use production proof | `current-source-admission*`, policy catalog, USPTO Method/Reference currentness, USPTO source-use authority | proof is deterministic/recomputable; depends on governed producer state | current Capability Engine `main.ts` does not construct a production source-admission/evidence composition path | owner-local library/evaluator APIs only | `IMPLEMENTED_NOT_BOOTSTRAPPED` | #656 is the first explicit promotion-readiness/production proof vertical slice. Do not promote policy before real governance activation. |
| Capability catalog integrity audit | `capability-catalog-integrity.ts` and current-catalog adapter | reads durable current registries | not mounted as service route | read-only owner audit API | `INTERNAL_ONLY_REACHABLE` | Candidate input to future Cognitive Control Plane; no auto-remediation. |
| Product demand coverage audit | `capability-demand-coverage.ts` | deterministic audit, no product-demand registry by design | not mounted as general route | explicit owner audit over caller-supplied governed demand descriptor | `INTERNAL_ONLY_REACHABLE` | Correct boundary. Product remains owner of demand truth. |
| Coverage Gap evidence materialization | `capability-coverage-gap-evidence.ts` | deterministic evidence, no trigger mutation | not mounted as general route | owner producer evidence API | `INTERNAL_ONLY_REACHABLE` | Durable Core admission currently blocked by #657 persistence gap, not by producer evidence. |

## Confirmed findings

### 1. Coverage Gap admission is the only confirmed durability gap in the audited Phase 7 paths

The accepted #512 implementation intentionally uses an in-memory repository and explicitly refuses to overload PERFORMANCE_GAP PostgreSQL tables because Coverage Gap can represent `NEW_CAPABILITY_METHOD_DEMAND` without a predecessor Method. This is a real restart-boundary gap, not missing test coverage.

Action: Integration #657 owns the additive persistence foundation. Core must add the PostgreSQL adapter only after that schema lands.

### 2. Brain runtime is primarily a production-capable internal library, not a general Core HTTP surface

Current `services/core/src/main.ts` does not instantiate Brain Build/Asset/BrainGap services as public/internal routes. That absence is not itself a defect: the package explicitly builds and exports controlled Brain subpaths, and `createPostgresBrainBuildSelfAuditRuntimeV1()` provides a durable production-capable construction boundary for real Brain Build invocation.

Do not add generic Brain HTTP merely to make the matrix look green. A route should be added only for a concrete consumer with a frozen authority contract.

### 3. Capability execution is production-reachable; Capability production-source admission is not yet a complete runtime vertical slice

Capability Engine `main.ts` constructs durable current Capability/Profile registries, observation, Managed AI, Managed Communication and the governed execution runtime. It does not currently construct the source-admission/currentness/source-use evidence stack into one real production promotion path.

This is intentional historical layering, but it is now the highest-value maturity gap because producer governance mechanics are already implemented. #656 owns the first exact USPTO Resolver promotion-readiness vertical slice.

### 4. Reachability must not collapse authority layers

None of the classifications above changes these boundaries:

- Brain Build != Brain activation;
- BrainGap != Method Improvement trigger;
- Capability runtime success != method correctness;
- Runtime Capability/Profile currentness != production source admission;
- production source admission != Recommendation / filing / payment / Official Truth;
- managed communication reachability != autonomous provider contact authority.

## Next execution order

1. #656 — complete one machine-readable USPTO Resolver production-promotion readiness path and stop at explicit governance if approval is absent.
2. #657 — Shared durable Coverage Gap persistence foundation.
3. After #657 merges, create/execute the owner-local Core PostgreSQL Coverage Gap admission adapter/bootstrap.
4. After #656 proves the first source path, use its bounded result as the seed for a later Cognitive Control Plane read projection rather than adding another provenance version.

## Audit conclusion

Core no longer has a broad “missing runtime” problem. The current maturity pattern is more specific:

- primary auth/Knowledge/Method Outcome/PERFORMANCE_GAP paths are production-reachable;
- Brain is deliberately library/internal-first and should stay that way until a real consumer exists;
- Coverage Gap governance is implemented but not durable;
- Capability production-source governance is implemented in primitives but not yet assembled into a real production promotion vertical slice.

Those two latter gaps are the current highest-value Core maturity work and are now tracked by #657 and #656 respectively.
