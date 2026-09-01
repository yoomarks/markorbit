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
