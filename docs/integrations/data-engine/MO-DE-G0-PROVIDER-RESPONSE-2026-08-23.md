# Data Engine Provider Response Receipt — MO-DE G0

Status: **RECEIVED — CONSUMER REVIEW PENDING**

This file records the formal provider response from `yoomarks/markorbit-data-engine` for the shared MarkOrbit × Data Engine requirements `MO-DE-001` through `MO-DE-005`.

## Provider evidence

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

## MO-DE-001 — Provider resolution received

Data Engine froze the V1 query contract as an additive-compatible, machine-readable provider contract. The provider runtime descriptor now self-describes the stable resources and exact query bounds/pagination semantics. Breaking changes require an explicit cross-repository migration/RFC or a new integration version.

Consumer review required: validate MarkOrbit Gateway/contracts against the canonical provider contract without copying provider storage/schema ownership into MarkOrbit.

## MO-DE-002 — Provider resolution received

Provider semantics distinguish `observed`, `not_found`, `not_covered`, `no_observation`, `tombstone`, and `service_unavailable`. Current V1 explicitly proves/emits only `observed`, `not_found`, and `service_unavailable`; the other factual-negative/coverage states remain reserved until Data Engine has evidence to emit them.

Cross-repo decision requested: MarkOrbit should preserve `unknown` when Data Engine cannot explicitly prove `not_covered`, `no_observation`, or `tombstone`, and must never derive factual absence from timeout, 5xx, transport failure or runtime unavailability.

## MO-DE-003 — Provider resolution received

The frozen provider authentication mechanism is `Authorization: Bearer <key>` with minimum 32-character service keys, multi-key overlap rotation, `disabled|required` modes, `401` for missing/invalid caller credentials and `503` for invalid required-mode provider configuration. G1 target remains `auth=required`; secrets stay environment-local and are not committed.

Consumer review required: MarkOrbit Gateway must inject the environment-specific Bearer credential and treat provider auth failures according to the frozen contract.

## MO-DE-004 — Provider resolution received

Data Engine froze `x-correlation-id` as the end-to-end cross-service correlation identifier and `X-Request-ID` as the provider hop/request identifier and current provider trace identifier. Valid caller correlation/request identifiers are preserved according to the provider contract and integration responses echo the required identifiers.

Cross-repo decision requested: MarkOrbit should accept and implement this exact relationship in Gateway propagation/logging.

## MO-DE-005 — Provider resolution received

Data Engine froze a stable `/api/v1` error envelope with machine-readable error code/message/retryability, validation as `400`, retryable `429` with `Retry-After`, and retryable runtime/network/5xx semantics that must never be converted into factual negatives. Provider backpressure is opt-in and remains disabled by default outside an explicit acceptance/runtime profile.

Consumer review required: Gateway retry/degradation must be driven by contract metadata/status, not log-text/string matching or empty-data substitution.

## MO-DE-006 — G1 implementation / acceptance plan

`MO-DE-006` remains blocked until MarkOrbit explicitly accepts the G0 provider freeze above. After acceptance:

1. expose a non-production Data Engine runtime with `INTEGRATION_AUTH_MODE=required` and isolated acceptance credentials;
2. configure MarkOrbit Gateway to call that runtime using the frozen Bearer contract;
3. validate the provider machine-readable contract/schema in the consumer lane;
4. run a real authenticated cross-repository acceptance path: `MarkOrbit Gateway -> Data Engine runtime -> validated response`;
5. cover at minimum 200 success, 401, applicable 403 semantics, not-found, supported coverage/no-observation semantics, 429/Retry-After, timeout, provider 5xx, schema/version fail-closed behavior, and request/correlation propagation;
6. record evidence in both repository ledgers before declaring G1 complete.

Repository-local mocks/fixtures remain supporting evidence only and do not complete G1.

## Compatibility / decision requests

No provider incompatibility requires a breaking contract change at G0. Two joint consumer decisions remain explicit rather than silently inferred:

1. preserve `unknown` until Data Engine explicitly emits an evidence-backed `not_covered`, `no_observation`, or `tombstone` state;
2. accept `x-correlation-id` as end-to-end correlation and `X-Request-ID` as Data Engine provider hop/request plus current provider trace identifier.

## Next MarkOrbit action

Review and either accept or reject the two joint decisions and the provider-frozen `MO-DE-001..005` contract. Only after consumer acceptance should the MarkOrbit ledger close G0 and unblock `MO-DE-006` G1 implementation/acceptance work.
