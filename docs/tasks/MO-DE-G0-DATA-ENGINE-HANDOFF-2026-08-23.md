# MarkOrbit → Data Engine G0 Integration Handoff

Date: 2026-08-23  
Sender authority: `yoomarks/markorbit`  
Recipient provider: `yoomarks/markorbit-data-engine`  
Integration stage: **G0 — Contract Freeze**

## 1. Purpose

This is the formal cross-repository handoff for MarkOrbit consumption of Data Engine. It establishes shared requirement IDs, authority boundaries, acceptance sequencing and the exact response expected from Data Engine.

This handoff does **not** authorize production deployment, production credentials, live provider actions, worker rebuild/restart, data mutation outside already-authorized Data Engine work, or implementation of deferred G2/G3/G4 scope.

## 2. Baseline snapshot

- MarkOrbit baseline: `149b0de8568fe3e82b81e6eb006030426cc0f5aa`
- Data Engine baseline observed by MarkOrbit: `e1776dcceaef571e7e4ffc9cbb22688c04bc5015`
- Open PRs observed at handoff creation: none in either repository.
- MarkOrbit current engineering milestone M15 is complete; this cross-repository integration line is tracked separately as G0/G1/G2 rather than reusing MarkOrbit milestone numbers.

## 3. Authority model

### MarkOrbit owns

- Core/Lite/Brain product use cases;
- consumer-side requirements;
- Gateway exposure and authorization boundary;
- product degradation and business interpretation;
- consumer acceptance criteria.

### Data Engine owns

- source acquisition;
- observations and normalized factual records;
- coverage/freshness semantics;
- provider query runtime;
- provider-side authentication enforcement;
- provider pagination/cursor mechanics;
- factual change detection.

Neither side should copy and independently edit the other side's authority document.

## 4. Shared requirement IDs

Data Engine must adopt these exact IDs in its provider-side issues/PRs/tests/docs:

| ID | Priority | Required Data Engine action | Current gate |
| --- | --- | --- | --- |
| `MO-DE-001` | P0 | Freeze Query Contract V1 and canonical schema/version/compatibility policy | G0 |
| `MO-DE-002` | P0 | Freeze provider meaning of not-covered, no-observation, not-found, tombstone/supersession and service-unavailable | G0 |
| `MO-DE-003` | P0 | Freeze service authentication/security contract with `auth=required` as G1 target | G0 |
| `MO-DE-004` | P0 | Freeze request/correlation/trace propagation contract | G0 |
| `MO-DE-005` | P0 | Freeze runtime error envelope, timeout, rate-limit and retry semantics | G0 |
| `MO-DE-006` | P1 | Provide stable authenticated runtime for real cross-repo acceptance | G1, blocked by 001-005 |
| `MO-DE-007` | P2 decision | Jointly freeze US trademark change-feed ownership | Deferred; do not implement now |
| `MO-DE-008` | P2 decision | Jointly freeze feed cursor/consumer checkpoint ownership | Deferred; do not implement now |

The authoritative detail is in `docs/integrations/data-engine/requirements.md` in MarkOrbit.

## 5. Required Data Engine repository setup

Please establish a provider-side mirror such as:

```text
docs/integrations/markorbit/
├── README.md
├── provider-contract.md
├── runtime-semantics.md
└── integration-status.yaml
```

The filenames may follow Data Engine conventions, but the shared IDs must remain `MO-DE-001..008`.

The Data Engine status ledger should record:

- Data Engine current provider commit SHA;
- MarkOrbit consumer baseline SHA;
- each `MO-DE-*` status;
- canonical schema/contract paths;
- issue/PR/test evidence;
- unresolved cross-repo decisions.

## 6. G0 response required from Data Engine

Please return one formal response/handoff that resolves or proposes a concrete resolution for `MO-DE-001..005`.

For each ID include:

1. current provider behavior;
2. canonical code/schema/doc path;
3. proposed frozen V1 behavior;
4. additive vs migration-required vs breaking classification;
5. tests that prove the behavior;
6. Data Engine issue/PR/commit references;
7. any decision MarkOrbit must make before implementation.

If Data Engine cannot satisfy one requested semantic, do not silently substitute another behavior. Raise it explicitly under the same `MO-DE-*` ID as a cross-repo decision.

## 7. G1 acceptance target

After G0 is closed, both repositories should prove:

```text
MarkOrbit authenticated Gateway
  -> Data Engine authenticated runtime
  -> machine-readable V1 contract validation
  -> stable response/error semantics
  -> correlated evidence in both repositories
```

Minimum cases:

- 200 success;
- 401;
- 403 where applicable;
- not-found;
- not-covered;
- no-observation where supported;
- 429;
- timeout;
- provider 5xx;
- schema mismatch fail-closed behavior;
- request/correlation ID propagation.

Mocks and fixtures are supporting evidence only; they do not complete `MO-DE-006` without a real cross-repository runtime lane.

## 8. Explicitly deferred scope

Do not expand this handoff into:

- US change-feed implementation;
- cursor ledger implementation;
- Brain indexing;
- Lite Daily Workspace automation;
- caching redesign;
- new jurisdictions;
- CN change feed;
- automatic content generation.

`MO-DE-007` and `MO-DE-008` are ownership/contract decisions only until G1 is green.

## 9. Return format

Please return to MarkOrbit:

```text
DATA ENGINE RESPONSE — MO-DE G0
Provider main SHA: <sha>
Provider PR(s): <refs>

MO-DE-001: <PROPOSED/FROZEN/BLOCKED> + evidence
MO-DE-002: <PROPOSED/FROZEN/BLOCKED> + evidence
MO-DE-003: <PROPOSED/FROZEN/BLOCKED> + evidence
MO-DE-004: <PROPOSED/FROZEN/BLOCKED> + evidence
MO-DE-005: <PROPOSED/FROZEN/BLOCKED> + evidence
MO-DE-006: <READY/BLOCKED> + prerequisites
MO-DE-007: <decision comments only>
MO-DE-008: <decision comments only>

Cross-repo decisions required from MarkOrbit:
- ...
```

## 10. Completion rule

G0 closes only when the provider contract and consumer expectations agree on `MO-DE-001..005` with repository evidence. G1 closes only when `MO-DE-006` has real authenticated cross-repository acceptance evidence and both repository-local CI lanes are green.
