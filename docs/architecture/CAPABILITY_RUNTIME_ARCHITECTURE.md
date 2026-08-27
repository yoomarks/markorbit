# MarkOrbit Capability Runtime Architecture

Status: Proposed architecture baseline

## 1. Role

Capability is the product-facing execution boundary for reusable intelligence.

Products consume capabilities. Capabilities consume ACTIVE executable Brain Method Packages plus current factual inputs. Products must not depend directly on Brain research internals.

> Brain researches and compiles how to calculate. Capability runs the compiled method. Products own what happens next.

## 2. Runtime principle

Capability must not re-run Brain Research on ordinary requests.

The default production path is:

```text
ACTIVE Method Package + current inputs -> Capability Runtime -> output
```

Knowledge is normally off the hot path after method compilation. Data Engine may remain on the hot path because many methods require current trademark/entity/case facts.

For stable knowledge constants, Capability should read a Reference Store populated by controlled refresh/materialization rather than repeatedly retrieving Markdown.

## 3. Capability contract

Every production capability should define:

- capability identity/version;
- business purpose;
- input contract;
- output contract;
- allowed method families;
- method-selection context;
- live data dependencies;
- reference dependencies;
- latency/throughput class;
- cache/materialization policy;
- audit/provenance fields;
- failure and `NOT_APPLICABLE` semantics.

## 4. Capability classes

### Resolver Capability

Resolves relatively stable references or rules using an ACTIVE Brain resolution method.

Examples:

- official fees;
- statutory periods;
- grace periods;
- filing-basis/rule interpretations;
- operation windows.

Preferred runtime:

```text
Knowledge -> controlled refresh -> Brain resolution method -> Reference Store -> Capability read
```

Direct Knowledge retrieval at request time should be exceptional and justified.

### Analytical Capability

Computes reusable statistics or analytical outputs over Data Engine facts using ACTIVE analytical methods.

Examples:

- filing-volume statistics;
- examination-time statistics;
- status-transition statistics;
- portfolio statistics.

Expensive shared aggregates may be materialized with method version and reproducible dataset/query lineage.

### Scoring / Interpretation Capability

Applies a scoped Brain method to an object or bounded set of objects using current Data Engine facts or supplied inputs.

Examples:

- application risk;
- entity-match probability;
- portfolio classification;
- expected registration duration.

Capability returns the result and method provenance but does not become the long-term owner of the interpretation.

### Discovery Capability

Discovers transient business candidates using ACTIVE methods and current Data Engine facts.

Examples:

- renewal opportunities;
- expansion opportunities;
- dead-mark opportunities;
- relationship-review candidates;
- high-risk case candidates.

Discovery results must not be cached as Capability-owned candidate pools. The consumer imports candidates it wishes to operate and owns lifecycle state thereafter.

## 5. Cache and materialization policy

### Allowed — Reference Store

Use for stable values such as fees, deadlines, and operation windows.

Required metadata:

- method version;
- Knowledge source/document version;
- input scope;
- resolved time;
- expiry/invalidation policy.

### Allowed — Aggregate materialization

Use for expensive shared statistics.

Required metadata:

- method version;
- Data Engine dataset/query identity;
- calculation time;
- validity window;
- aggregation definition.

### Forbidden — Business-candidate pool cache

Opportunity/risk/review candidate populations must not be maintained by Capability.

Capability may keep execution audit metadata such as execution ID, method version, input/query scope, start/end time, and returned count.

## 6. Method selection and applicability

Capability must never select a method solely by name.

Selection must consider:

- jurisdiction;
- authority;
- object type;
- operation;
- procedure/stage;
- filing basis where relevant;
- temporal context;
- segment;
- required data availability;
- method lifecycle state;
- applicability/fallback contracts.

Out-of-scope must fail closed with `NOT_APPLICABLE` or an explicit fallback. Low confidence is not a substitute for applicability.

## 7. Executable Method Package consumption

Capability executes a package that already contains or references the production form of the method, such as:

- applicability matcher;
- input schema;
- feature extraction definition;
- decision graph/rules/model artifact/parameters;
- Data Engine query requirements;
- reference dependencies;
- output schema;
- reason-code dictionary;
- fallback behavior;
- method/evaluation metadata.

Capability should not need to re-read the research corpus to understand how to execute the method.

## 8. Data Engine interaction

Data Engine has a dual role in the cognitive platform:

1. Brain Research consumes Data Engine for sampling, feature discovery, statistics, training, calibration, and backtesting.
2. Capability Runtime consumes Data Engine for current factual execution.

Capability should prefer bounded, explicit, reproducible Data Engine queries and avoid copying large factual populations into Core/Brain storage.

## 9. Knowledge interaction

Knowledge is primarily a Brain Research and controlled reference-refresh dependency.

Live Capability-to-Knowledge reads are allowed only when the capability contract explicitly requires fresh document resolution and the latency/cost trade-off is accepted.

## 10. Provenance

Where technically possible, every Capability output must identify:

- capability version;
- method ID/version;
- method-selection reason;
- applicable Data Engine query/snapshot identity and/or Knowledge reference version;
- calculated/resolved time;
- confidence/calibration output when relevant;
- limitation/fallback indicators.

## 11. Product handoff

When a product persists a Capability result, the product becomes owner of the business state.

Example:

`Brain Opportunity Method -> Discovery Capability -> transient candidate stream -> MarkReg opportunity pool -> dedupe/exclude/assign/contact/convert`

## 12. Feedback contract

Products may return evaluation evidence tied to a method version, including aggregate performance, precision/recall, uplift, governed error samples, overrides, segment performance, drift, and calibration evidence.

Products must not dump complete business populations into Brain as a shortcut for learning.

## 13. Capability governance

A new Capability should be approved only when:

1. there is a concrete product/user need;
2. output ownership is clear;
3. required Method families are known or a Method Gap is opened;
4. Knowledge/Data Engine dependencies are explicit;
5. hot-path versus research/refresh behavior is explicit;
6. cache/materialization policy is explicit;
7. success/evaluation metrics are defined.

Capability demand is the primary planned source of Brain Method research missions.
