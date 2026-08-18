import { expect, test } from '@playwright/test';

const gateway = 'http://127.0.0.1:4410';
const lite = 'http://127.0.0.1:4475';
const desktopWorkspaceId = '31313131-3131-4313-8313-313131313131';
const mobileWorkspaceId = '32323232-3232-4323-8323-323232323232';
const title = 'Prepare the reviewed trademark maintenance update';

test.describe('M9 WP07 real durable Daily Workspace preference loop', () => {
  test('runs SEE → personalize → CREATE → MOVE through authenticated real runtime without interception', async ({
    page
  }) => {
    const productLoopRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/lite/')) productLoopRequests.push(request.url());
    });

    const workspaceId = test.info().project.name.includes('mobile')
      ? mobileWorkspaceId
      : desktopWorkspaceId;

    const auth = await page.request.post(`${gateway}/__test/auth/session`, {
      data: { fixture: 'wp06' }
    });
    expect(auth.status()).toBe(201);
    const authPayload = (await auth.json()) as { csrfToken?: string };
    expect(authPayload.csrfToken).toBeTruthy();
    const sessionCookie = auth.headers()['set-cookie']?.match(/mo_session=([^;]+)/)?.[1];
    expect(sessionCookie).toBeTruthy();
    await page
      .context()
      .addCookies([{ name: 'mo_session', value: sessionCookie!, domain: '127.0.0.1', path: '/' }]);

    const todayResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/today') && response.request().method() === 'GET'
    );
    const orbitResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/daily-orbit') && response.request().method() === 'GET'
    );
    await page.goto(`${lite}/?workspaceId=${workspaceId}#today`);
    expect((await todayResponse).status()).toBe(200);
    const initialOrbitResponse = await orbitResponse;
    expect(initialOrbitResponse.status()).toBe(200);
    const initialOrbit = (await initialOrbitResponse.json()) as {
      preferenceSource: string;
      items: Array<{
        dailyOrbitItemId: string;
        version: number;
        signal: { id: string; version: number };
        score: { personalRelevance: { score: number } };
      }>;
    };
    expect(initialOrbit.preferenceSource).toBe('NONE');
    expect(initialOrbit.items).toHaveLength(1);
    const initialItem = initialOrbit.items[0]!;

    await expect(page.getByRole('heading', { name: 'Good morning', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Today's Orbit", exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content Picks', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quick Create', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Today Actions', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();

    const orbitCard = page.locator('#daily-orbit section.mo-card').filter({
      has: page.getByRole('heading', { name: title, exact: true })
    });
    await expect(orbitCard).toHaveCount(1);
    await expect(orbitCard.getByLabel(/^Orbit score \d+$/i)).toBeVisible();
    await expect(orbitCard.getByText(/Importance 90/)).toBeVisible();
    await orbitCard.getByText('Source & ranking reasons', { exact: true }).click();
    await expect(
      orbitCard.getByText(`rdp_wp06-browser-${workspaceId}`, { exact: false })
    ).toBeVisible();

    const preferenceResponse = await page.request.post(
      `${gateway}/api/lite/product-preference-events`,
      {
        headers: {
          origin: lite,
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': authPayload.csrfToken!,
          'idempotency-key': `wp07-browser-save-${workspaceId}`
        },
        data: {
          kind: 'SAVED',
          targetType: 'DAILY_ORBIT_ITEM',
          targetId: initialItem.dailyOrbitItemId,
          targetVersion: initialItem.version
        }
      }
    );
    expect(preferenceResponse.status()).toBe(201);
    const preferenceBody = (await preferenceResponse.json()) as {
      event: {
        subjectUserId: string;
        externalActionExecutedByMarkOrbit: boolean;
        externalOutcomeVerifiedByMarkOrbit: boolean;
        capabilityVerified: boolean;
      };
      preference: { source: string; capabilityVerified: boolean };
    };
    expect(preferenceBody.event.externalActionExecutedByMarkOrbit).toBe(false);
    expect(preferenceBody.event.externalOutcomeVerifiedByMarkOrbit).toBe(false);
    expect(preferenceBody.event.capabilityVerified).toBe(false);
    expect(preferenceBody.preference).toMatchObject({
      source: 'PRODUCT_FEEDBACK',
      capabilityVerified: false
    });

    const personalizedOrbitResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/daily-orbit') && response.request().method() === 'GET'
    );
    await page.reload();
    const personalizedOrbit = (await (await personalizedOrbitResponse).json()) as {
      preferenceSource: string;
      items: Array<{
        signal: { id: string; version: number };
        score: { personalRelevance: { score: number; reason: string } };
      }>;
    };
    expect(personalizedOrbit.preferenceSource).toBe('PRODUCT_FEEDBACK');
    const personalizedItem = personalizedOrbit.items.find(
      (candidate) =>
        candidate.signal.id === initialItem.signal.id &&
        candidate.signal.version === initialItem.signal.version
    );
    expect(personalizedItem).toBeTruthy();
    expect(personalizedItem!.score.personalRelevance.score).toBeGreaterThan(
      initialItem.score.personalRelevance.score
    );
    expect(personalizedItem!.score.personalRelevance.reason).toContain('configured');
    await expect(
      page.getByText(`Relevance ${personalizedItem!.score.personalRelevance.score}`, {
        exact: true
      })
    ).toBeVisible();

    await expect(page.getByText('Prepare the content line first', { exact: true })).toBeVisible();
    await expect(page.getByText(/Content Pick is editorial guidance only/)).toBeVisible();

    const prepareResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/prepared-actions') &&
        response.request().method() === 'POST' &&
        !response.url().endsWith('/confirm')
    );
    await page.getByRole('button', { name: 'Prepare content action' }).click();
    expect((await prepareResponse).status()).toBe(201);

    await expect(page.getByText('Confirmation effect', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Create one Lite Content Opportunity from this exact Recommendation/)
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm and hand off' })).toBeEnabled();
    await expect(page).toHaveURL(/todayRecommendationId=today-recommendation_/);
    await expect(page).toHaveURL(/preparedActionId=prepared-action_/);

    const confirmResponse = page.waitForResponse(
      (response) => response.url().endsWith('/confirm') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Confirm and hand off' }).click();
    expect((await confirmResponse).status()).toBe(200);

    await expect(page.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(page.getByText(/content-opportunity_/)).toBeVisible();
    await expect(page.getByText(/No automatic publication, customer outreach/)).toBeVisible();
    await expect(page.getByText('CONTENT KIT', { exact: true })).toBeVisible();
    await expect(page.getByText('Native variants', { exact: true })).toBeVisible();
    const nativeVariants = page.locator('.daily-variant-list > li');
    const nativeVariantCount = await nativeVariants.count();
    expect(nativeVariantCount).toBeGreaterThan(0);
    for (let index = 0; index < nativeVariantCount; index += 1) {
      await expect(
        nativeVariants
          .nth(index)
          .getByText('Human review required · external publish executed: No', { exact: true })
      ).toBeVisible();
    }

    const durableUrl = page.url();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Good morning', exact: true })).toBeVisible();
    await expect(page.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await expect(page.getByText('CONTENT KIT', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(durableUrl);

    const direct = await page.context().newPage();
    await direct.goto(durableUrl);
    await expect(direct.getByRole('heading', { name: 'Good morning', exact: true })).toBeVisible();
    await expect(direct.getByText('Owner handoff completed', { exact: true })).toBeVisible();
    await direct.close();

    expect(productLoopRequests.some((url) => url.includes('/api/lite/today'))).toBe(true);
    expect(productLoopRequests.some((url) => url.includes('/api/lite/daily-orbit'))).toBe(true);
    expect(productLoopRequests.some((url) => url.includes('/api/lite/content-kits/'))).toBe(true);
    expect(productLoopRequests.some((url) => url.includes('/prepared-actions'))).toBe(true);

    if (test.info().project.name.includes('mobile')) {
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
});
