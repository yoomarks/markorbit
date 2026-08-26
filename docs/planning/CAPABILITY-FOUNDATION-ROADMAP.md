# MarkOrbit Capability Foundation Roadmap

- **Program:** `MO-CAP-FOUNDATION`
- **Status:** `ACTIVE_P0_REUSE_PROOF`
- **Original direction lock:** 2026-08-25 at `c594ad26906d44e4b026bf86a5cc1d3507f1b95e`
- **Reconciled:** 2026-08-26
- **Reconciled main:** `6ddf351b0425a0024901dce10ba54f7243dade47`
- **Architecture:** `docs/architecture/CAPABILITY-FOUNDATION-ARCHITECTURE.md`
- **Original audit:** `docs/audits/CAPABILITY-FOUNDATION-AUDIT-2026-08-25.md`
- **MO-CAP-001 closeout audit:** `docs/audits/MO-CAP-001-CLOSEOUT-AUDIT-2026-08-26.md`
- **Machine task ledger:** `docs/planning/CAPABILITY-FOUNDATION-TASKS.yaml`
- **Production authority:** false

> The original 2026-08-25 staged plan remains available in Git history at `c594ad26906d44e4b026bf86a5cc1d3507f1b95e`. This document is the current execution roadmap after reconciling that plan with the implementation actually merged through PR #241.

## 1. Program objective

Capability Foundation exists to make the existing Capability Engine the common governed execution/admission layer used by independent MarkOrbit products and repositories, rather than allowing Knowledge, Brain, Lite, MarkReg and later products to permanently rebuild provider/tool infrastructure under different names.

The locked dependency direction remains:

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

Products consume governed Capability outcomes. Brain remains a typed, attributable, versioned, non-canonical intelligence producer. Provider/model/mailbox/tool infrastructure remains hidden behind governed implementation boundaries.

The canon remains:

`Capability = Stable Outcome Contract + Governed Implementation + Evidence Base + Version Lineage + Controlled Evolution`.

## 2. Reconciled program state

| Capability / platform work                                  | Priority       | Current status                                         | Next admission target                                                                            |
| ----------------------------------------------------------- | -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `MO-CAP-001` Capability Runtime Execution & Admission Plane | P0             | **SINGLE_CONSUMER_PROVEN**                             | second independent governed consumer before any `FOUNDATION_REUSABLE` claim                      |
| `MO-CAP-002` Managed AI Execution                           | P0             | **IMPLEMENTATION_BOUND / CONSUMER MIGRATION REQUIRED** | one real Knowledge workload through Capability V2, then Brain second consumer                    |
| `MO-CAP-003` Managed Communication / Email                  | P0             | **CONTRACT PROVEN / DURABLE FOUNDATION ACTIVE**        | durable no-send runtime, then Knowledge Expert communication slice, then MarkReg second consumer |
| MarkReg → Knowledge Case producer/resolver                  | P0 integration | **ACTIVE**                                             | real FormalMatter promotion + trusted resolver + Knowledge K-CASE acceptance                     |
| `MO-CAP-004` Governed Document Understanding                | P1             | **HOLD**                                               | only after P0 reuse pattern is proven                                                            |
| `MO-CAP-005` Governed Retrieval                             | P1             | **HOLD**                                               | only after P0 reuse pattern is proven                                                            |
| `MO-CAP-006` Conformance & Evaluation Harness               | P1 platform    | **PARTIALLY IMPLEMENTED**                              | grow with 002/003; do not create a duplicate harness                                             |
| Domain Capability Wave 1                                    | P2 staged      | **ROADMAP ONLY / HOLD**                                | separate scope lock after multi-product foundation reuse                                         |

The program is no longer in a “build the generic runtime” phase. The runtime exists. The current phase is **prove reuse through real independent consumers while preserving authority boundaries**.

## 3. MO-CAP-001 — closeout state

### Decision

`MO-CAP-001 = SINGLE_CONSUMER_PROVEN`.

The following implementation is merged on main:

- provider-neutral Capability V2 contract and deterministic governed core — PR #198 / `ff7e19ce9b7a3f7ad8d422ba9cac6bb01c5d055c`;
- durable Implementation Profile registry/binding — PR #228 / `8b599b33e04dbe3d654587c37b0acb67b7858165`;
- governed normal request path replacing the historical fixture — PR #227 / `f9b7fa6af81be052f5992d3033567ca58edb75fe`;
- trusted Gateway/internal caller admission — PR #232 / `2692079d527f80356645fef7a22b5836e1a4630a`;
- reliability/version/output/authority conformance — PR #233 / `f4039c56a3b98d87122c850cff5ebc384f69a746`;
- durable production runtime bootstrap — PR #235 / `25a37443c36497ec4c4b852db3bd3e4474bb8ce2`;
- restart-safe governed replay — PR #239 / `f88911ca77ff64d0004d4ad550f2711e18851b7c`;
- schema-independent Lite consumer client — PR #241 / `6ddf351b0425a0024901dce10ba54f7243dade47`.

The exact-head audit and requirement matrix live in `MO-CAP-001-CLOSEOUT-AUDIT-2026-08-26.md`.

### What is still open

The remaining admission gap is **reuse**, not another runtime layer.

`FOUNDATION_REUSABLE` requires at least two independent consumers. Lite is the first main-repository product thin slice. A second independent consumer must use the same governed request/binding/outcome model before promotion.

Do not create another Capability runtime, provider-selection plane, replay system or product-owned provider gateway to satisfy this requirement.

## 4. MO-CAP-002 — Managed AI Execution

### Current reality

The main repository already contains substantial Managed AI infrastructure:

- provider-neutral Managed AI contracts;
- AI provider adapter boundary;
- DeepSeek implementation adapter;
- governed executor and server-side authorization gates;
- durable execution claims;
- exact provider-output persistence/resolution;
- provider failure/retry/follow-up policy hardening;
- Managed AI audit telemetry;
- governed production Capability runtime binding through the server-owned Managed AI implementation key.

Knowledge also has a real cross-repository Managed AI HTTP consumer. However, that consumer still calls the specialized internal Managed AI execution endpoint rather than the schema-independent Capability V2 path.

Therefore MO-CAP-002 is **not** yet `SINGLE_CONSUMER_PROVEN` under the Capability Foundation admission model.

### Next mainline objective — Knowledge strangler migration

Migrate one bounded real Knowledge workload from the specialized Managed AI endpoint to governed Capability V2.

Required sequence:

1. inventory the exact current Knowledge workload and its request/outcome/provenance expectations;
2. bind a stable accepted `managed-ai-execution` Capability definition/version and approved Implementation Profile;
3. add a Knowledge-side governed Capability V2 client/adapter without exposing provider/model/credential authority;
4. preserve the existing specialized path as rollback during the migration;
5. run old/new parity for output schema, provider/profile provenance, idempotency, failure semantics and source lineage;
6. prove exact cross-repository acceptance against pinned Core and Knowledge heads;
7. admit Knowledge as the first governed consumer only after the real workload passes;
8. then migrate one bounded Brain workload as the second independent consumer;
9. only after both consumers pass may MO-CAP-002 be considered for `FOUNDATION_REUSABLE`.

### Explicit non-goals

- no big-bang migration of all Knowledge AI;
- no product-selected arbitrary model/provider;
- no implication that AI output is canonical truth;
- no production credential authorization by code merge;
- no deletion of the working rollback path before parity/recovery evidence.

## 5. MO-CAP-003 — Managed Communication / Email

### Current reality

The provider-neutral Managed Communication contract is merged and already distinguishes:

- account/channel references;
- participants;
- message/thread identity;
- inbound/outbound direction;
- attachment references/checksums;
- provider observation/provenance;
- checkpointed reads;
- explicit no-authority consequences.

The missing piece is the durable Communication implementation/runtime. Knowledge issue `yoomarks/markorbit-knowledge#468` is already blocked on this shared capability for the first real Expert Q&A communication slice.

### Current parallel foundation lane

Core issue **#243** owns the no-live-provider durable Communication foundation.

It must establish at least:

- durable account/channel binding;
- immutable message/thread/provider-observation persistence;
- checkpoint/cursor restart recovery;
- provider message/thread dedupe;
- conflicting replay fail-close behavior;
- attachment reference/checksum provenance;
- Workspace/account isolation;
- immutable/integrity-checked replay semantics;
- reusable in-memory/PostgreSQL conformance where persistence exists.

It must **not** send externally, use live credentials, mutate Customer/Matter/legal truth, or grant professional authority.

### After durable foundation acceptance

The repository-lead integration sequence is:

1. freeze prepared-send / authorization / delivery-evidence state semantics;
2. bind one provider adapter behind the Communication implementation boundary without leaking credentials into Knowledge;
3. prove exactly-once/uncertain-delivery reconciliation semantics;
4. integrate one Knowledge Expert question send + one real correlated inbound reply;
5. preserve immutable raw reply evidence and attachment refs;
6. run Knowledge #468 acceptance;
7. then add an independent MarkReg communication journey as the second consumer;
8. require cross-product admission before `FOUNDATION_REUSABLE`.

Production live outbound send remains a separate hold point even after code completion.

## 6. Immediate cross-repository product unblock — MarkReg → Knowledge Case

Knowledge issue `yoomarks/markorbit-knowledge#467` has already completed the Knowledge Case consumer foundation and is blocked on the authoritative producer side.

Core issue **#244** owns the MarkReg-side integration.

The path must be:

```text
real MarkReg FormalMatter
        |
        v
Send to Knowledge Case
        |
        v
CaseCandidate source identity
        |
        v
trusted authenticated MarkReg evidence resolver
        |
        v
existing Knowledge Case pipeline / K-CASE acceptance
```

Requirements:

- actual Formal Matter id/version/workspace/snapshot lineage;
- opaque producer promotion reference;
- idempotent repeat promotion;
- authenticated server-side resolver;
- no direct Knowledge access to MarkReg persistence;
- immutable evidence checksums/storage refs preserved;
- no invented correspondence/payment evidence;
- no implication of publication, recommendation, legal truth or professional success;
- exact pinned cross-repository acceptance.

This integration is P0 because it unlocks already-built product value without requiring an external provider or a new horizontal platform layer.

## 7. MO-CAP-006 — conformance is not a greenfield project

The repository already contains reusable Capability runtime conformance and reliability/authority gates from PR #223/#233 plus dedicated PostgreSQL runtime/replay gates.

MO-CAP-006 should therefore grow alongside MO-CAP-002 and MO-CAP-003 rather than restart as a separate platform rewrite.

Remaining emphasis:

- consumer conformance across repository boundaries;
- provider/tool substitution tests;
- latency/cost/error quality comparisons;
- provenance completeness;
- tenant isolation;
- drift detection;
- release guard integration for promoted implementation profiles.

## 8. P1 work remains intentionally deferred

### MO-CAP-004 — Governed Document Understanding

Still valuable for Knowledge + MarkReg parser/extraction reuse, but **do not start now**. It remains blocked on proof that the P0 runtime + consumer migration pattern is actually reusable.

### MO-CAP-005 — Governed Retrieval

Still required for mixed Data Engine / Knowledge / Core / Brain retrieval with authority/provenance preservation, but **do not start now** for the same reason.

Starting 004/005 before 002/003 achieve real cross-product reuse would create breadth while the foundation admission model remains unproven.

## 9. Domain Capability wave remains roadmap-only

The following candidates remain intentionally unscoped for implementation:

- Trademark Monitoring & Change Interpretation;
- Renewal / Maintenance Readiness;
- Content Intelligence & Publication Preparation;
- Filing Strategy / Readiness;
- Brand Risk / Protection Assessment;
- Client Opportunity / Service Readiness.

Each requires a separate outcome contract and scope lock after the shared foundation demonstrates multi-product reuse.

## 10. External/operator gates are not ordinary development backlog

Keep external evidence gates separate from code implementation.

Examples include:

- Core Stripe sandbox acceptance requiring the owner-provided Stripe test secret;
- Knowledge paid-provider ADK acceptance requiring separately controlled provider credentials/evidence retention;
- Data Engine target-host CN/SG acceptance requiring the machine that owns the real data/runtime state.

Do not manufacture acceptance with CI doubles where the gate explicitly requires a real provider or target host.

## 11. Program metrics

### Architecture adoption

- admitted Capabilities with 2+ independent consumers;
- direct provider SDK/credential uses outside approved adapters;
- percentage of admitted AI workloads routed through Managed AI Capability execution;
- percentage of admitted communication routed through Communication Hub;
- product-local horizontal implementations retired only after parity/rollback proof.

### Runtime quality

- outcome validation failure rate;
- eligibility/binding failure rate;
- replay/idempotency conflict rate;
- p50/p95 latency per Capability/profile;
- evidence/provenance completeness;
- restart/reconciliation outcomes.

### AI quality/economics

- provider/model/profile and exact prompt/policy lineage;
- token/provider units and cost where known;
- budget rejection/fallback rate;
- provider/model substitution conformance;
- schema/evaluation drift.

### Communication quality

- duplicate inbound rate;
- checkpoint recovery success;
- thread/participant normalization errors;
- outbound idempotency conflicts;
- uncertain delivery reconciliation rate;
- delivery/raw-evidence completeness.

### Migration quality

- old/new parity rate;
- rollback success;
- cross-repository acceptance status;
- unresolved architecture exceptions.

## 12. Development rules

Every implementation PR under this program follows:

1. one bounded objective per PR;
2. exact-head CI before merge;
3. no direct `main` push;
4. source-owner and authority boundary explicit in contracts/tests;
5. no cross-service SQL;
6. migrations remain in the owning service and require collision checks before allocation;
7. provider secrets never enter product/browser contracts;
8. failure does not manufacture factual absence or professional success;
9. runtime evidence cannot auto-mutate Capability canon;
10. no production enablement is inferred from code merge;
11. if main advances during a parallel lane, clean rebuild on the latest main and rerun exact-head gates;
12. two-consumer admission must represent genuinely independent consumers, not two aliases of the same path.

## 13. Program hold points

Require explicit new authorization before:

- production outbound external communication;
- production AI/provider credentials where not already separately authorized;
- autonomous external professional action;
- legal deadline certification / Official Truth promotion;
- public Capability marketplace/ranking/certification;
- broad product migration that deletes a working local implementation without parity/rollback evidence;
- MO-DE-007/008 or other deferred Data Engine G2 work;
- any architecture that makes Brain the direct canonical business API for Lite/MarkReg.

## 14. Immediate execution order — reconciled 2026-08-26

### Repository lead

1. close **#242** with the independent MO-CAP-001 audit and ledger reconciliation;
2. execute **#244 MarkReg → Knowledge Case producer/trusted resolver** and run the existing Knowledge acceptance path;
3. execute **MO-CAP-002 Knowledge governed Capability V2 strangler migration** for one real workload;
4. after the durable Communication foundation is accepted, own the send/reply authorization state machine and Knowledge #468 end-to-end integration;
5. own final cross-repository exact-head/authority merge gates.

### Assistant-engineer parallel lanes

1. **#243 MO-CAP-003 durable Communication foundation** — no live provider/send authority;
2. after the repository lead freezes the browser-session authority contract, Knowledge Expert Admin session bridge may proceed as a separate bounded lane;
3. cross-repository CI pin/freshness maintenance only after the owning integration changes are accepted;
4. conformance/golden test expansion where it does not overlap mainline authority files.

### Deferred

Do not begin MO-CAP-004, MO-CAP-005 or the domain Capability wave merely to create breadth. The next proof is **real reuse through independent consumers**.
