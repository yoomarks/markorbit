import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TruthContext, type MarkregTruthClass } from './TruthContext.js';

const cases = [
  ['CUSTOMER_SUPPLIED', 'Customer supplied'],
  ['GOVERNED_INTERNAL_WORKFLOW', 'Governed internal workflow'],
  ['REVIEWED_EVIDENCE', 'Reviewed evidence'],
  ['OFFICIAL_VERIFIED', 'Official verified'],
  ['UNAVAILABLE_OR_STALE', 'Unavailable / stale'],
  ['HISTORICAL', 'Historical']
] as const satisfies readonly (readonly [MarkregTruthClass, string])[];

afterEach(cleanup);

describe('TruthContext', () => {
  it.each(cases)('renders %s as semantic text, not color-only meaning', (truthClass, label) => {
    render(<TruthContext truthClass={truthClass} detail="Bounded context" />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('Bounded context')).toBeTruthy();
    expect(screen.getByLabelText(`Truth class: ${label}. Bounded context`)).toBeTruthy();
  });
});
