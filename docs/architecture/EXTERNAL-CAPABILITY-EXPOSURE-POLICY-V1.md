# External Capability Exposure Policy V1

- **Status:** additive metadata foundation
- **Scope:** future external-agent discovery and eligibility metadata
- **Authority:** exposure metadata grants no permission and starts no execution.

## Boundary

An external exposure policy references one exact Capability ID/version and the existing Identity/Workspace, permission, entitlement, Governance, Execution and Evidence owners. It is neither a public API nor an authorization system.

`READ`, `PREPARE` and `EXECUTE` are presentation mappings:

- `READ` maps to an owner-authorized read and current subject scope.
- `PREPARE` maps to a non-authoritative draft or preparation. Preparation is not truth, approval, acceptance or execution.
- `EXECUTE` maps only to an existing `PROTECTED` action policy and exact Execution contract. The caller must still complete every current authorization and release check owned by those systems.

No operation broadens the underlying Capability risk envelope or Implementation Profile caller allow-list.

## Exposure states

- `NOT_EXPOSED` is the default and has no operations.
- `DISCOVERABLE` may describe a bounded `READ` operation only; discovery is not invocation eligibility.
- `AVAILABLE` declares one or more mappings but still requires current workspace, principal, permission and entitlement context at each request.

Unknown states and fields fail closed. Revocation or retirement is represented by a new exact policy version or `NOT_EXPOSED`; historical audit evidence remains intact.

## Required references

Every policy carries exact owner/id/version references for discovery, authentication, audit and rate policy. Each operation carries an exact permission requirement and evidence requirements. `EXECUTE` additionally requires exact protected-action and Execution references.

These are references, not copied owner decisions. Current authority must be evaluated by the owner when a future transport requests access.

## Explicit exclusions

V1 defines no MCP server, SDK, endpoint, token format, public REST mutation, provider routing, external billing, marketplace, plugin installation or runtime. Those fields are absent from the executable contract and therefore rejected by its strict parser.
