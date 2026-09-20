import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  proposeUsTrademarkCitationFactCandidateV1,
  validateUsTrademarkCitationFactCandidateV1
} from '../../../packages/contracts/src/brain-us-trademark-citation-extraction-method.js';
import { parseFactCandidateV1, type FactCandidateV1 } from '@markorbit/contracts/fact-candidate-v1';
import {
  US_CITATION_ADMISSION_CONTRACT_VERSION,
  UsCitationAdmissionError,
  createUsCitationAdmissionBridge
} from '../src/us-citation-fact-admission.js';

const selectedText =
  'Registration of the applied-for mark is refused because of a likelihood of confusion with the marks in U.S. Registration Nos. 7265161, 7265172, and 7265187.';
const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

function validatedCandidate(): FactCandidateV1 {
  const proposed = proposeUsTrademarkCitationFactCandidateV1({
    candidateId: 'fac_01ARZ3NDEKTSV4RRFFQ69G5FAY',
    producedAt: '2026-09-20T06:00:00.000Z',
    eventDate: '2026-07-22',
    subjectApplicationNumber: '99047647',
    citedRegistrationNumber: '7265161',
    sourceDocument: {
      owner: 'MARKORBIT_KNOWLEDGE',
      sourceId: 'src_01M2X01CES1FAEVW3GWCC075J6',
      documentId: 'art_01M2XWP58XJ8SXW7XYBR3BA55Q',
      documentVersion: 1,
      documentSha256: 'eae8d5d049f3efef0b2e055d1b8e9ef4fdea38f1c9d14ab4703a39e081c013f3',
      sourceUri:
        'https://tsdrsec.uspto.gov/ts/cd/tmcasedoc/downloadproxy?url=/api/casedoc/cms/case/99047647/office-action/OfficeAction8740681.pdf'
    },
    evidenceLocator: {
      locatorType: 'PAGE_TEXT_RANGE',
      pageNumber: 3,
      startOffset: 0,
      endOffset: selectedText.length,
      textSha256: sha(selectedText)
    },
    selectedText
  });
  const result = validateUsTrademarkCitationFactCandidateV1(proposed, {
    selectedText,
    decidedAt: '2026-09-20T06:01:00.000Z'
  });
  if (result.status !== 'VALIDATED') throw new Error('US citation candidate did not validate');
  return result.candidate;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

const admittedReceipt = {
  outcome: 'ADMITTED',
  data_engine_fact_id: 'rel_7f1dae03758987631c6fdccac973a33e',
  data_engine_contract_version: US_CITATION_ADMISSION_CONTRACT_VERSION,
  replayed: false
};

describe('US citation Fact Candidate admission bridge', () => {
  it('transitions the real-OA-shaped VALIDATED candidate to ADMITTED', async () => {
    const candidate = validatedCandidate();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(admittedReceipt));
    const bridge = createUsCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal/',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl,
      now: () => new Date('2026-09-20T06:02:00.000Z')
    });

    const result = await bridge.admit(candidate);

    expect(result.ingestion).toEqual({
      status: 'ADMITTED',
      validation: candidate.ingestion.validation,
      admission: {
        outcome: 'ADMITTED',
        dataEngineFactId: admittedReceipt.data_engine_fact_id,
        dataEngineContractVersion: US_CITATION_ADMISSION_CONTRACT_VERSION,
        decidedAt: '2026-09-20T06:02:00.000Z',
        reasonCode: null
      }
    });
    expect(result.candidateFingerprintSha256).toBe(candidate.candidateFingerprintSha256);
    expect(parseFactCandidateV1(result)).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://data-engine.internal/api/admin/v2/fact-admissions/us/citation-relations'
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer ' + 'k'.repeat(32) });
    expect(JSON.parse(init?.body as string)).toEqual(candidate);
  });

  it('accepts an idempotent replay receipt', async () => {
    const bridge = createUsCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ ...admittedReceipt, replayed: true })),
      now: () => new Date('2026-09-20T06:02:00.000Z')
    });

    const result = await bridge.admit(validatedCandidate());
    expect(result.ingestion.status).toBe('ADMITTED');
    expect(result.ingestion.admission?.dataEngineFactId).toBe(admittedReceipt.data_engine_fact_id);
  });

  it('rejects a PROPOSED candidate before calling Data Engine', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const bridge = createUsCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl
    });
    const proposed = proposeUsTrademarkCitationFactCandidateV1({
      candidateId: 'fac_01ARZ3NDEKTSV4RRFFQ69G5FAY',
      producedAt: '2026-09-20T06:00:00.000Z',
      eventDate: '2026-07-22',
      subjectApplicationNumber: '99047647',
      citedRegistrationNumber: '7265161',
      sourceDocument: validatedCandidate().sourceDocument,
      evidenceLocator: {
        locatorType: 'PAGE_TEXT_RANGE',
        pageNumber: 3,
        startOffset: 0,
        endOffset: selectedText.length,
        textSha256: sha(selectedText)
      },
      selectedText
    });

    await expect(bridge.admit(proposed)).rejects.toMatchObject({
      code: 'INVALID_CANDIDATE_STATE'
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed on malformed, auth, and network provider outcomes', async () => {
    const candidate = validatedCandidate();
    const before = structuredClone(candidate);

    const malformed = createUsCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ ...admittedReceipt, data_engine_contract_version: 'WRONG' })
        )
    });
    await expect(malformed.admit(candidate)).rejects.toMatchObject({
      code: 'ADMISSION_CONTRACT_MISMATCH'
    });

    const unauthorized = createUsCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 401))
    });
    await expect(unauthorized.admit(candidate)).rejects.toMatchObject({
      code: 'ADMISSION_AUTH_FAILED'
    });

    const unavailable = createUsCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))
    });
    await expect(unavailable.admit(candidate)).rejects.toMatchObject({
      code: 'ADMISSION_UNAVAILABLE'
    });
    expect(candidate).toEqual(before);
  });

  it('maps only explicit provider rejection into candidate REJECTED state', async () => {
    const bridge = createUsCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            detail: {
              code: 'DATA_ENGINE_FACT_ADMISSION_REJECTED',
              message: 'candidate fingerprint mismatch',
              retryable: false
            }
          },
          400
        )
      ),
      now: () => new Date('2026-09-20T06:02:00.000Z')
    });

    const result = await bridge.admit(validatedCandidate());

    expect(result.ingestion.status).toBe('REJECTED');
    expect(result.ingestion.admission?.reasonCode).toBe('DATA_ENGINE_ADMISSION_REJECTED');
    expect(parseFactCandidateV1(result)).not.toBeNull();
  });
  it('requires dedicated admission configuration', () => {
    expect(() =>
      createUsCitationAdmissionBridge({
        dataEngineUrl: 'https://data-engine.internal',
        admissionApiKey: 'short'
      })
    ).toThrowError(UsCitationAdmissionError);
  });
});
