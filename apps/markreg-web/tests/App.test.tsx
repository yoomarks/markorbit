import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkregApp } from '../src/App.js';

beforeEach(() => sessionStorage.clear());

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
    const local = vi.spyOn(Storage.prototype, 'setItem');
    render(<MarkregApp />);
    expect(screen.getByLabelText('Applicant name')).toHaveValue('Saved applicant');
    expect(local).toHaveBeenCalledWith('markreg-guided-intake-v1', expect.any(String));
  });
});
