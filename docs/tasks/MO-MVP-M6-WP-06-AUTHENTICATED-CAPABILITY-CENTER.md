# M6-WP-06 — Authenticated Gateway and Lite Capability Center

- **Milestone:** `MO-MVP-MILESTONE-006`
- **Base:** `facdb82ad63e7f51df19cd373bead7efdd44adab` (merged M6-WP-05)
- **Scope:** authenticated browser/API exposure only; Capability Engine remains semantic owner

## Runtime path

```text
Core Session + Workspace Principal
-> Gateway read/mutation transport policy
-> trusted internal Capability Engine request
-> private subject Capability Center read model
-> Lite Capability Center
-> exact Reflection Candidate disposition
-> deterministic private Profile/Twin rebuild
```

## Delivered boundary

- Capability Engine assembles the private subject read model from owner persistence: Ledger, current Profiles, Twin and outstanding exact Reflection Candidates.
- Gateway resolves the Core Workspace Principal, requires `workspace:read` for reads, and requires a mutation-capable existing role permission (`matter:manage`, `review:perform`, or `workspace:manage`) for subject disposition.
- Browser mutations require trusted Origin, CSRF and Idempotency-Key.
- Request-body Workspace/subject/role/permission spoofing is rejected before any downstream call.
- Gateway forwards only the exact disposition payload and trusted internal Principal envelope.
- Lite opens Capability Center directly via `#capability`, reloads durable state, displays governed evidence provenance, and allows `ACCEPTED`, `REJECTED`, or `DEFERRED` on one exact candidate version/fingerprint.
- Desktop and 390px mobile real-runtime acceptance uses HTTP services with no Playwright route interception or fulfillment.

## UI state matrix

Permanent Storybook/runtime states cover:

- loading;
- empty;
- partial;
- ready;
- stale/conflicting candidate;
- permission denied;
- recoverable downstream error.

## Permanent authority locks

The Capability Center must never present private learning state as:

- verified professional Capability;
- certification, license, badge, score or ranking;
- Capability Canon truth;
- public profile;
- Core role/permission truth;
- Provider Supply Capability conversion;
- raw Provider Return conversion;
- Payment/Invoice;
- legal appointment;
- Filing Submission or Official Truth;
- autonomous Twin identity/execution authority;
- protected external action.

`ACCEPTED private reflection != verified Capability != Capability Canon truth`.

## Non-goals

No M6-WP-07 reliability matrix, no M6-WP-08 audit, no public Capability marketplace/profile, no AI disposition authority and no external execution.

## Next

After explicit Owner merge only: `M6-WP-07 — Reliability, privacy and replay matrix`.
