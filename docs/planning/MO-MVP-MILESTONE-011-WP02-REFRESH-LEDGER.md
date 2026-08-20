# M11 WP02 — Portfolio Change Detection & Refresh Ledger

WP02 makes Trademark Asset management longitudinal without promoting Lite into an official source owner.

## What is persisted

Lite records immutable refresh runs, exact source references observed during each run, and deterministic change metadata between comparable scoped runs.

A refresh declares `sourceOwnerScope`. Removal detection is limited to that scope. A Data Engine-only refresh therefore cannot imply that a MarkReg or Knowledge observation disappeared.

## Change semantics

- `OBSERVATION_ADDED`: the comparable previous scoped refresh had no observation for the exact owner/kind/sourceId key.
- `OBSERVATION_REMOVED`: the comparable previous scoped refresh contained the key and the current scoped refresh does not.
- `OBSERVATION_CHANGED`: source version or source fingerprint changed.
- `FRESHNESS_CHANGED`: substantive source identity/version is unchanged but freshness changed.

A changed polling timestamp by itself is not a substantive change.

## Permanent authority boundary

The ledger does not verify official status, certify a legal deadline, resolve a source conflict, form a legal conclusion, or authorize filing/contact/payment/publication/execution. It stores source-owned references and Product-owned change metadata only.

## Reliability contract

Refresh writes are workspace-scoped, transactionally durable, idempotent by request fingerprint, restart-readable, and protected by a per-Asset advisory transaction lock. The durable history becomes the input to later M11 signal and recommendation work packages.
