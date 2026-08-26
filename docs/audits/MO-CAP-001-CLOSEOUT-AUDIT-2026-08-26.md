# MO-CAP-001 Closeout Audit — 2026-08-26

- **Program:** `MO-CAP-FOUNDATION`
- **Task:** `MO-CAP-001 Capability Runtime Execution & Admission Plane`
- **Audit issue:** `#242`
- **Audited main:** `6ddf351b0425a0024901dce10ba54f7243dade47`
- **Decision:** `SINGLE_CONSUMER_PROVEN`
- **Foundation reusable:** **NO**
- **Production external authority:** **false**

## 1. Executive decision

The original P0 runtime gap identified on 2026-08-25 is closed on current main.

The normal governed Capability path is no longer the historical hard-coded fixture. Current main contains a provider-neutral runtime contract, durable Capability and Implementation Profile resolution, trusted Gateway/internal caller admission, governed execution/output validation, restart-safe replay, production bootstrap, and a schema-independent Lite consumer client.

MO-CAP-001 is therefore no longer `AUTHORIZED_NEXT` or merely `IMPLEMENTATION_BOUND`. It has reached **`SINGLE_CONSUMER_PROVEN`**.

It is deliberately **not** promoted to `FOUNDATION_REUSABLE`. The foundation admission rule requires at least two independent consumers. Lite is the first main-repository product consumer thin slice; a second independent consumer has not yet been admitted through the same governed Capability request/binding contract.

This audit does not authorize production AI credentials, outbound communication, payment, filing, legal-truth promotion, autonomous professional action, MO-DE-007/008, or any other external side effect.

## 2. Historical roadmap reconciliation

The 2026-08-25 roadmap named eight conceptual work packages. During implementation the repository used more granular issue/PR labels, so the numeric WP labels no longer map one-to-one to the original planning rows. This is planning drift, not a second architecture.

The audited mapping is:

| Original requirement                              | Merged implementation evidence                                                                                                                                                    | Audit result                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Historical TASK-010..013 / M6 reconciliation      | Capability Foundation architecture/audit/roadmap at `c594ad26906d44e4b026bf86a5cc1d3507f1b95e`; implementation preserved the M6 registry/learning system rather than replacing it | PASS                                            |
| Runtime contract family                           | PR #198, merge `ff7e19ce9b7a3f7ad8d422ba9cac6bb01c5d055c`                                                                                                                         | PASS                                            |
| Durable Implementation Profile registry/binding   | PR #228, merge `8b599b33e04dbe3d654587c37b0acb67b7858165`, migration 0066                                                                                                         | PASS                                            |
| Governed invocation replacing normal fixture path | PR #227, merge `f9b7fa6af81be052f5992d3033567ca58edb75fe`                                                                                                                         | PASS                                            |
| Trusted Gateway/internal admission                | PR #232, merge `2692079d527f80356645fef7a22b5836e1a4630a`                                                                                                                         | PASS                                            |
| Reliability/version/output/authority conformance  | PR #233, merge `f4039c56a3b98d87122c850cff5ebc384f69a746`                                                                                                                         | PASS                                            |
| Durable production bootstrap                      | PR #235, merge `25a37443c36497ec4c4b852db3bd3e4474bb8ce2`                                                                                                                         | PASS                                            |
| Restart-safe governed replay                      | PR #239, merge `f88911ca77ff64d0004d4ad550f2711e18851b7c`, migration 0067                                                                                                         | PASS                                            |
| First product consumer thin slice                 | PR #241, merge `6ddf351b0425a0024901dce10ba54f7243dade47`                                                                                                                         | PASS                                            |
| Independent integration/authority audit           | issue #242 / this document                                                                                                                                                        | PASS subject to exact-head CI for this audit PR |

The implementation labels `WP07`, `WP07B` and `WP08` should therefore be read as implementation sequencing labels, not as a replacement for the roadmap's conceptual WP numbering.

## 3. Exact-head evidence reviewed

The audit rechecked the final PR heads rather than relying on earlier superseded heads.

### Minimum runtime contract — PR #198

Final head: `3891d086f0a461ca5b05a9b42eaefbc8a2eb6534`.

Hosted exact-head workflows include successful `validation`, M6 WP-02/03/04/05/06, M8 WP-06 and Knowledge Core Cross Repo E2E runs.

### Durable Implementation Profile — PR #228

Final head: `c39180d3cc776192b16c3f00afa8e2b8266c94a3`.

Successful exact-head workflows include `MO-CAP-001 Implementation Profile Registry`, `validation`, M6 registry/observation/reflection/profile/capability-center gates, Product Loop Content Preparation and M8 reliability.

### Governed invocation — PR #227

Final head: `578c4cdac12f9609e3267205d7c5fe2ec261f3e0`.

Successful exact-head workflows include `validation`, Knowledge Core Cross Repo E2E, M6 WP-02/03/04/05/06 and M8 WP-06.

### Reliability/authority conformance — PR #233

Final head: `2c74c2413ca5d6dae898bda3c2a337e794df4c89`.

Successful exact-head workflows include dedicated `Capability Runtime Conformance`, `validation`, and the affected M6 gates.

### Trusted Gateway admission — PR #232

Final head: `50ae065f24596126397cf090b8f9efc178e9d58b`.

Successful exact-head workflows include `validation`, M6 WP-02/03/04/05/06 and M8 WP-06.

### Production governed runtime — PR #235

Final head: `6b73136a4a928c3887b9b1b439327d7481770f61`.

Successful exact-head workflows include dedicated `Capability Production Runtime`, `validation`, and the affected M6 gates. The dedicated workflow includes isolated PostgreSQL restart acceptance.

### Restart-safe governed replay — PR #239

Final head: `c429d063261415dc9bd4d1cf559ebe2eff0c1488`.

Successful exact-head workflows include dedicated `Capability Runtime Durable Replay`, `MO-CAP-001 Implementation Profile Registry`, `validation`, Knowledge Core Cross Repo E2E, M6 affected gates, Product Loop Content Preparation and M8 reliability.

### Lite governed invocation consumer — PR #241

Final head: `ea54fea3ceb56cc358e58bd99907e9b404f8e3c4`.

Successful exact-head workflows are `validation`, `Browser and Visual Validation`, `M6 WP-06 Authenticated Capability Center`, `Product Loop Today Prepared Action` and `Product Loop Feedback Observability`. The Browser workflow's real-runtime path was repaired to build the Capability Engine dependency closure before startup on a clean runner.

## 4. Acceptance matrix

| MO-CAP-001 acceptance requirement                                         | Current-main evidence                                                                                          | Result                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| normal request path does not manufacture the historical trademark fixture | #227 removes fixture behavior from the normal unconfigured path; milestone-only compatibility remains explicit | PASS                             |
| accepted Capability version resolved through governed definition resolver | runtime contract + production bootstrap use durable runtime Capability registry                                | PASS                             |
| caller cannot select provider/model/endpoint/credential                   | #198 contract boundary, #232 Gateway/internal admission, #241 Lite allowlisted request construction            | PASS                             |
| trusted Workspace/Principal/caller-product context                        | #232 derives caller context from authenticated Core session and route-owned `LITE` product                     | PASS                             |
| applicability/eligibility fail closed                                     | runtime/conformance coverage in #198/#233                                                                      | PASS                             |
| exact approved Implementation Profile/version binding                     | #228 durable registry/selector + runtime receipt/binding contracts                                             | PASS                             |
| output contract validation before success                                 | #198/#233 and production bootstrap validators                                                                  | PASS                             |
| evidence/provenance retained                                              | governed outcome/receipt contract and Managed AI provenance checks                                             | PASS                             |
| exact replay idempotent                                                   | #233 same-process/concurrent conformance                                                                       | PASS                             |
| conflicting replay rejected                                               | #233 and #239                                                                                                  | PASS                             |
| stale definition/profile/binding rejected                                 | #233 conformance matrix                                                                                        | PASS                             |
| restart recovery for durable governed state                               | #235 durable registry/profile restart plus #239 full capability-level replay identity persistence              | PASS                             |
| runtime cannot auto-mutate Capability canon                               | authority consequences remain false and no learning/canon write is part of invocation success                  | PASS                             |
| no cross-service SQL                                                      | reviewed implementation remains service/API/contract bounded                                                   | PASS                             |
| first normal product consumer                                             | #241 Lite client through authenticated Gateway Capability route                                                | PASS                             |
| two independent consumers                                                 | only one governed product consumer thin slice is currently admitted                                            | **OPEN FOR FOUNDATION_REUSABLE** |

## 5. Remaining gaps are no longer MO-CAP-001 runtime-construction gaps

### 5.1 Second independent consumer

The next material proof is reuse, not another runtime layer. A second independent product/repository must consume the same governed request/binding/outcome contract before the foundation is promoted to `FOUNDATION_REUSABLE`.

### 5.2 Managed AI first cross-repository migration

Knowledge currently has a real shared Managed AI HTTP client, but its admitted path is the Managed-AI-specific internal endpoint rather than the schema-independent Capability V2 request contract. The next MO-CAP-002 migration should use a strangler approach: preserve the existing working path for rollback, route one bounded Knowledge workload through governed Capability V2, compare parity/provenance, and only then retire direct dependency on the specialized execution endpoint for that workload.

### 5.3 Managed Communication runtime

`@markorbit/contracts` already contains provider-neutral Managed Communication semantics, but no durable Communication runtime/service exists on current main. This is now a real downstream blocker for Knowledge Expert communication and remains P0.

## 6. Program sequencing after this audit

Immediate order after this closeout:

1. **MO-CAP-002 — Knowledge governed Capability V2 strangler migration** for one real workload; preserve rollback and exact provider/provenance evidence.
2. **MO-CAP-003 — durable Communication foundation**, in parallel where file/migration ownership is isolated.
3. **MarkReg → Knowledge Case producer/trusted resolver**, because Knowledge already has the Case consumer foundation and is blocked on the authoritative MarkReg producer boundary.
4. **MO-CAP-003 controlled send/reply integration** only after durable no-send foundations are accepted.
5. Obtain a second independent governed Capability consumer before any `FOUNDATION_REUSABLE` claim.

P1 `MO-CAP-004 Governed Document Understanding` and `MO-CAP-005 Governed Retrieval` remain deferred until the P0 reuse pattern is proven. Domain Capability wave remains roadmap-only and separately scope-locked.

## 7. Governance note

At audit time the Core repository has an active `Protect main` ruleset covering the default branch with deletion/non-fast-forward protection, strict required status checks, pull-request enforcement, review-thread resolution and linear history, with no bypass actor.

This governance evidence is repository-level only. It does not imply that Knowledge or Data Engine have equivalent protection, and it does not authorize production traffic.

## 8. Final decision

**PASS — MO-CAP-001 runtime construction and first-consumer thin slice.**

**STATE — `SINGLE_CONSUMER_PROVEN`.**

**HOLD — `FOUNDATION_REUSABLE` until a second independent governed consumer is accepted.**

The next engineering objective is cross-product reuse of the runtime that now exists, not construction of a competing runtime or premature P1 breadth.
