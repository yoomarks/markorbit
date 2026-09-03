// @vitest-environment jsdom
import type { ProductionIntakeV1 } from '@markorbit/contracts/markreg-early-funnel';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkregApiError } from './api/errors.js';
import type { ProductionIntakeClient } from './api/production-intake.js';
import { ProductionIntakeFlow } from './ProductionIntakeFlow.js';

const durableIntake: ProductionIntakeV1 = {
  schemaVersion: 1,
  intakeId: 'production-intake_699',
  workspaceId: '018f0000-0000-7000-8000-000000000699',
  version: 1,
  status: 'RECEIVED',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Durable owner readback context',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs Ltd.', country: 'GB' },
    trademark: { type: 'WORD', representationText: 'ORBIT' },
    targetJurisdictions: ['US', 'GB'],
    goodsServices: { sourceText: 'Downloadable software and SaaS.' },
    filingGoal: 'Prepare a new filing.'
  },
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: 'a'.repeat(64),
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
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

const client = (overrides: Partial<ProductionIntakeClient> = {}): ProductionIntakeClient => ({
  create: vi.fn(() =>
    Promise.resolve({
      ...durableIntake,
      input: { ...durableIntake.input, businessContext: 'POST response must not be rendered' }
    })
  ),
  get: vi.fn(() => Promise.resolve(durableIntake)),
  ...overrides
});

async function fillAndReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Start Production Intake' }));
  await user.selectOptions(screen.getByLabelText('Applicant type'), 'ORGANIZATION');
  await user.type(screen.getByLabelText('Applicant name'), 'Orbit Labs Ltd.');
  await user.selectOptions(screen.getByLabelText('Applicant country'), 'GB');
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.selectOptions(screen.getByLabelText('Trademark type'), 'WORD');
  await user.type(screen.getByLabelText('Trademark representation text'), 'ORBIT');
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.selectOptions(screen.getByLabelText('Target jurisdictions (select one or more)'), [
    'US',
    'GB'
  ]);
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.type(
    screen.getByLabelText('Goods / services source text'),
    'Downloadable software and SaaS.'
  );
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.type(screen.getByLabelText('Business context'), 'Customer submitted launch context');
  await user.type(screen.getByLabelText('Filing goal'), 'Prepare a new filing.');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('durable Production Intake flow', () => {
  beforeEach(() => sessionStorage.clear());

  it('renders only the GET owner readback after the durable create', async () => {
    const productionClient = client();
    const user = userEvent.setup();
    render(<ProductionIntakeFlow client={productionClient} />);

    await fillAndReview(user);
    await user.click(screen.getByRole('button', { name: 'Submit Production Intake' }));

    expect(await screen.findByRole('heading', { name: 'Production Intake received' })).toBeTruthy();
    expect(productionClient.create).toHaveBeenCalledTimes(1);
    expect(productionClient.get).toHaveBeenCalledWith('production-intake_699');
    expect(screen.getByText('Durable owner readback context')).toBeTruthy();
    expect(screen.queryByText('POST response must not be rendered')).toBeNull();
    expect(screen.queryByText('Essential Protection')).toBeNull();
    expect(screen.getByText(/Receipt only — not a Recommendation/)).toBeTruthy();
  });

  it('retries an uncertain write with the same logical idempotency identity', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(
        new MarkregApiError('recoverable', 'temporary', 'correlation_x', 'OWNER_503')
      )
      .mockResolvedValueOnce(durableIntake);
    const productionClient = client({ create });
    const user = userEvent.setup();
    render(<ProductionIntakeFlow client={productionClient} />);

    await fillAndReview(user);
    await user.click(screen.getByRole('button', { name: 'Submit Production Intake' }));
    expect(
      await screen.findByRole('heading', { name: 'Submission outcome is uncertain' })
    ).toBeTruthy();

    const firstCommand = create.mock.calls[0]![0];
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    const secondCommand = create.mock.calls[1]![0];
    expect(secondCommand.idempotencyKey).toBe(firstCommand.idempotencyKey);
    expect(secondCommand.correlationId).toBe(firstCommand.correlationId);
    expect(await screen.findByRole('heading', { name: 'Production Intake received' })).toBeTruthy();
  });
});
