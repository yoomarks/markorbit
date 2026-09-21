import { expect, test } from '@playwright/test';
import { workspaceInsightsFixture } from '../src/features/insights/fixtures.js';

const workspaceId = '52525252-5252-4525-8525-525252525252';
const candidateId = 'opportunity-candidate_today-e2e';
const recommendationId = 'today-recommendation_today-e2e';
const preparedActionId = 'prepared-action_today-e2e';
const reviewedFingerprint = 'a'.repeat(64);

const recommendation = {
  schemaVersion: 1,
  todayRecommendationId: recommendationId,
  workspaceId,
  version: 1,
  kind: 'OPPORTUNITY_REVIEW',
  title: 'Review qualified Canada filing need',
  explanation:
    'A human Qualification Decision marked this exact Candidate QUALIFIED_FOR_MARKREG. This is not customer instruction.',
  sources: [
    {
      schemaVersion: 1,
      owner: 'LITE',
      kind: 'OPPORTUNITY_CANDIDATE',
      sourceId: candidateId,
      sourceVersion: 1,
      sourceFingerprintSha256: reviewedFingerprint,
      observedAt: '2026-09-21T10:00:00.000Z'
    }
  ],
  status: 'OPEN',
  recommendationFingerprintSha256: 'b'.repeat(64),
  executionAuthorized: false,
  createdAt: '2026-09-21T10:01:00.000Z',
  updatedAt: '2026-09-21T10:01:00.000Z'
} as const;

const candidate = {
  schemaVersion: 1,
  opportunityCandidateId: candidateId,
  workspaceId,
  version: 2,
  kind: 'TRADEMARK_SERVICE',
  title: 'Canada filing service need',
  serviceNeedSummary: 'Human-reviewed trademark service need.',
  sources: [],
  status: 'DISPOSITIONED',
  opportunityCandidateFingerprintSha256: 'c'.repeat(64),
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: '2026-09-21T09:00:00.000Z',
  updatedAt: '2026-09-21T10:02:00.000Z'
} as const;

const qualification = {
  schemaVersion: 1,
  opportunityQualificationDecisionId: 'opportunity-qualification_today-e2e',
  workspaceId,
  version: 1,
  candidate: { id: candidateId, version: 1 },
  expectedCandidateFingerprintSha256: reviewedFingerprint,
  outcome: 'QUALIFIED_FOR_MARKREG',
  decidedByPrincipalId: 'principal_today-e2e',
  rationale: 'Human reviewer qualified this exact Candidate for MarkReg review.',
  decidedAt: '2026-09-21T10:02:00.000Z',
  formalOpportunityCreated: false,
  customerContacted: false
} as const;

const prepared = {
  schemaVersion: 1,
  preparedAction: {
    schemaVersion: 1,
    preparedActionId,
    workspaceId,
    version: 1,
    recommendation: { id: recommendationId, version: 1 },
    recommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
    kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    summary: 'Prepare one exact qualified Candidate for explicit MarkReg opportunity creation.',
    confirmationEffect:
      'Create one MarkReg Formal Trademark Service Opportunity from this exact qualified Candidate using relationship model WHITE_LABEL. No Intake, Order, Matter, payment, filing or customer contact will occur.',
    handoffTarget: 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    sources: recommendation.sources,
    preparedActionFingerprintSha256: 'd'.repeat(64),
    confirmationRequired: true,
    executionAuthorized: false,
    createdAt: '2026-09-21T10:03:00.000Z',
    updatedAt: '2026-09-21T10:03:00.000Z'
  },
  handoffState: 'AWAITING_CONFIRMATION'
} as const;

const completed = {
  ...prepared,
  confirmation: {
    schemaVersion: 1,
    preparedAction: { id: preparedActionId, version: 1 },
    expectedPreparedActionFingerprintSha256: prepared.preparedAction.preparedActionFingerprintSha256,
    confirmedByPrincipalId: 'principal_today-e2e',
    confirmedAt: '2026-09-21T10:04:00.000Z',
    acknowledgedEffect: prepared.preparedAction.confirmationEffect,
    protectedActionAuthorized: false
  },
  handoffState: 'HANDOFF_COMPLETED',
  handoffResult: {
    schemaVersion: 1,
    preparedAction: { id: preparedActionId, version: 1 },
    target: 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    owner: 'MARKREG',
    ownerRecord: { id: 'trademark-service-opportunity_today-e2e', version: 1 },
    completedAt: '2026-09-21T10:04:01.000Z',
    consequences: {
      externalPublishExecuted: false,
      customerContactedAutomatically: false,
      formalOpportunityCreatedAutomatically: false,
      orderCreatedAutomatically: false,
      matterCreatedAutomatically: false,
      paymentCreated: false,
      providerAppointed: false,
      filingSubmitted: false,
      officialTruthCreated: false
    }
  }
} as const;

function dailyWorkspace(stage: 0 | 1 | 2) {
  return {
    schemaVersion: 1,
    workspaceId,
    subjectUserId: '11111111-1111-4111-8111-111111111111',
    generatedAt: '2026-09-21T10:05:00.000Z',
    see: { preferenceSource: 'NONE', savedOrbitItemIds: [], orbitItems: [] },
    create: { contentPicks: [] },
    move: {
      todayItems: [
        {
          recommendation,
          preparedActions: stage === 0 ? [] : [stage === 1 ? prepared : completed]
        }
      ],
      recentFeedback: [],
      feedbackPendingPackages: []
    },
    partial: false,
    warnings: [],
    executionAuthorized: false,
    externalPublishExecuted: false,
    officialTruthCreated: false
  };
}

test('Today qualified Opportunity Review requires explicit relationship model before bounded MarkReg handoff', async ({
  page
}, testInfo) => {
  let stage: 0 | 1 | 2 = 0;
  let prepareRequest:
    | { headers: Record<string, string>; body: Record<string, unknown> }
    | undefined;
  let confirmRequest:
    | { headers: Record<string, string>; body: Record<string, unknown> }
    | undefined;

  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-today-opportunity' } })
  );
  await page.route('**/api/lite/daily-workspace', (route) =>
    route.fulfill({ json: dailyWorkspace(stage) })
  );
  await page.route('**/api/lite/analytics/product-loop-conversions', (route) =>
    route.fulfill({ json: workspaceInsightsFixture(workspaceId) })
  );
  await page.route(`**/api/lite/opportunity-candidates/${candidateId}/qualification`, (route) =>
    route.fulfill({ json: qualification })
  );
  await page.route(`**/api/lite/opportunity-candidates/${candidateId}`, (route) =>
    route.fulfill({ json: candidate })
  );
  await page.route(`**/api/lite/today/${recommendationId}/prepared-actions`, async (route) => {
    prepareRequest = {
      headers: route.request().headers(),
      body: route.request().postDataJSON() as Record<string, unknown>
    };
    stage = 1;
    await route.fulfill({ status: 201, json: prepared });
  });
  await page.route(`**/api/lite/prepared-actions/${preparedActionId}/confirm`, async (route) => {
    confirmRequest = {
      headers: route.request().headers(),
      body: route.request().postDataJSON() as Record<string, unknown>
    };
    stage = 2;
    await route.fulfill({ json: completed });
  });

  await page.goto(`/?workspaceId=${workspaceId}#today`);

  await expect(page.getByRole('heading', { name: recommendation.title })).toBeVisible();
  await expect(page.getByText(qualification.rationale)).toBeVisible();
  await expect(page.getByText(/does not verify a Customer Relationship/)).toBeVisible();

  const prepareButton = page.getByRole('button', {
    name: 'Prepare Formal Opportunity action'
  });
  await expect(prepareButton).toBeDisabled();
  await page.getByLabel('Relationship model').selectOption('WHITE_LABEL');
  await expect(prepareButton).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath('qualified-opportunity-ready.png'),
    fullPage: true
  });
  await prepareButton.click();

  await expect(page.getByText('Confirmation effect')).toBeVisible();
  await expect(page.getByText(/relationship model WHITE_LABEL/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm and hand off' })).toBeVisible();

  expect(prepareRequest?.headers['x-markorbit-workspace-id']).toBe(workspaceId);
  expect(prepareRequest?.headers['x-markorbit-csrf-token']).toBe('csrf-today-opportunity');
  expect(prepareRequest?.headers['idempotency-key']).toBe(
    `prepare-opportunity:${recommendationId}:1`
  );
  expect(prepareRequest?.body).toEqual({
    workspaceId,
    recommendationVersion: 1,
    expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
    plan: {
      kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      candidate: { id: candidateId, version: 1 },
      expectedCandidateFingerprintSha256: reviewedFingerprint,
      qualificationDecision: {
        id: qualification.opportunityQualificationDecisionId,
        version: 1
      },
      relationshipModel: 'WHITE_LABEL'
    }
  });
  expect(JSON.stringify(prepareRequest?.body)).not.toMatch(
    /customerId|principalId|actorId|proposedCustomerIntent/
  );

  await page.getByRole('button', { name: 'Confirm and hand off' }).click();
  await expect(page.getByText('Owner handoff completed')).toBeVisible();
  await expect(page.getByText('trademark-service-opportunity_today-e2e')).toBeVisible();
  expect(confirmRequest?.headers['x-markorbit-workspace-id']).toBe(workspaceId);
  expect(confirmRequest?.body).toMatchObject({
    workspaceId,
    preparedActionVersion: 1,
    expectedPreparedActionFingerprintSha256: prepared.preparedAction.preparedActionFingerprintSha256,
    acknowledgedEffect: prepared.preparedAction.confirmationEffect
  });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: testInfo.outputPath('qualified-opportunity-completed-mobile.png'),
    fullPage: true
  });
});
