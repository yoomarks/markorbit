import { describe, expect, it } from 'vitest';
import {
  channels,
  isChannel,
  isMarkOrbitId,
  isRelationshipModel,
  parseChannel,
  parseRelationshipModel,
  relationshipModels,
  type Quote
} from '../src/index.js';
import {
  assertDirectIntake,
  parseIntakeCreateCommand,
  parseRecommendationPackage,
  parseMoney,
  parseFixtureMoney,
  assertQuoteMoneyInvariants,
  parseQuoteCreateCommand
} from '../src/index.js';

const valid = {
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  customerIntent: {
    brandName: 'Orbit',
    applicantCountry: 'GB',
    targetJurisdictions: ['US'],
    goodsServicesDescription: 'Software'
  },
  actor: {
    actorId: 'actor_test',
    workplaceId: 'workplace_test',
    product: 'MARKREG_COM',
    purpose: 'recommendation'
  },
  idempotencyKey: 'key-1',
  correlationId: 'correlation_test'
};

describe('shared transport contracts', () => {
  it('keeps all channel values unique and runtime-valid', () => {
    expect(new Set(channels).size).toBe(channels.length);
    expect(channels.every(isChannel)).toBe(true);
  });

  it('keeps all relationship models unique and runtime-valid', () => {
    expect(new Set(relationshipModels).size).toBe(relationshipModels.length);
    expect(relationshipModels.every(isRelationshipModel)).toBe(true);
  });

  it('rejects unknown controlled values', () => {
    expect(() => parseChannel('DIRECT_CUSTOMER')).toThrow(TypeError);
    expect(() => parseRelationshipModel('OWNED')).toThrow(TypeError);
  });

  it('accepts governed reference identifiers and rejects ambiguous strings', () => {
    expect(isMarkOrbitId('matter_01JABC')).toBe(true);
    expect(isMarkOrbitId('01JABC')).toBe(false);
    expect(isMarkOrbitId('Matter_01JABC')).toBe(false);
  });

  it('validates a complete direct intake fixture', () => {
    expect(parseIntakeCreateCommand(valid)).toMatchObject({ channel: 'MARKREG_DIRECT' });
    expect(() => assertDirectIntake(parseIntakeCreateCommand(valid))).not.toThrow();
  });

  it('rejects missing, empty, and invalid country fields', () => {
    expect(() => parseIntakeCreateCommand({ ...valid, actor: undefined })).toThrow();
    expect(() =>
      parseIntakeCreateCommand({
        ...valid,
        customerIntent: { ...valid.customerIntent, brandName: '' }
      })
    ).toThrow();
    expect(() =>
      parseIntakeCreateCommand({
        ...valid,
        customerIntent: { ...valid.customerIntent, applicantCountry: 'United Kingdom' }
      })
    ).toThrow();
  });

  it('rejects an unsupported but governed channel relationship combination', () => {
    expect(() =>
      assertDirectIntake(parseIntakeCreateCommand({ ...valid, channel: 'LITE_PROFESSIONAL' }))
    ).toThrow();
  });

  it('requires fixture recommendations to be explicitly marked', () => {
    expect(() => parseRecommendationPackage({ status: 'FINAL', options: [] })).toThrow();
  });
  it('validates integral minor-unit money and A/B/C quote commands', () => {
    expect(parseMoney({ amountMinor: 12345, currency: 'USD' })).toEqual({
      amountMinor: 12345,
      currency: 'USD'
    });
    expect(() => parseMoney({ amountMinor: 12.34, currency: 'USD' })).toThrow();
    expect(() => parseMoney({ amountMinor: -1, currency: 'USD' })).toThrow();
    expect(() => parseFixtureMoney({ amountMinor: 1, currency: 'EUR' })).toThrow();
    expect(
      parseQuoteCreateCommand({
        intakeId: 'intake_test',
        recommendationId: 'recommendation_test',
        selectedOptionCode: 'B',
        actor: valid.actor,
        idempotencyKey: 'quote-key',
        correlationId: 'correlation_test'
      }).selectedOptionCode
    ).toBe('B');
    expect(() =>
      parseQuoteCreateCommand({
        intakeId: 'intake_test',
        recommendationId: 'recommendation_test',
        selectedOptionCode: 'D',
        actor: valid.actor,
        idempotencyKey: 'quote-key',
        correlationId: 'correlation_test'
      })
    ).toThrow();
  });

  it('rejects mixed currencies and non-reconciling Quote totals', () => {
    const quote = {
      quoteId: 'quote_test',
      intakeId: 'intake_test',
      recommendationId: 'recommendation_test',
      selectedOptionCode: 'A',
      pricingRuleVersion: 'fixture-usd-v1',
      status: 'READY',
      currency: 'USD',
      lines: [
        {
          code: 'official',
          description: 'Official',
          category: 'OFFICIAL_FEE',
          amount: { amountMinor: 100, currency: 'USD' }
        },
        {
          code: 'service',
          description: 'Service',
          category: 'SERVICE_FEE',
          amount: { amountMinor: 200, currency: 'USD' }
        },
        {
          code: 'disbursement',
          description: 'Disbursement',
          category: 'DISBURSEMENT',
          amount: { amountMinor: 30, currency: 'USD' }
        },
        {
          code: 'tax',
          description: 'Tax',
          category: 'TAX',
          amount: { amountMinor: 20, currency: 'USD' }
        }
      ],
      subtotal: { amountMinor: 330, currency: 'USD' },
      estimatedOfficialFees: { amountMinor: 100, currency: 'USD' },
      estimatedServiceFees: { amountMinor: 200, currency: 'USD' },
      estimatedDisbursements: { amountMinor: 30, currency: 'USD' },
      estimatedTaxes: { amountMinor: 20, currency: 'USD' },
      total: { amountMinor: 350, currency: 'USD' },
      assumptions: [],
      limitations: [],
      validUntil: '2026-08-10T00:00:00.000Z',
      fixtureOnly: true,
      createdAt: '2026-07-27T00:00:00.000Z'
    } as Quote;
    expect(() => assertQuoteMoneyInvariants(quote)).not.toThrow();
    expect(() =>
      assertQuoteMoneyInvariants({ ...quote, total: { amountMinor: 351, currency: 'USD' } })
    ).toThrow(/total/);
    expect(() =>
      assertQuoteMoneyInvariants({
        ...quote,
        lines: [
          { ...quote.lines[0]!, amount: { amountMinor: 100, currency: 'EUR' } },
          ...quote.lines.slice(1)
        ]
      })
    ).toThrow(/currency|USD/);
  });
});
