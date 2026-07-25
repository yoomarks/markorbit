# Contract-first Development

Every vertical slice follows:

```text
User Journey
→ State and Authority Analysis
→ Contract Fixture
→ Provider Contract
→ Consumer Mock
→ Service Implementation
→ UI Integration
→ Contract and E2E Validation
```

## Compatibility

- Additive fields are optional until all consumers migrate.
- Enum expansion requires consumers to handle unknown values safely.
- Removal or semantic reuse requires an ADR.
- Event consumers must be idempotent.
- Commands require an idempotency key where duplicate execution creates risk.

## Contract location

- transport types: `packages/contracts`;
- service-owned OpenAPI: the owning service;
- event envelope: `packages/contracts`;
- generated clients: generated into the consuming app and not edited manually.
