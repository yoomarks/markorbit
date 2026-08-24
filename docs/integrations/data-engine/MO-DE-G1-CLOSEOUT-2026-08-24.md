# MarkOrbit × Data Engine G1 Closeout — 2026-08-24

## Decision

**G1 — Protected Query Runtime: COMPLETE.**

This closeout does not rewrite the historical `MO-DE-006` acceptance. It records the two-part G1 model established during the Post-M15 integration audit:

- **G1-A / MO-DE-006 — Authenticated Transport Acceptance:** complete in PR #177.
- **G1-B / MO-DE-009 — Primary Gateway Protected Query Admission:** complete in PR #190.

G1 is complete because both layers are now accepted.

## Consumer evidence

### MO-DE-006

- PR: #177
- merge SHA: `20bd9710e4af02e92fcfaa737ef67a9e58479145`
- scope: real cross-repository service auth, transport, errors, timeout, contract validation and tracing using the bounded G1 acceptance runtime

This remains valid transport/auth evidence. It is not reclassified as primary product-Gateway admission.

### MO-DE-009

- PR: #190
- accepted exact head: `ea0a49c2817a92249dadca138790f2288e756652`
- squash merge SHA: `eebbba5248a3f6ccc8e514700c1dcf555f6fbc06`
- primary runtime: normal `apps/gateway` `createRuntime()`
- final validation run: `32707949365` — success
- final commercial runtime reliability run: `32707949344` — success
- final authenticated cross-repository run: `32707949408` — success

The final cross-repository gate exercised the primary Gateway against an auth-required Data Engine runtime and retained the earlier `MO-DE-006` regression evidence.

## Accepted primary Gateway behavior

The admitted read path is:

```text
authenticated MarkOrbit client
-> normal apps/gateway createRuntime()
-> MarkOrbit session + Workspace resolution
-> workspace:read authorization
-> server-held Data Engine Bearer credential
-> auth-required Data Engine V1 runtime
-> contract/source-owner validated response
```

Accepted product-facing read routes are limited to:

- contract;
- CN case;
- US case;
- US case 360;
- US history;
- US assignments;
- US TTAB.

The Gateway additionally enforces the frozen provider query envelope:

- US 360: `as_of`, `history_limit <= 5000`, `assignment_limit <= 500`, `ttab_limit <= 500`;
- US history: `limit <= 5000`;
- US assignments: `limit <= 500`;
- US TTAB: `limit <= 500`;
- unsupported query keys fail closed rather than being silently dropped.

## Failure and factual-state semantics retained

The primary Gateway acceptance proves that:

- unauthenticated MarkOrbit callers are rejected before provider access;
- callers lacking `workspace:read` are rejected before provider access;
- missing/invalid Data Engine consumer configuration fails closed;
- provider authentication failure remains a provider-auth failure and is never converted to a factual negative;
- provider `404/not_found` remains `not_found` while coverage remains unknown;
- provider 429 / `Retry-After` remains retryable backpressure;
- provider invalid required-auth configuration / unavailable / 5xx remains retryable service failure;
- consumer timeout remains retryable `service_unavailable`;
- request and correlation identifiers remain traceable end to end;
- incompatible contract metadata fails closed.

## Provider baseline and drift check

The final authenticated `MO-DE-009` cross-repository workflow intentionally pinned Data Engine SHA:

`57be59ab27e41ac99ae95922ce802aa189c48181`

During closeout review, Data Engine `main` had advanced to:

`bdc43d12763a4db200b5363c8eda3060868d2d0b`

The intervening provider changes were Singapore IPOS operator/snapshot-integrity work. The canonical frozen V1 integration contract blob remained identical on both provider SHAs:

`7567908e4d1c8d79eef27fb763fe63d58281f02a`

Therefore no V1 contract drift was observed between the accepted runtime SHA and the provider `main` observed during closeout.

## Explicit non-authorizations

G1 completion does **not** authorize or imply:

- `MO-DE-007` implementation;
- `MO-DE-008` implementation;
- `/api/v1/us/changes` product consumption;
- consumer cursor/checkpoint persistence;
- Brain indexing/retrieval integration;
- Lite Data Engine productization;
- direct cross-service SQL;
- Data Engine source-fact writeback from MarkOrbit;
- production credentials or production deployment;
- GA/release authorization;
- Official Truth or legal-conclusion authority.

`MO-DE-007` and `MO-DE-008` remain deferred decision items. Any G2, G3 or G4 work requires a new explicit authorization rather than being inferred from this closeout.

## Authority boundary retained

- Data Engine remains authoritative for acquisition, observations, normalized facts, coverage/freshness, provider query behavior, provider authentication, provider-side pagination/cursors and factual change detection.
- MarkOrbit remains authoritative for product use cases, Gateway exposure, Workspace authorization, consumer degradation, business-event semantics and consumer acceptance.
- Missing source observation is not legal nonexistence.
- Assignment recordation is not a legal-title conclusion.
- TTAB procedural data is not a substantive legal outcome.
- Runtime availability is never converted into a factual assertion.

## Final state

- G0 / `MO-DE-001..005`: **COMPLETE / FROZEN**
- G1-A / `MO-DE-006`: **COMPLETE**
- G1-B / `MO-DE-009`: **COMPLETE**
- Overall G1: **COMPLETE**
- G2 / `MO-DE-007..008`: **DEFERRED / NOT AUTHORIZED**
- G3 Brain integration: **DEFERRED / NOT AUTHORIZED**
- G4 Lite productization: **DEFERRED / NOT AUTHORIZED**
- Production authorization: **FALSE**
