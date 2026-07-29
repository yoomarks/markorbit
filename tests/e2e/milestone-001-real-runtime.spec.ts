import { expect, test, type Page } from '@playwright/test';
import { milestoneUrls } from '../../scripts/milestone-runtime.mjs';
import {
  serializeMarkregRoute,
  type MarkregRoute
} from '../../apps/markreg-web/src/routing/markreg-route.js';
import { serializeLiteRoute, type LiteRoute } from '../../apps/lite-web/src/routing/lite-route.js';
import { MilestoneLineageRecorder } from './lineage-recorder.js';

const id = async (page: Page, expression: RegExp) => {
  const match = (await page.locator('body').innerText()).match(expression);
  expect(match?.[1]).toBeTruthy();
  return match![1]!;
};
const checkpoint = async (
  page: Page,
  app: 'markreg' | 'lite',
  route: MarkregRoute | LiteRoute,
  expectedStatus: string
) =>
  test.step(`Deep-link reload checkpoints / ${route.view}`, async () => {
    const direct = await page.context().newPage();
    const methods: string[] = [];
    direct.on('request', (request) => {
      if (request.url().startsWith(milestoneUrls.gateway)) methods.push(request.method());
    });
    const query =
      app === 'markreg'
        ? serializeMarkregRoute(route as MarkregRoute)
        : serializeLiteRoute(route as LiteRoute);
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
    expect(methods.length).toBeGreaterThanOrEqual(2);
    expect(methods.every((method) => method === 'GET')).toBe(true);
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
        'markreg',
        { view: 'matter-draft', recordId: matterId, expectedVersion: matterVersion },
        'READY_FOR_PROFESSIONAL_REVIEW'
      );
      await page.getByRole('button', { name: 'Send to Professional Review' }).click();
      await page.getByRole('link', { name: 'Open exact Professional Review in Lite' }).click();
    });
    await test.step('Professional Review', async () => {
      await expect(page.getByRole('button', { name: 'Claim review' })).toBeVisible();
      const reviewId = await id(page, /Professional Review Case (professional-review_[\w-]+)/);
      await expect(page.getByText(lineage.require('matterDraft').id)).toBeVisible();
      await expect(page.getByText(String(lineage.require('matterDraft').version))).toBeVisible();
      await page.getByRole('button', { name: 'Claim review' }).click();
      await page.getByRole('button', { name: 'Complete review checklist' }).click();
      await fill(
        'Review decision rationale',
        'Exact immutable Matter Draft evidence supports the next governed preparation step.'
      );
      await page.getByRole('button', { name: 'Mark reviewed and ready for next step' }).click();
      await expect(page.getByText('REVIEWED_READY_FOR_NEXT_STEP')).toBeVisible();
      const reviewVersion = await id(page, /Review decision version: (\S+)/);
      lineage.record('professionalReviewCase', { id: reviewId, version: reviewVersion });
      lineage.record('reviewDecision', { id: reviewId, version: reviewVersion });
      await checkpoint(
        page,
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
      await page.getByRole('button', { name: 'Open Documents and Instructions' }).click();
    });
    await test.step('Documents / Ledger / Lock', async () => {
      await page.getByRole('button', { name: 'Create Document Package' }).click();
      await expect(
        page.getByRole('button', { name: 'Record fixture document metadata' })
      ).toBeVisible();
      const packageId = await id(page, /(document-package_[\w-]+) · version (\d+)/);
      const packageVersion = await id(page, /document-package_[\w-]+ · version (\d+)/);
      lineage.record('documentPackage', { id: packageId, version: Number(packageVersion) });
      await page.getByRole('button', { name: 'Record fixture document metadata' }).click();
      await page.getByRole('button', { name: 'Evaluate documents' }).click();
      await expect(page.getByText(/UNKNOWN — blocking/).first()).toBeVisible();
      await page.getByRole('button', { name: 'Complete required metadata and reevaluate' }).click();
      await page.getByRole('button', { name: 'Review customer instructions' }).click();
      await expect(
        page.getByRole('group', { name: 'Confirm the exact preparation instructions' })
      ).toBeVisible();
      const ledgerId = await id(page, /(instruction-ledger_[\w-]+) · version (\d+)/);
      const ledgerVersion = await id(page, /instruction-ledger_[\w-]+ · version (\d+)/);
      lineage.record('instructionLedger', { id: ledgerId, version: Number(ledgerVersion) });
      const instructionChecks = page
        .getByRole('group', { name: 'Confirm the exact preparation instructions' })
        .getByRole('checkbox');
      for (let index = 0; index < 6; index++) await instructionChecks.nth(index).click();
      await page.getByRole('button', { name: 'Confirm customer instructions' }).click();
      await page.getByRole('button', { name: 'Lock package for preparation' }).click();
      await expect(
        page.getByRole('heading', { name: 'Locked for preparation — not submitted' })
      ).toBeVisible();
      const lockId = await id(page, /Preparation Lock ID\s+(preparation-lock_[\w-]+)/);
      const lockVersion = `${lineage.require('documentPackage').version}:${lineage.require('instructionLedger').version}`;
      lineage.record('preparationLock', { id: lockId, version: lockVersion });
      await checkpoint(
        page,
        'markreg',
        { view: 'preparation-lock', recordId: lockId, expectedVersion: lockVersion },
        'READY'
      );
      await page.getByRole('button', { name: 'Open Filing Authorization' }).click();
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
        'markreg',
        { view: 'filing-authorization', recordId: authorizationId, expectedVersion: '2' },
        'AUTHORIZED'
      );
      await page
        .getByRole('link', { name: 'Open exact authorization in Lite Execution Release' })
        .click();
    });
    await test.step('Execution Release / Task Draft', async () => {
      await page.getByRole('button', { name: 'Open release' }).click();
      await expect(page.getByText(/UNKNOWN/).first()).toBeVisible();
      const releaseId = await id(page, /(execution-release_[\w-]+)/);
      lineage.record('executionRelease', { id: releaseId, version: 1 });
      await page.getByRole('button', { name: 'Evaluate release' }).click();
      await page.getByRole('button', { name: 'Assign internal executor' }).click();
      await fill(
        'Internal release rationale',
        'All exact governed evidence passed internal execution review.'
      );
      await page.getByRole('button', { name: 'Release for execution' }).click();
      await expect(
        page.getByText('Released for execution — no external filing performed')
      ).toBeVisible();
      const releaseResponse = await page.evaluate(
        async ({ gateway, releaseId }) =>
          (await fetch(`${gateway}/api/execution/execution-releases/${releaseId}`)).json(),
        { gateway: milestoneUrls.gateway, releaseId }
      );
      const releasedVersion = String(releaseResponse.executionRelease.version);
      lineage.record('executionRelease', { id: releaseId, version: releasedVersion });
      await checkpoint(
        page,
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
