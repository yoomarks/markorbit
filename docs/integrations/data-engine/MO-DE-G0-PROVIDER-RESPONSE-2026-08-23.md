# Data Engine Provider Response Receipt — MO-DE G0

Status: **ACCEPTED — G0 CLOSED**

This file records the formal provider response from `yoomarks/markorbit-data-engine` for the shared MarkOrbit × Data Engine requirements `MO-DE-001` through `MO-DE-005` and MarkOrbit's consumer acceptance.

## Provider evidence

- Provider repository: `yoomarks/markorbit-data-engine`
- Provider PR: `#209`
- Provider PR head: `cde643ea546a5ee7d885f94b56715c6907442df9`
- Provider squash-merge SHA: `42637eec302b1e2feeb6825e4f7b5208f4d00b9e`
- Provider CI for final PR head: `30/30 completed/success`
- MarkOrbit acceptance PR: `#176`
- MarkOrbit acceptance merge SHA: `a8035efff46a2e71a4613abd1927b18dadff086b`

Canonical provider artifacts remain in the provider repository and are referenced rather than copied:

- runtime self-description: `GET /api/v1/contract`
- machine-readable contract: `docs/integrations/markorbit/MARKORBIT_DATA_ENGINE_INTEGRATION_V1.json`
- provider contract: `docs/integrations/markorbit/provider-contract.md`
- runtime semantics: `docs/integrations/markorbit/runtime-semantics.md`
- provider ledger: `docs/integrations/markorbit/integration-status.yaml`
- formal provider response: `docs/integrations/markorbit/MO-DE-G0-RESPONSE-2026-08-23.md`
- provider regression coverage: `tests/test_mo_de_g0_contract.py`

## Accepted provider freeze

### MO-DE-001 — Query Contract V1

Accepted. Data Engine owns the canonical additive-compatible machine-readable V1 provider contract and runtime self-description. MarkOrbit validates the consumer boundary against this contract and does not copy provider storage/schema ownership.

### MO-DE-002 — Missing / coverage / tombstone semantics

Accepted. MarkOrbit preserves `unknown` unless Data Engine explicitly emits evidence-backed `not_covered`, `no_observation`, or `tombstone`. A provider `404/not_found` means the requested key is absent from the current provider read model; it does not prove provider coverage or legal/factual nonexistence. Timeout, 5xx, transport failure and runtime unavailability must never be converted into factual negatives.

### MO-DE-003 — Service authentication

Accepted. G1 uses `Authorization: Bearer <key>` with `auth=required`, environment-scoped secrets, minimum 32-character keys, overlap rotation, `401` for missing/invalid caller credentials and fail-closed provider configuration behavior.

### MO-DE-004 — Request / correlation tracing

Accepted. `x-correlation-id` is the end-to-end cross-service correlation identifier. `X-Request-ID` is the Data Engine provider hop/request identifier and current provider trace identifier. Gateway must forward/generate these according to the frozen contract and validate provider response echo metadata.

### MO-DE-005 — Runtime error / timeout / retry semantics

Accepted. Gateway behavior is driven by the provider status plus machine-readable `{ code, message, retryable }` error envelope and `Retry-After` where applicable. Schema/version mismatch fails closed. Provider/runtime failure is not converted into an empty or negative fact result.

## Joint decisions accepted

1. Preserve `unknown` until Data Engine explicitly emits an evidence-backed `not_covered`, `no_observation`, or `tombstone` state.
2. Use `x-correlation-id` end-to-end and `X-Request-ID` for the Data Engine provider hop/request and current provider trace identifier.

## G0 completion

`MO-DE-001` through `MO-DE-005` are accepted and frozen for the V1 integration. G0 is closed.

## G1 — MO-DE-006 started

The active stage is now **G1 — Protected Query Runtime**. The acceptance target is a real authenticated path:

```text
MarkOrbit Gateway
  -> Authorization: Bearer <environment-scoped service key>
  -> Data Engine runtime with INTEGRATION_AUTH_MODE=required
  -> V1 contract/fact validation
  -> correlated response/error evidence
```

G1 must cover authenticated 200, unauthenticated 401, 403 only if a provider authorization scope layer exists, not-found without coverage inference, reserved coverage states preserving unknown, 429/Retry-After, timeout, provider 5xx, schema/version fail-closed behavior, and request/correlation propagation.

Repository-local mocks/fixtures remain supporting evidence only and do not complete G1.

`MO-DE-007` and `MO-DE-008` remain deferred and are not authorized for implementation in G1.
