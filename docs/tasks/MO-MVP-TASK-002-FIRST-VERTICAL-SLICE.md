# MO-MVP-TASK-002 — First Vertical Slice Contracts and Service Runtime

## Objective

Deliver the first real cross-service path:

```text
markreg.com fixture client
→ Gateway
→ MarkReg creates Intake
→ Capability Engine accepts Capability Request
→ Execution records an Execution
→ MarkReg returns a fixture Recommendation
```

## Allowed directories

- `apps/gateway/**`
- `services/markreg/**`
- `services/capability-engine/**`
- `services/execution/**`
- `packages/contracts/**`
- `packages/events/**`
- `packages/test-kit/**`

## Required contracts

- ActorContext;
- Channel and RelationshipModel;
- IntakeRef;
- CapabilityRequest;
- ExecutionRef;
- RecommendationPackage;
- EventEnvelope;
- ErrorResponse.

## Required behavior

- all commands accept an idempotency key;
- MarkReg owns Intake and Recommendation state;
- Capability Engine owns Capability Request state;
- Execution owns execution state;
- no service reads another service database;
- fixture recommendation is explicitly marked `FIXTURE_ONLY`;
- response includes correlation and provenance references.

## Tests

- unit tests for validation and state creation;
- contract fixture tests;
- integration test for the full path;
- duplicate idempotency request does not create duplicate state;
- unavailable downstream service returns a safe partial failure.

## Non-goals

- AI model invocation;
- authentication UI;
- jurisdiction recommendation logic;
- payment or official filing;
- production database migrations.

## Validation

```bash
pnpm check
```

## Expected PR title

`MO MVP — first intake to recommendation service slice`
