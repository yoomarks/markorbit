import { createHash } from 'node:crypto';
import type { Permission, WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  parseCreateUserSelectionCommandV1,
  parseProductionRecommendationV1,
  parseRecommendationArtifactV1,
  parseUserSelectionV1,
  type CreateUserSelectionCommandV1,
  type ProductionRecommendationV1,
  type RecommendationArtifactV1,
  type UserSelectionV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { QueryClient } from '@markorbit/persistence';
import { productionRecommendationSha256 } from './production-recommendation.js';

export interface ProductionUserSelectionTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}

export class ProductionUserSelectionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductionUserSelectionError';
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

export function productionUserSelectionSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function requirePermission(principal: WorkspacePrincipal, permission: Permission): void {
  if (!principal.permissions.includes(permission)) {
    throw new ProductionUserSelectionError(
      'PERMISSION_DENIED',
      `${permission} permission is required.`,
      403
    );
  }
}

function exactCommand(value: unknown): CreateUserSelectionCommandV1 {
  try {
    return parseCreateUserSelectionCommandV1(value);
  } catch (cause) {
    throw new ProductionUserSelectionError(
      'INVALID_PRODUCTION_USER_SELECTION_REQUEST',
      'Production User Selection command is invalid.',
      400,
      false,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}

function requestMaterial(command: CreateUserSelectionCommandV1) {
  return {
    schemaVersion: command.schemaVersion,
    recommendationId: command.recommendationId,
    expectedRecommendationVersion: command.expectedRecommendationVersion,
    selectedOptionCode: command.selectedOptionCode
  };
}

function immutableSelectionMaterial(
  value: Omit<UserSelectionV1, 'fingerprintSha256'>
): Omit<UserSelectionV1, 'fingerprintSha256' | 'status'> {
  return {
    schemaVersion: value.schemaVersion,
    selectionId: value.selectionId,
    workspaceId: value.workspaceId,
    version: value.version,
    recommendation: value.recommendation,
    selectedOptionCode: value.selectedOptionCode,
    selectedAt: value.selectedAt,
    authorityConsequences: value.authorityConsequences
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function iso(value: unknown): string {
  return new Date(value as string | number | Date).toISOString();
}

export class PostgresProductionUserSelectionService {
  constructor(
    private readonly database: ProductionUserSelectionTransactionHost,
    private readonly query: QueryClient,
    private readonly now = () => new Date().toISOString()
  ) {}

  async create(
    principal: WorkspacePrincipal,
    rawCommand: Readonly<CreateUserSelectionCommandV1>,
    correlationId?: string
  ): Promise<UserSelectionV1> {
    requirePermission(principal, 'matter:create');
    const command = exactCommand(rawCommand);
    const requestFingerprint = productionUserSelectionSha256(requestMaterial(command));

    const replayBeforeTransaction = await this.safeReplay(
      this.query,
      principal.workspaceId,
      command.idempotencyKey,
      requestFingerprint
    );
    if (replayBeforeTransaction) return replayBeforeTransaction;

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

          const recommendation = await this.lockSelectableRecommendation(
            client,
            principal.workspaceId,
            command.recommendationId,
            command.expectedRecommendationVersion,
            command.selectedOptionCode
          );
          const currentSelections = await this.currentSelections(
            client,
            principal.workspaceId,
            recommendation.recommendationId,
            recommendation.version
          );
          if (currentSelections.length > 1) {
            throw new ProductionUserSelectionError(
              'SELECTION_STATE_INTEGRITY_FAILURE',
              'More than one current Selection exists for the exact Recommendation.',
              500
            );
          }

          const selectedAt = this.now();
          const selectionId = `selection_${productionUserSelectionSha256({
            workspaceId: principal.workspaceId,
            recommendationId: recommendation.recommendationId,
            recommendationVersion: recommendation.version,
            selectedOptionCode: command.selectedOptionCode,
            idempotencyKey: command.idempotencyKey
          }).slice(0, 32)}` as UserSelectionV1['selectionId'];
          const base: Omit<UserSelectionV1, 'fingerprintSha256'> = {
            schemaVersion: 1,
            selectionId,
            workspaceId: principal.workspaceId,
            version: 1,
            status: 'CURRENT',
            recommendation: {
              id: recommendation.recommendationId,
              version: recommendation.version,
              fingerprintSha256: recommendation.fingerprintSha256
            },
            selectedOptionCode: command.selectedOptionCode,
            selectedAt,
            authorityConsequences: noEarlyFunnelAuthorityConsequences
          };
          const selection = parseUserSelectionV1({
            ...base,
            fingerprintSha256: productionUserSelectionSha256(immutableSelectionMaterial(base))
          });

          await client.query(
            `INSERT INTO markreg_early_funnel_selections (
              workspace_id,selection_id,version,initial_status,recommendation_id,
              recommendation_version,recommendation_fingerprint_sha256,selected_option_code,
              selected_at,fingerprint_sha256,selection_record,created_by
            ) VALUES ($1,$2,1,'CURRENT',$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
            [
              principal.workspaceId,
              selection.selectionId,
              recommendation.recommendationId,
              recommendation.version,
              recommendation.fingerprintSha256,
              selection.selectedOptionCode,
              selection.selectedAt,
              selection.fingerprintSha256,
              JSON.stringify(selection),
              principal.userId
            ]
          );

          const effectiveCorrelationId = correlationId ?? command.correlationId;
          for (const current of currentSelections) {
            await client.query(
              `INSERT INTO markreg_early_funnel_selection_state_events (
                workspace_id,selection_id,selection_version,recommendation_id,
                recommendation_version,state,superseding_selection_id,actor_id,
                correlation_id,occurred_at
              ) VALUES ($1,$2,$3,$4,$5,'SUPERSEDED',$6,$7,$8,$9)`,
              [
                principal.workspaceId,
                current.selectionId,
                current.version,
                recommendation.recommendationId,
                recommendation.version,
                selection.selectionId,
                principal.userId,
                effectiveCorrelationId,
                selectedAt
              ]
            );
            await client.query(
              `INSERT INTO markreg_early_funnel_audit (
                workspace_id,entity_type,entity_id,entity_version,action,source_lineage,
                request_fingerprint_sha256,actor_id,correlation_id,occurred_at
              ) VALUES ($1,'SELECTION',$2,$3,'PRODUCTION_USER_SELECTION_SUPERSEDED',$4::jsonb,
                $5,$6,$7,$8)`,
              [
                principal.workspaceId,
                current.selectionId,
                current.version,
                JSON.stringify({
                  recommendation: selection.recommendation,
                  supersedingSelection: { id: selection.selectionId, version: selection.version }
                }),
                requestFingerprint,
                principal.userId,
                effectiveCorrelationId,
                selectedAt
              ]
            );
          }

          await client.query(
            `INSERT INTO markreg_early_funnel_selection_state_events (
              workspace_id,selection_id,selection_version,recommendation_id,
              recommendation_version,state,superseding_selection_id,actor_id,
              correlation_id,occurred_at
            ) VALUES ($1,$2,1,$3,$4,'CURRENT',NULL,$5,$6,$7)`,
            [
              principal.workspaceId,
              selection.selectionId,
              recommendation.recommendationId,
              recommendation.version,
              principal.userId,
              effectiveCorrelationId,
              selectedAt
            ]
          );
          await client.query(
            `INSERT INTO markreg_early_funnel_commands (
              workspace_id,command_type,idempotency_key,request_fingerprint_sha256,
              response_entity_type,response_entity_id,response_entity_version,response_data,created_at
            ) VALUES ($1,'CREATE_SELECTION',$2,$3,'SELECTION',$4,1,$5::jsonb,$6)`,
            [
              principal.workspaceId,
              command.idempotencyKey,
              requestFingerprint,
              selection.selectionId,
              JSON.stringify(selection),
              selectedAt
            ]
          );
          await client.query(
            `INSERT INTO markreg_early_funnel_audit (
              workspace_id,entity_type,entity_id,entity_version,action,source_lineage,
              request_fingerprint_sha256,actor_id,correlation_id,occurred_at
            ) VALUES ($1,'SELECTION',$2,1,'PRODUCTION_USER_SELECTION_CREATED',$3::jsonb,
              $4,$5,$6,$7)`,
            [
              principal.workspaceId,
              selection.selectionId,
              JSON.stringify({ recommendation: selection.recommendation }),
              requestFingerprint,
              principal.userId,
              effectiveCorrelationId,
              selectedAt
            ]
          );
          return clone(selection);
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof ProductionUserSelectionError) throw cause;
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

  async get(principal: WorkspacePrincipal, selectionId: string): Promise<UserSelectionV1> {
    requirePermission(principal, 'workspace:read');
    try {
      const result = await this.query.query(
        `SELECT s.*,latest.state AS effective_state
         FROM markreg_early_funnel_selections s
         JOIN LATERAL (
           SELECT e.state,e.state_event_id
           FROM markreg_early_funnel_selection_state_events e
           WHERE e.workspace_id=s.workspace_id
             AND e.selection_id=s.selection_id
             AND e.selection_version=s.version
           ORDER BY e.state_event_id DESC
           LIMIT 1
         ) latest ON TRUE
         WHERE s.workspace_id=$1 AND s.selection_id=$2
         ORDER BY s.version DESC LIMIT 1`,
        [principal.workspaceId, selectionId]
      );
      if (!result.rowCount) {
        throw new ProductionUserSelectionError(
          'PRODUCTION_USER_SELECTION_NOT_FOUND',
          'Production User Selection was not found in this Workspace.',
          404
        );
      }
      return this.viewSelection(result.rows[0] as Row);
    } catch (cause) {
      if (cause instanceof ProductionUserSelectionError) throw cause;
      throw this.persistence(cause);
    }
  }

  private async lockSelectableRecommendation(
    client: QueryClient,
    workspaceId: string,
    recommendationId: string,
    expectedVersion: number,
    selectedOptionCode: CreateUserSelectionCommandV1['selectedOptionCode']
  ): Promise<ProductionRecommendationV1> {
    const result = await client.query(
      `SELECT * FROM markreg_early_funnel_recommendations
       WHERE workspace_id=$1 AND recommendation_id=$2
       ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [workspaceId, recommendationId]
    );
    if (!result.rowCount) {
      throw new ProductionUserSelectionError(
        'PRODUCTION_RECOMMENDATION_NOT_FOUND',
        'Production Recommendation was not found in this Workspace.',
        404
      );
    }
    const recommendation = this.viewRecommendation(result.rows[0] as Row);
    if (recommendation.version !== expectedVersion) {
      throw new ProductionUserSelectionError(
        'RECOMMENDATION_VERSION_CONFLICT',
        'Selection requires the exact current Recommendation version.',
        409
      );
    }
    if (
      recommendation.admissionClass !== 'PRODUCTION_ADMISSIBLE' ||
      recommendation.source.admissionClass !== 'PRODUCTION_ADMISSIBLE'
    ) {
      throw new ProductionUserSelectionError(
        'RECOMMENDATION_NOT_PRODUCTION_ADMISSIBLE',
        'Selection requires a production-admissible Recommendation and source.',
        422
      );
    }
    if (
      recommendation.currentness !== 'CURRENT' ||
      recommendation.source.currentness !== 'CURRENT'
    ) {
      throw new ProductionUserSelectionError(
        'RECOMMENDATION_NOT_CURRENT',
        'Selection requires a CURRENT Recommendation and analytical source.',
        409
      );
    }
    if (!recommendation.options.some((option) => option.code === selectedOptionCode)) {
      throw new ProductionUserSelectionError(
        'RECOMMENDATION_OPTION_NOT_FOUND',
        'selectedOptionCode is not present on the exact Recommendation.',
        422
      );
    }
    return parseProductionRecommendationV1(recommendation);
  }

  private async currentSelections(
    client: QueryClient,
    workspaceId: string,
    recommendationId: string,
    recommendationVersion: number
  ): Promise<UserSelectionV1[]> {
    const result = await client.query(
      `SELECT s.*,latest.state AS effective_state,latest.state_event_id
       FROM markreg_early_funnel_selections s
       JOIN LATERAL (
         SELECT e.state,e.state_event_id
         FROM markreg_early_funnel_selection_state_events e
         WHERE e.workspace_id=s.workspace_id
           AND e.selection_id=s.selection_id
           AND e.selection_version=s.version
         ORDER BY e.state_event_id DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE s.workspace_id=$1
         AND s.recommendation_id=$2
         AND s.recommendation_version=$3
         AND latest.state='CURRENT'
       ORDER BY latest.state_event_id DESC`,
      [workspaceId, recommendationId, recommendationVersion]
    );
    return result.rows.map((raw) => this.viewSelection(raw as Row));
  }

  private viewRecommendation(row: Row): RecommendationArtifactV1 {
    let recommendation: RecommendationArtifactV1;
    try {
      recommendation = parseRecommendationArtifactV1(row.recommendation_record);
    } catch (cause) {
      throw new ProductionUserSelectionError(
        'PERSISTED_RECOMMENDATION_INTEGRITY_FAILURE',
        'Stored Recommendation does not satisfy the V1 contract.',
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
      recommendation.admissionClass === String(row.admission_class) &&
      recommendation.currentness === String(row.currentness) &&
      recommendation.source.sourceId === String(row.source_id) &&
      recommendation.source.sourceVersion === String(row.source_version) &&
      recommendation.source.fingerprintSha256 === String(row.source_fingerprint_sha256) &&
      recommendation.source.admissionClass === String(row.source_admission_class) &&
      recommendation.source.currentness === String(row.source_currentness) &&
      fingerprintSha256 === String(row.fingerprint_sha256) &&
      fingerprintSha256 === productionRecommendationSha256(base);
    if (!valid) {
      throw new ProductionUserSelectionError(
        'PERSISTED_RECOMMENDATION_INTEGRITY_FAILURE',
        'Stored Recommendation lineage or fingerprint is inconsistent.',
        500
      );
    }
    return clone(recommendation);
  }

  private viewSelection(row: Row): UserSelectionV1 {
    let selection: UserSelectionV1;
    try {
      selection = parseUserSelectionV1(row.selection_record);
    } catch (cause) {
      throw new ProductionUserSelectionError(
        'PERSISTED_SELECTION_INTEGRITY_FAILURE',
        'Stored User Selection does not satisfy the V1 contract.',
        500,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const { fingerprintSha256, ...base } = selection;
    const effectiveState = typeof row.effective_state === 'string' ? row.effective_state : '';
    const valid =
      selection.workspaceId.toLowerCase() === String(row.workspace_id).toLowerCase() &&
      selection.selectionId === String(row.selection_id) &&
      selection.version === Number(row.version) &&
      selection.status === String(row.initial_status) &&
      selection.recommendation.id === String(row.recommendation_id) &&
      selection.recommendation.version === Number(row.recommendation_version) &&
      selection.recommendation.fingerprintSha256 ===
        String(row.recommendation_fingerprint_sha256) &&
      selection.selectedOptionCode === String(row.selected_option_code) &&
      selection.selectedAt === iso(row.selected_at) &&
      fingerprintSha256 === String(row.fingerprint_sha256) &&
      fingerprintSha256 === productionUserSelectionSha256(immutableSelectionMaterial(base)) &&
      (effectiveState === 'CURRENT' || effectiveState === 'SUPERSEDED');
    if (!valid) {
      throw new ProductionUserSelectionError(
        'PERSISTED_SELECTION_INTEGRITY_FAILURE',
        'Stored User Selection lineage, state, or fingerprint is inconsistent.',
        500
      );
    }
    return clone(parseUserSelectionV1({ ...selection, status: effectiveState }));
  }

  private async safeReplay(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<UserSelectionV1 | null> {
    try {
      return await this.replay(client, workspaceId, idempotencyKey, requestFingerprint);
    } catch (cause) {
      if (cause instanceof ProductionUserSelectionError) throw cause;
      throw this.persistence(cause);
    }
  }

  private async replay(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<UserSelectionV1 | null> {
    const result = await client.query(
      `SELECT request_fingerprint_sha256,response_data
       FROM markreg_early_funnel_commands
       WHERE workspace_id=$1 AND command_type='CREATE_SELECTION' AND idempotency_key=$2`,
      [workspaceId, idempotencyKey]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0] as Row;
    if (String(row.request_fingerprint_sha256) !== requestFingerprint) {
      throw new ProductionUserSelectionError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used with a materially different Selection request.',
        409
      );
    }
    const selection = parseUserSelectionV1(row.response_data);
    const { fingerprintSha256, ...base } = selection;
    if (
      selection.workspaceId.toLowerCase() !== workspaceId.toLowerCase() ||
      fingerprintSha256 !== productionUserSelectionSha256(immutableSelectionMaterial(base))
    ) {
      throw new ProductionUserSelectionError(
        'PERSISTED_SELECTION_INTEGRITY_FAILURE',
        'Stored Selection replay receipt is inconsistent.',
        500
      );
    }
    return clone(selection);
  }

  private persistence(cause: unknown): ProductionUserSelectionError {
    return new ProductionUserSelectionError(
      'PERSISTENCE_UNAVAILABLE',
      'Production User Selection persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
