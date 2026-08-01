# Milestone 2 implementation traceability

## History note

The approved plan remains unchanged. Its TASK 020–024 sequence described Formal Matter contract/repository/service/Gateway/Web decomposition, while the merged checkout used the same numbers for durable Customer Confirmation, preparation, Formal Matter, Lite Matter, and Professional Review. Commit `baebb68` then used TASK 025 for Durable Document Package and Instruction Ledger. The drift is evidenced by the commit subjects/PR numbers and the task documents created by those commits; no repository record explains an owner rationale beyond that actual relabeling, so this audit does not invent one.

The JSON companion is the normative row-level trace. Summary:

| Approved task | Actual implementation represented in checkout                    | Status against approved objective |
| ------------- | ---------------------------------------------------------------- | --------------------------------- |
| 017           | `0435516` / PR #25 metadata: PostgreSQL foundation               | SATISFIED                         |
| 018           | `c4f6fac` plus `1cf8743` / PR #26–27 metadata: Core identity     | SATISFIED                         |
| 019           | `5d71e60` / PR #28 metadata: authenticated runtime               | SATISFIED                         |
| 020           | `5bf2ee6` / PR #29 metadata: durable Customer Confirmation       | PARTIALLY_SATISFIED               |
| 021           | `0fcec2b` / PR #30 metadata: durable Matter Draft preparation    | PARTIALLY_SATISFIED               |
| 022           | `4a988c3` / PR #31 metadata: Formal Matter vertical slice        | SATISFIED                         |
| 023           | `e828498` / PR #32 metadata: Lite durable Matter workspace       | PARTIALLY_SATISFIED               |
| 024           | `88a46a3` / PR #33 metadata: Professional Review                 | PARTIALLY_SATISFIED               |
| 025           | `baebb68` / PR #34 metadata: Document Package/Instruction Ledger | PARTIALLY_SATISFIED               |
| 026           | Not started                                                      | NOT_IMPLEMENTED                   |
| 027           | Not started                                                      | NOT_IMPLEMENTED                   |

“Partially satisfied” compares the actual checkout to the _approved objective_, not the quality of the differently numbered vertical slice. Detailed aggregates, owners, migrations, evidence, and gaps are in the JSON companion and the TASK 025A matrix.

## Durable inventory and boundaries

- **Core / migrations 0018–0019:** User, Workspace, Membership, Session. Mutable ordinary domain/auth state only; no command or audit tables and no audit query.
- **MarkReg / migrations 0020–0022, 0024:** Customer Confirmation, Matter Draft, Formal Matter/source snapshot, Document Package/items/evidence, Instruction Ledger. Only Formal Matter and Document Package have durable command and success-audit tables. Their production repositories expose insertion, not audit update/delete, but the database has no trigger/privilege proof preventing direct rewrites.
- **Execution / migration 0023:** Professional Review with command and success-audit tables. No denial audit or audit read boundary.
- **Gateway:** authenticated business routes exist; no global or Workspace-scoped audit route exists.
- **Events:** process-local or fixture-local only; no outbox table and no reliable cross-service delivery guarantee.

## Resolution

`TASK_025_APPROVED_SCOPE_BLOCKED`. See the reconciliation task for the exact owner decisions required. No migrations were added.

## TASK 025A owner decision and remediation

The earlier blocked audit remains above. The owner subsequently authorized the bounded MarkReg/Platform disposition: `TASK_025_APPROVED_SCOPE_REMEDIATION_AUTHORIZED`. Migration 0025 and the corresponding repository, authenticated Gateway query, permission mapping, PostgreSQL/HTTP/restart suites, and CI commands close that authorized scope as `TASK_025_APPROVED_SCOPE_CLOSED_BY_REMEDIATION`.

This disposition deliberately adds no Core-wide or Execution-wide denial-audit system and does not redefine Customer Confirmation or Matter Draft as durable idempotent command families. Formal Matter and Document Package success audit rows remain authoritative; bounded MarkReg governance denials are separate append-only evidence. Audit reads require `audit:read` and are scoped to the Core-derived Principal Workspace. Event delivery remains process-local/fixture-local, non-durable, and without an outbox or reliable-delivery claim.
