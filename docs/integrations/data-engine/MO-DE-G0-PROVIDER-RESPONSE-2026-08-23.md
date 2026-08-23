# Data Engine Provider Response Receipt — MO-DE G0

Status: **ACCEPTED — G0 CLOSED / G1 READY**

This file records the formal provider response from `yoomarks/markorbit-data-engine` for the shared MarkOrbit × Data Engine requirements `MO-DE-001` through `MO-DE-005` and MarkOrbit's consumer acceptance of that response.

## Acceptance evidence

- MarkOrbit acceptance PR: `#176`
- MarkOrbit acceptance merge SHA: `a8035efff46a2e71a4613abd1927b18dadff086b`
- Provider repository: `yoomarks/markorbit-data-engine`
- Provider PR: `#209`
- Provider PR head: `cde643ea546a5ee7d885f94b56715c6907442df9`
- Provider squash-merge SHA: `42637eec302b1e2feeb6825e4f7b5208f4d00b9e`
- Provider CI for final PR head: `30/30 completed/success`

Canonical provider artifacts remain in the provider repository and are referenced rather than copied:

- runtime self-description: `GET /api/v1/contract`
- machine-readable contract: `docs/integrations/markorbit/MARKORBIT_DATA_ENGINE_INTEGRATION_V1.json`
- provider contract: `docs/integrations/markorbit/provider-contract.md`
- runtime semantics: `docs/integrations/markorbit/runtime-semantics.md`
- provider ledger: `docs/integrations/markorbit/integration-status.yaml`
- formal provider response: `docs/integrations/markorbit/MO-DE-G0-RESPONSE-2026-08-23.md`
- provider regression coverage: `tests/test_mo_de_g0_contract.py`

## MO-DE-001 — FROZEN / ACCEPTED

Data Engine's additive-compatible, machine-readable V1 query contract is accepted as the provider contract. Breaking changes require explicit cross-repository migration/RFC or a new integration version. MarkOrbit consumes the provider contract without taking ownership of provider storage/schema semantics.

## MO-DE-002 — FROZEN / ACCEPTED

Provider semantics distinguish `observed`, `not_found`, `not_covered`, `no_observation`, `tombstone`, and `service_unavailable`. Current V1 explicitly proves/emits only `observed`, `not_found`, and `service_unavailable`; the other states remain reserved until Data Engine has evidence to emit them.

Accepted joint decision: MarkOrbit preserves `unknown` when Data Engine cannot explicitly prove `not_covered`, `no_observation`, or `tombstone`, and never derives factual absence from timeout, 5xx, transport failure or runtime unavailability.

## MO-DE-003 — FROZEN / ACCEPTED

The provider authentication mechanism is `Authorization: Bearer <key>` with minimum 32-character service keys, multi-key overlap rotation, `disabled|required` modes, `401` for missing/invalid caller credentials and `503` for invalid required-mode provider configuration. G1 target is `auth=required`; secrets remain environment-local and are not committed.

## MO-DE-004 — FROZEN / ACCEPTED

Accepted joint decision: `x-correlation-id` is the end-to-end cross-service correlation identifier; `X-Request-ID` is the Data Engine provider hop/request identifier and current provider trace identifier. Gateway propagation and logging must preserve this relationship.

## MO-DE-005 — FROZEN / ACCEPTED

The stable `/api/v1` error envelope, validation as `400`, retryable `429` with `Retry-After`, and retryable runtime/network/5xx semantics are accepted. Gateway retry/degradation must use machine-readable contract metadata/status and must not convert runtime failure into factual negatives.

## MO-DE-006 — G1 READY

G0 is closed. `MO-DE-006` is authorized to begin as the joint G1 Protected Query Runtime acceptance work.

Required G1 evidence:

1. expose a non-production Data Engine runtime with `INTEGRATION_AUTH_MODE=required` and isolated acceptance credentials;
2. configure MarkOrbit Gateway to call that runtime using the frozen Bearer contract;
3. validate the provider machine-readable contract/schema in the consumer lane;
4. run the real path `MarkOrbit Gateway -> Data Engine runtime -> validated response`;
5. cover at minimum 200 success, 401, applicable 403 semantics, not-found, supported coverage/no-observation semantics, 429/Retry-After, timeout, provider 5xx, schema/version fail-closed behavior, and request/correlation propagation;
6. record evidence in both repository ledgers before declaring G1 complete.

Repository-local mocks/fixtures remain supporting evidence only and do not complete G1.

## Deferred scope

`MO-DE-007` and `MO-DE-008` remain deferred. G0 closeout and G1 authorization do not authorize G2 change-feed/cursor implementation or production deployment.
