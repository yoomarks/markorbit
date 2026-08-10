# MVP Task Index

## Foundation

- MO-MVP-TASK-001 — Repository Constitution and Monorepo Bootstrap
- MO-MVP-TASK-002 — First Vertical Slice Contracts and Service Runtime
- MO-MVP-TASK-003 — UI Foundation and Product UI Briefs (implemented)
- MO-MVP-TASK-004 — markreg.com Guided Intake and Recommendation UI (implemented)
- MO-MVP-TASK-005 — Authentication, Workspace and Channel Context

## Capability and Execution

- MO-MVP-TASK-010 — Capability Registry and Version Contract
- MO-MVP-TASK-011 — Composition and Capability Budget
- MO-MVP-TASK-012 — Context Compiler
- MO-MVP-TASK-013 — Invocation and Session Receipt
- MO-MVP-TASK-020 — Execution Plan and Work Package
- MO-MVP-TASK-021 — Review, Approval and Correction
- MO-MVP-TASK-022 — Evidence and External Action Guard

## MarkReg and MGSN

- MO-MVP-TASK-030 — Dual-channel Intake
- MO-MVP-TASK-031 — Jurisdiction Recommendation
- MO-MVP-TASK-032 — Class and Goods Recommendation
- MO-MVP-TASK-033 — Document Requirements and Quote
- MO-MVP-TASK-034 — Recommendation to Order and Matter
- MO-MVP-TASK-040 — Provider Registry and Supply Capability
- MO-MVP-TASK-041 — Service Package and Eligibility
- MO-MVP-TASK-042 — Allocation and Acceptance
- MO-MVP-TASK-043 — Provider Return and Evidence Handoff

## Lite

- MO-MVP-TASK-050 — Lite Shell and Today
- MO-MVP-TASK-051 — Content Studio
- MO-MVP-TASK-052 — Opportunity Center
- MO-MVP-TASK-053 — Trademark Assets
- MO-MVP-TASK-054 — Capability Tree and Profile
- MO-MVP-TASK-055 — AI Guide
- MO-MVP-TASK-056 — Work and Matter UI

## markreg.com

- MO-MVP-TASK-070 — Public Site and Anonymous Consultation
- MO-MVP-TASK-071 — Account and Draft Recovery
- MO-MVP-TASK-072 — Guided Intake
- MO-MVP-TASK-073 — Recommendation and Plan Selection
- MO-MVP-TASK-074 — Quote and Order Confirmation
- MO-MVP-TASK-075 — Customer Portal and Actions
- MO-MVP-TASK-076 — Matter Timeline, Documents and Messages
- MO-MVP-TASK-077 — Lifecycle and Recommended Actions

## Milestone 1 audits

- TASK 015 — Milestone 1 final freeze audit (**completed**)
  - Audit result: **PASS**
  - Freeze recommendation: **FREEZE**
  - Milestone frozen: **false pending explicit owner approval**
  - Evidence: `docs/audits/MO-MVP-MILESTONE-001-FREEZE-AUDIT.md`

## Milestone 2 planning

- TASK 016 — Milestone 2 scope and architecture lock (**approved and merged in PR #24**)
  - Approved direction: Durable Authenticated Matter Operations
  - Status: `APPROVED_FOR_IMPLEMENTATION`; decisions are not yet implemented
  - Scope: `docs/planning/MO-MVP-MILESTONE-002-SCOPE-LOCK.md`
  - Delivery graph: TASK 017–027 in `docs/planning/MO-MVP-MILESTONE-002-DELIVERY-PLAN.md`
  - Machine-readable plan: `docs/planning/MO-MVP-MILESTONE-002-PLAN.json`
- TASK 017 — Persistence foundation and repository contracts (**completed; Draft PR pending**)
  - PostgreSQL 16, node-postgres, repository-local SQL-first migrations
  - Database-per-owning-service local/CI isolation
  - TASK 018 implemented on its dedicated Draft PR: Core-owned User, Workspace, Membership, role/permission contracts and persistence
- TASK 019 — Authenticated runtime, Sessions and Gateway Principal (**merged in `5d71e60`**)
  - Core-owned opaque Sessions; Gateway cookie, CSRF, CORS and Principal resolution boundaries
- TASK 020 — Durable authenticated Customer Confirmation (**implementation in Draft PR**)
  - MarkReg-owned durable acceptance evidence
- TASK 021 — MarkReg durable preparation vertical slice (**implementation in Draft PR**)
- TASK 022 — Formal Matter creation vertical slice (**implementation in Draft PR**)
  - MarkReg-owned Matter Draft persistence, authenticated existing routes, optimistic concurrency and durable readiness
- TASK 023 — Mo Lite durable Matter workspace (**implemented in Draft PR**)
  - Authenticated PostgreSQL-backed list/detail, URL recovery, Workspace isolation, and bounded Lite projection
- TASK 024 — Durable Professional Review vertical slice (**implemented in Draft PR**)
  - Execution-owned PostgreSQL Review Cases, exact-version drafts, immutable decisions, audit and authenticated Gateway boundary
- TASK 025 (actual implementation sequence) — Durable Document Package and Instruction Ledger (**represented by `baebb68` / PR #34 metadata**)
  - MarkReg-owned Document Package, document evidence and Instruction Ledger persistence in migration `0024`
- TASK 025 (approved delivery-plan objective) — Durable audit, idempotency and event-delivery hardening (**reconciled and closed by authorized TASK 025A remediation**)
  - The checkout re-used the number for the Document Package implementation; that history is retained rather than rewritten.
  - Prior audit status: `TASK_025_APPROVED_SCOPE_BLOCKED`; authorization: `TASK_025_APPROVED_SCOPE_REMEDIATION_AUTHORIZED`; final status: `TASK_025_APPROVED_SCOPE_CLOSED_BY_REMEDIATION`.
  - Evidence: `docs/planning/MO-MVP-MILESTONE-002-IMPLEMENTATION-TRACEABILITY.md` and `docs/validation/MO-MVP-TASK-025A-AUDIT-IDEMPOTENCY-MATRIX.md`.
  - Owner decision narrowed remediation to MarkReg/Platform Formal Matter and Document Package commands; Core-wide and Execution-wide audit remain outside scope. Migration 0025 adds bounded denial audit and Workspace-scoped authenticated reads.
- TASK 025A — Milestone 2 plan reconciliation and audit/idempotency gap audit (**completed; bounded remediation authorized and closed**)
  - Historical numbering drift remains recorded in the implementation traceability document rather than rewritten.
- TASK 026 — Milestone 2 restart, migration and tenant-isolation matrix (**merged in PR #37; hosted exact-tree evidence passed**)
  - Merge: `5badc2ea7e2c074357bef48b268f5359c8f9878f`; implementation tree `4e1a01e770cae99c34161f626c963432551f44f4`.
  - Evidence: `docs/tasks/MO-MVP-TASK-026-RESTART-MIGRATION-TENANT-MATRIX.md`, `docs/validation/MO-MVP-MILESTONE-002-RELIABILITY-MATRIX.{md,json}`, and TASK 027 final audit.
  - Hosted successful runs: validation `31231437103`, Milestone 2 reliability `31231437099`, Browser and Visual Validation `31231437102`.
  - Adds no product scope; owner-database reliability orchestration and exact-tree CI evidence only.
- TASK 027 — Milestone 2 integration audit (**merged in PR #38**)
  - Merge: `cc2a7afcb79056abcf92dbe2fa4467e0c2767f8d`.
  - Recommendation: **GO**.
  - Evidence: `docs/audits/MO-MVP-MILESTONE-002-INTEGRATION-AUDIT.md`.
  - The audit did not freeze, tag or publish Milestone 2; those remain explicit owner actions.

## Milestone 3

- TASK 028 — Milestone 3 scope and architecture lock (**approved by merge of PR #39**)
  - Approved direction: `DURABLE_COMMERCIAL_ORDER_AND_MATTER_LINKAGE`.
  - Scope: `docs/planning/MO-MVP-MILESTONE-003-SCOPE-LOCK.md`.
  - Delivery graph: milestone-local work packages `M3-WP-01` through `M3-WP-08` in `docs/planning/MO-MVP-MILESTONE-003-DELIVERY-PLAN.md`.
  - Machine-readable plan: `docs/planning/MO-MVP-MILESTONE-003-PLAN.json`.
  - Current implementation status: `docs/planning/MO-MVP-MILESTONE-003-IMPLEMENTATION-TRACEABILITY.{md,json}`.
- M3-WP-01 — Order contract and canonical state boundary (**merged in PR #40**)
- M3-WP-02 — Durable MarkReg Order persistence (**merged in PR #41**)
- M3-WP-03 — Protected Order service lifecycle (**merged in PR #42**)
- M3-WP-04 — Atomic governed Order-to-Matter conversion/link (**merged in PR #43**)
- M3-WP-05 — Authenticated Gateway Order API and typed client (**merged in PR #44**)
- M3-WP-06 — Durable markreg.com Order journey (**merged in PR #45**)
- M3-WP-07 — Reliability and migration matrix (**merged in PR #46; exact-tree hosted evidence passed**)
  - Audited implementation baseline: `60f2a1621ca135ab882794f5f369b038ec136f0c`; tree `be356c3a6efcaaedaec140a70beeb02208173eb7`.
  - Hosted successful runs: validation `31288159702`, Milestone 3 reliability `31288159708`, Milestone 2 reliability `31288159706`, Browser and Visual Validation `31288159705`.
- M3-WP-08 — Independent integration and authority audit (**merged in PR #47; GO recommendation**)
  - Merge: `505962ff146980a64b9cf6e08259068146612d05`.
  - Evidence: `docs/audits/MO-MVP-MILESTONE-003-INTEGRATION-AUDIT.{md,json}`.
  - No product/runtime behavior is added by this work package.
  - No Git tag, release, deployment freeze, Payment, Invoice, provider appointment or external filing authority is created by the audit.

Milestone 3 preserves `Order != Matter != Payment != Invoice != Filing`; `Confirmed` is not paid and `MatterCreated` is not filed.

## Milestone 4

- TASK 029 — Milestone 4 scope and architecture lock (**approved by merge of PR #48**)
  - Approved direction: `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`.
  - Scope: `docs/planning/MO-MVP-MILESTONE-004-SCOPE-LOCK.md`.
  - Delivery graph: milestone-local work packages `M4-WP-01` through `M4-WP-09` in `docs/planning/MO-MVP-MILESTONE-004-DELIVERY-PLAN.md`.
  - Machine-readable plan: `docs/planning/MO-MVP-MILESTONE-004-PLAN.json`.
  - Current implementation/audit status: `docs/planning/MO-MVP-MILESTONE-004-IMPLEMENTATION-TRACEABILITY.{md,json}`.
  - Governing locks: Provider Supply Capability is not user Capability evidence; Provider Return is not Official Truth; Payment is not performance/authority/acceptance/completion.
- M4-WP-01 — Provider execution contracts and canonical authority boundary (**merged in PR #49**)
  - Shared contract: `@markorbit/contracts/provider-execution`.
  - Vocabulary/authority evidence: `docs/architecture/PROVIDER-EXECUTION-AUTHORITY-BOUNDARY.md`.
- M4-WP-02 — Durable authenticated Execution filing-governance source (**merged in PR #50**)
  - Execution-owned migration: `0027_execution_filing_governance`.
- M4-WP-03 — Durable MGSN Provider Registry and Supply Capability (**merged in PR #51**)
  - MGSN-owned migration: `0028_mgsn_provider_registry`.
- M4-WP-04 — MGSN Service Package and deterministic Eligibility (**merged in PR #52**)
  - MGSN-owned migration: `0029_mgsn_service_package_eligibility`.
- M4-WP-05 — Explicit Allocation and authenticated Provider Acceptance (**merged in PR #53**)
  - MGSN-owned migration: `0030_mgsn_allocation_provider_acceptance`.
  - Allocation is explicit internal MGSN truth and Provider Acceptance is a separate authenticated Provider response.
- M4-WP-06 — Provider Return and exact Execution evidence handoff components (**merged in PR #54**)
  - MGSN-owned migration: `0031_mgsn_provider_return`.
  - Execution-owned migration: `0032_execution_provider_return_evidence`.
  - Provider Return remains provider evidence; Execution receipt is `PENDING_REVIEW`, not Official Truth.
- M4-WP-07 — Authenticated Gateway and controlled provider journey boundary (**merged in PR #55**)
  - Browser session, Workspace Principal, permission, Origin/CSRF, provider identity and trusted internal-call boundaries.
- M4-WP-08 — Exact-head reliability matrix (**merged in PR #56; exact-tree hosted evidence passed**)
  - Audited merged baseline: `f1fd652cf4882cd1e0996bd9846995443ca5e967`; implementation tree `fc5b44772dcd51f10f9aaac5495a2d1f33d13e8a`.
  - Final tested head `016cb221cf57733df04f56a815eefeb55dffe839` has the same tree.
  - Hosted successful runs: validation `31319610739`, Milestone 4 reliability `31319610700`, Milestone 3 reliability `31319610717`, Milestone 2 reliability `31319610695`, Browser and Visual Validation `31319610698`.
- M4-WP-09 — Independent integration and authority audit (**complete; final recommendation GO**)
  - Initial PR #57 audit returned `FIX` for three bounded runtime-integration findings.
  - PR #58 merged durable MGSN/Execution runtime composition plus the permanent zero-interception M4 integration gate.
  - Re-audited merged baseline: `327b61a22ad800250a2d9babe5997eb5a6a9e8eb`; tree `79efcbe2580e7fa372f0c7f5ebefe6f744216416`.
  - Exact remediation head `4c75c837374f1e92e61bc1a612273c94990371cd` passed M4 integration, validation, M4/M3/M2 reliability and Browser/Visual Validation.
  - Merged main independently passed M4 integration `31323865361`, validation `31323865372` and Browser and Visual Validation `31323865383`.
  - Evidence: `docs/audits/MO-MVP-MILESTONE-004-INTEGRATION-AUDIT.{md,json}`.
  - No tag, release, deployment freeze, Payment/Invoice, legal appointment, external filing or Official Truth is created by this audit.

Milestone 4 now has a **GO** recommendation for its approved engineering scope. The established authority locks remain in force.

## Milestone 5

- TASK 030A — Milestone 5 scope and architecture lock (**approved by merge of PR #60**)
  - Numbering note: historical `MO-MVP-TASK-030` remains reserved for Dual-channel Intake; this planning task does not rewrite it.
  - Approved direction: `DURABLE_EVIDENCE_REVIEW_AND_LIFECYCLE_PROJECTION`.
  - Scope: `docs/planning/MO-MVP-MILESTONE-005-SCOPE-LOCK.md`.
  - Delivery graph: milestone-local work packages `M5-WP-01` through `M5-WP-08` in `docs/planning/MO-MVP-MILESTONE-005-DELIVERY-PLAN.md`.
  - Machine-readable plan: `docs/planning/MO-MVP-MILESTONE-005-PLAN.json`.
  - Approved loop: `PENDING_REVIEW evidence -> explicit Evidence Review Decision -> reviewed-source admission/correction -> MarkReg Lifecycle Projection -> customer-safe status/timeline -> Recommended Action`.
  - Governing locks: review admission is not Official Truth or Filing Submission; lifecycle status is an internal governed projection; Recommended Action is advice rather than execution; no Payment/Invoice/legal appointment/automatic completion/Capability escalation.
  - Current implementation status: `docs/planning/MO-MVP-MILESTONE-005-IMPLEMENTATION-TRACEABILITY.{md,json}`.
- M5-WP-01 — Evidence review, lifecycle and recommendation contracts plus canonical authority boundary (**implemented in PR #61**)
  - Shared contract: `@markorbit/contracts/evidence-lifecycle`.
  - Authority evidence: `docs/architecture/EVIDENCE-REVIEW-LIFECYCLE-AUTHORITY-BOUNDARY.md`.
  - No runtime migration or external action is introduced by WP-01.
- M5-WP-02 — Durable authenticated Execution Evidence Review Decision (**implemented in PR #62**)
  - Execution-owned migration: `0033_execution_evidence_review`.
  - Exact receipt ID/version/fingerprint, authenticated reviewer identity, durable idempotency/concurrency and correction-request provenance.
  - Review remains internal truth, not Filing Submission or Official Truth.
- M5-WP-03 — Durable MarkReg Lifecycle Projection from exact admitted reviewed sources (**implemented in PR #64**)
  - MarkReg-owned migration: `0034_markreg_lifecycle_projection`.
  - Exact Reviewed Source Admission provenance, append-only lifecycle events, deterministic current view and durable idempotency/replay.
  - Lifecycle Projection remains internal governed truth with `officialStatusVerified = false`; no filing or official application/status truth is created.
