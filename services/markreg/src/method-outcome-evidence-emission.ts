import {
  MethodOutcomeEvidenceContractError,
  parseMethodOutcomeEvidenceAdmissionV1,
  parseMethodOutcomeEvidenceV1,
  type MethodOutcomeEvidenceAdmissionV1,
  type MethodOutcomeEvidenceV1
} from '@markorbit/contracts/method-outcome-evidence';
import type { QueryClient } from '@markorbit/persistence';
import {
  MatterIntelligenceReviewError,
  matterIntelligenceObservationFingerprintFromRow,
  type MarkRegMatterIntelligenceReviewV1
} from './matter-intelligence-review.js';

export interface MethodOutcomeEvidenceEmissionResultV1 {
  evidence: Readonly<MethodOutcomeEvidenceV1>;
  replayed: boolean;
}

export interface MethodOutcomeEvidenceAdmissionClientV1 {
  admit(
    value: Readonly<MethodOutcomeEvidenceAdmissionV1>
  ): Promise<Readonly<MethodOutcomeEvidenceEmissionResultV1>>;
}

export interface MarkRegMethodOutcomeEvidenceSourceV1 {
  build(
    review: Readonly<MarkRegMatterIntelligenceReviewV1>
  ): Promise<Readonly<MethodOutcomeEvidenceAdmissionV1>>;
}

type ObservationRow = Record<string, unknown>;

function text(row: ObservationRow, field: string): string {
  const value = row[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new MatterIntelligenceReviewError(
      'OUTCOME_EVIDENCE_CONTRACT_MISMATCH',
      `Persisted MarkReg observation field ${field} is missing.`,
      502
    );
  }
  return value.trim();
}

function positiveInteger(row: ObservationRow, field: string): number {
  const value = Number(row[field]);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MatterIntelligenceReviewError(
      'OUTCOME_EVIDENCE_CONTRACT_MISMATCH',
      `Persisted MarkReg observation field ${field} is invalid.`,
      502
    );
  }
  return value;
}

export class PostgresMarkRegMethodOutcomeEvidenceSourceV1 implements MarkRegMethodOutcomeEvidenceSourceV1 {
  constructor(private readonly query: QueryClient) {}

  async build(
    review: Readonly<MarkRegMatterIntelligenceReviewV1>
  ): Promise<Readonly<MethodOutcomeEvidenceAdmissionV1>> {
    let result;
    try {
      result = await this.query.query(
        'SELECT * FROM markreg_matter_intelligence_observations WHERE workspace_id=$1 AND formal_matter_id=$2 AND matter_intelligence_observation_id=$3',
        [review.workspaceId, review.formalMatterId, review.matterIntelligenceObservationId]
      );
    } catch (cause) {
      throw new MatterIntelligenceReviewError(
        'OUTCOME_EVIDENCE_UNAVAILABLE',
        'MarkReg outcome evidence source is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!result.rowCount) {
      throw new MatterIntelligenceReviewError(
        'OUTCOME_EVIDENCE_REJECTED',
        'The reviewed MarkReg observation no longer resolves under the exact product identity.',
        409
      );
    }

    const row = result.rows[0] as ObservationRow;
    const fingerprint = matterIntelligenceObservationFingerprintFromRow(row);
    if (fingerprint !== review.observationFingerprintSha256) {
      throw new MatterIntelligenceReviewError(
        'OUTCOME_EVIDENCE_REJECTED',
        'The persisted MarkReg observation fingerprint no longer matches the authoritative review.',
        409
      );
    }

    const raw = {
      schemaVersion: 1,
      workspaceId: review.workspaceId,
      source: {
        owner: 'MARKREG',
        kind: 'MATTER_INTELLIGENCE_REVIEW',
        sourceId: review.matterIntelligenceReviewId,
        sourceVersion: review.reviewVersion,
        sourceFingerprintSha256: review.productSourceFingerprintSha256
      },
      formalMatter: {
        id: review.formalMatterId,
        version: positiveInteger(row, 'formal_matter_version')
      },
      observation: {
        id: review.matterIntelligenceObservationId,
        fingerprintSha256: review.observationFingerprintSha256,
        outputFingerprintSha256: text(row, 'output_fingerprint_sha256')
      },
      review: {
        id: review.matterIntelligenceReviewId,
        version: review.reviewVersion,
        fingerprintSha256: review.reviewFingerprintSha256,
        outcome: review.outcome,
        ...(review.reason === undefined ? {} : { reason: review.reason }),
        reviewedByPrincipalId: review.reviewedByPrincipalId,
        reviewedAt: review.reviewedAt
      },
      capability: {
        id: text(row, 'capability_id'),
        version: text(row, 'capability_version'),
        requestId: text(row, 'capability_request_id'),
        returnId: text(row, 'capability_return_id'),
        outcomeId: text(row, 'capability_outcome_id'),
        invocationId: text(row, 'capability_invocation_id'),
        sessionReceiptId: text(row, 'session_receipt_id')
      },
      implementation: {
        id: text(row, 'implementation_profile_id'),
        version: positiveInteger(row, 'implementation_version'),
        key: text(row, 'implementation_key')
      },
      method: {
        packageRef: text(row, 'method_package_ref'),
        methodRef: text(row, 'method_ref'),
        methodVersionRef: text(row, 'method_version_ref'),
        evaluationRef: text(row, 'evaluation_ref'),
        researchDatasetRef: text(row, 'research_dataset_ref'),
        evidenceFingerprintSha256: text(row, 'evidence_fingerprint_sha256'),
        inputFingerprintSha256: text(row, 'input_fingerprint_sha256'),
        outputFingerprintSha256: text(row, 'output_fingerprint_sha256')
      }
    };

    try {
      return parseMethodOutcomeEvidenceAdmissionV1(raw);
    } catch (cause) {
      if (cause instanceof MethodOutcomeEvidenceContractError) {
        throw new MatterIntelligenceReviewError(
          'OUTCOME_EVIDENCE_CONTRACT_MISMATCH',
          `MarkReg cannot emit invalid Method Outcome Evidence: ${cause.message}`,
          502,
          false,
          { cause }
        );
      }
      throw cause;
    }
  }
}

export class HttpCoreMethodOutcomeEvidenceAdmissionClientV1 implements MethodOutcomeEvidenceAdmissionClientV1 {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async admit(
    value: Readonly<MethodOutcomeEvidenceAdmissionV1>
  ): Promise<Readonly<MethodOutcomeEvidenceEmissionResultV1>> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.coreUrl.replace(/\/$/u, '')}/internal/v1/evaluation/method-outcome-evidence`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-workspace-id': value.workspaceId
          },
          body: JSON.stringify(value)
        }
      );
    } catch (cause) {
      throw new MatterIntelligenceReviewError(
        'OUTCOME_EVIDENCE_UNAVAILABLE',
        'Core Method Outcome Evidence admission is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }

    if (!response.ok) {
      const unavailable = response.status >= 500 || response.status === 401;
      throw new MatterIntelligenceReviewError(
        unavailable ? 'OUTCOME_EVIDENCE_UNAVAILABLE' : 'OUTCOME_EVIDENCE_REJECTED',
        unavailable
          ? 'Core Method Outcome Evidence admission is unavailable.'
          : 'Core rejected the exact MarkReg Method Outcome Evidence admission.',
        unavailable ? 503 : 409,
        unavailable
      );
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (cause) {
      throw new MatterIntelligenceReviewError(
        'OUTCOME_EVIDENCE_CONTRACT_MISMATCH',
        'Core Method Outcome Evidence admission returned invalid JSON.',
        502,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new MatterIntelligenceReviewError(
        'OUTCOME_EVIDENCE_CONTRACT_MISMATCH',
        'Core Method Outcome Evidence admission response is invalid.',
        502
      );
    }
    const record = raw as Record<string, unknown>;
    let evidence: MethodOutcomeEvidenceV1;
    try {
      evidence = parseMethodOutcomeEvidenceV1(record.evidence);
    } catch (cause) {
      throw new MatterIntelligenceReviewError(
        'OUTCOME_EVIDENCE_CONTRACT_MISMATCH',
        'Core Method Outcome Evidence response violates contract V1.',
        502,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (
      evidence.workspaceId !== value.workspaceId ||
      evidence.source.sourceId !== value.source.sourceId ||
      evidence.source.sourceVersion !== value.source.sourceVersion ||
      evidence.source.sourceFingerprintSha256 !== value.source.sourceFingerprintSha256
    ) {
      throw new MatterIntelligenceReviewError(
        'OUTCOME_EVIDENCE_CONTRACT_MISMATCH',
        'Core returned Method Outcome Evidence for a different MarkReg source identity.',
        502
      );
    }
    if (typeof record.replayed !== 'boolean') {
      throw new MatterIntelligenceReviewError(
        'OUTCOME_EVIDENCE_CONTRACT_MISMATCH',
        'Core Method Outcome Evidence response is missing replay truth.',
        502
      );
    }
    return { evidence, replayed: record.replayed };
  }
}

export class MarkRegMethodOutcomeEvidenceEmitterV1 {
  constructor(
    private readonly source: MarkRegMethodOutcomeEvidenceSourceV1,
    private readonly core: MethodOutcomeEvidenceAdmissionClientV1
  ) {}

  async emit(
    review: Readonly<MarkRegMatterIntelligenceReviewV1>
  ): Promise<Readonly<MethodOutcomeEvidenceEmissionResultV1>> {
    const admission = await this.source.build(review);
    return this.core.admit(admission);
  }
}
