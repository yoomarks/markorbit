# MarkOrbit × Data Engine Integration Governance

Status: **ACTIVE — G0 Contract Freeze**

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

- **G0 — Contract Freeze:** freeze query contract, missing/error semantics, auth/security, tracing and runtime behavior.
- **G1 — Protected Query Runtime:** authenticated MarkOrbit Gateway → Data Engine runtime integration with real cross-repo acceptance evidence.
- **G2 — Change Feed:** durable fact-change feed/cursor ownership after G1 is green.
- **G3 — Brain Integration:** indexing/retrieval consumption after upstream facts and change semantics are stable.
- **G4 — Lite Productization:** Daily Workspace/content workflows after G2/G3 contracts are proven.

G1 must not be treated as complete before G0 is closed. G2-G4 are not authorized by this governance baseline.

## Shared requirement IDs

See `requirements.md`. IDs `MO-DE-001` through `MO-DE-008` are reserved and must be reused by both repositories.

## Change control

Any change affecting request/response schema, auth, coverage, freshness, missing semantics, cursor semantics, error envelope or tracing must be classified as:

- additive-compatible;
- migration-required;
- breaking.

Breaking or migration-required changes require a cross-repo RFC/decision before implementation. Additive changes still require contract/schema tests.

## Evidence standard

Repository-local green CI is necessary but insufficient. G1 requires a third evidence lane proving a real authenticated path:

`MarkOrbit Gateway -> Data Engine runtime -> validated response`

At minimum acceptance must cover success, unauthorized/forbidden, not-found, not-covered/no-observation, rate-limit, timeout, provider 5xx, schema mismatch and request/correlation tracing.

## Current baseline snapshot

- MarkOrbit consumer baseline: `149b0de8568fe3e82b81e6eb006030426cc0f5aa`
- Data Engine provider baseline: `e1776dcceaef571e7e4ffc9cbb22688c04bc5015`
- Current integration stage: `G0`

Machine-readable status: `integration-status.yaml`.
