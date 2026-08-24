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

Accepted evidence includes:

- 200 success;
- 401 unauthenticated;
- provider 403 semantics where applicable/reserved by contract;
- `not_found` with MarkOrbit coverage preserved as unknown;
- 429 / retry-after;
- timeout;
- provider 5xx / unavailable behavior;
- schema/version mismatch fail-closed behavior;
- request/correlation ID propagation;
- provider `auth_mode=required`.

Mocks/fixtures support local tests but do not replace the recorded real cross-repository acceptance evidence.

### MO-DE-009 — Primary Gateway Protected Query Admission

Priority: **P1**  
Primary owner: **MarkOrbit Gateway**  
Provider owner: **Data Engine only where provider behavior changes are required**  
Status: **ACCEPTED / COMPLETE**

The frozen Data Engine V1 read plane is admitted into the normal MarkOrbit primary Gateway runtime. PR #190 was squash-merged as `eebbba5248a3f6ccc8e514700c1dcf555f6fbc06` after its exact head `ea0a49c2817a92249dadca138790f2288e756652` passed validation, commercial runtime reliability and authenticated real cross-repository acceptance.

Accepted scope:

- Data Engine URL, service credential and bounded timeout are wired into normal `apps/gateway` runtime options;
- invalid/missing Data Engine configuration fails closed; there is no anonymous provider fallback;
- Data Engine service credentials remain server-side at Gateway;
- product-facing Data Engine reads are protected by existing MarkOrbit session + Workspace resolution and `workspace:read`;
- bounded read-only CN/US case query shapes from frozen V1 are admitted;
- the Gateway preserves `not_found`, unknown coverage, `service_unavailable`, provider auth failure, rate-limit, timeout and schema mismatch distinctions;
- request/correlation tracing passes through the normal Gateway path;
- US 360 `as_of`, `history_limit`, `assignment_limit` and `ttab_limit` are forwarded under the provider's frozen maxima;
- history, assignments and TTAB limits are enforced at the Gateway boundary;
- unsupported query parameters fail closed instead of being silently ignored;
- the real acceptance path uses normal `createRuntime()` and an auth-required Data Engine runtime.

Accepted evidence includes:

- authenticated MarkOrbit client -> primary Gateway -> auth-required Data Engine -> validated 200 response;
- MarkOrbit authentication/Workspace permission denial before provider access;
- missing/invalid Data Engine service configuration fails closed;
- real provider 401 remains a provider-auth failure and never becomes a factual negative;
- real provider 404 remains `not_found` with coverage unknown;
- real 429 / `Retry-After` backpressure remains retryable;
- invalid provider required-mode configuration and unavailable/5xx behavior remain retryable service failure;
- timeout remains retryable `service_unavailable`;
- request/correlation IDs remain traceable end to end;
- `/us/changes` remains unexposed.

Final exact-head workflow evidence:

- validation: run `32707949365` — success;
- M8 WP-06 Commercial Runtime Reliability: run `32707949344` — success;
- MO-DE G1 Cross-Repo Acceptance: run `32707949408` — success.

The final cross-repo workflow tested Data Engine SHA `57be59ab27e41ac99ae95922ce802aa189c48181`. During closeout, Data Engine `main` had advanced to `bdc43d12763a4db200b5363c8eda3060868d2d0b`, but the frozen V1 contract blob remained identical at `7567908e4d1c8d79eef27fb763fe63d58281f02a`; no contract drift was observed.

Explicitly still out of scope after G1 completion:

- `/api/v1/us/changes` product consumption;
- consumer cursor/checkpoint persistence;
- `MO-DE-007` or `MO-DE-008` implementation;
- Brain indexing/retrieval integration;
- Lite Data Engine productization;
- new cross-service persistence or direct Data Engine SQL;
- production credentials, deployment, GA or Official Truth authorization.

Overall G1 is complete with `MO-DE-006` + `MO-DE-009` accepted.

## G2 — Decision Freeze Only; Implementation Deferred

### MO-DE-007 — US Trademark Change Feed Ownership

Priority: **P2 DECISION**  
Status: **DEFERRED — NOT AUTHORIZED BY G1 COMPLETION**

Proposed direction for later joint review: Data Engine owns factual change detection and durable provider-side change feed; MarkOrbit Core owns business/product event interpretation. Brain/Lite consumption is downstream and must not redefine source facts.

### MO-DE-008 — Cursor / Consumer Checkpoint Ownership

Priority: **P2 DECISION**  
Status: **DEFERRED — NOT AUTHORIZED BY G1 COMPLETION**

Freeze later whether the provider exposes durable feed cursors and which consumer checkpoints are owned by MarkOrbit. Dedupe/idempotency and replay semantics must be explicit before implementation.

## Current execution order

1. `MO-DE-001..005` — accepted and frozen.
2. `MO-DE-006` — real transport/auth cross-repository acceptance complete.
3. `MO-DE-009` — primary Gateway protected query admission complete; overall G1 is closed.
4. `MO-DE-007/008` — remain deferred; no implementation authorization.
5. Brain and Lite Data Engine productization remain downstream and are not authorized by this requirement set.
6. Any G2/G3/G4 work requires a new explicit authorization/decision rather than being inferred from G1 completion.
