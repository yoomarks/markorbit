import { createHash } from 'node:crypto';
import {
  isMarkOrbitId,
  type MarkOrbitId,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  parseProductionIntakeV1,
  parseProductionRecommendationV1,
  type ProductionIntakeV1,
  type ProductionRecommendationV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { QueryClient } from '@markorbit/persistence';
import {
  MARKREG_RECOMMENDATION_CAPABLE_SOURCE_ID,
  type CapabilityProductionSourceExecutionReferenceTransportV1,
  type HttpCapabilityRecommendationSourceReaderV1,
  type RecommendationCapableSourceMaterialV1,
  type RecommendationSourceReadResultV1
} from './recommendation-source.js';

export const PRODUCTION_RECOMMENDATION_CONSUMER_POLICY =
  'markreg.production-recommendation.us-mark-representation.v1' as const;

export interface CreateProductionRecommendationCommandV1 {
  readonly schemaVersion: 1;
  readonly intakeId: MarkOrbitId;
  readonly expectedIntakeVersion: number;
  readonly producerReference: Readonly<CapabilityProductionSourceExecutionReferenceTransportV1>;
  readonly idempotencyKey: string;
  readonly correlationId: MarkOrbitId;
}

export interface ProductionRecommendationTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}

export class ProductionRecommendationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductionRecommendationError';
  }
}

type Row = Record<string, unknown>;

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

export function productionRecommendationSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function requirePermission(principal: WorkspacePrincipal, permission: Permission): void {
  if (!principal.permissions.includes(permission)) {
    throw new ProductionRecommendationError(
      'PERMISSION_DENIED',
      `${permission} permission is required.`,
      403
    );
  }
}

function exactText(value: string, field: string, maximum = 1000): string {
  if (!value || value.trim() !== value || value.length > maximum) {
    throw new ProductionRecommendationError(
      'INVALID_PRODUCTION_RECOMMENDATION_REQUEST',
      `${field} must contain exact non-empty text.`,
      400
    );
  }
  return value;
}

function exactVersion(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ProductionRecommendationError(
      'INVALID_PRODUCTION_RECOMMENDATION_REQUEST',
      `${field} must be a positive safe integer.`,
      400
    );
  }
  return value;
}

function exactCommand(
  command: Readonly<CreateProductionRecommendationCommandV1>
): Readonly<CreateProductionRecommendationCommandV1> {
  if (command.schemaVersion !== 1 || !isMarkOrbitId(command.intakeId)) {
    throw new ProductionRecommendationError(
      'INVALID_PRODUCTION_RECOMMENDATION_REQUEST',
      'Production Recommendation command identity is invalid.',
      400
    );
  }
  if (!isMarkOrbitId(command.correlationId)) {
    throw new ProductionRecommendationError(
      'INVALID_PRODUCTION_RECOMMENDATION_REQUEST',
      'correlationId must be a MarkOrbit identifier.',
      400
    );
  }
  exactVersion(command.expectedIntakeVersion, 'expectedIntakeVersion');
  exactText(command.idempotencyKey, 'idempotencyKey', 300);
  const reference = command.producerReference;
  if (
    reference.schemaVersion !== 1 ||
    !/^[0-9a-f]{64}$/u.test(reference.requestFingerprintSha256) ||
    !reference.capabilityRequestId.startsWith('capreq_') ||
    !reference.sessionReceiptId.startsWith('session-receipt_')
  ) {
    throw new ProductionRecommendationError(
      'INVALID_PRODUCTION_RECOMMENDATION_REQUEST',
      'producerReference must contain the exact Capability production execution reference.',
      400
    );
  }
  exactText(reference.idempotencyKey, 'producerReference.idempotencyKey', 300);
  return command;
}

function requestMaterial(command: Readonly<CreateProductionRecommendationCommandV1>) {
  return {
    schemaVersion: command.schemaVersion,
    intakeId: command.intakeId,
    expectedIntakeVersion: command.expectedIntakeVersion,
    producerReference: command.producerReference
  };
}

function artifactMaterial(value: Omit<ProductionRecommendationV1, 'fingerprintSha256'>) {
  return value;
}

function intakeArtifactMaterial(value: Omit<ProductionIntakeV1, 'fingerprintSha256'>) {
  return value;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function dimensionLabel(
  dimension: RecommendationCapableSourceMaterialV1['candidates'][number]['dimension']
) {
  return dimension === 'WORDING_STANDARD_CHARACTER'
    ? 'wording / standard-character dimension'
    : 'design / stylization / special-form dimension';
}

function requireMaterializableSource(
  sourceRead: Readonly<RecommendationSourceReadResultV1>,
  intake: Readonly<ProductionIntakeV1>
): asserts sourceRead is Extract<
  RecommendationSourceReadResultV1,
  { status: 'PRODUCTION_ADMISSIBLE' }
> & {
  source: Extract<
    RecommendationSourceReadResultV1,
    { status: 'PRODUCTION_ADMISSIBLE' }
  >['source'] & {
    admissionClass: 'PRODUCTION_ADMISSIBLE';
    currentness: 'CURRENT';
  };
  recommendationMaterial: Readonly<RecommendationCapableSourceMaterialV1>;
} {
  if (sourceRead.status !== 'PRODUCTION_ADMISSIBLE') {
    const status =
      sourceRead.status === 'UNAVAILABLE' ? 503 : sourceRead.status === 'NOT_FOUND' ? 404 : 422;
    throw new ProductionRecommendationError(
      `RECOMMENDATION_SOURCE_${sourceRead.status}`,
      sourceRead.reason,
      status,
      sourceRead.retryable
    );
  }
  if (
    sourceRead.source.admissionClass !== 'PRODUCTION_ADMISSIBLE' ||
    sourceRead.source.currentness !== 'CURRENT' ||
    sourceRead.source.sourceId !== MARKREG_RECOMMENDATION_CAPABLE_SOURCE_ID ||
    !sourceRead.source.sourceVersion.startsWith(
      '1.0.0|runtime:runtime-capability_us-trademark-mark-representation-strategy-source-v1@1|implementation:implementation-profile_us-trademark-mark-representation-strategy-source-v1@1|'
    ) ||
    !sourceRead.recommendationMaterial
  ) {
    throw new ProductionRecommendationError(
      'SOURCE_NOT_RECOMMENDATION_CAPABLE',
      'Capability source is production-admissible but is not on the MarkReg Recommendation-capable V1 allowlist.',
      422
    );
  }
  if (
    sourceRead.recommendationMaterial.analyzedInputFingerprintSha256 !==
    productionRecommendationSha256(intake.input)
  ) {
    throw new ProductionRecommendationError(
      'SOURCE_INPUT_FINGERPRINT_MISMATCH',
      'Capability Recommendation material was not produced from the exact current Intake input.',
      409
    );
  }
}

export function composeProductionRecommendationV1(
  input: Readonly<{
    recommendationId: MarkOrbitId;
    intake: ProductionIntakeV1;
    sourceRead: Extract<RecommendationSourceReadResultV1, { status: 'PRODUCTION_ADMISSIBLE' }> & {
      recommendationMaterial: Readonly<RecommendationCapableSourceMaterialV1>;
    };
    generatedAt: string;
  }>
): ProductionRecommendationV1 {
  requireMaterializableSource(input.sourceRead, input.intake);
  const material = input.sourceRead.recommendationMaterial;
  const dimensions = material.candidates.map((candidate) => dimensionLabel(candidate.dimension));
  const base: Omit<ProductionRecommendationV1, 'fingerprintSha256'> = {
    schemaVersion: 1,
    recommendationId: input.recommendationId,
    workspaceId: input.intake.workspaceId,
    version: 1,
    intake: {
      id: input.intake.intakeId,
      version: input.intake.version,
      fingerprintSha256: input.intake.fingerprintSha256
    },
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    source: input.sourceRead.source,
    options: [
      {
        code: 'A',
        title: 'Review admitted representation dimensions',
        description: `Use the governed Capability evidence to review ${dimensions.join(' and ')} as bounded candidates for human strategy review.`
      },
      {
        code: 'B',
        title: 'Validate customer-supplied assumptions',
        description:
          'Confirm the supplied mark type and representation, actual use, important mark elements, and budget before choosing any filing approach.'
      },
      {
        code: 'C',
        title: 'Professional review before filing decision',
        description:
          'Escalate the admitted dimensions and evidence lineage for professional review; no filing, payment, provider contact, or protected action is authorized.'
      }
    ],
    rationale: `The admitted Capability source supports ${dimensions.join(' and ')} for human review only. MarkReg therefore materializes a bounded review sequence rather than a legal conclusion or filing instruction.`,
    assumptions: unique([...input.sourceRead.source.assumptions, ...material.assumptions]),
    limitations: unique([
      ...input.sourceRead.source.limitations,
      ...material.limitations,
      'MarkReg composes a bounded human-review workflow only; it does not choose a USPTO drawing, filing basis, goods/services classes, deadline, or legal conclusion.'
    ]),
    provenanceRefs: unique([
      ...input.sourceRead.source.provenanceRefs,
      ...material.provenanceRefs,
      `capability-request:${input.sourceRead.producerReference.capabilityRequestId}`,
      `capability-session-receipt:${input.sourceRead.producerReference.sessionReceiptId}`,
      `markreg-consumer-policy:${PRODUCTION_RECOMMENDATION_CONSUMER_POLICY}`
    ]),
    generatedAt: input.generatedAt,
    authorityConsequences: noEarlyFunnelAuthorityConsequences
  };
  return parseProductionRecommendationV1({
    ...base,
    fingerprintSha256: productionRecommendationSha256(artifactMaterial(base))
  });
}

export class PostgresProductionRecommendationService {
  constructor(
    private readonly database: ProductionRecommendationTransactionHost,
    private readonly query: QueryClient,
    private readonly sources: Pick<HttpCapabilityRecommendationSourceReaderV1, 'read'>,
    private readonly now = () => new Date().toISOString()
  ) {}

  async create(
    principal: WorkspacePrincipal,
    rawCommand: Readonly<CreateProductionRecommendationCommandV1>,
    correlationId?: string
  ): Promise<ProductionRecommendationV1> {
    requirePermission(principal, 'matter:create');
    const command = exactCommand(rawCommand);
    const requestFingerprint = productionRecommendationSha256(requestMaterial(command));
    const replayBeforeRead = await this.safeReplay(
      this.query,
      principal.workspaceId,
      command.idempotencyKey,
      requestFingerprint
    );
    if (replayBeforeRead) return replayBeforeRead;

    const intakeBeforeRead = await this.readExactCurrentIntake(
      this.query,
      principal.workspaceId,
      command.intakeId,
      command.expectedIntakeVersion
    );
    const sourceRead = await this.sources.read(
      command.producerReference,
      principal,
      correlationId ?? command.correlationId
    );
    requireMaterializableSource(sourceRead, intakeBeforeRead);

    try {
      return await this.database.transact(
        async (client) => {
          const replay = await this.replay(
            client,
            principal.workspaceId,
            command.idempotencyKey,
            requestFingerprint
          );
          if (replay) return replay;

          const intake = await this.lockExactCurrentIntake(
            client,
            principal.workspaceId,
            command.intakeId,
            command.expectedIntakeVersion
          );
          requireMaterializableSource(sourceRead, intake);
          const at = this.now();
          const recommendationId = `recommendation_${productionRecommendationSha256({
            workspaceId: principal.workspaceId,
            intakeId: intake.intakeId,
            intakeVersion: intake.version,
            sourceFingerprintSha256: sourceRead.source.fingerprintSha256
          }).slice(0, 32)}` as MarkOrbitId;
          const recommendation = composeProductionRecommendationV1({
            recommendationId,
            intake,
            sourceRead,
            generatedAt: at
          });

          await client.query(
            `INSERT INTO markreg_early_funnel_recommendations (
              workspace_id,recommendation_id,version,intake_id,intake_version,
              intake_fingerprint_sha256,admission_class,currentness,source_id,source_version,
              source_fingerprint_sha256,source_admission_class,source_currentness,
              source_currentness_checked_at,source_provenance,recommendation_record,
              fingerprint_sha256,generated_at,created_by
            ) VALUES ($1,$2,1,$3,$4,$5,'PRODUCTION_ADMISSIBLE','CURRENT',$6,$7,$8,
              'PRODUCTION_ADMISSIBLE','CURRENT',$9,$10::jsonb,$11::jsonb,$12,$13,$14)`,
            [
              principal.workspaceId,
              recommendation.recommendationId,
              intake.intakeId,
              intake.version,
              intake.fingerprintSha256,
              recommendation.source.sourceId,
              recommendation.source.sourceVersion,
              recommendation.source.fingerprintSha256,
              recommendation.source.currentnessCheckedAt,
              JSON.stringify({
                consumerPolicy: PRODUCTION_RECOMMENDATION_CONSUMER_POLICY,
                producerReference: sourceRead.producerReference,
                recommendationMaterial: sourceRead.recommendationMaterial,
                provenanceRefs: recommendation.provenanceRefs
              }),
              JSON.stringify(recommendation),
              recommendation.fingerprintSha256,
              recommendation.generatedAt,
              principal.userId
            ]
          );

          const readyBase: Omit<ProductionIntakeV1, 'fingerprintSha256'> = {
            schemaVersion: intake.schemaVersion,
            intakeId: intake.intakeId,
            workspaceId: intake.workspaceId,
            version: intake.version + 1,
            status: 'RECOMMENDATION_READY',
            channel: intake.channel,
            relationshipModel: intake.relationshipModel,
            input: intake.input,
            sourceClass: intake.sourceClass,
            createdAt: intake.createdAt,
            updatedAt: at,
            authorityConsequences: intake.authorityConsequences
          };
          const readyIntake = parseProductionIntakeV1({
            ...readyBase,
            fingerprintSha256: productionRecommendationSha256(intakeArtifactMaterial(readyBase))
          });
          await client.query(
            `INSERT INTO markreg_early_funnel_intakes (
              workspace_id,intake_id,version,status,channel,relationship_model,source_class,
              input_snapshot,fingerprint_sha256,intake_record,created_by,created_at,updated_at
            ) VALUES ($1,$2,$3,'RECOMMENDATION_READY',$4,$5,'CUSTOMER_SUPPLIED',$6::jsonb,
              $7,$8::jsonb,$9,$10,$11)`,
            [
              principal.workspaceId,
              readyIntake.intakeId,
              readyIntake.version,
              readyIntake.channel,
              readyIntake.relationshipModel,
              JSON.stringify(readyIntake.input),
              readyIntake.fingerprintSha256,
              JSON.stringify(readyIntake),
              principal.userId,
              readyIntake.createdAt,
              readyIntake.updatedAt
            ]
          );

          await client.query(
            `INSERT INTO markreg_early_funnel_commands (
              workspace_id,command_type,idempotency_key,request_fingerprint_sha256,
              response_entity_type,response_entity_id,response_entity_version,response_data,created_at
            ) VALUES ($1,'CREATE_RECOMMENDATION',$2,$3,'RECOMMENDATION',$4,1,$5::jsonb,$6)`,
            [
              principal.workspaceId,
              command.idempotencyKey,
              requestFingerprint,
              recommendation.recommendationId,
              JSON.stringify(recommendation),
              at
            ]
          );
          await client.query(
            `INSERT INTO markreg_early_funnel_audit (
              workspace_id,entity_type,entity_id,entity_version,action,source_lineage,
              request_fingerprint_sha256,actor_id,correlation_id,occurred_at
            ) VALUES ($1,'RECOMMENDATION',$2,1,'PRODUCTION_RECOMMENDATION_CREATED',$3::jsonb,
              $4,$5,$6,$7)`,
            [
              principal.workspaceId,
              recommendation.recommendationId,
              JSON.stringify({
                consumerPolicy: PRODUCTION_RECOMMENDATION_CONSUMER_POLICY,
                intake: recommendation.intake,
                source: recommendation.source,
                producerReference: sourceRead.producerReference
              }),
              requestFingerprint,
              principal.userId,
              correlationId ?? command.correlationId,
              at
            ]
          );
          await client.query(
            `INSERT INTO markreg_early_funnel_audit (
              workspace_id,entity_type,entity_id,entity_version,action,source_lineage,
              request_fingerprint_sha256,actor_id,correlation_id,occurred_at
            ) VALUES ($1,'INTAKE',$2,$3,'PRODUCTION_INTAKE_RECOMMENDATION_READY',$4::jsonb,
              $5,$6,$7,$8)`,
            [
              principal.workspaceId,
              readyIntake.intakeId,
              readyIntake.version,
              JSON.stringify({
                recommendation: {
                  id: recommendation.recommendationId,
                  version: recommendation.version,
                  fingerprintSha256: recommendation.fingerprintSha256
                }
              }),
              requestFingerprint,
              principal.userId,
              correlationId ?? command.correlationId,
              at
            ]
          );
          return clone(recommendation);
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof ProductionRecommendationError) throw cause;
      if (String((cause as { code?: string }).code ?? '') === '23505') {
        const replay = await this.safeReplay(
          this.query,
          principal.workspaceId,
          command.idempotencyKey,
          requestFingerprint
        );
        if (replay) return replay;
      }
      throw this.persistence(cause);
    }
  }

  async get(
    principal: WorkspacePrincipal,
    recommendationId: string
  ): Promise<ProductionRecommendationV1> {
    requirePermission(principal, 'workspace:read');
    try {
      const result = await this.query.query(
        `SELECT * FROM markreg_early_funnel_recommendations
         WHERE workspace_id=$1 AND recommendation_id=$2
         ORDER BY version DESC LIMIT 1`,
        [principal.workspaceId, recommendationId]
      );
      if (!result.rowCount) {
        throw new ProductionRecommendationError(
          'PRODUCTION_RECOMMENDATION_NOT_FOUND',
          'Production Recommendation was not found in this Workspace.',
          404
        );
      }
      return this.view(result.rows[0] as Row);
    } catch (cause) {
      if (cause instanceof ProductionRecommendationError) throw cause;
      throw this.persistence(cause);
    }
  }

  private async readExactCurrentIntake(
    client: QueryClient,
    workspaceId: string,
    intakeId: string,
    expectedVersion: number
  ): Promise<ProductionIntakeV1> {
    try {
      const result = await client.query(
        `SELECT * FROM markreg_early_funnel_intakes
         WHERE workspace_id=$1 AND intake_id=$2
         ORDER BY version DESC LIMIT 1`,
        [workspaceId, intakeId]
      );
      return this.exactCurrentIntake(result, expectedVersion);
    } catch (cause) {
      if (cause instanceof ProductionRecommendationError) throw cause;
      throw this.persistence(cause);
    }
  }

  private async lockExactCurrentIntake(
    client: QueryClient,
    workspaceId: string,
    intakeId: string,
    expectedVersion: number
  ): Promise<ProductionIntakeV1> {
    const result = await client.query(
      `SELECT * FROM markreg_early_funnel_intakes
       WHERE workspace_id=$1 AND intake_id=$2
       ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [workspaceId, intakeId]
    );
    return this.exactCurrentIntake(result, expectedVersion);
  }

  private exactCurrentIntake(
    result: Readonly<{ rowCount: number | null; rows: readonly unknown[] }>,
    expectedVersion: number
  ): ProductionIntakeV1 {
    if (!result.rowCount) {
      throw new ProductionRecommendationError(
        'PRODUCTION_INTAKE_NOT_FOUND',
        'Production Intake was not found in this Workspace.',
        404
      );
    }
    const intake = this.viewIntake(result.rows[0] as Row);
    if (intake.version !== expectedVersion || intake.status !== 'RECEIVED') {
      throw new ProductionRecommendationError(
        'INTAKE_VERSION_CONFLICT',
        'Recommendation requires the exact current RECEIVED Intake version.',
        409
      );
    }
    return intake;
  }

  private async safeReplay(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProductionRecommendationV1 | null> {
    try {
      return await this.replay(client, workspaceId, idempotencyKey, requestFingerprint);
    } catch (cause) {
      if (cause instanceof ProductionRecommendationError) throw cause;
      throw this.persistence(cause);
    }
  }

  private async replay(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProductionRecommendationV1 | null> {
    const found = await client.query(
      `SELECT request_fingerprint_sha256,response_data
       FROM markreg_early_funnel_commands
       WHERE workspace_id=$1 AND command_type='CREATE_RECOMMENDATION' AND idempotency_key=$2`,
      [workspaceId, idempotencyKey]
    );
    if (!found.rowCount) return null;
    const row = found.rows[0] as Row;
    if (String(row.request_fingerprint_sha256) !== requestFingerprint) {
      throw new ProductionRecommendationError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used with a materially different Recommendation request.',
        409
      );
    }
    return clone(parseProductionRecommendationV1(row.response_data));
  }

  private view(row: Row): ProductionRecommendationV1 {
    let recommendation: ProductionRecommendationV1;
    try {
      recommendation = parseProductionRecommendationV1(row.recommendation_record);
    } catch (cause) {
      throw new ProductionRecommendationError(
        'PERSISTED_RECOMMENDATION_INTEGRITY_FAILURE',
        'Stored Production Recommendation does not satisfy the V1 contract.',
        500,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const { fingerprintSha256, ...base } = recommendation;
    const valid =
      recommendation.workspaceId.toLowerCase() === String(row.workspace_id).toLowerCase() &&
      recommendation.recommendationId === String(row.recommendation_id) &&
      recommendation.version === Number(row.version) &&
      recommendation.intake.id === String(row.intake_id) &&
      recommendation.intake.version === Number(row.intake_version) &&
      recommendation.intake.fingerprintSha256 === String(row.intake_fingerprint_sha256) &&
      recommendation.admissionClass === String(row.admission_class) &&
      recommendation.currentness === String(row.currentness) &&
      recommendation.source.sourceId === String(row.source_id) &&
      recommendation.source.sourceVersion === String(row.source_version) &&
      recommendation.source.fingerprintSha256 === String(row.source_fingerprint_sha256) &&
      recommendation.source.admissionClass === String(row.source_admission_class) &&
      recommendation.source.currentness === String(row.source_currentness) &&
      fingerprintSha256 === String(row.fingerprint_sha256) &&
      fingerprintSha256 === productionRecommendationSha256(artifactMaterial(base));
    if (!valid) {
      throw new ProductionRecommendationError(
        'PERSISTED_RECOMMENDATION_INTEGRITY_FAILURE',
        'Stored Production Recommendation lineage or fingerprint is inconsistent.',
        500
      );
    }
    return clone(recommendation);
  }

  private viewIntake(row: Row): ProductionIntakeV1 {
    let intake: ProductionIntakeV1;
    try {
      intake = parseProductionIntakeV1(row.intake_record);
    } catch (cause) {
      throw new ProductionRecommendationError(
        'PERSISTED_INTAKE_INTEGRITY_FAILURE',
        'Stored Production Intake does not satisfy the V1 contract.',
        500,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const { fingerprintSha256, ...base } = intake;
    const valid =
      intake.workspaceId.toLowerCase() === String(row.workspace_id).toLowerCase() &&
      intake.intakeId === String(row.intake_id) &&
      intake.version === Number(row.version) &&
      intake.status === String(row.status) &&
      intake.channel === String(row.channel) &&
      intake.relationshipModel === String(row.relationship_model) &&
      intake.sourceClass === String(row.source_class) &&
      fingerprintSha256 === String(row.fingerprint_sha256) &&
      fingerprintSha256 === productionRecommendationSha256(intakeArtifactMaterial(base)) &&
      productionRecommendationSha256(intake.input) ===
        productionRecommendationSha256(row.input_snapshot);
    if (!valid) {
      throw new ProductionRecommendationError(
        'PERSISTED_INTAKE_INTEGRITY_FAILURE',
        'Stored Production Intake lineage or fingerprint is inconsistent.',
        500
      );
    }
    return clone(intake);
  }

  private persistence(cause: unknown): ProductionRecommendationError {
    return new ProductionRecommendationError(
      'PERSISTENCE_UNAVAILABLE',
      'Production Recommendation persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
