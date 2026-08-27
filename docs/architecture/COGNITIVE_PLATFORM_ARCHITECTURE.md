# MarkOrbit Cognitive Platform Architecture

Status: Proposed architecture baseline for cross-repository adoption

## 1. Purpose

This document defines the long-term boundary between MarkOrbit Knowledge, Data Engine, Brain, Capability, and product runtimes such as MarkReg, Lite, and Radar.

The governing model is:

> Knowledge owns documents. Data Engine owns facts. Brain researches and publishes reusable methods. Capability executes ACTIVE methods. Products own business state.

The platform has two distinct planes:

1. **Research / compilation plane** — Brain Research consumes both Knowledge and Data Engine to discover, validate, compile, version, and publish methods.
2. **Production execution plane** — Capability consumes ACTIVE executable method packages and current inputs. Knowledge should usually be off the hot path; Data Engine may remain on the hot path for live factual execution.

## 2. System responsibilities

### 2.1 Knowledge — document truth

Knowledge owns source acquisition, canonical Markdown, provenance, versions, review/staging, and explicit navigation signals.

Knowledge may expose headings, tags, links, backlinks, related-document links, supersession links, jurisdiction/source relationships, and other Obsidian/Vault-derived signals only when those signals are concretely represented and governed.

Knowledge does not own product intelligence conclusions, customer/entity conclusions, risk scores, opportunity pools, current resolved fees/deadlines as business state, or method policy.

### 2.2 Data Engine — fact truth and research substrate

Data Engine owns objective structured facts and factual history, including trademark, entity, case, assignment, status, event, timeline, and historical records.

Data Engine serves two consumers:

- **Brain Research** for sampling, statistical analysis, hypothesis testing, feature discovery, training, calibration, and backtesting;
- **Capability Runtime** for executing ACTIVE methods against current facts at scale.

Data Engine should provide efficient objective query/aggregation primitives, reproducible dataset/query identity, historical snapshot access, joins/traversal, time-series, status-transition, duration, and bounded sampling support.

Data Engine does not own inferred risk, opportunity, customer propensity, probable group membership, recommendation policy, or product workflow state.

### 2.3 Brain — research, method compilation, and method registry

Brain is not a population store and should not maintain object-level conclusions as its primary assets.

Its defining invariant is:

> Brain does not store the world. Brain stores validated ways to understand the world.

Brain has three responsibilities:

1. **Brain Research** — consume Knowledge and Data Engine to form hypotheses, discover reusable patterns, define features, compare algorithms/rules, and evaluate candidate methods.
2. **Method Compilation** — convert validated research into deterministic or bounded executable method packages.
3. **Method Registry** — version, govern, select, supersede, and publish ACTIVE methods.

Brain assets should primarily be Method Definitions, Executable Method Packages, method-family metadata, applicability contracts, feature definitions, evaluation evidence, calibration policy, fallback, and supersession relationships.

### 2.4 Capability — production execution boundary

Capability is the only supported product-facing execution boundary for reusable intelligence.

Products should consume capabilities, not Brain internals.

Capability is responsible for:

- selecting an ACTIVE applicable method;
- validating required inputs and scope;
- executing the compiled method package;
- reading current Data Engine facts when the method requires them;
- reading a materialized reference store for stable resolved constants;
- invoking controlled Knowledge refresh only where a reference-resolution capability requires source refresh;
- returning stable outputs with method provenance;
- applying permitted cache/materialization policy;
- retaining execution audit metadata.

Capability must not become a business candidate pool or CRM.

### 2.5 Products — business lifecycle ownership

MarkReg, Lite, Radar, CRM/marketing, and future product domains own business lifecycle state.

Once a business candidate is consumed, the product owns deduplication, exclusion, assignment, campaign state, contact state, follow-up, conversion, expiry, and other workflow fields.

## 3. The two primary runtime paths

### 3.1 Slow path — Brain Research and recompilation

```text
Knowledge ------------------┐
                            │
                            v
                       Brain Research
                            ^
                            │
Data Engine ----------------┘
          |
          v
hypothesis / feature discovery / statistics / training / backtest
          |
          v
Candidate Method
          |
          v
Evaluation + Governance
          |
          v
Compile
          |
          v
ACTIVE Executable Method Package
```

Knowledge and Data Engine are both first-class Brain Research inputs.

### 3.2 Fast path — Capability execution

```text
ACTIVE Executable Method Package
              |
              v
        Capability Runtime <----- Data Engine current facts
              |
              +----> Reference Store for stable resolved values
              |
              v
            Product
```

Knowledge should not be read for every ordinary capability request. It belongs primarily to research/recompile and controlled reference refresh paths.

## 4. Brain Method Contract

Every production Method must define at least:

- `method_id`;
- `method_family`;
- `version`;
- `purpose`;
- target object/problem;
- `applicability`;
- required inputs;
- feature definitions when relevant;
- algorithm/rules/parameters;
- executable artifact/package identity;
- output contract;
- coverage;
- known limitations;
- confidence/calibration policy when relevant;
- evaluation evidence;
- fallback behavior;
- Knowledge and/or Data Engine research lineage;
- effective window when relevant;
- lifecycle state;
- supersedes/superseded-by links.

Applicability is mandatory and may include jurisdiction, authority, object type, operation, procedure, filing basis, stage, segment, temporal scope, and required data availability.

Outside scope must fail closed with `NOT_APPLICABLE` or an explicit applicable fallback. Low confidence is not a substitute for applicability.

## 5. Method families

Initial foundation families include:

- Retrieval;
- Source Resolution;
- Temporal Resolution;
- Classification;
- Entity Resolution;
- Relationship Inference;
- Aggregation;
- Statistical Analysis;
- Scoring;
- Ranking;
- Risk;
- Opportunity;
- Evaluation/Calibration;
- Method Selection.

Methods may be global or specialized by country, authority, procedure, object type, segment, or historical period. Specialized methods are expected and may supersede broader methods for matching requests.

## 6. How methods are formed

A Method Research Mission should include:

1. problem and success-metric definition;
2. required Capability output contract;
3. Knowledge research plan and/or Data Engine research dataset plan;
4. hypothesis and feature discovery;
5. candidate rule/model/algorithm generation;
6. baseline comparison;
7. backtest/evidence validation;
8. segment and limitation analysis;
9. applicability definition;
10. executable package compilation;
11. governance review;
12. shadow/pilot before ACTIVE where appropriate.

A method may be proposed because of a Capability Gap, Performance Gap, Coverage Gap, or Brain Research Discovery. Brain may propose; it may not auto-activate.

## 7. Executable Method Package

Capability should not need to re-read the research corpus to execute a mature method.

An executable package should contain or reference:

- method identity/version;
- applicability matcher;
- input schema;
- feature extractor definitions;
- decision graph/rules/model artifact/parameters;
- Data Engine query requirements where applicable;
- reference dependencies;
- output schema;
- reason-code dictionary;
- fallback rules;
- source/research lineage summary;
- evaluation summary.

This is the core efficiency boundary between Brain and Capability.

## 8. Reference materialization

Stable resolved values such as official fees, statutory periods, grace periods, operation windows, and similar knowledge constants should not require full Knowledge retrieval on every request.

Pattern:

```text
Knowledge -> Brain Resolution Method -> controlled refresh/materializer -> Capability Reference Store -> high-frequency reads
```

Each materialized reference must bind method version, Knowledge source/version identity, input scope, resolved time, and invalidation/expiry policy.

## 9. Analytical execution

For risk, opportunity, entity, status, trend, duration, ranking, and similar data-driven capabilities:

```text
Brain ACTIVE Method + Data Engine current facts -> Capability Runtime -> transient result
```

Data Engine may also support objective pre-aggregations and reproducible research datasets, but business scoring policy remains in Brain methods.

## 10. Result ownership

### Stable references

Capability may cache/materialize them.

### Expensive shared aggregates

Capability may materialize them when they are reusable analytical outputs and are tied to method version plus reproducible Data Engine query/dataset identity.

### Business candidates

Opportunity, risk worklist, relationship-review, and similar candidate populations must not be cached as Capability-owned pools. They are transient outputs transferred to the consuming product if retained.

### Single-object interpretations

Capability returns them. If a product needs them durably, the product stores them with method provenance.

## 11. Feedback and learning

Products return Method Outcome Evidence, not their full business populations.

Useful feedback includes aggregate performance, precision/recall, conversion uplift, false-positive/false-negative governed samples, overrides, calibration error, drift, and segment performance.

Future self-improvement is therefore a Method Improvement Loop:

`Method -> Capability execution -> Product outcome -> Evaluation evidence -> Candidate Method Version -> backtest/pilot -> governance -> ACTIVE`

The unit of Brain growth is Method Version.

## 12. Architecture invariants

1. Knowledge owns documents.
2. Data Engine owns facts.
3. Brain Research consumes both Knowledge and Data Engine.
4. Brain owns reusable validated methods and executable method packages, not source populations or business populations.
5. Capability owns execution, not business lifecycle state.
6. Products own business lifecycle state.
7. Knowledge is normally off the production hot path after method compilation, except controlled reference refresh or explicitly justified live retrieval.
8. Data Engine may be on both the research path and the production execution path.
9. Stable references may be cached/materialized; expensive shared aggregates may be materialized; business candidates may not be cached as Capability-owned pools.
10. Every production method must declare applicability, limitations, evaluation, and lineage.
11. Out-of-scope methods fail closed.
12. Brain may propose methods but may not auto-activate them.
13. Every intelligence result should identify method version and reproducible input scope/snapshot where technically possible.
14. Brain improvement means improving method versions, not accumulating object-level conclusions.

## 13. Working model

> Knowledge is deep. Data Engine is large. Brain is precise. Capability is fast.

Operationally:

> Knowledge preserves what we have read. Data Engine preserves what happened. Brain researches how to interpret and calculate from both. Brain compiles validated methods. Capability executes those methods efficiently. Products decide what to do next.
