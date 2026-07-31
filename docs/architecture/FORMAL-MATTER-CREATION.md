# Formal Matter creation

MarkReg is the canonical owner of the durable Formal Matter. `CreateFormalMatter` accepts only Workspace, Customer Confirmation and Matter Draft identities, their exact expected versions, and an idempotency key; the trusted Principal remains transport context.

Creation requires a still-confirmed Customer Confirmation and an exact-version `READY_FOR_PROFESSIONAL_REVIEW` Matter Draft whose blocking checks all pass and whose Quote lineage agrees. **Professional Review is not a prerequisite.** Workspace Admin and Matter Manager may create; Reviewer and Read Only may only read.

The bounded schema-version 1 snapshot contains confirmation identity/version/status, Quote identity/version/currency/total, Draft identity/version/status/readiness, and preparation fields. Deterministic canonical JSON is SHA-256 hashed server-side. The transaction contains the `OPEN`, version 1 Matter, immutable snapshot/hash, idempotency result, and `FORMAL_MATTER_CREATED` audit. An exact Draft version is single-use. Same key/request replays; conflicting key reuse and a different key for that used source conflict.

No Professional Review, Order, Payment, provider assignment, Filing, outbox, or external action is created.
