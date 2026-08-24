# MarkOrbit Capability Foundation Architecture

- **Status:** ARCHITECTURE LOCK FOR IMPLEMENTATION PLANNING
- **Date:** 2026-08-25
- **Repository baseline:** `b7ee1ff4fda8a2a770b94d49c8cd9bbda52ee039`
- **Scope:** post-M15 Capability foundation evolution
- **Authority:** this document does not authorize production deployment, provider credentials, live external communication, filing, payment or autonomous professional action.

## 1. Purpose

This document converts the adopted MarkOrbit Capability canon into the next implementation architecture for the main repository. It does not redefine the books or replace Milestone 6. The objective is to close the gap between the already-durable Capability definition/learning system and a reusable Capability runtime that can be consumed by Knowledge, Brain, Lite, MarkReg and later products without each product rebuilding AI, communication, document and retrieval infrastructure.

The governing rule is:

> Products consume governed Capabilities. Products do not own provider/tool infrastructure and do not depend on Brain as their business API.

## 2. Canon that remains locked

The adopted Capability definition remains:

`Capability = Stable Outcome Contract + Governed Implementation + Evidence Base + Version Lineage + Controlled Evolution`.

The canonical hierarchy remains:

`Capability Domain -> Capability -> Skill -> Action / Invocation`.

A Capability is not a prompt, model, provider SDK, connector, workflow, tool, person, role, licence, course or one successful answer. Those may implement, constrain, evidence or operate a Capability.

The three lifecycles remain separate:

1. production: `Source -> Distillation -> Source Capability`;
2. runtime: `Capability Request -> Eligibility -> Composition -> Context Compilation -> Implementation Binding -> Execution -> Review -> Outcome -> Return / Session Receipt`;
3. evolution: `Outcome -> Reflection Candidate -> Evaluation -> Change Proposal -> Version -> Release`.

Runtime success never silently mutates Capability canon.

## 3. Correct system topology

The architecture is not `Brain -> Lite/MarkReg`.

The intended dependency direction is:

```text
External world
   |
   +--> Data Engine ---- authoritative external facts -----+
   |                                                       |
   +--> Knowledge ------ sourced reusable knowledge -------+
                                                           v
                                                        Brain
                                            typed, attributable,
                                            versioned, non-canonical
                                            intelligence results
                                                           |
                                                           v
Core shared semantics/context ---> Capability Runtime <----+
                                   definitions
                                   eligibility
                                   composition
                                   context compilation
                                   implementation binding
                                   governed invocation
                                   outcome/evidence
                                   return/session receipt
                                            |
                       +--------------------+--------------------+
                       |                    |                    |
                     Lite                MarkReg          Future products
                 daily product       professional product   other surfaces
```

Core provides shared meaning, identity, Workspace/Principal context, permission truth and other bounded platform semantics. Core is not a universal owner of Data Engine facts, Knowledge content, Brain results, Capability implementations or product state.

Brain processes Data and Knowledge into typed intelligence. Brain is a reasoning layer, not a hidden authority and not the direct product contract.

Capability consumes the required Core context and typed Brain/Data/Knowledge inputs, binds an approved implementation, applies capability-specific policy/evidence/review rules, and returns a stable governed outcome.

Lite, MarkReg and later products consume Capability contracts. They may narrow a Capability through product entitlement, presentation and accepted outcome rules; they may not silently broaden Capability authority.

## 4. Current repository foundation that must be preserved

Milestone 6 already established durable Capability governance and learning. The main repository contains `services/capability-engine`, including:

- durable runtime Capability registry/version lineage;
- accepted canon import/projection;
- governed Capability Observation admission;
- append-oriented Capability Ledger;
- private Reflection Candidate;
- explicit Reflection Disposition;
- private Capability Profile/Twin projection;
- Capability Center surfaces and associated tests;
- capability registry/pointer/release-guard CI.

This work is not replaced.

The remaining architectural defect is that the public Capability request path still carries an early fixture behavior while the durable runtime registry exposes definition/import/read behavior. The runtime lifecycle is therefore not yet complete as a portable, governed implementation-binding and invocation plane for multiple independent product consumers.

## 5. Capability Runtime Execution & Admission Plane

The next Capability Engine evolution must add a durable invocation plane instead of creating a second Capability system.

### 5.1 Runtime objects

At minimum the runtime must distinguish:

- `CapabilityDefinition` — governed stable outcome contract/version;
- `ImplementationProfile` — one approved implementation route for a Capability version;
- `CapabilityRequest` — one bounded request with trusted caller/context;
- `CapabilityComposition` — optional primary/supporting/critic composition record;
- `ImplementationBinding` — exact selected implementation/profile/version and selection rationale;
- `CapabilityInvocation` — one execution attempt;
- `CapabilityOutcome` — typed outcome against the Capability output contract;
- `CapabilityReturn` / `SessionReceipt` — consumer-safe return plus evidence/provenance references;
- `CapabilityObservation` — post-run evidence admitted to the existing learning lifecycle.

These records must remain semantically distinct.

### 5.2 Invocation contract

A governed invocation must bind:

- exact `capabilityId` and semantic version;
- Workspace and trusted caller/product identity;
- permission/entitlement context;
- normalized input contract;
- applicability and eligibility decision;
- exact implementation profile/version;
- exact tool/provider versions where material;
- Brain result references when used, preserving typed/non-canonical authority;
- policy and risk envelope;
- idempotency/correlation identifiers;
- bounded timeout/retry policy;
- output validation;
- evidence/provenance references;
- outcome/review state;
- cost/usage information where applicable.

Missing or incompatible bindings fail closed. A product cannot submit a provider/model/connector name and thereby select an implementation outside trusted policy.

### 5.3 Implementation binding

Implementation Profiles are the controlled bridge between stable Capability meaning and changing implementation technology. A profile may be:

- deterministic service;
- AI-assisted service;
- workflow;
- Skill/agent package;
- human-reviewed route;
- external provider route;
- bounded composite of the above.

Changing OpenAI/Anthropic/Gemini models, Gmail/Graph connectors or another Tool does not by itself create a new Capability. Material changes to outcome meaning, risk or review burden require the appropriate implementation/capability version and re-evaluation path.

### 5.4 Cross-product admission rule

A foundation Capability must not be called reusable merely because one product can invoke it.

Before `FOUNDATION_REUSABLE` admission, require:

1. one stable Capability definition and accepted implementation profile;
2. at least two independent consumers or one consumer plus a real cross-repository consumer;
3. exact-head conformance tests for both consumers;
4. Workspace/Principal isolation;
5. provider/tool secrets confined to the implementation boundary;
6. deterministic evidence/provenance and usage records;
7. provider/tool substitution test or an explicit documented single-provider temporary limit;
8. no direct product dependency on provider SDK/secrets;
9. no authority promotion of Brain/model/provider output.

## 6. Foundation Capability classes

Foundation Capabilities are cross-product capabilities whose governed outcomes are reusable across domains. They are not generic utility packages.

### 6.1 Managed AI Execution

**Capability purpose:** produce a typed, policy-bounded AI-assisted result with model/provider/prompt provenance, budget, usage, evaluation and failure semantics independent of a product-specific provider integration.

**Implementation:** shared AI Gateway plus provider adapters, model routing, prompt/policy registry, structured-output validation, usage/cost ledger and evaluation hooks.

The AI Gateway is an implementation infrastructure component. `openai`, `anthropic`, `gemini`, local model names or SDKs must not appear in the Capability ID.

Brain is a major consumer, not the owner of AI provider infrastructure. Knowledge may use this Capability for source processing. Lite/MarkReg may consume higher-level Capabilities whose implementations use Managed AI Execution; direct product access, if ever allowed, remains policy-bounded and typed.

### 6.2 Managed Communication

**Capability purpose:** receive, send and correlate governed communications while preserving participant, conversation/thread, attachment, delivery, consent/permission, provenance and evidence semantics.

**Initial implementation:** Communication Hub with Email first. Gmail, Microsoft Graph, IMAP, SMTP and later messaging adapters are Tools/provider adapters, not separate Capabilities.

Email ingestion must not automatically create canonical Matter, customer or legal facts. Brain interpretation remains non-canonical until an owning workflow/capability admits a governed result.

### 6.3 Governed Document Understanding

**Capability purpose:** turn permitted document/file inputs into typed, source-linked document understanding outcomes with extraction quality, provenance and review state.

This does not replace product-owned document package/lifecycle state. File storage, OCR/parser libraries and format converters are Tools/implementation details.

### 6.4 Governed Retrieval

**Capability purpose:** retrieve bounded, attributable results across approved sources under Workspace, source-authority, freshness and provenance rules.

It must distinguish factual Data Engine results, Knowledge claims/content, Core business objects and Brain inference. A vector database or search engine is an implementation Tool, not the Capability.

## 7. Domain Capability layer

Foundation Capabilities enable, but do not replace, professional/industry Capabilities. Later domain work may include:

- trademark monitoring and change interpretation;
- renewal/maintenance readiness;
- filing strategy/readiness;
- brand risk/protection assessment;
- content intelligence and publication preparation;
- client opportunity/service readiness.

Each must be defined by a stable professional outcome, evidence, review and authority envelope. Domain work is not authorized merely by this architecture document.

## 8. Ownership boundaries

### Data Engine

Owns external authoritative fact infrastructure, provenance, factual history/change semantics and provider-side data contracts. It does not own product interpretation or Capability outcome semantics.

### Knowledge

Owns sourced reusable knowledge assets, source acquisition, provenance, versions and Knowledge-domain structures. It may consume foundation Capabilities; it must not become the permanent owner of general AI, email, document or retrieval infrastructure solely because it was the first consumer.

### Brain

Owns typed context-specific intelligence processing/results within its bounded architecture. Results remain attributable, versioned and non-canonical. Brain does not directly become the business API for Lite/MarkReg.

### Core

Owns bounded shared semantic/identity/context/authority objects. Shared meaning does not imply centralized ownership.

### Capability Engine

Owns Capability runtime definition projection, implementation binding/admission, governed invocation semantics, capability-level outcome/evidence/session receipt, and the existing learning/reflection lifecycle.

### Gateway

Owns trusted external/browser aggregation, caller identity propagation and transport policy. Gateway does not redefine Capability meaning.

### Lite / MarkReg

Own product experience and product-specific formal state. They consume Capabilities and preserve authority distinctions; they do not copy provider infrastructure into the product merely for convenience.

## 9. Anti-duplication rules

After a foundation Capability reaches cross-product admission:

- new direct AI provider SDK/runtime use outside approved AI implementation adapters requires explicit architecture exception;
- new email provider credentials/connectors outside Communication Hub require explicit exception;
- products may not create provider-specific Capability IDs;
- Knowledge/Brain/Lite/MarkReg may retain bounded migration adapters temporarily, but new product logic must target Capability contracts;
- shared infrastructure extraction must not delete a working product-local path until parity, evidence, rollback and migration acceptance are proved.

## 10. Product/design principles

Capability remains largely invisible to end users. Product surfaces should expose the outcome, evidence, confidence, review state and next action appropriate to the product rather than infrastructure jargon.

Lite should be able to arrange shared Capabilities into a high-frequency daily product. MarkReg should arrange shared and professional Capabilities into deep lifecycle work. The same underlying Capability can therefore appear differently without duplicating its governed meaning.

The visual/product system must distinguish at least:

- sourced fact/knowledge;
- Brain inference/recommendation;
- Capability requested/running;
- outcome ready;
- human review required;
- accepted/rejected outcome;
- external/protected action state;
- evidence/official truth state.

## 11. Non-goals

This architecture does not:

- make Capability Engine a universal microservice for all utilities;
- move Data Engine/Knowledge/Brain databases into Core;
- turn Brain inference into canonical truth;
- authorize direct Capability-to-production filing/payment/email without the required protected-action policy;
- create a public Capability marketplace;
- authorize MO-DE-007/008, global Data Engine productization or Brain/Data Engine integration by implication;
- replace existing Execution, Evidence, Payment, MGSN or MarkReg owning-service authority;
- require every operation to be remote RPC; implementation may remain in-process where ownership, conformance and isolation remain explicit.

## 12. Architecture exit condition

The foundation architecture is considered proven only when the existing Capability Engine can resolve an accepted Capability version, bind an approved implementation, execute it under trusted caller/context, validate and return a typed outcome/session receipt with evidence, and demonstrate at least two independent real consumers without either consumer owning the underlying provider secrets/tool semantics.
