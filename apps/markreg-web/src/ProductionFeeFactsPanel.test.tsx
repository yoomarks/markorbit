// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  noEarlyFunnelAuthorityConsequences,
  type ProductionFeeFactsV1,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import { MarkregApiError } from './api/errors.js';
import type { ProductionFeeFactsClient } from './api/production-fee-facts.js';
import { ProductionFeeFactsPanel, parseNiceClassSelection } from './ProductionFeeFactsPanel.js';

const workspaceId = '64646464-6464-4646-8646-646464646464';
const intake: ProductionIntakeV1 = {
  schemaVersion: 1,
  intakeId: 'intake_task0944_web',
  workspaceId,
  version: 1,
  status: 'RECEIVED',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Prepare explicit fee facts.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit LLC', country: 'US' },
    trademark: { type: 'WORD', representationText: 'ORBIT' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Software.' },
    filingGoal: 'Prepare a bounded Quote.'
  },
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: 'a'.repeat(64),
  createdAt: '2026-09-07T05:00:00.000Z',
  updatedAt: '2026-09-07T05:00:00.000Z',
  authorityConsequences: noEarlyFunnelAuthorityConsequences
};

const feeFacts: ProductionFeeFactsV1 = {
  schemaVersion: 1,
  feeFactsId: 'fee-facts_task0944_web',
  workspaceId,
  version: 1,
  currentness: 'CURRENT',
  intake: { id: intake.intakeId, version: 1, fingerprintSha256: intake.fingerprintSha256 },
  filingBasis: 'SECTION_1',
  niceClasses: [9, 42],
  classCount: 2,
  filingBasisProvenance: {
    sourceClass: 'CUSTOMER_SUPPLIED',
    actorId: 'user_task0944_web',
    membershipId: 'membership_task0944_web',
    establishedAt: '2026-09-07T05:01:00.000Z'
  },
  classSelectionProvenance: {
    sourceClass: 'CUSTOMER_SUPPLIED',
    actorId: 'user_task0944_web',
    membershipId: 'membership_task0944_web',
    establishedAt: '2026-09-07T05:01:00.000Z'
  },
  recordedAt: '2026-09-07T05:01:00.000Z',
  fingerprintSha256: 'b'.repeat(64),
  authorityConsequences: noEarlyFunnelAuthorityConsequences
};

function client(overrides: Partial<ProductionFeeFactsClient> = {}): ProductionFeeFactsClient {
  return {
    create: vi.fn(() => Promise.resolve({ feeFacts })),
    getCurrent: vi.fn(() => Promise.resolve({ feeFacts })),
    ...overrides
  };
}

describe('Production fee facts panel', () => {
  it('normalizes only class ordering and rejects invalid/duplicate Nice classes', () => {
    expect(parseNiceClassSelection('42, 9, 35')).toEqual([9, 35, 42]);
    expect(() => parseNiceClassSelection('9, 9')).toThrow(/repeat/);
    expect(() => parseNiceClassSelection('0')).toThrow(/1 to 45/);
    expect(() => parseNiceClassSelection('software')).toThrow(/1 to 45/);
  });

  it('does not read or infer anything until the user opens the explicit facts panel', async () => {
    const getCurrent = vi.fn<ProductionFeeFactsClient['getCurrent']>(() =>
      Promise.resolve({ feeFacts })
    );
    render(<ProductionFeeFactsPanel intake={intake} client={client({ getCurrent })} />);
    expect(getCurrent).not.toHaveBeenCalled();
    expect(screen.getByText(/never inferred from your goods\/services text/i)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Review fee-driving facts' }));
    expect(
      await screen.findByRole('heading', { name: 'Current application fee facts' })
    ).toBeTruthy();
    expect(getCurrent).toHaveBeenCalledWith(intake.intakeId, 1);
    expect(screen.getByText('SECTION_1')).toBeTruthy();
    expect(screen.getByText('9, 42')).toBeTruthy();
  });

  it('turns owner 404 into explicit editing, saves only basis/classes and confirms owner readback', async () => {
    const user = userEvent.setup();
    const getCurrent = vi
      .fn<ProductionFeeFactsClient['getCurrent']>()
      .mockRejectedValueOnce(
        new MarkregApiError(
          'blocking',
          'not found',
          'correlation_task0944_web',
          'PRODUCTION_FEE_FACTS_NOT_FOUND',
          404
        )
      )
      .mockResolvedValueOnce({ feeFacts });
    const create = vi.fn<ProductionFeeFactsClient['create']>(() => Promise.resolve({ feeFacts }));
    render(<ProductionFeeFactsPanel intake={intake} client={client({ create, getCurrent })} />);

    await user.click(screen.getByRole('button', { name: 'Review fee-driving facts' }));
    expect(
      await screen.findByRole('heading', { name: 'Record application fee facts' })
    ).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('US filing basis'), 'SECTION_1');
    fireEvent.change(screen.getByLabelText('Nice classes'), { target: { value: '42, 9' } });
    await user.click(screen.getByRole('button', { name: 'Save explicit fee facts' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]![0]).toBe(intake.intakeId);
    expect(create.mock.calls[0]![1]).toMatchObject({
      expectedIntakeVersion: 1,
      filingBasis: 'SECTION_1',
      niceClasses: [9, 42]
    });
    expect(create.mock.calls[0]![1]).not.toHaveProperty('classCount');
    expect(create.mock.calls[0]![1]).not.toHaveProperty('filingBasisSourceClass');
    expect(create.mock.calls[0]![1]).not.toHaveProperty('filingBasisProvenance');
    expect(
      await screen.findByRole('heading', { name: 'Current application fee facts' })
    ).toBeTruthy();
    expect(getCurrent).toHaveBeenLastCalledWith(intake.intakeId, 1);
  });

  it('fails validation before mutation when explicit class material is contradictory', async () => {
    const user = userEvent.setup();
    const getCurrent = vi.fn<ProductionFeeFactsClient['getCurrent']>(() =>
      Promise.reject(
        new MarkregApiError(
          'blocking',
          'not found',
          undefined,
          'PRODUCTION_FEE_FACTS_NOT_FOUND',
          404
        )
      )
    );
    const create = vi.fn<ProductionFeeFactsClient['create']>();
    render(<ProductionFeeFactsPanel intake={intake} client={client({ create, getCurrent })} />);
    await user.click(screen.getByRole('button', { name: 'Review fee-driving facts' }));
    await user.selectOptions(await screen.findByLabelText('US filing basis'), 'SECTION_44');
    fireEvent.change(screen.getByLabelText('Nice classes'), { target: { value: '9, 9' } });
    await user.click(screen.getByRole('button', { name: 'Save explicit fee facts' }));
    expect(await screen.findByText(/Do not repeat a Nice class/)).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });
});
