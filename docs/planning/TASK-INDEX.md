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
  - Infrastructure only; TASK 018 has not started
