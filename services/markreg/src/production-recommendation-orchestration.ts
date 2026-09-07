import { createHash } from 'node:crypto';
import {
  encodeInternalWorkspacePrincipal,
  isMarkOrbitId,
  type MarkOrbitId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  parseCapabilityRequestV2Command,
  type CapabilityRequestV2Command
} from '@markorbit/contracts/capability-runtime';
import type {
  ProductionIntakeV1,
  ProductionRecommendationV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { PostgresProductionIntakeService } from './production-intake.js';
import {
  type CreateProductionRecommendationCommandV1,
  type PostgresProductionRecommendationService,
  ProductionRecommendationError
} from './production-recommendation.js';
import type { CapabilityProductionSourceExecutionReferenceTransportV1 } from './recommendation-source.js';
export const PRODUCTION_RECOMMENDATION_SOURCE_CAPABILITY_ID =
  'markreg.us-trademark-mark-representation-strategy-source' as const;
export const PRODUCTION_RECOMMENDATION_SOURCE_CAPABILITY_VERSION = '1.0.0' as const;
export const PRODUCTION_RECOMMENDATION_SOURCE_INPUT_SCHEMA =
  'brain-input.us-trademark-mark-representation-strategy.v1' as const;
export const PRODUCTION_RECOMMENDATION_SOURCE_OUTPUT_SCHEMA =
  'brain.us-trademark-mark-representation-strategy.v1' as const;
const PRODUCTION_RECOMMENDATION_SOURCE_PURPOSE =
  'Produce bounded US mark-representation strategy material for human review.' as const;

export interface OrchestrateProductionRecommendationCommandV1 {
  readonly schemaVersion: 1;
  readonly intakeId: MarkOrbitId;
  readonly expectedIntakeVersion: number;
  readonly expectedIntakeFingerprintSha256: string;
  readonly idempotencyKey: string;
  readonly correlationId: MarkOrbitId;
}

export class ProductionRecommendationOrchestrationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductionRecommendationOrchestrationError';
  }
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, member]) => member !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function exactText(value: unknown, field: string, maximum = 300): string {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.length > maximum) {
    throw new ProductionRecommendationOrchestrationError(
      'INVALID_RECOMMENDATION_ORCHESTRATION_REQUEST',
      `${field} must contain exact non-empty text.`,
      400
    );
  }
  return value;
}

function exactCommand(command: Readonly<OrchestrateProductionRecommendationCommandV1>) {
  if (command.schemaVersion !== 1 || !isMarkOrbitId(command.intakeId)) {
    throw new ProductionRecommendationOrchestrationError(
      'INVALID_RECOMMENDATION_ORCHESTRATION_REQUEST',
      'Production Recommendation orchestration identity is invalid.',
      400
    );
  }
  if (!Number.isSafeInteger(command.expectedIntakeVersion) || command.expectedIntakeVersion < 1) {
    throw new ProductionRecommendationOrchestrationError(
      'INVALID_RECOMMENDATION_ORCHESTRATION_REQUEST',
      'expectedIntakeVersion must be a positive safe integer.',
      400
    );
  }
  if (!/^[0-9a-f]{64}$/u.test(command.expectedIntakeFingerprintSha256)) {
    throw new ProductionRecommendationOrchestrationError(
      'INVALID_RECOMMENDATION_ORCHESTRATION_REQUEST',
      'expectedIntakeFingerprintSha256 must be an exact SHA-256 fingerprint.',
      400
    );
  }
  exactText(command.idempotencyKey, 'idempotencyKey');
  if (!isMarkOrbitId(command.correlationId)) {
    throw new ProductionRecommendationOrchestrationError(
      'INVALID_RECOMMENDATION_ORCHESTRATION_REQUEST',
      'correlationId must be a MarkOrbit identifier.',
      400
    );
  }
  return command;
}

function sourceIdempotencyKey(
  principal: Readonly<WorkspacePrincipal>,
  intake: Readonly<ProductionIntakeV1>,
  orchestrationKey: string
): string {
  return `markreg-rec-source-${sha256({
    workspaceId: principal.workspaceId,
    intakeId: intake.intakeId,
    intakeVersion: intake.version,
    intakeFingerprintSha256: intake.fingerprintSha256,
    orchestrationKey
  })}`;
}
function sourceReference(value: unknown): CapabilityProductionSourceExecutionReferenceTransportV1 {
  const reference =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  if (
    !reference ||
    reference.schemaVersion !== 1 ||
    typeof reference.idempotencyKey !== 'string' ||
    !reference.idempotencyKey ||
    typeof reference.requestFingerprintSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(reference.requestFingerprintSha256) ||
    typeof reference.capabilityRequestId !== 'string' ||
    !reference.capabilityRequestId.startsWith('capreq_') ||
    typeof reference.sessionReceiptId !== 'string' ||
    !reference.sessionReceiptId.startsWith('session-receipt_')
  ) {
    throw new ProductionRecommendationOrchestrationError(
      'INVALID_CAPABILITY_SOURCE_RESPONSE',
      'Capability source execution response did not include an exact production source reference.',
      503,
      true
    );
  }
  return {
    schemaVersion: 1,
    idempotencyKey: reference.idempotencyKey,
    requestFingerprintSha256: reference.requestFingerprintSha256,
    capabilityRequestId: reference.capabilityRequestId,
    sessionReceiptId: reference.sessionReceiptId
  };
}

export interface ProductionRecommendationSourceInvokerV1 {
  invoke(
    principal: Readonly<WorkspacePrincipal>,
    intake: Readonly<ProductionIntakeV1>,
    orchestrationKey: string,
    correlationId: MarkOrbitId
  ): Promise<Readonly<CapabilityProductionSourceExecutionReferenceTransportV1>>;
}
export class HttpProductionRecommendationSourceInvokerV1 implements ProductionRecommendationSourceInvokerV1 {
  constructor(
    private readonly capabilityUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async invoke(
    principal: Readonly<WorkspacePrincipal>,
    intake: Readonly<ProductionIntakeV1>,
    orchestrationKey: string,
    correlationId: MarkOrbitId
  ): Promise<Readonly<CapabilityProductionSourceExecutionReferenceTransportV1>> {
    const idempotencyKey = sourceIdempotencyKey(principal, intake, orchestrationKey);
    const command: CapabilityRequestV2Command = parseCapabilityRequestV2Command({
      schemaVersion: 2,
      capabilityId: PRODUCTION_RECOMMENDATION_SOURCE_CAPABILITY_ID,
      capabilityVersion: PRODUCTION_RECOMMENDATION_SOURCE_CAPABILITY_VERSION,
      caller: {
        workspaceId: principal.workspaceId,
        principalId: principal.userId,
        callerProduct: 'MARKREG',
        permissionContextRef: `core-workspace-membership:${principal.membershipId}`
      },
      purpose: PRODUCTION_RECOMMENDATION_SOURCE_PURPOSE,
      input: intake.input,
      inputSchemaId: PRODUCTION_RECOMMENDATION_SOURCE_INPUT_SCHEMA,
      outputSchemaId: PRODUCTION_RECOMMENDATION_SOURCE_OUTPUT_SCHEMA,
      riskClass: 'LOW',
      idempotencyKey,
      correlationId
    });
    let response: Response;
    try {
      response = await this.fetcher(`${this.capabilityUrl}/v1/capability-requests`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': principal.workspaceId,
          'x-markorbit-caller-product': 'MARKREG',
          'idempotency-key': idempotencyKey,
          'x-correlation-id': correlationId
        },
        body: JSON.stringify(command)
      });
    } catch (cause) {
      throw new ProductionRecommendationOrchestrationError(
        'CAPABILITY_SOURCE_UNAVAILABLE',
        'Governed Recommendation source execution is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const detail =
        body && typeof body === 'object' && !Array.isArray(body)
          ? (body as Record<string, unknown>)
          : {};
      throw new ProductionRecommendationOrchestrationError(
        typeof detail.code === 'string' ? detail.code : 'CAPABILITY_SOURCE_DENIED',
        typeof detail.message === 'string'
          ? detail.message
          : 'Governed Recommendation source execution was denied.',
        response.status,
        response.status >= 500
      );
    }
    const payload =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : undefined;
    if (!payload) {
      throw new ProductionRecommendationOrchestrationError(
        'INVALID_CAPABILITY_SOURCE_RESPONSE',
        'Capability source execution returned a malformed response.',
        503,
        true
      );
    }
    const reference = sourceReference(payload.sourceEvidenceReadReference);
    if (reference.idempotencyKey !== idempotencyKey) {
      throw new ProductionRecommendationOrchestrationError(
        'INVALID_CAPABILITY_SOURCE_RESPONSE',
        'Capability source execution reference does not match the exact orchestration request.',
        503,
        true
      );
    }
    return Object.freeze(reference);
  }
}

export interface ProductionRecommendationOrchestrationDependenciesV1 {
  readonly intakes: Pick<PostgresProductionIntakeService, 'get' | 'getVersion'>;
  readonly recommendations: Pick<
    PostgresProductionRecommendationService,
    'create' | 'findCreateReplayForIntake'
  >;
  readonly source: ProductionRecommendationSourceInvokerV1;
}
export class ProductionRecommendationOrchestrationServiceV1 {
  constructor(private readonly dependencies: ProductionRecommendationOrchestrationDependenciesV1) {}

  async create(
    principal: WorkspacePrincipal,
    supplied: Readonly<OrchestrateProductionRecommendationCommandV1>
  ): Promise<Readonly<ProductionRecommendationV1>> {
    const command = exactCommand(supplied);
    let intake: ProductionIntakeV1;
    let latest: ProductionIntakeV1;
    try {
      [intake, latest] = await Promise.all([
        this.dependencies.intakes.getVersion(
          principal,
          command.intakeId,
          command.expectedIntakeVersion
        ),
        this.dependencies.intakes.get(principal, command.intakeId)
      ]);
    } catch (cause) {
      throw translateDependency(cause);
    }
    if (intake.fingerprintSha256 !== command.expectedIntakeFingerprintSha256) {
      throw new ProductionRecommendationOrchestrationError(
        'PRODUCTION_INTAKE_CONFLICT',
        'Production Intake does not match the exact expected fingerprint.',
        409
      );
    }
    const current =
      latest.version === intake.version && latest.fingerprintSha256 === intake.fingerprintSha256;
    const replaySuccessor =
      latest.version === intake.version + 1 &&
      latest.status === 'RECOMMENDATION_READY' &&
      canonicalJson(latest.input) === canonicalJson(intake.input) &&
      latest.channel === intake.channel &&
      latest.relationshipModel === intake.relationshipModel;
    if (!current && !replaySuccessor) {
      throw new ProductionRecommendationOrchestrationError(
        'PRODUCTION_INTAKE_CONFLICT',
        'Production Intake is no longer current for this Recommendation orchestration.',
        409
      );
    }
    if (replaySuccessor) {
      try {
        const replay = await this.dependencies.recommendations.findCreateReplayForIntake(
          principal,
          command.idempotencyKey,
          intake.intakeId,
          intake.version,
          intake.fingerprintSha256
        );
        if (replay) return Object.freeze(replay);
      } catch (cause) {
        throw translateDependency(cause);
      }
      throw new ProductionRecommendationOrchestrationError(
        'PRODUCTION_INTAKE_CONFLICT',
        'Production Intake is already Recommendation-ready without a matching orchestration replay receipt.',
        409
      );
    }

    let producerReference: Readonly<CapabilityProductionSourceExecutionReferenceTransportV1>;
    try {
      producerReference = await this.dependencies.source.invoke(
        principal,
        intake,
        command.idempotencyKey,
        command.correlationId
      );
    } catch (cause) {
      throw translateDependency(cause);
    }
    const materialize: CreateProductionRecommendationCommandV1 = {
      schemaVersion: 1,
      intakeId: intake.intakeId,
      expectedIntakeVersion: intake.version,
      producerReference,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId
    };
    try {
      return Object.freeze(
        await this.dependencies.recommendations.create(
          principal,
          materialize,
          command.correlationId
        )
      );
    } catch (cause) {
      throw translateDependency(cause);
    }
  }
}

function translateDependency(cause: unknown): ProductionRecommendationOrchestrationError {
  if (cause instanceof ProductionRecommendationOrchestrationError) return cause;
  if (cause instanceof ProductionRecommendationError) {
    return new ProductionRecommendationOrchestrationError(
      cause.code,
      cause.message,
      cause.status,
      cause.retryable,
      { cause }
    );
  }
  if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') {
    const status = 'status' in cause && typeof cause.status === 'number' ? cause.status : 503;
    const retryable =
      'retryable' in cause && typeof cause.retryable === 'boolean'
        ? cause.retryable
        : status >= 500;
    return new ProductionRecommendationOrchestrationError(
      cause.code,
      cause instanceof Error ? cause.message : 'Recommendation orchestration dependency failed.',
      status,
      retryable,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
  return new ProductionRecommendationOrchestrationError(
    'RECOMMENDATION_ORCHESTRATION_UNAVAILABLE',
    'Production Recommendation orchestration is unavailable.',
    503,
    true,
    { cause: cause instanceof Error ? cause : undefined }
  );
}
