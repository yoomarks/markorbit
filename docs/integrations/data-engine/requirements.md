# MarkOrbit × Data Engine Shared Requirements

These IDs are cross-repository identifiers. Data Engine must reuse the exact IDs in its provider-side issues, PRs, tests and handoff evidence.

## G0 — Contract Freeze

### MO-DE-001 — Query Contract V1 Freeze

Priority: **P0**  
Primary provider owner: **Data Engine**  
Consumer owner: **MarkOrbit Gateway / contracts**  
Status: **PENDING PROVIDER FREEZE**

Data Engine must publish the stable V1 query contract consumed by MarkOrbit, including request/response schema, schema/version identifier, supported query shapes, pagination behavior where applicable, compatibility policy and deprecation rules.

Acceptance:

- additive compatibility is the default for V1;
- breaking changes require explicit cross-repo migration/RFC;
- MarkOrbit can validate responses against a machine-readable contract/schema;
- Data Engine identifies canonical contract artifacts and provider baseline commit.

### MO-DE-002 — Missing / Coverage / Tombstone Semantics

Priority: **P0**  
Owner: **Joint; Data Engine defines provider facts, MarkOrbit maps product behavior**  
Status: **PENDING JOINT FREEZE**

The integration must distinguish at least:

- `not_covered` — provider/source/jurisdiction is outside current coverage;
- `no_observation` — covered scope but no current observation exists;
- `not_found` — queried entity/record is not found under the contract's lookup semantics;
- `tombstone` or equivalent — a previously observed fact/entity has an explicit removal/supersession semantic where the provider can prove it;
- `service_unavailable` — provider/runtime unavailable, never equivalent to a factual negative.

Acceptance: MarkOrbit must never infer factual absence from provider unavailability or coverage gaps.

### MO-DE-003 — Service Authentication & Security Contract

Priority: **P0**  
Primary provider owner: **Data Engine**  
Consumer owner: **MarkOrbit Gateway**  
Status: **PENDING PROVIDER FREEZE**

Data Engine must define service-to-service authentication for shared/CI/non-production environments, including Bearer/service-token semantics, scope expectations, secret ownership, environment separation, rotation/revocation behavior, TLS expectations and failure responses.

Acceptance:

- G1 target is `auth=required`, not anonymous acceptance;
- 401 and 403 semantics are distinguishable;
- secrets are not committed to either repository;
- environment credentials are isolated;
- rotation can occur without redefining the application contract.

### MO-DE-004 — Request / Correlation Tracing

Priority: **P0**  
Owner: **Joint**  
Status: **PENDING JOINT FREEZE**

Freeze the canonical relationship between `X-Request-ID`, `x-correlation-id` and any provider trace identifier. Define generation, forwarding, echo/response behavior and logging requirements.

Acceptance: one MarkOrbit request can be traced across Gateway and Data Engine without relying on log-text guessing.

### MO-DE-005 — Runtime Error Model, Timeout & Retry Semantics

Priority: **P0**  
Primary provider owner: **Data Engine**  
Consumer owner: **MarkOrbit Gateway**  
Status: **PENDING PROVIDER FREEZE**

Freeze the provider error envelope and classify retryable vs non-retryable failures. Define behavior for rate limiting, timeout, upstream failure and schema/version mismatch.

Acceptance must cover at least:

- 429 / retry-after behavior;
- timeout semantics;
- provider 5xx;
- malformed/incompatible response;
- stable machine-readable error code;
- no automatic conversion of runtime failure into factual negative.

## G1 — Protected Query Runtime

### MO-DE-006 — Authenticated Cross-Repository Acceptance

Priority: **P1**  
Owner: **Joint**  
Status: **BLOCKED BY MO-DE-001..005**

Provide a stable testable Data Engine runtime and a MarkOrbit Gateway integration proving the real cross-repository path.

Minimum matrix:

- 200 success;
- 401 unauthenticated;
- 403 unauthorized/scope failure where applicable;
- `not_found`;
- `not_covered`;
- `no_observation` where supported;
- 429;
- timeout;
- provider 5xx;
- schema mismatch/fail-closed behavior;
- request/correlation ID propagation.

Mocks/fixtures may support local tests but do not satisfy final G1 acceptance by themselves.

## G2 — Decision Freeze Only; Implementation Deferred

### MO-DE-007 — US Trademark Change Feed Ownership

Priority: **P2 DECISION**  
Status: **DEFERRED — DO NOT IMPLEMENT DURING G0/G1**

Proposed direction for joint review: Data Engine owns factual change detection and durable provider-side change feed; MarkOrbit Core owns business/product event interpretation. Brain/Lite consumption is downstream and must not redefine source facts.

### MO-DE-008 — Cursor / Consumer Checkpoint Ownership

Priority: **P2 DECISION**  
Status: **DEFERRED — DO NOT IMPLEMENT DURING G0/G1**

Freeze later whether the provider exposes durable feed cursors and which consumer checkpoints are owned by MarkOrbit. Dedupe/idempotency and replay semantics must be explicit before implementation.

## Data Engine response required

Data Engine should return, using these exact IDs:

1. provider-side canonical contract/schema locations;
2. a proposed resolution for `MO-DE-001..005`;
3. implementation/acceptance plan for `MO-DE-006` after G0 freeze;
4. provider repository commit SHA and PR/issue references for each completed item;
5. any incompatibility with the requested semantics, stated as an explicit cross-repo decision request rather than silently diverging.
