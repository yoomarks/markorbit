import { describe, expect, it } from 'vitest';
import {
  MethodOutcomeEvidenceContractError,
  assertMatterIntelligenceReviewTaxonomy,
  parseMarkRegMatterIntelligenceReviewSourceAssertionV1
} from '../src/method-outcome-evidence.js';

function assertion() {
  return {
    schemaVersion: 1,
    source: {
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceId: 'matter-intelligence-review_one',
      sourceVersion: 1,
      sourceFingerprintSha256: 'a'.repeat(64),
      observedAt: '2026-08-30T03:00:00.000Z'
    },
    workspaceId: '11111111-1111-4111-8111-111111111111',
    formalMatter: { id: 'formal-matter_one', version: 1 },
    reviewedObservation: {
      id: 'matter-intelligence-observation_one',
      fingerprintSha256: 'b'.repeat(64),
      outputFingerprintSha256: 'c'.repeat(64)
    },
    review: {
      outcome: 'OVERRIDDEN',
      reasonCode: 'METHOD_OUTPUT_INCORRECT',
      rationale: 'Independent review found a deterministic band mismatch.',
      reviewerPrincipalId: 'user_reviewer',
      reviewerMembershipId: 'membership_reviewer',
      reviewedAt: '2026-08-30T03:00:00.000Z'
    },
    production: {
      capability: {
        id: 'interpretation.cn-completed-duration-historical-band',
        version: '1.0.0',
        returnId: 'capability-return_one',
        sessionReceiptId: 'session-receipt_one'
      },
      methodPackageRef: 'brain-method-package:package_one',
      methodRef: 'brain-method:method_one',
      methodVersionRef: 'brain-method-version:method-version_one',
      evaluationRef: 'brain-method-evaluation:evaluation_one',
      researchDatasetRef: 'research-dataset:dataset_one',
      inputFingerprintSha256: 'd'.repeat(64),
      outputFingerprintSha256: 'c'.repeat(64),
      evidenceFingerprintSha256: 'e'.repeat(64)
    }
  };
}

describe('Method Outcome Evidence source contract', () => {
  it('parses a compact MarkReg source assertion without product lifecycle payloads', () => {
    const parsed = parseMarkRegMatterIntelligenceReviewSourceAssertionV1(assertion());
    expect(parsed.source).toMatchObject({
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceVersion: 1
    });
    expect(parsed.review).toMatchObject({
      outcome: 'OVERRIDDEN',
      reasonCode: 'METHOD_OUTPUT_INCORRECT'
    });
    expect(parsed.production.capability.returnId).toBe('capability-return_one');
    expect(parsed).not.toHaveProperty('customer');
    expect(parsed).not.toHaveProperty('order');
    expect(parsed).not.toHaveProperty('payment');
    expect(parsed.formalMatter).toEqual({ id: 'formal-matter_one', version: 1 });
  });

  it('enforces the review outcome/reason taxonomy', () => {
    expect(() =>
      assertMatterIntelligenceReviewTaxonomy(
        'CONFIRMED_AS_PRESENTED',
        'INDEPENDENT_REVIEW_CONFIRMED'
      )
    ).not.toThrow();
    expect(() =>
      assertMatterIntelligenceReviewTaxonomy('INCONCLUSIVE', 'INSUFFICIENT_EVIDENCE')
    ).not.toThrow();
    expect(() =>
      assertMatterIntelligenceReviewTaxonomy('OVERRIDDEN', 'PRODUCT_OR_WORKFLOW_PREFERENCE')
    ).not.toThrow();
    expect(() =>
      assertMatterIntelligenceReviewTaxonomy('CONFIRMED_AS_PRESENTED', 'METHOD_OUTPUT_INCORRECT')
    ).toThrow(MethodOutcomeEvidenceContractError);
    expect(() =>
      assertMatterIntelligenceReviewTaxonomy('OVERRIDDEN', 'INSUFFICIENT_EVIDENCE')
    ).toThrow(MethodOutcomeEvidenceContractError);
  });

  it('fails closed on provenance drift, extra product fields and fingerprint mismatch', () => {
    const wrongFingerprint = assertion();
    wrongFingerprint.production.outputFingerprintSha256 = 'f'.repeat(64);
    expect(() => parseMarkRegMatterIntelligenceReviewSourceAssertionV1(wrongFingerprint)).toThrow(
      /output fingerprints must match/i
    );

    const extra = { ...assertion(), customer: { id: 'customer_secret' } };
    expect(() => parseMarkRegMatterIntelligenceReviewSourceAssertionV1(extra)).toThrow(
      /unsupported fields/i
    );

    const wrongSource = assertion();
    wrongSource.source.owner = 'CAPABILITY' as never;
    expect(() => parseMarkRegMatterIntelligenceReviewSourceAssertionV1(wrongSource)).toThrow(
      /MARKREG MATTER_INTELLIGENCE_REVIEW/i
    );
  });
});
