import type { Page } from '@playwright/test';

export const intakeDraft = {
  applicantType: 'Company',
  applicantName: 'Northstar International Holdings with an intentionally long applicant name',
  applicantCountry: 'GB',
  trademarkType: 'Word mark',
  trademarkText: 'NORTHSTAR ORBIT',
  targetCountries: ['US', 'GB', 'EU'],
  goodsServicesSummary:
    'Software, professional services, education, and a long description used to validate responsive wrapping without breaking the page layout.',
  businessContext: 'An established company preparing a cautious international launch.',
  filingGoal: 'Compare practical protection scopes before seeking professional review.'
};

export const recommendation = {
  intake: {
    intakeId: 'intake_e2e',
    channel: 'MARKREG_DIRECT',
    relationshipModel: 'DIRECT',
    status: 'RECOMMENDATION_READY',
    customerIntent: {
      brandName: intakeDraft.trademarkText,
      applicantCountry: intakeDraft.applicantCountry,
      targetJurisdictions: intakeDraft.targetCountries,
      goodsServicesDescription: intakeDraft.goodsServicesSummary
    },
    createdAt: '2026-07-27T00:00:00.000Z',
    correlationId: 'correlation_e2e'
  },
  recommendation: {
    recommendationId: 'recommendation_e2e',
    intakeId: 'intake_e2e',
    status: 'FIXTURE_ONLY',
    options: [
      { tier: 'A', name: 'Essential Protection', description: 'A focused starting point.' },
      { tier: 'B', name: 'Recommended Protection', description: 'Balanced coverage.' },
      { tier: 'C', name: 'Extended Protection', description: 'Broader planning coverage.' }
    ],
    rationale: 'Compares scope against the supplied markets and goal.',
    assumptions: ['The supplied applicant details are accurate.'],
    limitations: ['No clearance search or professional review has been performed.'],
    provenance: ['execution_e2e'],
    generatedAt: '2026-07-27T00:00:00.000Z'
  },
  trace: {
    correlationId: 'correlation_e2e',
    capabilityRequestId: 'capability_e2e',
    executionId: 'execution_e2e',
    provenanceRefs: ['execution_e2e']
  }
};

export async function seedMarkreg(page: Page, state: 'applicant' | 'review' | 'recommendation') {
  await page.addInitScript(
    ({ draft, result, target }) => {
      if (target !== 'applicant')
        sessionStorage.setItem('markreg-guided-intake-v1', JSON.stringify(draft));
      if (target === 'recommendation')
        sessionStorage.setItem('markreg-recommendation-v1', JSON.stringify(result));
    },
    { draft: intakeDraft, result: recommendation, target: state }
  );
}
