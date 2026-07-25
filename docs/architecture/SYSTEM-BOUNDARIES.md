# System Boundaries

```text
MarkOrbit Lite ─┐
                ├─ Gateway ─┬─ Core
markreg.com ────┘           ├─ Knowledge
                            ├─ Capability Engine
                            ├─ Execution
                            ├─ MarkReg
                            └─ MGSN
```

## Service rules

- Each service is an independent deployable unit.
- Each service owns its persistence boundary.
- Cross-service reads use APIs or events, never direct database access.
- `packages/contracts` defines transport shape, not business ownership.
- The Gateway authenticates and aggregates; it does not become a business domain.
- Product applications own presentation and product-specific workflows, not canonical service state.

## Formal-state boundary

Official state remains external. A Provider Return or uploaded document may support validation, but cannot silently become Official Truth or mutate formal state.
