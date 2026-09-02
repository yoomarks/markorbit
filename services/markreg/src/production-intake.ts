import { createHash, randomUUID } from 'node:crypto';
import type { Permission, WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  parseProductionIntakeV1,
  type CreateProductionIntakeCommandV1,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { QueryClient } from '@markorbit/persistence';

export interface ProductionIntakeTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}

export class ProductionIntakeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductionIntakeError';
  }
}

type Row = Record<string, unknown>;

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, member]) => member !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};

const sha256 = (value: unknown): string =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');

function requirePermission(principal: WorkspacePrincipal, permission: Permission): void {
  if (!principal.permissions.includes(permission))
    throw new ProductionIntakeError(
      'PERMISSION_DENIED',
      `${permission} permission is required.`,
      403
    );
}

function requestMaterial(command: CreateProductionIntakeCommandV1) {
  return {
    schemaVersion: command.schemaVersion,
    channel: command.channel,
    relationshipModel: command.relationshipModel,
    input: command.input
  };
}

function artifactMaterial(value: Omit<ProductionIntakeV1, 'fingerprintSha256'>) {
  return value;
}

function clone(value: ProductionIntakeV1): ProductionIntakeV1 {
  return structuredClone(value);
}

export class PostgresProductionIntakeService {
  constructor(
    private readonly database: ProductionIntakeTransactionHost,
    private readonly query: QueryClient,
    private readonly now = () => new Date().toISOString(),
    private readonly createId = () => `intake_${randomUUID()}` as const
  ) {}

  async create(
    principal: WorkspacePrincipal,
    command: CreateProductionIntakeCommandV1,
    correlationId?: string
  ): Promise<ProductionIntakeV1> {
    requirePermission(principal, 'matter:create');
    const requestFingerprint = sha256(requestMaterial(command));
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

          const at = this.now();
          const intakeId = this.createId();
          const base: Omit<ProductionIntakeV1, 'fingerprintSha256'> = {
            schemaVersion: 1,
            intakeId,
            workspaceId: principal.workspaceId,
            version: 1,
            status: 'RECEIVED',
            channel: command.channel,
            relationshipModel: command.relationshipModel,
            input: command.input,
            sourceClass: 'CUSTOMER_SUPPLIED',
            createdAt: at,
            updatedAt: at,
            authorityConsequences: noEarlyFunnelAuthorityConsequences
          };
          const value = parseProductionIntakeV1({
            ...base,
            fingerprintSha256: sha256(artifactMaterial(base))
          });

          await client.query(
            `INSERT INTO markreg_early_funnel_intakes (
              workspace_id,intake_id,version,status,channel,relationship_model,source_class,
              input_snapshot,fingerprint_sha256,intake_record,created_by,created_at,updated_at
            ) VALUES ($1,$2,1,$3,$4,$5,'CUSTOMER_SUPPLIED',$6::jsonb,$7,$8::jsonb,$9,$10,$10)`,
            [
              principal.workspaceId,
              value.intakeId,
              value.status,
              value.channel,
              value.relationshipModel,
              JSON.stringify(value.input),
              value.fingerprintSha256,
              JSON.stringify(value),
              principal.userId,
              at
            ]
          );
          await client.query(
            `INSERT INTO markreg_early_funnel_commands (
              workspace_id,command_type,idempotency_key,request_fingerprint_sha256,
              response_entity_type,response_entity_id,response_entity_version,response_data,created_at
            ) VALUES ($1,'CREATE_INTAKE',$2,$3,'INTAKE',$4,1,$5::jsonb,$6)`,
            [
              principal.workspaceId,
              command.idempotencyKey,
              requestFingerprint,
              value.intakeId,
              JSON.stringify(value),
              at
            ]
          );
          await client.query(
            `INSERT INTO markreg_early_funnel_audit (
              workspace_id,entity_type,entity_id,entity_version,action,source_lineage,
              request_fingerprint_sha256,actor_id,correlation_id,occurred_at
            ) VALUES ($1,'INTAKE',$2,1,'PRODUCTION_INTAKE_CREATED',$3::jsonb,$4,$5,$6,$7)`,
            [
              principal.workspaceId,
              value.intakeId,
              JSON.stringify({
                schemaVersion: 1,
                sourceClass: 'CUSTOMER_SUPPLIED',
                inputFingerprintSha256: sha256(value.input)
              }),
              requestFingerprint,
              principal.userId,
              correlationId ?? command.correlationId,
              at
            ]
          );
          return clone(value);
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof ProductionIntakeError) throw cause;
      if (String((cause as { code?: string }).code ?? '') === '23505') {
        try {
          const replay = await this.replay(
            this.query,
            principal.workspaceId,
            command.idempotencyKey,
            requestFingerprint
          );
          if (replay) return replay;
        } catch (replayError) {
          if (replayError instanceof ProductionIntakeError) throw replayError;
        }
      }
      throw this.persistence(cause);
    }
  }

  async get(principal: WorkspacePrincipal, intakeId: string): Promise<ProductionIntakeV1> {
    requirePermission(principal, 'workspace:read');
    try {
      const found = await this.query.query(
        `SELECT * FROM markreg_early_funnel_intakes
         WHERE workspace_id=$1 AND intake_id=$2
         ORDER BY version DESC
         LIMIT 1`,
        [principal.workspaceId, intakeId]
      );
      if (!found.rowCount)
        throw new ProductionIntakeError(
          'PRODUCTION_INTAKE_NOT_FOUND',
          'Production Intake was not found in this Workspace.',
          404
        );
      return this.view(found.rows[0] as Row);
    } catch (cause) {
      if (cause instanceof ProductionIntakeError) throw cause;
      throw this.persistence(cause);
    }
  }

  private async replay(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProductionIntakeV1 | null> {
    const found = await client.query(
      `SELECT request_fingerprint_sha256,response_data
       FROM markreg_early_funnel_commands
       WHERE workspace_id=$1 AND command_type='CREATE_INTAKE' AND idempotency_key=$2`,
      [workspaceId, idempotencyKey]
    );
    if (!found.rowCount) return null;
    const row = found.rows[0] as Row;
    if (String(row.request_fingerprint_sha256) !== requestFingerprint)
      throw new ProductionIntakeError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used with a materially different Production Intake request.',
        409
      );
    const value = parseProductionIntakeV1(row.response_data);
    if (value.workspaceId.toLowerCase() !== workspaceId.toLowerCase())
      throw new ProductionIntakeError(
        'PERSISTED_INTAKE_INTEGRITY_FAILURE',
        'Stored Production Intake replay does not match Workspace authority.',
        500
      );
    return clone(value);
  }

  private view(row: Row): ProductionIntakeV1 {
    let value: ProductionIntakeV1;
    try {
      value = parseProductionIntakeV1(row.intake_record);
    } catch (cause) {
      throw new ProductionIntakeError(
        'PERSISTED_INTAKE_INTEGRITY_FAILURE',
        'Stored Production Intake does not satisfy the V1 contract.',
        500,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const { fingerprintSha256: _storedFingerprint, ...base } = value;
    const valid =
      value.workspaceId.toLowerCase() === String(row.workspace_id).toLowerCase() &&
      value.intakeId === String(row.intake_id) &&
      value.version === Number(row.version) &&
      value.status === String(row.status) &&
      value.channel === String(row.channel) &&
      value.relationshipModel === String(row.relationship_model) &&
      value.sourceClass === String(row.source_class) &&
      value.fingerprintSha256 === String(row.fingerprint_sha256) &&
      value.fingerprintSha256 === sha256(artifactMaterial(base)) &&
      sha256(value.input) === sha256(row.input_snapshot);
    if (!valid)
      throw new ProductionIntakeError(
        'PERSISTED_INTAKE_INTEGRITY_FAILURE',
        'Stored Production Intake lineage or fingerprint is inconsistent.',
        500
      );
    return clone(value);
  }

  private persistence(cause: unknown): ProductionIntakeError {
    return new ProductionIntakeError(
      'PERSISTENCE_UNAVAILABLE',
      'Production Intake persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
