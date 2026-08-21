# M14 — Operational Trademark Execution Workbench

## Scope lock

M14 operationalizes the M13 controlled trademark-service execution bridge as a durable, authenticated professional workflow. It does not broaden authority: M13 owner-domain and Official Truth locks remain permanent.

The milestone loop is:

`M12 Work Package -> M12 Execution Readiness -> explicit user authorization -> durable execution plan -> protected-action review -> owner-domain handoff -> evidence / receipt -> lifecycle handoff -> recovery / next human action`

M14 exists because M13 froze and tested the execution semantics, while professional use still requires durable state, authenticated HTTP boundaries, workspace isolation, replay-safe mutations, and a workbench surface.

## Work packages

### WP01 — Durable execution session
Persist authorization, plan, release, handoff, evidence, recovery, and audit references in the Execution owner domain. No Lite-owned execution persistence and no cross-service SQL.

### WP02 — Authenticated authorization API
Expose explicit authorization through Gateway -> Execution. Actor identity comes from the authenticated principal, never request-body spoofing. Require CSRF/idempotency on mutations.

### WP03 — Durable protected-action gate
Replace process-local replay state for operational requests with durable idempotency/fingerprint state. Stale Work Package versions, expired authorization, missing evidence, wrong Workspace, and conflicting replay fail closed.

### WP04 — Owner-domain handoff adapters
Create explicit request boundaries for MGSN/provider and MarkReg lifecycle handoff. A request does not manufacture provider acceptance, filing success, official acceptance, or lifecycle truth.

### WP05 — Evidence and receipt ledger
Persist execution attempt evidence separately from provider claims and owner-verified official evidence. `attempted != submitted`; `provider claim != Official Truth`.

### WP06 — Recovery and manual review queue
Persist retry classification and next required human action. Never silently repeat an external consequence and never auto-promote a failed/ambiguous action to success.

### WP07 — Professional execution workbench UX
Expose authorization, plan, gate state, handoffs, evidence, recovery, and next human action in the professional workbench. Destructive/protected actions require explicit review and confirmation.

### WP08 — End-to-end authority and reliability audit
Exercise authentication, workspace isolation, actor-spoof rejection, stale-version rejection, idempotency replay/conflict, owner handoff boundaries, evidence separation, and recovery. Exact-head CI must be green before merge.

## Permanent authority locks

- M12 readiness is not execution authorization.
- Authorization is not filing/submission/payment/provider acceptance.
- Execution plan is not execution.
- Protected-action release is not proof of external success.
- Provider handoff is not provider engagement or acceptance.
- Provider return is not Official Truth.
- Evidence is not official acceptance without owner-domain verification.
- Execution does not directly mutate MarkReg Matter lifecycle truth.
- Lite does not own or persist protected-action authority.
- Payment owns payment truth; MGSN owns provider truth; MarkReg owns Matter lifecycle truth.
- AI/product feedback cannot grant authorization or promote evidence into owner truth.
- Protected-action idempotency cannot be bypassed.
- No cross-service SQL.
- Merge is not production deployment or GA.

## Completion definition

M14 is complete when the M13 semantics are available through durable Execution-owned persistence, authenticated Gateway/Execution APIs, a professional workbench surface, and independent reliability/authority tests. Completion does not authorize production credentials, live filing, live payment, live provider contact, production migration, deployment, or GA.