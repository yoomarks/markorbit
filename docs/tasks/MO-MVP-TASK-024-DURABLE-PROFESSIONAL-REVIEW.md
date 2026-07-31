# TASK 024 — Durable Professional Review vertical slice

Execution remains the canonical owner of Professional Review Cases, bounded checklist evidence, and immutable Review Decisions. MarkReg owns the source Formal Matter; neither Execution nor Gateway reads MarkReg tables. Core supplies the trusted Workspace Principal.

Migration `0023_execution_professional_reviews` adds owner-scoped `professional_review_cases`, `professional_review_commands`, and append-only `professional_review_audit`. A case binds one Workspace and Formal Matter to its exact source version and SHA-256. The unique Workspace/Formal Matter constraint prevents silent duplicate active cases.

Review Case version starts at 1. Claim and draft changes use compare-and-swap semantics and increment it. A stale exact version is `STALE_PROFESSIONAL_REVIEW` (409), so two writers have one winner. Completion freezes the checklist, rationale, source lineage, actor and timestamp; an identical retry returns the existing decision while conflicting input cannot rewrite it.

Core roles retain their frozen permissions: Workspace Admin, Matter Manager and Reviewer have `review:read` and `review:perform`; Read Only has `review:read`. The Gateway resolves the opaque cookie Session and Workspace Principal, requires CSRF/trusted origin for mutation, and forwards only the signed internal Principal envelope, Workspace and correlation ID. Execution storage predicates include Workspace scope.

Completion is **reviewed and ready for the next governed step**. Its consequences remain false for Order, Payment, Formal Matter creation, provider appointment, filing and customer messaging. It does not create a Document Package, Instruction Ledger, Preparation Lock, Filing Authorization, Execution Release, or filing task.
