# MarkOrbit × Data Engine Integration Governance

Status: **ACTIVE — G1 Primary Gateway Runtime Admission**

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
- **G1-A — Authenticated Transport Acceptance:** the real auth-required Data Engine runtime and MarkOrbit consumer adapter were proven cross-repository under `MO-DE-006`. This acceptance is complete.
- **G1-B — Primary Gateway Runtime Admission:** the normal MarkOrbit `apps/gateway` runtime must own the authenticated product-facing read path to Data Engine under `MO-DE-009`. This admission is pending.
- **G2 — Change Feed:** durable fact-change feed/cursor ownership remains deferred until the whole G1 stage is complete.
- **G3 — Brain Integration:** indexing/retrieval consumption remains deferred until upstream facts and change semantics are stable.
- **G4 — Lite Productization:** Daily Workspace/content consumption remains deferred until the required upstream integration stages are proven.

Overall G1 is **not complete** until the primary Gateway runtime admission in `MO-DE-009` is accepted. The isolated G1 acceptance runtime used by `MO-DE-006` remains valid evidence for transport/auth semantics, but it is not the primary product Gateway admission. G2-G4 are not authorized by this governance baseline.

## Shared requirement IDs

See `requirements.md`. IDs `MO-DE-001` through `MO-DE-009` are reserved and must be reused by both repositories where applicable.

## Change control

Any change affecting request/response schema, auth, coverage, freshness, missing semantics, cursor semantics, error envelope or tracing must be classified as:

- additive-compatible;
- migration-required;
- breaking.

Breaking or migration-required changes require a cross-repo RFC/decision before implementation. Additive changes still require contract/schema tests.

## Evidence standard

Repository-local green CI is necessary but insufficient.

`MO-DE-006` proved the real cross-repository transport/auth path and its frozen error/tracing semantics. `MO-DE-009` must additionally prove the normal MarkOrbit primary Gateway runtime path:

`authenticated MarkOrbit client -> primary apps/gateway createRuntime() -> Data Engine runtime -> validated response`

The `MO-DE-009` acceptance must retain the established success, authentication, not-found/coverage, rate-limit, timeout, provider failure, schema mismatch and request/correlation tracing semantics. It must not add change-feed consumption, cursor ownership, Brain indexing, Lite productization, new persistence or production authorization.

## Current baseline snapshot

- MarkOrbit consumer baseline: `9d6179ae2f5f0c85b93b7bcc6b86fac6f023edb4`
- Data Engine provider baseline: `57be59ab27e41ac99ae95922ce802aa189c48181`
- G0: **complete**
- G1-A / `MO-DE-006`: **transport/auth acceptance complete**
- G1-B / `MO-DE-009`: **primary Gateway runtime admission pending**
- G2-G4: **deferred / not authorized**

Machine-readable status: `integration-status.yaml`.
