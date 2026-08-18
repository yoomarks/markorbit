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

    const preferenceResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/product-preference-events') &&
        response.request().method() === 'POST'
    );
    await orbitCard.getByRole('button', { name: 'Save', exact: true }).click();
    const preferenceResponse = await preferenceResponsePromise;
    expect(preferenceResponse.status()).toBe(201);
    await expect(orbitCard.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
    const preferenceBody = (await preferenceResponse.json()) as {
      event: {
        kind: string;
        subjectUserId: string;
        externalActionExecutedByMarkOrbit: boolean;
        externalOutcomeVerifiedByMarkOrbit: boolean;
        capabilityVerified: boolean;
      };
      preference: { source: string; capabilityVerified: boolean };
    };
    expect(preferenceBody.event.kind).toBe('SAVED');
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

    const openedResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/product-preference-events') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Selected for Quick Create' }).click();
    const opened = await openedResponse;
    expect(opened.status()).toBe(201);
    const openedBody = (await opened.json()) as {
      event: { kind: string; targetType: string; targetId: string };
    };
    expect(openedBody.event).toMatchObject({
      kind: 'OPENED',
      targetType: 'CONTENT_PICK'
    });
    expect(openedBody.event.targetId).toContain('content-pick_');

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
    const contentKitCard = page.locator('section.mo-card').filter({
      has: page.getByText('CONTENT KIT', { exact: true })
    });
    const nativeVariants = contentKitCard.locator('.daily-variant-list > li');
    const nativeVariantCount = await nativeVariants.count();
    expect(nativeVariantCount).toBeGreaterThan(0);
    for (let index = 0; index < nativeVariantCount; index += 1) {
      await expect(
        nativeVariants
          .nth(index)
          .getByText('Human review required · external publish executed: No', { exact: true })
      ).toBeVisible();
    }

    const firstAngle = contentKitCard.locator('.daily-angle-list > li').first();
    await expect(firstAngle).toBeVisible();
    const angleResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/product-preference-events') &&
        response.request().method() === 'POST'
    );
    await firstAngle.getByRole('button', { name: 'Use this angle', exact: true }).click();
    const angleResponse = await angleResponsePromise;
    expect(angleResponse.status()).toBe(201);
    const angleBody = (await angleResponse.json()) as {
      event: { kind: string; targetType: string };
    };
    expect(angleBody.event).toMatchObject({ kind: 'ANGLE_SELECTED', targetType: 'CONTENT_KIT' });
    await expect(
      firstAngle.getByRole('button', { name: 'Selected angle', exact: true })
    ).toBeDisabled();

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: lite });
    const firstVariant = nativeVariants.first();
    const copyResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/product-preference-events') &&
        response.request().method() === 'POST'
    );
    await firstVariant.getByRole('button', { name: 'Copy', exact: true }).click();
    const copyResponse = await copyResponsePromise;
    expect(copyResponse.status()).toBe(201);
    const copyBody = (await copyResponse.json()) as { event: { kind: string; targetType: string } };
    expect(copyBody.event).toMatchObject({ kind: 'COPIED', targetType: 'PLATFORM_VARIANT' });
    await expect(firstVariant.getByRole('button', { name: 'Copied', exact: true })).toBeDisabled();

    const downloadPromise = page.waitForEvent('download');
    const exportResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/product-preference-events') &&
        response.request().method() === 'POST'
    );
    await firstVariant.getByRole('button', { name: 'Export', exact: true }).click();
    const [download, exportResponse] = await Promise.all([downloadPromise, exportResponsePromise]);
    expect(exportResponse.status()).toBe(201);
    const exportBody = (await exportResponse.json()) as {
      event: { kind: string; targetType: string };
    };
    expect(exportBody.event).toMatchObject({ kind: 'EXPORTED', targetType: 'PLATFORM_VARIANT' });
    expect(download.suggestedFilename()).toMatch(/^markorbit-.*\.txt$/);
    expect(await download.path()).toBeTruthy();
    await expect(firstVariant.getByRole('button', { name: 'Exported', exact: true })).toBeDisabled();

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

    const dismissCard = page.locator('#daily-orbit section.mo-card').filter({
      has: page.getByRole('heading', { name: title, exact: true })
    });
    const dismissResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/lite/product-preference-events') &&
        response.request().method() === 'POST'
    );
    await dismissCard.getByRole('button', { name: 'Dismiss', exact: true }).click();
    const dismissResponse = await dismissResponsePromise;
    expect(dismissResponse.status()).toBe(201);
    const dismissBody = (await dismissResponse.json()) as { event: { kind: string } };
    expect(dismissBody.event.kind).toBe('DISMISSED');
    await expect(dismissCard).toHaveCount(0);

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
