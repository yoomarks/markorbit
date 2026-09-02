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

### Brain Asset Registry / ACTIVE resolution

- Implementation: `brain-asset-registry.ts`, `brain-asset-registry-postgres.ts`.
- Durable state: PostgreSQL registry exists.
- Production construction: not constructed by `services/core/src/main.ts`; exported as a Core package subpath.
- Intended boundary: owner-library resolution boundary.
- Classification: `INTERNAL_ONLY_REACHABLE`.
- Next action: keep internal until a real consumer requires an owner route; do not add HTTP by analogy.

### Brain Build Runtime

- Implementation: `brain-build-runtime.ts`.
- Durable state: derived/recomputable build output; registry adapter exists separately.
- Production construction: not constructed by `main.ts`; built/exported as a subpath.
- Intended boundary: owner-library build boundary.
- Classification: `INTERNAL_ONLY_REACHABLE`.
- Next action: wait for a real governed Build consumer; ordinary Capability hot paths must not run Brain research/build.

### Brain Self Audit + BrainGap Registry

- Implementation: `brain-build-self-audit-observation.ts`, `brain-build-self-audit-runtime.ts`, `brain-gap-registry-postgres.ts`.
- Durable state: PostgreSQL BrainGap registry.
- Production construction: `createPostgresBrainBuildSelfAuditRuntimeV1(database)` is an explicit production-capable constructor; it is not mounted in `main.ts`.
- Intended boundary: internal Brain Build self-audit observation.
- Classification: `INTERNAL_ONLY_REACHABLE`.
- Next action: no generic route. Use the durable constructor from the actual Brain Build owner path when a production Build run is invoked.

### PERFORMANCE_GAP Method Improvement admission

- Implementation: `method-improvement.ts` plus HTTP routes.
- Durable state: PostgreSQL repository.
- Production construction: `main.ts` constructs `PostgresMethodImprovementAdmissionRepositoryV1` and its service.
- Intended boundary: authenticated internal Method Improvement route through `createRuntime`.
- Classification: `PRODUCTION_REACHABLE`.
- Next action: preserve current strict predecessor/report semantics.

### COVERAGE_GAP Method Improvement admission

- Implementation: `method-improvement-coverage-gap.ts`.
- Durable state: in-memory repository only in accepted #512 slice.
- Production construction: not wired to a durable production bootstrap.
- Intended boundary: owner-local coordinator only.
- Classification: `DURABILITY_INCOMPLETE`.
- Next action: Shared persistence foundation #657, then Core PostgreSQL adapter/bootstrap follow-on.

### Method Outcome Evidence admission

- Implementation: `method-outcome-evidence.ts` plus HTTP.
- Durable state: PostgreSQL.
- Production construction: constructed in `main.ts`.
- Intended boundary: authenticated internal route.
- Classification: `PRODUCTION_REACHABLE`.
- Next action: no owner-local reachability gap found.

### Method Outcome Reports

- Implementation: `method-outcome-report.ts` plus HTTP.
- Durable state: PostgreSQL reader.
- Production construction: constructed in `main.ts`.
- Intended boundary: authenticated internal route.
- Classification: `PRODUCTION_REACHABLE`.
- Next action: no owner-local reachability gap found.

### Official Fee Reference Store / current reference read

- Implementation: `official-fee-reference-store.ts`, `official-fee-reference-store-postgres.ts`.
- Durable state: PostgreSQL.
- Production construction: not constructed by Core `main.ts`; explicit package subpaths are built/exported.
- Intended boundary: controlled owner-library reference read/materialization boundary.
- Classification: `INTERNAL_ONLY_REACHABLE`.
- Next action: keep behind bounded resolver/currentness adapters; do not create generic fee HTTP truth.

### Capability Runtime + current Runtime Capability / Implementation Profile

- Implementation: Capability Engine registry/profile/runtime stack.
- Durable state: PostgreSQL.
- Production construction: Capability Engine `main.ts` constructs registry, implementation profiles and governed runtime.
- Intended boundary: authenticated Capability Engine runtime.
- Classification: `PRODUCTION_REACHABLE`.
- Next action: no generic maturity promotion is implied by runtime reachability.

### Capability observation / quality telemetry

- Implementation: observation ledger plus quality telemetry.
- Durable state: PostgreSQL/telemetry sink where configured.
- Production construction: Capability Engine `main.ts` constructs the observation ledger and wraps governed runtime when telemetry is configured.
- Intended boundary: owner runtime observation path.
- Classification: `PRODUCTION_REACHABLE`.
- Next action: keep execution quality separate from method correctness.

### Managed AI runtime

- Implementation: Managed AI bootstrap.
- Durable state: runtime-specific durable dependencies.
- Production construction: Capability Engine `main.ts` creates runtime bindings when configuration is complete.
- Intended boundary: governed Capability execution only.
- Classification: `PRODUCTION_REACHABLE`.
- Next action: no authority expansion; missing configuration remains disabled/fail-closed.

### Managed Communication

- Implementation: Managed Communication bootstrap plus Gmail runtime.
- Durable state: PostgreSQL plus provider state.
- Production construction: Capability Engine `main.ts` constructs bindings and the optional Gmail sender after #305.
- Intended boundary: existing authenticated Managed Communication owner boundary.
- Classification: `PRODUCTION_REACHABLE`.
- Next action: live-provider authority remains configuration/account bounded.

### Capability source-admission/currentness/source-use production proof

- Implementation: `current-source-admission*`, policy catalog, USPTO Method/Reference currentness and USPTO source-use authority.
- Durable state: proof is deterministic/recomputable and depends on governed producer state.
- Production construction: current Capability Engine `main.ts` does not construct a production source-admission/evidence composition path.
- Intended boundary: owner-local library/evaluator APIs only.
- Classification: `IMPLEMENTED_NOT_BOOTSTRAPPED`.
- Next action: #656 is the first explicit promotion-readiness/production-proof vertical slice. Do not promote policy before real governance activation.

### Capability catalog integrity audit

- Implementation: `capability-catalog-integrity.ts` and current-catalog adapter.
- Durable state: reads durable current registries.
- Production construction: not mounted as a service route.
- Intended boundary: read-only owner audit API.
- Classification: `INTERNAL_ONLY_REACHABLE`.
- Next action: candidate input to a future Cognitive Control Plane; no auto-remediation.

### Product demand coverage audit

- Implementation: `capability-demand-coverage.ts`.
- Durable state: deterministic audit; no product-demand registry by design.
- Production construction: not mounted as a general route.
- Intended boundary: explicit owner audit over a caller-supplied governed demand descriptor.
- Classification: `INTERNAL_ONLY_REACHABLE`.
- Next action: correct boundary. Product remains owner of demand truth.

### Coverage Gap evidence materialization

- Implementation: `capability-coverage-gap-evidence.ts`.
- Durable state: deterministic evidence; no trigger mutation.
- Production construction: not mounted as a general route.
- Intended boundary: owner producer evidence API.
- Classification: `INTERNAL_ONLY_REACHABLE`.
- Next action: durable Core admission is currently blocked by #657 persistence, not by producer evidence.

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

- Brain Build != Brain activation.
- BrainGap != Method Improvement trigger.
- Capability runtime success != method correctness.
- Runtime Capability/Profile currentness != production source admission.
- Production source admission != Recommendation / filing / payment / Official Truth.
- Managed Communication reachability != autonomous provider contact authority.

## Next execution order

1. #656 — complete one machine-readable USPTO Resolver production-promotion readiness path and stop at explicit governance if approval is absent.
2. #657 — Shared durable Coverage Gap persistence foundation.
3. After #657 merges, create/execute the owner-local Core PostgreSQL Coverage Gap admission adapter/bootstrap.
4. After #656 proves the first source path, use its bounded result as the seed for a later Cognitive Control Plane read projection rather than adding another provenance version.

## Audit conclusion

Core no longer has a broad “missing runtime” problem. The current maturity pattern is more specific:

- Primary auth/Knowledge/Method Outcome/PERFORMANCE_GAP paths are production-reachable.
- Brain is deliberately library/internal-first and should stay that way until a real consumer exists.
- Coverage Gap governance is implemented but not durable.
- Capability production-source governance is implemented in primitives but not yet assembled into a real production promotion vertical slice.

Those two latter gaps are the current highest-value Core maturity work and are now tracked by #657 and #656 respectively.
