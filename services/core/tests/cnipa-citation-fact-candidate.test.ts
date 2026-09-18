import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CnipaCitationCandidateProducerError,
  produceCnipaCitationFactCandidateV1,
  type CnipaCitationCandidateInput
} from '../src/cnipa-citation-fact-candidate.js';

const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const candidateId = 'fac_01ARZ3NDEKTSV4RRFFQ69G5FAY';

function input(overrides: Partial<CnipaCitationCandidateInput> = {}): CnipaCitationCandidateInput {
  const selectedOfficialText = '经审查，引证第12345678号注册商标，相关商品构成近似。';
  return {
    candidateId,
    producedAt: '2026-09-18T15:50:00.000Z',
    dataEngineFact: {
      jurisdiction: 'CN',
      documentKind: 'REGISTRATION_EXAMINATION',
      sourceRecordId: 'adju-open-001',
      applicationNumber: '202312345678.9',
      registrationNumber: null,
      eventDate: '2026-08-21',
      sourceRowSha256: 'a'.repeat(64)
    },
    knowledgeDocument: {
      owner: 'MARKORBIT_KNOWLEDGE',
      sourceId: 'src_01ARZ3NDEKTSV4RRFFQ69G5FAW',
      documentId: 'std_01ARZ3NDEKTSV4RRFFQ69G5FAZ',
      documentVersion: 2,
      documentSha256: 'c'.repeat(64),
      sourceUri: 'https://pub.sbj.cnipa.gov.cn/document/example',
      documentKind: 'REGISTRATION_EXAMINATION',
      sourceRecordId: 'adju-open-001'
    },
    evidenceLocator: {
      locatorType: 'CANONICAL_TEXT_RANGE',
      startOffset: 188,
      endOffset: 188 + selectedOfficialText.length,
      textSha256: sha(selectedOfficialText)
    },
    selectedOfficialText,
    citedTrademark: {
      resourceType: 'TRADEMARK',
      applicationNumber: null,
      registrationNumber: '12345678'
    },
    extractionMethod: {
      owner: 'MARKORBIT_BRAIN_METHOD',
      methodId: 'cn-trademark-citation-extraction',
      methodVersion: '1.0.0'
    },
    confidenceScoreBasisPoints: 9800,
    ...overrides
  };
}

function expectProducerError(
  run: () => unknown,
  code: CnipaCitationCandidateProducerError['code']
): void {
  try {
    run();
    throw new Error('Expected producer error.');
  } catch (error) {
    expect(error).toBeInstanceOf(CnipaCitationCandidateProducerError);
    expect((error as CnipaCitationCandidateProducerError).code).toBe(code);
  }
}

describe('produceCnipaCitationFactCandidateV1', () => {
  it('produces only a PROPOSED CN official citation candidate with exact lineage', () => {
    const result = produceCnipaCitationFactCandidateV1(input());

    expect(result.contractVersion).toBe('MARKORBIT_FACT_CANDIDATE_V1');
    expect(result.factType).toBe('CITED_AS_REFERENCE_FOR_REFUSAL');
    expect(result.jurisdiction).toBe('CN');
    expect(result.subject).toEqual({
      resourceType: 'TRADEMARK',
      applicationNumber: '202312345678.9',
      registrationNumber: null
    });
    expect(result.object.registrationNumber).toBe('12345678');
    expect(result.sourceAuthority).toBe('DIRECT_OFFICIAL');
    expect(result.sourceDocument.owner).toBe('MARKORBIT_KNOWLEDGE');
    expect(result.ingestion).toEqual({
      status: 'PROPOSED',
      validation: null,
      admission: null
    });
    expect(result.legalConclusion).toBe(false);
  });

  it('supports an explicit cited application number', () => {
    const selectedOfficialText = '该申请与在先申请第202355555555.5号商标文字近似。';
    const result = produceCnipaCitationFactCandidateV1(
      input({
        selectedOfficialText,
        evidenceLocator: {
          locatorType: 'PAGE_TEXT_RANGE',
          pageNumber: 3,
          startOffset: 20,
          endOffset: 20 + selectedOfficialText.length,
          textSha256: sha(selectedOfficialText)
        },
        citedTrademark: {
          resourceType: 'TRADEMARK',
          applicationNumber: '202355555555.5',
          registrationNumber: null
        }
      })
    );

    expect(result.object).toEqual({
      resourceType: 'TRADEMARK',
      applicationNumber: '202355555555.5',
      registrationNumber: null
    });
  });

  it('is fingerprint-deterministic and evidence-bearing changes alter the fingerprint', () => {
    const base = produceCnipaCitationFactCandidateV1(input());
    const replay = produceCnipaCitationFactCandidateV1(input());
    expect(replay.candidateFingerprintSha256).toBe(base.candidateFingerprintSha256);

    const changedDocument = input({
      knowledgeDocument: {
        ...input().knowledgeDocument,
        documentVersion: 3,
        documentSha256: 'd'.repeat(64)
      }
    });
    expect(
      produceCnipaCitationFactCandidateV1(changedDocument).candidateFingerprintSha256
    ).not.toBe(base.candidateFingerprintSha256);

    const changedMethod = input({
      extractionMethod: {
        owner: 'MARKORBIT_BRAIN_METHOD',
        methodId: 'cn-trademark-citation-extraction',
        methodVersion: '1.0.1'
      }
    });
    expect(produceCnipaCitationFactCandidateV1(changedMethod).candidateFingerprintSha256).not.toBe(
      base.candidateFingerprintSha256
    );
  });

  it('fails closed when Knowledge and Data Engine identities do not match', () => {
    expectProducerError(
      () =>
        produceCnipaCitationFactCandidateV1(
          input({
            knowledgeDocument: {
              ...input().knowledgeDocument,
              sourceRecordId: 'different-source-record'
            }
          })
        ),
      'IDENTITY_MISMATCH'
    );
  });

  it('fails closed when selected text does not match its exact evidence hash', () => {
    expectProducerError(
      () =>
        produceCnipaCitationFactCandidateV1(
          input({
            evidenceLocator: {
              ...input().evidenceLocator,
              textSha256: 'f'.repeat(64)
            }
          })
        ),
      'EVIDENCE_MISMATCH'
    );
  });

  it('fails closed when the cited identifier is inferred rather than explicit', () => {
    const selectedOfficialText = '经审查，该申请与一件在先注册商标构成近似。';
    expectProducerError(
      () =>
        produceCnipaCitationFactCandidateV1(
          input({
            selectedOfficialText,
            evidenceLocator: {
              locatorType: 'CANONICAL_TEXT_RANGE',
              startOffset: 0,
              endOffset: selectedOfficialText.length,
              textSha256: sha(selectedOfficialText)
            }
          })
        ),
      'CITED_MARK_NOT_EXPLICIT'
    );
  });

  it('rejects incomplete Knowledge lineage through the shared Fact Candidate contract', () => {
    expectProducerError(
      () =>
        produceCnipaCitationFactCandidateV1(
          input({
            knowledgeDocument: {
              ...input().knowledgeDocument,
              documentVersion: 0
            }
          })
        ),
      'CONTRACT_REJECTED'
    );
  });

  it('requires a Data Engine subject trademark identity', () => {
    expectProducerError(
      () =>
        produceCnipaCitationFactCandidateV1(
          input({
            dataEngineFact: {
              ...input().dataEngineFact,
              applicationNumber: null,
              registrationNumber: null
            }
          })
        ),
      'INVALID_INPUT'
    );
  });
});
