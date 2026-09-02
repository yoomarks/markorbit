import { createHash, randomUUID } from 'node:crypto';
import type { Permission, WorkspacePrincipal } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';

export interface DurablePreparationLockTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}

export interface DurablePreparationLockInstructionSource {
  instructionEntryId: string;
  sequence: number;
  canonicalFingerprint: string;
}

export interface DurablePreparationLockView {
  schemaVersion: 1;
  preparationLockId: `preparation-lock_${string}`;
  workspaceId: string;
  version: 1;
  source: Readonly<{
    documentPackageId: `document-package_${string}`;
    documentPackageVersion: number;
    canonicalEvidenceHash: string;
    formalMatterId: `formal-matter_${string}`;
    formalMatterVersion: number;
    formalMatterHash: string;
    professionalReviewCaseId: `professional-review_${string}`;
    reviewVersion: number;
    completedDecisionId: string;
    completedDecisionHash: string;
    instructionEntryCount: number;
    instructionEntries: readonly Readonly<DurablePreparationLockInstructionSource>[];
    instructionSetHash: string;
  }>;
  lockPayloadHash: string;
  createdBy: string;
  createdAt: string;
  authority: Readonly<{
    filingAuthorizationCreated: false;
    executionReleaseCreated: false;
    externalFilingCreated: false;
    paymentCreated: false;
    providerContacted: false;
    officialTruthCreated: false;
  }>;
}

export class DurablePreparationLockError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'DurablePreparationLockError';
  }
}

type Row = Record<string, unknown>;

const noAuthority = Object.freeze({
  filingAuthorizationCreated: false as const,
  executionReleaseCreated: false as const,
  externalFilingCreated: false as const,
  paymentCreated: false as const,
  providerContacted: false as const,
  officialTruthCreated: false as const
});
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
const sha = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const validHash = (value: string) => /^[0-9a-f]{64}$/u.test(value);
const validKey = (value: string) => value.length >= 8 && value.length <= 200;
const timestamp = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value));

function requirePermission(principal: WorkspacePrincipal, permission: Permission) {
  if (!principal.permissions.includes(permission))
    throw new DurablePreparationLockError(
      'PERMISSION_DENIED',
      `${permission} permission is required.`,
      403
    );
}

function cloneView(value: DurablePreparationLockView): DurablePreparationLockView {
  return structuredClone(value);
}

export class PostgresDurablePreparationLockService {
  constructor(
    private readonly database: DurablePreparationLockTransactionHost,
    private readonly query: QueryClient,
    private readonly now = () => new Date().toISOString()
  ) {}

  async create(
    principal: WorkspacePrincipal,
    command: {
      documentPackageId: string;
      expectedDocumentPackageVersion: number;
      expectedCanonicalEvidenceHash: string;
      idempotencyKey: string;
    },
    correlationId?: string
  ): Promise<DurablePreparationLockView> {
    requirePermission(principal, 'document-package:mark-ready');
    if (
      !command.documentPackageId.startsWith('document-package_') ||
      !Number.isSafeInteger(command.expectedDocumentPackageVersion) ||
      command.expectedDocumentPackageVersion < 1 ||
      !validHash(command.expectedCanonicalEvidenceHash) ||
      !validKey(command.idempotencyKey)
    )
      throw new DurablePreparationLockError(
        'INVALID_PREPARATION_LOCK_COMMAND',
        'Exact READY Document Package version, canonical evidence hash and idempotency key are required.',
        400
      );
    const requestFingerprint = sha({ operation: 'CREATE_DURABLE_PREPARATION_LOCK', command });
    try {
      return await this.database.transact(
        async (client) => {
          const firstReplay = await this.replay(
            client,
            principal.workspaceId,
            command.idempotencyKey,
            requestFingerprint
          );
          if (firstReplay) return firstReplay;

          const packageResult = await client.query(
            'SELECT * FROM document_packages WHERE workspace_id=$1 AND document_package_id=$2 FOR UPDATE',
            [principal.workspaceId, command.documentPackageId]
          );
          if (!packageResult.rowCount)
            throw new DurablePreparationLockError(
              'DOCUMENT_PACKAGE_NOT_FOUND',
              'Durable Document Package was not found in this Workspace.',
              404
            );

          const secondReplay = await this.replay(
            client,
            principal.workspaceId,
            command.idempotencyKey,
            requestFingerprint
          );
          if (secondReplay) return secondReplay;

          const row = packageResult.rows[0] as Row;
          this.assertExactReadySource(row, command);
          const instructionEntries = await this.instructions(
            client,
            principal.workspaceId,
            command.documentPackageId
          );
          const source = this.source(row, instructionEntries);

          const existing = await client.query(
            'SELECT lock_record FROM markreg_preparation_locks WHERE workspace_id=$1 AND source_document_package_id=$2 AND source_document_package_version=$3 AND source_document_package_canonical_evidence_sha256=$4',
            [
              principal.workspaceId,
              command.documentPackageId,
              command.expectedDocumentPackageVersion,
              command.expectedCanonicalEvidenceHash
            ]
          );
          if (existing.rowCount) {
            const value = this.view(existing.rows[0] as Row);
            await this.recordCommand(
              client,
              principal.workspaceId,
              command.idempotencyKey,
              requestFingerprint,
              value,
              this.now()
            );
            return value;
          }

          const at = this.now();
          const preparationLockId = `preparation-lock_${randomUUID()}` as const;
          const lockPayloadHash = sha({ schemaVersion: 1, source });
          const value: DurablePreparationLockView = {
            schemaVersion: 1,
            preparationLockId,
            workspaceId: principal.workspaceId,
            version: 1,
            source,
            lockPayloadHash,
            createdBy: principal.userId,
            createdAt: at,
            authority: noAuthority
          };
          await client.query(
            `INSERT INTO markreg_preparation_locks (
              preparation_lock_id,workspace_id,version,
              source_document_package_id,source_document_package_version,source_document_package_canonical_evidence_sha256,
              source_formal_matter_id,source_formal_matter_version,source_formal_matter_sha256,
              source_professional_review_case_id,source_review_version,source_completed_decision_id,source_completed_decision_sha256,
              source_instruction_entry_count,source_instruction_entries,source_instruction_set_sha256,
              lock_payload_sha256,lock_record,created_by,created_at
            ) VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17::jsonb,$18,$19)`,
            [
              preparationLockId,
              principal.workspaceId,
              source.documentPackageId,
              source.documentPackageVersion,
              source.canonicalEvidenceHash,
              source.formalMatterId,
              source.formalMatterVersion,
              source.formalMatterHash,
              source.professionalReviewCaseId,
              source.reviewVersion,
              source.completedDecisionId,
              source.completedDecisionHash,
              source.instructionEntryCount,
              JSON.stringify(source.instructionEntries),
              source.instructionSetHash,
              lockPayloadHash,
              JSON.stringify(value),
              principal.userId,
              at
            ]
          );
          await this.recordCommand(
            client,
            principal.workspaceId,
            command.idempotencyKey,
            requestFingerprint,
            value,
            at
          );
          await client.query(
            'INSERT INTO markreg_preparation_lock_audit (workspace_id,preparation_lock_id,action,source_document_package_id,source_document_package_version,source_fingerprint_sha256,actor_id,correlation_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [
              principal.workspaceId,
              preparationLockId,
              'PREPARATION_LOCK_CREATED',
              source.documentPackageId,
              source.documentPackageVersion,
              lockPayloadHash,
              principal.userId,
              correlationId ?? null,
              at
            ]
          );
          return cloneView(value);
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof DurablePreparationLockError) throw cause;
      const code = String((cause as { code?: string }).code ?? '');
      if (code === '23503' || code === '23514')
        throw new DurablePreparationLockError(
          'STALE_PREPARATION_SOURCE',
          'Preparation Lock source no longer matches current durable READY package truth.',
          409,
          false,
          { cause: cause instanceof Error ? cause : undefined }
        );
      throw this.persistence(cause);
    }
  }

  async get(
    principal: WorkspacePrincipal,
    preparationLockId: string
  ): Promise<DurablePreparationLockView> {
    requirePermission(principal, 'document-package:read');
    try {
      const found = await this.query.query(
        'SELECT lock_record FROM markreg_preparation_locks WHERE workspace_id=$1 AND preparation_lock_id=$2',
        [principal.workspaceId, preparationLockId]
      );
      if (!found.rowCount)
        throw new DurablePreparationLockError(
          'PREPARATION_LOCK_NOT_FOUND',
          'Durable Preparation Lock was not found in this Workspace.',
          404
        );
      return this.view(found.rows[0] as Row);
    } catch (cause) {
      if (cause instanceof DurablePreparationLockError) throw cause;
      throw this.persistence(cause);
    }
  }

  async validateCurrent(
    principal: WorkspacePrincipal,
    preparationLockId: string
  ): Promise<DurablePreparationLockView> {
    requirePermission(principal, 'document-package:read');
    try {
      return await this.database.transact(async (client) => {
        const found = await client.query(
          'SELECT lock_record FROM markreg_preparation_locks WHERE workspace_id=$1 AND preparation_lock_id=$2',
          [principal.workspaceId, preparationLockId]
        );
        if (!found.rowCount)
          throw new DurablePreparationLockError(
            'PREPARATION_LOCK_NOT_FOUND',
            'Durable Preparation Lock was not found in this Workspace.',
            404
          );
        const lock = this.view(found.rows[0] as Row);
        const current = await client.query(
          'SELECT * FROM document_packages WHERE workspace_id=$1 AND document_package_id=$2',
          [principal.workspaceId, lock.source.documentPackageId]
        );
        if (!current.rowCount)
          throw new DurablePreparationLockError(
            'STALE_PREPARATION_SOURCE',
            'Preparation Lock source package is no longer available.',
            409
          );
        const row = current.rows[0] as Row;
        const instructions = await this.instructions(
          client,
          principal.workspaceId,
          lock.source.documentPackageId
        );
        const source = this.source(row, instructions);
        if (
          String(row.status) !== 'READY_FOR_PREPARATION_LOCK' ||
          source.documentPackageVersion !== lock.source.documentPackageVersion ||
          source.canonicalEvidenceHash !== lock.source.canonicalEvidenceHash ||
          source.formalMatterId !== lock.source.formalMatterId ||
          source.formalMatterVersion !== lock.source.formalMatterVersion ||
          source.formalMatterHash !== lock.source.formalMatterHash ||
          source.professionalReviewCaseId !== lock.source.professionalReviewCaseId ||
          source.reviewVersion !== lock.source.reviewVersion ||
          source.completedDecisionId !== lock.source.completedDecisionId ||
          source.completedDecisionHash !== lock.source.completedDecisionHash ||
          source.instructionEntryCount !== lock.source.instructionEntryCount ||
          source.instructionSetHash !== lock.source.instructionSetHash
        )
          throw new DurablePreparationLockError(
            'STALE_PREPARATION_SOURCE',
            'Preparation Lock source no longer matches current durable READY package truth.',
            409
          );
        return lock;
      });
    } catch (cause) {
      if (cause instanceof DurablePreparationLockError) throw cause;
      throw this.persistence(cause);
    }
  }

  private assertExactReadySource(
    row: Row,
    command: { expectedDocumentPackageVersion: number; expectedCanonicalEvidenceHash: string }
  ) {
    if (String(row.status) !== 'READY_FOR_PREPARATION_LOCK')
      throw new DurablePreparationLockError(
        'DOCUMENT_PACKAGE_NOT_READY',
        'Document Package must be READY_FOR_PREPARATION_LOCK.',
        409
      );
    const canonicalEvidenceHash =
      typeof row.canonical_evidence_sha256 === 'string' ? row.canonical_evidence_sha256 : '';
    if (
      Number(row.version) !== command.expectedDocumentPackageVersion ||
      canonicalEvidenceHash !== command.expectedCanonicalEvidenceHash
    )
      throw new DurablePreparationLockError(
        'STALE_PREPARATION_SOURCE',
        'Exact READY Document Package version and canonical evidence hash are required.',
        409
      );
  }

  private source(row: Row, instructionEntries: DurablePreparationLockInstructionSource[]) {
    const frozenEntries = instructionEntries.map((entry) => Object.freeze({ ...entry }));
    return Object.freeze({
      documentPackageId: String(row.document_package_id) as `document-package_${string}`,
      documentPackageVersion: Number(row.version),
      canonicalEvidenceHash: String(row.canonical_evidence_sha256),
      formalMatterId: String(row.formal_matter_id) as `formal-matter_${string}`,
      formalMatterVersion: Number(row.source_formal_matter_version),
      formalMatterHash: String(row.source_formal_matter_sha256),
      professionalReviewCaseId: String(
        row.professional_review_case_id
      ) as `professional-review_${string}`,
      reviewVersion: Number(row.source_review_version),
      completedDecisionId: String(row.source_completed_decision_id),
      completedDecisionHash: String(row.source_completed_decision_sha256),
      instructionEntryCount: frozenEntries.length,
      instructionEntries: Object.freeze(frozenEntries),
      instructionSetHash: sha(frozenEntries)
    });
  }

  private async instructions(client: QueryClient, workspaceId: string, documentPackageId: string) {
    const result = await client.query(
      'SELECT instruction_entry_id,sequence,canonical_fingerprint FROM document_instruction_entries WHERE workspace_id=$1 AND document_package_id=$2 ORDER BY sequence,instruction_entry_id',
      [workspaceId, documentPackageId]
    );
    return result.rows.map((raw: unknown) => {
      const row = raw as Row;
      return {
        instructionEntryId: String(row.instruction_entry_id),
        sequence: Number(row.sequence),
        canonicalFingerprint: String(row.canonical_fingerprint)
      };
    });
  }

  private async replay(
    client: QueryClient,
    workspaceId: string,
    key: string,
    fingerprint: string
  ): Promise<DurablePreparationLockView | null> {
    const found = await client.query(
      'SELECT request_fingerprint_sha256,response_data FROM markreg_preparation_lock_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
      [workspaceId, key]
    );
    if (!found.rowCount) return null;
    const row = found.rows[0] as Row;
    if (String(row.request_fingerprint_sha256) !== fingerprint)
      throw new DurablePreparationLockError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has conflicting input.'
      );
    return cloneView(row.response_data as DurablePreparationLockView);
  }

  private async recordCommand(
    client: QueryClient,
    workspaceId: string,
    key: string,
    fingerprint: string,
    value: DurablePreparationLockView,
    at: string
  ) {
    await client.query(
      'INSERT INTO markreg_preparation_lock_commands (workspace_id,idempotency_key,request_fingerprint_sha256,preparation_lock_id,response_version,response_data,created_at) VALUES ($1,$2,$3,$4,1,$5::jsonb,$6)',
      [workspaceId, key, fingerprint, value.preparationLockId, JSON.stringify(value), at]
    );
  }

  private view(row: Row): DurablePreparationLockView {
    const value = row.lock_record as DurablePreparationLockView;
    return {
      ...structuredClone(value),
      createdAt: timestamp(value.createdAt)
    };
  }

  private persistence(cause: unknown) {
    return new DurablePreparationLockError(
      'PERSISTENCE_UNAVAILABLE',
      'Durable Preparation Lock persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
