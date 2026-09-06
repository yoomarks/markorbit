import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client.js';
import { MarkregApiError } from './errors.js';
import { createWorkspaceActionClient } from './workspace-action.js';

const authorityConsequences = {
  protectedActionAuthorized: false,
  filingAuthorized: false,
  filingSubmitted: false,
  paymentCreated: false,
  providerContacted: false,
  officeMutationCreated: false,
  officialTruthCreated: false
} as const;

const item = {
  formalMatter: {
    id: 'formal-matter_018f0000-0000-7000-8000-000000000901',
    version: 2,
    trademark: 'ORBIT MARK',
    applicant: 'Example Holdings LLC',
    jurisdiction: 'US'
  },
  currentness: 'CURRENT',
  lifecycle: {
    customerSafeLabel: 'Professional review in progress',
    customerSafeSummary: 'MarkReg is reviewing the current Matter evidence.',
    officialStatusVerified: false
  },
  attentionStatus: 'OPEN',
  recommendedAction: {
    title: 'Review goods description',
    explanation: 'Confirm the customer-supplied goods wording before the next protected step.',
    executionAuthorized: false
  },
  examination: null,
  lastChangedAt: '2026-09-05T12:00:00.000Z',
  officialStatusVerified: false,
  authorityConsequences
};

const response = {
  workspaceActions: {
    schemaVersion: 1,
    workspaceId: '018f0000-0000-7000-8000-000000000999',
    generatedAt: '2026-09-06T00:00:00.000Z',
    limit: 100,
    truncated: false,
    needsAttention: [item],
    waitingOrInProgress: [],
    recentlyChanged: [item],
    officialStatusVerified: false,
    authorityConsequences
  }
};

describe('Workspace Action browser client', () => {
  it('uses exactly one canonical Gateway GET and preserves owner grouping in the Web view', async () => {
    const get = vi.fn(() => Promise.resolve(response));
    const client = createWorkspaceActionClient({ get } as unknown as ApiClient);

    const result = await client.get();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/api/markreg/workspace-actions');
    expect(result.needsAttention).toHaveLength(1);
    expect(result.waitingOrInProgress).toHaveLength(0);
    expect(result.recentlyChanged).toHaveLength(1);
    expect(result.needsAttention[0]).toMatchObject({
      matterId: item.formalMatter.id,
      matterVersion: 2,
      trademark: 'ORBIT MARK',
      currentnessLabel: 'Current owner projection',
      actionTitle: 'Review goods description',
      lifecycleLabel: 'Professional review in progress',
      lastChangedAt: '2026-09-05T12:00:00.000Z'
    });
  });

  it('fails closed when the response crosses an authority boundary', async () => {
    const invalid = {
      workspaceActions: {
        ...response.workspaceActions,
        officialStatusVerified: true
      }
    };
    const client = createWorkspaceActionClient({
      get: vi.fn(() => Promise.resolve(invalid))
    } as unknown as ApiClient);

    await expect(client.get()).rejects.toMatchObject({
      code: 'WORKSPACE_ACTION_PROJECTION_INVALID',
      status: 503,
      kind: 'recoverable'
    });
  });

  it('fails closed when successful JSON does not contain the owner projection envelope', async () => {
    const client = createWorkspaceActionClient({
      get: vi.fn(() => Promise.resolve({ workspaceActions: null }))
    } as unknown as ApiClient);

    await expect(client.get()).rejects.toBeInstanceOf(MarkregApiError);
  });
});
