import { describe, expect, it } from 'vitest';
import { prepareTrademarkServiceCommercialArtifacts } from '../src/trademark-service-commercial-preparation.js';

const missingDocument = {
  reason: 'DOCUMENT_MISSING',
  title: 'Signed power of attorney',
  explanation: 'A signed POA is missing for preparation.',
  blocking: true
} as const;

function prepare(
  overrides: Partial<Parameters<typeof prepareTrademarkServiceCommercialArtifacts>[0]> = {}
) {
  return prepareTrademarkServiceCommercialArtifacts({
    workspaceId: '94949494-9494-4949-8949-949494949494',
    workPackageId: 'trademark-service-work-package_commercial-test',
    pricingSnapshot: {
      sourceAuthority: 'COMMERCIAL_OWNER',
      sourceReference: 'commercial-price_us-renewal',
      sourceVersion: '7',
      currency: 'USD',
      lines: [
        {
          code: 'official',
          description: 'Observed official fee input',
          category: 'OFFICIAL_FEE',
          amount: { amountMinor: 35000, currency: 'USD' }
        },
        {
          code: 'service',
          description: 'Professional service preparation fee input',
          category: 'SERVICE_FEE',
          amount: { amountMinor: 20000, currency: 'USD' }
        }
      ],
      assumptions: ['Single class preparation scope'],
      limitations: ['Subject to professional review before commitment'],
      current: true,
      reviewedForPreparation: true
    },
    missingInputs: [missingDocument],
    providerCandidates: [
      {
        providerReference: 'provider_us-1',
        capabilityReference: 'capability_renewal-us',
        reason: 'MGSN candidate.',
        engaged: false,
        selectedForExecution: false
      }
    ],
    documentSourceReferences: [],
    clientRecipientReference: 'client_contact-1',
    providerInstructionRequestedByUser: false,
    generatedAt: '2026-08-21T05:30:00.000Z',
    ...overrides
  });
}

describe('M12-WP06 quote and client/provider preparation', () => {
  it('creates a non-binding quote candidate only from a current reviewed Commercial owner snapshot', () => {
    const result = prepare();
    expect(result.quoteCandidate).toMatchObject({
      currency: 'USD',
      total: { amountMinor: 55000, currency: 'USD' },
      bindingQuote: false,
      paymentAuthorized: false
    });
    expect(result.quoteCandidate?.assumptions).toContain(
      'Pricing source: commercial-price_us-renewal@7'
    );
    expect(result).toMatchObject({
      bindingQuoteCreated: false,
      paymentAuthorized: false,
      externalCommunicationSent: false,
      providerEngaged: false,
      filingOrPublicationAuthorized: false
    });
  });

  it('does not create a quote from stale or unreviewed pricing input', () => {
    const stale = prepare({
      pricingSnapshot: {
        sourceAuthority: 'COMMERCIAL_OWNER',
        sourceReference: 'commercial-price_stale',
        sourceVersion: '1',
        currency: 'USD',
        lines: [
          {
            code: 'service',
            description: 'Service fee',
            category: 'SERVICE_FEE',
            amount: { amountMinor: 10000, currency: 'USD' }
          }
        ],
        assumptions: [],
        limitations: [],
        current: false,
        reviewedForPreparation: true
      }
    });
    expect(stale.quoteCandidate).toBeUndefined();
  });

  it('rejects mixed-currency or unsafe pricing instead of inventing totals', () => {
    expect(() =>
      prepare({
        pricingSnapshot: {
          sourceAuthority: 'COMMERCIAL_OWNER',
          sourceReference: 'commercial-price_bad',
          sourceVersion: '1',
          currency: 'USD',
          lines: [
            {
              code: 'service',
              description: 'Service fee',
              category: 'SERVICE_FEE',
              amount: { amountMinor: 10000, currency: 'EUR' }
            }
          ],
          assumptions: [],
          limitations: [],
          current: true,
          reviewedForPreparation: true
        }
      })
    ).toThrow('Pricing line currency must match quote currency.');
  });

  it('prepares an unsent client information request from explicit client-side missing inputs', () => {
    const result = prepare();
    expect(result.communicationDrafts).toContainEqual(
      expect.objectContaining({
        kind: 'CLIENT_INFORMATION_REQUEST',
        recipientReference: 'client_contact-1',
        sent: false,
        externalContactAuthorized: false
      })
    );
    expect(result.communicationDrafts.find((draft) => draft.kind === 'CLIENT_INFORMATION_REQUEST')?.body)
      .toContain('Signed power of attorney');
  });

  it('prepares Provider enquiry but not Provider instruction without explicit user request', () => {
    const result = prepare();
    expect(result.communicationDrafts.map((draft) => draft.kind)).toContain('PROVIDER_ENQUIRY');
    expect(result.communicationDrafts.map((draft) => draft.kind)).not.toContain(
      'PROVIDER_INSTRUCTION'
    );
  });

  it('may prepare a Provider instruction draft after explicit user request but still cannot send or engage', () => {
    const result = prepare({ providerInstructionRequestedByUser: true });
    const instruction = result.communicationDrafts.find(
      (draft) => draft.kind === 'PROVIDER_INSTRUCTION'
    );
    expect(instruction).toMatchObject({
      recipientReference: 'provider_us-1',
      sent: false,
      externalContactAuthorized: false
    });
    expect(result.providerEngaged).toBe(false);
  });

  it('keeps document package preparation incomplete while document/evidence inputs are missing', () => {
    const incomplete = prepare({ documentSourceReferences: ['document_existing-1'] });
    expect(incomplete.documentPackageCandidate).toMatchObject({
      sourceReferences: ['document_existing-1'],
      missingInputTitles: ['Signed power of attorney'],
      completeForPreparation: false,
      selected: false,
      externalSubmissionAuthorized: false
    });

    const complete = prepare({
      missingInputs: [],
      documentSourceReferences: ['document_existing-1']
    });
    expect(complete.documentPackageCandidate.completeForPreparation).toBe(true);
  });

  it('uses stable preparation IDs for identical preparation inputs', () => {
    const first = prepare();
    const second = prepare();
    expect(first.documentPackageCandidate.preparationId).toBe(
      second.documentPackageCandidate.preparationId
    );
    expect(first.communicationDrafts.map((draft) => draft.preparationId)).toEqual(
      second.communicationDrafts.map((draft) => draft.preparationId)
    );
  });
});
