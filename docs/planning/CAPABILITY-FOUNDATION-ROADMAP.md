# MarkOrbit Capability Foundation Roadmap

- **Program:** `MO-CAP-FOUNDATION`
- **Status:** DIRECTION_LOCKED / READY_FOR_STAGED_IMPLEMENTATION
- **Date:** 2026-08-25
- **Planning baseline:** `b7ee1ff4fda8a2a770b94d49c8cd9bbda52ee039`
- **Architecture:** `docs/architecture/CAPABILITY-FOUNDATION-ARCHITECTURE.md`
- **Audit:** `docs/audits/CAPABILITY-FOUNDATION-AUDIT-2026-08-25.md`
- **Machine task ledger:** `docs/planning/CAPABILITY-FOUNDATION-TASKS.yaml`
- **Production authority:** false

## 1. Program objective

Move the existing Capability Engine from a durable definition/learning foundation into the common governed execution/admission layer used by MarkOrbit products and cross-repository systems.

The program exists to prevent Knowledge, Brain, Lite, MarkReg and later products from permanently rebuilding the same AI, communication, document and retrieval infrastructure under different names.

This is an evolution of M6 and historical `MO-MVP-TASK-010..013`, not a replacement Capability system.

The target product dependency is:

```text
Data Engine + Knowledge
          |
        Brain
          |
          v
Capability Runtime  <---- Core shared identity/context/governance
          |
     +----+----+
     |         |
   Lite      MarkReg       + future products
```

Products consume stable Capability outcomes. Brain remains a typed, attributable, non-canonical intelligence producer. Provider/tool infrastructure is hidden behind governed implementation profiles.

## 2. Priority model

Capabilities are prioritized by five factors:

1. **Cross-product leverage** — how many independent consumers need the outcome;
2. **Duplication pressure** — whether a product/repository is already rebuilding the same infrastructure;
3. **Security/authority concentration** — provider secrets, external side effects, tenant data, costs;
4. **Dependency leverage** — how many future domain Capabilities require it;
5. **Extraction cost if delayed** — how expensive it becomes after several products have local implementations.

This produces the following sequence:

| Sequence | Work | Priority | Admission target |
| --- | --- | --- | --- |
| 1 | `MO-CAP-001` Capability Runtime Execution & Admission Plane | P0 | first |
| 2A | `MO-CAP-002` Managed AI Execution | P0 | after minimum MO-CAP-001 invocation contract |
| 2B | `MO-CAP-003` Managed Communication / Email | P0 | after minimum MO-CAP-001 invocation contract |
| 3A | `MO-CAP-004` Governed Document Understanding | P1 | after AI/communication runtime patterns are proven |
| 3B | `MO-CAP-005` Governed Retrieval | P1 | after runtime patterns are proven |
| 3C | `MO-CAP-006` Capability Conformance & Evaluation Harness | P1 | grows alongside 002–005 |
| 4 | Domain Capability Wave 1 | P2 staged | only after foundation reuse is proven |

`MO-CAP-002` and `MO-CAP-003` may proceed in parallel once `MO-CAP-001` has frozen and merged the common invocation/binding contract they both consume.

## 3. Stage 0 — 0–30 days: make Capability executable

### MO-CAP-001 — Capability Runtime Execution & Admission Plane

**Outcome:** the existing Capability Engine can resolve a durable Capability version, determine eligibility, bind an approved implementation profile, execute it under trusted context, validate its output, and return a typed Capability Return / Session Receipt with evidence and provenance.

### Required work

#### WP01 — Historical contract reconciliation

- reconcile `MO-MVP-TASK-010..013` with the M6 implementation and current runtime;
- preserve M6 registry/learning semantics;
- identify old fixture contracts that are still public or test-dependent;
- produce one migration matrix rather than invent competing nouns.

#### WP02 — Runtime contract family

Freeze shared contracts for at least:

- `ImplementationProfile`;
- `CapabilityRequestV2`;
- `CapabilityEligibilityDecision`;
- `CapabilityComposition` where composition is used;
- `ImplementationBinding`;
- `CapabilityInvocation`;
- `CapabilityOutcome`;
- `CapabilityReturn` / `SessionReceipt`.

Every object must carry exact Capability identity/version, trusted Workspace/caller context, correlation/idempotency and version/evidence fields appropriate to its authority.

#### WP03 — Durable implementation registry/binding

Capability Engine persists approved implementation profiles and binds only trusted profiles compatible with the requested Capability version and policy envelope.

The caller cannot choose arbitrary raw provider/model/endpoint/credential values.

#### WP04 — Governed invocation runtime

Replace the hard-coded request fixture with a real runtime path:

`request -> definition -> eligibility -> binding -> invocation -> output validation -> return/receipt`.

Initial implementation may be deterministic and non-external to prove semantics before powerful providers are added.

#### WP05 — Gateway/internal admission

- trusted caller/product identity;
- Workspace/Principal propagation;
- permission/entitlement checks;
- service-to-service authentication;
- correlation propagation;
- no browser/provider secret leakage.

#### WP06 — Reliability and authority

Prove:

- exact replay idempotency;
- conflicting replay rejection;
- stale Capability/implementation version rejection;
- Workspace isolation;
- unsupported applicability/eligibility fail closed;
- timeout/retry classification;
- malformed/invalid outcome rejection;
- restart recovery where durable state exists;
- no automatic Capability canon mutation;
- no automatic professional authority promotion.

#### WP07 — Consumer conformance thin slice

Use at least one main-repository consumer to prove the new invocation path without relying on a provider-specific shortcut.

#### WP08 — independent audit

Audit architecture, authority, compatibility with M6, exact-head CI and absence of cross-service SQL / hidden direct provider selection.

### Exit gate

`MO-CAP-001` is complete only when `/v1/capability-requests` or its approved successor no longer manufactures the hard-coded fixture and a real accepted runtime Capability can return a validated receipt through the normal authenticated path.

No production external side effect is required or authorized for this gate.

---

## 4. Stage 1A — 30–60 days: Managed AI Execution

### MO-CAP-002 — Managed AI Execution Capability V1

**Stable outcome:** produce one typed AI-assisted result under explicit model/prompt/data/budget/evaluation policy with complete usage and implementation provenance.

**Implementation infrastructure:** shared AI Gateway.

The Capability ID must remain provider-neutral. OpenAI, Anthropic, Gemini, DeepSeek, local models or later providers are implementation adapters/profiles.

### Work packages

#### WP01 — AI outcome contract

Freeze request/output families for the first bounded use cases, including:

- structured-output schema reference;
- data classification/sensitivity;
- allowed reasoning/processing purpose;
- model capability requirements rather than product-selected model names;
- max latency/cost/token envelope;
- evidence/provenance;
- result authority (`nonCanonical` unless another governing capability admits it).

#### WP02 — AI Gateway provider boundary

Centralize:

- provider credentials;
- model catalog/capabilities;
- request normalization;
- provider adapters;
- rate limits;
- retry/fallback policy;
- timeouts;
- structured-output validation;
- error taxonomy.

#### WP03 — Prompt/policy/version lineage

Persist or otherwise bind exact prompt/policy/model/profile versions sufficient to reproduce and evaluate outcomes without storing secrets.

#### WP04 — usage, budget and economics

Record per invocation:

- input/output tokens or provider-equivalent units;
- provider/model/profile;
- latency;
- monetary cost when known;
- budget decision;
- retry/fallback behavior;
- cache behavior where permitted.

Budgeting is policy, not user-visible provider selection.

#### WP05 — evaluation

Add golden fixtures and bounded live/sandbox evaluation for:

- schema validity;
- semantic quality metrics appropriate to the use case;
- hallucination/source-attribution risks;
- provider/model substitution drift;
- regression thresholds.

#### WP06 — Knowledge migration, first real consumer

Inventory the Knowledge-local AI gateway/AI-assisted collection behavior. Reuse/adapt the proven implementation where safe rather than rewriting it for architecture aesthetics.

Migrate one real Knowledge workload through the shared Managed AI Execution Capability, preserving Knowledge ownership of Knowledge semantics and source provenance.

#### WP07 — Brain second independent consumer

Migrate one bounded Brain workload through the same Capability contract. Brain remains owner of typed reasoning-result semantics; it does not own provider credentials or provider SDK policy.

#### WP08 — cross-repository admission

Require real Knowledge + MarkOrbit/Brain cross-repository acceptance, exact implementation/profile pins, provider-secret isolation and outcome/provenance checks.

### Exit gate

Managed AI Execution reaches `FOUNDATION_REUSABLE` only after two independent consumers use the shared Capability path and neither consumer requires direct provider credentials/SDK semantics for the admitted workload.

After this gate, new direct AI provider integrations outside approved implementation adapters require an explicit architecture exception.

---

## 5. Stage 1B — 30–75 days: Managed Communication

### MO-CAP-003 — Managed Communication Capability V1

**Stable outcome:** receive, correlate, prepare/send and evidence permitted communications under explicit participant, thread, consent/permission, delivery and side-effect policy.

**Initial implementation infrastructure:** Communication Hub, Email first.

Gmail, Microsoft Graph, IMAP, SMTP and later messaging providers are Tools/adapters.

### Work packages

#### WP01 — communication semantic contract

Define provider-neutral objects for:

- `CommunicationAccountRef`;
- `Participant`;
- `Conversation` / `Thread`;
- `Message`;
- `AttachmentRef`;
- inbound/outbound direction;
- provider observation/provenance;
- delivery state;
- send intent/authorization;
- correlation with MarkOrbit objects by governed reference, not by shared database.

#### WP02 — account/credential boundary

Mailbox/provider credentials remain inside the Communication implementation boundary. Products receive opaque account/channel references and normalized communication outcomes.

#### WP03 — inbound Email V1

Support a bounded provider path with:

- incremental cursor/checkpoint;
- message/thread dedupe;
- participant normalization;
- attachment references;
- provider timestamps/IDs;
- rate-limit/retry;
- Workspace/account isolation;
- raw-provider provenance.

Inbound content does **not** automatically become canonical Customer, Matter, deadline or legal truth.

#### WP04 — Knowledge first consumer

Knowledge consumes permitted lawyer/agent/official/industry email as a source through Managed Communication. Knowledge then applies its own source admission/provenance/content pipeline.

The Communication Hub owns mailbox transport, not Knowledge classification.

#### WP05 — outbound preparation and controlled send

Separate:

`draft/prepared communication -> human/system authorization -> external send -> delivery evidence`.

External send must use durable idempotency, audit and protected-action policy. Production live send requires a separately accepted provider/credential gate; completing code does not authorize it.

#### WP06 — MarkReg second consumer

Integrate one bounded MarkReg customer/professional communication journey without moving Matter/lifecycle truth into Communication Hub.

#### WP07 — Brain/Lite consumption boundary

Brain may consume permitted normalized communication context through governed retrieval/capability inputs. Lite may surface communication-derived attention/actions. Neither may bypass account permissions or treat inference as message truth.

#### WP08 — cross-product admission

Require Knowledge + MarkReg real acceptance and prove that provider adapters can evolve without changing Capability outcome semantics.

### Exit gate

Managed Communication reaches `FOUNDATION_REUSABLE` after one inbound Knowledge path and one independent MarkReg communication path run through the same normalized Capability/runtime with credential isolation and evidence-preserving semantics.

---

## 6. Stage 2 — 60–120 days: Document, Retrieval and Conformance

### MO-CAP-004 — Governed Document Understanding

**Goal:** prevent Knowledge and MarkReg from independently owning parser/OCR/extraction semantics that should be reused.

Work includes:

- inventory existing Knowledge conversion/extraction and MarkReg document flows;
- document/file reference contract rather than arbitrary path passing;
- malware/size/type policy boundary where relevant;
- text/layout/metadata extraction profiles;
- OCR only where needed and quality-signalled;
- structured extraction schema;
- exact source provenance and page/range references;
- redaction/data classification;
- human-review state;
- evidence and confidence;
- at least Knowledge + MarkReg conformance consumers.

Non-goal: take ownership of MarkReg formal document-package/lifecycle state.

### MO-CAP-005 — Governed Retrieval

**Goal:** let Brain and product Capabilities retrieve across Data Engine, Knowledge, Core and admitted Brain result stores without erasing source authority.

Retrieval must preserve categories such as:

- authoritative Data Engine fact;
- sourced Knowledge claim/content;
- Core business object/context;
- Brain inference/non-canonical result.

Required concerns:

- Workspace/permission;
- source allowlist;
- query purpose;
- freshness/as-of;
- authority/provenance;
- bounded result budgets;
- hybrid keyword/semantic/entity methods;
- citations/evidence refs;
- no assumption that one vector database is the semantic owner.

### MO-CAP-006 — Capability Conformance & Evaluation Harness

Build the shared harness needed for implementation evolution:

- contract conformance;
- golden fixtures;
- sandbox/live-provider bounded tests;
- implementation substitution;
- latency/cost/error quality;
- source/evidence completeness;
- security/tenant isolation;
- drift detection;
- outcome-equivalence thresholds;
- release guard integration.

This becomes a prerequisite for promoting later implementation profiles and domain Capabilities.

---

## 7. Stage 3 — 3–6 months: first domain Capability wave

Domain Capabilities are not authorized merely because they are listed here. Each requires its own outcome contract and scope lock.

Recommended first wave based on product leverage:

### 7.1 Trademark Monitoring & Change Interpretation

Consumes Data Engine facts, Knowledge/Brain context, retrieval and communication/attention surfaces to produce a governed change interpretation. It must preserve the distinction between provider fact and professional interpretation.

Primary product consumers: MarkReg and Lite.

### 7.2 Renewal / Maintenance Readiness

Produces a readiness assessment and prepared-work outcome, not a fabricated legal deadline or automatic filing authority.

Primary consumer: MarkReg; Lite may surface daily readiness/attention.

### 7.3 Content Intelligence & Publication Preparation

Consumes Knowledge/Brain and Managed AI Execution to produce evidence-linked content packages suitable for Lite. Publication remains a separate communication/protected-action step.

### 7.4 Filing Strategy / Readiness

Builds on existing recommendation/intake/work infrastructure. It must distinguish advice from formal Matter state, filing authorization and Official Truth.

### 7.5 Brand Risk / Protection Assessment

Combines governed facts, knowledge and reasoning into a typed risk/option outcome with evidence, uncertainty and review burden.

---

## 8. Stage 4 — 6–12 months: Capability portfolio operations

Once foundation capabilities demonstrate repeated multi-product reuse:

- build an internal Capability catalog/center for operators/developers;
- define product entitlement profiles independent of implementation profiles;
- support explicit primary/supporting/critic Capability compositions where justified;
- expose per-Capability reliability, latency, cost and quality economics;
- compare implementation profiles without changing product contracts;
- add deprecation/migration tooling for Capability and implementation versions;
- measure cross-product reuse and duplicate direct-provider escape hatches;
- allow Skills/workflows/providers to compete as implementations under stable Capability outcomes.

This stage does **not** imply a public Capability marketplace or public professional ranking.

---

## 9. Stage 5 — 12–24 months: evidence-backed Capability evolution

Long-term direction:

- mature Outcome -> Reflection -> Change Proposal -> Version -> Release pipeline;
- use accumulated outcome evidence to propose, never silently enact, Capability improvements;
- maintain source/reasoning/implementation evidence lineage;
- grow professional Capability portfolios across trademark/brand/service domains;
- support multiple implementation profiles including internal deterministic systems, AI-assisted implementations, human review and external provider/network implementations;
- require conformance and explicit release governance for material changes;
- preserve non-canonical Brain authority and human/professional decision boundaries.

The long-term moat is not a fixed AI model or one integration. It is a governed portfolio of durable capabilities whose implementations can improve without forcing products to rebuild their meaning.

## 10. Program metrics

Track at least:

### Architecture adoption

- number and percentage of admitted Capabilities with **2+ independent consumers**;
- count of direct provider SDK/credential uses outside approved adapters;
- percentage of AI invocations routed through Managed AI Execution;
- percentage of admitted email communication routed through Communication Hub;
- number of product-local horizontal implementations retired after parity acceptance.

### Runtime quality

- capability outcome validation failure rate;
- eligibility/binding failure rate;
- retry/replay/idempotency conflict rate;
- p50/p95 latency per Capability/implementation profile;
- availability/error classification;
- evidence/provenance completeness.

### AI economics/quality

- token/provider units and cost per Capability outcome;
- budget rejection/fallback rate;
- provider/model substitution conformance;
- evaluation drift and schema failure rate.

### Communication quality

- duplicate inbound rate;
- cursor/checkpoint recovery success;
- thread/participant normalization errors;
- outbound idempotency conflicts;
- delivery evidence completeness.

### Migration quality

- old/new path parity rate;
- consumer rollback success;
- cross-repository acceptance status;
- unresolved architecture exceptions.

## 11. Development rules

Every implementation PR under this program follows:

1. one bounded objective per PR;
2. exact-head CI before merge;
3. no direct `main` push;
4. source-owner and authority boundary explicit in contracts/tests;
5. no cross-service SQL;
6. migrations remain in owning service;
7. provider secrets never enter product/browser contracts;
8. failure does not manufacture factual absence or professional success;
9. runtime evidence cannot auto-mutate Capability canon;
10. no production enablement is inferred from code merge.

## 12. Program hold points

Require explicit new authorization before:

- production outbound external communication;
- production AI/provider credentials where not already separately authorized;
- autonomous external professional action;
- legal deadline certification / Official Truth promotion;
- public Capability marketplace/ranking/certification;
- broad product migration that deletes a working local implementation without parity/rollback evidence;
- MO-DE-007/008 or other deferred Data Engine G2 work;
- any architecture that makes Brain the direct canonical business API for Lite/MarkReg.

## 13. Immediate execution order

The next implementation task is **`MO-CAP-001`**.

After its minimum invocation/binding contract is accepted:

- start **`MO-CAP-002` Managed AI Execution**;
- start **`MO-CAP-003` Managed Communication / Email** in parallel where team capacity permits.

Do not start P1/P2 work merely to create breadth. The first proof of the Capability architecture is reusable execution with two real independent consumers, not the number of Capability names in a registry.
