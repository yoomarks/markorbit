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

## Implemented result

The delivered slice uses real loopback HTTP calls between independently started runtimes:

```text
POST Gateway /v1/markreg/intakes
→ POST MarkReg /v1/intakes
→ POST Capability Engine /v1/capability-requests
→ POST Execution /v1/executions
→ MarkReg fixture recommendation
→ unified Gateway response
```

The shared runtime now supports bounded JSON request bodies, fixed JSON POST routes, unified JSON
responses, safe 400/404/405/500 errors, dynamic or fixed listening ports, and idempotent
`start()` / `stop()` while preserving `GET /health`.

## Contracts and APIs

Runtime-validated transport contracts cover `IntakeCreateCommand`, `Intake`,
`CapabilityRequest`, `ExecutionRecord`, `RecommendationPackage`, the unified response, actors,
controlled channels and relationship models, and safe errors. The intake endpoint currently accepts
only `MARKREG_DIRECT` + `DIRECT`; other governed combinations receive
`422 UNSUPPORTED_CHANNEL_RELATIONSHIP`.

The fixture recommendation contains deterministic A/B/C tiers named Essential Protection,
Recommended Protection, and Extended Protection. It is explicitly `FIXTURE_ONLY`, states that it
is not legal advice, and makes no filing, authority, acceptance, or official-state claim.

## Ownership and idempotency

Each service receives its own constructor-injected in-memory repository. MarkReg stores only Intake
and Recommendation state, Capability Engine stores only Capability Requests, and Execution stores
only Execution Records. There are no shared Maps or cross-service implementation imports in service
code.

Every POST command requires an `Idempotency-Key` header matching its command. A payload fingerprint
is retained with the owned result: the same key and payload returns the original object graph without
duplicates, while a changed payload returns `409 IDEMPOTENCY_CONFLICT`.

## Events

The injected in-memory publisher uses `EventEnvelope` and emits:

- `markreg.intake.created.v1`;
- `capability.request.accepted.v1`;
- `execution.recorded.v1`;
- `markreg.recommendation.ready.v1`.

Publisher failures propagate to the request and are never silently ignored. Production NATS is not
part of this slice.

## Test coverage

Contract tests cover valid and incomplete requests, empty fields, invalid ISO country codes,
unsupported channel/relationship combinations, and the fixture-only marker. Service and integration
tests retain health coverage and exercise the complete chain over dynamically assigned listening
ports, including A/B/C output, trace correlation, duplicate requests, conflicts, both downstream
outages, non-ready failed Intakes, repository isolation, and listener shutdown.

## Known limitations and non-goals

- Repositories and events are process-local and are lost on restart; they are not production
  persistence or production messaging.
- Recommendation content is a deterministic workflow fixture, not AI output, legal analysis, a
  clearance search, professional advice, or an official application conclusion.
- Authentication, UI, payment, quoting, database migrations, real filing, provider workflows,
  Capability verification, canon mutation, and formal-state mutation remain out of scope.
- A next task should introduce durable service-owned persistence and an outbox-backed event transport
  without changing the contracts or ownership boundaries established here.
