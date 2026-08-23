# MarkOrbit Core KV2 Acceptance Receipt

## Integration

- ID: `MO-KNOWLEDGE-CORE-KV2-COMPLETION-2026-08-23`
- Consumer: `yoomarks/markorbit`
- Provider: `yoomarks/markorbit-knowledge`
- Provider commit: `24d2f4811512e42d357845bb61114c1b6287f8d4`
- Consumer commit: the exact PR head recorded as `CORE_HEAD_SHA` by the acceptance workflow
- Protocol: `ReadyPackage V2`
- Protocol version: `1.0`

## Acceptance authority

The authoritative completion evidence is the `knowledge-core-kv2-real-acceptance` artifact produced by `.github/workflows/knowledge-core-cross-repo-e2e.yml` on the exact consumer PR head. The workflow rejects a provider or consumer SHA mismatch before acceptance and writes both exact SHAs into `acceptance.json`.

No provider implementation changes are made in this repository. The provider is checked out at the immutable commit above. Production activation remains disabled.

## Evidence matrix

| Check                                   | Required result | Evidence path                                   |
| --------------------------------------- | --------------- | ----------------------------------------------- |
| E2E-01 Normal V2 delivery               | PASS            | `v2-phase1.json` / `acceptance.json`            |
| E2E-02 Response-loss exact replay       | PASS            | `v2-phase1.json` / `acceptance.json`            |
| E2E-03 Process-restart local recovery   | PASS            | `v2-restart-recovery.json` / `acceptance.json`  |
| E2E-04 Frozen submission corruption     | PASS            | `v2-phase1.json` / `acceptance.json`            |
| E2E-05 Deterministic consumer rejection | PASS            | `v2-phase1.json` / `acceptance.json`            |
| E2E-06 Idempotency conflict             | PASS            | `v2-phase1.json` / `acceptance.json`            |
| E2E-07 Concurrent duplicate delivery    | PASS            | `v2-phase1.json` / `acceptance.json`            |
| E2E-08 V1 real-Core regression          | PASS            | workflow V1 regression step / `acceptance.json` |

The receipt is complete only when the exact-head workflow finishes successfully and uploads `acceptance.json` with all eight scenarios equal to `PASS`, `realHttp=true`, `realCorePostgresql=true`, `realKnowledgeSqlite=true`, `processRestart=true`, `exactFrozenRequestReplay=true`, and `exactPrHead=true`.

## Activation boundary

- Production activation: disabled
- V2 to V1 fallback: prohibited
- Data Engine MO-DE-007/008: out of scope
