# Durable Professional Review

## Boundary

`PostgreSQL → Core Session / Workspace Principal → Execution → Gateway → Mo Lite` is the production path. Execution is the canonical Review owner. It stores a bounded immutable copy of source evidence, not a copy of the mutable Formal Matter aggregate, and uses no cross-database foreign key.

## Lifecycle and evidence

The existing canonical lifecycle remains `QUEUED → IN_REVIEW → REVIEWED_READY_FOR_NEXT_STEP`, with the existing governed exception states. Durable fields are Workspace, Formal Matter identity/version/hash, Review Case version, checklist/findings, rationale and decision, actors, timestamps, and the immutable source snapshot. Browser/session/credential data and arbitrary provider returns are excluded.

## Concurrency and authority

Every mutation supplies the exact Review Case version. SQL updates include `workspace_id`, identity, expected version, and `completed_at IS NULL`; therefore only one concurrent writer succeeds. Completion evidence is immutable, and repeat input resolves to the same result. Completion states readiness only and grants no filing approval, authorization, release, or execution authority.

The durable Execution listener constructs a Workspace-scoped PostgreSQL repository only after validating the Gateway's internal credential and signed Core Principal. It derives the actor from that Principal rather than browser input. Formal Matter validation uses MarkReg's authenticated HTTP contract; source failure is a 503-class dependency failure and Execution never reads MarkReg persistence. A restarted listener constructs new repository objects against the same Execution database and reloads the completed Review unchanged.
