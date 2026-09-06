// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TruthBadge, TruthContext } from './TruthContext.js';

describe('MarkReg Truth UX grammar', () => {
  it('renders semantic text and accessible labels for the production truth classes', () => {
    render(
      <>
        <TruthBadge kind="CUSTOMER_SUPPLIED" />
        <TruthBadge kind="GOVERNED_INTERNAL" />
        <TruthBadge kind="REVIEWED_EVIDENCE" />
        <TruthBadge kind="UNAVAILABLE_STALE" />
        <TruthBadge kind="HISTORICAL" />
      </>
    );

    for (const label of [
      'Customer supplied',
      'Governed internal workflow',
      'Reviewed evidence',
      'Unavailable / stale',
      'Historical'
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByLabelText(`Truth class: ${label}`)).toBeTruthy();
    }
  });

  it('keeps the future-safe Official verified class explicit without manufacturing owner support', () => {
    render(
      <TruthContext
        kind="OFFICIAL_VERIFIED"
        details={<span>Only render when exact owner data admits verified official truth.</span>}
      >
        Future-safe grammar fixture
      </TruthContext>
    );

    expect(screen.getByText('Official verified')).toBeTruthy();
    expect(screen.getByText('Future-safe grammar fixture')).toBeTruthy();
    expect(
      screen.getByText('Only render when exact owner data admits verified official truth.', {
        exact: true
      })
    ).toBeTruthy();
  });
});
