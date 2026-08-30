import { createHash, randomUUID } from 'node:crypto';
import {
  MethodOutcomeEvidenceContractError,
  parseMethodOutcomeEvidenceAdmissionV1,
  parseMethodOutcomeEvidenceV1,
  type MethodOutcomeEvidenceAdmissionV1,
  type MethodOutcomeEvidenceV1
} from '@markorbit/contracts/method-outcome-evidence';
import type { ManagedDatabase } from '@markorbit/persistence';

export type MethodOutcomeEvidenceAdmissionErrorCode =
  | 'INVALID_EVIDENCE'
  | 'WORKSPACE_MISMATCH'
  | 'EVIDENCE_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class MethodOutcomeEvidenceAdmissionError extends Error {
  constructor(
    readonly code: MethodOutcomeEvidenceAdmissionErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MethodOutcomeEvidenceAdmissionError';
  }
}

export interface MethodOutcomeEvidenceAdmissionResultV1 {
  evidence: Readonly<MethodOutcomeEvidenceV1>;
  replayed: boolean;
}

export interface MethodOutcomeEvidenceAdmissionRepositoryV1 {
  admit(input: Readonly<PreparedMethodOutcomeEvidenceAdmissionV1>): Promise<MethodOutcomeEvidenceAdmissionResultV1>;
}

export interface PreparedMethodOutcomeEvidenceAdmissionV1 {
  evidence: Readonly<MethodOutcomeEvidenceV1>;
  sourceIdentityFingerprintSha256: string;
}

type EvidenceRow = {
  source_identity_fingerprint_sha256: unknown;
  admission_fingerprint_sha256: unknown;
  evidence_json: unknown;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function admissionFromEvidence(value: Readonly<MethodOutcomeEvidenceV1>): MethodOutcomeEvidenceAdmissionV1 {
  return {
    schemaVersion: value.schemaVersion,
    workspaceId: value.workspaceId,
    source: value.source,
    formalMatter: value.formalMatter,
    observation: value.observation,
    review: value.review,
    capability: value.capability,
    implementation: value.implementation,
    method: value.method
  };
}

export function methodOutcomeEvidenceAdmissionFingerprint(
  value: Readonly<MethodOutcomeEvidenceAdmissionV1>
): string {
  return fingerprint(value);
}

export function methodOutcomeEvidenceSourceIdentityFingerprint(
  value: Readonly<MethodOutcomeEvidenceAdmissionV1>
): string {
  return fingerprint({
    workspaceId: value.workspaceId,
    source: value.source,
    observation: {
      id: value.observation.id,
      fingerprintSha256: value.observation.fingerprintSha256
    },
    review: {
      id: value.review.id,
      version: value.review.version,
      fingerprintSha256: value.review.fingerprintSha256
    }
  });
}

function stored(row: EvidenceRow): MethodOutcomeEvidenceV1 {
  let evidence: MethodOutcomeEvidenceV1;
  try {
    evidence = parseMethodOutcomeEvidenceV1(row.evidence_json);
  } catch (error) {
    throw new MethodOutcomeEvidenceAdmissionError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Method Outcome Evidence violates contract V1.',
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
  const expectedAdmission = methodOutcomeEvidenceAdmissionFingerprint(admissionFromEvidence(evidence));
  const expectedIdentity = methodOutcomeEvidenceSourceIdentityFingerprint(admissionFromEvidence(evidence));
  if (
    row.admission_fingerprint_sha256 !== expectedAdmission ||
    row.source_identity_fingerprint_sha256 !== expectedIdentity ||
    evidence.admissionFingerprintSha256 !== expectedAdmission
  )
    throw new MethodOutcomeEvidenceAdmissionError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Method Outcome Evidence failed integrity verification.'
    );
  return structuredClone(evidence);
}

function postgresCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export class PostgresMethodOutcomeEvidenceAdmissionRepositoryV1
  implements MethodOutcomeEvidenceAdmissionRepositoryV1
{
  constructor(private readonly database: ManagedDatabase) {}

  async admit(
    input: Readonly<PreparedMethodOutcomeEvidenceAdmissionV1>
  ): Promise<MethodOutcomeEvidenceAdmissionResultV1> {
    const value = input.evidence;
    try {
      return await this.database.transact(async (client) => {
        const lockKey = `${value.workspaceId}:${value.review.id}:${value.review.version}`;
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [lockKey]);
        const found = await client.query<EvidenceRow>(
          `SELECT source_identity_fingerprint_sha256,admission_fingerprint_sha256,evidence_json
             FROM core_method_outcome_evidence
            WHERE workspace_id=$1 AND source_id=$2 AND source_version=$3
            LIMIT 1`,
          [value.workspaceId, value.source.sourceId, value.source.sourceVersion]
        );
        const existing = found.rows[0];
        if (existing) {
          if (
            existing.source_identity_fingerprint_sha256 !== input.sourceIdentityFingerprintSha256 ||
            existing.admission_fingerprint_sha256 !== value.admissionFingerprintSha256
          )
            throw new MethodOutcomeEvidenceAdmissionError(
              'EVIDENCE_CONFLICT',
              'The same product outcome source identity is already bound to different bounded evidence.'
            );
          return { evidence: stored(existing), replayed: true };
        }

        await client.query(
          `INSERT INTO core_method_outcome_evidence (
             method_outcome_evidence_id,workspace_id,source_owner,source_kind,source_id,source_version,
             source_fingerprint_sha256,formal_matter_id,formal_matter_version,observation_id,
             observation_fingerprint_sha256,observation_output_fingerprint_sha256,review_id,review_version,
             review_fingerprint_sha256,outcome,reason,reviewed_by_principal_id,reviewed_at,capability_id,
             capability_version,capability_request_id,capability_return_id,capability_outcome_id,
             capability_invocation_id,session_receipt_id,implementation_id,implementation_version,
             implementation_key,method_package_ref,method_ref,method_version_ref,evaluation_ref,
             research_dataset_ref,evidence_fingerprint_sha256,input_fingerprint_sha256,
             output_fingerprint_sha256,source_identity_fingerprint_sha256,admission_fingerprint_sha256,
             evidence_json,admitted_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
             $24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40::jsonb,$41
           )`,
          [
            value.methodOutcomeEvidenceId,
            value.workspaceId,
            value.source.owner,
            value.source.kind,
            value.source.sourceId,
            value.source.sourceVersion,
            value.source.sourceFingerprintSha256,
            value.formalMatter.id,
            value.formalMatter.version,
            value.observation.id,
            value.observation.fingerprintSha256,
            value.observation.outputFingerprintSha256,
            value.review.id,
            value.review.version,
            value.review.fingerprintSha256,
            value.review.outcome,
            value.review.reason ?? null,
            value.review.reviewedByPrincipalId,
            value.review.reviewedAt,
            value.capability.id,
            value.capability.version,
            value.capability.requestId,
            value.capability.returnId,
            value.capability.outcomeId,
            value.capability.invocationId,
            value.capability.sessionReceiptId,
            value.implementation.id,
            value.implementation.version,
            value.implementation.key,
            value.method.packageRef,
            value.method.methodRef,
            value.method.methodVersionRef,
            value.method.evaluationRef,
            value.method.researchDatasetRef,
            value.method.evidenceFingerprintSha256,
            value.method.inputFingerprintSha256,
            value.method.outputFingerprintSha256,
            input.sourceIdentityFingerprintSha256,
            value.admissionFingerprintSha256,
            JSON.stringify(value),
            value.admittedAt
          ]
        );
        return { evidence: structuredClone(value), replayed: false };
      });
    } catch (error) {
      if (error instanceof MethodOutcomeEvidenceAdmissionError) throw error;
      if (postgresCode(error) === '23505')
        throw new MethodOutcomeEvidenceAdmissionError(
          'EVIDENCE_CONFLICT',
          'Method Outcome Evidence source identity conflicts with an existing immutable admission.'
        );
      throw new MethodOutcomeEvidenceAdmissionError(
        'PERSISTENCE_UNAVAILABLE',
        'Method Outcome Evidence persistence is unavailable.',
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export interface MethodOutcomeEvidenceAdmissionServiceOptionsV1 {
  repository: MethodOutcomeEvidenceAdmissionRepositoryV1;
  now?: () => string;
  evidenceIdFactory?: () => string;
}

export class MethodOutcomeEvidenceAdmissionServiceV1 {
  private readonly now: () => string;
  private readonly evidenceIdFactory: () => string;

  constructor(private readonly options: MethodOutcomeEvidenceAdmissionServiceOptionsV1) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.evidenceIdFactory = options.evidenceIdFactory ?? randomUUID;
  }

  async admit(input: {
    workspaceId: string;
    evidence: unknown;
  }): Promise<MethodOutcomeEvidenceAdmissionResultV1> {
    let admission: MethodOutcomeEvidenceAdmissionV1;
    try {
      admission = parseMethodOutcomeEvidenceAdmissionV1(input.evidence);
    } catch (error) {
      if (error instanceof MethodOutcomeEvidenceContractError)
        throw new MethodOutcomeEvidenceAdmissionError('INVALID_EVIDENCE', error.message);
      throw error;
    }
    if (admission.workspaceId !== input.workspaceId.trim().toLowerCase())
      throw new MethodOutcomeEvidenceAdmissionError(
        'WORKSPACE_MISMATCH',
        'Method Outcome Evidence workspace does not match trusted request context.'
      );

    const admissionFingerprintSha256 = methodOutcomeEvidenceAdmissionFingerprint(admission);
    const sourceIdentityFingerprintSha256 = methodOutcomeEvidenceSourceIdentityFingerprint(admission);
    const evidence = parseMethodOutcomeEvidenceV1({
      ...admission,
      methodOutcomeEvidenceId: `method-outcome-evidence_${this.evidenceIdFactory()}`,
      admissionFingerprintSha256,
      admittedAt: this.now()
    });
    return this.options.repository.admit({ evidence, sourceIdentityFingerprintSha256 });
  }
}
