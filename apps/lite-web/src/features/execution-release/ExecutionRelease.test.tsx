/* eslint-disable @typescript-eslint/unbound-method -- mock client methods are Vitest spies asserted independently of receiver binding. */
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionRelease, FilingExecutionTaskDraft } from '@markorbit/contracts';
import { ExecutionHttpError, type LiteExecutionClient } from '../../api/execution.js';
import { ExecutionReleaseView } from './ExecutionRelease.js';

afterEach(cleanup);

const workspaceId = 'workspace-695';
const at = '2026-09-04T12:00:00.000Z';
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
  executionReleaseId: 'execution-release_web695',
  filingAuthorizationId: 'filing-authorization_web695',
  filingAuthorizationVersion: 2,
  preparationLockId: 'preparation-lock_web695',
  preparationLockVersion: '2:3:locked',
  professionalReviewCaseId: 'professional-review_web695',
  professionalReviewVersion: 'review-v1',
  customerId: 'customer_web695',
  jurisdiction: 'GB',
  requestedExecutionChannel: 'OFFICE_PORTAL',
  checks: [
    {
      code: 'COMMERCIAL_SCOPE_UNCHANGED',
      status: 'UNKNOWN',
      blocking: true,
      explanation: 'Evidence required.',
      source: 'durable-owner',
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
  filingExecutionTaskDraftId: 'filing-task-draft_web695',
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
  internalAssigneeReference: 'authenticated-user-695',
  status: 'PREPARED',
  createdAt: at
} satisfies FilingExecutionTaskDraft;

function client(options: { assignmentError?: ExecutionHttpError } = {}) {
  const ready = {
    ...release,
    version: 2,
    status: 'READY_FOR_RELEASE',
    checks: release.checks.map((check) => ({ ...check, status: 'PASS' }))
  } as ExecutionRelease;
  const assigned = {
    ...ready,
    version: 3,
    assignment: { internalExecutorId: 'authenticated-user-695', assignedAt: at }
  } as ExecutionRelease;
  const released = {
    ...assigned,
    version: 4,
    status: 'RELEASED_FOR_EXECUTION'
  } as ExecutionRelease;
  let current: ExecutionRelease = release;

  return {
    listReleases: vi.fn().mockImplementation(() =>
      Promise.resolve({ executionReleases: [release], consequences })
    ),
    getRelease: vi.fn().mockImplementation(() =>
      Promise.resolve({ executionRelease: current, consequences })
    ),
    evaluateRelease: vi.fn().mockImplementation(() => {
      current = ready;
      return Promise.resolve({ executionRelease: ready, consequences });
    }),
    updateAssignment: vi.fn().mockImplementation(() => {
      if (options.assignmentError) {
        current = { ...ready, version: 8 } as ExecutionRelease;
        return Promise.reject(options.assignmentError);
      }
      current = assigned;
      return Promise.resolve({ executionRelease: assigned, consequences });
    }),
    release: vi.fn().mockImplementation(() => {
      current = released;
      return Promise.resolve({
        releaseResult: { release: released, taskDraft: task },
        consequences
      });
    }),
    getTaskDraftForRelease: vi.fn().mockImplementation(() =>
      Promise.resolve({ filingExecutionTaskDraft: task, consequences })
    )
  } as unknown as LiteExecutionClient;
}

describe('authenticated Workspace Execution Release', () => {
  it('loads the durable queue under the current authenticated Workspace', async () => {
    render(<ExecutionReleaseView workspaceId={workspaceId} client={client()} />);
    await screen.findByText(release.executionReleaseId);
    expect(screen.getByText('Authenticated Workspace')).toBeVisible();
    expect(screen.getByText(/Workspace workspace-695/)).toBeVisible();
    expect(screen.getByLabelText('Status')).toBeEnabled();
    expect(screen.getByLabelText('Jurisdiction')).toBeEnabled();
    expect(screen.getByLabelText('Execution channel')).toBeEnabled();
  });

  it('fails closed before any Execution request when Workspace context is absent', async () => {
    const gateway = client();
    render(<ExecutionReleaseView client={gateway} />);
    expect(await screen.findByText('Execution Release could not continue')).toBeVisible();
    expect(screen.getByText(/valid Workspace context is required/)).toBeVisible();
    expect(gateway.listReleases).not.toHaveBeenCalled();
  });

  it('opens detail, exposes blocking UNKNOWN, and restores focus and filters on back', async () => {
    const user = userEvent.setup();
    render(<ExecutionReleaseView workspaceId={workspaceId} client={client()} />);
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

  it('uses exact current version for Assign to me and reloads durable truth after every write', async () => {
    const gateway = client();
    const user = userEvent.setup();
    render(<ExecutionReleaseView workspaceId={workspaceId} client={gateway} />);
    await user.click(await screen.findByRole('button', { name: 'Open release' }));

    await user.click(screen.getByRole('button', { name: 'Evaluate release' }));
    expect(gateway.evaluateRelease).toHaveBeenCalledWith(release.executionReleaseId);
    expect(await screen.findByText('2')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Assign to me' }));
    expect(gateway.updateAssignment).toHaveBeenCalledWith(release.executionReleaseId, {
      expectedVersion: 2
    });
    expect(gateway.getRelease).toHaveBeenCalledTimes(3);
    expect(screen.getByText('authenticated-user-695')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Release for execution' })).toBeDisabled();

    await user.type(
      screen.getByLabelText('Internal release rationale'),
      'All governed evidence passed.'
    );
    expect(screen.getByRole('button', { name: 'Release for execution' })).toBeEnabled();
  });

  it('releases without reviewer identity and reloads release plus durable task receipt', async () => {
    const gateway = client();
    const user = userEvent.setup();
    render(<ExecutionReleaseView workspaceId={workspaceId} client={gateway} />);
    await user.click(await screen.findByRole('button', { name: 'Open release' }));
    await user.click(screen.getByRole('button', { name: 'Evaluate release' }));
    await user.click(screen.getByRole('button', { name: 'Assign to me' }));
    await user.type(screen.getByLabelText('Internal release rationale'), 'All checks passed.');
    await user.click(screen.getByRole('button', { name: 'Release for execution' }));

    expect(await screen.findByText('Released for execution — no external filing performed')).toBeVisible();
    expect(screen.getByText('Filing Execution Task Draft')).toBeVisible();
    expect(screen.getByText(task.filingExecutionTaskDraftId)).toBeVisible();
    expect(screen.getAllByText('false')).toHaveLength(13);
    expect(gateway.release).toHaveBeenCalledWith(release.executionReleaseId, {
      rationale: 'All checks passed.',
      idempotencyKey: `release:${release.executionReleaseId}`
    });
    expect(gateway.getTaskDraftForRelease).toHaveBeenCalledWith(release.executionReleaseId);
  });

  it('preserves stale 409, reloads current durable version and blocks another protected action', async () => {
    const gateway = client({
      assignmentError: new ExecutionHttpError(
        409,
        'STALE_EXECUTION_RELEASE',
        'Execution Release changed.'
      )
    });
    const user = userEvent.setup();
    render(<ExecutionReleaseView workspaceId={workspaceId} client={gateway} />);
    await user.click(await screen.findByRole('button', { name: 'Open release' }));
    await user.click(screen.getByRole('button', { name: 'Evaluate release' }));
    await user.click(screen.getByRole('button', { name: 'Assign to me' }));

    expect(await screen.findByText('Execution Release changed')).toBeVisible();
    expect(screen.getByText(/Current durable Workspace truth was reloaded/)).toBeVisible();
    expect(screen.getByText('8')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Evaluate release' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Assign to me' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Release for execution' })).toBeDisabled();
  });

  it('shows authenticated permission failure without falling back to fixture releases', async () => {
    const gateway = client();
    gateway.listReleases = vi.fn().mockRejectedValue(
      new ExecutionHttpError(403, 'PERMISSION_DENIED', 'execution:read permission is required.')
    );
    render(<ExecutionReleaseView workspaceId={workspaceId} client={gateway} />);

    expect(await screen.findByText('Execution Release could not continue')).toBeVisible();
    expect(screen.getByText(/403 PERMISSION_DENIED/)).toBeVisible();
    expect(screen.queryByText(release.executionReleaseId)).not.toBeInTheDocument();
  });
});
