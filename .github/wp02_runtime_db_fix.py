from pathlib import Path

old = """  await executionPool.query(
    'DROP TABLE IF EXISTS professional_review_audit,professional_review_commands,professional_review_cases CASCADE'
  );
"""
new = """  await executionPool.query(
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
for path in [
    'scripts/professional-review-real-runtime.ts',
    'scripts/document-package-real-runtime.ts',
]:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'cleanup anchor missing in {path}')
    p.write_text(text.replace(old, new, 1))
