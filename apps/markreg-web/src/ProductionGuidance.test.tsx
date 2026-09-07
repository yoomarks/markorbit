// @vitest-environment jsdom
import type {
  ProductionIntakeV1,
  ProductionRecommendationV1,
  UserSelectionV1
} from '@markorbit/contracts/markreg-early-funnel';
import {
  noEarlyFunnelAuthorityConsequences,
  noRecommendationSourceAuthorityConsequences
} from '@markorbit/contracts/markreg-early-funnel';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkregApiError } from './api/errors.js';
import type { ProductionGuidanceClient } from './api/production-guidance.js';
import { ProductionGuidance } from './ProductionGuidance.js';

const workspaceId = '018f0000-0000-7000-8000-000000000954';
const intake: ProductionIntakeV1 = {
  schemaVersion: 1,
  intakeId: 'production-intake_954',
  workspaceId,
  version: 1,
  status: 'RECEIVED',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Launch ORBIT for software services.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs Ltd.', country: 'GB' },
    trademark: { type: 'WORD', representationText: 'ORBIT' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Downloadable software and software as a service.' },
    filingGoal: 'Prepare a US filing strategy.'
  },
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: 'a'.repeat(64),
  createdAt: '2026-09-07T06:00:00.000Z',
  updatedAt: '2026-09-07T06:00:00.000Z',
  authorityConsequences: noEarlyFunnelAuthorityConsequences
};

const recommendation: ProductionRecommendationV1 = {
  schemaVersion: 1,
  recommendationId: 'production-recommendation_954',
  workspaceId,
  version: 1,
  intake: {
    id: intake.intakeId,
    version: intake.version,
    fingerprintSha256: intake.fingerprintSha256
  },
  admissionClass: 'PRODUCTION_ADMISSIBLE',
  currentness: 'CURRENT',
  source: {
    sourceKind: 'CAPABILITY_RESULT',
    sourceId: 'markreg.us-trademark-mark-representation-strategy-source',
    sourceVersion: '1.0.0',
    fingerprintSha256: 'b'.repeat(64),
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: '2026-09-07T06:01:00.000Z',
    provenanceRefs: ['capability:954'],
    assumptions: ['The supplied Intake remains unchanged.'],
    limitations: ['Strategy guidance is not legal advice.'],
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  },
  options: [
    {
      code: 'A',
      title: 'Word-first filing',
      description: 'Start with the standard-character mark.'
    },
    {
      code: 'B',
      title: 'Composite-first filing',
      description: 'Lead with the composite presentation.'
    },
    {
      code: 'C',
      title: 'Parallel filing',
      description: 'Consider both representations separately.'
    }
  ],
  rationale: 'The governed source returned three bounded representation strategies.',
  assumptions: ['The customer-supplied mark representation is accurate.'],
  limitations: ['Review the strategy before any filing decision.'],
  provenanceRefs: ['capability:954', 'knowledge:mark-drawings'],
  generatedAt: '2026-09-07T06:02:00.000Z',
  fingerprintSha256: 'c'.repeat(64),
  authorityConsequences: noEarlyFunnelAuthorityConsequences
};
const selection: UserSelectionV1 = {
  schemaVersion: 1,
  selectionId: 'production-selection_954',
  workspaceId,
  version: 1,
  status: 'CURRENT',
  recommendation: {
    id: recommendation.recommendationId,
    version: recommendation.version,
    fingerprintSha256: recommendation.fingerprintSha256
  },
  selectedOptionCode: 'B',
  selectedAt: '2026-09-07T06:03:00.000Z',
  fingerprintSha256: 'd'.repeat(64),
  authorityConsequences: noEarlyFunnelAuthorityConsequences
};

function client(overrides: Partial<ProductionGuidanceClient> = {}): ProductionGuidanceClient {
  return {
    createRecommendation: vi.fn(() => Promise.resolve({ recommendation })),
    getRecommendation: vi.fn(() => Promise.resolve({ recommendation })),
    createSelection: vi.fn(() => Promise.resolve({ selection })),
    getSelection: vi.fn(() => Promise.resolve({ selection })),
    ...overrides
  };
}
describe('ProductionGuidance', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('continues RECEIVED Intake through exact owner Recommendation and customer Selection', async () => {
    const user = userEvent.setup();
    const createRecommendation = vi.fn<ProductionGuidanceClient['createRecommendation']>(() =>
      Promise.resolve({ recommendation })
    );
    const getRecommendation = vi.fn(() => Promise.resolve({ recommendation }));
    const createSelection = vi.fn<ProductionGuidanceClient['createSelection']>(() =>
      Promise.resolve({ selection })
    );
    const getSelection = vi.fn(() => Promise.resolve({ selection }));
    const api = client({ createRecommendation, getRecommendation, createSelection, getSelection });

    render(<ProductionGuidance intake={intake} client={api} onReloadIntake={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Generate governed Recommendation' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Generate governed Recommendation' }));

    await waitFor(() => expect(createRecommendation).toHaveBeenCalledTimes(1));
    expect(createRecommendation.mock.calls[0]![0]).toMatchObject({
      intakeId: intake.intakeId,
      expectedIntakeVersion: intake.version,
      expectedIntakeFingerprintSha256: intake.fingerprintSha256
    });
    await waitFor(() =>
      expect(getRecommendation).toHaveBeenCalledWith(recommendation.recommendationId)
    );
    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole('radio', { name: /A - Word-first filing/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /B - Composite-first filing/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /C - Parallel filing/ })).toBeTruthy();
    expect(screen.getByText(recommendation.rationale)).toBeTruthy();
    expect(screen.getByText(recommendation.assumptions[0]!)).toBeTruthy();
    expect(screen.getByText(recommendation.limitations[0]!)).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: /B - Composite-first filing/ }));
    await user.click(screen.getByRole('button', { name: 'Record this choice' }));
    await waitFor(() => expect(createSelection).toHaveBeenCalledTimes(1));
    expect(createSelection.mock.calls[0]![0]).toMatchObject({
      recommendationId: recommendation.recommendationId,
      expectedRecommendationVersion: recommendation.version,
      selectedOptionCode: 'B'
    });
    await waitFor(() => expect(getSelection).toHaveBeenCalledWith(selection.selectionId));
    expect(await screen.findByText('Customer selection recorded')).toBeTruthy();
    expect(screen.getAllByText(/customer choice only/i)).toHaveLength(2);
    expect(screen.getByText(/does not create a Quote, Order, Matter, Payment/i)).toBeTruthy();
  });
  it('retries a 503 Recommendation create with the same logical Idempotency-Key', async () => {
    const user = userEvent.setup();
    const createRecommendation = vi
      .fn<ProductionGuidanceClient['createRecommendation']>()
      .mockRejectedValueOnce(
        new MarkregApiError(
          'recoverable',
          'temporarily unavailable',
          'correlation_954',
          'DOWNSTREAM_UNAVAILABLE',
          503
        )
      )
      .mockResolvedValueOnce({ recommendation });
    const api = client({ createRecommendation });
    render(<ProductionGuidance intake={intake} client={api} onReloadIntake={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Generate governed Recommendation' }));
    expect(
      await screen.findByRole('heading', { name: 'Production guidance is temporarily unavailable' })
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(createRecommendation).toHaveBeenCalledTimes(2));
    const first = createRecommendation.mock.calls[0]![0];
    const second = createRecommendation.mock.calls[1]![0];
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.correlationId).toBe(first.correlationId);
    expect(second.expectedIntakeFingerprintSha256).toBe(first.expectedIntakeFingerprintSha256);
  });
  it('turns a 409 into an explicit owner-truth reload instead of inventing state', async () => {
    const user = userEvent.setup();
    const onReloadIntake = vi.fn();
    const api = client({
      createRecommendation: vi.fn(() =>
        Promise.reject(
          new MarkregApiError(
            'conflict',
            'stale intake',
            'correlation_954',
            'INTAKE_VERSION_CONFLICT',
            409
          )
        )
      )
    });
    render(<ProductionGuidance intake={intake} client={api} onReloadIntake={onReloadIntake} />);

    await user.click(screen.getByRole('button', { name: 'Generate governed Recommendation' }));
    expect(await screen.findByRole('heading', { name: 'Owner truth changed' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reload Intake truth' }));
    expect(onReloadIntake).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Essential Protection')).toBeNull();
  });

  it('fails closed on 422 with no fixture or generic AI fallback', async () => {
    const user = userEvent.setup();
    const api = client({
      createRecommendation: vi.fn(() =>
        Promise.reject(
          new MarkregApiError(
            'validation',
            'not applicable',
            'correlation_954',
            'RECOMMENDATION_NOT_APPLICABLE',
            422
          )
        )
      )
    });
    render(<ProductionGuidance intake={intake} client={api} onReloadIntake={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Generate governed Recommendation' }));
    expect(
      await screen.findByRole('heading', { name: 'Guidance is unavailable for this Intake' })
    ).toBeTruthy();
    expect(screen.getByText(/No fixture or generic AI fallback/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('restores known Recommendation and Selection pointers by owner GET only', async () => {
    sessionStorage.setItem(
      `markreg-production-recommendation-pointer-v1:${workspaceId}:${intake.intakeId}`,
      JSON.stringify(recommendation.recommendationId)
    );
    sessionStorage.setItem(
      `markreg-production-selection-pointer-v1:${workspaceId}:${intake.intakeId}`,
      JSON.stringify(selection.selectionId)
    );
    const createRecommendation = vi.fn<ProductionGuidanceClient['createRecommendation']>();
    const createSelection = vi.fn<ProductionGuidanceClient['createSelection']>();
    const getRecommendation = vi.fn(() => Promise.resolve({ recommendation }));
    const getSelection = vi.fn(() => Promise.resolve({ selection }));
    const api = client({ createRecommendation, createSelection, getRecommendation, getSelection });

    render(<ProductionGuidance intake={intake} client={api} onReloadIntake={vi.fn()} />);
    expect(await screen.findByText('Customer selection recorded')).toBeTruthy();
    expect(getRecommendation).toHaveBeenCalledWith(recommendation.recommendationId);
    expect(getSelection).toHaveBeenCalledWith(selection.selectionId);
    expect(createRecommendation).not.toHaveBeenCalled();
    expect(createSelection).not.toHaveBeenCalled();
  });
});
