import { describe, expect, it } from 'vitest';
import {
  parseTrademarkIntelligenceMethodFamilyV1,
  trademarkIntelligenceMethodFamiliesV1
} from '../src/trademark-intelligence-method-family-v1.js';

describe('trademark intelligence method families v1', () => {
  it('freezes seven research-only families without activation', () => {
    expect(trademarkIntelligenceMethodFamiliesV1).toHaveLength(7);
    for (const item of trademarkIntelligenceMethodFamiliesV1) {
      expect(parseTrademarkIntelligenceMethodFamilyV1({ ...item })).toBe(item);
      expect(item.lifecycle).toBe('RESEARCH_ONLY');
      expect(item.activationEligible).toBe(false);
      expect(item.capabilityExecutionEnabled).toBe(false);
      expect(item.canProduceOfficialFact).toBe(false);
      expect(item.legalConclusionAllowed).toBe(false);
    }
  });

  it('allows citation extraction to produce only evidence-bound Fact Candidates', () => {
    const citations = trademarkIntelligenceMethodFamiliesV1.filter(
      (item) => item.outputClass === 'CITATION_FACT_CANDIDATE'
    );
    expect(citations.map((item) => item.familyId)).toEqual([
      'US_CITATION_EXTRACTION',
      'CN_CITATION_EXTRACTION'
    ]);
    for (const item of citations) {
      expect(item.factCandidateType).toBe('CITED_AS_REFERENCE_FOR_REFUSAL');
      expect(item.canProduceFactCandidate).toBe(true);
      expect(item.requiredInputs).toContain('KNOWLEDGE_OFFICIAL_DOCUMENT_VERSION');
      expect(item.requiredInputs).toContain('EXACT_EVIDENCE_LOCATOR');
    }
  });

  it('keeps defensive risk downstream of admitted objective facts', () => {
    const risk = trademarkIntelligenceMethodFamiliesV1.at(-1)!;
    expect(risk.outputClass).toBe('RISK_ANALYSIS');
    expect(risk.requiresAdmittedObjectiveFacts).toBe(true);
    expect(risk.requiredInputs).toContain('DATA_ENGINE_ADMITTED_CITATION_FACT');
    expect(risk.canProduceFactCandidate).toBe(false);
  });

  it('fails closed for unknown fields or activation mutations', () => {
    const first = trademarkIntelligenceMethodFamiliesV1[0];
    expect(() =>
      parseTrademarkIntelligenceMethodFamilyV1({ ...first, unexpected: true })
    ).toThrow();
    expect(() =>
      parseTrademarkIntelligenceMethodFamilyV1({ ...first, activationEligible: true })
    ).toThrow();
    expect(() => parseTrademarkIntelligenceMethodFamilyV1({ familyId: 'UNKNOWN' })).toThrow();
  });
});
