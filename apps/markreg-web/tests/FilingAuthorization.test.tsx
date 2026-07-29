import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FilingAuthorization } from '@markorbit/contracts';
import {
  FilingAuthorizationView,
  authorizationAcknowledgements
} from '../src/FilingAuthorization.js';
import type { MarkregClient } from '../src/api/markreg.js';
const at = '2026-07-29T12:00:00.000Z';
const consequences = {
  orderCreated: false,
  paymentCreated: false,
  invoiceCreated: false,
  formalMatterCreated: false,
  professionalAppointed: false,
  providerAssignedExternally: false,
  filingCreated: false,
  filingSubmitted: false,
  officialApplicationCreated: false,
  officialApplicationNumberReceived: false,
  customerMessageSent: false,
  externalDocumentSent: false,
  trademarkOfficeContacted: false
} as const;
const authorization = {
  schemaVersion: 1,
  version: 1,
  filingAuthorizationId: 'filing-authorization_web012',
  preparationLockId: 'preparation-lock_web012',
  preparationLockVersion: '2:3:2026-07-29T12:00:00.000Z',
  preparationSnapshot: {
    documentPackage: { documentItems: [] },
    instructionLedger: { entries: [] }
  },
  professionalReviewCaseId: 'professional-review_web012',
  professionalReviewVersion: 'review-v1',
  customerId: 'customer_web012',
  authorizedParty: { partyId: 'customer_web012', displayName: 'Alex Owner' },
  authorizationCapacity: 'OWNER',
  jurisdiction: 'GB',
  applicantOwnerReference: 'MarkOrbit Labs Ltd',
  trademarkReference: 'MARKORBIT',
  classes: ['9', '35', '42'],
  goodsServices: ['Governed software services with a long immutable description'],
  filingBasis: 'INTENT_TO_USE',
  representativeRequirement: 'NOT_REQUIRED',
  scope: {
    jurisdiction: 'GB',
    applicantOwnerReference: 'MarkOrbit Labs Ltd',
    trademarkReference: 'MARKORBIT',
    classes: ['9'],
    goodsServices: ['Governed software'],
    filingBasis: 'INTENT_TO_USE',
    useLockedDocuments: true,
    representativeUse: 'NOT_REQUIRED',
    permittedFilingChannel: 'OFFICE_PORTAL',
    permittedExecutionWindow: { startsAt: at, endsAt: '2026-08-29T12:00:00.000Z' }
  },
  termsVersion: 'filing-authorization-terms-v1',
  acknowledgements: [],
  evidence: [],
  status: 'PENDING_CONFIRMATION',
  createdAt: at,
  updatedAt: at
} as unknown as FilingAuthorization;
const client = (status: FilingAuthorization['status'] = 'AUTHORIZED') =>
  ({
    createIntake: vi.fn(),
    confirmFilingAuthorization: vi.fn().mockResolvedValue({
      filingAuthorization: {
        ...authorization,
        version: 2,
        status,
        authorizedAt: at,
        acknowledgements: authorizationAcknowledgements.map((x) => ({
          code: x.code,
          version: 1,
          acknowledgedBy: 'customer_web012',
          acknowledgedAt: at,
          evidenceReference: `e:${x.code}`
        }))
      },
      consequences
    })
  }) as unknown as MarkregClient;
describe('Gateway-backed Filing Authorization application', () => {
  it('shows exact immutable scope with every acknowledgement initially unchecked and confirm disabled', () => {
    render(<FilingAuthorizationView client={client()} fixtureAuthorization={authorization} />);
    expect(screen.getByText(/preparation-lock_web012/)).toHaveTextContent(
      authorization.preparationLockVersion
    );
    expect(screen.getByText('MARKORBIT')).toBeVisible();
    const checks = screen.getAllByRole('checkbox');
    expect(checks).toHaveLength(9);
    for (const check of checks) expect(check).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Confirm Filing Authorization' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Submit application/i })).not.toBeInTheDocument();
  });
  it('actively acknowledges through the Gateway client and renders the AUTHORIZED receipt with all false consequences', async () => {
    const gateway = client();
    const user = userEvent.setup();
    render(<FilingAuthorizationView client={gateway} fixtureAuthorization={authorization} />);
    for (const check of screen.getAllByRole('checkbox')) await user.click(check);
    const confirm = screen.getByRole('button', { name: 'Confirm Filing Authorization' });
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await screen.findByText('Authorized for internal execution review — not submitted');
    expect(screen.getAllByText('AUTHORIZED')).toHaveLength(2);
    expect(gateway.confirmFilingAuthorization).toHaveBeenCalledOnce();
    for (const key of Object.keys(consequences)) expect(screen.getByText(key)).toBeVisible();
    expect(screen.getAllByText('false')).toHaveLength(13);
  });
  it.each(['STALE', 'WITHDRAWN'] as const)(
    'prevents continuation for %s authority',
    async (status) => {
      render(
        <FilingAuthorizationView
          client={client(status)}
          fixtureAuthorization={{ ...authorization, status }}
        />
      );
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Confirm Filing Authorization' })).toBeDisabled()
      );
      expect(screen.getByText(/No further authorization action is permitted/)).toBeVisible();
    }
  );
});
