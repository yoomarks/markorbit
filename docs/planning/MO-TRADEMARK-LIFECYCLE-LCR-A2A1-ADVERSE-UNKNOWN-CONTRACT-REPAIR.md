# LCR-A2a1 — Adverse lifecycle computation-result contract repair

## 1. Task record

- **Task ID:** `LCR-A2a1`
- **Repository:** `yoomarks/markorbit`
- **Authoritative base:** `09f4f913cdff32a8642aa0629131a5e610156743`
- **Allowed paths:** the lifecycle contract, its computation-contract tests, and this record
- **Expected PR title:** `fix(contracts): represent adverse lifecycle computation results`

## 2. Objective and user-visible outcome

Repair the contradiction between non-positive source reads and projection-shaped computation output. `NOT_OBSERVED`, `NOT_COVERED` and `UNAVAILABLE` are required to carry no positive source reference, while a `COMPUTED` lifecycle projection requires at least one stage backed by a positive source reference. The contract must represent those three honest adverse outcomes without fabricating evidence, borrowing an unrelated historical read, or implying that no work or risk exists.

This task has no direct UI release. It makes later partial, not-covered and unavailable UI states contractually honest.

## 3. Canonical sources

1. `MO-TRADEMARK-LIFECYCLE-LCR-A0-SCOPE-LOCK.md` and D-043.
2. `MO-TRADEMARK-LIFECYCLE-LCR-A2A-COMPUTATION-CONTRACT.md`.
3. `packages/contracts/src/trademark-lifecycle.ts`, especially `SourceReadV1`, projection provenance and transient input/output binding.
4. The LCR-A2b2c three-director review finding that a second-scope `OBSERVED` read must not be borrowed to serialize a current adverse result.

## 4. Contracts consumed and changed

The task preserves `TrademarkLifecycleComputationInputV1` and the existing `TrademarkLifecycleComputationOutputV1` `COMPUTED` branch. It adds a separate typed adverse result branch and a strict result parser/fingerprint helper so callers can receive either a source-backed computation output or an explicitly `NOT_COMPUTED` adverse result.

No A1 stage, milestone or time-assertion provenance rule is weakened.

## 5. Required behavior

The adverse result must:

- accept exactly one retained source-read state from `NOT_OBSERVED`, `NOT_COVERED` or `UNAVAILABLE`;
- reject `OBSERVED`, `EMPTY`, mixed states, multiple scopes and any positive source reference;
- repeat and bind the paired normalized input's Workspace, Asset, as-of time, track, source reads, Method package, materialized dependencies, professional-review receipt and input fingerprint;
- carry explicit reason and dependency semantics for the exact adverse state;
- use the following closed state mapping:

  | Source read    | Coverage      | Currentness | Dependency    |
  | -------------- | ------------- | ----------- | ------------- |
  | `NOT_OBSERVED` | `PARTIAL`     | `UNKNOWN`   | `AVAILABLE`   |
  | `NOT_COVERED`  | `NOT_COVERED` | `UNKNOWN`   | `AVAILABLE`   |
  | `UNAVAILABLE`  | `PARTIAL`     | `UNKNOWN`   | `UNAVAILABLE` |

- carry `NOT_COMPUTED_DOES_NOT_ESTABLISH_NO_EVENT_DEADLINE_RISK_OR_ACTION` as a fixed machine-readable limitation;
- carry a deterministic result fingerprint;
- keep every authority consequence false;
- contain no stages, current position, last position, time assertion, next item, recommendation, destination, CTA, legal deadline, prediction, projection identity, current head or persistence authority.

The result means only that this exact computation could not produce a source-backed lifecycle projection. It never means that the trademark has no event, deadline, risk or required action.

The SHA-256 fingerprint is deterministic content integrity only. It is not a signature, producer authentication or source-owner admission. The contract also does not prove that a syntactically valid `scopeId` is semantically the correct owner scope for the Asset and track; that remains an owner/runtime responsibility.

## 6. State transitions

None. Parsing an adverse result does not activate a Method, verify a Capability, admit a Rule Pack, persist a projection, replace a current head, promote a source or authorize execution.

## 7. UI states

Not applicable in this task. The typed result can later support distinct `not observed`, `not covered` and `temporarily unavailable` presentation, but no route, component, Storybook fixture or Playwright journey is added here.

## 8. Events

No event is emitted or consumed. The adverse result is a transient contract value only.

## 9. Acceptance tests

1. Each of the three allowed adverse states parses with a single zero-reference exact source read and reproduces its fingerprint.
2. The result can be parsed only with the exact normalized input it repeats.
3. Workspace, Asset, track, as-of, input fingerprint, source read, Method, dependency or review-receipt drift fails closed.
4. `OBSERVED`, `EMPTY`, mixed states, multiple scopes, positive references, unknown states and unsupported fields fail closed.
5. State/reason mismatch, authority claims and result-fingerprint drift fail closed.
6. The adverse branch has no projection-shaped or action-bearing fields.
7. Existing `COMPUTED` input/output fixtures and all A1 lifecycle contract tests remain green.

## 10. Validation commands

```text
pnpm --filter @markorbit/contracts exec vitest run tests/trademark-lifecycle-computation-contract.test.ts
pnpm --filter @markorbit/contracts lint
pnpm --filter @markorbit/contracts typecheck
pnpm --filter @markorbit/contracts test
pnpm --filter @markorbit/contracts build
pnpm format:check
pnpm validate:workspace
pnpm validate:persistence-boundaries
pnpm task:prepush
```

## 11. Non-goals and stop conditions

This task does not relax positive-node provenance, create a synthetic source reference, change source policy, admit lifecycle `EMPTY`, implement a Data Engine producer, create a runtime runner, register a Capability, persist anything, expose an API or change UI.

Stop rather than encode a projection-shaped success when the exact source read is non-positive, or if the repair would require copying a positive reference from another scope.

## 12. Completion consequence

After completion, the transient boundary can distinguish:

```text
source-backed lifecycle computation -> COMPUTED output with projection semantics
pure non-positive source read       -> typed adverse NOT_COMPUTED result
```

Both remain transient and non-authoritative. LCR-A2b2c must consume the new adverse branch before it can claim complete negative-state fixtures.
