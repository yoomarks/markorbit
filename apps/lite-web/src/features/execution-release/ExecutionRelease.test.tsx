/* eslint-disable @typescript-eslint/unbound-method -- mock client methods are Vitest spies asserted independently of receiver binding. */
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionRelease, FilingExecutionTaskDraft } from '@markorbit/contracts';
import { ExecutionReleaseView } from './ExecutionRelease.js';
import type { LiteExecutionClient } from '../../api/execution.js';
afterEach(cleanup);
const at = '2026-07-29T12:00:00.000Z';
const consequences = {
  orderCreated: false,
  paymentCreated: false,
  invoiceCreated: false,
  formalMatterCreated: false,
  professionalAppointed: false,
  providerAssignedExternally: false,
  filingCreated: false,
  filingSubmitted: false,
  officialApplicationCreated: false,
  officialApplicationNumberReceived: false,
  customerMessageSent: false,
  externalDocumentSent: false,
  trademarkOfficeContacted: false
} as const;
const release = {
  schemaVersion: 1,
  version: 1,
  executionReleaseId: 'execution-release_web012',
  filingAuthorizationId: 'filing-authorization_web012',
  filingAuthorizationVersion: 2,
  preparationLockId: 'preparation-lock_web012',
  preparationLockVersion: '2:3:locked',
  professionalReviewCaseId: 'professional-review_web012',
  professionalReviewVersion: 'review-v1',
  customerId: 'customer_web012',
  jurisdiction: 'GB',
  requestedExecutionChannel: 'OFFICE_PORTAL',
  checks: [
    {
      code: 'COMMERCIAL_SCOPE_UNCHANGED',
      status: 'UNKNOWN',
      blocking: true,
      explanation: 'Evidence required.',
      source: 'fixture',
      checkedAt: at
    }
  ],
  assignment: {},
  evidence: [],
  status: 'BLOCKED',
  createdAt: at,
  updatedAt: at
} satisfies ExecutionRelease;
const task = {
  schemaVersion: 1,
  filingExecutionTaskDraftId: 'filing-task-draft_web012',
  executionReleaseId: release.executionReleaseId,
  filingAuthorizationId: release.filingAuthorizationId,
  preparationLockId: release.preparationLockId,
  executionSnapshot: {} as never,
  jurisdiction: 'GB',
  applicant: 'MarkOrbit Labs Ltd',
  trademark: 'MARKORBIT',
  classes: ['9'],
  goodsServices: [
    'A very long governed goods and services description that must wrap safely on mobile.'
  ],
  filingBasis: 'INTENT_TO_USE',
  documentReferences: [],
  instructionReferences: [],
  representativeRequirement: 'NOT_REQUIRED',
  executionChannel: 'OFFICE_PORTAL',
  internalAssigneeReference: 'executor_fixture',
  status: 'PREPARED',
  createdAt: at
} satisfies FilingExecutionTaskDraft;
function client() {
  const ready = {
    ...release,
    status: 'READY_FOR_RELEASE',
    checks: release.checks.map((x) => ({ ...x, status: 'PASS' }))
  } as ExecutionRelease;
  const assigned = {
    ...ready,
    assignment: { internalExecutorId: 'executor_fixture', assignedAt: at }
  } as ExecutionRelease;
  return {
    listReleases: vi.fn().mockResolvedValue({ executionReleases: [release], consequences }),
    getRelease: vi.fn().mockResolvedValue({ executionRelease: release, consequences }),
    evaluateRelease: vi.fn().mockResolvedValue({ executionRelease: ready, consequences }),
    updateAssignment: vi.fn().mockResolvedValue({ executionRelease: assigned, consequences }),
    release: vi.fn().mockResolvedValue({
      releaseResult: {
        release: { ...assigned, status: 'RELEASED_FOR_EXECUTION' },
        taskDraft: task
      },
      consequences
    })
  } as unknown as LiteExecutionClient;
}
describe('Gateway-backed Execution Release workspace', () => {
  it('loads the queue under Work with usable retained filters', async () => {
    render(<ExecutionReleaseView client={client()} />);
    await screen.findByText(release.executionReleaseId);
    expect(screen.getByLabelText('Status')).toBeEnabled();
    expect(screen.getByLabelText('Jurisdiction')).toBeEnabled();
    expect(screen.getByLabelText('Execution channel')).toBeEnabled();
  });
  it('opens detail, exposes blocking UNKNOWN, and restores focus and filters on back', async () => {
    const user = userEvent.setup();
    render(<ExecutionReleaseView client={client()} />);
    const status = await screen.findByLabelText('Status');
    await user.selectOptions(status, 'BLOCKED');
    const open = screen.getByRole('button', { name: 'Open release' });
    await user.click(open);
    expect(await screen.findByText(/UNKNOWN — Evidence required/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Release for execution' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Back to release queue/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open release' })).toHaveFocus());
    expect(screen.getByLabelText('Status')).toHaveValue('BLOCKED');
  });
  it('persists evaluate and assignment through the Gateway client and requires explicit rationale', async () => {
    const gateway = client();
    const user = userEvent.setup();
    render(<ExecutionReleaseView client={gateway} />);
    await user.click(await screen.findByRole('button', { name: 'Open release' }));
    await user.click(screen.getByRole('button', { name: 'Evaluate release' }));
    expect(gateway.evaluateRelease).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Assign internal executor' }));
    expect(gateway.updateAssignment).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Release for execution' })).toBeDisabled();
    await user.type(
      screen.getByLabelText('Internal release rationale'),
      'All governed evidence passed.'
    );
    expect(screen.getByRole('button', { name: 'Release for execution' })).toBeEnabled();
  });
  it('releases through Gateway and renders one task draft receipt plus all 13 false consequences', async () => {
    const gateway = client();
    const user = userEvent.setup();
    render(<ExecutionReleaseView client={gateway} />);
    await user.click(await screen.findByRole('button', { name: 'Open release' }));
    await user.click(screen.getByRole('button', { name: 'Evaluate release' }));
    await user.click(screen.getByRole('button', { name: 'Assign internal executor' }));
    await user.type(screen.getByLabelText('Internal release rationale'), 'All checks passed.');
    await user.click(screen.getByRole('button', { name: 'Release for execution' }));
    await screen.findByText('Released for execution — no external filing performed');
    expect(screen.getByText('Filing Execution Task Draft')).toBeVisible();
    expect(screen.getByText(task.filingExecutionTaskDraftId)).toBeVisible();
    expect(screen.getAllByText('false')).toHaveLength(13);
    expect(gateway.release).toHaveBeenCalledOnce();
  });
});
