import {
  canTransitionFactCandidateStatusV1,
  parseFactCandidateV1,
  type FactCandidateV1
} from '@markorbit/contracts/fact-candidate-v1';

export const US_CITATION_ADMISSION_CONTRACT_VERSION = 'MARKORBIT_TEMPORAL_RELATIONSHIP_V1' as const;
export const US_CITATION_ADMISSION_PATH =
  '/api/admin/v2/fact-admissions/us/citation-relations' as const;

export type UsCitationAdmissionErrorCode =
  | 'INVALID_CANDIDATE_STATE'
  | 'ADMISSION_CONFIGURATION_INVALID'
  | 'ADMISSION_UNAVAILABLE'
  | 'ADMISSION_AUTH_FAILED'
  | 'ADMISSION_CONTRACT_MISMATCH';

export class UsCitationAdmissionError extends Error {
  constructor(
    readonly code: UsCitationAdmissionErrorCode,
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'UsCitationAdmissionError';
  }
}

export interface UsCitationAdmissionBridgeOptions {
  dataEngineUrl: string;
  admissionApiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

interface AdmissionReceipt {
  outcome: 'ADMITTED';
  data_engine_fact_id: string;
  data_engine_contract_version: string;
  replayed: boolean;
}

const factId = /^[A-Za-z][A-Za-z0-9_-]{2,127}$/u;
const reasonCode = 'DATA_ENGINE_ADMISSION_REJECTED' as const;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every((key) => actual.includes(key));
}

function baseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/u, '');
  if (!normalized)
    throw new UsCitationAdmissionError(
      'ADMISSION_CONFIGURATION_INVALID',
      'Data Engine admission URL is required.'
    );
  return normalized;
}

function parseReceipt(value: unknown): AdmissionReceipt | null {
  if (
    !record(value) ||
    !exactKeys(value, [
      'outcome',
      'data_engine_fact_id',
      'data_engine_contract_version',
      'replayed'
    ]) ||
    value.outcome !== 'ADMITTED' ||
    typeof value.data_engine_fact_id !== 'string' ||
    !factId.test(value.data_engine_fact_id) ||
    value.data_engine_contract_version !== US_CITATION_ADMISSION_CONTRACT_VERSION ||
    typeof value.replayed !== 'boolean'
  )
    return null;
  return value as unknown as AdmissionReceipt;
}

function parseProviderRejection(value: unknown): boolean {
  if (!record(value) || !record(value.detail)) return false;
  return (
    value.detail.code === 'DATA_ENGINE_FACT_ADMISSION_REJECTED' &&
    typeof value.detail.message === 'string' &&
    value.detail.retryable === false
  );
}

function requireValidatedCandidate(value: unknown): FactCandidateV1 {
  const candidate = parseFactCandidateV1(value);
  if (
    !candidate ||
    candidate.jurisdiction !== 'US' ||
    candidate.factType !== 'CITED_AS_REFERENCE_FOR_REFUSAL' ||
    candidate.ingestion.status !== 'VALIDATED' ||
    candidate.ingestion.validation?.outcome !== 'ACCEPTED' ||
    !canTransitionFactCandidateStatusV1(candidate.ingestion.status, 'ADMITTED')
  ) {
    throw new UsCitationAdmissionError(
      'INVALID_CANDIDATE_STATE',
      'US citation admission requires a valid VALIDATED candidate.'
    );
  }
  return candidate;
}

function transitioned(
  candidate: FactCandidateV1,
  admission:
    | {
        outcome: 'ADMITTED';
        dataEngineFactId: string;
        dataEngineContractVersion: string;
        decidedAt: string;
        reasonCode: null;
      }
    | {
        outcome: 'REJECTED';
        dataEngineFactId: null;
        dataEngineContractVersion: string;
        decidedAt: string;
        reasonCode: typeof reasonCode;
      }
): FactCandidateV1 {
  const next: FactCandidateV1 = {
    ...structuredClone(candidate),
    ingestion: {
      status: admission.outcome === 'ADMITTED' ? 'ADMITTED' : 'REJECTED',
      validation: structuredClone(candidate.ingestion.validation),
      admission
    }
  };
  const parsed = parseFactCandidateV1(next);
  if (!parsed)
    throw new UsCitationAdmissionError(
      'ADMISSION_CONTRACT_MISMATCH',
      'Admission transition produced an invalid Fact Candidate V1.'
    );
  return parsed;
}

export function createUsCitationAdmissionBridge(options: UsCitationAdmissionBridgeOptions) {
  const origin = baseUrl(options.dataEngineUrl);
  const apiKey = options.admissionApiKey.trim();
  if (apiKey.length < 32)
    throw new UsCitationAdmissionError(
      'ADMISSION_CONFIGURATION_INVALID',
      'Data Engine admission API key must be at least 32 characters.'
    );
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = Math.max(options.timeoutMs ?? 5_000, 1);
  const now = options.now ?? (() => new Date());

  return {
    async admit(value: unknown): Promise<Readonly<FactCandidateV1>> {
      const candidate = requireValidatedCandidate(value);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(origin + US_CITATION_ADMISSION_PATH, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: 'Bearer ' + apiKey
          },
          body: JSON.stringify(candidate),
          signal: controller.signal
        });
      } catch {
        throw new UsCitationAdmissionError(
          'ADMISSION_UNAVAILABLE',
          'Data Engine citation admission is unavailable.'
        );
      } finally {
        clearTimeout(timer);
      }

      const body: unknown = await response.json().catch(() => undefined);
      const decidedAt = now().toISOString();
      if (response.ok) {
        const receipt = parseReceipt(body);
        if (!receipt)
          throw new UsCitationAdmissionError(
            'ADMISSION_CONTRACT_MISMATCH',
            'Data Engine citation admission receipt is invalid.',
            response.status
          );
        return transitioned(candidate, {
          outcome: 'ADMITTED',
          dataEngineFactId: receipt.data_engine_fact_id,
          dataEngineContractVersion: receipt.data_engine_contract_version,
          decidedAt,
          reasonCode: null
        });
      }

      if (response.status === 400 && parseProviderRejection(body)) {
        return transitioned(candidate, {
          outcome: 'REJECTED',
          dataEngineFactId: null,
          dataEngineContractVersion: US_CITATION_ADMISSION_CONTRACT_VERSION,
          decidedAt,
          reasonCode
        });
      }
      if (response.status === 401 || response.status === 403)
        throw new UsCitationAdmissionError(
          'ADMISSION_AUTH_FAILED',
          'Data Engine citation admission authorization failed.',
          response.status
        );
      throw new UsCitationAdmissionError(
        'ADMISSION_UNAVAILABLE',
        'Data Engine citation admission did not complete.',
        response.status
      );
    }
  };
}

export type UsCitationAdmissionBridge = ReturnType<typeof createUsCitationAdmissionBridge>;
