from pathlib import Path


def rep(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'missing {label}: {old[:100]!r}')
    p.write_text(s.replace(old, new, 1))


rep(
    'services/markreg/src/matter-intelligence-review.ts',
    '    reasonCode?: MatterIntelligenceReviewReasonCode;\n    rationale?: string;\n    reviewerPrincipalId: string;\n    reviewerMembershipId: string;\n  }>',
    '    reasonCode: MatterIntelligenceReviewReasonCode | undefined;\n    rationale: string | undefined;\n    reviewerPrincipalId: string;\n    reviewerMembershipId: string;\n  }>',
    'review match exact optional helper'
)

p = Path('services/markreg/src/matter-intelligence-review-http.ts')
s = p.read_text()
old = '''            reasonCode:
              body.reasonCode === undefined
                ? undefined
                : (enumValue(
                    body.reasonCode,
                    matterIntelligenceReviewReasonCodes,
                    'reasonCode'
                  ) as MatterIntelligenceReviewReasonCode),
            rationale: rationale(body.rationale),
            supersedes: supersedes(body.supersedes),
'''
new = '''            ...(body.reasonCode === undefined
              ? {}
              : {
                  reasonCode: enumValue(
                    body.reasonCode,
                    matterIntelligenceReviewReasonCodes,
                    'reasonCode'
                  ) as MatterIntelligenceReviewReasonCode
                }),
            ...(body.rationale === undefined ? {} : { rationale: rationale(body.rationale) }),
            ...(body.supersedes === undefined ? {} : { supersedes: supersedes(body.supersedes) }),
'''
if old not in s:
    raise SystemExit('missing HTTP optional command block')
p.write_text(s.replace(old, new, 1))

for path in [
    'services/markreg/tests/matter-intelligence-review-http.test.ts',
    'services/markreg/tests/matter-intelligence-review-postgres.test.ts'
]:
    p = Path(path)
    s = p.read_text()
    for old, new in [
        ('CONFIRMED_AS_PRESENTED', 'CONFIRMED'),
        ('INDEPENDENT_REVIEW_CONFIRMED', 'INCONCLUSIVE_EVIDENCE'),
        ('METHOD_OUTPUT_INCORRECT', 'METHOD_ERROR'),
        ('INPUT_FACT_INCORRECT', 'INPUT_DATA_ERROR'),
        ('APPLICABILITY_MISMATCH', 'APPLICABILITY_ERROR'),
        ('PRODUCT_OR_WORKFLOW_PREFERENCE', 'PRODUCT_USER_PREFERENCE'),
        ('INSUFFICIENT_EVIDENCE', 'INCONCLUSIVE_EVIDENCE'),
        ('REVIEW_ALREADY_EXISTS', 'SUPERSESSION_REQUIRED')
    ]:
        s = s.replace(old, new)
    p.write_text(s)

p = Path('services/markreg/tests/matter-intelligence-review-postgres.test.ts')
s = p.read_text()
s = s.replace("const formalMatterId = 'formal-matter_phase6-review';", "const formalMatterId = 'formal-matter_phase6-review' as const;")
s = s.replace("const observationId = 'matter-intelligence-observation_phase6-review';", "const observationId = 'matter-intelligence-observation_phase6-review' as const;")
p.write_text(s)

p = Path('services/markreg/tests/matter-intelligence-review-http.test.ts')
s = p.read_text()
s = s.replace("const formalMatterId = 'formal-matter_phase6-http';", "const formalMatterId = 'formal-matter_phase6-http' as const;")
s = s.replace("const observationId = 'matter-intelligence-observation_phase6-http';", "const observationId = 'matter-intelligence-observation_phase6-http' as const;")
s = s.replace("          outcome: 'CONFIRMED',\n          reasonCode: 'INCONCLUSIVE_EVIDENCE'", "          outcome: 'CONFIRMED'")
s = s.replace("      outcome: 'CONFIRMED',\n      reasonCode: 'INCONCLUSIVE_EVIDENCE',", "      outcome: 'CONFIRMED',")
p.write_text(s)
