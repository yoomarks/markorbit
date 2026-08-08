import { createHash, randomUUID } from 'node:crypto';
import type {
  DurableDocumentEvidenceInput,
  DurableDocumentPackageView,
  DurableInstructionInput,
  ProfessionalReviewCase,
  WorkspacePrincipal
} from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';

export type DocumentPackageCommandType =
  | 'CREATE_OR_OPEN'
  | 'UPDATE_DRAFT'
  | 'UPSERT_DOCUMENT_EVIDENCE'
  | 'APPEND_INSTRUCTION'
  | 'SUPERSEDE_INSTRUCTION'
  | 'MARK_READY';
export type DocumentPackageAuditAction =
  | 'PACKAGE_OPENED'
  | 'PACKAGE_DRAFT_UPDATED'
  | 'DOCUMENT_EVIDENCE_UPSERTED'
  | 'INSTRUCTION_APPENDED'
  | 'INSTRUCTION_SUPERSEDED'
  | 'PACKAGE_MARKED_READY';

export class DocumentPackageError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'DocumentPackageError';
  }
}

export interface CompletedReviewSource {
  get(
    principal: WorkspacePrincipal,
    reviewCaseId: string,
    correlationId?: string
  ): Promise<ProfessionalReviewCase>;
}
export interface DocumentPackageTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}
type DocumentEvidenceInput = DurableDocumentEvidenceInput;
type InstructionInput = DurableInstructionInput;
type DocumentPackageView = DurableDocumentPackageView;

type Row = Record<string, unknown>;
const sha = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};
const requiredPermission = (
  principal: WorkspacePrincipal,
  permission:
    | 'document-package:read'
    | 'document-package:prepare'
    | 'instruction-ledger:write'
    | 'document-package:mark-ready'
) => {
  if (!principal.permissions.includes(permission))
    throw new DocumentPackageError(
      'PERMISSION_DENIED',
      `${permission} permission is required.`,
      403
    );
};
const validKey = (value: string) => value.length >= 8 && value.length <= 200;
const validHash = (value: string) => /^[0-9a-f]{64}$/u.test(value);
const timestamp = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value));

export class PostgresDocumentPackageService {
  constructor(
    private readonly database: DocumentPackageTransactionHost,
    private readonly query: QueryClient,
    private readonly reviews: CompletedReviewSource,
    private readonly now = () => new Date().toISOString()
  ) {}

  async createOrOpen(
    principal: WorkspacePrincipal,
    command: {
      professionalReviewCaseId: string;
      expectedReviewVersion: number;
      expectedCompletedDecisionId: string;
      expectedCompletedDecisionHash: string;
      idempotencyKey: string;
    },
    correlationId?: string
  ) {
    requiredPermission(principal, 'document-package:prepare');
    if (
      !validKey(command.idempotencyKey) ||
      !Number.isSafeInteger(command.expectedReviewVersion) ||
      !validHash(command.expectedCompletedDecisionHash)
    )
      throw new DocumentPackageError(
        'INVALID_PACKAGE_COMMAND',
        'Exact Review evidence is required.',
        400
      );
    const requestFingerprint = sha(command);
    try {
      const prior = await this.findReplay(principal.workspaceId, command.idempotencyKey);
      if (prior) {
        if (prior.fingerprint !== requestFingerprint)
          throw new DocumentPackageError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key has conflicting input.'
          );
        return prior.response;
      }
    } catch (cause) {
      if (cause instanceof DocumentPackageError) throw cause;
      throw this.persistence(cause);
    }
    const review = await this.validateReview(principal, command, correlationId);
    const at = this.now();
    const id = `document-package_${randomUUID()}`;
    const requirements = review.source.preparation.documentReferences.length
      ? review.source.preparation.documentReferences.map((reference, index) => ({
          requirementKey: `REVIEW_DOCUMENT_${index + 1}`,
          displayName: reference,
          blocking: true
        }))
      : [
          {
            requirementKey: 'MARK_REPRESENTATION_FILE',
            displayName: 'Mark representation',
            blocking: true
          }
        ];
    const packageData = { requirements, draft: {} };
    try {
      const result = await this.database.transact(
        async (client) => {
          const replay = await this.replay(
            client,
            principal.workspaceId,
            command.idempotencyKey,
            requestFingerprint
          );
          if (replay) return replay;
          const existing = await client.query(
            'SELECT document_package_id FROM document_packages WHERE workspace_id=$1 AND professional_review_case_id=$2 AND source_completed_decision_sha256=$3 FOR UPDATE',
            [principal.workspaceId, review.reviewCaseId, command.expectedCompletedDecisionHash]
          );
          const packageId = existing.rowCount
            ? String((existing.rows[0] as Row).document_package_id)
            : id;
          if (!existing.rowCount)
            await client.query(
              "INSERT INTO document_packages (document_package_id,workspace_id,formal_matter_id,source_formal_matter_version,source_formal_matter_sha256,professional_review_case_id,source_review_version,source_completed_decision_id,source_completed_decision_sha256,status,version,schema_version,package_data,created_by,updated_by,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT',1,1,$10::jsonb,$11,$11,$12,$12)",
              [
                packageId,
                principal.workspaceId,
                review.formalMatterId,
                review.sourceFormalMatterVersion,
                review.sourceSnapshotSha256,
                review.reviewCaseId,
                review.version,
                command.expectedCompletedDecisionId,
                command.expectedCompletedDecisionHash,
                JSON.stringify(packageData),
                principal.userId,
                at
              ]
            );
          const value = await this.load(client, principal.workspaceId, packageId);
          await this.record(
            client,
            principal,
            command.idempotencyKey,
            requestFingerprint,
            packageId,
            'CREATE_OR_OPEN',
            'PACKAGE_OPENED',
            value,
            correlationId,
            at
          );
          return value;
        },
        { isolation: 'SERIALIZABLE' }
      );
      return result;
    } catch (cause) {
      if (cause instanceof DocumentPackageError) throw cause;
      if (['23505', '40001'].includes(String((cause as { code?: string }).code))) {
        const prior = await this.findReplay(principal.workspaceId, command.idempotencyKey);
        if (prior) {
          if (prior.fingerprint !== requestFingerprint)
            throw new DocumentPackageError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has conflicting input.'
            );
          return prior.response;
        }
      }
      throw this.persistence(cause);
    }
  }

  async get(principal: WorkspacePrincipal, packageId: string) {
    requiredPermission(principal, 'document-package:read');
    try {
      return await this.load(this.query, principal.workspaceId, packageId);
    } catch (cause) {
      if (cause instanceof DocumentPackageError) throw cause;
      throw this.persistence(cause);
    }
  }

  async list(principal: WorkspacePrincipal) {
    requiredPermission(principal, 'document-package:read');
    try {
      const rows = await this.query.query<{ document_package_id: string }>(
        'SELECT document_package_id FROM document_packages WHERE workspace_id=$1 ORDER BY updated_at DESC,document_package_id',
        [principal.workspaceId]
      );
      return Promise.all(
        rows.rows.map((row) =>
          this.load(this.query, principal.workspaceId, row.document_package_id)
        )
      );
    } catch (cause) {
      if (cause instanceof DocumentPackageError) throw cause;
      throw this.persistence(cause);
    }
  }

  async updateDraft(
    principal: WorkspacePrincipal,
    packageId: string,
    command: { expectedVersion: number; draft: Record<string, unknown>; idempotencyKey: string },
    correlationId?: string
  ) {
    requiredPermission(principal, 'document-package:prepare');
    if (!validKey(command.idempotencyKey) || !command.draft || Array.isArray(command.draft))
      throw new DocumentPackageError(
        'INVALID_PACKAGE_COMMAND',
        'A bounded draft object is required.',
        400
      );
    return this.mutate(
      principal,
      packageId,
      command,
      'UPDATE_DRAFT',
      'PACKAGE_DRAFT_UPDATED',
      correlationId,
      async (client, current, at) => {
        const data = current.package_data as {
          requirements: unknown[];
          draft: Record<string, unknown>;
        };
        await this.cas(client, principal, packageId, command.expectedVersion, {
          packageData: { ...data, draft: command.draft },
          at
        });
      }
    );
  }

  async upsertEvidence(
    principal: WorkspacePrincipal,
    packageId: string,
    command: { expectedVersion: number; evidence: DocumentEvidenceInput; idempotencyKey: string },
    correlationId?: string
  ) {
    requiredPermission(principal, 'document-package:prepare');
    const e = command.evidence;
    if (
      !e ||
      !e.requirementKey ||
      !e.documentType ||
      !e.displayName ||
      !validHash(e.checksum) ||
      (e.sizeBytes !== undefined && (!Number.isSafeInteger(e.sizeBytes) || e.sizeBytes < 0))
    )
      throw new DocumentPackageError(
        'INVALID_DOCUMENT_EVIDENCE',
        'Bounded evidence metadata and a SHA-256 checksum are required.',
        400
      );
    return this.mutate(
      principal,
      packageId,
      command,
      'UPSERT_DOCUMENT_EVIDENCE',
      'DOCUMENT_EVIDENCE_UPSERTED',
      correlationId,
      async (client, current, at) => {
        const data = current.package_data as { requirements: { requirementKey: string }[] };
        if (!data.requirements.some((r) => r.requirementKey === e.requirementKey))
          throw new DocumentPackageError(
            'DOCUMENT_REQUIREMENT_NOT_FOUND',
            'Document requirement was not found.',
            404
          );
        const prior = await client.query(
          'SELECT evidence_sha256 FROM document_package_items WHERE workspace_id=$1 AND document_package_id=$2 AND requirement_key=$3 FOR UPDATE',
          [principal.workspaceId, packageId, e.requirementKey]
        );
        if (prior.rowCount && (prior.rows[0] as Row).evidence_sha256 !== e.checksum)
          throw new DocumentPackageError(
            'IMMUTABLE_EVIDENCE_CONFLICT',
            'Recorded evidence fingerprint cannot be overwritten; use a new requirement reference.'
          );
        const itemId = `document-item_${randomUUID()}`;
        await client.query(
          `INSERT INTO document_package_items (document_item_id,document_package_id,workspace_id,requirement_key,document_type,display_name,evidence_type,original_file_name,media_type,size_bytes,evidence_sha256,storage_reference,verification_status,structured_note,item_data,created_by,updated_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,$16,$17,$17)
         ON CONFLICT (document_package_id,requirement_key) DO UPDATE SET display_name=EXCLUDED.display_name,verification_status=EXCLUDED.verification_status,structured_note=EXCLUDED.structured_note,item_data=EXCLUDED.item_data,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at`,
          [
            itemId,
            packageId,
            principal.workspaceId,
            e.requirementKey,
            e.documentType,
            e.displayName,
            e.evidenceType,
            e.originalFileName ?? null,
            e.mediaType ?? null,
            e.sizeBytes ?? null,
            e.checksum,
            e.storageReference ?? null,
            e.verificationStatus,
            JSON.stringify(e.structuredNote ?? {}),
            JSON.stringify(e),
            principal.userId,
            at
          ]
        );
        await this.cas(client, principal, packageId, command.expectedVersion, { at });
      }
    );
  }

  async appendInstruction(
    principal: WorkspacePrincipal,
    packageId: string,
    command: { expectedVersion: number; instruction: InstructionInput; idempotencyKey: string },
    correlationId?: string
  ) {
    return this.writeInstruction(principal, packageId, command, undefined, correlationId);
  }

  async supersedeInstruction(
    principal: WorkspacePrincipal,
    packageId: string,
    entryId: string,
    command: { expectedVersion: number; instruction: InstructionInput; idempotencyKey: string },
    correlationId?: string
  ) {
    return this.writeInstruction(principal, packageId, command, entryId, correlationId);
  }

  private async writeInstruction(
    principal: WorkspacePrincipal,
    packageId: string,
    command: { expectedVersion: number; instruction: InstructionInput; idempotencyKey: string },
    supersedes: string | undefined,
    correlationId?: string
  ) {
    requiredPermission(principal, 'instruction-ledger:write');
    const input = command.instruction;
    if (
      !input?.instructionType ||
      !input.structuredPayload ||
      !Object.keys(input.structuredPayload).length
    )
      throw new DocumentPackageError(
        'INVALID_INSTRUCTION',
        'A typed structured instruction is required.',
        400
      );
    return this.mutate(
      principal,
      packageId,
      command,
      supersedes ? 'SUPERSEDE_INSTRUCTION' : 'APPEND_INSTRUCTION',
      supersedes ? 'INSTRUCTION_SUPERSEDED' : 'INSTRUCTION_APPENDED',
      correlationId,
      async (client, _current, at) => {
        if (supersedes) {
          const old = await client.query(
            'SELECT instruction_entry_id FROM document_instruction_entries WHERE workspace_id=$1 AND document_package_id=$2 AND instruction_entry_id=$3 FOR UPDATE',
            [principal.workspaceId, packageId, supersedes]
          );
          if (!old.rowCount)
            throw new DocumentPackageError(
              'INSTRUCTION_NOT_FOUND',
              'Superseded instruction was not found.',
              404
            );
          const chained = await client.query(
            'SELECT 1 FROM document_instruction_entries WHERE document_package_id=$1 AND supersedes_entry_id=$2',
            [packageId, supersedes]
          );
          if (chained.rowCount)
            throw new DocumentPackageError(
              'INSTRUCTION_ALREADY_SUPERSEDED',
              'Instruction already has a replacement.'
            );
        }
        const next = await client.query(
          'SELECT COALESCE(MAX(sequence),0)+1 AS sequence FROM document_instruction_entries WHERE workspace_id=$1 AND document_package_id=$2',
          [principal.workspaceId, packageId]
        );
        const sequence = Number((next.rows[0] as Row).sequence);
        const fingerprint = sha({
          packageId,
          sequence,
          input,
          supersedes,
          actor: principal.userId
        });
        await client.query(
          'INSERT INTO document_instruction_entries (instruction_entry_id,document_package_id,workspace_id,sequence,instruction_type,target_jurisdiction,target_class,target_document_item_id,structured_payload,source_review_finding_id,actor_id,created_at,supersedes_entry_id,canonical_fingerprint) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14)',
          [
            `instruction-entry_${randomUUID()}`,
            packageId,
            principal.workspaceId,
            sequence,
            input.instructionType,
            input.targetJurisdiction ?? null,
            input.targetClass ?? null,
            input.targetDocumentItemId ?? null,
            JSON.stringify(input.structuredPayload),
            input.sourceReviewFindingId ?? null,
            principal.userId,
            at,
            supersedes ?? null,
            fingerprint
          ]
        );
        await this.cas(client, principal, packageId, command.expectedVersion, { at });
      }
    );
  }

  async markReady(
    principal: WorkspacePrincipal,
    packageId: string,
    command: { expectedVersion: number; idempotencyKey: string },
    correlationId?: string
  ) {
    requiredPermission(principal, 'document-package:mark-ready');
    return this.mutate(
      principal,
      packageId,
      command,
      'MARK_READY',
      'PACKAGE_MARKED_READY',
      correlationId,
      async (client, current, at) => {
        const currentView = await this.load(client, principal.workspaceId, packageId);
        await this.validateReview(
          principal,
          {
            professionalReviewCaseId: currentView.professionalReviewCaseId,
            expectedReviewVersion: currentView.sourceReviewVersion,
            expectedCompletedDecisionId: currentView.sourceCompletedDecisionId,
            expectedCompletedDecisionHash: currentView.sourceCompletedDecisionHash
          },
          correlationId
        );
        const missing = currentView.requirements.filter(
          (r) =>
            r.blocking &&
            !currentView.documentItems.some(
              (i) =>
                i.requirementKey === r.requirementKey &&
                ['RECORDED', 'VERIFIED'].includes(String(i.verificationStatus))
            )
        );
        if (missing.length)
          throw new DocumentPackageError(
            'READINESS_BLOCKED_DOCUMENTS',
            'Required document evidence is missing.',
            422
          );
        if (!currentView.instructionEntries.length)
          throw new DocumentPackageError(
            'READINESS_BLOCKED_INSTRUCTIONS',
            'At least one instruction is required.',
            422
          );
        const readyHash = sha({
          source: {
            matter: currentView.sourceFormalMatterHash,
            review: currentView.sourceCompletedDecisionHash
          },
          documents: currentView.documentItems,
          instructions: currentView.instructionEntries
        });
        const result = await client.query(
          `UPDATE document_packages SET status='READY_FOR_PREPARATION_LOCK',version=version+1,canonical_evidence_sha256=$1,ready_at=$2,ready_by=$3,updated_at=$2,updated_by=$3
         WHERE workspace_id=$4 AND document_package_id=$5 AND version=$6 AND status='DRAFT'`,
          [
            readyHash,
            at,
            principal.userId,
            principal.workspaceId,
            packageId,
            command.expectedVersion
          ]
        );
        if (!result.rowCount) this.conflict(current, command.expectedVersion);
      }
    );
  }

  private async mutate(
    principal: WorkspacePrincipal,
    packageId: string,
    command: { expectedVersion: number; idempotencyKey: string },
    type: DocumentPackageCommandType,
    action: DocumentPackageAuditAction,
    correlationId: string | undefined,
    change: (client: QueryClient, row: Row, at: string) => Promise<void>
  ) {
    if (!validKey(command.idempotencyKey) || !Number.isSafeInteger(command.expectedVersion))
      throw new DocumentPackageError(
        'INVALID_PACKAGE_COMMAND',
        'Idempotency key and exact expected version are required.',
        400
      );
    const fingerprint = sha({ packageId, type, command });
    const at = this.now();
    try {
      return await this.database.transact(
        async (client) => {
          const replay = await this.replay(
            client,
            principal.workspaceId,
            command.idempotencyKey,
            fingerprint
          );
          if (replay) return replay;
          const selected = await client.query(
            'SELECT * FROM document_packages WHERE workspace_id=$1 AND document_package_id=$2 FOR UPDATE',
            [principal.workspaceId, packageId]
          );
          if (!selected.rowCount)
            throw new DocumentPackageError(
              'DOCUMENT_PACKAGE_NOT_FOUND',
              'Document Package was not found.',
              404
            );
          const current = selected.rows[0] as Row;
          if (current.status !== 'DRAFT')
            throw new DocumentPackageError(
              'PACKAGE_IMMUTABLE',
              'Ready Document Package is immutable.'
            );
          if (Number(current.version) !== command.expectedVersion)
            this.conflict(current, command.expectedVersion);
          await change(client, current, at);
          const value = await this.load(client, principal.workspaceId, packageId);
          await this.record(
            client,
            principal,
            command.idempotencyKey,
            fingerprint,
            packageId,
            type,
            action,
            value,
            correlationId,
            at
          );
          return value;
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof DocumentPackageError) throw cause;
      throw this.persistence(cause);
    }
  }

  private async cas(
    client: QueryClient,
    principal: WorkspacePrincipal,
    id: string,
    version: number,
    value: { packageData?: unknown; at: string }
  ) {
    const result = value.packageData
      ? await client.query(
          "UPDATE document_packages SET package_data=$1::jsonb,version=version+1,updated_by=$2,updated_at=$3 WHERE workspace_id=$4 AND document_package_id=$5 AND version=$6 AND status='DRAFT'",
          [
            JSON.stringify(value.packageData),
            principal.userId,
            value.at,
            principal.workspaceId,
            id,
            version
          ]
        )
      : await client.query(
          "UPDATE document_packages SET version=version+1,updated_by=$1,updated_at=$2 WHERE workspace_id=$3 AND document_package_id=$4 AND version=$5 AND status='DRAFT'",
          [principal.userId, value.at, principal.workspaceId, id, version]
        );
    if (!result.rowCount)
      throw new DocumentPackageError(
        'STALE_PACKAGE_VERSION',
        'Package changed; reload the exact latest version.',
        409
      );
  }
  private conflict(row: Row, expected: number): never {
    throw new DocumentPackageError(
      'STALE_PACKAGE_VERSION',
      `Expected Package version ${expected}; current version is ${String(row.version)}.`,
      409
    );
  }

  private async replay(client: QueryClient, workspaceId: string, key: string, fingerprint: string) {
    const found = await client.query(
      'SELECT request_fingerprint,response_data FROM document_package_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
      [workspaceId, key]
    );
    if (!found.rowCount) return null;
    const row = found.rows[0] as Row;
    if (row.request_fingerprint !== fingerprint)
      throw new DocumentPackageError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has conflicting input.'
      );
    return structuredClone(row.response_data as DocumentPackageView);
  }
  private async findReplay(workspaceId: string, key: string) {
    const found = await this.query.query(
      'SELECT request_fingerprint,document_package_id,response_data FROM document_package_commands WHERE workspace_id=$1 AND idempotency_key=$2',
      [workspaceId, key]
    );
    if (!found.rowCount) return null;
    return {
      fingerprint: String((found.rows[0] as Row).request_fingerprint),
      packageId: String((found.rows[0] as Row).document_package_id),
      response: structuredClone((found.rows[0] as Row).response_data as DocumentPackageView)
    };
  }
  private async record(
    client: QueryClient,
    principal: WorkspacePrincipal,
    key: string,
    fingerprint: string,
    packageId: string,
    type: DocumentPackageCommandType,
    action: DocumentPackageAuditAction,
    value: DocumentPackageView,
    correlationId: string | undefined,
    at: string
  ) {
    await client.query(
      'INSERT INTO document_package_commands (workspace_id,idempotency_key,request_fingerprint,document_package_id,command_type,response_version,response_data,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',
      [
        principal.workspaceId,
        key,
        fingerprint,
        packageId,
        type,
        value.version,
        JSON.stringify(value),
        at
      ]
    );
    await client.query(
      'INSERT INTO document_package_audit (workspace_id,document_package_id,action,package_version,actor_id,correlation_id,evidence_fingerprint,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        principal.workspaceId,
        packageId,
        action,
        value.version,
        principal.userId,
        correlationId ?? null,
        sha(value),
        at
      ]
    );
  }

  private async load(
    client: QueryClient,
    workspaceId: string,
    id: string
  ): Promise<DocumentPackageView> {
    const result = await client.query(
      'SELECT * FROM document_packages WHERE workspace_id=$1 AND document_package_id=$2',
      [workspaceId, id]
    );
    if (!result.rowCount)
      throw new DocumentPackageError(
        'DOCUMENT_PACKAGE_NOT_FOUND',
        'Document Package was not found.',
        404
      );
    const row = result.rows[0] as Row;
    const documents = await client.query(
      'SELECT item_data,document_item_id,requirement_key,verification_status,created_at,updated_at FROM document_package_items WHERE workspace_id=$1 AND document_package_id=$2 ORDER BY created_at,document_item_id',
      [workspaceId, id]
    );
    const instructions = await client.query(
      'SELECT * FROM document_instruction_entries WHERE workspace_id=$1 AND document_package_id=$2 ORDER BY sequence',
      [workspaceId, id]
    );
    const data = row.package_data as {
      requirements: DocumentPackageView['requirements'];
      draft: Record<string, unknown>;
    };
    return {
      documentPackageId: String(row.document_package_id) as `document-package_${string}`,
      workspaceId: String(row.workspace_id),
      formalMatterId: String(row.formal_matter_id) as `formal-matter_${string}`,
      sourceFormalMatterVersion: Number(row.source_formal_matter_version),
      sourceFormalMatterHash: String(row.source_formal_matter_sha256),
      professionalReviewCaseId: String(
        row.professional_review_case_id
      ) as `professional-review_${string}`,
      sourceReviewVersion: Number(row.source_review_version),
      sourceCompletedDecisionId: String(row.source_completed_decision_id),
      sourceCompletedDecisionHash: String(row.source_completed_decision_sha256),
      status: row.status as DocumentPackageView['status'],
      version: Number(row.version),
      schemaVersion: 1,
      requirements: data.requirements,
      draft: data.draft,
      documentItems: documents.rows.map((raw: unknown) => {
        const v = raw as Row;
        return {
          ...(v['item_data'] as Record<string, unknown>),
          documentItemId: v['document_item_id'],
          requirementKey: v['requirement_key'],
          verificationStatus: v['verification_status'],
          createdAt: timestamp(v['created_at']),
          updatedAt: timestamp(v['updated_at'])
        };
      }),
      instructionEntries: instructions.rows.map((raw: unknown) => {
        const v = raw as Row;
        return {
          instructionEntryId: v['instruction_entry_id'],
          sequence: Number(v['sequence']),
          instructionType: v['instruction_type'],
          structuredPayload: v['structured_payload'],
          ...(v['target_jurisdiction'] ? { targetJurisdiction: v['target_jurisdiction'] } : {}),
          ...(v['target_class'] ? { targetClass: v['target_class'] } : {}),
          ...(v['target_document_item_id']
            ? { targetDocumentItemId: v['target_document_item_id'] }
            : {}),
          ...(v['source_review_finding_id']
            ? { sourceReviewFindingId: v['source_review_finding_id'] }
            : {}),
          actor: v['actor_id'],
          createdAt: timestamp(v['created_at']),
          ...(v['supersedes_entry_id'] ? { supersedesEntryId: v['supersedes_entry_id'] } : {}),
          canonicalFingerprint: v['canonical_fingerprint']
        };
      }),
      createdBy: String(row.created_by),
      updatedBy: String(row.updated_by),
      createdAt: timestamp(row.created_at),
      updatedAt: timestamp(row.updated_at),
      ...(row.ready_at
        ? {
            readyAt: timestamp(row.ready_at),
            readyBy: String(row.ready_by),
            canonicalEvidenceHash: String(row.canonical_evidence_sha256)
          }
        : {})
    };
  }

  private async validateReview(
    principal: WorkspacePrincipal,
    expected: {
      professionalReviewCaseId: string;
      expectedReviewVersion: number;
      expectedCompletedDecisionId: string;
      expectedCompletedDecisionHash: string;
    },
    correlationId?: string
  ) {
    let review: ProfessionalReviewCase;
    try {
      review = await this.reviews.get(principal, expected.professionalReviewCaseId, correlationId);
    } catch (cause) {
      if (cause instanceof DocumentPackageError) throw cause;
      throw new DocumentPackageError(
        'REVIEW_SOURCE_UNAVAILABLE',
        'Professional Review validation is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const decisionId = review.decision?.decidedAt;
    const decisionHash = review.decision ? sha(review.decision) : '';
    if (!review.completedAt || review.status !== 'REVIEWED_READY_FOR_NEXT_STEP' || !review.decision)
      throw new DocumentPackageError(
        'SOURCE_REVIEW_INCOMPLETE',
        'Professional Review must be completed.',
        409
      );
    if (
      !review.workspaceId ||
      review.workspaceId !== principal.workspaceId ||
      !review.formalMatterId ||
      !review.sourceFormalMatterVersion ||
      !review.sourceSnapshotSha256 ||
      review.version !== expected.expectedReviewVersion ||
      decisionId !== expected.expectedCompletedDecisionId ||
      decisionHash !== expected.expectedCompletedDecisionHash
    )
      throw new DocumentPackageError(
        'SOURCE_REVIEW_MISMATCH',
        'Exact completed Review and Formal Matter lineage do not match.',
        409
      );
    return review;
  }
  private persistence(cause: unknown) {
    return new DocumentPackageError(
      'PERSISTENCE_UNAVAILABLE',
      'Document Package persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}

export const completedDecisionFingerprint = (review: ProfessionalReviewCase) =>
  review.decision ? sha(review.decision) : undefined;
