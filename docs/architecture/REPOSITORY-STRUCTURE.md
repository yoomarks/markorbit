# Repository Structure

The monorepo keeps build and contract coordination fast while preserving independent service boundaries.

## Extraction readiness

A service is ready to move to another repository when it has:

- its own package and runtime entrypoint;
- its own API contract;
- its own database schema and migrations;
- no direct imports from another service implementation;
- contract fixtures and consumer tests;
- isolated Docker image configuration;
- explicit event publication and consumption list.

## Shared packages

Shared packages must stay small. They may contain transport contracts, runtime primitives and design primitives. They must not become a hidden monolith containing Product or service-domain behavior.
