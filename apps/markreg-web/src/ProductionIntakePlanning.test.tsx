// @vitest-environment jsdom
import type {
  CreateProductionIntakeCommandV1,
  ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkregApiError } from './api/errors.js';
import type { ProductionIntakeClient } from './api/production-intake.js';
import {
  ProductionIntakePlanning,
  productionIntakeInput,
  type ProductionIntakeDraft
} from './ProductionIntakePlanning.js';

const workspaceId = '018f0000-0000-7000-8000-000000000699';
const draft: ProductionIntakeDraft = {
  applicantType: 'ORGANIZATION',
  applicantName: 'Orbit Labs Ltd.',
  applicantCountry: 'GB',
  trademarkType: 'WORD',
  trademarkText: 'ORBIT',
  targetJurisdictions: 'US, GB',
  goodsServices: 'Downloadable software and software as a service.',
  businessContext: 'Launch the Orbit brand for software services.',
  filingGoal: 'Record a new filing request.'
};

const record: ProductionIntakeV1 = {
  schemaVersion: 1,
  intakeId: 'production-intake_699',
  workspaceId,
  version: 1,
  status: 'RECEIVED',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: productionIntakeInput(draft),
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: 'a'.repeat(64),
  createdAt: '2026-09-03T08:00:00.000Z',
  updatedAt: '2026-09-03T08:00:00.000Z',
  authorityConsequences: {
    professionalApprovalCreated: false,
    legalConclusionCreated: false,
    filingAuthorizationCreated: false,
    protectedActionAuthorized: false,
    orderCreated: false,
    paymentCreated: false,
    invoiceCreated: false,
    filingCreated: false,
    officialTruthCreated: false
  }
};

function client(overrides: Partial<ProductionIntakeClient> = {}): ProductionIntakeClient {
  return {
    create: vi.fn(() => Promise.resolve({ intake: record })),
    get: vi.fn(() => Promise.resolve({ intake: record })),
    ...overrides
  };
}

async function completeDraft(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Applicant type'), 'ORGANIZATION');
  await user.type(screen.getByLabelText('Applicant name'), draft.applicantName);
  await user.type(screen.getByLabelText('Applicant country or region'), draft.applicantCountry);
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.selectOptions(screen.getByLabelText('Trademark type'), 'WORD');
  await user.type(screen.getByLabelText('Trademark representation text'), draft.trademarkText);
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.type(screen.getByLabelText('Target jurisdictions'), draft.targetJurisdictions);
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.type(screen.getByLabelText('Goods / services source text'), draft.goodsServices);
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.type(screen.getByLabelText('Business context'), draft.businessContext);
  await user.type(screen.getByLabelText('Filing goal'), draft.filingGoal);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('production durable Intake planning', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('markorbit-workspace-id', workspaceId);
  });

  it('maps the guided draft exactly to ProductionIntakeInputV1', () => {
    expect(productionIntakeInput(draft)).toEqual({
      businessContext: draft.businessContext,
      applicant: {
        type: 'ORGANIZATION',
        name: draft.applicantName,
        country: draft.applicantCountry
      },
      trademark: {
        type: 'WORD',
        representationText: draft.trademarkText
      },
      targetJurisdictions: ['US', 'GB'],
      goodsServices: { sourceText: draft.goodsServices },
      filingGoal: draft.filingGoal
    });
  });

  it('creates durable Intake, reads it back from the owner route and never renders fixture options', async () => {
    const user = userEvent.setup();
    const api = client();
    render(<ProductionIntakePlanning client={api} workspaceId={workspaceId} />);

    expect(screen.getByText(/Customer-supplied Intake only/)).toBeTruthy();
    await completeDraft(user);
    expect(screen.getByRole('heading', { name: 'Customer-supplied Intake summary' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Create durable Intake' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(api.create).mock.calls[0]![0] as CreateProductionIntakeCommandV1;
    expect(submitted).toMatchObject({
      schemaVersion: 1,
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      input: record.input
    });
    expect(submitted).not.toHaveProperty('actor');
    expect(submitted).not.toHaveProperty('workspaceId');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(record.intakeId));
    expect(await screen.findByRole('heading', { name: 'Production Intake received' })).toBeTruthy();
    expect(screen.getByText(/Recommendation remains gated/)).toBeTruthy();
    expect(screen.queryByText('Essential Protection')).toBeNull();
    expect(screen.queryByText('Recommended Protection')).toBeNull();
    expect(screen.queryByText('Extended Protection')).toBeNull();
  });

  it('reloads submitted truth through durable GET using only a local Intake identity pointer', async () => {
    sessionStorage.setItem(
      `markreg-production-intake-pointer-v1:${workspaceId}`,
      JSON.stringify(record.intakeId)
    );
    sessionStorage.setItem(
      `markreg-production-intake-draft-v1:${workspaceId}`,
      JSON.stringify({ ...draft, applicantName: 'stale local material' })
    );
    const api = client();
    render(<ProductionIntakePlanning client={api} workspaceId={workspaceId} />);

    expect(await screen.findByRole('heading', { name: 'Production Intake received' })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(record.intakeId);
    expect(api.create).not.toHaveBeenCalled();
    expect(screen.getByText(/Orbit Labs Ltd./)).toBeTruthy();
    expect(screen.queryByText('stale local material')).toBeNull();
  });

  it('retries an uncertain write with the same logical Idempotency-Key and unchanged material', async () => {
    const user = userEvent.setup();
    const create = vi
      .fn()
      .mockRejectedValueOnce(
        new MarkregApiError(
          'recoverable',
          'downstream unavailable',
          'correlation_699',
          'DOWNSTREAM_UNAVAILABLE',
          503
        )
      )
      .mockResolvedValueOnce({ intake: record });
    const api = client({ create });
    render(<ProductionIntakePlanning client={api} workspaceId={workspaceId} />);

    await completeDraft(user);
    await user.click(screen.getByRole('button', { name: 'Create durable Intake' }));
    expect(await screen.findByRole('heading', { name: 'Submission outcome uncertain' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Retry/i }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    const first = create.mock.calls[0]![0] as CreateProductionIntakeCommandV1;
    const second = create.mock.calls[1]![0] as CreateProductionIntakeCommandV1;
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.correlationId).toBe(first.correlationId);
    expect(second.input).toEqual(first.input);
  });

  it('does not repost after a successful create when only durable readback is uncertain', async () => {
    const user = userEvent.setup();
    const create = vi.fn(() => Promise.resolve({ intake: record }));
    const get = vi
      .fn()
      .mockRejectedValueOnce(
        new MarkregApiError(
          'recoverable',
          'read unavailable',
          'correlation_699',
          'DOWNSTREAM_UNAVAILABLE',
          503
        )
      )
      .mockResolvedValueOnce({ intake: record });
    const api = client({ create, get });
    render(<ProductionIntakePlanning client={api} workspaceId={workspaceId} />);

    await completeDraft(user);
    await user.click(screen.getByRole('button', { name: 'Create durable Intake' }));
    expect(
      await screen.findByRole('heading', { name: 'Intake saved; durable readback is uncertain' })
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Retry/i }));

    expect(await screen.findByRole('heading', { name: 'Production Intake received' })).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
