# MarkOrbit × Data Engine Integration Governance

Status: **G1 COMPLETE — MO-DE-010 bounded Trademark Asset product admission COMPLETE**

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
- **G1-B — Primary Gateway Runtime Admission:** the normal MarkOrbit `apps/gateway` `createRuntime()` owns the authenticated product-facing read path to Data Engine under `MO-DE-009`. Complete.
- **Post-G1 bounded admission — MO-DE-010:** one explicit Trademark Asset detail use case consumes the existing CN/US case read plane on demand. Complete.
- **G2 — Change Feed:** durable fact-change feed/cursor ownership remains deferred and is **not authorized** by G1 or `MO-DE-010` completion.
- **G3 — Brain Integration:** indexing/retrieval consumption remains deferred pending an explicit downstream authorization.
- **G4 — Lite Productization:** global Data Engine-backed Lite productization remains deferred. `MO-DE-010` is a narrow completed exception for Trademark Asset detail only, not a stage unlock.

Overall G1 is **complete**. The frozen Data Engine V1 read plane passed transport/auth acceptance and primary product-Gateway admission. It does **not** authorize production deployment, Official Truth claims, `/api/v1/us/changes` consumption, cursor/checkpoint persistence, Brain indexing or broad Lite Data Engine productization.

`MO-DE-010` is also **complete**. An existing M10 Trademark Asset detail request can use its durable Asset Anchor to obtain eligible CN/US case facts through Gateway and then let Lite perform the existing conflict-preserving composition. Data Engine credentials stay in Gateway; provider failure degrades to the existing M10 detail rather than fabricating absence; no source facts are written into Lite/Core persistence.

## Shared requirement IDs

See `requirements.md`. IDs `MO-DE-001` through `MO-DE-010` are reserved and must be reused by both repositories where applicable.

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

The accepted G1 read surface is limited to contract, CN case, US case, US 360, US history, US assignments and US TTAB reads. `/us/changes` remains absent from the primary Gateway.

## MO-DE-010 accepted bounded admission

The accepted Trademark Asset detail path is:

`authenticated client -> Gateway -> existing Lite asset/anchor -> Gateway Data Engine CN/US case read -> Gateway factual mapping -> Lite composition -> client`

The implementation preserves these boundaries:

- an anchor without supported `CN`/`US` jurisdiction and `APPLICATION_NUMBER` performs no provider lookup;
- admitted contribution kinds are `APPLICATION_STATUS`, `APPLICATION_DATE`, `REGISTRATION_DATE`, `OWNER_NAME` and `NICE_CLASSES` where the V1 payload explicitly supplies them;
- `RENEWAL_DATE` is admitted only from an explicit provider field and is never derived;
- provider "current" records enter the product contribution path with `UNKNOWN` freshness and are not promoted to legal-current truth;
- Lite remains the sole owner of composition/conflict/attention/recommendation semantics;
- provider not-found/unavailable/error states never become negative facts;
- no background synchronization, change feed, cursor, consumer checkpoint, source-fact persistence or writeback is introduced;
- `officialTruthVerifiedByLite=false`, `legalDeadlineCertified=false` and `protectedActionAuthorized=false` remain invariant.

Authorization and runtime evidence:

- governance authorization: PR #193, final head `3c561fb32180a8409dccf020c88f4e8c97d81c96`, merge `51fe5f48869d4a650fd302281c18c74a6ba6f93f`;
- runtime implementation: PR #194, final head `67ec70907df7ee1a8e9efd1620aad941802bf6ed`, squash merge `9600daa6b3ddc8d75cfbfcd443341ee755a30129`;
- real provider acceptance SHA: `57be59ab27e41ac99ae95922ce802aa189c48181`;
- PR #194 exact-head workflows all completed successfully: validation `32722585033`, M8 `32722585200`, cross-repo `32722585121`, Candidate Qualification `32722585024`, Today Prepared Action `32722585061`, Content Preparation `32722585054`, M7 Conversion Analytics `32722585110`, Feedback Observability `32722585052`.

The PR #194 cross-repository job genuinely executed the auth-required Data Engine provider and Gateway acceptance suite: 8 Gateway test files / 42 tests passed, including the real-provider Trademark Asset path. During closeout audit, however, its two Lite-specific commands were found to use the nonexistent package selector `@markorbit/lite`, so those two commands were no-ops. This did not hide a Lite compilation failure: the same exact runtime head independently passed Lite lint/typecheck in the M7 and validation gates. It did mean the cross-repository workflow itself needed to be corrected before final acceptance evidence could be considered complete.

## Acceptance-gate correction

PR #195 corrected the cross-repository workflow package selector from `@markorbit/lite` to the actual package `@markorbit/lite-service`. This was evidence hardening only; it changed no runtime, provider contract or product scope.

- PR #195 final head: `012afea8d4a98d8c4362082bc8157d88559e23be`.
- PR #195 squash merge: `d996b1cd1b3e4f18b4e68b593bb6bfb8d88f2992`.
- validation run `32724940769`: success.
- corrected MO-DE cross-repo run `32724940740`: success.
- the corrected run explicitly executed Gateway typecheck and `@markorbit/lite-service` typecheck (`tsc --noEmit`).
- Gateway Data Engine acceptance: 8 test files / 42 tests passed.
- Lite trusted recomposition acceptance: 1 test file / 3 tests passed.
- the real-product case again proved `authenticated primary Gateway -> real auth-required Data Engine -> Lite fact recomposition`.

The corrected #195 run is the final cross-repository acceptance evidence used for `MO-DE-010` closeout.

## Provider drift check at MO-DE-010 closeout

The exact cross-repository runtime acceptance remains pinned to Data Engine SHA `57be59ab27e41ac99ae95922ce802aa189c48181`.

During MO-DE-010 closeout, Data Engine `main` had advanced to `5e4888a001de866ca5b811151cf0afe13d5eef71`. The canonical V1 contract file still has blob SHA `7567908e4d1c8d79eef27fb763fe63d58281f02a`, identical to the accepted frozen contract. No V1 contract drift was observed.

## Change control

Any change affecting request/response schema, auth, coverage, freshness, missing semantics, cursor semantics, error envelope or tracing must be classified as:

- additive-compatible;
- migration-required;
- breaking.

Breaking or migration-required changes require a cross-repo RFC/decision before implementation. Additive changes still require contract/schema tests.

## Current baseline snapshot

- MarkOrbit G1 primary Gateway merge: `eebbba5248a3f6ccc8e514700c1dcf555f6fbc06` (PR #190).
- MarkOrbit G1 closeout main: `32f3f0894d151ca871755e3650d0f7507efa8c26` (PR #191 merge).
- MO-DE-010 authorization merge: `51fe5f48869d4a650fd302281c18c74a6ba6f93f` (PR #193).
- MO-DE-010 runtime merge: `9600daa6b3ddc8d75cfbfcd443341ee755a30129` (PR #194); accepted runtime head `67ec70907df7ee1a8e9efd1620aad941802bf6ed`.
- MO-DE-010 acceptance-gate repair merge: `d996b1cd1b3e4f18b4e68b593bb6bfb8d88f2992` (PR #195); corrected acceptance head `012afea8d4a98d8c4362082bc8157d88559e23be`.
- final corrected cross-repo acceptance: run `32724940740` — success.
- Data Engine runtime SHA used by the final authenticated acceptance: `57be59ab27e41ac99ae95922ce802aa189c48181`.
- Data Engine `main` observed during MO-DE-010 closeout: `5e4888a001de866ca5b811151cf0afe13d5eef71`.
- Frozen Data Engine V1 contract blob SHA: `7567908e4d1c8d79eef27fb763fe63d58281f02a`; no drift observed.
- G0: **complete**.
- G1-A / `MO-DE-006`: **complete**.
- G1-B / `MO-DE-009`: **complete**.
- Overall G1: **complete**.
- `MO-DE-010`: **complete**.
- `MO-DE-007/008`: **deferred / no implementation authorization**.
- Brain Data Engine integration and global Lite Data Engine productization: **deferred / not authorized**.
- Production authorization: **false**.
- Official Truth / deadline certification / Protected Action authorization: **false**.

Machine-readable status: `integration-status.yaml`.
