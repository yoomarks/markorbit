# LCR-A2a — Trademark Lifecycle transient computation contract

Status: implementation task; does not admit a runtime Rule Pack

## 1. Task identity and repository scope

- **Task ID:** LCR-A2a
- **Repository:** `yoomarks/markorbit`
- **Allowed paths:**
  - `packages/contracts/src/trademark-lifecycle.ts`
  - `packages/contracts/tests/trademark-lifecycle-computation-contract.test.ts`
  - this task record
- **Expected PR title:** `feat(contracts): add lifecycle computation boundary`

## 2. Objective and user-visible outcome

Define the strict transient boundary between an admitted lifecycle Capability computation and the future MarkReg-owned durable projection. The result makes later runtime and persistence work reviewable without allowing a Capability result to acquire a Product projection ID, version, current head or retention authority.

This task has no direct UI change. Its later user-visible consequence is that lifecycle rail data can be traced to one exact normalized input and one exact computation output instead of being assembled ad hoc in the browser.

## 3. Canonical sources

1. `docs/planning/MO-TRADEMARK-LIFECYCLE-LCR-A0-SCOPE-LOCK.md`, frozen by D-043.
2. `packages/contracts/src/trademark-lifecycle.ts`, the accepted LCR-A1 semantic and read boundary.
3. `packages/contracts/src/brain-method.ts` and `brain-method-activation.ts`, the existing Method/package lifecycle authority.
4. Existing Data Engine CN preliminary-publication Discovery contracts and their current Capability source-admission policy.

No text in this task record overrides those sources.

## 4. Contracts consumed and changed

The task adds:

- `TrademarkLifecycleComputationInputV1`;
- `TrademarkLifecycleComputationOutputV1`;
- strict parsers for both contracts;
- canonical fingerprint material and SHA-256 helpers for both contracts;
- typed source-date observations with available, unknown and conflicting branches.

It reuses, without redefining, the A1 track, source-read, source-reference, stage, milestone, time-assertion, evaluation, conflict, currentness, coverage and authority semantics.

## 5. Required behavior

### Input

- carries the exact Workspace, Asset, track, source reads, source-date observations, Method package, materialized dependencies and professional-review receipt reference;
- admits observation evidence only when the identical source reference occurs in an exact source read;
- keeps `OBSERVED`, `NOT_OBSERVED`, `NOT_COVERED` and `UNAVAILABLE` distinct and continues to reject `EMPTY` until an owner supplies the complete-scope empty-read receipt required by A1;
- normalizes unordered source facts and dependencies before calculating its fingerprint;
- rejects duplicate fact codes, unadmitted references, invalid dates/time zones, future observations, unsupported fields and fingerprint drift.

### Output

- carries a `COMPUTED` transient result, the exact input fingerprint, typed lifecycle semantics, Method/dependency lineage, professional-review receipt reference and its own fingerprint;
- can be parsed only together with the signed normalized input whose Workspace, Asset, as-of time, track, source reads, Method, dependencies and professional-review receipt it exactly repeats;
- is checked through every A1 projection semantic invariant;
- cannot contain projection ID, projection version, current-head state, Capability execution receipt or persistence authority;
- retains the A1 prohibition on `REVIEWED_TIMING`, certified legal deadlines, Official Truth creation and execution authorization;
- requires the professional-review receipt to remain an exact materialized dependency.

## 6. State transitions

None. Parsing or computing these transient objects does not create, advance, replace or select a MarkReg projection head. A later LCR-A3 command may create a projection only after independently revalidating exact input, lineage, currentness and admission.

## 7. UI states

Not applicable in LCR-A2a. Loading, empty, partial, stale, conflict, unavailable, permission and success UI remain owned by the later authorized read and HIFI integration tasks.

## 8. Events emitted and consumed

None. The task defines pure transport contracts and fingerprints only.

## 9. First candidate slice audit

The evidence-backed candidate remains:

`CN / CNIPA / TRADEMARK_APPLICATION / FILING_TO_PRELIMINARY_PUBLICATION / basis ANY / source-recorded completed history only`

Its permitted output would be limited to source-recorded historical filing and preliminary-publication milestones. It would not infer the current procedural position, calculate a legal deadline or grace period, predict registration, produce a recommendation, create a CTA or mutate Work, Matter or Execution.

It is **not admitted by LCR-A2a**. Current `origin/main` evidence still fails the complete A0 admission gate:

| A0 gate                     | Current evidence                                                                                                                 | Disposition                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Exact fact contract         | Data Engine `CN_CASE_CURRENT_PRELIMINARY_PUBLICATION_DISCOVERY_V2` provides filing/preliminary-publication fields and provenance | Candidate evidence available |
| Source-use admission        | Current Capability policy explicitly classifies the CN discovery source as `PILOT`                                               | Blocked                      |
| Executable Method           | No exact ACTIVE `TEMPORAL_RESOLUTION` package exists for this lifecycle slice                                                    | Blocked                      |
| Supported runner            | Existing generic runner can host an admitted executable kind, but no lifecycle runner is registered                              | Blocked                      |
| Professional responsibility | No exact lifecycle Rule Pack review receipt/currentness/revocation contract exists                                               | Blocked                      |
| Time semantics              | `Asia/Shanghai` can represent day-precision source dates; no rule-window calendar is admitted                                    | Candidate boundary only      |
| Fixture matrix              | A1 plus this task cover strict negative semantics, but the A0 history/basis/boundary/grace/source-runtime matrix is incomplete   | Blocked                      |
| Full usable-output cost     | No production source-read latency and full usable-output cost admission exists                                                   | Blocked                      |

Promoting the existing pilot by renaming it, treating test latency as production evidence or using the historical CN duration classifier as a temporal Rule Pack would be false admission and is prohibited.

## 10. Acceptance tests

1. A complete normalized input parses and its fingerprint reproduces.
2. Any fact or dependency change invalidates the input fingerprint.
3. Unadmitted source references, duplicate/conflicting invalid candidates and detached review receipts fail closed.
4. A complete output parses only with its exact signed input, reproduces its fingerprint and contains no Product projection identity/head fields.
5. A self-signed output from another tenant, Asset or source lineage is rejected even if both standalone fingerprints are valid.
6. Input normalization uses locale-independent binary ordering, and one source version cannot impersonate two competing sources by changing observation metadata.
7. Output tampering, detached review lineage, `REVIEWED_TIMING` and certified-deadline claims fail closed.
8. Existing A1 contract tests remain green.

## 11. Validation commands

```text
pnpm --filter @markorbit/contracts lint
pnpm --filter @markorbit/contracts typecheck
pnpm --filter @markorbit/contracts test
pnpm --filter @markorbit/contracts build
pnpm format:check
pnpm task:prepush
```

## 12. Non-goals

- no Rule Pack activation or source-use promotion;
- no Capability Definition/Profile, runtime runner or service bootstrap;
- no MarkReg persistence, current head, migration or read API;
- no Gateway composition, interaction overlay or UI fixture replacement;
- no country-wide lifecycle model, legal deadline, prediction, recommendation or workbench handoff;
- no changes to the existing M5 Formal Matter evidence lifecycle.

## 13. Next bounded task

LCR-A2b may begin only when it can produce the missing exact source-use, Method activation, professional-review/currentness and full usable-output cost evidence. If those gates cannot be satisfied, the CN branch remains `NOT_ADMITTED`; LCR-A3 must not persist it as a current projection.
