# LCR-A2b2b — CN exact-scope source-read receipt V3

- **Task ID:** `LCR-A2b2b`
- **Status:** `CONTRACT_AND_CONSUMER_ADAPTER / PILOT / OWNER_PRODUCER_NOT_DEPLOYED`
- **Repository:** `yoomarks/markorbit`
- **Baseline:** `43f67d37f9eee93480c56c8b9208af2d21ffcfe4`
- **Exact scope:** `CN / CNIPA / preliminary-publication Discovery / one normalized application-number range / one immutable source snapshot when acquired`
- **Current readiness consequence:** `FACT_PATH = EVIDENCE_MISSING / EXACT_SCOPE_COMPLETENESS_RECEIPT_MISSING`
- **Current source policy:** `source-admission-policy.cn-preliminary-publication-discovery.v1 / PILOT`
- **Expected PR title:** `feat(contracts): define CN exact-scope source-read receipt V3`

## 1. Repository and allowed paths

LCR-A2b2b is a bounded shared-contract and pure consumer-adapter task. Its allowed paths are:

- `packages/contracts/src/data-engine-discovery.ts`;
- `packages/contracts/tests/data-engine-discovery-contract.test.ts`;
- `packages/contracts/tests/trademark-lifecycle-contract.test.ts`, only if a regression assertion is required;
- `services/capability-engine/src/cn-preliminary-publication-discovery-pilot.ts`;
- `services/capability-engine/tests/cn-preliminary-publication-discovery-pilot.test.ts`;
- `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B2B-SOURCE-READ-RECEIPT-V3.md`.

The task does not change the Data Engine producer, lifecycle `SourceReadV1`, source-admission policy, Rule Pack readiness result, Method, Capability activation, database, migration, API, event, UI or Product workflow.

## 2. Objective and user-visible outcome

The objective is to define the first strict consumer contract for an owner-issued Data Engine receipt that records what happened during one exact-scope CN preliminary-publication source read attempt. The contract distinguishes:

```text
OBSERVED
EMPTY
NOT_OBSERVED
NOT_COVERED
UNAVAILABLE
```

It binds the result to the complete normalized query, immutable snapshot when one was acquired, producer implementation package, source corpus and Data Trust evidence, state-applicable scan/continuation details, result identity and a deterministic receipt fingerprint. Only `EMPTY` requires a completed exact-scope scan and trusted-silence evidence. `NOT_COVERED` may stop before pagination, while `UNAVAILABLE` may record an interrupted attempt. A pure Capability-side adapter may validate such a receipt against an exact request, but it cannot issue the receipt or synthesize it from the existing V2 paginated response.

There is no direct customer-facing change. The later user-visible protection is that an empty page, terminal cursor, successful HTTP response, missing key or transport failure can never be presented as “zero results”, “没有记录”, “无风险” or a current lifecycle conclusion without complete owner evidence.

The external Data Engine has not yet deployed this producer contract. Therefore this task does not make the current CN lifecycle `FACT_PATH` available and does not unlock the A1 lifecycle computation boundary's existing rejection of `EMPTY`.

## 3. Canonical sources

The contract and adapter are bounded by:

1. `AGENTS.md`, especially the evidence-owner, Capability, Official Truth, service-boundary and minimum-change locks.
2. `docs/product/MO-PRODUCT-CONSTITUTION.md`, which prevents implementation success, AI output, Provider Return or payment from becoming formal authority.
3. `docs/product/MO-PRODUCT-DECISION-LOG.md`, especially D-039 and D-043: lifecycle projection remains a candidate and must pass the locked admission sequence.
4. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A0-SCOPE-LOCK.md`, which defines the CN/CNIPA first branch and ten-gate admission boundary.
5. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2A-COMPUTATION-CONTRACT.md`, which keeps lifecycle computation transient and not admitted.
6. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B1-ADMISSION-READINESS-CONTRACT.md`, which separates evidence readiness from admission.
7. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B2A-EVIDENCE-TRUTH-REPAIR.md`, which records the current nine-missing/one-rejected readiness truth and orders this task next.
8. `packages/contracts/src/data-engine.ts`, which owns the Data Engine integration envelope and source-owner identity.
9. `packages/contracts/src/data-engine-discovery.ts`, which owns the V2 normalized query, result and paginated source contract.
10. `packages/contracts/src/trademark-asset-workspace.ts`, which supplies the five source-read state names without granting this receipt Product authority.
11. `packages/contracts/src/trademark-lifecycle.ts`, whose A1 `sourceRead()` continues to reject `EMPTY` until a deployed exact-scope owner receipt and later lifecycle admission exist.
12. `services/capability-engine/src/cn-preliminary-publication-discovery-pilot.ts`, which owns the current V2 pilot consumer and remains non-authoritative.
13. `services/capability-engine/src/source-admission-policy-catalog.ts`, whose exact current policy remains `PILOT`.
14. Data Engine owner documentation and implementation for Data Trust, CN preliminary-publication Discovery, acceptance and cursor behavior. Those external artifacts are evidence inputs; this repository cannot impersonate their owner.

If these sources disagree, the stricter evidence-owner and authority boundary wins. A local fixture, checksum, successful parse, Capability Return or Session Receipt cannot stand in for an owner-issued source-read receipt.

## 4. Contracts consumed and changed

### 4.1 Existing V2 contract retained

The V2 Discovery query, page and integration envelope remain backward compatible. V2 continues to describe a bounded page of observed candidate facts. It does not prove a complete scan and its `query_hash` is not promoted into V3 evidence merely because it matches the expected string format.

In particular, none of the following can become V3 `EMPTY`:

- V2 `results: []`;
- `next_cursor: null` or a terminal page;
- HTTP 200;
- HTTP 404 or V2 `not_found`;
- timeout, authentication failure, rate limit or 5xx;
- a caller-recomputed cursor checksum;
- `bounded_truncation: true`;
- a tombstone;
- a test fixture or locally materialized object.

### 4.2 New V3 source-read receipt

The shared contract adds a closed, versioned receipt shape and strict parser for exactly this source stream. It records four identities separately:

1. **Query identity:** the entire normalized query plus a SHA-256 fingerprint recomputed by the consumer from its canonical form.
2. **Snapshot identity:** snapshot ID and kind, watermark and source version.
3. **Producer implementation identity:** immutable producer package/build ID, version and fingerprint.
4. **Source coverage identity:** exact source corpus/package plus coverage and Data Trust evidence issued by their responsible owner.

The producer package identifies the implementation the receipt says ran. Identifying or validating that implementation package does not prove that the underlying source corpus is complete. Those identities must never be collapsed. The source corpus, coverage and Data Trust evidence must also bind the same receipt snapshot and corpus fingerprint; merely placing independent references beside each other is insufficient.

The receipt also binds:

- owner and authority identity;
- owner-issued receipt ID, contract version, issuance and read-completion time;
- state and controlled reason codes;
- page count and the state-applicable continuation chain, including whether the attempted scan completed;
- terminal cursor, truncation and overflow status;
- result count, exact source fact references and canonical result fingerprint;
- Data Trust dimensions and their exact evidence references;
- coverage-through, required-coverage-through and evaluation time;
- a canonical receipt fingerprint recomputed by the parser.

The parser is pure and fail-closed. The shared package may expose a reference helper for an already parsed receipt. It must not export a receipt materializer that allows MarkOrbit to masquerade as `MARKORBIT_DATA_ENGINE`.

### 4.3 Consumer adapter

The Capability pilot gains a pure adapter that:

- parses an already owner-issued V3 receipt;
- normalizes the Capability input using the existing V2 request rules;
- rejects any caller cursor because a V3 receipt binds one whole exact-scope read attempt rather than one caller-selected page;
- requires exact request range and page-size identity;
- returns only the parsed state and owner receipt/reference with every Product, lifecycle, Official Truth and execution authority fixed to `false`.

The adapter is not wired into the existing V2 executor and does not perform network, persistence or source-policy mutation.

## 5. Required behavior

### 5.1 State semantics

| State          | Permitted meaning                                                                              | Required proof                                                                                                                                                                                                                    | Forbidden meaning                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `OBSERVED`     | At least one Data Engine source fact was observed inside the exact receipt scope and snapshot. | At least one exact owner-backed fact reference, positive count and canonical result fingerprint.                                                                                                                                  | Complete lifecycle history, current legal state, or absence of other facts.                      |
| `EMPTY`        | The complete exact-scope scan found no source observation within verified source coverage.     | Zero count and zero fact references; complete scan; terminal cursor; no truncation or overflow; every Data Trust dimension asserted `PASS` and bound to exact owner references; `trusted_for_silence`; current coverage evidence. | Legal nonexistence, “not published”, all-clear or no risk.                                       |
| `NOT_OBSERVED` | No observed fact and no trustworthy complete-empty proof are available.                        | Zero count and references plus a controlled reason.                                                                                                                                                                               | Zero results, `EMPTY` or any all-clear representation.                                           |
| `NOT_COVERED`  | The source owner explicitly says the exact scope is outside current source coverage.           | Exact owner coverage decision and evidence reference.                                                                                                                                                                             | A consumer inference from 404, missing data, empty arrays or errors.                             |
| `UNAVAILABLE`  | The source read or required dependency could not complete.                                     | For a typed owner response, an owner-issued reason and explicit retryability. A total transport failure has only a local unavailable diagnostic, not a Data Engine receipt.                                                       | `EMPTY`, `NOT_OBSERVED`, an owner-issued result when no response exists, or source nonexistence. |

The exact `EMPTY` semantic is:

```text
NO_SOURCE_OBSERVATION_WITHIN_VERIFIED_COVERAGE_NOT_LEGAL_NONEXISTENCE
```

### 5.2 Complete exact-scope scan for `EMPTY`

An `EMPTY` receipt can assert complete scan only when its page-chain fields are internally consistent with all of the following:

1. the read began at the exact normalized query boundary;
2. every page belongs to one query fingerprint and immutable snapshot;
3. page numbers and emitted counts are contiguous;
4. no non-null cursor or page fingerprint is skipped, repeated or replayed within the chain or across snapshots;
5. no read-budget overflow occurred;
6. `bounded_truncation` is false;
7. the terminal cursor is null;
8. aggregate result count and canonical result fingerprint match the collected fact references;
9. no page or result limit silently ended the read.

These parser checks prove only structural and fingerprint consistency. A self-consistent receipt does not prove issuer authenticity, currentness, reachability, absence of revocation or suitability for a later lifecycle gate; those checks remain at the owner boundary. If timeout, authentication failure or total network failure prevents an owner response, MarkOrbit may retain a local unavailable diagnostic but cannot manufacture an owner-issued `UNAVAILABLE` receipt.

### 5.3 Data Trust boundary

The receipt keeps these dimensions distinct:

```text
queryable
complete
fresh
accepted
trusted_for_silence
```

Each dimension must bind its own asserted state and exact owner-evidence reference. `EMPTY` requires the receipt to assert `PASS` for all five; later owner-boundary validation still authenticates and resolves those references. `coverageThrough`, `requiredCoverageThrough` and `evaluatedAt` must be internally consistent with the asserted time boundary; receipt issue time and read-completion time cannot substitute for source freshness.

`accepted` means only Data Engine domain/data acceptance for this source corpus and scope. It is not source-use promotion, current production admission, Rule Pack admission or Capability verification.

`trusted_for_silence` means only that no source observation was found within verified coverage. It never certifies legal nonexistence.

### 5.4 Fixed authority boundary

A valid receipt and successful adapter parse retain every authority below as `false`:

```text
sourceUsePromoted
lifecyclePositionInferred
rulePackAdmitted
methodActivated
capabilityVerified
projectionPersistenceAuthorized
productBusinessStateCreated
officialTruthCreated
legalDeadlineCertified
recommendationAuthorized
executionAuthorized
```

The receipt cannot itself create a lifecycle milestone, current rail position, deadline, CTA, recommendation, Matter, Work, Execution, customer relationship or Workspace permission.

### 5.5 Current PILOT consequence

The existing policy remains:

```text
source-admission-policy.cn-preliminary-publication-discovery.v1 = PILOT
```

A synthetic fixture proves only parser behavior. Until the Data Engine owner deploys and issues an exact V3 receipt and later admission work independently validates it, the current readiness remains:

```text
FACT_PATH = EVIDENCE_MISSING / EXACT_SCOPE_COMPLETENESS_RECEIPT_MISSING
overall readiness = INCOMPLETE
admission consequence = NOT_ADMITTED
```

## 6. State transitions

The contract recognizes only evidence interpretation transitions. It does not mutate formal Product or admission state.

```text
untrusted input
  -> strict V3 parse and canonical fingerprint verification
      -> invalid: reject / no adapted outcome
      -> valid: one of OBSERVED | EMPTY | NOT_OBSERVED | NOT_COVERED | UNAVAILABLE
          -> exact Capability request binding
              -> mismatch or caller cursor: reject / no adapted outcome
              -> exact match: read-only owner receipt outcome
                  -> all authority remains false
```

No state may silently degrade into `EMPTY`. Unknown versions, schema drift, query/snapshot drift, incomplete page chains and dependency failures fail closed. Evidence known or reported through owner validation to be stale, superseded or revoked is also unusable; the pure parser does not independently discover external revocation.

## 7. UI states

Not applicable. LCR-A2b2b changes no page, route, component, responsive layout, Storybook state or Playwright journey.

Future UI work must never render `NOT_OBSERVED`, `NOT_COVERED` or `UNAVAILABLE` as zero, all-clear or legal nonexistence. `EMPTY`, if later admitted for a Product use, must retain the trusted-silence explanation and source snapshot boundary.

## 8. Events emitted and consumed

None.

The parser and adapter are pure. They emit no domain, outbox, audit, integration, notification or handoff event and consume no event. A parsed receipt is evidence input, not a Product event or formal-state mutation.

## 9. Acceptance tests

1. The V2 Discovery page and envelope remain backward compatible.
2. The V3 parser accepts one exact canonical fixture for each of `OBSERVED`, `EMPTY`, `NOT_OBSERVED`, `NOT_COVERED` and `UNAVAILABLE`.
3. `OBSERVED` requires one or more exact source fact references, a matching positive count and canonical result fingerprint.
4. `EMPTY` requires zero results and references, a complete exact-scope continuation chain, null terminal cursor, no truncation or overflow, and asserted `PASS` states bound to exact owner references for all five Data Trust dimensions.
5. `EMPTY` carries exactly `NO_SOURCE_OBSERVATION_WITHIN_VERIFIED_COVERAGE_NOT_LEGAL_NONEXISTENCE`; it cannot express legal nonexistence.
6. `NOT_OBSERVED`, `NOT_COVERED` and `UNAVAILABLE` carry controlled reasons; they never parse as `EMPTY`.
7. `NOT_COVERED` requires an explicit owner coverage decision; a consumer cannot infer it from an empty V2 response or transport status.
8. `UNAVAILABLE` records retryability and cannot carry positive fact references.
9. The V3 parser canonicalizes the complete normalized query and recomputes its fingerprint; a format-valid but caller-invented V2 query hash is insufficient.
10. Query, range, page size, schema, projection, ordering, limits, snapshot, watermark, source version, producer package, source corpus, coverage evidence, Data Trust state, receipt state, reason, count, result digest, time or receipt-fingerprint mutation fails closed.
11. Source corpus, coverage and Data Trust evidence bind the same exact snapshot ID and source-corpus fingerprint, and the producer implementation tuple cannot be reused as the source-corpus tuple.
12. Skipped, repeated, reordered or cross-snapshot pages; repeated non-null cursors or page fingerprints; non-contiguous emitted counts; dangling cursors; truncation; overflow; and page/result-limit exhaustion cannot assert complete scan.
13. V2 empty results, terminal page, HTTP 200/404, `not_found`, tombstone, timeout, authentication failure, rate limit, 5xx or invalid JSON cannot be adapted into V3 `EMPTY`.
14. The Capability adapter rejects inputs with a cursor and receipts whose exact range or page size differs from the normalized request.
15. A successful adapter result includes only parsed owner evidence and retains every source-promotion, lifecycle, Rule Pack, Method, Capability, persistence, Product, Official Truth, deadline, recommendation and execution authority as `false`.
16. No exported MarkOrbit helper can materialize an owner-issued V3 receipt.
17. The existing A1 lifecycle contract continues to reject `EMPTY`.
18. The current A2b2a CN readiness fixture remains nine `EVIDENCE_MISSING` gates plus `CURRENT_PRODUCTION_ADMISSION = EVIDENCE_REJECTED / SOURCE_POLICY_PILOT`; `FACT_PATH` remains missing.
19. No source policy, persistence, migration, runtime registration, API, event or UI behavior changes.

## 10. Validation commands

Run from the dedicated LCR-A2b2b worktree:

```text
pnpm --filter @markorbit/contracts exec vitest run tests/data-engine-discovery-contract.test.ts tests/trademark-lifecycle-contract.test.ts tests/trademark-lifecycle-rule-pack-readiness-contract.test.ts
pnpm --filter @markorbit/capability-engine exec vitest run tests/cn-preliminary-publication-discovery-pilot.test.ts
pnpm --filter @markorbit/contracts lint
pnpm --filter @markorbit/contracts typecheck
pnpm --filter @markorbit/contracts test
pnpm --filter @markorbit/contracts build
pnpm --filter @markorbit/capability-engine lint
pnpm --filter @markorbit/capability-engine typecheck
pnpm --filter @markorbit/capability-engine test
pnpm --filter @markorbit/capability-engine build
pnpm exec prettier --check packages/contracts/src/data-engine-discovery.ts packages/contracts/tests/data-engine-discovery-contract.test.ts services/capability-engine/src/cn-preliminary-publication-discovery-pilot.ts services/capability-engine/tests/cn-preliminary-publication-discovery-pilot.test.ts docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A2B2B-SOURCE-READ-RECEIPT-V3.md
pnpm validate:workspace
pnpm validate:persistence-boundaries
pnpm task:prepush
```

## 11. Non-goals

LCR-A2b2b does not:

- deploy or change the external Data Engine producer;
- allow MarkOrbit, a Capability, test fixture, Provider or AI response to issue a Data Engine owner receipt;
- change the current source-admission policy from `PILOT` or create a replacement production policy;
- make `FACT_PATH` or any other Rule Pack admission gate available;
- remove the A1 `EMPTY` prohibition or wire V3 directly into lifecycle computation;
- admit a Rule Pack, source, Method, Capability, runner, projection or Product workflow;
- infer lifecycle position, future event, rule window, deadline, grace period, prediction, recommendation or CTA;
- persist a lifecycle projection, current head, receipt or Product state;
- create Official Truth, certify a legal deadline or authorize execution;
- add a service endpoint, database table, migration, event, Gateway composition, UI route, Storybook state or Playwright journey;
- expand beyond CN/CNIPA preliminary-publication Discovery or generalize a speculative cross-jurisdiction receipt framework;
- implement LCR-A2b2c Method/runner work, LCR-A2b2d professional review, LCR-A2b2e production evidence or LCR-A2c admission.

## 12. Completion and PR boundary

LCR-A2b2b is complete only when the shared V3 parser, consumer adapter, adversarial tests and this task record agree on the exact state meanings and authority boundary; all applicable validation passes; and the diff contains only the declared paths.

Completion preserves:

```text
Data Engine owner producer deployed = no
current source policy = PILOT
current FACT_PATH = EVIDENCE_MISSING
current Rule Pack = NOT_ADMITTED
lifecycle EMPTY unlocked = no
runtime/persistence/API/event/UI change = none
```

The PR title is:

```text
feat(contracts): define CN exact-scope source-read receipt V3
```
