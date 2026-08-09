from pathlib import Path

p = Path('scripts/milestone2-migrations.integration.test.ts')
text = p.read_text()
old = """  Execution: [
    'professional_review_cases',
    'professional_review_commands',
    'professional_review_audit'
  ]
"""
new = """  Execution: [
    'professional_review_cases',
    'professional_review_commands',
    'professional_review_audit',
    'filing_authorizations',
    'execution_releases',
    'filing_execution_task_drafts',
    'filing_governance_commands',
    'filing_governance_audit'
  ]
"""
if old not in text:
    raise SystemExit('ownedTables.Execution anchor missing')
text = text.replace(old, new, 1)
old = "expect(sets.reduce((count, set) => count + set.size, 0)).toBe(9);"
new = """expect(sets.reduce((count, set) => count + set.size, 0)).toBe(10);
    expect(sets[2]).toContain('0027_execution_filing_governance');"""
if old not in text:
    raise SystemExit('owner migration count anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)
