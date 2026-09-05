import { expect, test, type Page } from '@playwright/test';
import { milestoneAuth, milestoneUrls } from '../../scripts/milestone-runtime.mjs';
import {
  serializeMarkregRoute,
  type MarkregRoute
} from '../../apps/markreg-web/src/routing/markreg-route.js';
import { serializeLiteRoute, type LiteRoute } from '../../apps/lite-web/src/routing/lite-route.js';
import { MilestoneLineageRecorder } from './lineage-recorder.js';
import {
  assertScenarioSnapshotEqual,
  fetchScenarioSnapshot
} from './milestone-scenario-snapshot.js';

const id = async (page: Page, expression: RegExp) => {
  const match = (await page.locator('body').innerText()).match(expression);
  expect(match?.[1]).toBeTruthy();
  return match![1]!;
};
const checkpoint = async (
  page: Page,
  scenario: string,
  app: 'markreg' | 'lite',
  route: MarkregRoute | LiteRoute,
  expectedStatus: string
) =>
  test.step(`Deep-link reload checkpoints / ${route.view}`, async () => {
    const before = await fetchScenarioSnapshot(scenario);
    const direct = await page.context().newPage();
    const requests: { method: string; url: string }[] = [];
    direct.on('request', (request) => {
      if (request.url().startsWith(milestoneUrls.gateway))
        requests.push({ method: request.method(), url: request.url() });
    });
    const routeQuery =
      app === 'markreg'
        ? serializeMarkregRoute(route as MarkregRoute)
        : serializeLiteRoute(route as LiteRoute);
    const query =
      app === 'lite' && (route.view === 'execution-release' || route.view === 'filing-task-draft')
        ? `${routeQuery}&workspaceId=${encodeURIComponent(milestoneAuth.workspaceId)}`
        : routeQuery;
    const base = app === 'markreg' ? milestoneUrls.markregWeb : milestoneUrls.liteWeb;
    await direct.goto(`${base}/${query}`);
    await expect(direct).toHaveURL(`${base}/${query}`);
    await expect(direct.getByText(route.recordId)).toBeVisible();
    await expect(direct.getByText(route.expectedVersion, { exact: true }).first()).toBeVisible();
    await expect(direct.getByText(expectedStatus, { exact: true })).toBeVisible();
    await direct.reload();
    await expect(direct).toHaveURL(`${base}/${query}`);
    await expect(direct.getByText(route.recordId)).toBeVisible();
    await expect(direct.getByText(route.expectedVersion, { exact: true }).first()).toBeVisible();
    const mutations = requests.filter(({ method }) => !['GET', 'HEAD'].includes(method));
    expect(mutations, `Unexpected checkpoint mutations: ${JSON.stringify(mutations)}`).toEqual([]);
    expect(requests.length).toBeGreaterThanOrEqual(2);
    const after = await fetchScenarioSnapshot(scenario);
    assertScenarioSnapshotEqual(before, after);
    await direct.close();
  });

test.describe('Milestone 001 real runtime golden path', () => {
  test('completes exact governed lineage through both real Web applications @real-runtime', async ({
    page
  }) => {
    const lineage = new MilestoneLineageRecorder();
    const scenario = test.info().project.name.includes('mobile')
      ? 'milestone-001-mobile'
      : 'milestone-001-desktop';
    const fill = async (label: string, value: string) => page.getByLabel(label).fill(value);
    await test.step('Consultation / Plan / Quote', async () => {
      await page.goto(`${milestoneUrls.markregWeb}/?scenario=${scenario}`);
      const workspaceResponse = await page.request.get(`${milestoneUrls.gateway}/api/workspaces`);
      expect(workspaceResponse.status()).toBe(200);
      const { workspaces } = await workspaceResponse.json();
      const entry = workspaces.find(
        (value: { workspace: { workspaceId: string } }) =>
          value.workspace.workspaceId === milestoneAuth.workspaceId
      );
      expect(entry).toBeDefined();
      // Restore the authenticated account entry's selection for the bounded fixture entry.
      // This is request context; Gateway and owners still derive and validate authority.
      await page.evaluate((workspaceId: string) => {
        sessionStorage.setItem('markorbit-workspace-id', workspaceId);
      }, entry.workspace.workspaceId);
      await page.getByRole('button', { name: 'Start consultation' }).click();
      await page.getByLabel('Applicant type').selectOption({ label: 'Company' });
      await page
        .getByLabel('Applicant name')
        .fill(`${scenario} Applicant With A Deliberately Long Legal Name Limited`);
      await page.getByLabel('Applicant country').selectOption('GB');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByLabel('Trademark type').selectOption({ label: 'Word mark' });
      await page.getByLabel('Trademark text').fill('MARKORBIT GOLDEN PATH');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByLabel('Target countries (select one or more)').selectOption(['US', 'GB']);
      await page.getByRole('button', { name: 'Continue' }).click();
      await page
        .getByLabel('Goods / services summary')
        .fill(
          'Long fixture-backed goods and services description for deterministic browser wrapping and runtime-boundary validation.'
        );
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByLabel('Business context').fill('Milestone 001 fixture-only validation.');
      await page
        .getByLabel('Filing goal')
        .fill('Prepare only; do not submit or contact an office.');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Submit intake' }).click();
      await expect(
        page.getByRole('heading', { name: 'Compare your protection options' })
      ).toBeVisible();
      const recommendation = await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem('markreg-recommendation-v1') ?? 'null')
      );
      lineage.recordIdentity('customer', 'customer_markreg');
      lineage.recordIdentity('opportunity', recommendation.intake.intakeId);
      await page.getByRole('button', { name: /request quote/i }).click();
      await expect(page.getByRole('heading', { name: 'Review your fixture quote' })).toBeVisible();
      const quote = await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem('markreg-quote-v1') ?? 'null')
      );
      lineage.record('plan', { id: quote.planSelection.planSelectionId, version: 'plan-v1' });
      lineage.record('quote', { id: quote.quote.quoteId, version: quote.quote.pricingRuleVersion });
      await page.reload();
      await expect(page.getByText(lineage.require('quote').id)).toBeVisible();
    });
    await test.step('Confirmation / Matter Draft', async () => {
      const confirmationChecks = page
        .getByRole('group', { name: 'Required acknowledgements' })
        .getByRole('checkbox');
      await expect(confirmationChecks).toHaveCount(4);
      for (let index = 0; index < 4; index++) {
        await expect(confirmationChecks.nth(index)).not.toBeChecked();
        await confirmationChecks.nth(index).click();
      }
      await page.getByRole('button', { name: 'Confirm selected Quote' }).click();
      await expect(page.getByRole('heading', { name: 'Confirmation receipt' })).toBeVisible();
      const confirmationId = await id(page, /Confirmation ID\s+(confirmation_[\w-]+)/);
      lineage.recordIdentity('customerConfirmation', confirmationId);
      await page.getByRole('button', { name: 'Prepare Matter Draft' }).click();
      await expect(page.getByText(/UNKNOWN/).first()).toBeVisible();
      const matterId = await id(page, /Matter Draft ID\s+(matter-draft_[\w-]+)/);
      await fill(
        'Applicant / Owner',
        `${scenario} Applicant With A Deliberately Long Legal Name Limited`
      );
      await fill('Applicant address', '1 Governed Lineage Way, London');
      await fill('Trademark representation', 'MARKORBIT GOLDEN PATH');
      await page.getByLabel('Target jurisdiction').selectOption('GB');
      await fill('Classes', '9, 35');
      await fill(
        'Goods / services',
        'Extremely long goods and services text that wraps without overflow on the 390px governed preparation workspace.'
      );
      await fill('Filing basis', 'INTENT_TO_USE');
      await page.getByLabel('Representative requirement').selectOption('false');
      await fill('Required documents', 'identity.pdf, mark-representation.pdf');
      await page.getByLabel('Commercial scope remains unchanged').click();
      await page.getByRole('button', { name: 'Prepare for professional review' }).click();
      await expect(page.getByText('READY_FOR_PROFESSIONAL_REVIEW')).toBeVisible();
      const matterVersion = await id(page, /Matter Draft version\s+(\S+)/);
      lineage.record('matterDraft', { id: matterId, version: matterVersion });
      await checkpoint(
        page,
        scenario,
        'markreg',
        { view: 'matter-draft', recordId: matterId, expectedVersion: matterVersion },
        'READY_FOR_PROFESSIONAL_REVIEW'
      );
      const formalMatterResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/markreg/formal-matters') &&
          response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Create Formal Matter', exact: true }).click();
      const formalMatterResult = await formalMatterResponse;
      expect(formalMatterResult.status()).toBe(200);
      const { formalMatter } = await formalMatterResult.json();
      expect(formalMatter.sourceMatterDraftId).toBe(matterId);
      expect(String(formalMatter.sourceMatterDraftVersion)).toBe(matterVersion);
      await expect(page.getByRole('heading', { name: 'Formal Matter receipt' })).toBeVisible();
      await page.goto(`${milestoneUrls.liteWeb}/?workspaceId=${milestoneAuth.workspaceId}#matters`);
      await page.locator(`button[data-matter-id="${formalMatter.formalMatterId}"]`).click();
      const reviewResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/lite/professional-review-cases') &&
          response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Start or Resume Professional Review' }).click();
      const reviewResult = await reviewResponse;
      expect(reviewResult.status()).toBe(200);
      expect((await reviewResult.json()).reviewCase).toMatchObject({
        formalMatterId: formalMatter.formalMatterId,
        sourceFormalMatterVersion: formalMatter.version,
        sourceSnapshotSha256: formalMatter.snapshotSha256
      });
    });
    await test.step('Professional Review', async () => {
      await expect(page.getByRole('button', { name: 'Claim review' })).toBeVisible();
      const reviewId = await id(page, /Professional Review Case (professional-review_[\w-]+)/);
      await expect(page.getByText(lineage.require('matterDraft').id)).toBeVisible();
      await expect(
        page
          .locator('dt', { hasText: /^Matter Draft version$/ })
          .locator('xpath=following-sibling::dd[1]')
      ).toHaveText(String(lineage.require('matterDraft').version));
      const initialReviewVersion = await id(page, /Review version\s+(\d+)/);
      const claimResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/lite/professional-review-cases/${reviewId}/claim`) &&
          response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Claim review' }).click();
      expect((await claimResponse).status()).toBe(200);
      await page
        .getByLabel('Professional finding')
        .fill('Exact source identity, scope, jurisdiction, and goods evidence reviewed.');
      await expect(page.getByRole('button', { name: 'Save Review Draft' })).toBeVisible();
      await expect(page.getByText('Review version', { exact: true })).toBeVisible();
      expect(await id(page, /Review version\s+(\d+)/)).not.toBe(initialReviewVersion);
      const saveResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/lite/professional-review-cases/${reviewId}/checklist`) &&
          response.request().method() === 'PATCH'
      );
      await page.getByRole('button', { name: 'Save Review Draft' }).click();
      expect((await saveResponse).status()).toBe(200);
      await expect(page.getByLabel('Review decision rationale')).toBeVisible();
      const savedReviewVersion = await id(page, /Review version\s+(\d+)/);
      await fill(
        'Review decision rationale',
        'Exact immutable Matter Draft evidence supports the next governed preparation step.'
      );
      const completionResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/lite/professional-review-cases/${reviewId}/complete`) &&
          response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Mark reviewed and ready for next step' }).click();
      expect((await completionResponse).status()).toBe(200);
      await expect(page.getByText('REVIEWED_READY_FOR_NEXT_STEP')).toBeVisible();
      await expect(
        page.getByText('Ready for next step — no action executed', { exact: true })
      ).toBeVisible();
      expect(await id(page, /Review version\s+(\d+)/)).not.toBe(savedReviewVersion);
      const reviewVersion = await id(page, /Review decision version: (\S+)/);
      lineage.record('professionalReviewCase', { id: reviewId, version: reviewVersion });
      lineage.record('reviewDecision', { id: reviewId, version: reviewVersion });
      await checkpoint(
        page,
        scenario,
        'lite',
        {
          section: 'work',
          view: 'professional-review',
          recordId: reviewId,
          expectedVersion: reviewVersion
        },
        'REVIEWED_READY_FOR_NEXT_STEP'
      );
      await page
        .getByRole('link', { name: 'Return to MarkReg Documents and Instructions' })
        .click();
      await expect(
        page.getByRole('heading', { name: 'Professional Review complete' })
      ).toBeVisible();
      await page.getByRole('button', { name: 'Open Documents and Instructions' }).click();
      await expect(page.getByRole('heading', { name: 'Documents and Instructions' })).toBeVisible();
    });
    await test.step('Documents / Durable Preparation Lock', async () => {
      const packageCreateResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/markreg/document-packages') &&
          response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Create durable Document Package' }).click();
      const packageCreateResult = await packageCreateResponse;
      expect(packageCreateResult.status()).toBe(200);
      const initialPackage = (await packageCreateResult.json()) as {
        documentPackageId: string;
        version: number;
        requirements: { requirementKey: string; displayName: string; blocking: boolean }[];
      };
      const packageId = initialPackage.documentPackageId;
      let packageVersion = initialPackage.version;
      const blockingRequirements = initialPackage.requirements.filter(
        (requirement) => requirement.blocking
      );
      lineage.record('documentPackage', { id: packageId, version: packageVersion });
      await expect(page.getByText(packageId)).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Create Document Package', exact: true })
      ).toHaveCount(0);
      expect(blockingRequirements.length).toBeGreaterThan(0);

      for (const [index, requirement] of blockingRequirements.entries()) {
        await page.getByLabel('Requirement').selectOption(requirement.requirementKey);
        await page
          .getByLabel('Evidence display name')
          .fill(`${scenario}-evidence-${index + 1}.pdf`);
        await page.getByLabel('SHA-256 checksum').fill((index + 1).toString(16).padStart(64, '0'));
        const evidenceResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith(`/api/markreg/document-packages/${packageId}/documents`) &&
            response.request().method() === 'POST'
        );
        await page.getByRole('button', { name: 'Record evidence metadata' }).click();
        const evidenceResult = await evidenceResponse;
        expect(evidenceResult.status()).toBe(200);
        const evidencePackage = (await evidenceResult.json()) as { version: number };
        packageVersion = evidencePackage.version;
      }

      const instructionResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/markreg/document-packages/${packageId}/instructions`) &&
          response.request().method() === 'POST'
      );
      await page
        .getByRole('button', { name: 'Authorize recorded documents for preparation only' })
        .click();
      const instructionResult = await instructionResponse;
      expect(instructionResult.status()).toBe(200);
      packageVersion = ((await instructionResult.json()) as { version: number }).version;

      const readyResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/markreg/document-packages/${packageId}/mark-ready`) &&
          response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Mark package ready for Preparation Lock' }).click();
      const readyResult = await readyResponse;
      expect(readyResult.status()).toBe(200);
      const readyPackage = (await readyResult.json()) as {
        version: number;
        canonicalEvidenceHash?: string;
        status: string;
      };
      packageVersion = readyPackage.version;
      expect(readyPackage.status).toBe('READY_FOR_PREPARATION_LOCK');
      expect(readyPackage.canonicalEvidenceHash).toMatch(/^[a-f0-9]{64}$/);
      lineage.record('documentPackage', { id: packageId, version: packageVersion });

      const lockCreateResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/markreg/preparation-locks') &&
          response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Lock exact package for preparation' }).click();
      const lockCreateResult = await lockCreateResponse;
      expect(lockCreateResult.status()).toBe(200);
      const lock = (await lockCreateResult.json()) as {
        preparationLockId: string;
        version: number;
        source: { documentPackageId: string; documentPackageVersion: number };
      };
      expect(lock.source.documentPackageId).toBe(packageId);
      expect(lock.source.documentPackageVersion).toBe(packageVersion);
      const lockId = lock.preparationLockId;
      const lockVersion = String(lock.version);
      lineage.record('preparationLock', { id: lockId, version: lockVersion });
      await expect(
        page.getByRole('heading', { name: 'Locked for preparation — not submitted' })
      ).toBeVisible();
      await checkpoint(
        page,
        scenario,
        'markreg',
        { view: 'preparation-lock', recordId: lockId, expectedVersion: lockVersion },
        'Durable Preparation Lock'
      );
      await page.getByRole('button', { name: 'Review Filing Authorization' }).click();
    });
    await test.step('Filing Authorization', async () => {
      const authorizationChecks = page.getByRole('checkbox');
      await expect(authorizationChecks).toHaveCount(9);
      const authorizationLabels = [
        'I confirm the applicant or owner information.',
        'I confirm the trademark representation.',
        'I confirm the jurisdiction, classes and goods/services.',
        'I authorize use of the locked document package.',
        'I authorize preparation of the filing instruction.',
        'I understand that authorization does not itself submit an application.',
        'I understand that a professional or representative may still need to accept appointment.',
        'I understand that scope changes require a new review and authorization.',
        'I understand that government-office acceptance is not guaranteed.'
      ];
      const acknowledgementRows = page.locator('.authorization-acknowledgement');
      let previousBottom = 0;
      for (let index = 0; index < authorizationLabels.length; index++) {
        const box = await acknowledgementRows.nth(index).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(previousBottom);
        previousBottom = box!.y + box!.height;
      }
      for (const label of authorizationLabels) {
        const acknowledgement = page.getByLabel(label, { exact: true });
        await expect(acknowledgement).not.toBeChecked();
        await acknowledgement.check();
      }
      await page.getByRole('button', { name: 'Confirm Filing Authorization' }).click();
      await expect(
        page.getByText('Authorized for internal execution review — not submitted')
      ).toBeVisible();
      const authorizationId = await id(
        page,
        /Filing Authorization ID\s+(filing-authorization_[\w-]+)/
      );
      lineage.record('filingAuthorization', { id: authorizationId, version: 2 });
      await checkpoint(
        page,
        scenario,
        'markreg',
        { view: 'filing-authorization', recordId: authorizationId, expectedVersion: '2' },
        'AUTHORIZED'
      );
      await page
        .getByRole('link', { name: 'Open exact authorization in Lite Execution Release' })
        .click();
    });
    await test.step('Execution Release / Task Draft', async () => {
      await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Open release' }).click();
      await expect(page.getByText(/UNKNOWN/).first()).toBeVisible();
      const releaseId = await id(page, /(execution-release_[\w-]+)/);
      lineage.record('executionRelease', { id: releaseId, version: 1 });
      await page.getByRole('button', { name: 'Evaluate release' }).click();
      await expect(page.getByText('READY_FOR_RELEASE', { exact: true }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Assign to me' }).click();
      await fill(
        'Internal release rationale',
        'All exact governed evidence passed internal execution review.'
      );
      const releaseMutation = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/execution/execution-releases/${releaseId}/release`) &&
          response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Release for execution' }).click();
      await expect(
        page.getByText('Released for execution — no external filing performed')
      ).toBeVisible();
      const releaseResponse = await releaseMutation;
      expect(releaseResponse.status()).toBe(200);
      const releasedVersion = String((await releaseResponse.json()).releaseResult.release.version);
      lineage.record('executionRelease', { id: releaseId, version: releasedVersion });
      await checkpoint(
        page,
        scenario,
        'lite',
        {
          section: 'work',
          view: 'execution-release',
          recordId: releaseId,
          expectedVersion: releasedVersion
        },
        'RELEASED_FOR_EXECUTION'
      );
      const taskId = await id(page, /Task Draft ID\s+(filing-task-draft_[\w-]+)/);
      lineage.recordIdentity('filingExecutionTaskDraft', taskId);
      await checkpoint(
        page,
        scenario,
        'lite',
        { section: 'work', view: 'filing-task-draft', recordId: taskId, expectedVersion: '1' },
        'PREPARED'
      );
      await expect(page.getByText('PREPARED')).toBeVisible();
      await expect(page.getByText('false')).toHaveCount(13);
    });
    await test.step('Visual evidence', async () => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        )
      ).toBe(true);
    });
  });
});
