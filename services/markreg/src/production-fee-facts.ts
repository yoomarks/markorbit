import { createHash } from 'node:crypto';
import type { Permission, WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  parseCreateProductionFeeFactsCommandV1,
  parseProductionFeeFactsV1,
  parseProductionIntakeV1,
  type CreateProductionFeeFactsCommandV1,
  type ProductionFeeFactsV1,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { QueryClient } from '@markorbit/persistence';

export interface ProductionFeeFactsTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}

export class ProductionFeeFactsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductionFeeFactsError';
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

export function productionFeeFactsSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function requirePermission(principal: WorkspacePrincipal, permission: Permission): void {
  if (!principal.permissions.includes(permission))
    throw new ProductionFeeFactsError(
      'PERMISSION_DENIED',
      `${permission} permission is required.`,
      403
    );
}

function exactCommand(value: unknown): CreateProductionFeeFactsCommandV1 {
  try {
    return parseCreateProductionFeeFactsCommandV1(value);
  } catch (cause) {
    throw new ProductionFeeFactsError(
      'INVALID_PRODUCTION_FEE_FACTS_REQUEST',
      'Production fee-facts command is invalid.',
      400,
      false,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}

function authorizeSourceClasses(
  principal: WorkspacePrincipal,
  command: CreateProductionFeeFactsCommandV1
): void {
  const professional =
    command.filingBasisSourceClass === 'PROFESSIONALLY_ESTABLISHED' ||
    command.classSelectionSourceClass === 'PROFESSIONALLY_ESTABLISHED';
  requirePermission(principal, professional ? 'review:perform' : 'matter:create');
}

function requestMaterial(command: CreateProductionFeeFactsCommandV1) {
  return {
    schemaVersion: command.schemaVersion,
    intakeId: command.intakeId,
    expectedIntakeVersion: command.expectedIntakeVersion,
    filingBasis: command.filingBasis,
    niceClasses: command.niceClasses,
    filingBasisSourceClass: command.filingBasisSourceClass,
    classSelectionSourceClass: command.classSelectionSourceClass
  };
}

function immutableMaterial(
  value: Omit<ProductionFeeFactsV1, 'fingerprintSha256'>
): Omit<ProductionFeeFactsV1, 'fingerprintSha256' | 'currentness'> {
  const { currentness: ignored, ...immutable } = value;
  void ignored;
  return immutable;
}

function intakeMaterial(value: ProductionIntakeV1): Omit<ProductionIntakeV1, 'fingerprintSha256'> {
  const { fingerprintSha256: ignored, ...base } = value;
  void ignored;
  return base;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function iso(value: unknown): string {
  return new Date(value as string | number | Date).toISOString();
}

export class PostgresProductionFeeFactsService {
  constructor(
    private readonly database: ProductionFeeFactsTransactionHost,
    private readonly query: QueryClient,
    private readonly now = () => new Date().toISOString()
  ) {}

  async create(
    principal: WorkspacePrincipal,
    rawCommand: Readonly<CreateProductionFeeFactsCommandV1>,
    correlationId?: string
  ): Promise<ProductionFeeFactsV1> {
    const command = exactCommand(rawCommand);
    authorizeSourceClasses(principal, command);
    const requestFingerprint = productionFeeFactsSha256(requestMaterial(command));
    const earlyReplay = await this.safeReplay(
      this.query,
      principal.workspaceId,
      command.idempotencyKey,
      requestFingerprint
    );
    if (earlyReplay) return earlyReplay;

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
          const current = await this.currentForIntake(
            client,
            principal.workspaceId,
            intake.intakeId,
            intake.version
          );
          if (current.length > 1)
            throw new ProductionFeeFactsError(
              'PRODUCTION_FEE_FACTS_STATE_INTEGRITY_FAILURE',
              'More than one CURRENT fee-facts snapshot exists for the exact Intake.',
              500
            );

          const at = this.now();
          const feeFactsId = `fee-facts_${productionFeeFactsSha256({
            workspaceId: principal.workspaceId,
            intakeId: intake.intakeId,
            intakeVersion: intake.version,
            idempotencyKey: command.idempotencyKey
          }).slice(0, 32)}` as ProductionFeeFactsV1['feeFactsId'];
          const provenance = (
            sourceClass: CreateProductionFeeFactsCommandV1['filingBasisSourceClass']
          ) => ({
            sourceClass,
            actorId: principal.userId,
            membershipId: principal.membershipId,
            establishedAt: at
          });
          const base: Omit<ProductionFeeFactsV1, 'fingerprintSha256'> = {
            schemaVersion: 1,
            feeFactsId,
            workspaceId: principal.workspaceId,
            version: 1,
            currentness: 'CURRENT',
            intake: {
              id: intake.intakeId,
              version: intake.version,
              fingerprintSha256: intake.fingerprintSha256
            },
            filingBasis: command.filingBasis,
            niceClasses: command.niceClasses,
            classCount: command.niceClasses.length,
            filingBasisProvenance: provenance(command.filingBasisSourceClass),
            classSelectionProvenance: provenance(command.classSelectionSourceClass),
            recordedAt: at,
            authorityConsequences: noEarlyFunnelAuthorityConsequences
          };
          const value = parseProductionFeeFactsV1({
            ...base,
            fingerprintSha256: productionFeeFactsSha256(immutableMaterial(base))
          });
          const effectiveCorrelation = correlationId ?? command.correlationId;

          await client.query(
            `INSERT INTO markreg_production_fee_facts (
              workspace_id,fee_facts_id,version,initial_currentness,intake_id,intake_version,
              intake_fingerprint_sha256,filing_basis,nice_classes,class_count,
              filing_basis_provenance,class_selection_provenance,fingerprint_sha256,
              fee_facts_record,created_by,recorded_at
            ) VALUES ($1,$2,1,'CURRENT',$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13,$14)`,
            [
              principal.workspaceId,
              value.feeFactsId,
              intake.intakeId,
              intake.version,
              intake.fingerprintSha256,
              value.filingBasis,
              JSON.stringify(value.niceClasses),
              value.classCount,
              JSON.stringify(value.filingBasisProvenance),
              JSON.stringify(value.classSelectionProvenance),
              value.fingerprintSha256,
              JSON.stringify(value),
              principal.userId,
              at
            ]
          );

          for (const previous of current) {
            await client.query(
              `INSERT INTO markreg_production_fee_fact_state_events (
                workspace_id,fee_facts_id,fee_facts_version,intake_id,intake_version,state,
                superseding_fee_facts_id,actor_id,correlation_id,occurred_at
              ) VALUES ($1,$2,$3,$4,$5,'SUPERSEDED',$6,$7,$8,$9)`,
              [
                principal.workspaceId,
                previous.feeFactsId,
                previous.version,
                intake.intakeId,
                intake.version,
                value.feeFactsId,
                principal.userId,
                effectiveCorrelation,
                at
              ]
            );
          }

          await client.query(
            `INSERT INTO markreg_production_fee_fact_state_events (
              workspace_id,fee_facts_id,fee_facts_version,intake_id,intake_version,state,
              superseding_fee_facts_id,actor_id,correlation_id,occurred_at
            ) VALUES ($1,$2,1,$3,$4,'CURRENT',NULL,$5,$6,$7)`,
            [
              principal.workspaceId,
              value.feeFactsId,
              intake.intakeId,
              intake.version,
              principal.userId,
              effectiveCorrelation,
              at
            ]
          );
          await client.query(
            `INSERT INTO markreg_production_fee_fact_commands (
              workspace_id,idempotency_key,request_fingerprint_sha256,response_fee_facts_id,
              response_fee_facts_version,response_data,created_at
            ) VALUES ($1,$2,$3,$4,1,$5::jsonb,$6)`,
            [
              principal.workspaceId,
              command.idempotencyKey,
              requestFingerprint,
              value.feeFactsId,
              JSON.stringify(value),
              at
            ]
          );
          await client.query(
            `INSERT INTO markreg_production_fee_fact_audit (
              workspace_id,fee_facts_id,fee_facts_version,action,source_lineage,
              request_fingerprint_sha256,actor_id,correlation_id,occurred_at
            ) VALUES ($1,$2,1,'PRODUCTION_FEE_FACTS_RECORDED',$3::jsonb,$4,$5,$6,$7)`,
            [
              principal.workspaceId,
              value.feeFactsId,
              JSON.stringify({
                intake: value.intake,
                filingBasisSourceClass: command.filingBasisSourceClass,
                classSelectionSourceClass: command.classSelectionSourceClass
              }),
              requestFingerprint,
              principal.userId,
              effectiveCorrelation,
              at
            ]
          );
          return clone(value);
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof ProductionFeeFactsError) throw cause;
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

  async getCurrent(
    principal: WorkspacePrincipal,
    intakeId: string,
    expectedIntakeVersion: number
  ): Promise<ProductionFeeFactsV1> {
    requirePermission(principal, 'workspace:read');
    try {
      const intake = await this.exactCurrentIntake(
        this.query,
        principal.workspaceId,
        intakeId,
        expectedIntakeVersion
      );
      const current = await this.currentForIntake(
        this.query,
        principal.workspaceId,
        intake.intakeId,
        intake.version
      );
      if (current.length === 0)
        throw new ProductionFeeFactsError(
          'PRODUCTION_FEE_FACTS_NOT_FOUND',
          'CURRENT Production fee facts were not found for this exact Intake.',
          404
        );
      if (current.length > 1)
        throw new ProductionFeeFactsError(
          'PRODUCTION_FEE_FACTS_STATE_INTEGRITY_FAILURE',
          'More than one CURRENT fee-facts snapshot exists for the exact Intake.',
          500
        );
      const value = current[0]!;
      if (value.intake.fingerprintSha256 !== intake.fingerprintSha256)
        throw new ProductionFeeFactsError(
          'PRODUCTION_FEE_FACTS_STALE',
          'Fee facts do not match the exact current Intake fingerprint.',
          409
        );
      return value;
    } catch (cause) {
      if (cause instanceof ProductionFeeFactsError) throw cause;
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
    return this.assertExactIntake(result.rows as Row[], expectedVersion);
  }

  private async exactCurrentIntake(
    client: QueryClient,
    workspaceId: string,
    intakeId: string,
    expectedVersion: number
  ): Promise<ProductionIntakeV1> {
    const result = await client.query(
      `SELECT * FROM markreg_early_funnel_intakes
       WHERE workspace_id=$1 AND intake_id=$2
       ORDER BY version DESC LIMIT 1`,
      [workspaceId, intakeId]
    );
    return this.assertExactIntake(result.rows as Row[], expectedVersion);
  }

  private assertExactIntake(rows: Row[], expectedVersion: number): ProductionIntakeV1 {
    if (rows.length === 0)
      throw new ProductionFeeFactsError(
        'PRODUCTION_INTAKE_NOT_FOUND',
        'Production Intake was not found in this Workspace.',
        404
      );
    const intake = this.viewIntake(rows[0]!);
    if (intake.version !== expectedVersion)
      throw new ProductionFeeFactsError(
        'PRODUCTION_INTAKE_VERSION_CONFLICT',
        'Fee facts require the exact current Production Intake version.',
        409
      );
    return intake;
  }

  private viewIntake(row: Row): ProductionIntakeV1 {
    let intake: ProductionIntakeV1;
    try {
      intake = parseProductionIntakeV1(row.intake_record);
    } catch (cause) {
      throw new ProductionFeeFactsError(
        'PERSISTED_INTAKE_INTEGRITY_FAILURE',
        'Stored Production Intake does not satisfy the V1 contract.',
        500,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const valid =
      intake.workspaceId.toLowerCase() === String(row.workspace_id).toLowerCase() &&
      intake.intakeId === String(row.intake_id) &&
      intake.version === Number(row.version) &&
      intake.fingerprintSha256 === String(row.fingerprint_sha256) &&
      intake.fingerprintSha256 === productionFeeFactsSha256(intakeMaterial(intake));
    if (!valid)
      throw new ProductionFeeFactsError(
        'PERSISTED_INTAKE_INTEGRITY_FAILURE',
        'Stored Production Intake lineage or fingerprint is inconsistent.',
        500
      );
    return clone(intake);
  }

  private async currentForIntake(
    client: QueryClient,
    workspaceId: string,
    intakeId: string,
    intakeVersion: number
  ): Promise<ProductionFeeFactsV1[]> {
    const result = await client.query(
      `SELECT f.*,latest.state AS effective_state,latest.state_event_id
       FROM markreg_production_fee_facts f
       JOIN LATERAL (
         SELECT e.state,e.state_event_id
         FROM markreg_production_fee_fact_state_events e
         WHERE e.workspace_id=f.workspace_id
           AND e.fee_facts_id=f.fee_facts_id
           AND e.fee_facts_version=f.version
         ORDER BY e.state_event_id DESC LIMIT 1
       ) latest ON TRUE
       WHERE f.workspace_id=$1 AND f.intake_id=$2 AND f.intake_version=$3
         AND latest.state='CURRENT'
       ORDER BY latest.state_event_id DESC`,
      [workspaceId, intakeId, intakeVersion]
    );
    return result.rows.map((row) => this.view(row as Row));
  }

  private view(row: Row): ProductionFeeFactsV1 {
    let value: ProductionFeeFactsV1;
    try {
      value = parseProductionFeeFactsV1(row.fee_facts_record);
    } catch (cause) {
      throw new ProductionFeeFactsError(
        'PERSISTED_PRODUCTION_FEE_FACTS_INTEGRITY_FAILURE',
        'Stored Production fee facts do not satisfy the V1 contract.',
        500,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const effective =
      row.effective_state === 'CURRENT' || row.effective_state === 'SUPERSEDED'
        ? row.effective_state
        : undefined;
    const { fingerprintSha256, ...base } = value;
    const valid =
      (effective === 'CURRENT' || effective === 'SUPERSEDED') &&
      value.workspaceId.toLowerCase() === String(row.workspace_id).toLowerCase() &&
      value.feeFactsId === String(row.fee_facts_id) &&
      value.version === Number(row.version) &&
      value.intake.id === String(row.intake_id) &&
      value.intake.version === Number(row.intake_version) &&
      value.intake.fingerprintSha256 === String(row.intake_fingerprint_sha256) &&
      value.filingBasis === String(row.filing_basis) &&
      JSON.stringify(value.niceClasses) === JSON.stringify(row.nice_classes) &&
      value.classCount === Number(row.class_count) &&
      value.recordedAt === iso(row.recorded_at) &&
      fingerprintSha256 === String(row.fingerprint_sha256) &&
      fingerprintSha256 === productionFeeFactsSha256(immutableMaterial(base));
    if (!valid)
      throw new ProductionFeeFactsError(
        'PERSISTED_PRODUCTION_FEE_FACTS_INTEGRITY_FAILURE',
        'Stored Production fee-facts lineage, material, state, or fingerprint is inconsistent.',
        500
      );
    return clone(parseProductionFeeFactsV1({ ...value, currentness: effective }));
  }

  private async safeReplay(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProductionFeeFactsV1 | null> {
    try {
      return await this.replay(client, workspaceId, idempotencyKey, requestFingerprint);
    } catch (cause) {
      if (cause instanceof ProductionFeeFactsError) throw cause;
      throw this.persistence(cause);
    }
  }

  private async replay(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProductionFeeFactsV1 | null> {
    const result = await client.query(
      `SELECT request_fingerprint_sha256,response_data
       FROM markreg_production_fee_fact_commands
       WHERE workspace_id=$1 AND idempotency_key=$2`,
      [workspaceId, idempotencyKey]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0] as Row;
    if (String(row.request_fingerprint_sha256) !== requestFingerprint)
      throw new ProductionFeeFactsError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used with materially different fee facts.',
        409
      );
    const value = parseProductionFeeFactsV1(row.response_data);
    const { fingerprintSha256, ...base } = value;
    if (
      value.workspaceId.toLowerCase() !== workspaceId.toLowerCase() ||
      fingerprintSha256 !== productionFeeFactsSha256(immutableMaterial(base))
    )
      throw new ProductionFeeFactsError(
        'PERSISTED_PRODUCTION_FEE_FACTS_INTEGRITY_FAILURE',
        'Stored fee-facts replay receipt is inconsistent.',
        500
      );
    return clone(value);
  }

  private persistence(cause: unknown): ProductionFeeFactsError {
    return new ProductionFeeFactsError(
      'PERSISTENCE_UNAVAILABLE',
      'Production fee-facts persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
