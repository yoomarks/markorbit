import { expect, test } from '@playwright/test';

const gateway = 'http://127.0.0.1:4400';
const lite = 'http://127.0.0.1:4481';
const scenarios = {
  'document-package-desktop': {
    fixture: 'task025Desktop',
    workspaceId: '66666666-6666-4666-8666-666666666666',
    otherWorkspaceId: '77777777-7777-4777-8777-777777777777',
    trademark: 'DURABLE ORBIT DESKTOP'
  },
  'document-package-mobile-390': {
    fixture: 'task025Mobile',
    workspaceId: '88888888-8888-4888-8888-888888888888',
    otherWorkspaceId: '99999999-9999-4999-8999-999999999999',
    trademark: 'DURABLE ORBIT MOBILE'
  }
} as const;

test.describe('TASK 025 real durable Document Package path', () => {
  test('persists exact Review evidence through refresh, direct URL and governed completion', async ({
    page
  }) => {
    const scenario = scenarios[test.info().project.name as keyof typeof scenarios];
    const observed: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/professional-review-cases')) observed.push(request.url());
    });
    const auth = await page.request.post(`${gateway}/__test/auth/session`, {
      data: { fixture: scenario.fixture }
    });
    expect(auth.status()).toBe(201);
    const sessionCookie = auth.headers()['set-cookie']?.match(/mo_session=([^;]+)/)?.[1];
    expect(sessionCookie).toBeTruthy();
    await page
      .context()
      .addCookies([{ name: 'mo_session', value: sessionCookie!, domain: '127.0.0.1', path: '/' }]);
    await page.goto(
      `${lite}/?workspaceId=${scenario.workspaceId}&otherWorkspaceId=${scenario.otherWorkspaceId}#matters`
    );
    await expect(page.getByRole('heading', { name: 'Matters', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'View Matter details' }).click();
    await expect(page.getByRole('heading', { name: scenario.trademark })).toBeVisible();
    const openResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/lite/professional-review-cases') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Start or Resume Professional Review' }).click();
    expect((await openResponse).status()).toBe(200);
    const reviewId = (await page
      .getByText(/^Professional Review Case professional-review_/)
      .textContent())!.replace('Professional Review Case ', '');
    expect(reviewId).toMatch(/^professional-review_/);
    await expect(page.getByText('Review version', { exact: true })).toBeVisible();

    const claimResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/lite/professional-review-cases/${reviewId}/claim`) &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Claim review' }).click();
    const claimed = await claimResponse;
    expect(claimed.status()).toBe(200);
    const claimedReview = (
      (await claimed.json()) as { reviewCase: { status: string; version: number } }
    ).reviewCase;
    expect(claimedReview).toMatchObject({ status: 'IN_REVIEW', version: 2 });
    await page.getByLabel('Professional finding').fill(`Bounded ${scenario.trademark} finding.`);
    await expect(page.getByRole('button', { name: 'Save Review Draft' })).toBeVisible();

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/lite/professional-review-cases/${reviewId}/checklist`) &&
        response.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: 'Save Review Draft' }).click();
    const saved = await saveResponse;
    expect(saved.status()).toBe(200);
    const savedReview = ((await saved.json()) as { reviewCase: { version: number } }).reviewCase;
    expect(savedReview.version).toBe(3);
    await expect(page.getByLabel('Review decision rationale')).toBeVisible();
    const detailUrl = page.url();
    await page.reload();
    await expect(page.getByText(reviewId, { exact: false })).toBeVisible();
    await expect(
      page.locator('dt', { hasText: 'Review version' }).locator('xpath=following-sibling::dd[1]')
    ).toHaveText('3');
    await expect(
      page.getByText(`Bounded ${scenario.trademark} finding.`, { exact: false }).first()
    ).toBeVisible();
    const direct = await page.context().newPage();
    await direct.goto(detailUrl);
    await expect(direct.getByText(reviewId, { exact: false })).toBeVisible();
    await expect(
      direct.locator('dt', { hasText: 'Review version' }).locator('xpath=following-sibling::dd[1]')
    ).toHaveText('3');
    await direct.close();

    await page.getByLabel('Review decision rationale').fill('Ready for the next governed step.');
    const completeResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/lite/professional-review-cases/${reviewId}/complete`) &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Mark reviewed and ready for next step' }).click();
    const completed = await completeResponse;
    expect(completed.status()).toBe(200);
    const completedReview = (
      (await completed.json()) as {
        reviewCase: { reviewCaseId: string; status: string; version: number; decision: unknown };
      }
    ).reviewCase;
    expect(completedReview).toMatchObject({
      reviewCaseId: reviewId,
      status: 'REVIEWED_READY_FOR_NEXT_STEP',
      version: 4,
      decision: expect.any(Object)
    });
    await expect(
      page.getByText('Ready for next step — no action executed', { exact: true })
    ).toBeVisible();
    await expect(page.getByText(/filingCreated: false/)).toBeVisible();
    const completedReviewUrl = page.url();
    const packageTrigger = page.getByRole('link', { name: 'Start or resume Document Package' });
    await packageTrigger.focus();
    await packageTrigger.click();
    const createResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/markreg/document-packages') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Start Package' }).click();
    let packageValue = (await (await createResponse).json()) as {
      documentPackageId: string;
      version: number;
      status: string;
      instructionEntries: Record<string, unknown>[];
    };
    expect(packageValue.status).toBe('DRAFT');
    const packageId = packageValue.documentPackageId;
    const evidenceResponse = page.waitForResponse((r) =>
      r.url().endsWith(`/api/markreg/document-packages/${packageId}/documents`)
    );
    await page.getByRole('button', { name: 'Record evidence' }).click();
    packageValue = await (await evidenceResponse).json();
    const appendResponse = page.waitForResponse((r) =>
      r.url().endsWith(`/api/markreg/document-packages/${packageId}/instructions`)
    );
    await page.getByRole('button', { name: 'Append instruction' }).click();
    packageValue = await (await appendResponse).json();
    const firstEntry = String(packageValue.instructionEntries[0]!.instructionEntryId);
    await page
      .getByLabel('Structured filing instruction')
      .fill(`Replacement ${scenario.trademark}`);
    const supersedeResponse = page.waitForResponse((r) =>
      r.url().includes(`/instructions/${firstEntry}/supersede`)
    );
    await page.getByRole('button', { name: 'Supersede latest instruction' }).click();
    packageValue = await (await supersedeResponse).json();
    expect(packageValue.instructionEntries).toHaveLength(2);
    const packageSaveResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/markreg/document-packages/${packageId}`) &&
        r.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: 'Save Draft' }).click();
    packageValue = await (await packageSaveResponse).json();
    const packageUrl = page.url();
    await page.reload();
    await expect(page.getByText(packageId, { exact: true })).toBeVisible();
    const directPackage = await page.context().newPage();
    await directPackage.goto(packageUrl);
    await expect(directPackage.getByText(packageId, { exact: true })).toBeVisible();
    await directPackage.close();
    const readyResponse = page.waitForResponse((r) =>
      r.url().endsWith(`/api/markreg/document-packages/${packageId}/mark-ready`)
    );
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Mark Ready for Preparation Lock' }).click();
    packageValue = await (await readyResponse).json();
    expect(packageValue.status).toBe('READY_FOR_PREPARATION_LOCK');
    await expect(
      page.getByText('Ready for Preparation Lock', { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText(/does not authorize filing/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Draft' })).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(completedReviewUrl);
    await expect(
      page.getByRole('link', { name: 'Start or resume Document Package' })
    ).toBeFocused();
    await expect(page).not.toHaveURL(/documentPackageId=/);
    await page.goto(packageUrl);
    await expect(page.getByText(packageId, { exact: true })).toBeVisible();
    await page.getByLabel('Workspace').selectOption(scenario.otherWorkspaceId);
    await expect(page).toHaveURL(new RegExp(`workspaceId=${scenario.otherWorkspaceId}.*#matters`));
    await expect(page).not.toHaveURL(/documentPackageId=/);
    await expect(page.getByText(packageId, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Matters', exact: true })).toBeVisible();
    const isolatedRead = await page.request.get(
      `${gateway}/api/markreg/document-packages/${packageId}`,
      { headers: { 'x-markorbit-workspace-id': scenario.otherWorkspaceId } }
    );
    expect(isolatedRead.status()).toBe(404);
    if (test.info().project.name.includes('mobile')) {
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
});
