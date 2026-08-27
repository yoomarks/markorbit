# Cognitive Platform Phase 0 Audit — 2026-08-27

Status: evidence-backed baseline; Core-side Phase 0 implementation and contract inventory substantially complete.

## Core / Brain / Capability findings

### Preserve

- `services/capability-engine` is a real durable subsystem, not a placeholder. Current source includes governed runtime, durable replay, observation ledger, audit telemetry and HTTP surfaces.
- Gateway already exposes `capability-http.ts`; Capability therefore has a real product-facing/runtime foothold that should be evolved rather than replaced.
- Existing Brain foundation established useful primitives: immutable/versioned assets, evidence lineage, confidence decomposition, lifecycle, ACTIVE selection, fail-closed unresolved states, and PostgreSQL durability for Brain Asset Registry.
- Existing Capability canon already separates stable outcome contracts from implementations/providers and includes evidence/version lineage.

### Architecture drift that must be corrected

The older Brain foundation describes Brain as owning `Resolved Operational Intelligence + Precomputed Reasoning Assets + Incremental Case Intelligence` and explicitly treats current fee resolution as a Brain-owned resolved value. Under the new cognitive-platform baseline this is too broad.

Reclassification rule:

- reusable algorithm/rules/model/retrieval strategy -> Brain Method or Executable Method Package;
- current fee/deadline/reference value -> Capability Reference Materialization;
- expensive reusable aggregate -> Capability Materialized Aggregate;
- single-object risk/entity interpretation -> transient Capability result or product-owned persisted state;
- opportunity/risk/customer candidate populations -> product business state after transfer;
- source document -> Knowledge;
- source fact/event/population -> Data Engine.

The old `RESOLVED_VALUE` and `STATISTICAL_ESTIMATE` BrainAsset types therefore require migration review. They must not remain default long-term Brain ownership merely because the current registry can persist them.

## Exact Core implementation inventory

- `brain-evidence-resolver.ts`: implemented. Treat as a Brain Research/source-resolution primitive. Preserve it, but remove the assumption that a resolved object must become a durable Brain value.
- `brain-confidence-engine.ts`: implemented. Treat as a Brain Evaluation primitive and later generalize it to method evaluation/calibration.
- `brain-build-runtime.ts`: implemented but narrow. It currently maps only `EXACT` to `RESOLVED_VALUE` and statistical/model values to `STATISTICAL_ESTIMATE`. Migrate it toward Method/Executable Package compilation.
- `brain-asset-registry.ts`: implemented. Preserve its generic version/lifecycle mechanics, but re-contract the registry around Method/Method Package rather than resolved populations.
- `brain-asset-registry-postgres.ts`: implemented. Preserve persistence mechanics; schema migration must follow the Method Contract design.
- `brain-self-audit.ts`: implemented. Preserve useful detection primitives, but narrow gaps toward method/coverage/evaluation gaps rather than object-level cognition inventory.
- `brain-gap-registry.ts`: implemented in memory. Treat as a research-planning artifact registry and defer durability until the Method Improvement Loop is justified.
- `services/core/src/main.ts`: no Brain wiring. This is important: the current Brain foundation is not in the Core production boot path, so contract migration can proceed without live Brain traffic migration.
- `services/capability-engine/src/capability-runtime.ts`: implemented production-oriented governed runtime. Extend it with Method Package provenance/applicability and execution classes; do not create a parallel runtime.

## Contract-level inventory

Current `packages/contracts/src/brain.ts` confirms the old contract centers on `BrainAssetVersion`, with 12 asset types including `RESOLVED_VALUE`, `STATISTICAL_ESTIMATE`, method-like assets, pattern/cluster/prior artifacts and `EVALUATION_SET`. It also already contains reusable primitives worth preserving: source ownership, evidence refs, confidence factors, lifecycle states, scope, effective windows and fail-closed operational resolution states.

Current `packages/contracts/src/brain-build.ts` confirms the compiler input is already-prepared `BrainEvidenceAssertion[]` plus one `domain/jurisdiction/concept/asOf` query and quality evidence. This is not sufficient for the new Brain Research model because it has no first-class Knowledge research plan, Data Engine research dataset/query plan, hypothesis/feature/evaluation plan, applicability target or executable-method output contract.

### Contract migration decisions

- `BrainEvidenceRef`: preserve as a lineage primitive. Add typed source-section/query/dataset refs rather than overloading generic strings.
- `BrainConfidence` and its factors: preserve as an evaluation primitive. Method-type-specific calibration can extend it later.
- `BrainAssetScope`: do not reuse unchanged. Replace or augment it with `MethodApplicability` plus separate effective/version scope.
- `BrainAssetVersion`: keep only as a legacy compatibility object. The long-term registry should store `BrainMethodVersion` and `ExecutableMethodPackageVersion`.
- `BrainOperationalResolution`: move toward a Resolver Capability output/reference materialization contract, not a primary Brain-owned asset.
- `BrainBuildRequest`: replace for new work with `BrainResearchMissionV1` plus a candidate-method compilation contract.
- `BrainBuildRun`: preserve run-lineage ideas but redefine them around Research, Evaluation and Compilation stages.
- `BrainGap`: retain only for method, coverage, performance and capability research gaps. Object-level gap growth is prohibited.

## Phase 0 migration classes

- `RULESET`: Brain Method candidate; preserve and recontract.
- `DECISION_GRAPH`: Brain Method candidate; preserve and recontract.
- `REASONING_METHOD`: Brain Method; preserve.
- `HEURISTIC`: Brain Method; preserve with applicability and evaluation.
- `SCORING_MODEL`: Brain Method; preserve with executable package support.
- `RETRIEVAL_PROFILE`: Brain Method; preserve for Knowledge research/refresh use.
- `EVALUATION_SET`: Brain Research/Evaluation artifact; preserve but do not expose it as a production method.
- `CASE_PATTERN` / `CASE_CLUSTER`: research artifact or Method support; audit ownership and size, and do not create an object population store.
- `STATISTICAL_PRIOR`: Method parameter or evaluated aggregate; audit case by case.
- `RESOLVED_VALUE`: Capability Reference Materialization; migrate out of Brain long-term ownership.
- `STATISTICAL_ESTIMATE`: Capability aggregate or Method parameter; migrate case by case.
- BrainGap object-level findings: evaluation/research planning artifact only when method/coverage oriented; do not grow into an object store.

## Capability Runtime delta now proven

The current runtime already provides most governance mechanics needed by the future fast path. The minimum delta is not a rewrite. It is:

1. bind `method_id` plus exact `method_version` or executable package identity into implementation selection and output provenance;
2. add method applicability/fallback enforcement before execution;
3. distinguish execution classes: `COMPILED`, `REFERENCE`, `ANALYTICAL`, `DISCOVERY`;
4. allow stable reference-store lookup/materialization and analytical materialization while forbidding durable business-candidate pools;
5. preserve current capability definition, implementation-profile, invocation, outcome, return, receipt, evidence, replay and risk-authority semantics.

## Proposed minimum new cross-repository contracts

Phase 1 should not begin implementation until these minimum contracts are agreed.

### `BrainResearchMissionV1`

- problem/capability demand;
- target method family and applicability target;
- Knowledge research inputs/query plan;
- Data Engine research inputs via reproducible dataset refs/query plan;
- hypothesis/features/evaluation plan;
- success/baseline metrics.

### `KnowledgeResearchSourceRefV1`

- canonical document/version/fingerprint;
- exact section/heading/range where available;
- source authority and temporal metadata;
- retrieval/navigation rationale.

### `ResearchDatasetRefV1`

- fact schema/resource scope;
- deterministic query/filter/as-of boundary;
- snapshot/watermark;
- sample rule/seed when used;
- row/count/schema/digest lineage.

### `BrainMethodContractV1`

- family/version/purpose;
- applicability;
- required inputs/features;
- algorithm/rules/parameters;
- output contract;
- limitations/coverage/evaluation/fallback/lineage/lifecycle.

### `ExecutableMethodPackageV1`

- immutable package identity/version;
- applicability matcher;
- executable rules/model/parameters/feature definitions;
- required Data Engine/reference dependencies;
- reason codes/output schema;
- evaluation summary and lineage.

### `CapabilityMethodBindingV1`

- capability/version -> allowed method family/package;
- method selection reason;
- execution class;
- cache/materialization policy;
- output provenance.

## Immediate implementation order after Phase 0 closes

1. Freeze the three upstream research-source contracts with Knowledge/Data Engine.
2. Implement `BrainResearchMissionV1`, `BrainMethodContractV1` and `ExecutableMethodPackageV1` as contracts only.
3. Define Method Registry migration from current Brain Asset registry mechanics.
4. Define Capability Method Binding V1 and execution-class contracts.
5. Migrate one narrow reference pilot and one Data Engine research pilot before broad method conversion.

## Remaining Phase 0 exit blockers

- Knowledge relationship/retrieval audit (#542) must state exactly what can populate `KnowledgeResearchSourceRefV1`.
- Data Engine research/query audit (#311) must state exactly what can populate `ResearchDatasetRefV1`.
- Cross-repository architecture review must accept these minimum contracts before Phase 1 implementation.
