import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  US_TRADEMARK_CITATION_EXTRACTION_METHOD_ID,
  US_TRADEMARK_CITATION_EXTRACTION_METHOD_VERSION,
  containsExplicitUsTrademarkRegistrationCitationV1,
  proposeUsTrademarkCitationFactCandidateV1,
  reproduceUsTrademarkCitationCandidateFingerprintV1,
  usTrademarkCitationExtractionResearchDescriptorV1,
  validateUsTrademarkCitationFactCandidateV1
} from '../src/brain-us-trademark-citation-extraction-method.js';
import { parseFactCandidateV1, type FactCandidateV1 } from '../src/fact-candidate-v1.js';

const SELECTED_TEXT =
  'Registration is refused because of a likelihood of confusion with U.S. Registration No. 6,123,456.';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function input(selectedText = SELECTED_TEXT) {
  return {
    candidateId: 'fac_01ARZ3NDEKTSV4RRFFQ69G5FAX' as const,
    producedAt: '2026-09-19T01:00:00.000Z',
    eventDate: '2026-09-18',
    subjectApplicationNumber: '90817045',
    citedRegistrationNumber: '6123456',
    sourceDocument: {
      owner: 'MARKORBIT_KNOWLEDGE' as const,
      sourceId: 'src_01ARZ3NDEKTSV4RRFFQ69G5FAW',
      documentId: 'std_01ARZ3NDEKTSV4RRFFQ69G5FAV',
      documentVersion: 1,
      documentSha256: 'a'.repeat(64),
      sourceUri: 'https://tsdrapi.uspto.gov/ts/cd/casedoc/sn90817045/OOA20260918090000/download.pdf'
    },
    evidenceLocator: {
      locatorType: 'PAGE_TEXT_RANGE' as const,
      pageNumber: 2,
      startOffset: 128,
      endOffset: 128 + selectedText.length,
      textSha256: sha256(selectedText)
    },
    selectedText
  };
}

describe('US trademark citation extraction research method', () => {
  it('proposes a governed Fact Candidate only from explicit official citation text', () => {
    const candidate = proposeUsTrademarkCitationFactCandidateV1(input());

    expect(candidate.ingestion).toEqual({
      status: 'PROPOSED',
      validation: null,
      admission: null
    });
    expect(candidate.jurisdiction).toBe('US');
    expect(candidate.factType).toBe('CITED_AS_REFERENCE_FOR_REFUSAL');
    expect(candidate.subject).toEqual({
      resourceType: 'TRADEMARK',
      applicationNumber: '90817045',
      registrationNumber: null
    });
    expect(candidate.object).toEqual({
      resourceType: 'TRADEMARK',
      applicationNumber: null,
      registrationNumber: '6123456'
    });
    expect(candidate.extractionMethod).toEqual({
      owner: 'MARKORBIT_BRAIN_METHOD',
      methodId: US_TRADEMARK_CITATION_EXTRACTION_METHOD_ID,
      methodVersion: US_TRADEMARK_CITATION_EXTRACTION_METHOD_VERSION
    });
    expect(parseFactCandidateV1(candidate)).toEqual(candidate);
    expect(reproduceUsTrademarkCitationCandidateFingerprintV1(candidate)).toBe(
      candidate.candidateFingerprintSha256
    );
  });

  it('recognizes common explicit USPTO registration-number wording without treating bare digits as citation evidence', () => {
    expect(
      containsExplicitUsTrademarkRegistrationCitationV1(
        'U.S. Reg. No. 6,123,456 is cited against the applied-for mark.',
        '6123456'
      )
    ).toBe(true);
    expect(
      containsExplicitUsTrademarkRegistrationCitationV1(
        'Registration Number: 6123456 is cited.',
        '6,123,456'
      )
    ).toBe(true);
    expect(
      containsExplicitUsTrademarkRegistrationCitationV1(
        'The number 6123456 appears in unrelated text.',
        '6123456'
      )
    ).toBe(false);
  });

  it('validates a proposed candidate only when the exact selected evidence still reproduces', () => {
    const proposed = proposeUsTrademarkCitationFactCandidateV1(input());
    const result = validateUsTrademarkCitationFactCandidateV1(proposed, {
      selectedText: SELECTED_TEXT,
      decidedAt: '2026-09-19T01:01:00.000Z'
    });

    expect(result.status).toBe('VALIDATED');
    if (result.status !== 'VALIDATED') throw new Error(result.reasonCode);
    expect(result.candidate.ingestion).toEqual({
      status: 'VALIDATED',
      validation: {
        outcome: 'ACCEPTED',
        validatorId: 'citation-candidate-validator',
        validatorVersion: '1.0.0',
        decidedAt: '2026-09-19T01:01:00.000Z',
        reasonCode: null
      },
      admission: null
    });
    expect(result.candidate.candidateFingerprintSha256).toBe(proposed.candidateFingerprintSha256);
    expect(parseFactCandidateV1(result.candidate)).toEqual(result.candidate);
  });

  it('rejects validation when the selected evidence bytes drift', () => {
    const proposed = proposeUsTrademarkCitationFactCandidateV1(input());
    const result = validateUsTrademarkCitationFactCandidateV1(proposed, {
      selectedText: `${SELECTED_TEXT} changed`,
      decidedAt: '2026-09-19T01:01:00.000Z'
    });

    expect(result.status).toBe('REJECTED');
    if (result.status !== 'REJECTED') throw new Error('Expected rejection');
    expect(result.reasonCode).toBe('EVIDENCE_TEXT_HASH_MISMATCH');
    expect(result.candidate.ingestion.status).toBe('REJECTED');
    expect(parseFactCandidateV1(result.candidate)).toEqual(result.candidate);
  });

  it('rejects candidate construction when the exact text does not explicitly cite the requested registration', () => {
    const selectedText =
      'The Office action discusses several records but gives no registration citation.';
    expect(() => proposeUsTrademarkCitationFactCandidateV1(input(selectedText))).toThrowError(
      /does not explicitly cite/
    );
  });

  it('rejects malformed subject identity and stale validation time', () => {
    expect(() =>
      proposeUsTrademarkCitationFactCandidateV1({
        ...input(),
        subjectApplicationNumber: '123'
      })
    ).toThrowError(/exactly 8 digits/);

    const proposed = proposeUsTrademarkCitationFactCandidateV1(input());
    expect(() =>
      validateUsTrademarkCitationFactCandidateV1(proposed, {
        selectedText: SELECTED_TEXT,
        decidedAt: '2026-09-19T00:59:59.000Z'
      })
    ).toThrowError(/cannot precede candidate production/);
  });

  it('remains a research-only family and does not grant Capability or official-fact authority', () => {
    const descriptor = usTrademarkCitationExtractionResearchDescriptorV1();

    expect(descriptor.family.familyId).toBe('US_CITATION_EXTRACTION');
    expect(descriptor.family.lifecycle).toBe('RESEARCH_ONLY');
    expect(descriptor.family.canProduceFactCandidate).toBe(true);
    expect(descriptor.family.canProduceOfficialFact).toBe(false);
    expect(descriptor.family.activationEligible).toBe(false);
    expect(descriptor.family.capabilityExecutionEnabled).toBe(false);
    expect(descriptor.activationEligible).toBe(false);
    expect(descriptor.capabilityExecutionEnabled).toBe(false);
    expect(descriptor.officialFactAuthority).toBe(false);
    expect(descriptor.legalConclusionAllowed).toBe(false);
  });

  it('does not accept already-validated or foreign-method candidates as a fresh validation input', () => {
    const proposed = proposeUsTrademarkCitationFactCandidateV1(input());
    const validated = validateUsTrademarkCitationFactCandidateV1(proposed, {
      selectedText: SELECTED_TEXT,
      decidedAt: '2026-09-19T01:01:00.000Z'
    });
    if (validated.status !== 'VALIDATED') throw new Error(validated.reasonCode);

    expect(() =>
      validateUsTrademarkCitationFactCandidateV1(validated.candidate, {
        selectedText: SELECTED_TEXT,
        decidedAt: '2026-09-19T01:02:00.000Z'
      })
    ).toThrowError(/requires a PROPOSED/);

    const foreign = structuredClone(proposed) as FactCandidateV1;
    foreign.extractionMethod.methodVersion = '2.0.0';
    foreign.candidateFingerprintSha256 =
      reproduceUsTrademarkCitationCandidateFingerprintV1(foreign);
    expect(() =>
      validateUsTrademarkCitationFactCandidateV1(foreign, {
        selectedText: SELECTED_TEXT,
        decidedAt: '2026-09-19T01:02:00.000Z'
      })
    ).toThrowError(/admitted US citation extraction method version/);
  });
});
