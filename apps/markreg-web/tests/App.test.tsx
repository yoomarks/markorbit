import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkregApp } from '../src/App.js';
import type { IntakeCreateCommand, IntakeRecommendationResponse } from '@markorbit/contracts';
import type { MarkregClient } from '../src/api/markreg.js';
import { MarkregApiError } from '../src/api/errors.js';

beforeEach(() => sessionStorage.clear());

async function completeIntake() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Start consultation' }));
  await user.selectOptions(screen.getByLabelText('Applicant type'), 'Company');
  await user.type(screen.getByLabelText('Applicant name'), 'Northstar Ltd');
  await user.selectOptions(screen.getByLabelText('Applicant country'), 'GB');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.selectOptions(screen.getByLabelText('Trademark type'), 'Word mark');
  await user.type(screen.getByLabelText('Trademark text'), 'Northstar');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.selectOptions(screen.getByLabelText(/Target countries/), ['US', 'EU']);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(screen.getByLabelText('Goods / services summary'), 'Software services');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(screen.getByLabelText('Business context'), 'Launching internationally');
  await user.type(screen.getByLabelText('Filing goal'), 'Plan market coverage');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  return user;
}
const response = (command: IntakeCreateCommand): IntakeRecommendationResponse => ({
  intake: {
    intakeId: 'intake_test',
    channel: command.channel,
    relationshipModel: command.relationshipModel,
    status: 'RECOMMENDATION_READY',
    customerIntent: command.customerIntent,
    createdAt: '2026-07-27T00:00:00Z',
    correlationId: command.correlationId
  },
  recommendation: {
    recommendationId: 'recommendation_test',
    intakeId: 'intake_test',
    status: 'FIXTURE_ONLY',
    options: [
      { tier: 'A', name: 'Essential Protection', description: 'Focused.' },
      { tier: 'B', name: 'Recommended Protection', description: 'Balanced.' },
      { tier: 'C', name: 'Extended Protection', description: 'Broad.' }
    ],
    rationale: 'Fixture rationale',
    assumptions: ['Applicant details are accurate.'],
    limitations: ['No clearance search.'],
    provenance: ['execution_test'],
    generatedAt: '2026-07-27T00:00:00Z'
  },
  trace: {
    correlationId: command.correlationId,
    capabilityRequestId: 'capability_private',
    executionId: 'execution_private',
    provenanceRefs: ['execution_private']
  }
});

describe('guided intake', () => {
  it('validates required fields and preserves answers when moving back', async () => {
    const user = userEvent.setup();
    render(<MarkregApp />);
    await user.click(screen.getByRole('button', { name: 'Start consultation' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getAllByText(/This information is required/)).toHaveLength(3);
    await user.selectOptions(screen.getByLabelText('Applicant type'), 'Company');
    await user.type(screen.getByLabelText('Applicant name'), 'Northstar Ltd');
    await user.selectOptions(screen.getByLabelText('Applicant country'), 'GB');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Applicant name')).toHaveValue('Northstar Ltd');
  });

  it('has no serious accessibility violations on the start page', async () => {
    const { container } = render(<MarkregApp />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('restores a session draft without using localStorage', () => {
    sessionStorage.setItem(
      'markreg-guided-intake-v1',
      JSON.stringify({
        applicantType: 'Company',
        applicantName: 'Saved applicant',
        applicantCountry: 'GB',
        trademarkType: '',
        trademarkText: '',
        targetCountries: [],
        goodsServicesSummary: '',
        businessContext: '',
        filingGoal: ''
      })
    );
    const local = vi.spyOn(window.localStorage, 'setItem');
    render(<MarkregApp />);
    expect(screen.getByLabelText('Applicant name')).toHaveValue('Saved applicant');
    expect(local).not.toHaveBeenCalled();
  });

  it('coalesces duplicate submit clicks and renders fixture output without trace', async () => {
    let resolve!: (value: IntakeRecommendationResponse) => void;
    const commands: IntakeCreateCommand[] = [];
    const client: MarkregClient = {
      createIntake(command) {
        commands.push(command);
        return new Promise((done) => {
          resolve = done;
        });
      }
    };
    render(<MarkregApp client={client} />);
    await completeIntake();
    const submit = screen.getByRole('button', { name: 'Submit intake' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(commands).toHaveLength(1);
    resolve(response(commands[0]!));
    await screen.findByRole('heading', { name: 'Compare your protection options' });
    expect(screen.getAllByText(/FIXTURE_ONLY|Fixture only/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not legal advice/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Applicant details are accurate.')).toHaveLength(3);
    expect(screen.getAllByText('No clearance search.')).toHaveLength(3);
    expect(screen.queryByText(/capability_private|execution_private/)).not.toBeInTheDocument();
  });

  it('reuses a key for retry and creates a new key after an edit', async () => {
    const commands: IntakeCreateCommand[] = [];
    let attempt = 0;
    const client: MarkregClient = {
      createIntake(command) {
        commands.push(command);
        attempt++;
        return attempt < 3
          ? Promise.reject(new MarkregApiError('recoverable', 'Temporary safe error.'))
          : Promise.resolve(response(command));
      }
    };
    render(<MarkregApp client={client} />);
    const user = await completeIntake();
    await user.click(screen.getByRole('button', { name: 'Submit intake' }));
    await screen.findByText('Your answers are safe');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Your answers are safe');
    expect(commands[1]!.idempotencyKey).toBe(commands[0]!.idempotencyKey);
    expect(commands[1]!.correlationId).toBe(commands[0]!.correlationId);
    await user.click(screen.getByRole('button', { name: 'Review information' }));
    await user.click(screen.getByRole('button', { name: 'Edit Trademark' }));
    await user.type(screen.getByLabelText('Trademark text'), ' Updated');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Submit intake' }));
    await waitFor(() => expect(commands).toHaveLength(3));
    expect(commands[2]!.idempotencyKey).not.toBe(commands[0]!.idempotencyKey);
    expect(commands[2]!.correlationId).not.toBe(commands[0]!.correlationId);
  });
});
