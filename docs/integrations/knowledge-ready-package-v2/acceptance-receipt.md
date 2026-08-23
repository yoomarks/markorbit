# MarkOrbit Core KV2 Acceptance Receipt

## Integration

- ID: `MO-KNOWLEDGE-CORE-KV2-COMPLETION-2026-08-23`
- Consumer: `yoomarks/markorbit`
- Provider: `yoomarks/markorbit-knowledge`
- Protocol: `ReadyPackage V2`
- Protocol version: `1.0`

## Acceptance rule

This receipt is valid only when generated from exact pinned commits and real integration evidence.

No provider implementation changes are made in this repository.

## Evidence matrix

| Check | Status |
| --- | --- |
| E2E-01 Normal V2 delivery | pending |
| E2E-02 Restart recovery | pending |
| E2E-03 Response loss replay | pending |
| E2E-04 Frozen submission corruption | pending |
| E2E-05 Deterministic consumer rejection | pending |
| E2E-06 Idempotency conflict | pending |
| E2E-07 Concurrent duplicate delivery | pending |
| E2E-08 V1 regression | pending |

## Activation boundary

- Production activation: disabled
- V2 to V1 fallback: prohibited
- Data Engine MO-DE-007/008: out of scope
