# MO Control Center

`apps/operations-console` is the internal MarkOrbit control-plane product surface.

The Control Center follows one permanent rule:

> **One operator UI, distributed owner truth.**

It may compose governed owner reads and already-authorized owner commands, but it does not become a super-admin database or a new authority owner.

## Current live surfaces

- Evidence Review — exact reviewed-source capture, human decision, bounded admission and lifecycle projection.
- Lifecycle Provenance — exact reviewed-source, correction and delivery history for one Formal Matter.
- Commercial Admin — authenticated Internal Operator inspection for Accounts/Workspaces, Catalogue, Orders, Payments, Matters and Providers through existing owner-routed Gateway APIs.

## Truthfulness

The Control Center must not display static demo numbers or infer health from missing sources.

If there is no authoritative aggregate source for service health, failure counts, cognitive readiness or processing totals, the UI must say that the state is unavailable/unknown rather than rendering a green status or invented count.

## Authority boundary

- browser identity reuses Core / #247 admin-session authority;
- `commercial-admin:read` is commercial inspection authority only;
- owner services remain authoritative for Core, MarkReg, Payment, MGSN, Execution, Brain and Capability state;
- no cross-service SQL;
- no browser service secrets;
- no arbitrary JSON/status editor;
- no automatic Brain promotion/activation or Capability admission;
- reviewed/provider/AI evidence is not Official Truth.

Future Brain/Capability pages must begin with bounded read-only owner projections before any governed mutation surface is introduced.
