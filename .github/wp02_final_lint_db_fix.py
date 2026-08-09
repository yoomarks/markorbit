from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing anchor in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1))


# Browser fixtures share one Execution database in CI; each fixture must reset all current Execution tables.
old_cleanup = """  await executionPool.query(
    'DROP TABLE IF EXISTS professional_review_audit,professional_review_commands,professional_review_cases CASCADE'
  );
"""
new_cleanup = """  await executionPool.query(
    `DROP TABLE IF EXISTS
       filing_execution_task_drafts,
       execution_releases,
       filing_authorizations,
       filing_governance_commands,
       filing_governance_audit,
       professional_review_audit,
       professional_review_commands,
       professional_review_cases
     CASCADE`
  );
  await executionPool.query(
    'DROP FUNCTION IF EXISTS reject_filing_governance_audit_mutation() CASCADE'
  );
"""
for runtime_path in [
    'scripts/professional-review-real-runtime.ts',
    'scripts/document-package-real-runtime.ts',
]:
    replace(runtime_path, old_cleanup, new_cleanup)

replace(
    'services/execution/src/filing-authorization-postgres.ts',
    '  release(_value: ExecutionRelease): Promise<void> {\n',
    '  release(): Promise<void> {\n',
)
replace(
    'services/execution/src/index.ts',
    '    const audit = adapter as FilingGovernanceAuditRepository;\n',
    '    const audit = adapter;\n',
)
replace(
    'services/execution/tests/filing-authorization-auth.test.ts',
    '/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await -- HTTP boundary assertions intentionally inspect decoded JSON fixtures. */',
    '/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/require-await -- HTTP boundary assertions intentionally inspect decoded JSON fixtures. */',
)
replace(
    'services/execution/tests/filing-authorization-postgres.test.ts',
    '/* eslint-disable @typescript-eslint/require-await -- fixture sources intentionally implement async service boundaries. */',
    '/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/require-await -- fixture sources intentionally implement async service boundaries and adapter-role casts. */',
)
replace(
    'services/execution/tests/filing-authorization-postgres.test.ts',
    """      .query(
        'SELECT audit_id FROM filing_governance_audit WHERE target_id=$1 ORDER BY audit_id LIMIT 1',
""",
    """      .query<{ audit_id: string }>(
        'SELECT audit_id FROM filing_governance_audit WHERE target_id=$1 ORDER BY audit_id LIMIT 1',
""",
)
