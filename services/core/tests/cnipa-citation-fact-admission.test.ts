import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { parseFactCandidateV1, type FactCandidateV1 } from '@markorbit/contracts/fact-candidate-v1';
import {
  CNIPA_CITATION_ADMISSION_CONTRACT_VERSION,
  CnipaCitationAdmissionError,
  createCnipaCitationAdmissionBridge
} from '../src/cnipa-citation-fact-admission.js';
import {
  produceCnipaCitationFactCandidateV1,
  type CnipaCitationCandidateInput
} from '../src/cnipa-citation-fact-candidate.js';

const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

function producerInput(): CnipaCitationCandidateInput {
  const selectedOfficialText = '经审查，引证第12345678号注册商标，相关商品构成近似。';
  return {
    candidateId: 'fac_01ARZ3NDEKTSV4RRFFQ69G5FAY',
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
    confidenceScoreBasisPoints: 9800
  };
}

function validatedCandidate(): FactCandidateV1 {
  const proposed = produceCnipaCitationFactCandidateV1(producerInput());
  const candidate = {
    ...structuredClone(proposed),
    ingestion: {
      status: 'VALIDATED' as const,
      validation: {
        outcome: 'ACCEPTED' as const,
        validatorId: 'cn-citation-validator',
        validatorVersion: '1.0.0',
        decidedAt: '2026-09-18T16:00:00.000Z',
        reasonCode: null
      },
      admission: null
    }
  };
  const parsed = parseFactCandidateV1(candidate);
  if (!parsed) throw new Error('test fixture did not produce a valid VALIDATED candidate');
  return parsed;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

const admittedReceipt = {
  outcome: 'ADMITTED',
  data_engine_fact_id: 'cn_citation_1835061cebbcae850978c9ff9716bd2c',
  data_engine_contract_version: CNIPA_CITATION_ADMISSION_CONTRACT_VERSION,
  replayed: false
};

describe('CNIPA citation Fact Candidate admission bridge', () => {
  it('transitions a VALIDATED candidate to ADMITTED from the exact provider receipt', async () => {
    const candidate = validatedCandidate();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(admittedReceipt));
    const bridge = createCnipaCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal/',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl,
      now: () => new Date('2026-09-18T17:00:00.000Z')
    });

    const result = await bridge.admit(candidate);

    expect(result.ingestion).toEqual({
      status: 'ADMITTED',
      validation: candidate.ingestion.validation,
      admission: {
        outcome: 'ADMITTED',
        dataEngineFactId: admittedReceipt.data_engine_fact_id,
        dataEngineContractVersion: CNIPA_CITATION_ADMISSION_CONTRACT_VERSION,
        decidedAt: '2026-09-18T17:00:00.000Z',
        reasonCode: null
      }
    });
    expect(result.candidateFingerprintSha256).toBe(candidate.candidateFingerprintSha256);
    expect(parseFactCandidateV1(result)).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://data-engine.internal/api/admin/v2/fact-admissions/cn/citation-relations'
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer ' + 'k'.repeat(32) });
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual(candidate);
  });

  it('accepts a replayed provider receipt with the same ADMITTED semantics', async () => {
    const candidate = validatedCandidate();
    const bridge = createCnipaCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ ...admittedReceipt, replayed: true })),
      now: () => new Date('2026-09-18T17:00:00.000Z')
    });

    const result = await bridge.admit(candidate);

    expect(result.ingestion.status).toBe('ADMITTED');
    expect(result.ingestion.admission?.dataEngineFactId).toBe(admittedReceipt.data_engine_fact_id);
  });

  it('rejects non-VALIDATED candidates before calling Data Engine', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const bridge = createCnipaCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl
    });

    await expect(
      bridge.admit(produceCnipaCitationFactCandidateV1(producerInput()))
    ).rejects.toMatchObject({ code: 'INVALID_CANDIDATE_STATE' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed on a malformed provider receipt without mutating the candidate', async () => {
    const candidate = validatedCandidate();
    const before = structuredClone(candidate);
    const bridge = createCnipaCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ ...admittedReceipt, data_engine_contract_version: 'WRONG' })
        )
    });

    await expect(bridge.admit(candidate)).rejects.toMatchObject({
      code: 'ADMISSION_CONTRACT_MISMATCH'
    });
    expect(candidate).toEqual(before);
  });

  it('maps only the explicit provider candidate rejection to REJECTED', async () => {
    const candidate = validatedCandidate();
    const bridge = createCnipaCitationAdmissionBridge({
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
      now: () => new Date('2026-09-18T17:00:00.000Z')
    });

    const result = await bridge.admit(candidate);

    expect(result.ingestion.status).toBe('REJECTED');
    expect(result.ingestion.admission).toEqual({
      outcome: 'REJECTED',
      dataEngineFactId: null,
      dataEngineContractVersion: CNIPA_CITATION_ADMISSION_CONTRACT_VERSION,
      decidedAt: '2026-09-18T17:00:00.000Z',
      reasonCode: 'DATA_ENGINE_ADMISSION_REJECTED'
    });
    expect(parseFactCandidateV1(result)).not.toBeNull();
  });

  it('keeps network and authorization failures outside the candidate lifecycle', async () => {
    const candidate = validatedCandidate();
    const before = structuredClone(candidate);
    const unavailable = createCnipaCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))
    });
    await expect(unavailable.admit(candidate)).rejects.toMatchObject({
      code: 'ADMISSION_UNAVAILABLE'
    });
    expect(candidate).toEqual(before);

    const unauthorized = createCnipaCitationAdmissionBridge({
      dataEngineUrl: 'https://data-engine.internal',
      admissionApiKey: 'k'.repeat(32),
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 401))
    });
    await expect(unauthorized.admit(candidate)).rejects.toMatchObject({
      code: 'ADMISSION_AUTH_FAILED'
    });
    expect(candidate).toEqual(before);
  });

  it('requires dedicated admission configuration', () => {
    expect(() =>
      createCnipaCitationAdmissionBridge({
        dataEngineUrl: 'https://data-engine.internal',
        admissionApiKey: 'short'
      })
    ).toThrowError(CnipaCitationAdmissionError);
  });
});
