import {
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  noRecommendationSourceAuthorityConsequences,
  type RecommendationSourceReferenceV1
} from '@markorbit/contracts/markreg-early-funnel';

const SHA256 = /^[a-f0-9]{64}$/u;

export interface CapabilityProductionSourceExecutionReferenceTransportV1 {
  readonly schemaVersion: 1;
  readonly idempotencyKey: string;
  readonly requestFingerprintSha256: string;
  readonly capabilityRequestId: string;
  readonly sessionReceiptId: string;
}

export type RecommendationSourceReadResultV1 =
  | Readonly<{
      status: 'PRODUCTION_ADMISSIBLE';
      source: Readonly<RecommendationSourceReferenceV1>;
      producerReference: Readonly<CapabilityProductionSourceExecutionReferenceTransportV1>;
    }>
  | Readonly<{
      status: 'DENIED' | 'NOT_FOUND' | 'CONFLICT' | 'UNAVAILABLE' | 'INVALID_PRODUCER_RESPONSE';
      retryable: boolean;
      code: string;
      reason: string;
    }>;

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactText(value: unknown, field: string, maximum = 2000): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximum ||
    value.trim() !== value
  ) {
    throw new TypeError(`${field} must contain exact non-empty text.`);
  }
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new TypeError(`${field} must be a positive safe integer.`);
  }
  return Number(value);
}

function sha256(value: unknown, field: string): string {
  const result = exactText(value, field, 64);
  if (!SHA256.test(result)) throw new TypeError(`${field} must be a lowercase SHA-256 digest.`);
  return result;
}

function isoInstant(value: unknown, field: string): string {
  const result = exactText(value, field, 100);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== result) {
    throw new TypeError(`${field} must be an exact ISO instant.`);
  }
  return result;
}

function stringList(value: unknown, field: string, maximum = 64): readonly string[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new TypeError(`${field} must be a bounded array.`);
  }
  return value.map((item, index) => exactText(item, `${field}[${index}]`));
}

function allFalse(value: unknown, field: string): void {
  const authority = record(value, field);
  const values = Object.values(authority);
  if (!values.length || values.some((item) => item !== false)) {
    throw new TypeError(`${field} must contain only explicit false authority consequences.`);
  }
}

function parseReference(
  value: unknown
): Readonly<CapabilityProductionSourceExecutionReferenceTransportV1> {
  const reference = record(value, 'producer.reference');
  if (reference.schemaVersion !== 1) {
    throw new TypeError('producer.reference.schemaVersion must be 1.');
  }
  const result = {
    schemaVersion: 1 as const,
    idempotencyKey: exactText(reference.idempotencyKey, 'producer.reference.idempotencyKey', 300),
    requestFingerprintSha256: sha256(
      reference.requestFingerprintSha256,
      'producer.reference.requestFingerprintSha256'
    ),
    capabilityRequestId: exactText(
      reference.capabilityRequestId,
      'producer.reference.capabilityRequestId',
      500
    ),
    sessionReceiptId: exactText(
      reference.sessionReceiptId,
      'producer.reference.sessionReceiptId',
      500
    )
  };
  if (!result.capabilityRequestId.startsWith('capreq_')) {
    throw new TypeError('producer.reference.capabilityRequestId is invalid.');
  }
  if (!result.sessionReceiptId.startsWith('session-receipt_')) {
    throw new TypeError('producer.reference.sessionReceiptId is invalid.');
  }
  return Object.freeze(result);
}

function denialFromProducer(value: Record<string, unknown>): RecommendationSourceReadResultV1 {
  if (
    value.status !== 'DENIED' &&
    value.status !== 'NOT_FOUND' &&
    value.status !== 'CONFLICT' &&
    value.status !== 'UNAVAILABLE'
  ) {
    return {
      status: 'INVALID_PRODUCER_RESPONSE',
      retryable: false,
      code: 'INVALID_PRODUCER_STATUS',
      reason: 'Capability producer response did not contain a recognized fail-closed status.'
    };
  }
  const denial =
    value.denial && typeof value.denial === 'object' && !Array.isArray(value.denial)
      ? (value.denial as Record<string, unknown>)
      : undefined;
  return {
    status: value.status,
    retryable: value.status === 'UNAVAILABLE' && value.retryable === true,
    code:
      denial && typeof denial.code === 'string'
        ? denial.code
        : `CAPABILITY_SOURCE_${value.status}`,
    reason:
      denial && typeof denial.reason === 'string'
        ? denial.reason
        : 'Capability producer did not admit this execution as a current production source.'
  };
}

function methodProvenance(value: unknown): readonly string[] {
  if (value === undefined) return [];
  const method = record(value, 'producer.source.methodSource');
  return [
    `capability-method:${exactText(method.methodId, 'methodId')}@${exactText(method.methodVersionId, 'methodVersionId')}`,
    `capability-method-package:${exactText(method.packageId, 'packageId')}@${exactText(method.packageVersion, 'packageVersion')}`,
    `capability-method-activation:${exactText(method.activationId, 'activationId')}`,
    `capability-method-evaluation:${exactText(method.evaluationId, 'evaluationId')}`,
    exactText(method.evidenceRef, 'methodSource.evidenceRef')
  ];
}

function referenceProvenance(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError('producer.source.referenceSources must be an array.');
  return value.map((item, index) => {
    const reference = record(item, `producer.source.referenceSources[${index}]`);
    const sourceId = exactText(reference.sourceId, `referenceSources[${index}].sourceId`);
    const sourceVersion =
      typeof reference.sourceVersion === 'number'
        ? String(positiveInteger(reference.sourceVersion, `referenceSources[${index}].sourceVersion`))
        : exactText(reference.sourceVersion, `referenceSources[${index}].sourceVersion`);
    const sourceFingerprint =
      reference.sourceFingerprintSha256 === undefined
        ? ''
        : `#${sha256(
            reference.sourceFingerprintSha256,
            `referenceSources[${index}].sourceFingerprintSha256`
          )}`;
    return `${exactText(reference.evidenceRef, `referenceSources[${index}].evidenceRef`)}|source:${sourceId}@${sourceVersion}${sourceFingerprint}`;
  });
}

/**
 * Consumer projection only. Capability remains the admission/currentness authority; this function
 * verifies the bounded producer read shape and pins it into the already-governed #385 source
 * vocabulary. It never upgrades denied/unknown evidence and creates no Recommendation authority.
 */
export function projectRecommendationSourceReferenceV1(
  value: unknown
): RecommendationSourceReadResultV1 {
  try {
    const result = record(value, 'producer');
    if (result.schemaVersion !== 1) throw new TypeError('producer.schemaVersion must be 1.');
    allFalse(result.authority, 'producer.authority');
    if (result.status !== 'PRODUCTION_ADMISSIBLE') return denialFromProducer(result);

    const producerReference = parseReference(result.reference);
    const historical = record(result.historical, 'producer.historical');
    if (
      exactText(historical.capabilityRequestId, 'producer.historical.capabilityRequestId') !==
        producerReference.capabilityRequestId ||
      exactText(historical.sessionReceiptId, 'producer.historical.sessionReceiptId') !==
        producerReference.sessionReceiptId
    ) {
      throw new TypeError('Producer historical execution identity conflicts with its exact reference.');
    }

    const source = record(result.source, 'producer.source');
    if (source.producer !== 'CAPABILITY_ENGINE' || source.admission !== 'PRODUCTION_ADMISSIBLE') {
      throw new TypeError('Producer source is not explicitly Capability PRODUCTION_ADMISSIBLE.');
    }
    allFalse(source.authority, 'producer.source.authority');

    const evidence = record(source.evidence, 'producer.source.evidence');
    if (evidence.evidenceVersion !== 5) {
      throw new TypeError('Producer source must carry canonical V5 admission evidence.');
    }
    const evidenceId = exactText(evidence.evidenceId, 'producer.source.evidence.evidenceId');
    const evidenceFingerprint = sha256(
      evidence.evidenceFingerprintSha256,
      'producer.source.evidence.evidenceFingerprintSha256'
    );
    isoInstant(evidence.evaluatedAt, 'producer.source.evidence.evaluatedAt');

    const current = record(source.current, 'producer.source.current');
    const capability = record(current.capability, 'producer.source.current.capability');
    const implementation = record(current.implementation, 'producer.source.current.implementation');
    if (implementation.status !== 'APPROVED') {
      throw new TypeError('Producer implementation binding must be APPROVED.');
    }
    const capabilityId = exactText(capability.capabilityId, 'producer.source.current.capability.capabilityId');
    const capabilityVersion = exactText(
      capability.capabilityVersion,
      'producer.source.current.capability.capabilityVersion'
    );
    const runtimeCapabilityDefinitionId = exactText(
      capability.runtimeCapabilityDefinitionId,
      'producer.source.current.capability.runtimeCapabilityDefinitionId'
    );
    const runtimeCapabilityVersion = positiveInteger(
      capability.version,
      'producer.source.current.capability.version'
    );
    const implementationProfileId = exactText(
      implementation.implementationProfileId,
      'producer.source.current.implementation.implementationProfileId'
    );
    const implementationVersion = positiveInteger(
      implementation.version,
      'producer.source.current.implementation.version'
    );
    const implementationKey = exactText(
      implementation.implementationKey,
      'producer.source.current.implementation.implementationKey'
    );

    const sourceOutput = record(source.sourceOutput, 'producer.source.sourceOutput');
    if (sourceOutput.schemaVersion !== 1) {
      throw new TypeError('producer.source.sourceOutput.schemaVersion must be 1.');
    }
    const outputSchemaId = exactText(
      sourceOutput.outputSchemaId,
      'producer.source.sourceOutput.outputSchemaId'
    );
    const outputFingerprint = sha256(
      sourceOutput.outputFingerprintSha256,
      'producer.source.sourceOutput.outputFingerprintSha256'
    );

    const admissionPolicy = record(source.admissionPolicy, 'producer.source.admissionPolicy');
    const admissionPolicyId = exactText(
      admissionPolicy.policyId,
      'producer.source.admissionPolicy.policyId'
    );
    const admissionPolicyVersion = positiveInteger(
      admissionPolicy.policyVersion,
      'producer.source.admissionPolicy.policyVersion'
    );
    const admissionPolicyFingerprint = sha256(
      admissionPolicy.policyFingerprintSha256,
      'producer.source.admissionPolicy.policyFingerprintSha256'
    );

    const sourceUse = record(source.sourceUse, 'producer.source.sourceUse');
    if (sourceUse.currentness !== 'CURRENT') {
      throw new TypeError('Capability producer source-use currentness must be CURRENT.');
    }
    const currentnessCheckedAt = isoInstant(
      sourceUse.currentnessCheckedAt,
      'producer.source.sourceUse.currentnessCheckedAt'
    );
    const sourceUsePolicy = record(sourceUse.policy, 'producer.source.sourceUse.policy');
    const sourceUsePolicyId = exactText(
      sourceUsePolicy.policyId,
      'producer.source.sourceUse.policy.policyId'
    );
    const sourceUsePolicyVersion = positiveInteger(
      sourceUsePolicy.policyVersion,
      'producer.source.sourceUse.policy.policyVersion'
    );

    const provenanceRefs = [
      ...stringList(sourceUse.provenanceRefs, 'producer.source.sourceUse.provenanceRefs'),
      `capability-runtime-definition:${runtimeCapabilityDefinitionId}@${runtimeCapabilityVersion}`,
      `capability-implementation-profile:${implementationProfileId}@${implementationVersion}|key:${implementationKey}`,
      `capability-source-admission-evidence:${evidenceId}@5#${evidenceFingerprint}`,
      `capability-admission-policy:${admissionPolicyId}@${admissionPolicyVersion}#${admissionPolicyFingerprint}`,
      `capability-source-use-policy:${sourceUsePolicyId}@${sourceUsePolicyVersion}`,
      `capability-output:${outputSchemaId}#${outputFingerprint}`,
      `capability-request:${producerReference.capabilityRequestId}`,
      `capability-session-receipt:${producerReference.sessionReceiptId}`,
      ...methodProvenance(source.methodSource),
      ...referenceProvenance(source.referenceSources)
    ];

    const projected: RecommendationSourceReferenceV1 = {
      sourceKind: 'CAPABILITY_RESULT',
      sourceId: capabilityId,
      sourceVersion: `${capabilityVersion}|runtime:${runtimeCapabilityDefinitionId}@${runtimeCapabilityVersion}|implementation:${implementationProfileId}@${implementationVersion}|evidence:${evidenceId}@5`,
      fingerprintSha256: outputFingerprint,
      admissionClass: 'PRODUCTION_ADMISSIBLE',
      currentness: 'CURRENT',
      currentnessCheckedAt,
      provenanceRefs: [...new Set(provenanceRefs)],
      assumptions: stringList(sourceUse.assumptions, 'producer.source.sourceUse.assumptions', 32),
      limitations: stringList(sourceUse.limitations, 'producer.source.sourceUse.limitations', 32),
      authorityConsequences: noRecommendationSourceAuthorityConsequences
    };
    return Object.freeze({
      status: 'PRODUCTION_ADMISSIBLE',
      source: Object.freeze(projected),
      producerReference
    });
  } catch (error) {
    return {
      status: 'INVALID_PRODUCER_RESPONSE',
      retryable: false,
      code: 'INVALID_CAPABILITY_PRODUCTION_SOURCE_EVIDENCE',
      reason:
        error instanceof Error
          ? error.message
          : 'Capability producer response failed the Recommendation source boundary.'
    };
  }
}

export class HttpCapabilityRecommendationSourceReaderV1 {
  constructor(
    private readonly capabilityEngineUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (Buffer.byteLength(internalServiceSecret) < 32) {
      throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
    }
  }

  async read(
    reference: Readonly<CapabilityProductionSourceExecutionReferenceTransportV1>,
    principal: Readonly<WorkspacePrincipal>,
    correlationId?: string
  ): Promise<RecommendationSourceReadResultV1> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.capabilityEngineUrl.replace(/\/$/u, '')}/v1/production-source-evidence/read`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
            'x-markorbit-workspace-id': principal.workspaceId,
            'x-markorbit-caller-product': 'MARKREG',
            ...(correlationId ? { 'x-correlation-id': correlationId } : {})
          },
          body: JSON.stringify(reference)
        }
      );
    } catch {
      return {
        status: 'UNAVAILABLE',
        retryable: true,
        code: 'CAPABILITY_SOURCE_READ_UNAVAILABLE',
        reason: 'Capability production source evidence service is unavailable.'
      };
    }

    if (!response.ok) {
      return {
        status: response.status === 404 ? 'NOT_FOUND' : 'UNAVAILABLE',
        retryable: response.status >= 500,
        code: `CAPABILITY_SOURCE_READ_HTTP_${response.status}`,
        reason: 'Capability production source evidence service rejected the trusted read.'
      };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return {
        status: 'INVALID_PRODUCER_RESPONSE',
        retryable: false,
        code: 'INVALID_CAPABILITY_SOURCE_JSON',
        reason: 'Capability production source evidence response was not valid JSON.'
      };
    }
    return projectRecommendationSourceReferenceV1(body);
  }
}
