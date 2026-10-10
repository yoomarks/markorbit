# Core entitlement resolver scale evidence

M20-C1 uses the protected Core Workspace entitlement resolver on each US NAME page.
M20-C3 ([PR #1506](https://github.com/yoomarks/markorbit/pull/1506)) established the
original whole-history baseline: at 100,000 grant versions each resolver call
returned 41,527,782 logical JSON bytes. Its PR fixture p95 was 1,045.56 ms; the
main fixture p95 was 577.68 ms. These are separate warm serial runs, not a
production capacity estimate.

PostgreSQL Workspace reads now use the existing Workspace/key index to identify grant IDs
with a matching **historical** version and return **all** versions for those IDs.
The service still selects the latest recorded version at `asOf` before checking
subject, key, status and effective interval. A later revocation or subject/key
move therefore cannot resurrect an older grant. Unscoped agreement reads and
USER/assignment resolution retain their existing behavior. No authority cache
or new index is involved.

The scale suite measures the actual implementation against PostgreSQL 16 in
an isolated synthetic fixture database. Production admission, grants, permissions
and configuration remain subject to their existing owner evidence.

## Run the baseline

Use a disposable local PostgreSQL 16 database named exactly
`markorbit_core_entitlement_scale_test`. The suite refuses other database names
and nonlocal hosts. It applies the existing Core-owned migrations and truncates
only the commercial fixture table between scales. Do not point it at a shared
database.

```bash
pnpm install --frozen-lockfile
pnpm exec turbo run build --filter=@markorbit/core-service...
CORE_COMMERCIAL_SCALE_TEST_DATABASE_URL=postgresql://markorbit_test:markorbit-test-only@127.0.0.1:5432/markorbit_core_entitlement_scale_test \
CORE_COMMERCIAL_SCALE_POSTGRES_REQUIRED=1 \
CORE_COMMERCIAL_SCALE_EVIDENCE_PATH=/tmp/core-entitlement-scale-evidence.json \
pnpm --filter @markorbit/core-service exec vitest run tests/workspace-commercial-scale-postgres.test.ts
```

`M20 Core Entitlement Scale Evidence` runs the same required suite on applicable
PR heads and main commits and uploads its JSON evidence. The report identifies
the actual tested commit, Node/OS/CPU/memory and PostgreSQL settings. Local runs
without `CORE_COMMERCIAL_SCALE_COMMIT_SHA` are explicitly marked `local-unrecorded`.

## What is measured

At 1,000, 10,000 and 100,000 grant-version rows, one target Workspace has one
active Boolean grant. All remaining rows belong to another Workspace, including
active and revoked versions. These are synthetic records, not an estimate of
customer volume or a production dataset. Each scale uses three warmups and 30
serial calls to the real repository and resolver. The report retains every
elapsed sample plus nearest-rank p50, p95 and maximum.

The suite checks the total seeded row count, captures SQL and returned rows from
the actual resolver call (one direct-grant query), and runs
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` against it. The actual returned row count
and logical JSON byte count measure read amplification. Each initial scale must
return just the one target grant version despite unrelated Workspace history.
Logical JSON bytes exclude PostgreSQL protocol, formatting and HTTP overhead;
they are not a network billing measurement. The query plan includes server
execution time and buffer information. Resolver samples include PostgreSQL
transport, JSON decoding, repository cloning and service filtering. Fixture
insertion, analysis, EXPLAIN and assertions are outside the timed samples.

At the largest scale, semantic checks also prove that a newer revocation denies
the current read, a prior `asOf` still sees its historical grant, Boolean false
remains false, unrelated subjects/keys cannot authorize the target, and a future
recorded version does not affect an earlier read. Moving a grant to another
subject/key or USER scope cannot resurrect its previous Workspace version. Effective windows include
their start and exclude their end.

The deterministic gates are fixture/candidate row-count and authorization assertions. Host latency
is recorded as evidence; it is not converted into a brittle timing pass/fail gate.
The required CI mode fails if the fixture URL is missing. No database fixture
means an explicitly skipped local integration suite.

## Production decision boundary

### Authenticated HTTP fixture

M20-C5 adds a separate isolated database named exactly
`markorbit_m20_protected_http_test`. The same workflow runs the real Gateway and
Core runtimes over loopback HTTP, with PostgreSQL-backed sessions, users,
Workspaces, memberships, current authority and the commercial repository. It
issues a session through Core HTTP and uses the normal Gateway session, Origin
and CSRF path. No HTTP client or owner decision is mocked. The provider is an
explicit local **synthetic empty-page fixture**, and its admission/credential
are fixture-only. It does not run the Data Engine database or approve any source.

```bash
pnpm exec turbo run build --filter=@markorbit/core-service... --filter=@markorbit/gateway...
M20_PROTECTED_HTTP_TEST_DATABASE_URL=postgresql://markorbit_test:markorbit-test-only@127.0.0.1:5432/markorbit_m20_protected_http_test \
M20_PROTECTED_HTTP_POSTGRES_REQUIRED=1 \
M20_PROTECTED_HTTP_EVIDENCE_PATH=/tmp/m20-protected-http-evidence.json \
pnpm --filter @markorbit/gateway exec vitest run tests/data-engine-applicant-scale-postgres.test.ts
```

At each 1k/10k/100k grant-version size, the report separates the first request
after fixture preparation from three warmups, 30 serial requests and five batches
of eight concurrent requests. First request does **not** mean cold PostgreSQL,
process or filesystem cache. Timing covers the client request through complete
response-body consumption. Raw samples, p50/p95/max, batch duration and observed
fixture throughput are retained. Every measured request must succeed, revalidate
its session and entitlement, and reach the source-pinned provider exactly once.

After the largest fixture, a real TCP Core endpoint that never responds proves
the existing default 3s entitlement timeout returns retryable unavailable,
aborts the connection and makes no provider request. Durable grant revocation,
membership suspension and an invalid session deny subsequent real HTTP reads;
the provider receives no denied request. Timing is evidence, not a latency gate.
The report includes the tested commit, environment and existing budgets:
Core authentication/entitlement 3s each, provider 5s, PostgreSQL statement 10s,
pool maximum 10 and outer fixture guard 15s. This does not prove database work
cancellation when HTTP times out or define a single end-to-end production budget.

The workflow uploads `m20-protected-http-evidence.json` alongside the SQL report.
Required mode fails without the exact isolated local database; ordinary local
runs without its URL explicitly skip the five HTTP integration cases.

The Gateway Core request has a default 3,000 ms timeout. Compare the baseline with
that budget as a risk indicator only. The resolver-only fixture does not measure
HTTP or live authority; the separate HTTP fixture measures these and bounded
concurrency against the specified synthetic shape. Neither establishes
cold-cache behavior, deployment hardware, real provider/source capacity or
production grant shape. They do not measure USER assignment resolution or large
histories belonging to the same candidate grant. A below-budget serial sample is
not production capacity or an availability guarantee.

Before enabling production admission, retain owner-backed licence, physical
dataset/key/epoch mapping, coverage/currentness and trusted admission evidence
from Data Engine issue #883, plus an accepted full-path load/timeout budget.
Any subsequent query optimization must preserve latest-version selection before
status/subject/key filtering and historical `asOf` behavior; permission caches
must not substitute for live authority.

## Provider response-body timeout regression

M20-C6 fixes the shared Gateway Data Engine HTTP client: its existing provider
budget (default 5s) now covers response headers **and JSON body consumption**.
Previously the timer was cleared at headers, so an incomplete body could stall
past the budget and later appear as a contract error. An aborted body now uses
the existing retryable `DATA_ENGINE_UNAVAILABLE` / `service_unavailable` mapping.
Early transport-metadata rejection also aborts an unread response connection.
Complete malformed JSON and complete provider errors retain their existing
contract/error classifications.

`apps/gateway/tests/data-engine-http.test.ts` verifies this with actual local TCP
HTTP: incomplete 200 and 503 bodies, mismatched transport metadata, and completed
malformed JSON. A test-only provider watchdog bounds the failing baseline; the
assertions require the client to abort before provider EOF. The smaller 250ms
test budget does not change the production default. These are transport
regressions, not a production SLO, a single end-to-end request budget or source
admission evidence. Data Engine issue #883 remains the production evidence gate.
