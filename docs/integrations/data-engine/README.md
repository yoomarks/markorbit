# MarkOrbit × Data Engine Integration Governance

Status: **G1 COMPLETE — Protected Query Runtime admitted through primary Gateway**

This directory is the MarkOrbit consumer-side authority for cross-repository integration with `yoomarks/markorbit-data-engine`.

## Authority boundary

MarkOrbit owns product and consumer requirements: Core/Lite/Brain use cases, Gateway exposure, product-facing degradation, business semantics and consumer acceptance criteria.

Data Engine owns provider facts and provider contracts: acquisition, observations, normalized facts, coverage/freshness, query runtime, provider authentication, provider-side pagination/cursors and data-layer change detection.

Neither repository may silently redefine the other repository's authority.

## Single-source-of-truth rule

Do not maintain two copied requirement documents.

- MarkOrbit is authoritative for **consumer requirements** in this directory.
- Data Engine should maintain its own provider-side mirror under `docs/integrations/markorbit/` and reference the MarkOrbit requirement IDs unchanged.
- Each side records the other repository's baseline commit SHA in machine-readable status.
- A cross-repository behavior change requires the shared `MO-DE-*` ID in issue/PR/test/handoff evidence.

## Integration stages

- **G0 — Contract Freeze:** query contract, missing/error semantics, auth/security, tracing and runtime behavior are accepted and frozen under `MO-DE-001..005`.
- **G1-A — Authenticated Transport Acceptance:** the real auth-required Data Engine runtime and MarkOrbit consumer adapter were proven cross-repository under `MO-DE-006`. Complete.
- **G1-B — Primary Gateway Runtime Admission:** the normal MarkOrbit `apps/gateway` `createRuntime()` now owns the authenticated product-facing read path to Data Engine under `MO-DE-009`. Complete.
- **G2 — Change Feed:** durable fact-change feed/cursor ownership remains deferred and is **not authorized** by G1 completion.
- **G3 — Brain Integration:** indexing/retrieval consumption remains deferred pending an explicit downstream authorization.
- **G4 — Lite Productization:** Data Engine-backed Lite productization remains deferred pending an explicit downstream authorization.

Overall G1 is **complete**. This means the frozen Data Engine V1 read plane has passed both transport/auth acceptance and primary product-Gateway admission. It does **not** authorize production deployment, Official Truth claims, `/api/v1/us/changes` consumption, cursor/checkpoint persistence, Brain indexing or Lite Data Engine productization.

## Shared requirement IDs

See `requirements.md`. IDs `MO-DE-001` through `MO-DE-009` are reserved and must be reused by both repositories where applicable.

## G1 acceptance evidence

`MO-DE-006` established the real cross-repository transport/auth contract using the bounded acceptance runtime.

`MO-DE-009` then proved the normal product runtime path:

`authenticated MarkOrbit client -> primary apps/gateway createRuntime() -> auth-required Data Engine -> validated response`

The accepted primary Gateway path preserves:

- MarkOrbit session + Workspace resolution and `workspace:read` before provider access;
- server-side Data Engine Bearer credentials;
- contract-version/source-owner validation;
- `not_found` while preserving coverage as unknown;
- provider authentication failure without converting it into a factual negative;
- 429 / `Retry-After` backpressure;
- provider unavailable / 5xx semantics;
- bounded timeout behavior;
- request/correlation tracing;
- frozen V1 bounded query parameters and maxima for US 360/history/assignments/TTAB;
- fail-closed rejection of unsupported query parameters.

The accepted read surface is limited to contract, CN case, US case, US 360, US history, US assignments and US TTAB reads. `/us/changes` remains absent from the primary Gateway.

## Change control

Any change affecting request/response schema, auth, coverage, freshness, missing semantics, cursor semantics, error envelope or tracing must be classified as:

- additive-compatible;
- migration-required;
- breaking.

Breaking or migration-required changes require a cross-repo RFC/decision before implementation. Additive changes still require contract/schema tests.

## Current baseline snapshot

- MarkOrbit G1 primary Gateway merge: `eebbba5248a3f6ccc8e514700c1dcf555f6fbc06` (PR #190).
- MarkOrbit accepted PR head: `ea0a49c2817a92249dadca138790f2288e756652`.
- Data Engine runtime SHA used by the final authenticated cross-repo acceptance: `57be59ab27e41ac99ae95922ce802aa189c48181`.
- Data Engine `main` observed during closeout review: `bdc43d12763a4db200b5363c8eda3060868d2d0b`.
- Frozen Data Engine V1 contract blob SHA on both provider SHAs: `7567908e4d1c8d79eef27fb763fe63d58281f02a`.
- Final `MO-DE-009` exact-head workflow runs: validation `32707949365`, commercial runtime reliability `32707949344`, authenticated cross-repo `32707949408`; all completed successfully.
- G0: **complete**.
- G1-A / `MO-DE-006`: **complete**.
- G1-B / `MO-DE-009`: **complete**.
- Overall G1: **complete**.
- G2-G4: **deferred / not authorized**.
- Production authorization: **false**.

Machine-readable status: `integration-status.yaml`.
