# Milestone 2 implementation traceability

## History note

The approved plan remains unchanged. Its TASK 020–024 sequence described Formal Matter contract/repository/service/Gateway/Web decomposition, while the merged checkout used the same numbers for durable Customer Confirmation, preparation, Formal Matter, Lite Matter, and Professional Review. Commit `baebb68` then used TASK 025 for Durable Document Package and Instruction Ledger. The drift is evidenced by the commit subjects/PR numbers and the task documents created by those commits; no repository record explains an owner rationale beyond that actual relabeling, so this audit does not invent one.

The JSON companion is the normative row-level trace for the pre-TASK-026 reconciliation. Summary of the implementation history, with TASK 026/027 status brought current by the TASK 027 audit:

| Approved task | Actual implementation represented in checkout                                                      | Status against approved objective |
| ------------- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| 017           | `0435516` / PR #25 metadata: PostgreSQL foundation                                                 | SATISFIED                         |
| 018           | `c4f6fac` plus `1cf8743` / PR #26–27 metadata: Core identity                                       | SATISFIED                         |
| 019           | `5d71e60` / PR #28 metadata: authenticated runtime                                                 | SATISFIED                         |
| 020           | `5bf2ee6` / PR #29 metadata: durable Customer Confirmation                                         | PARTIALLY_SATISFIED               |
| 021           | `0fcec2b` / PR #30 metadata: durable Matter Draft preparation                                      | PARTIALLY_SATISFIED               |
| 022           | `4a988c3` / PR #31 metadata: Formal Matter vertical slice                                          | SATISFIED                         |
| 023           | `e828498` / PR #32 metadata: Lite durable Matter workspace                                         | PARTIALLY_SATISFIED               |
| 024           | `88a46a3` / PR #33 metadata: Professional Review                                                   | PARTIALLY_SATISFIED               |
| 025           | `baebb68` / PR #34 metadata plus authorized TASK 025A remediation                                  | SATISFIED_BY_RECONCILIATION       |
| 026           | PR #37 / merged `5badc2e`: restart, migration, concurrency and tenant-isolation reliability matrix | SATISFIED                         |
| 027           | `docs/audits/MO-MVP-MILESTONE-002-INTEGRATION-AUDIT.md`                                            | IN_AUDIT_PR                       |

“Partially satisfied” compares the historical implementation label to the _approved objective_, not the quality of the differently numbered vertical slice. TASK 025A reconciled that numbering drift and authorized the bounded remediation needed for the approved audit/idempotency objective. TASK 026 then added executable reliability evidence without new product scope.

## Durable inventory and boundaries

- **Core / migrations 0018–0019:** User, Workspace, Membership, Session. Core remains semantic authority for identity, authentication, Workspace Membership and Principal derivation.
- **MarkReg / migrations 0020–0022, 0024–0025:** Customer Confirmation, Matter Draft, Formal Matter/source snapshot, Document Package/items/evidence, Instruction Ledger, bounded command/audit evidence and authorized MarkReg governance denials.
- **Execution / migration 0023:** Professional Review with durable command and success-audit evidence. Execution also contains separately governed filing-authorization/release preparation code; the Milestone 2 Matter path does not create external filing authority consequences.
- **Gateway:** authenticated business routes enforce Core-derived Principal/Workspace context and delegate mutations to owning services.
- **Events:** process-local or fixture-local only; no outbox table and no reliable cross-service delivery guarantee is claimed by Milestone 2.

## TASK 025A resolution

The earlier TASK 025 audit found the approved audit/idempotency objective blocked by the implementation-number drift. The owner subsequently authorized the bounded MarkReg/Platform disposition: `TASK_025_APPROVED_SCOPE_REMEDIATION_AUTHORIZED`.

Migration 0025 and the corresponding repository, authenticated Gateway query, permission mapping, PostgreSQL/HTTP/restart suites, and CI commands closed that authorized scope as `TASK_025_APPROVED_SCOPE_CLOSED_BY_REMEDIATION`.

This disposition deliberately adds no Core-wide or Execution-wide denial-audit system and does not redefine Customer Confirmation or Matter Draft as durable idempotent command families. Formal Matter and Document Package success audit rows remain authoritative; bounded MarkReg governance denials are separate append-only evidence. Audit reads require `audit:read` and are scoped to the Core-derived Principal Workspace. Event delivery remains process-local/fixture-local, non-durable, and without an outbox or reliable-delivery claim.

## TASK 026 merged reliability disposition

TASK 026 was merged through PR #37 as `5badc2ea7e2c074357bef48b268f5359c8f9878f`.

The final PR head `aba2803137b5e08327e9240a009e8e794367c2b3` and the merge commit have the identical Git tree `4e1a01e770cae99c34161f626c963432551f44f4`. Hosted evidence on that exact tree passed:

- `validation` run `31231437103`;
- `Milestone 2 reliability` run `31231437099`;
- `Browser and Visual Validation` run `31231437102`.

The TASK 026 validation matrix markdown/JSON still contains its pre-hosted-CI “evidence pending” wording. TASK 027 records that as documentation-evidence drift rather than rewriting a historical validation artifact outside TASK 027's audit/release/planning-doc allowance.

## TASK 027 disposition

TASK 027 independently audits the merged implementation against the scope lock, durability/restart/concurrency/isolation requirements, browser evidence and false authority consequences.

Current audit recommendation: **GO**.

The audit recommendation does not itself freeze, tag, release or merge Milestone 2. Those actions remain explicit owner decisions.
