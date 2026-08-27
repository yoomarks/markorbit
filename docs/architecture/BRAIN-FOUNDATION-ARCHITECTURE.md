# MarkOrbit Brain Foundation Architecture

- Program: `BRAIN-FOUNDATION`
- Initial scope: `BRN-000` / `BRN-001` / `BRN-002`
- Production action authority: `false`
- Model/provider authority: `false`

## 1. Purpose

Brain is MarkOrbit's governed cognitive layer. It converts source-owned evidence into versioned, recomputable operational intelligence and reasoning assets, then reuses those assets for case-specific reasoning.

Brain is not a chatbot, prompt library, Knowledge replacement, Official Truth owner, business-record owner or external action executor.

The working definition is:

`Brain = Resolved Operational Intelligence + Precomputed Reasoning Assets + Incremental Case Intelligence + Cognitive Self-Audit + Continuous Recompilation`.

## 2. Permanent source ownership

| System | Owns | Does not own |
| --- | --- | --- |
| Data Engine | external/raw structured data, events, source statistics | professional interpretation |
| Knowledge | raw evidence, documents, regulations, cases, articles, expert evidence and source lineage | final operational resolution |
| MarkReg | customer, trademark, FormalMatter and service/business truth | generic cognitive methods |
| Brain | derived/resolved operational intelligence, reasoning methods, patterns, estimates, confidence and cognitive gaps | source truth or official truth |
| Capability Runtime | governed execution/admission and implementation binding | professional meaning of evidence |

Brain persistence stores immutable source references, versions and fingerprints. It must not copy source-owned canonical records merely to make them convenient to query.

## 3. Cognitive separation

The following states are distinct and must not be collapsed:

`Evidence Truth -> Resolved Operational Intelligence -> Case Interpretation -> Recommendation -> Action`.

Examples:

- Knowledge may retain multiple current and historical sources describing a filing fee.
- Brain may resolve those sources into the current best operational value with scope, effective window and confidence.
- A case analysis may use that resolved value together with case facts.
- A recommendation may propose an action.
- Only an authorized governed Capability may execute SEND/PAY/FILE/SUBMIT/PUBLISH consequences.

## 4. Two runtime model

### Brain Build Runtime

Slow/continuous cognition compilation. Future BRN lanes will provide evidence resolution, conflict detection, statistical derivation, confidence calculation, evaluation, self-audit and recompilation.

Build outputs are Brain Asset candidates. Build output is not ACTIVE merely because an AI or algorithm generated it.

### Brain Case Runtime

Fast/incremental reasoning for an actual subject or case. It loads ACTIVE Brain Assets and computes only case-specific deltas, uncertainty and novelty. Case Runtime is not implemented in BRN-000..002.

## 5. Brain Asset canon

A Brain Asset is a versioned derived cognition object. V1 reserves these types:

- `RESOLVED_VALUE`
- `STATISTICAL_ESTIMATE`
- `RULESET`
- `DECISION_GRAPH`
- `REASONING_METHOD`
- `CASE_PATTERN`
- `CASE_CLUSTER`
- `HEURISTIC`
- `STATISTICAL_PRIOR`
- `SCORING_MODEL`
- `RETRIEVAL_PROFILE`
- `EVALUATION_SET`

Assets are scoped by domain, optional jurisdiction, concept, input/output schema and effective window.

Asset lifecycle:

`DRAFT -> CANDIDATE -> VALIDATED -> ACTIVE`

Additional dispositions:

- `DEGRADED`: previously useful cognition no longer meets current quality/freshness requirements.
- `RETIRED`: historical only and unavailable for current operational resolution.

Historical versions remain addressable for audit/replay. Recalculation creates a new immutable version rather than rewriting the version used by an earlier Brain Run.

## 6. Evidence grounding

Every `VALIDATED`, `ACTIVE` or `DEGRADED` asset requires source evidence references and validation evidence.

A Brain evidence reference includes:

- source owner;
- source object identity;
- source version;
- immutable SHA-256 fingerprint;
- optional observation time.

Evidence references prove derivation. They do not transfer source ownership to Brain.

## 7. Confidence

Confidence is decomposable evidence, not an LLM's self-reported probability.

V1 contract factors are:

- authority;
- freshness;
- agreement;
- coverage;
- validation;
- method quality.

Later Build Runtime work may add deterministic weighting, statistical calibration and asset-type-specific quality models while preserving these explainable inputs.

## 8. Operational resolution

Consumers must not independently choose among conflicting Knowledge sources. Brain exposes a machine-consumable resolved state with:

- concept and jurisdiction scope;
- as-of time;
- exact asset-version attribution;
- evidence refs;
- confidence;
- value kind;
- explanation.

Brain must also represent failure to resolve explicitly:

- `UNKNOWN`
- `INSUFFICIENT_EVIDENCE`
- `CONFLICTED`

No unresolved state may manufacture an exact value.

## 9. Cognitive self-audit

Cognitive self-audit is a Brain Foundation V1 requirement even though the runtime is implemented after BRN-002.

Reserved gap classes include:

- missing evidence;
- stale evidence;
- conflicting evidence;
- insufficient sample;
- low confidence;
- missing jurisdiction coverage;
- missing reasoning method or pattern;
- missing capability;
- low model quality / high human override;
- novel case.

Future gaps route structured improvement missions to the owning module: Knowledge, Data Engine, MarkReg analytics, Expert/Human Review, Brain Build or Capability.

Gap closure requires new evidence or method changes, recompilation, evaluation and measurable quality/confidence improvement. Merely collecting another source does not close a gap.

## 10. Capability interaction

Brain may consume governed read/analyze/compute/retrieve capabilities, including managed AI, retrieval, document extraction or statistical computation.

Brain may itself be exposed as a governed Capability implementation, for example an operational resolver or a future case-analysis profile.

Dependency direction remains clean:

- Brain may call Capability Runtime.
- Capability Runtime does not depend on Brain internals; it binds to implementation keys/contracts.
- Brain contracts expose no provider/model/credential selection authority.
- Brain output grants no automatic external-action authority.

## 11. BRN-002 registry foundation

The initial registry is deliberately in-memory and lives inside the existing Core service package to avoid premature deployment and persistence topology decisions.

It proves:

- immutable asset versions;
- contiguous version lineage;
- governed lifecycle transitions;
- stable asset identity scope;
- ACTIVE resolution by domain/jurisdiction/concept/effective time;
- fail-closed missing/ambiguous/degraded behavior;
- historical version retrieval.

A later dedicated persistence lane may move Brain into its own deployable service once ownership, workload and deployment requirements justify that split. That change must preserve the BRN-001 contracts and registry conformance semantics.

## 12. Explicit non-goals for the first PR

- no US fee/timeline values;
- no large-model prompt implementation;
- no provider credentials;
- no Case Runtime;
- no cross-repository data ingestion;
- no PostgreSQL migration;
- no automatic external action;
- no claim that Brain outputs are legal/official truth.

## 13. Next sequence

After BRN-000..002 are accepted:

1. `BRN-003` Evidence Resolution Engine.
2. `BRN-004` Confidence Engine.
3. `BRN-005` Operational Resolver.
4. `BRN-006..008` Cognitive Self-Audit, Gap Registry and Improvement Mission.
5. `BRN-009..010` Build Runtime and Evaluation Runtime.
6. `BRN-011` US Trademark Operational Intelligence V1.
7. only then begin Case Runtime and domain reasoning profiles.
