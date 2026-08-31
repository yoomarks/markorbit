import { describe, expect, it } from 'vitest';
import {
  assertQuoteConfirmableV1,
  assertRecommendationEligibleForQuoteV1,
  noEarlyFunnelAuthorityConsequences,
  noRecommendationSourceAuthorityConsequences,
  parseCreateProductionIntakeCommandV1,
  parseCreateProductionQuoteCommandV1,
  parseCreateUserSelectionCommandV1,
  parseProductionQuoteV1,
  parseProductionRecommendationV1,
  parseQuoteArtifactV1,
  parseRecommendationArtifactV1,
  parseUserSelectionV1
} from '../src/markreg-early-funnel.js';

const fingerprintA = 'a'.repeat(64);
const fingerprintB = 'b'.repeat(64);
const fingerprintC = 'c'.repeat(64);
const fingerprintD = 'd'.repeat(64);
const now = '2026-09-01T00:00:00.000Z';

const intakeCommand = {
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Launch a software brand in the United States.',
    applicant: {
      type: 'ORGANIZATION',
      name: 'Orbit Labs Ltd.',
      country: 'GB'
    },
    trademark: {
      type: 'WORD',
      representationText: 'ORBIT'
    },
    targetJurisdictions: ['US'],
    goodsServices: {
      sourceText: 'Downloadable software for trademark portfolio management.'
    },
    filingGoal: 'Obtain registration for the core software brand.'
  },
  idempotencyKey: 'intake-production-1',
  correlationId: 'correlation_intake-production-1'
};

const recommendation = {
  schemaVersion: 1,
  recommendationId: 'recommendation_production-1',
  workspaceId: 'workspace-385',
  version: 2,
  intake: {
    id: 'intake_production-1',
    version: 3,
    fingerprintSha256: fingerprintA
  },
  admissionClass: 'PRODUCTION_ADMISSIBLE',
  currentness: 'CURRENT',
  source: {
    sourceKind: 'CAPABILITY_RESULT',
    sourceId: 'capability-result:recommendation:1',
    sourceVersion: '1.4.0',
    fingerprintSha256: fingerprintB,
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: now,
    provenanceRefs: ['capability:trademark-application-recommendation@1.4.0'],
    assumptions: ['Customer-supplied goods/services text is materially complete.'],
    limitations: ['No official-office status is inferred.'],
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  },
  options: [
    { code: 'A', title: 'Essential Protection', description: 'Core filing scope.' },
    { code: 'B', title: 'Recommended Protection', description: 'Balanced filing scope.' },
    { code: 'C', title: 'Extended Protection', description: 'Broader filing scope.' }
  ],
  rationale: 'Option B balances the supplied commercial context and requested jurisdiction.',
  assumptions: ['Applicant details are customer supplied.'],
  limitations: ['Recommendation is advisory and not filing authorization.'],
  provenanceRefs: ['intake_production-1@3', 'capability-result:recommendation:1@1.4.0'],
  generatedAt: now,
  fingerprintSha256: fingerprintC,
  authorityConsequences: noEarlyFunnelAuthorityConsequences
};

const selection = {
  schemaVersion: 1,
  selectionId: 'selection_production-1',
  workspaceId: 'workspace-385',
  version: 1,
  status: 'CURRENT',
  recommendation: {
    id: recommendation.recommendationId,
    version: recommendation.version,
    fingerprintSha256: recommendation.fingerprintSha256
  },
  selectedOptionCode: 'B',
  selectedAt: '2026-09-01T00:05:00.000Z',
  fingerprintSha256: fingerprintD,
  authorityConsequences: noEarlyFunnelAuthorityConsequences
};

const quote = {
  schemaVersion: 1,
  quoteId: 'quote_production-1',
  workspaceId: 'workspace-385',
  version: 4,
  admissionClass: 'PRODUCTION_ADMISSIBLE',
  status: 'READY',
  intake: {
    id: 'intake_production-1',
    version: 3,
    fingerprintSha256: fingerprintA
  },
  recommendation: {
    id: recommendation.recommendationId,
    version: recommendation.version,
    fingerprintSha256: recommendation.fingerprintSha256,
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT'
  },
  selection: {
    id: selection.selectionId,
    version: selection.version,
    fingerprintSha256: selection.fingerprintSha256,
    currentness: 'CURRENT'
  },
  pricingSource: {
    sourceKind: 'PRICING_SOURCE',
    sourceId: 'pricing-source:markreg-us-v1',
    sourceVersion: '2026-09-01',
    fingerprintSha256: fingerprintB,
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: now,
    provenanceRefs: ['commercial-price:markreg-us-v1@2026-09-01'],
    assumptions: [],
    limitations: ['Official fees may change before filing.']
  },
  currency: 'USD',
  lines: [
    {
      code: 'official',
      description: 'Estimated official fee',
      category: 'OFFICIAL_FEE',
      amount: { amountMinor: 35000, currency: 'USD' },
      sourceReference: {
        sourceId: 'pricing-source:markreg-us-v1',
        sourceVersion: '2026-09-01'
      }
    },
    {
      code: 'service',
      description: 'Professional service fee',
      category: 'SERVICE_FEE',
      amount: { amountMinor: 29900, currency: 'USD' },
      sourceReference: {
        sourceId: 'pricing-source:markreg-us-v1',
        sourceVersion: '2026-09-01'
      }
    }
  ],
  subtotal: { amountMinor: 64900, currency: 'USD' },
  estimatedOfficialFees: { amountMinor: 35000, currency: 'USD' },
  estimatedServiceFees: { amountMinor: 29900, currency: 'USD' },
  estimatedDisbursements: { amountMinor: 0, currency: 'USD' },
  estimatedTaxes: { amountMinor: 0, currency: 'USD' },
  total: { amountMinor: 64900, currency: 'USD' },
  assumptions: [{ code: 'ONE_CLASS', text: 'Quote covers one class.' }],
  limitations: ['Quote is not an invoice, payment, order, or filing.'],
  validUntil: '2026-09-15T00:00:00.000Z',
  createdAt: '2026-09-01T00:10:00.000Z',
  fingerprintSha256: fingerprintA,
  authorityConsequences: noEarlyFunnelAuthorityConsequences
};

describe('MarkReg early-funnel production contract V1', () => {
  it('parses structured Intake while excluding caller authority identity', () => {
    expect(parseCreateProductionIntakeCommandV1(intakeCommand)).toEqual(intakeCommand);
    for (const authority of ['workspaceId', 'actor', 'actorId', 'workplaceId', 'membershipId']) {
      expect(() =>
        parseCreateProductionIntakeCommandV1({ ...intakeCommand, [authority]: 'attacker' })
      ).toThrow(/trusted authority context/);
    }
  });

  it('keeps fixture/test Recommendation explicit and outside production admission', () => {
    const fixture = {
      ...recommendation,
      admissionClass: 'FIXTURE_TEST',
      source: { ...recommendation.source, admissionClass: 'FIXTURE_TEST' }
    };
    expect(parseRecommendationArtifactV1(fixture).admissionClass).toBe('FIXTURE_TEST');
    expect(() => parseProductionRecommendationV1(fixture)).toThrow(/PRODUCTION_ADMISSIBLE/);
  });

  it('requires exact production Recommendation provenance and false authority consequences', () => {
    expect(parseProductionRecommendationV1(recommendation)).toMatchObject({
      recommendationId: recommendation.recommendationId,
      version: 2,
      intake: { version: 3, fingerprintSha256: fingerprintA },
      source: {
        sourceVersion: '1.4.0',
        fingerprintSha256: fingerprintB,
        admissionClass: 'PRODUCTION_ADMISSIBLE'
      }
    });
    expect(() =>
      parseProductionRecommendationV1({
        ...recommendation,
        source: { ...recommendation.source, fingerprintSha256: undefined }
      })
    ).toThrow(/fingerprint/);
    expect(() =>
      parseProductionRecommendationV1({
        ...recommendation,
        authorityConsequences: {
          ...noEarlyFunnelAuthorityConsequences,
          filingCreated: true
        }
      })
    ).toThrow(/filingCreated/);
    expect(() =>
      parseProductionRecommendationV1({
        ...recommendation,
        source: {
          ...recommendation.source,
          authorityConsequences: {
            ...noRecommendationSourceAuthorityConsequences,
            customerSelectionCreated: true
          }
        }
      })
    ).toThrow(/customerSelectionCreated/);
  });

  it('requires current Recommendation and analytical source before a new Quote', () => {
    expect(assertRecommendationEligibleForQuoteV1(recommendation)).toMatchObject({
      currentness: 'CURRENT'
    });
    expect(() =>
      assertRecommendationEligibleForQuoteV1({
        ...recommendation,
        source: { ...recommendation.source, currentness: 'STALE' }
      })
    ).toThrow(/CURRENT/);
  });

  it('keeps Selection explicit, version-bound and non-authoritative', () => {
    expect(parseUserSelectionV1(selection)).toMatchObject({
      status: 'CURRENT',
      selectedOptionCode: 'B',
      recommendation: { version: 2 }
    });
    const command = {
      schemaVersion: 1,
      recommendationId: recommendation.recommendationId,
      expectedRecommendationVersion: recommendation.version,
      selectedOptionCode: 'B',
      idempotencyKey: 'selection-1',
      correlationId: 'correlation_selection-1'
    };
    expect(parseCreateUserSelectionCommandV1(command)).toEqual(command);
    expect(() =>
      parseCreateUserSelectionCommandV1({ ...command, workspaceId: 'attacker' })
    ).toThrow(/trusted authority context/);
    expect(() =>
      parseCreateUserSelectionCommandV1({ ...command, selectedOptionCode: 'D' })
    ).toThrow(/A, B, or C/);
  });

  it('represents fixture/test Quote truth without admitting it as production', () => {
    const fixture = {
      ...quote,
      admissionClass: 'FIXTURE_TEST',
      recommendation: { ...quote.recommendation, admissionClass: 'FIXTURE_TEST' },
      pricingSource: { ...quote.pricingSource, admissionClass: 'FIXTURE_TEST' }
    };
    expect(parseQuoteArtifactV1(fixture).admissionClass).toBe('FIXTURE_TEST');
    expect(() => parseProductionQuoteV1(fixture)).toThrow(/PRODUCTION_ADMISSIBLE/);
  });

  it('parses a production Quote with exact version/source lineage and integral money', () => {
    expect(parseProductionQuoteV1(quote)).toMatchObject({
      quoteId: quote.quoteId,
      version: 4,
      recommendation: { version: 2, admissionClass: 'PRODUCTION_ADMISSIBLE' },
      selection: { version: 1 },
      pricingSource: { sourceVersion: '2026-09-01', admissionClass: 'PRODUCTION_ADMISSIBLE' },
      total: { amountMinor: 64900, currency: 'USD' }
    });
    expect(() =>
      parseProductionQuoteV1({
        ...quote,
        total: { amountMinor: 649.5, currency: 'USD' }
      })
    ).toThrow(/safe integer/);
    expect(() =>
      parseProductionQuoteV1({
        ...quote,
        total: { amountMinor: 64901, currency: 'USD' }
      })
    ).toThrow(/total/);
    expect(() =>
      parseProductionQuoteV1({
        ...quote,
        lines: [{ ...quote.lines[0], sourceReference: undefined }, quote.lines[1]]
      })
    ).toThrow(/sourceReference/);
  });

  it('admits only current, READY and unexpired production Quote for confirmation', () => {
    expect(assertQuoteConfirmableV1(quote, now)).toMatchObject({ status: 'READY' });
    expect(() => assertQuoteConfirmableV1({ ...quote, status: 'SUPERSEDED' }, now)).toThrow(
      /READY/
    );
    expect(() =>
      assertQuoteConfirmableV1(
        {
          ...quote,
          selection: { ...quote.selection, currentness: 'SUPERSEDED' }
        },
        now
      )
    ).toThrow(/CURRENT/);
    expect(() => assertQuoteConfirmableV1(quote, '2026-09-15T00:00:00.000Z')).toThrow(/expired/);
  });

  it('requires exact source versions on Quote creation and rejects body authority', () => {
    const command = {
      schemaVersion: 1,
      intakeId: 'intake_production-1',
      expectedIntakeVersion: 3,
      recommendationId: recommendation.recommendationId,
      expectedRecommendationVersion: recommendation.version,
      selectionId: selection.selectionId,
      expectedSelectionVersion: selection.version,
      idempotencyKey: 'quote-production-1',
      correlationId: 'correlation_quote-production-1'
    };
    expect(parseCreateProductionQuoteCommandV1(command)).toEqual(command);
    expect(() =>
      parseCreateProductionQuoteCommandV1({ ...command, expectedSelectionVersion: 0 })
    ).toThrow(/positive safe integer/);
    expect(() =>
      parseCreateProductionQuoteCommandV1({ ...command, actor: { actorId: 'attacker' } })
    ).toThrow(/trusted authority context/);
  });
});
