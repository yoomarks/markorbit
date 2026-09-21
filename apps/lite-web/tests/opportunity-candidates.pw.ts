import { expect, test } from '@playwright/test';

const candidate = {
  schemaVersion: 1,
  opportunityCandidateId: 'opportunity-candidate_browser-414',
  workspaceId: 'workspace-browser',
  version: 3,
  kind: 'TRADEMARK_SERVICE',
  customerId: 'customer_opaque-browser',
  title: 'Browser Candidate Review',
  serviceNeedSummary: 'A source observation for bounded human review.',
  sources: [
    {
      schemaVersion: 1,
      owner: 'KNOWLEDGE',
      kind: 'TRADEMARK_CONTEXT',
      sourceId: 'source_browser-414',
      sourceVersion: 5,
      sourceFingerprintSha256: 'a'.repeat(64),
      observedAt: '2026-08-31T08:00:00.000Z'
    }
  ],
  status: 'UNDER_REVIEW',
  opportunityCandidateFingerprintSha256: 'b'.repeat(64),
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: '2026-08-31T08:00:00.000Z',
  updatedAt: '2026-08-31T09:00:00.000Z'
} as const;

const second = {
  ...candidate,
  opportunityCandidateId: 'opportunity-candidate_browser-415',
  version: 1,
  title: 'Second paged Candidate',
  customerId: undefined,
  status: 'OPEN'
} as const;

const historicalDecision = {
  schemaVersion: 1,
  opportunityQualificationDecisionId: 'opportunity-qualification_browser-414',
  workspaceId: 'workspace-browser',
  version: 1,
  candidate: { id: candidate.opportunityCandidateId, version: 2 },
  expectedCandidateFingerprintSha256: 'c'.repeat(64),
  outcome: 'QUALIFIED_FOR_MARKREG',
  decidedByPrincipalId: 'principal_browser-reviewer',
  rationale: 'A human reviewed Candidate version 2.',
  decidedAt: '2026-08-31T10:00:00.000Z',
  formalOpportunityCreated: false,
  customerContacted: false
} as const;

test('Candidate Review uses Gateway cursor and exposes exact qualification lineage', async ({
  page
}, testInfo) => {
  const requests: Array<{ path: string; workspace?: string }> = [];
  await page.route(
    (url) => url.pathname.startsWith('/api/lite/opportunity-candidates'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      requests.push({
        path: `${url.pathname}${url.search}`,
        workspace: request.headers()['x-markorbit-workspace-id'] ?? ''
      });
      if (url.pathname.endsWith('/qualification'))
        return route.fulfill({ json: historicalDecision });
      if (url.pathname.endsWith(candidate.opportunityCandidateId))
        return route.fulfill({ json: candidate });
      if (url.searchParams.has('cursor'))
        return route.fulfill({ json: { items: [second], nextCursor: null } });
      return route.fulfill({
        json: { items: [candidate], nextCursor: candidate.opportunityCandidateId }
      });
    }
  );

  await page.goto('/?workspaceId=workspace-browser#opportunities');
  await expect(page.getByRole('heading', { name: 'Opportunity Center' })).toBeVisible();
  await expect(page.locator('.mo-topbar')).toHaveText('Workspace · workspace-browserAuthenticated');
  await expect(page.getByText('Candidate status: UNDER_REVIEW')).toBeVisible();
  await expect(page.getByText('Open detail to review decision')).toBeVisible();
  await page.getByRole('button', { name: 'Load more Candidates' }).click();
  await expect(page.getByRole('heading', { name: second.title })).toBeVisible();
  await page.getByRole('button', { name: 'Review Candidate details' }).first().click();
  await expect(page.getByText('Qualification outcome: QUALIFIED_FOR_MARKREG')).toBeVisible();
  await expect(
    page.getByText('Qualification covers Candidate v2. Current Candidate is v3.')
  ).toBeVisible();
  await expect(page.getByText('customer_opaque-browser')).toBeVisible();
  await expect(page.getByText(/does not contact a customer/)).toBeVisible();
  await expect(
    page.getByText(/Customer approved|Matter ready|Customer instructed filing/)
  ).toHaveCount(0);
  await expect(page.getByText(/Demonstration only/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  expect(requests).toContainEqual({
    path: `/api/lite/opportunity-candidates?cursor=${candidate.opportunityCandidateId}&limit=25`,
    workspace: 'workspace-browser'
  });
  expect(requests.every((request) => request.workspace === 'workspace-browser')).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('candidate-detail.png'), fullPage: true });
});

test('null Qualification remains no decision and 503 remains an error', async ({ page }) => {
  await page.route(
    (url) => url.pathname.startsWith('/api/lite/opportunity-candidates'),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/qualification')) return route.fulfill({ json: null });
      if (url.pathname.endsWith(candidate.opportunityCandidateId))
        return route.fulfill({ json: candidate });
      return route.fulfill({ json: { items: [candidate], nextCursor: null } });
    }
  );
  await page.goto('/?workspaceId=workspace-browser#opportunities');
  await page.getByRole('button', { name: 'Review Candidate details' }).click();
  await expect(page.getByText('No Qualification Decision recorded')).toBeVisible();
  await expect(page.getByText('Qualification outcome: REJECTED')).toHaveCount(0);

  await page.unrouteAll({ behavior: 'wait' });
  await page.route(
    (url) => url.pathname.startsWith('/api/lite/opportunity-candidates'),
    (route) => route.fulfill({ status: 503, json: { code: 'PERSISTENCE_UNAVAILABLE' } })
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Candidate Review temporarily unavailable' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No Opportunity Candidates' })).toHaveCount(0);
});

test('authenticated human Qualification POSTs exact evidence then renders durable refresh', async ({
  page
}, testInfo) => {
  let durableCandidate: object = candidate;
  let durableDecision: object | null = null;
  let mutation:
    { headers: Record<string, string>; body: Record<string, unknown>; path: string } | undefined;
  let detailReads = 0;
  let qualificationReads = 0;
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-browser-583' } })
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/lite/opportunity-candidates'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith('/qualification') && request.method() === 'POST') {
        mutation = {
          headers: request.headers(),
          body: request.postDataJSON() as Record<string, unknown>,
          path: url.pathname
        };
        durableCandidate = {
          ...candidate,
          version: 4,
          status: 'DISPOSITIONED',
          opportunityCandidateFingerprintSha256: 'd'.repeat(64),
          updatedAt: '2026-09-02T09:00:00.000Z'
        };
        durableDecision = {
          ...historicalDecision,
          candidate: { id: candidate.opportunityCandidateId, version: candidate.version },
          expectedCandidateFingerprintSha256: candidate.opportunityCandidateFingerprintSha256,
          outcome: 'DEFERRED',
          rationale: 'Browser human reviewed exact evidence.',
          decidedAt: '2026-09-02T09:00:00.000Z'
        };
        return route.fulfill({
          status: 201,
          json: { decision: durableDecision, currentCandidate: durableCandidate }
        });
      }
      if (url.pathname.endsWith('/qualification')) {
        qualificationReads += 1;
        return route.fulfill({ json: durableDecision });
      }
      if (url.pathname.endsWith(candidate.opportunityCandidateId)) {
        detailReads += 1;
        return route.fulfill({ json: durableCandidate });
      }
      return route.fulfill({ json: { items: [candidate], nextCursor: null } });
    }
  );

  await page.goto('/?workspaceId=workspace-browser#opportunities');
  await page.getByRole('button', { name: 'Review Candidate details' }).click();
  await expect(page.getByRole('heading', { name: 'Record human Qualification' })).toBeVisible();
  await page.getByRole('radio', { name: /Defer Candidate/ }).check();
  await page
    .getByRole('textbox', { name: 'Human rationale' })
    .fill('Browser human reviewed exact evidence.');
  await page.screenshot({
    path: testInfo.outputPath('human-qualification-form.png'),
    fullPage: true
  });
  await page.getByRole('button', { name: 'Record human Qualification' }).click();

  await expect(page.getByText('Qualification outcome: DEFERRED')).toBeVisible();
  await expect(page.getByText('Candidate status: DISPOSITIONED')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Record human Qualification' })).toHaveCount(0);
  expect(detailReads).toBe(2);
  expect(qualificationReads).toBe(2);
  expect(mutation?.path).toBe(
    `/api/lite/opportunity-candidates/${candidate.opportunityCandidateId}/qualification`
  );
  expect(mutation?.headers['x-markorbit-workspace-id']).toBe('workspace-browser');
  expect(mutation?.headers['x-markorbit-csrf-token']).toBe('csrf-browser-583');
  expect(mutation?.headers['idempotency-key']).toBeTruthy();
  expect(mutation?.body).toEqual({
    candidateVersion: candidate.version,
    expectedCandidateFingerprintSha256: candidate.opportunityCandidateFingerprintSha256,
    outcome: 'DEFERRED',
    rationale: 'Browser human reviewed exact evidence.'
  });
  expect(JSON.stringify(mutation?.body)).not.toMatch(
    /workspaceId|decidedByPrincipalId|actorId|userId|principalId|membershipId/
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({ path: testInfo.outputPath('human-qualification.png'), fullPage: true });
});

test('Today qualified Opportunity Review requires explicit relationship model before Prepared Action', async ({
  page
}, testInfo) => {
  const workspaceId = 'workspace-browser';
  const source = {
    schemaVersion: 1,
    owner: 'LITE',
    kind: 'OPPORTUNITY_CANDIDATE',
    sourceId: 'opportunity-candidate_today-browser',
    sourceVersion: 3,
    sourceFingerprintSha256: '8'.repeat(64),
    observedAt: '2026-09-21T10:00:00.000Z'
  } as const;
  const recommendation = {
    schemaVersion: 1,
    todayRecommendationId: 'today-recommendation_today-browser',
    workspaceId,
    version: 1,
    kind: 'OPPORTUNITY_REVIEW',
    title: 'Qualified trademark-service need',
    explanation: 'Review exact human-qualified evidence before preparing a Formal Opportunity.',
    sources: [source],
    status: 'OPEN',
    recommendationFingerprintSha256: '9'.repeat(64),
    executionAuthorized: false,
    createdAt: '2026-09-21T10:01:00.000Z',
    updatedAt: '2026-09-21T10:01:00.000Z'
  } as const;
  const currentCandidate = {
    schemaVersion: 1,
    opportunityCandidateId: source.sourceId,
    workspaceId,
    version: 4,
    kind: 'TRADEMARK_SERVICE',
    title: 'Qualified trademark-service need',
    serviceNeedSummary: 'Human review found a bounded trademark-service need.',
    sources: [],
    status: 'DISPOSITIONED',
    opportunityCandidateFingerprintSha256: 'a'.repeat(64),
    formalOpportunityCreated: false,
    customerContacted: false,
    createdAt: '2026-09-21T09:00:00.000Z',
    updatedAt: '2026-09-21T10:00:30.000Z'
  } as const;
  const decision = {
    schemaVersion: 1,
    opportunityQualificationDecisionId: 'opportunity-qualification_today-browser',
    workspaceId,
    version: 1,
    candidate: { id: source.sourceId, version: source.sourceVersion },
    expectedCandidateFingerprintSha256: source.sourceFingerprintSha256,
    outcome: 'QUALIFIED_FOR_MARKREG',
    decidedByPrincipalId: 'principal_browser-human',
    rationale: 'Human reviewer confirmed this exact Candidate version.',
    decidedAt: '2026-09-21T10:00:00.000Z',
    formalOpportunityCreated: false,
    customerContacted: false
  } as const;
  const prepared = {
    schemaVersion: 1,
    preparedAction: {
      schemaVersion: 1,
      preparedActionId: 'prepared-action_today-browser',
      workspaceId,
      version: 1,
      recommendation: { id: recommendation.todayRecommendationId, version: 1 },
      recommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
      kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      summary: 'Promote the explicitly qualified trademark-service need into MarkReg.',
      confirmationEffect:
        'Create one MarkReg Formal Trademark Service Opportunity from the exact qualified Candidate. This does not contact the customer or create an Intake, Order, Matter, payment, appointment or filing.',
      handoffTarget: 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      sources: recommendation.sources,
      preparedActionFingerprintSha256: '7'.repeat(64),
      confirmationRequired: true,
      executionAuthorized: false,
      createdAt: '2026-09-21T10:05:00.000Z',
      updatedAt: '2026-09-21T10:05:00.000Z'
    },
    handoffState: 'AWAITING_CONFIRMATION'
  } as const;

  let persistedPrepared = false;
  let prepareRequest:
    | { body: Record<string, unknown>; headers: Record<string, string> }
    | undefined;

  const dailyWorkspace = () => ({
    schemaVersion: 1,
    workspaceId,
    subjectUserId: '11111111-1111-4111-8111-111111111111',
    generatedAt: '2026-09-21T10:06:00.000Z',
    see: { preferenceSource: 'NONE', savedOrbitItemIds: [], orbitItems: [] },
    create: { contentPicks: [] },
    move: {
      todayItems: [
        {
          recommendation,
          preparedActions: persistedPrepared ? [prepared] : []
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
  });

  await page.route('**/api/lite/daily-workspace', (route) =>
    route.fulfill({ json: dailyWorkspace() })
  );
  await page.route('**/api/lite/analytics/product-loop-conversions', (route) =>
    route.fulfill({
      status: 503,
      json: { code: 'ANALYTICS_UNAVAILABLE', message: 'Insights are not part of this journey.' }
    })
  );
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-today-browser-1424' } })
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/lite/opportunity-candidates/'),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/qualification')) return route.fulfill({ json: decision });
      return route.fulfill({ json: currentCandidate });
    }
  );
  await page.route(
    (url) =>
      url.pathname ===
      `/api/lite/today/${recommendation.todayRecommendationId}/prepared-actions`,
    async (route) => {
      const request = route.request();
      prepareRequest = {
        body: request.postDataJSON() as Record<string, unknown>,
        headers: request.headers()
      };
      persistedPrepared = true;
      return route.fulfill({ status: 201, json: prepared });
    }
  );

  await page.goto('/?workspaceId=workspace-browser#today');
  await expect(page.getByRole('heading', { name: recommendation.title })).toBeVisible();
  await expect(page.getByText(decision.rationale)).toBeVisible();
  await expect(page.getByText(source.sourceFingerprintSha256)).toBeVisible();

  const prepareButton = page.getByRole('button', {
    name: 'Prepare Formal Opportunity action'
  });
  await expect(prepareButton).toBeDisabled();
  await page.getByRole('radio', { name: 'Co-delivery' }).check();
  await expect(prepareButton).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath('today-qualified-opportunity-ready.png'),
    fullPage: true
  });
  await prepareButton.click();

  await expect(page.getByText('Confirmation effect')).toBeVisible();
  await expect(page.getByText(prepared.preparedAction.confirmationEffect)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm and hand off' })).toBeVisible();

  expect(prepareRequest?.headers['x-markorbit-workspace-id']).toBe(workspaceId);
  expect(prepareRequest?.headers['x-markorbit-csrf-token']).toBe('csrf-today-browser-1424');
  expect(prepareRequest?.headers['idempotency-key']).toBe(
    `prepare-opportunity:${recommendation.todayRecommendationId}:1:CO_DELIVERY`
  );
  expect(prepareRequest?.body).toEqual({
    recommendationVersion: 1,
    expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
    plan: {
      kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      candidate: { id: source.sourceId, version: source.sourceVersion },
      expectedCandidateFingerprintSha256: source.sourceFingerprintSha256,
      qualificationDecision: {
        id: decision.opportunityQualificationDecisionId,
        version: decision.version
      },
      relationshipModel: 'CO_DELIVERY'
    }
  });
  expect(JSON.stringify(prepareRequest?.body)).not.toMatch(
    /workspaceId|customerId|actorId|userId|principalId|membershipId/
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});

