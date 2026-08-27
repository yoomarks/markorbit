# Brain Self-Improvement Loop Architecture Freeze

Status: proposed for BRN-008 / #276

## Purpose

Freeze the post-Foundation Brain architecture before implementation expands beyond BRN-000..007. The goal is not a prompt system. The goal is a governed cognitive improvement loop in which Brain can detect what it does not know, request typed remediation, recompute affected cognition, evaluate whether quality improved, and only then resolve the gap.

## Baseline already owned by Brain

The following are treated as existing Foundation and are not redefined here:

- Brain Asset Canon and version lifecycle.
- Evidence resolution and highest-authority conflict handling.
- Deterministic confidence evaluation.
- Brain Build Runtime and candidate/validated asset compilation.
- Brain Asset Registry and PostgreSQL durability.
- Cognitive Self-Audit.
- Longitudinal BrainGap identity, recurrence and lifecycle governance.

## Canonical loop

```text
Brain Build / Runtime
        ↓
Cognitive Self-Audit
        ↓
BrainGap Registry
        ↓
Gap Prioritization
        ↓
BrainImprovementMission
        ↓
┌───────────┬────────────┬─────────┬────────────┬────────────┐
Knowledge   Data Engine   MarkReg   Expert       Brain Build / Capability
        ↓
Governed Remediation Result
        ↓
Impacted-Asset Dependency Resolution
        ↓
Brain Recompile
        ↓
Evaluation
        ↓
New BrainAsset Version + confidence / quality delta
        ↓
Promotion decision
        ↓
Gap RESOLVED / remains OPEN / later recurrence
```

## Ownership

| Concern | Owner | Authority |
| --- | --- | --- |
| Raw evidence and source truth | Knowledge | Supplies evidence; does not choose Brain operational truth |
| Large-scale structured observations/statistics | Data Engine | Supplies typed data/statistics; does not resolve BrainGap |
| Matter/outcome/attorney feedback | MarkReg | Supplies governed business facts/outcomes |
| Professional judgment artifact | Expert | Supplies typed expert artifact; does not self-promote cognition |
| Cognitive gap state | Brain/Core | Sole owner of BrainGap lifecycle |
| Improvement mission | Brain/Core | Creates, prioritizes, routes and governs remediation work |
| Asset recompilation | Brain Build | Recomputes impacted cognition from governed inputs |
| Evaluation | Brain/Core | Compares old/new quality and acceptance criteria |
| ACTIVE promotion | Existing Brain governance authority | Remains separate from Build and Mission execution |
| External/business action | Capability | Executes governed action using Brain cognition; does not reinterpret Knowledge independently |

## BrainImprovementMission

A mission is a governed remediation request, not an autonomous agent prompt. Its minimum contract must carry:

- deterministic mission identity / fingerprint;
- one or more source BrainGap registry keys;
- objective;
- target module;
- priority result and policy version;
- required output schema / artifact kind;
- acceptance criteria;
- source BrainAsset / BuildRun lineage where applicable;
- lifecycle status and disposition lineage.

Suggested lifecycle:

```text
PROPOSED
→ APPROVED
→ RUNNING
→ EVIDENCE_RECEIVED
→ RECOMPUTING
→ VALIDATED
→ CLOSED
```

Failure is explicit (`FAILED`). Mission failure must not dismiss or resolve its source gap.

## Gap prioritization

Priority must be deterministic, versioned and explainable. It may consider:

- gap severity;
- business impact;
- affected workflows/capabilities;
- observed usage frequency;
- confidence deficit;
- staleness deficit;
- conflict materiality;
- recurrence / occurrence count;
- unresolved age;
- estimated remediation cost.

Missing telemetry must never be fabricated. Policy must define conservative behavior for unknown inputs and stable tie-breaking.

## Routing

Routing is governed by gap semantics, not free-form model choice.

Default direction:

- missing/stale/conflicting official evidence → Knowledge;
- insufficient sample/statistical coverage → Data Engine;
- missing real outcome/override evidence → MarkReg;
- unresolved professional judgment → Expert;
- missing method/pattern/model quality → Brain Build;
- missing execution ability → Capability.

A target module may satisfy a typed request but has no authority to mark the source gap resolved.

## Remediation result contract

A module response must be wrapped in a governed `BrainRemediationResult` with at least:

- mission ID;
- target module;
- typed output kind and schema version;
- source/object lineage and fingerprints;
- completion time;
- deterministic validation result.

Free-form prose alone cannot resolve a BrainGap or become ACTIVE cognition.

## Dependency and recompile

Recompilation must be impact-driven. The runtime must identify exactly which BrainAsset identities/versions depend on changed evidence/data/method inputs. Missing dependency information fails closed. The system must not silently assume that no assets are affected, and it must not default to blind global rebuild.

## Evaluation gate

Receiving stronger evidence is not equivalent to improving cognition.

Before a gap may become `RESOLVED`, evaluation must compare old and new state using explicit acceptance criteria, including where applicable:

- confidence delta;
- quality/accuracy delta;
- evidence authority/freshness/coverage delta;
- conflict resolution status;
- regression checks;
- required human-review outcome.

Evaluation recommendation should be one of `ACCEPT`, `REJECT`, or `NEEDS_REVIEW`. A zero/negative improvement may leave the gap open even when a mission completed successfully.

## Promotion boundary

Mission execution, recompilation and evaluation do not gain authority to make a BrainAsset `ACTIVE` unless the existing promotion governance explicitly allows it. AI output cannot self-promote. Build Runtime retains no automatic ACTIVE path.

## Durability requirement

The current longitudinal BrainGap semantics must be durably persisted before Mission orchestration is relied on as a production loop. Process restart must not lose occurrence count, status, first/last detection, disposition lineage or recurrence behavior.

## Fail-closed rules

The loop must fail closed when:

- no typed remediation contract exists for the target;
- target output fails schema/lineage validation;
- impacted dependencies cannot be established;
- recompilation cannot produce a valid candidate;
- evaluation cannot compare old/new cognition;
- acceptance criteria are missing or fail;
- promotion authority is absent.

None of these states may silently resolve or dismiss the BrainGap.

## Program order

1. BRN-008 — architecture and authority freeze (#276).
2. BRN-009 — PostgreSQL BrainGap durability (#277).
3. BRN-011 — deterministic gap prioritization (#279).
4. BRN-010 — BrainImprovementMission contracts/routing (#278).
5. BRN-012 — remediation result, dependency/recompile and evaluation gate (#280).
6. After the governed loop exists, prove one end-to-end US Trademark Operational Intelligence concept through Knowledge → Brain → gap → mission → remediation → rebuild → evaluation → updated canonical result.

## Non-goals

- Training a foundation model.
- Building a prompt hub.
- Letting an LLM approve its own output.
- Country-wide rule expansion before the loop is proven.
- Giving Knowledge, Data Engine, Expert, MarkReg or Capability authority over BrainGap lifecycle.
- Autonomous production actions.

## Success criterion

The architecture is successful when the following can be proven with retained runtime evidence:

```text
Raw Evidence
→ Brain resolves current operational truth
→ confidence is explainable
→ a cognitive gap is automatically detected
→ a governed mission is created and routed
→ the target module returns stronger typed evidence/data/artifact
→ impacted cognition is recomputed
→ old/new versions are evaluated
→ quality/confidence improves under acceptance criteria
→ the gap resolves
→ downstream Capability receives the updated canonical Brain result
```
