# Capability Foundation Audit — 2026-08-25

- **Audit type:** architecture / product / design / engineering convergence audit
- **MarkOrbit baseline:** `b7ee1ff4fda8a2a770b94d49c8cd9bbda52ee039`
- **Knowledge repository:** `yoomarks/markorbit-knowledge` current `main` inspected during audit
- **Decision:** `FOUNDATION_RUNTIME_GAP_CONFIRMED`
- **Recommendation:** evolve the existing Capability Engine; do not create a second Capability subsystem.

## 1. Executive finding

MarkOrbit does **not** lack Capability semantics or Capability governance. That earlier diagnosis would be wrong.

The repository already has a meaningful Capability layer foundation from M6: durable runtime definitions/version lineage, Capability Observations, Ledger, Reflection Candidates, Profile/Twin projection, Capability Center and CI governance. The books also already lock Capability as a durable, governed, versioned outcome contract.

The material gap is narrower and more important:

> The Capability layer is not yet the common execution/admission plane through which independent products consume reusable platform capabilities.

The current `POST /v1/capability-requests` path still creates an in-memory request with hard-coded `trademark-application-recommendation` / `0.1.0-fixture`, while the durable runtime registry is separately available for accepted canon import/read. This proves that registry/learning maturity has moved ahead of implementation binding and governed invocation maturity.

As a result, horizontal infrastructure can still be created locally by the first product that needs it. The immediate examples are AI execution and communication/email. If this continues, Knowledge, Brain, Lite and MarkReg will each accumulate provider routing, secrets, retries, usage/evidence and connector behavior that should instead be governed once behind Capability contracts.

## 2. Canon review

The user-provided seven-book canon was reviewed before making this recommendation. Relevant locked conclusions include:

- Capability is a governed/versioned ability to produce a defined outcome under explicit input, authority, evidence, risk and review conditions.
- Product, Capability, Workflow and Tool are distinct.
- Capability is the durable outcome contract; a Tool performs an operation; a Skill/Implementation Profile is one implementation route.
- Capability runtime includes `Capability Request -> Eligibility -> Composition -> Context Compilation -> Implementation Binding -> Execution -> Review -> Outcome -> Return / Session Receipt`.
- Brain results remain typed, attributable, versioned and non-canonical.
- Data, Knowledge and Brain must not collapse into Core.
- Runtime outcomes do not mutate Capability canon automatically.

Therefore this audit rejects two tempting but incorrect designs:

1. making AI Gateway itself the canonical Capability identity;
2. letting Lite/MarkReg call Brain/provider infrastructure directly and treating the result as the product capability.

## 3. Existing Capability implementation — KEEP

### 3.1 M6 scope already solved real problems

`MO-MVP-MILESTONE-006-SCOPE-LOCK.md` explicitly established:

- accepted Capability Canon -> durable runtime definition/version;
- governed exact observations;
- private append-oriented Ledger;
- Reflection Candidates;
- explicit user dispositions;
- private Profile/Twin projections;
- provenance/idempotency/replay/privacy boundaries;
- Brain/AI authority restrictions.

This is substantive platform work and must remain authoritative.

### 3.2 Capability Engine is not an empty shell

`services/capability-engine` currently contains runtime registry, observation, reflection and profile components. The registry persists an operational projection of accepted canon rather than allowing runtime consumers to invent competing definitions.

Existing CI includes dedicated Capability registry/pointer/release guards and M6 work-package workflows.

### 3.3 The unresolved runtime seam is visible in code

`services/capability-engine/src/index.ts` still has an `InMemoryCapabilityRequestRepository` and its `/v1/capability-requests` handler constructs:

- `capabilityId = trademark-application-recommendation`;
- `capabilityVersion = 0.1.0-fixture`;
- status `ACCEPTED`;
- no durable runtime-definition resolution;
- no applicability/eligibility resolution;
- no implementation profile binding;
- no governed execution;
- no typed Capability Outcome/Return/Session Receipt tied to a real implementation.

At the same time `runtime-capability-http.ts` exposes durable registry import/read operations. The result is a split maturity model: definition/learning is durable, generic request/invocation is still fixture-level.

**Finding F-01 — P0:** Capability runtime execution/admission plane is incomplete.

## 4. Cross-repository horizontal capability pressure

### 4.1 Knowledge is already a heavy infrastructure consumer

The Knowledge workspace has its own worker/control-plane architecture, source acquisition providers, conversion runtime, queues, source-intelligence calibration and operational scripts. Its worker package is deliberately self-contained around Knowledge contracts/persistence/worker runtime. There is no cross-repository package in its current root workspace that constitutes a MarkOrbit-wide Capability client/runtime for AI or communication.

The owner reports that Knowledge has already built AI-gateway behavior for AI-assisted Knowledge collection. Regardless of its internal implementation location, the architectural fact is clear: that implementation is not currently exposed through the main repository's governed Capability runtime and therefore cannot be safely reused by Brain/Lite/MarkReg as a stable Capability.

**Finding F-02 — P0:** AI execution is under active duplication pressure; first-consumer local infrastructure must be migrated into a shared governed implementation instead of becoming permanent Knowledge ownership.

### 4.2 Communication duplication is imminent

Knowledge needs lawyer/agent email as a Knowledge source. MarkReg needs customer/agent/professional communication for lifecycle work. Lite will need communication-derived daily attention and customer-service opportunities. Brain will need permitted communication context for reasoning.

If Knowledge builds Gmail/IMAP/SMTP/Microsoft Graph ingestion directly as a permanent Knowledge subsystem before a shared boundary exists, the platform will later need to extract:

- provider credentials;
- mailbox connection state;
- participants/thread semantics;
- attachments;
- dedupe/cursor semantics;
- delivery state;
- consent/permission policy;
- evidence/provenance;
- retry/rate-limit behavior;
- outbound send controls.

**Finding F-03 — P0:** Communication Hub must precede broad lawyer-email ingestion, with Email as the first implementation profile/tool family.

## 5. Main-repository duplication/risk audit

### 5.1 Existing product/runtime services should not be collapsed

MarkOrbit already has explicit owners for Core identity/context, Execution work/review/evidence, MarkReg lifecycle state, MGSN provider state, Payment truth and other product/runtime responsibilities. Capability Foundation must compose these owners, not absorb their databases or authority.

### 5.2 Existing tasks show the original intent but not the durable completion

The historical task index already includes:

- `MO-MVP-TASK-010` Capability Registry and Version Contract;
- `MO-MVP-TASK-011` Composition and Capability Budget;
- `MO-MVP-TASK-012` Context Compiler;
- `MO-MVP-TASK-013` Invocation and Session Receipt.

M6 later hardened registry/learning, but the generic request path still shows fixture invocation behavior. Therefore the correct action is **not** to invent new competing semantic tasks. The Capability Foundation program is a post-M15 remediation/evolution that closes the real runtime gap against those original contracts.

**Finding F-04 — P0:** planning must reconcile with TASK-010..013 rather than duplicate them.

## 6. Capability candidates ranked by platform urgency

The ranking uses five criteria: number of consumers, current/imminent duplication, security/secret centralization need, leverage on future capabilities, and migration cost if delayed.

| Rank | Capability / runtime                                                                             | Priority  | Why now                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | Capability Runtime Execution & Admission Plane                                                   | P0        | prerequisite for every shared Capability; closes existing fixture seam                                             |
| 2    | Managed AI Execution / AI Gateway implementation                                                 | P0        | Knowledge already needs/uses AI; Brain/Lite/MarkReg will all need it; high secret/cost/model-governance risk       |
| 3    | Managed Communication / Communication Hub, Email first                                           | P0        | Knowledge email ingestion is imminent; MarkReg/Lite also need communication; high privacy/credential/evidence risk |
| 4    | Governed Document Understanding                                                                  | P1        | Knowledge and MarkReg both process professional documents; prevents parser/OCR/extraction fragmentation            |
| 5    | Governed Retrieval                                                                               | P1        | Brain, Lite and MarkReg need mixed Data/Knowledge/Core retrieval with authority/provenance preserved               |
| 6    | Cross-capability evaluation / conformance harness                                                | P1        | required to compare implementation profiles and prevent provider/model drift from changing outcomes silently       |
| 7    | Domain Capability wave (monitoring, renewal, filing readiness, brand risk, content intelligence) | P2 staged | strategic product value, but should build on the shared foundation rather than creating more local infrastructure  |

## 7. Why AI and Communication are P0 but not first in sequence

Building AI Gateway first without the invocation plane would create a useful service but not prove the Capability architecture. The same problem would recur with Communication Hub.

The required sequence is therefore:

```text
MO-CAP-001 Runtime Execution & Admission
        |
        +--> MO-CAP-002 Managed AI Execution
        |
        +--> MO-CAP-003 Managed Communication / Email
```

MO-CAP-002 and MO-CAP-003 may proceed in parallel after the minimum MO-CAP-001 implementation-binding/invocation contract is merged.

## 8. Migration policy

The program must use strangler migration, not big-bang rewrites.

For every product-local horizontal implementation:

1. inventory exact current behavior and provider/tool dependencies;
2. freeze a product-independent Capability outcome contract;
3. bind the existing implementation as an initial implementation profile where safe;
4. add the shared Capability invocation path;
5. run old/new parity and evidence comparison;
6. migrate one real consumer;
7. migrate a second independent consumer;
8. only then prohibit new direct provider/tool use;
9. retire product-local provider ownership after rollback and recovery are proven.

No working Knowledge ingestion path is deleted merely to satisfy architecture aesthetics.

## 9. Security and authority audit requirements

Foundation Capabilities concentrate powerful infrastructure and therefore require stronger controls, not fewer:

- secrets remain inside provider/tool implementation boundaries;
- product/browser requests cannot choose raw provider endpoints or credentials;
- Workspace/Principal and caller-product identity are trusted inputs;
- Brain/model output remains non-canonical;
- communication ingestion does not automatically mutate customer/Matter truth;
- external send is a side effect with explicit authorization/idempotency/evidence;
- AI usage/cost and communication delivery state are auditable;
- cross-service SQL remains forbidden;
- provider failure never becomes a fabricated factual negative;
- protected professional actions remain under their existing owning-service authority.

## 10. Design/product audit

A Capability Foundation should reduce product complexity, not expose more platform jargon.

Lite should consume outcomes such as `daily insight ready`, `content package ready`, or `communication needs review`; MarkReg should consume professional outcomes such as `renewal readiness result` or `communication draft ready`. Users should not have to select an AI provider, mailbox connector or Capability Engine route in normal product flows.

Provider/model/connector selection belongs to governed implementation policy. Product UX should expose evidence, confidence, review state, source and next action where material.

## 11. Final audit decision

### PASS — existing Capability canon/governance is valid.

### FIX — shared runtime execution/admission is incomplete.

### P0 — stop permanent horizontal duplication while the foundation is built.

The main repository should immediately execute `MO-CAP-001`, then admit Managed AI Execution and Managed Communication as the first two cross-product foundation Capabilities. Document and Retrieval capabilities follow after those foundations prove two-consumer reuse.

This audit does not authorize production traffic, live outbound email, production AI credentials, automatic legal decisions, MO-DE-007/008 or any new external professional-action authority.
