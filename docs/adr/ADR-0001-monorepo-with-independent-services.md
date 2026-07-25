# ADR-0001 — Monorepo with independent services

## Status

Accepted for MVP Beta.

## Decision

Use one monorepo for shared contracts, UI primitives, CI and integration speed. Core, Knowledge, Capability Engine, Execution, MarkReg and MGSN remain independent deployable services with explicit data ownership and API/event boundaries.

## Consequences

- faster four-week parallel development;
- fewer contract-version mismatches;
- easier end-to-end testing;
- services must not import one another's implementation code;
- extraction readiness remains an acceptance requirement.
