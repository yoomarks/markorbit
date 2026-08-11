import { expect, test } from '@playwright/test';
import type { ProfessionalReviewCase } from '@markorbit/contracts';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';

test('Lite shell provides its fixed semantic navigation and responsive fixture workspace @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(urls.lite + '#work-customers');
  await expect(page.getByRole('heading', { level: 1, name: 'Customers' })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Primary' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link')).toHaveText([
    'Today',
    'Matters',
    'Content',
    'Opportunities',
    'Trademarks',
    'Work',
    'Capability',
    'Guide'
  ]);
  await expect(page.getByRole('alert')).toContainText('Demonstration only');
  await expectNoHorizontalOverflow(page);
  await expectVisibleFocus(page);
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  await capture(page, `lite-today-${viewport}`);
  assertHealthy();
});

test('Lite filters survive customer detail and suggested actions do not execute', async ({
  page
}) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.lite}#work-customers`);
  await page.getByLabel('Search customers').fill('Northwind');
  await page.getByLabel('Customer status').selectOption('Active');
  await page.getByLabel('Country / region').selectOption('US');
  await page.getByRole('button', { name: 'View customer details' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Northwind Outdoor' })).toBeVisible();
  await expect(page.getByText('Customer Record ≠ Verified Legal Identity')).toBeVisible();
  await page.getByRole('button', { name: 'Back to customers' }).click();
  await expect(page.getByRole('button', { name: 'View customer details' })).toBeFocused();
  await expect(page.getByLabel('Search customers')).toHaveValue('Northwind');
  await expect(page.getByLabel('Customer status')).toHaveValue('Active');

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Opportunities' })
    .click();
  await page.getByLabel('Opportunity status').selectOption('REVIEWING');
  await page.getByRole('button', { name: 'View opportunity details' }).click();
  await expect(page.getByText('Opportunity ≠ Confirmed Demand')).toBeVisible();
  await page.getByRole('button', { name: 'Mark suggestion as reviewed' }).click();
  const reviewAcknowledgement = page
    .getByRole('status')
    .filter({ hasText: 'Review acknowledgement saved' });
  await expect(reviewAcknowledgement).toContainText('No contact, order, appointment, filing');
  await page.getByRole('button', { name: 'Back to opportunities' }).click();
  await expect(page.getByRole('button', { name: 'View opportunity details' })).toBeFocused();
  await expect(page.getByLabel('Opportunity status')).toHaveValue('REVIEWING');
  const reviewingStatus = page.locator('strong').filter({ hasText: /^REVIEWING$/ });
  await expect(reviewingStatus).toHaveCount(1);
  await expect(reviewingStatus).toBeVisible();
  assertHealthy();
});

test('Lite governed professional review preserves filters, focus, and authority boundaries @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  const at = '2026-07-28T15:40:00.000Z';
  let review: ProfessionalReviewCase = {
    schemaVersion: 1,
    reviewCaseId: 'professional-review_visual',
    source: {
      schemaVersion: 1,
      matterDraftId: 'matter-draft_visual',
      matterDraftVersion: at,
      confirmationId: 'confirmation_visual',
      customerId: 'customer_visual',
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      preparation: {
        classes: [9],
        documentReferences: [],
        trademark: 'VISUAL MARK',
        targetJurisdiction: 'EU',
        goodsServices: 'Visual fixture goods'
      },
      readiness: { evaluatedAt: at, readyForProfessionalReview: true, checks: [] },
      readinessTimestamp: at
    },
    status: 'REVIEWED_READY_FOR_NEXT_STEP',
    priority: 'NORMAL',
    requestedBy: 'actor_visual',
    createdAt: at,
    updatedAt: at,
    assignment: {
      status: 'CLAIMED',
      claimedBy: 'reviewer_milestone',
      claimedAt: at,
      assignedReviewerId: 'reviewer_milestone',
      assignedAt: at,
      professionalAppointed: false
    },
    checklist: [
      {
        code: 'SOURCE_MATTER_DRAFT_CURRENT',
        status: 'PASS',
        blocking: true,
        explanation: 'Review required.'
      }
    ],
    evidence: [],
    decision: {
      code: 'MARK_READY_FOR_NEXT_STEP',
      reviewerId: 'reviewer_milestone',
      decidedAt: at,
      rationale: 'Visual evidence reviewed.',
      checklistSnapshot: [],
      evidenceReferences: [],
      sourceMatterDraftVersion: at,
      consequences: {
        orderCreated: false,
        paymentCreated: false,
        formalMatterCreated: false,
        providerAppointed: false,
        filingCreated: false,
        customerMessageSent: false
      }
    }
  };
  await page.route('**/api/lite/professional-review-cases**', async (route) => {
    const url = route.request().url();
    const path = new URL(url).pathname;
    if (path.endsWith('/claim'))
      review = {
        ...review,
        status: 'IN_REVIEW',
        assignment: {
          status: 'CLAIMED',
          claimedBy: 'reviewer_milestone',
          claimedAt: at,
          assignedReviewerId: 'reviewer_milestone',
          assignedAt: at,
          professionalAppointed: false
        }
      };
    else if (path.endsWith('/checklist'))
      review = {
        ...review,
        checklist: review.checklist.map((item) => ({ ...item, status: 'PASS' }))
      };
    else if (path.endsWith('/complete'))
      review = {
        ...review,
        status: 'REVIEWED_READY_FOR_NEXT_STEP',
        decision: {
          code: 'MARK_READY_FOR_NEXT_STEP',
          reviewerId: 'reviewer_milestone',
          decidedAt: at,
          rationale: 'Visual evidence reviewed.',
          checklistSnapshot: review.checklist,
          evidenceReferences: [],
          sourceMatterDraftVersion: at,
          consequences: {
            orderCreated: false,
            paymentCreated: false,
            formalMatterCreated: false,
            providerAppointed: false,
            filingCreated: false,
            customerMessageSent: false
          }
        }
      };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        path.endsWith('professional-review-cases')
          ? { reviewCases: [review] }
          : { reviewCase: review }
      )
    });
  });
  await page.goto(`${urls.lite}#work-professional-review`);
  await page.getByLabel('Status').selectOption('REVIEWED_READY_FOR_NEXT_STEP');
  await page.getByRole('button', { name: 'Open professional review' }).click();
  await expect(page.getByRole('heading', { name: 'Exact Matter Draft snapshot' })).toBeVisible();
  await expect(page.getByText('2026-07-28T15:40:00.000Z', { exact: true })).toBeVisible();
  await expect(page.getByText(/orderCreated: false/)).toContainText('filingCreated: false');
  await expectNoHorizontalOverflow(page);
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  await capture(page, `lite-professional-review-${viewport}`);
  await page.getByRole('button', { name: 'Back to review queue' }).click();
  await expect(page.getByRole('button', { name: 'Open professional review' })).toBeFocused();
  await expect(page.getByLabel('Status')).toHaveValue('REVIEWED_READY_FOR_NEXT_STEP');
  assertHealthy();
});
