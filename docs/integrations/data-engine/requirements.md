# MarkOrbit × Data Engine Shared Requirements

These IDs are cross-repository identifiers. Data Engine must reuse the exact IDs in its provider-side issues, PRs, tests and handoff evidence when a requirement affects provider-owned behavior.

## G0 — Contract Freeze — complete

### MO-DE-001 — Query Contract V1 Freeze

Priority: **P0**  
Primary provider owner: **Data Engine**  
Consumer owner: **MarkOrbit Gateway / contracts**  
Status: **ACCEPTED / FROZEN**

Data Engine publishes the stable V1 query contract consumed by MarkOrbit, including request/response schema, schema/version identifier, supported query shapes, pagination behavior where applicable, compatibility policy and deprecation rules.

Acceptance:

- additive compatibility is the default for V1;
- breaking changes require explicit cross-repo migration/RFC;
- MarkOrbit validates responses against the frozen consumer contract;
- Data Engine identifies canonical contract artifacts and provider baseline commit.

### MO-DE-002 — Missing / Coverage / Tombstone Semantics

Priority: **P0**  
Owner: **Joint; Data Engine defines provider facts, MarkOrbit maps product behavior**  
Status: **ACCEPTED / FROZEN**

The integration preserves explicit distinctions between provider factual states. Until Data Engine emits evidence-backed `not_covered`, `no_observation` or `tombstone`, MarkOrbit preserves `unknown` rather than manufacturing those states.

Current frozen semantics include:

- `not_found` — queried entity/record is not found under the provider lookup semantics;
- `service_unavailable` — provider/runtime unavailable, never equivalent to a factual negative;
- `not_covered`, `no_observation` and `tombstone` — reserved factual states that require explicit provider evidence before MarkOrbit may expose them as such.

Acceptance: MarkOrbit must never infer factual absence from provider unavailability, missing coverage evidence or unsupported negative inference.

### MO-DE-003 — Service Authentication & Security Contract

Priority: **P0**  
Primary provider owner: **Data Engine**  
Consumer owner: **MarkOrbit Gateway**  
Status: **ACCEPTED / FROZEN**

The shared/non-production target is auth-required service-to-service access with Bearer/service-token semantics. Secrets remain environment-owned and are not committed to either repository.

Acceptance:

- G1 target is `auth=required`, not anonymous acceptance;
- 401 and 403 semantics remain distinguishable where the provider emits them;
- secrets are not committed to either repository;
- environment credentials are isolated;
- credential rotation does not redefine the application contract.

### MO-DE-004 — Request / Correlation Tracing

Priority: **P0**  
Owner: **Joint**  
Status: **ACCEPTED / FROZEN**

The accepted relationship is:

- `x-correlation-id` is the end-to-end correlation identifier;
- `X-Request-ID` is the provider-hop request trace identifier;
- response metadata must match the frozen transport contract before MarkOrbit accepts the response.

Acceptance: one MarkOrbit request can be traced across Gateway and Data Engine without log-text guessing.

### MO-DE-005 — Runtime Error Model, Timeout & Retry Semantics

Priority: **P0**  
Primary provider owner: **Data Engine**  
Consumer owner: **MarkOrbit Gateway**  
Status: **ACCEPTED / FROZEN**

The provider error envelope and MarkOrbit mapping distinguish retryable from non-retryable failures and never convert runtime failure into a factual negative.

Acceptance covers:

- 429 / retry-after behavior;
- timeout semantics;
- provider 5xx;
- malformed/incompatible response;
- stable machine-readable error code;
- fail-closed contract/version validation.

## G1 — Protected Query Runtime — complete

### MO-DE-006 — Authenticated Cross-Repository Transport Acceptance

Priority: **P1**  
Owner: **Joint**  
Status: **ACCEPTED / TRANSPORT COMPLETE**

`MO-DE-006` proved the real auth-required Data Engine runtime through the MarkOrbit Data Engine consumer adapter and an isolated Gateway acceptance runtime. It freezes transport/auth/error/tracing behavior but does **not** by itself admit Data Engine into the normal product Gateway runtime.

Accepted evidence includes 200 success, authentication boundaries, `not_found`, rate limiting, timeout, provider failure, schema/version mismatch, tracing and required provider auth. Mocks/fixtures support local tests but do not replace recorded real cross-repository acceptance evidence.

### MO-DE-009 — Primary Gateway Protected Query Admission

Priority: **P1**  
Primary owner: **MarkOrbit Gateway**  
Provider owner: **Data Engine only where provider behavior changes are required**  
Status: **ACCEPTED / COMPLETE**

The frozen Data Engine V1 read plane is admitted into the normal MarkOrbit primary Gateway runtime. PR #190 was squash-merged as `eebbba5248a3f6ccc8e514700c1dcf555f6fbc06` after its exact head `ea0a49c2817a92249dadca138790f2288e756652` passed validation, commercial runtime reliability and authenticated real cross-repository acceptance.

Accepted scope includes server-side Data Engine credentials, MarkOrbit session/Workspace authorization before provider access, bounded CN/US reads, fail-closed contract validation, preserved provider error/factual-state distinctions, tracing and frozen bounded query parameters. `/us/changes` remains unexposed.

Overall G1 is complete with `MO-DE-006` + `MO-DE-009` accepted.

## Post-G1 bounded product admission — complete

### MO-DE-010 — Trademark Asset On-Demand Product Admission

Priority: **P1**  
Primary owner: **MarkOrbit Gateway + Lite Trademark Asset Workspace**  
Provider owner: **Data Engine only if the frozen provider contract itself must change**  
Status: **ACCEPTED / COMPLETE**

`MO-DE-010` is the completed bounded downstream use of the already-admitted G1 read plane: enrich an existing M10 Trademark Asset detail view on demand from its durable Asset Anchor. This remains an explicit use-case authorization, not a general G4/Lite Data Engine productization unlock.

Accepted behavior:

- the existing Trademark Asset Anchor remains the product identity authority and provides `jurisdiction` plus an `APPLICATION_NUMBER` before Data Engine lookup;
- Gateway remains the only holder of Data Engine service credentials;
- `CN` anchors use the frozen CN case read and `US` anchors use the frozen US case read; unsupported jurisdictions do not query the provider;
- only schema-proven factual values become existing `TrademarkAssetFactContribution` kinds;
- accepted kinds are `APPLICATION_STATUS`, `APPLICATION_DATE`, `REGISTRATION_DATE`, `OWNER_NAME` and `NICE_CLASSES` where explicitly supplied;
- `RENEWAL_DATE` is accepted only from an explicit provider field and is never derived;
- provider "current" records carry `UNKNOWN` freshness and are not promoted to legal-current truth;
- Lite remains the sole owner of composition, conflict detection, attention, confidence and recommendations;
- provider not-found/unavailable/timeout/rate-limit/auth/incompatible-response states degrade to the original M10 detail and never manufacture negative facts;
- no source-fact persistence, background synchronization, change feed, cursor/checkpoint, writeback or cross-service SQL is introduced;
- `officialTruthVerifiedByLite=false`, `legalDeadlineCertified=false` and `protectedActionAuthorized=false` remain invariant.

Authorization and runtime evidence:

- governance authorization PR #193: final head `3c561fb32180a8409dccf020c88f4e8c97d81c96`, merge `51fe5f48869d4a650fd302281c18c74a6ba6f93f`;
- runtime PR #194: final head `67ec70907df7ee1a8e9efd1620aad941802bf6ed`, squash merge `9600daa6b3ddc8d75cfbfcd443341ee755a30129`;
- PR #194 exact-head workflows completed successfully: validation `32722585033`, M8 `32722585200`, cross-repo `32722585121`, Candidate Qualification `32722585024`, Today Prepared Action `32722585061`, Content Preparation `32722585054`, M7 Conversion Analytics `32722585110`, Feedback Observability `32722585052`;
- the #194 cross-repo run genuinely proved the auth-required Data Engine + Gateway suite at 8 files / 42 tests, including the real provider Trademark Asset path;
- closeout audit found that #194's two Lite-specific cross-repo commands used a nonexistent package selector and were no-ops; the #194 exact runtime head nevertheless independently passed Lite lint/typecheck in repository validation/M7.

Acceptance-gate correction:

- PR #195 corrected the selector to `@markorbit/lite-service` without changing runtime behavior or scope;
- PR #195 final head `012afea8d4a98d8c4362082bc8157d88559e23be`, squash merge `d996b1cd1b3e4f18b4e68b593bb6bfb8d88f2992`;
- validation run `32724940769` — success;
- corrected cross-repo run `32724940740` — success;
- the corrected run explicitly executed Gateway typecheck and Lite service typecheck;
- Gateway real-provider acceptance passed 8 files / 42 tests;
- Lite trusted recomposition acceptance passed 1 file / 3 tests;
- the real-product path again proved `authenticated primary Gateway -> real auth-required Data Engine -> Lite fact recomposition`.

The corrected #195 cross-repository run is the final acceptance evidence for `MO-DE-010` closeout.

Provider drift at closeout:

- accepted Data Engine runtime SHA: `57be59ab27e41ac99ae95922ce802aa189c48181`;
- Data Engine `main` observed during closeout: `5e4888a001de866ca5b811151cf0afe13d5eef71`;
- frozen V1 contract blob SHA: `7567908e4d1c8d79eef27fb763fe63d58281f02a`;
- V1 contract drift: none observed.

Explicitly still out of scope after `MO-DE-010` completion:

- `/api/v1/us/changes`, cursors, checkpoints or any `MO-DE-007/008` implementation;
- scheduled/background synchronization or proactive ingestion;
- Data Engine source-fact persistence inside Lite/Core;
- source-fact writeback or cross-service SQL;
- Brain indexing/retrieval integration;
- other Lite surfaces or global Data Engine productization;
- legal conclusions, Official Truth certification, deadline certification or Protected Action authorization;
- production credentials, production deployment or GA authorization.

## G2 — Decision Freeze Only; Implementation Deferred

### MO-DE-007 — US Trademark Change Feed Ownership

Priority: **P2 DECISION**  
Status: **DEFERRED — NOT AUTHORIZED BY G1 OR MO-DE-010 COMPLETION**

Proposed direction for later joint review: Data Engine owns factual change detection and durable provider-side change feed; MarkOrbit Core owns business/product event interpretation. Brain/Lite consumption is downstream and must not redefine source facts.

### MO-DE-008 — Cursor / Consumer Checkpoint Ownership

Priority: **P2 DECISION**  
Status: **DEFERRED — NOT AUTHORIZED BY G1 OR MO-DE-010 COMPLETION**

Freeze later whether the provider exposes durable feed cursors and which consumer checkpoints are owned by MarkOrbit. Dedupe/idempotency and replay semantics must be explicit before implementation.

## Current execution order

1. `MO-DE-001..005` — accepted and frozen.
2. `MO-DE-006` — real transport/auth cross-repository acceptance complete.
3. `MO-DE-009` — primary Gateway protected query admission complete; overall G1 is closed.
4. `MO-DE-010` — bounded Trademark Asset on-demand product admission complete and accepted, with the cross-repo Lite gate repaired by PR #195.
5. `MO-DE-007/008` — remain deferred; no implementation authorization.
6. Brain integration and global Lite Data Engine productization remain deferred.
7. Any broader G2/G3/G4 work requires a new explicit authorization/decision rather than being inferred from G1 or `MO-DE-010` completion.
