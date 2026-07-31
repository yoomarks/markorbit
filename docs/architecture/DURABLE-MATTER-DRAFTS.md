# Durable Matter Draft preparation

TASK 021 makes the existing Matter Draft the single canonical preparation model. The user is a provisioned Workspace member whose job is to resume, edit and evaluate preparation without creating a Formal Matter or any external action.

MarkReg owns `matter_drafts`. Every repository operation requires `workspace_id`; the schema deliberately has no foreign key to Core-owned Workspace tables. A Draft retains the exact durable Customer Confirmation identity and optimistic version plus its accepted Quote identity/version. Creation reads that persisted Confirmation rather than rebuilding it from current Quote state. A withdrawn source cannot create a Draft; later withdrawal is surfaced by the `CUSTOMER_CONFIRMATION_VALID` readiness check and does not rewrite or delete preparation.

The durable fields are Draft identity, Workspace, Customer Confirmation identity/version, Quote identity/version, editable preparation, instruction/document readiness, readiness checks and missing items, status, optimistic version, and timestamps. Version starts at 1 and successful writes atomically increment it. There is no hard-delete operation.

Gateway resolves the opaque Session and Workspace Principal through Core, enforces Origin and CSRF on mutations, then signs the existing internal boundary. MarkReg independently validates that boundary and permission. Workspace Administrators and Matter Managers can read/create/edit/evaluate; Reviewers can read/evaluate; Read Only can only read.

The existing MarkReg preparation workspace remains the information architecture: Quote and Customer Confirmation context lead into editable preparation, saved/version feedback, and explicit readiness findings. Desktop uses the existing two-dimensional workspace; mobile reflows to one column. Loading, forbidden, missing, unavailable, withdrawn, stale-write and success are explicit states. Controls remain labelled and readiness findings are semantic lists for assistive technology.

Non-goals include Formal Matter, Order, Payment, Invoice, professional-review or document persistence, filing, idempotency tables, outbox, audit log, and RLS.
