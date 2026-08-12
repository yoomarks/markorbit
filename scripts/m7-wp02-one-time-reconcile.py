from pathlib import Path

readme = Path('README.md')
text = readme.read_text()
text = text.replace(
    "**Product Loop Closure and Milestone 6 are complete with final GO recommendations. TASK 032A / PR #94 is merged as `ca74da13b294d91b5a8bae5ee0fad3d6fbd2000f`, approving Milestone 7 — Beta Release Readiness and Operational Hardening. `M7-WP-01` is the current bounded implementation step.**",
    "**Product Loop Closure and Milestone 6 are complete with final GO recommendations. M7-WP-01 merged in PR #95 as `88032709d1252392ce57dfe1823eaf238810011f`; `M7-WP-02 — Bounded Content/Opportunity conversion analytics` is the current bounded implementation step.**",
)
text = text.replace(
    "M7-WP-01 freezes those semantics plus the Week 4 gap inventory before runtime work. It does not add analytics runtime, seed data, deployment mutation, release/tag publication or protected business authority. After explicit Owner merge of M7-WP-01, the next authorized step is `M7-WP-02`.",
    "M7-WP-01 froze the Beta readiness semantics and Week 4 gap inventory. M7-WP-02 now adds only a Lite-owned, Workspace-scoped, read-only Content/Opportunity conversion projection over existing durable Product-loop facts. Metrics remain observational, user-reported external use remains unverified, and the Formal Opportunity conversion uses Lite-owned durable handoff evidence rather than MarkReg SQL. After explicit Owner merge of M7-WP-02, the next authorized step is `M7-WP-03`.",
)
text = text.replace(
    "- `docs/tasks/MO-MVP-M7-WP-01-BETA-READINESS-CONTRACTS-AUTHORITY.md`;\n- `docs/architecture/BETA-READINESS-AUTHORITY-BOUNDARY.md`;",
    "- `docs/tasks/MO-MVP-M7-WP-01-BETA-READINESS-CONTRACTS-AUTHORITY.md`;\n- `docs/tasks/MO-MVP-M7-WP-02-BOUNDED-CONVERSION-ANALYTICS.md`;\n- `docs/architecture/BETA-READINESS-AUTHORITY-BOUNDARY.md`;",
)
readme.write_text(text)

index = Path('docs/planning/TASK-INDEX.md')
text = index.read_text()
old = """- TASK 032A — Milestone 7 scope and architecture lock (**proposed; awaiting explicit Owner approval**)
  - Numbering note: historical `MO-MVP-TASK-032` remains reserved for Class and Goods Recommendation; this planning task does not rewrite it.
  - Baseline: M6-WP-08 final GO merge `f63fb857663fc05879c26716169cb3186613f32b` / PR #93.
  - Proposed direction: `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`.
  - Scope: `docs/planning/MO-MVP-MILESTONE-007-SCOPE-LOCK.md`.
  - Delivery graph: `M7-WP-01` through `M7-WP-07` in `docs/planning/MO-MVP-MILESTONE-007-DELIVERY-PLAN.md`.
  - Machine-readable plan: `docs/planning/MO-MVP-MILESTONE-007-PLAN.json`.
  - Planning task: `docs/tasks/MO-MVP-TASK-032A-MILESTONE-007-SCOPE-LOCK.md`.
  - Planning-only lock: `Product metric != business authority`; `Seeded demo record != customer/provider/official truth`; `Deployment Rehearsal != Production Deployment`; `Beta Release Candidate != Released Beta`; `Green CI != Owner Release Authorization`.
  - Merge of TASK 032A would approve only the bounded M7 direction and work-package graph; it would not deploy production, publish a Beta/tag or authorize a protected business action.
- M7-WP-01 — Beta readiness contracts, gap inventory and authority boundary (**not started; only after TASK 032A approval**)
- M7-WP-02 — Bounded Content/Opportunity conversion analytics (**not started**)
- M7-WP-03 — Deterministic non-production seeded Beta scenario (**not started**)
- M7-WP-04 — Three-loop full-journey Beta real-runtime acceptance (**not started**)
- M7-WP-05 — Deployment rehearsal, migration and rollback/recovery evidence (**not started**)
- M7-WP-06 — Exact-head Beta RC reliability, responsive and known-limits matrix (**not started**)
- M7-WP-07 — Independent Beta readiness and authority audit (**not started**)"""
new = """- TASK 032A — Milestone 7 scope and architecture lock (**approved by merge of PR #94**)
  - Numbering note: historical `MO-MVP-TASK-032` remains reserved for Class and Goods Recommendation; this planning task does not rewrite it.
  - Baseline: M6-WP-08 final GO merge `f63fb857663fc05879c26716169cb3186613f32b` / PR #93.
  - Approved direction: `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`.
  - Scope: `docs/planning/MO-MVP-MILESTONE-007-SCOPE-LOCK.md`.
  - Delivery graph: `M7-WP-01` through `M7-WP-07` in `docs/planning/MO-MVP-MILESTONE-007-DELIVERY-PLAN.md`.
  - Machine-readable plan: `docs/planning/MO-MVP-MILESTONE-007-PLAN.json`.
  - Planning task: `docs/tasks/MO-MVP-TASK-032A-MILESTONE-007-SCOPE-LOCK.md`.
  - Permanent lock: `Product metric != business authority`; `Seeded demo record != customer/provider/official truth`; `Deployment Rehearsal != Production Deployment`; `Beta Release Candidate != Released Beta`; `Green CI != Owner Release Authorization`.
- M7-WP-01 — Beta readiness contracts, gap inventory and authority boundary (**merged in PR #95**)
  - Merge: `88032709d1252392ce57dfe1823eaf238810011f`.
  - Shared contract: `@markorbit/contracts/beta-readiness`; no runtime mutation was introduced.
- M7-WP-02 — Bounded Content/Opportunity conversion analytics (**implementing in PR #96**)
  - Lite-owned, Workspace-scoped read-only projection over existing Product-loop facts; no analytics migration or cross-service SQL.
  - Authenticated Gateway surface: `GET /api/lite/analytics/product-loop-conversions`.
  - Dedicated PostgreSQL gate: `.github/workflows/m7-wp-02-conversion-analytics.yml`.
- M7-WP-03 — Deterministic non-production seeded Beta scenario (**not started; only after M7-WP-02 Owner merge**)
- M7-WP-04 — Three-loop full-journey Beta real-runtime acceptance (**not started**)
- M7-WP-05 — Deployment rehearsal, migration and rollback/recovery evidence (**not started**)
- M7-WP-06 — Exact-head Beta RC reliability, responsive and known-limits matrix (**not started**)
- M7-WP-07 — Independent Beta readiness and authority audit (**not started**)"""
if old not in text:
    raise SystemExit('expected M7 Task Index block not found')
index.write_text(text.replace(old, new))
