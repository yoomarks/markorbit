// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrademarkServiceWorkPackage } from '@markorbit/contracts/trademark-service-workbench';
import { TrademarkServiceWorkbench } from './TrademarkServiceWorkbench.js';

afterEach(() => cleanup());

const latest: TrademarkServiceWorkPackage = {
  schemaVersion: 1,
  workPackageId: 'trademark-service-work-package_demo',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  version: 3,
  asset: { id: 'trademark-asset_demo', version: 2 },
  intent: {
    kind: 'RENEWAL',
    jurisdiction: 'US',
    title: 'Renewal',
    rationale: 'User-reviewed preparation intent.',
    inferredFromProductContext: false,
    reviewedByUser: true,
    legalConclusionCreated: false,
    serviceAvailabilityVerified: false,
    legalDeadlineCertified: false
  },
  requirementCandidates: [],
  missingInputs: [
    {
      reason: 'DOCUMENT_MISSING',
      title: 'Owner document',
      explanation: 'Collect the current owner document.',
      blocking: true
    }
  ],
  readiness: {
    state: 'MISSING_CLIENT_INPUT',
    presentRequirementCount: 0,
    blockingMissingCount: 1,
    reviewRequiredCount: 0,
    evaluatedAt: '2026-08-21T00:00:00.000Z',
    preparationCompletenessOnly: true,
    successProbabilityCalculated: false,
    filingEligibilityCertified: false,
    legalValidityCertified: false
  },
  capabilityCandidates: [],
  providerCandidates: [],
  servicePackageCandidates: [],
  communicationDrafts: [],
  createdByUserId: 'user_demo',
  createdAt: '2026-08-21T00:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z',
  parallelMatterLifecycleCreated: false,
  officialTruthCreated: false,
  protectedActionAuthorized: false
};

describe('TrademarkServiceWorkbench', () => {
  it('renders durable preparation state without presenting it as execution authority', () => {
    render(
      <TrademarkServiceWorkbench
        jurisdiction="US"
        assetVersion={2}
        latest={latest}
        onPrepare={vi.fn()}
      />
    );
    expect(screen.getByText('MISSING_CLIENT_INPUT')).toBeTruthy();
    expect(screen.getByText(/Owner document/)).toBeTruthy();
    expect(screen.getByText(/Preparation completeness ≠ legal conclusion/)).toBeTruthy();
    expect(screen.getByText(/Nothing here sends a message/)).toBeTruthy();
  });

  it('requires an explicit user-selected service intent and prepares only a work package', async () => {
    const onPrepare = vi.fn().mockResolvedValue(undefined);
    render(<TrademarkServiceWorkbench jurisdiction="CA" assetVersion={7} onPrepare={onPrepare} />);
    fireEvent.change(screen.getByLabelText('Service intent'), { target: { value: 'RENEWAL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare service package' }));
    await waitFor(() => expect(onPrepare).toHaveBeenCalledTimes(1));
    expect(onPrepare.mock.calls[0]?.[0]).toMatchObject({
      assetVersion: 7,
      intent: {
        kind: 'RENEWAL',
        jurisdiction: 'CA',
        reviewedByUser: true,
        legalConclusionCreated: false,
        serviceAvailabilityVerified: false,
        legalDeadlineCertified: false
      }
    });
    expect(screen.getByRole('status').textContent).toContain(
      'No filing, provider contact, payment or publication'
    );
  });
});
