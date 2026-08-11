# Data Engine Integration Boundary

- **Task:** `DEI-WP-01`
- **Provider contract:** `MARKORBIT_DATA_ENGINE_INTEGRATION_V1`
- **Data Engine provider baseline:** `yoomarks/markorbit-data-engine` PR #69 / `36ba75318bb49f399290828b0f04ef6862b6dd71`
- **Runtime mutation:** none

## Purpose

MarkOrbit consumes trademark source facts from the independent MarkOrbit Data Engine without turning Core into a database proxy or sharing Data Engine storage.

Canonical boundary:

```text
Lite / MarkReg / other Product need
        -> Gateway or proper Owning Service
        -> @markorbit/contracts/data-engine
        -> Data Engine /api/v1
        -> Data Engine-owned storage
```

Core remains the shared semantic, identity-reference and permission boundary. It does not read Data Engine PostgreSQL, ClickHouse, database volumes, or database files.

## Frozen decisions

1. **API before storage.** Consumer code uses the versioned Data Engine HTTP contract. No cross-service SQL or direct database/file access is permitted.
2. **Source facts are not business state.** Data Engine facts may be referenced by Core, Lite, MarkReg or another Owning Service, but they are not copied into Core as a second canonical trademark database by default.
3. **No source-fact writeback.** User annotations, client/entity mappings, portfolio membership, legal analysis, recommendations, Opportunities, Matters, tasks and other Product/business state remain owner-local.
4. **Gateway is not forced to proxy every fact.** A Product/Gateway or proper Owning Service may consume Data Engine where its journey requires it. Core is not a mandatory hop for every trademark query.
5. **Fail closed on contract drift.** The consumer parser requires the exact V1 owner, authority and `legal_conclusion: false` lock. Mismatched provider responses are rejected rather than silently accepted.
6. **Admin is not business integration.** `/api/admin` and `/api/jobs` remain outside the consumer contract. Normal Product behavior must not trigger ingestion, replay, retry, reset or repair.

## Shared contract

`packages/contracts/src/data-engine.ts` owns the MarkOrbit-side wire types and runtime parsers. Consumer code must import these contracts rather than reproduce Data Engine response types locally.

The source-fact envelope retains:

- provider contract version;
- Data Engine owner identity;
- Data Engine runtime version;
- jurisdiction;
- resource kind;
- fact read-model authority;
- explicit `legal_conclusion: false`;
- domain-native payload.

Domain-native payloads remain governed by their provider semantics. In particular:

- application data does not become a MarkOrbit legal-status conclusion;
- Assignment recorded facts do not become a legal-title conclusion;
- TTAB procedural facts do not become a substantive-rights or outcome conclusion.

## Gateway client

`apps/gateway/src/data-engine-http.ts` is a bounded read-only client. Its operations are hard-wired to V1 `GET` resources and validate the owner envelope before returning data.

It does not contain:

- PostgreSQL or ClickHouse credentials;
- filesystem paths;
- SQL;
- write methods;
- admin/control methods;
- automatic Product or formal-state mutation.

A downstream outage returns a Data Engine availability error. It does not fall back to direct database access.

## Change feed

The V1 US change feed is consumed as observation evidence. A Data Engine change does not itself create or mutate:

- Core identity truth;
- Today Recommendation;
- Opportunity;
- Intake;
- Order;
- Matter;
- task/reminder;
- Filing Submission;
- Official Truth.

A later Product/Owning-Service work package may consume the feed and make an explicitly governed decision using stable Data Engine provenance.

## Authentication and deployment

This work package freezes transport semantics, not production network security. Production service authentication, network placement and secret management must be added at deployment/integration time without weakening the contract boundary.

## Non-goals

This work package does not:

- add a user-facing Gateway route;
- make Core proxy Data Engine;
- add Core persistence for trademark source facts;
- add event-bus publication;
- write back to Data Engine;
- change Data Engine ingestion or databases;
- move Docker storage;
- authorize any external action.
