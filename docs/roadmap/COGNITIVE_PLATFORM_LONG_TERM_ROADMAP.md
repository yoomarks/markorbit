# MarkOrbit Cognitive Platform Long-Term Roadmap

Status: Proposed cross-repository roadmap

## Objective

Build a cognitive platform in which:

- Knowledge preserves and exposes documentary evidence and navigation signals;
- Data Engine preserves and serves objective facts and reproducible research datasets at scale;
- Brain Research consumes both Knowledge and Data Engine to discover and validate reusable methods;
- Brain compiles validated research into ACTIVE executable method packages;
- Capability executes those methods efficiently for products;
- MarkReg/Lite/Radar own business lifecycle state and return governed evaluation evidence.

Autonomous self-improvement is intentionally delayed until the Method, Capability, Research, Evaluation, and Feedback foundations are proven in production.

## Program principles

1. Knowledge and Data Engine are both first-class Brain Research inputs.
2. Brain must not copy source populations into long-term ownership.
3. Capability must not re-run Brain Research on ordinary production requests.
4. Knowledge should normally be off the production hot path after method compilation, except controlled reference refresh or explicitly justified live retrieval.
5. Data Engine serves both Brain Research and Capability Runtime.
6. Capability must not own product candidate pools.
7. Data Engine must not become an interpretation/recommendation engine.
8. Knowledge must not become a recommendation engine.
9. Every production method requires applicability, limitations, lineage, evaluation, and executable package identity.
10. Brain may propose methods but may not auto-activate them.
11. Prefer narrow validated method families over universal models with hidden scope assumptions.
12. Every production intelligence result should be attributable to a method version and reproducible input scope/snapshot where technically possible.

## Phase 0 — Current-state audit and migration map

Repositories: Core, Knowledge, Data Engine

Deliverables:

- inventory current BrainAsset types and implementations;
- classify each as Method Definition, Executable Method Package, Method Metadata, Research Evidence, Execution Result, Cached Reference, Materialized Aggregate, Business State, or obsolete/deferred;
- inventory Knowledge Obsidian/Vault relationship and retrieval signals actually implemented;
- inventory Data Engine query, historical, analytical, sampling, and reproducible-dataset primitives actually implemented;
- inventory existing Core/Capability-like endpoints and direct Brain consumers;
- identify every place where Capability would currently need to re-read Knowledge because no compiled/materialized path exists;
- document migration/deprecation plan for design drift.

Exit gate:

- one cross-repository ownership and runtime map is approved;
- no new Brain feature work conflicts with the new research/compile/execute model.

## Phase 1 — Brain Research Contract + Method Contract V1

Primary repository: Core; cross-repo contracts with Knowledge/Data Engine

Deliverables:

- Brain Research Mission contract;
- research input contract for Knowledge document sets and Data Engine datasets;
- Method Contract V1;
- Method Family and specialization model;
- Applicability Contract;
- limitations and required inputs/features;
- evaluation metadata and research lineage;
- lifecycle, supersession, and fallback;
- Executable Method Package contract;
- deterministic Method Selector contract.

Exit gate:

- one research mission can identify exact Knowledge and/or Data Engine inputs;
- one method can be proposed, evaluated, compiled, activated, selected, rejected as not applicable, and superseded deterministically.

## Phase 2 — Knowledge Research + Reference Resolution Pilot

Primary repositories: Knowledge + Core

Recommended pilots:

- Official Fee Resolution;
- Deadline / operation-window Resolution;
- one filing-basis/rule interpretation family.

Workstreams:

- canonical Markdown retrieval with provenance/version identity;
- measure metadata, lexical, semantic, and relationship-assisted retrieval;
- use Obsidian/Vault relationships only where real and useful;
- authority and temporal-resolution research methods;
- compile resulting method into executable package/decision graph where possible;
- create controlled Reference Materializer and Reference Store;
- ensure high-frequency Capability reads do not repeatedly invoke full Knowledge retrieval.

Exit gate:

- real Knowledge Markdown can produce a reproducible method and materialized current reference;
- repeated capability calls run from compiled/materialized state rather than full research;
- Obsidian enhancement is either justified by measured value or deliberately kept minimal.

## Phase 3 — Data Engine Research Foundation

Primary repositories: Data Engine + Core

Required Data Engine work:

- reproducible query/dataset identity;
- historical snapshots/change-feed access;
- duration and status-transition primitives;
- grouped/time-series aggregations;
- joins/traversal across trademark/entity/assignment/event facts;
- deterministic streaming/pagination;
- bounded sampling;
- train/validation/backtest dataset support or equivalent reproducible partitioning;
- objective factual pre-aggregations where scale requires them.

Brain Research pilots:

- examination-time analysis;
- entity resolution;
- one risk model;
- one opportunity model.

Exit gate:

- Brain Research can analyze and backtest against real Data Engine populations without long-term population copy;
- every research/evaluation run has reproducible dataset/query lineage;
- at least one validated data-driven method can be compiled into an executable package.

## Phase 4 — Capability Runtime V1

Primary repository: Core

Deliverables:

- Capability Catalog and stable contracts;
- executable Method Package loader/runtime;
- Method Selector integration;
- applicability fail-closed behavior;
- Reference Store read path;
- aggregate materialization path;
- Data Engine live execution adapter;
- no-cache Discovery candidate streaming/pagination;
- output provenance and execution audit.

Minimum production coverage:

- 1 Resolver Capability using Reference Store;
- 1 Analytical Capability using Data Engine;
- 1 Scoring/Interpretation Capability using Data Engine/current input;
- 1 Discovery Capability using Data Engine/current input.

Exit gate:

- products consume compiled intelligence through Capability;
- ordinary production requests do not re-run Brain Research.

## Phase 5 — Product consumption and business-state ownership

Primary repository: Core/MarkReg product domains

Initial use cases:

- current fee/deadline resolution;
- trademark status/rule interpretation;
- examination-time analytics;
- entity resolution/relationship candidate review;
- renewal opportunity discovery;
- expansion opportunity discovery;
- application risk scoring.

Business-state rule:

- imported opportunities, risk worklists, reviewed relationships, assignments, campaign state, contact state, exclusions, and conversions are owned by MarkReg/product domains.

Exit gate:

- Brain and Capability do not own product lifecycle records;
- business systems retain method provenance when they persist results.

## Phase 6 — Evaluation and Feedback Plane

Primary repository: Core with product integrations

Deliverables:

- Method Outcome Evidence contract;
- method-version-linked performance reporting;
- aggregate and segment metrics;
- governed false-positive/false-negative samples;
- override-reason taxonomy;
- calibration/drift reporting;
- champion/challenger comparison where appropriate;
- feedback links to original research/evaluation definitions.

Exit gate:

- production method quality can be measured from real product outcomes without importing full product populations into Brain.

## Phase 7 — Method Improvement Loop

Primary repository: Core/Brain

Only start after Phases 0-6 are proven.

Allowed triggers:

- Capability Gap;
- Performance Gap;
- Coverage Gap;
- Brain Research Discovery.

Flow:

`gap -> Research Mission -> Knowledge/Data Engine research -> candidate method -> backtest/evaluation -> compile -> shadow/pilot -> governance -> ACTIVE`

Brain may propose, research, evaluate, and compile. Brain may not auto-promote to ACTIVE.

## Initial required method families

Foundation families:

1. Retrieval
2. Source Resolution
3. Temporal Resolution
4. Classification
5. Entity Resolution
6. Relationship Inference
7. Aggregation
8. Statistical Analysis
9. Scoring
10. Ranking
11. Risk
12. Opportunity
13. Evaluation/Calibration
14. Method Selection

Initial scoped production candidates:

- Official Trademark Fee Resolution;
- Trademark Deadline Resolution;
- Filing Basis / Rule Interpretation for a narrow jurisdiction;
- Examination-Time Statistics;
- US Corporate Entity Resolution;
- Renewal Opportunity Propensity;
- Jurisdiction Expansion Opportunity;
- Application Risk.

These are candidates, not automatic commitments. Product value, data readiness, applicability scope, evaluation feasibility, and execution cost must be confirmed before implementation.

## Cross-repository sequencing rule

A cross-repository feature should not begin implementation until its research inputs, method ownership, executable package, runtime consumer, result ownership, and exit criteria are frozen.

Recommended order:

1. product/capability problem definition;
2. Brain Research Mission definition;
3. Knowledge/Data Engine research-input contract;
4. research and evaluation;
5. Method Contract + executable package;
6. Capability execution;
7. product consumption;
8. outcome evaluation;
9. only then automated improvement.

## Review cadence

At the end of each phase, conduct a cross-repository architecture review answering:

- Did any repository absorb data/state it should not own?
- Does Brain Research use both Knowledge and Data Engine where the problem requires both?
- Can the method be reproduced from research lineage?
- Can the production result be reproduced from Method Version + input/query/reference scope?
- Did Capability accidentally re-run research instead of executing a compiled method?
- Is Knowledge unnecessarily in the hot path?
- Did a general method silently exceed its applicability scope?
- Are Reference Store/materialized aggregates correctly invalidated?
- Did a candidate result become hidden business state outside the product?
- Is the next phase justified by measured platform/product value?

The roadmap may evolve, but changes to ownership or research/production-path invariants require an explicit architecture decision.
