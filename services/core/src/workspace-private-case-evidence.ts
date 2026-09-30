import { createHash } from 'node:crypto';
import {
  encodeInternalWorkspacePrincipal,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  WorkspacePrivateCaseEvidenceReadGrantV1,
  WorkspacePrivateDocumentBindingV1
} from '@markorbit/contracts/workspace-private-evidence';
import type { QueryClient } from '@markorbit/persistence';
import {
  CurrentWorkspaceAuthorityError,
  type CurrentWorkspaceAuthorityResult,
  type CurrentWorkspaceAuthorityService
} from './current-workspace-authority.js';
import type { KnowledgeReadyPackageContentRepository } from './knowledge-content.js';
import type { KnowledgeIntakeRepository } from './knowledge-intake.js';
import { uuidV7 } from './auth.js';

export type WorkspacePrivateCaseEvidenceBindingStatus = 'SUGGESTED' | 'ACCEPTED' | 'REJECTED';
export type WorkspacePrivateCaseEvidenceDecision = 'ACCEPT' | 'REJECT';

export type WorkspacePrivateCaseEvidenceAuthoritySnapshot = Readonly<{
  workspaceVersion: number;
  userVersion: number;
  membershipVersion: number;
}>;

export type WorkspacePrivateCaseEvidenceBindingRecord = Readonly<{
  bindingId: string;
  version: number;
  workspaceId: string;
  knowledgeWorkspaceId: string;
  readyPackageId: string;
  readyPackageDigest: string;
  coreIntakeId: string;
  contentExportSha256: string;
  stagingDocumentId: string;
  stagingSha256: string;
  rawArtifactId: string;
  rawArtifactSha256: string;
  formalMatterId: string;
  formalMatterVersion: number;
  formalMatterSnapshotSha256: string;
  sourceLocators: readonly string[];
  methodProvenanceRefs: readonly string[];
  status: WorkspacePrivateCaseEvidenceBindingStatus;
  suggestionIdempotencyKey: string;
  suggestionFingerprintSha256: string;
  suggestedByUserId: string;
  suggestedByMembershipId: string;
  suggestedAuthority: WorkspacePrivateCaseEvidenceAuthoritySnapshot;
  suggestedAt: string;
  decisionIdempotencyKey?: string;
  decisionFingerprintSha256?: string;
  decidedByUserId?: string;
  decidedByMembershipId?: string;
  decidedAuthority?: WorkspacePrivateCaseEvidenceAuthoritySnapshot;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}>;

export interface WorkspacePrivateCaseEvidenceBindingRepository {
  createOrFind(
    candidate: WorkspacePrivateCaseEvidenceBindingRecord
  ): Promise<{ binding: WorkspacePrivateCaseEvidenceBindingRecord; created: boolean }>;
  findById(bindingId: string): Promise<WorkspacePrivateCaseEvidenceBindingRecord | undefined>;
  transitionDecision(
    input: Readonly<{
      bindingId: string;
      expectedVersion: number;
      status: Exclude<WorkspacePrivateCaseEvidenceBindingStatus, 'SUGGESTED'>;
      decisionIdempotencyKey: string;
      decisionFingerprintSha256: string;
      decidedByUserId: string;
      decidedByMembershipId: string;
      decidedAuthority: WorkspacePrivateCaseEvidenceAuthoritySnapshot;
      decidedAt: string;
    }>
  ): Promise<{ binding?: WorkspacePrivateCaseEvidenceBindingRecord; applied: boolean }>;
}

export type FormalMatterCurrentSnapshot = Readonly<{
  workspaceId: string;
  formalMatterId: string;
  version: number;
  snapshotSha256: string;
  status: string;
}>;

export interface FormalMatterCurrentnessSource {
  read(principal: WorkspacePrincipal, formalMatterId: string): Promise<FormalMatterCurrentSnapshot>;
}

export type WorkspacePrivateCaseEvidenceErrorCode =
  | 'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST'
  | 'WORKSPACE_PRIVATE_CASE_EVIDENCE_NOT_FOUND'
  | 'WORKSPACE_PRIVATE_CASE_EVIDENCE_REPLAY_CONFLICT'
  | 'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE'
  | 'WORKSPACE_PRIVATE_CASE_EVIDENCE_PERMISSION_DENIED'
  | 'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE';

export class WorkspacePrivateCaseEvidenceError extends Error {
  constructor(
    readonly code: WorkspacePrivateCaseEvidenceErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspacePrivateCaseEvidenceError';
  }
}

export type SuggestWorkspacePrivateCaseEvidenceRequest = Readonly<{
  idempotencyKey: string;
  formalMatterId: string;
  expectedFormalMatterVersion: number;
  expectedFormalMatterSnapshotSha256: string;
  readyPackageId: string;
  expectedKnowledgeWorkspaceId: string;
  expectedReadyPackageDigest: string;
  expectedCoreIntakeId: string;
  expectedContentExportSha256: string;
  expectedStagingDocumentId: string;
  expectedStagingSha256: string;
  expectedRawArtifactId: string;
  expectedRawArtifactSha256: string;
  sourceLocators: readonly string[];
  methodProvenanceRefs: readonly string[];
}>;

export type DecideWorkspacePrivateCaseEvidenceRequest = Readonly<{
  bindingId: string;
  expectedVersion: number;
  idempotencyKey: string;
  decision: WorkspacePrivateCaseEvidenceDecision;
}>;

export type ReadWorkspacePrivateCaseEvidenceRequest = Readonly<{
  bindingId: string;
  expectedVersion: number;
}>;

const sha256Pattern = /^[0-9a-f]{64}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const nonEmpty = (value: string) => value.trim().length > 0;
const validVersion = (value: number) => Number.isSafeInteger(value) && value >= 1;
const validDigest = (value: string) => sha256Pattern.test(value);
const validKey = (value: string) => value.length >= 8 && value.length <= 256;
const validRefArray = (items: readonly string[], required = false) =>
  (!required || items.length > 0) &&
  items.length <= 100 &&
  items.every((item) => nonEmpty(item) && item.length <= 512) &&
  new Set(items).size === items.length;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
const digestOf = (value: unknown) =>
  createHash('sha256').update(stable(value), 'utf8').digest('hex');
const READ_GRANT_TTL_MS = 60_000;

function authoritySnapshot(
  authority: Readonly<CurrentWorkspaceAuthorityResult>
): WorkspacePrivateCaseEvidenceAuthoritySnapshot {
  return {
    workspaceVersion: authority.workspace.version,
    userVersion: authority.user.version,
    membershipVersion: authority.membership.version
  };
}

function mapAuthorityFailure(cause: unknown): WorkspacePrivateCaseEvidenceError {
  if (
    cause instanceof CurrentWorkspaceAuthorityError &&
    cause.code === 'CURRENT_AUTHORITY_SOURCE_UNAVAILABLE'
  )
    return new WorkspacePrivateCaseEvidenceError(
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
      'Current Workspace authority is unavailable.',
      503,
      true,
      { cause }
    );
  if (
    cause instanceof CurrentWorkspaceAuthorityError &&
    cause.code === 'CURRENT_AUTHORITY_PERMISSION_DENIED'
  )
    return new WorkspacePrivateCaseEvidenceError(
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_PERMISSION_DENIED',
      'Current Workspace permission does not allow this evidence operation.',
      403,
      false,
      { cause }
    );
  return new WorkspacePrivateCaseEvidenceError(
    'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
    'Workspace authority is no longer current.',
    cause instanceof CurrentWorkspaceAuthorityError ? cause.status : 409,
    false,
    { cause: cause instanceof Error ? cause : undefined }
  );
}

function assertPrincipal(principal: WorkspacePrincipal, permission: Permission, now: Date): void {
  if (
    principal.kind !== 'WORKSPACE' ||
    !uuidPattern.test(principal.workspaceId) ||
    !uuidPattern.test(principal.userId) ||
    !uuidPattern.test(principal.membershipId) ||
    !principal.permissions.includes(permission) ||
    !Number.isFinite(Date.parse(principal.sessionExpiresAt))
  )
    throw new WorkspacePrivateCaseEvidenceError(
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_PERMISSION_DENIED',
      'A trusted Workspace Principal with the required permission is required.',
      403
    );
  if (Date.parse(principal.sessionExpiresAt) <= now.getTime())
    throw new WorkspacePrivateCaseEvidenceError(
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_PERMISSION_DENIED',
      'Workspace Principal session is expired.',
      401
    );
}

function validateSuggestRequest(request: SuggestWorkspacePrivateCaseEvidenceRequest): void {
  if (
    !validKey(request.idempotencyKey) ||
    !nonEmpty(request.formalMatterId) ||
    !validVersion(request.expectedFormalMatterVersion) ||
    !validDigest(request.expectedFormalMatterSnapshotSha256) ||
    !nonEmpty(request.readyPackageId) ||
    !nonEmpty(request.expectedKnowledgeWorkspaceId) ||
    !validDigest(request.expectedReadyPackageDigest) ||
    !nonEmpty(request.expectedCoreIntakeId) ||
    !validDigest(request.expectedContentExportSha256) ||
    !nonEmpty(request.expectedStagingDocumentId) ||
    !validDigest(request.expectedStagingSha256) ||
    !nonEmpty(request.expectedRawArtifactId) ||
    !validDigest(request.expectedRawArtifactSha256) ||
    !validRefArray(request.sourceLocators, true) ||
    !validRefArray(request.methodProvenanceRefs)
  )
    throw new WorkspacePrivateCaseEvidenceError(
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      'Exact Case, Knowledge evidence and provenance references are required.',
      400
    );
}

function validateDecisionRequest(request: DecideWorkspacePrivateCaseEvidenceRequest): void {
  if (
    !uuidPattern.test(request.bindingId) ||
    !validVersion(request.expectedVersion) ||
    !validKey(request.idempotencyKey) ||
    (request.decision !== 'ACCEPT' && request.decision !== 'REJECT')
  )
    throw new WorkspacePrivateCaseEvidenceError(
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      'Exact binding version, idempotency key and decision are required.',
      400
    );
}

function validateReadRequest(request: ReadWorkspacePrivateCaseEvidenceRequest): void {
  if (!uuidPattern.test(request.bindingId) || !validVersion(request.expectedVersion))
    throw new WorkspacePrivateCaseEvidenceError(
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      'Exact bindingId and version are required.',
      400
    );
}

export class MemoryWorkspacePrivateCaseEvidenceBindingRepository implements WorkspacePrivateCaseEvidenceBindingRepository {
  private readonly rows = new Map<string, WorkspacePrivateCaseEvidenceBindingRecord>();
  private readonly suggestionKeys = new Map<string, string>();

  async createOrFind(candidate: WorkspacePrivateCaseEvidenceBindingRecord) {
    await Promise.resolve();
    const index = `${candidate.workspaceId}\u001f${candidate.suggestionIdempotencyKey}`;
    const existingId = this.suggestionKeys.get(index);
    if (existingId) return { binding: structuredClone(this.rows.get(existingId)!), created: false };
    this.rows.set(candidate.bindingId, structuredClone(candidate));
    this.suggestionKeys.set(index, candidate.bindingId);
    return { binding: structuredClone(candidate), created: true };
  }

  async findById(bindingId: string) {
    await Promise.resolve();
    const value = this.rows.get(bindingId);
    return value ? structuredClone(value) : undefined;
  }

  async transitionDecision(
    input: Parameters<WorkspacePrivateCaseEvidenceBindingRepository['transitionDecision']>[0]
  ) {
    await Promise.resolve();
    const current = this.rows.get(input.bindingId);
    if (!current || current.status !== 'SUGGESTED' || current.version !== input.expectedVersion)
      return current ? { binding: structuredClone(current), applied: false } : { applied: false };
    const decided: WorkspacePrivateCaseEvidenceBindingRecord = {
      ...current,
      version: current.version + 1,
      status: input.status,
      decisionIdempotencyKey: input.decisionIdempotencyKey,
      decisionFingerprintSha256: input.decisionFingerprintSha256,
      decidedByUserId: input.decidedByUserId,
      decidedByMembershipId: input.decidedByMembershipId,
      decidedAuthority: structuredClone(input.decidedAuthority),
      decidedAt: input.decidedAt,
      updatedAt: input.decidedAt
    };
    this.rows.set(input.bindingId, structuredClone(decided));
    return { binding: structuredClone(decided), applied: true };
  }
}

type BindingRow = Record<string, unknown>;

function dateString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapBindingRow(row: BindingRow): WorkspacePrivateCaseEvidenceBindingRecord {
  const optional = <T>(key: string): T | undefined =>
    row[key] === null || row[key] === undefined ? undefined : (row[key] as T);
  return {
    bindingId: String(row.binding_id),
    version: Number(row.version),
    workspaceId: String(row.workspace_id),
    knowledgeWorkspaceId: String(row.knowledge_workspace_id),
    readyPackageId: String(row.ready_package_id),
    readyPackageDigest: String(row.ready_package_digest),
    coreIntakeId: String(row.core_intake_id),
    contentExportSha256: String(row.content_export_sha256),
    stagingDocumentId: String(row.staging_document_id),
    stagingSha256: String(row.staging_sha256),
    rawArtifactId: String(row.raw_artifact_id),
    rawArtifactSha256: String(row.raw_artifact_sha256),
    formalMatterId: String(row.formal_matter_id),
    formalMatterVersion: Number(row.formal_matter_version),
    formalMatterSnapshotSha256: String(row.formal_matter_snapshot_sha256),
    sourceLocators: structuredClone(row.source_locators_json as string[]),
    methodProvenanceRefs: structuredClone(row.method_provenance_refs_json as string[]),
    status: row.status as WorkspacePrivateCaseEvidenceBindingStatus,
    suggestionIdempotencyKey: String(row.suggestion_idempotency_key),
    suggestionFingerprintSha256: String(row.suggestion_fingerprint_sha256),
    suggestedByUserId: String(row.suggested_by_user_id),
    suggestedByMembershipId: String(row.suggested_by_membership_id),
    suggestedAuthority: structuredClone(
      row.suggested_authority_json as WorkspacePrivateCaseEvidenceAuthoritySnapshot
    ),
    suggestedAt: dateString(row.suggested_at),
    ...(optional<string>('decision_idempotency_key') !== undefined
      ? { decisionIdempotencyKey: String(row.decision_idempotency_key) }
      : {}),
    ...(optional<string>('decision_fingerprint_sha256') !== undefined
      ? { decisionFingerprintSha256: String(row.decision_fingerprint_sha256) }
      : {}),
    ...(optional<string>('decided_by_user_id') !== undefined
      ? { decidedByUserId: String(row.decided_by_user_id) }
      : {}),
    ...(optional<string>('decided_by_membership_id') !== undefined
      ? { decidedByMembershipId: String(row.decided_by_membership_id) }
      : {}),
    ...(optional<WorkspacePrivateCaseEvidenceAuthoritySnapshot>('decided_authority_json') !==
    undefined
      ? {
          decidedAuthority: structuredClone(
            row.decided_authority_json as WorkspacePrivateCaseEvidenceAuthoritySnapshot
          )
        }
      : {}),
    ...(optional<unknown>('decided_at') !== undefined
      ? { decidedAt: dateString(row.decided_at) }
      : {}),
    createdAt: dateString(row.created_at),
    updatedAt: dateString(row.updated_at)
  };
}

export class PostgresWorkspacePrivateCaseEvidenceBindingRepository implements WorkspacePrivateCaseEvidenceBindingRepository {
  constructor(private readonly query: QueryClient) {}

  async createOrFind(candidate: WorkspacePrivateCaseEvidenceBindingRecord) {
    const result = await this.query.query(
      `INSERT INTO core_workspace_private_case_evidence_bindings(
        binding_id,version,workspace_id,knowledge_workspace_id,ready_package_id,
        ready_package_digest,core_intake_id,content_export_sha256,staging_document_id,
        staging_sha256,raw_artifact_id,raw_artifact_sha256,formal_matter_id,
        formal_matter_version,formal_matter_snapshot_sha256,source_locators_json,
        method_provenance_refs_json,status,suggestion_idempotency_key,
        suggestion_fingerprint_sha256,suggested_by_user_id,suggested_by_membership_id,
        suggested_authority_json,suggested_at,created_at,updated_at
      ) VALUES(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,
        $18,$19,$20,$21,$22,$23::jsonb,$24,$25,$26
      )
      ON CONFLICT (workspace_id,suggestion_idempotency_key) DO UPDATE
        SET suggestion_idempotency_key =
          core_workspace_private_case_evidence_bindings.suggestion_idempotency_key
      RETURNING *, (xmax = 0) AS created`,
      [
        candidate.bindingId,
        candidate.version,
        candidate.workspaceId,
        candidate.knowledgeWorkspaceId,
        candidate.readyPackageId,
        candidate.readyPackageDigest,
        candidate.coreIntakeId,
        candidate.contentExportSha256,
        candidate.stagingDocumentId,
        candidate.stagingSha256,
        candidate.rawArtifactId,
        candidate.rawArtifactSha256,
        candidate.formalMatterId,
        candidate.formalMatterVersion,
        candidate.formalMatterSnapshotSha256,
        JSON.stringify(candidate.sourceLocators),
        JSON.stringify(candidate.methodProvenanceRefs),
        candidate.status,
        candidate.suggestionIdempotencyKey,
        candidate.suggestionFingerprintSha256,
        candidate.suggestedByUserId,
        candidate.suggestedByMembershipId,
        JSON.stringify(candidate.suggestedAuthority),
        candidate.suggestedAt,
        candidate.createdAt,
        candidate.updatedAt
      ]
    );
    const row = result.rows[0] as BindingRow & { created: boolean };
    return { binding: mapBindingRow(row), created: row.created };
  }

  async findById(bindingId: string) {
    const result = await this.query.query(
      'SELECT * FROM core_workspace_private_case_evidence_bindings WHERE binding_id=$1',
      [bindingId]
    );
    return result.rows[0] ? mapBindingRow(result.rows[0] as BindingRow) : undefined;
  }

  async transitionDecision(
    input: Parameters<WorkspacePrivateCaseEvidenceBindingRepository['transitionDecision']>[0]
  ) {
    const result = await this.query.query(
      `UPDATE core_workspace_private_case_evidence_bindings
          SET version=version+1,status=$3,decision_idempotency_key=$4,
              decision_fingerprint_sha256=$5,decided_by_user_id=$6,
              decided_by_membership_id=$7,decided_authority_json=$8::jsonb,
              decided_at=$9,updated_at=$9
        WHERE binding_id=$1 AND version=$2 AND status='SUGGESTED'
      RETURNING *`,
      [
        input.bindingId,
        input.expectedVersion,
        input.status,
        input.decisionIdempotencyKey,
        input.decisionFingerprintSha256,
        input.decidedByUserId,
        input.decidedByMembershipId,
        JSON.stringify(input.decidedAuthority),
        input.decidedAt
      ]
    );
    if (result.rows[0])
      return { binding: mapBindingRow(result.rows[0] as BindingRow), applied: true };
    const current = await this.findById(input.bindingId);
    return current ? { binding: current, applied: false } : { applied: false };
  }
}

type ExactSource = Readonly<{
  coreIntakeId: string;
  knowledgeWorkspaceId: string;
  readyPackageId: string;
  readyPackageDigest: string;
  contentExportSha256: string;
  stagingDocumentId: string;
  stagingSha256: string;
  rawArtifactId: string;
  rawArtifactSha256: string;
}>;

export class WorkspacePrivateCaseEvidenceService {
  constructor(
    private readonly options: Readonly<{
      repository: WorkspacePrivateCaseEvidenceBindingRepository;
      currentWorkspaceAuthority: Pick<CurrentWorkspaceAuthorityService, 'validate'>;
      knowledgeIntakes: Pick<KnowledgeIntakeRepository, 'findAcceptedByReadyPackage'>;
      knowledgeContents: Pick<KnowledgeReadyPackageContentRepository, 'findByReadyPackage'>;
      formalMatters: FormalMatterCurrentnessSource;
      clock?: () => Date;
      newId?: () => string;
    }>
  ) {}

  private now() {
    return (this.options.clock ?? (() => new Date()))();
  }

  private async authority(
    principal: WorkspacePrincipal,
    permission: Permission,
    expected?: WorkspacePrivateCaseEvidenceAuthoritySnapshot
  ) {
    const now = this.now();
    assertPrincipal(principal, permission, now);
    try {
      return await this.options.currentWorkspaceAuthority.validate({
        workspaceId: principal.workspaceId,
        userId: principal.userId,
        membershipId: principal.membershipId,
        ...(expected
          ? {
              expectedWorkspaceVersion: expected.workspaceVersion,
              expectedUserVersion: expected.userVersion,
              expectedMembershipVersion: expected.membershipVersion
            }
          : {}),
        requiredPermission: permission
      });
    } catch (cause) {
      throw mapAuthorityFailure(cause);
    }
  }

  private async exactMatter(
    principal: WorkspacePrincipal,
    formalMatterId: string,
    expectedVersion: number,
    expectedSnapshotSha256: string
  ) {
    let matter: FormalMatterCurrentSnapshot;
    try {
      matter = await this.options.formalMatters.read(principal, formalMatterId);
    } catch (cause) {
      if (cause instanceof WorkspacePrivateCaseEvidenceError) throw cause;
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
        'Current Formal Matter source is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (
      matter.workspaceId !== principal.workspaceId ||
      matter.formalMatterId !== formalMatterId ||
      matter.version !== expectedVersion ||
      matter.snapshotSha256 !== expectedSnapshotSha256 ||
      matter.status !== 'OPEN'
    )
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
        'Formal Matter version or snapshot is no longer current.',
        409
      );
    return matter;
  }

  private async exactSource(
    workspaceId: string,
    readyPackageId: string,
    expected?: Partial<ExactSource>
  ): Promise<ExactSource> {
    let intake;
    let content;
    try {
      [intake, content] = await Promise.all([
        this.options.knowledgeIntakes.findAcceptedByReadyPackage(workspaceId, readyPackageId),
        this.options.knowledgeContents.findByReadyPackage(workspaceId, readyPackageId)
      ]);
    } catch (cause) {
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
        'Core Knowledge evidence source is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!intake || !content || content.intakeId !== intake.intakeId)
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
        'Accepted Core Knowledge evidence could not be established.',
        409
      );
    const source: ExactSource = {
      coreIntakeId: intake.intakeId,
      knowledgeWorkspaceId: content.export.knowledgeWorkspaceId,
      readyPackageId: content.readyPackageId,
      readyPackageDigest: content.export.readyPackageDigest,
      contentExportSha256: content.exportSha256,
      stagingDocumentId: content.export.stagingDocument.documentId,
      stagingSha256: content.export.stagingDocument.sha256,
      rawArtifactId: content.export.rawArtifact.artifactId,
      rawArtifactSha256: content.export.rawArtifact.sha256
    };
    for (const [key, value] of Object.entries(expected ?? {})) {
      if (value !== undefined && source[key as keyof ExactSource] !== value)
        throw new WorkspacePrivateCaseEvidenceError(
          'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
          `Core Knowledge evidence ${key} no longer matches the reviewed source.`,
          409
        );
    }
    return source;
  }
  async suggest(
    principal: WorkspacePrincipal,
    request: SuggestWorkspacePrivateCaseEvidenceRequest
  ): Promise<Readonly<WorkspacePrivateCaseEvidenceBindingRecord>> {
    validateSuggestRequest(request);
    const authority = await this.authority(principal, 'matter:manage');
    await this.exactMatter(
      principal,
      request.formalMatterId,
      request.expectedFormalMatterVersion,
      request.expectedFormalMatterSnapshotSha256
    );
    const source = await this.exactSource(principal.workspaceId, request.readyPackageId, {
      coreIntakeId: request.expectedCoreIntakeId,
      knowledgeWorkspaceId: request.expectedKnowledgeWorkspaceId,
      readyPackageId: request.readyPackageId,
      readyPackageDigest: request.expectedReadyPackageDigest,
      contentExportSha256: request.expectedContentExportSha256,
      stagingDocumentId: request.expectedStagingDocumentId,
      stagingSha256: request.expectedStagingSha256,
      rawArtifactId: request.expectedRawArtifactId,
      rawArtifactSha256: request.expectedRawArtifactSha256
    });
    const fingerprint = digestOf({
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      membershipId: principal.membershipId,
      ...request
    });
    const now = this.now().toISOString();
    const candidate: WorkspacePrivateCaseEvidenceBindingRecord = {
      bindingId: (this.options.newId ?? uuidV7)(),
      version: 1,
      workspaceId: principal.workspaceId,
      ...source,
      formalMatterId: request.formalMatterId,
      formalMatterVersion: request.expectedFormalMatterVersion,
      formalMatterSnapshotSha256: request.expectedFormalMatterSnapshotSha256,
      sourceLocators: [...request.sourceLocators],
      methodProvenanceRefs: [...request.methodProvenanceRefs],
      status: 'SUGGESTED',
      suggestionIdempotencyKey: request.idempotencyKey,
      suggestionFingerprintSha256: fingerprint,
      suggestedByUserId: principal.userId,
      suggestedByMembershipId: principal.membershipId,
      suggestedAuthority: authoritySnapshot(authority),
      suggestedAt: now,
      createdAt: now,
      updatedAt: now
    };
    let resolved;
    try {
      resolved = await this.options.repository.createOrFind(candidate);
    } catch (cause) {
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
        'Workspace private Case evidence persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (resolved.binding.suggestionFingerprintSha256 !== fingerprint)
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_REPLAY_CONFLICT',
        'Suggestion idempotency key is already bound to different reviewed evidence.',
        409
      );
    return resolved.binding;
  }

  async decide(
    principal: WorkspacePrincipal,
    request: DecideWorkspacePrivateCaseEvidenceRequest
  ): Promise<Readonly<WorkspacePrivateCaseEvidenceBindingRecord>> {
    validateDecisionRequest(request);
    const authority = await this.authority(principal, 'matter:manage');
    let binding: WorkspacePrivateCaseEvidenceBindingRecord | undefined;
    try {
      binding = await this.options.repository.findById(request.bindingId);
    } catch (cause) {
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
        'Workspace private Case evidence persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!binding || binding.workspaceId !== principal.workspaceId)
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_NOT_FOUND',
        'Workspace private Case evidence binding was not found.',
        404
      );
    const targetStatus = request.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    const fingerprint = digestOf({
      workspaceId: principal.workspaceId,
      bindingId: request.bindingId,
      expectedVersion: request.expectedVersion,
      decision: request.decision,
      userId: principal.userId,
      membershipId: principal.membershipId
    });
    if (binding.status !== 'SUGGESTED') {
      if (
        binding.status === targetStatus &&
        binding.decisionIdempotencyKey === request.idempotencyKey &&
        binding.decisionFingerprintSha256 === fingerprint
      )
        return binding;
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_REPLAY_CONFLICT',
        'Binding already has a different terminal decision.',
        409
      );
    }
    if (binding.version !== request.expectedVersion)
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
        'Expected binding version is no longer current.',
        409
      );
    if (request.decision === 'ACCEPT') {
      await this.exactMatter(
        principal,
        binding.formalMatterId,
        binding.formalMatterVersion,
        binding.formalMatterSnapshotSha256
      );
      await this.exactSource(principal.workspaceId, binding.readyPackageId, {
        coreIntakeId: binding.coreIntakeId,
        knowledgeWorkspaceId: binding.knowledgeWorkspaceId,
        readyPackageId: binding.readyPackageId,
        readyPackageDigest: binding.readyPackageDigest,
        contentExportSha256: binding.contentExportSha256,
        stagingDocumentId: binding.stagingDocumentId,
        stagingSha256: binding.stagingSha256,
        rawArtifactId: binding.rawArtifactId,
        rawArtifactSha256: binding.rawArtifactSha256
      });
    }
    const now = this.now().toISOString();
    let result;
    try {
      result = await this.options.repository.transitionDecision({
        bindingId: binding.bindingId,
        expectedVersion: binding.version,
        status: targetStatus,
        decisionIdempotencyKey: request.idempotencyKey,
        decisionFingerprintSha256: fingerprint,
        decidedByUserId: principal.userId,
        decidedByMembershipId: principal.membershipId,
        decidedAuthority: authoritySnapshot(authority),
        decidedAt: now
      });
    } catch (cause) {
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
        'Workspace private Case evidence persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (result.applied && result.binding) return result.binding;
    const current = result.binding ?? (await this.options.repository.findById(binding.bindingId));
    if (
      current?.status === targetStatus &&
      current.decisionIdempotencyKey === request.idempotencyKey &&
      current.decisionFingerprintSha256 === fingerprint
    )
      return current;
    throw new WorkspacePrivateCaseEvidenceError(
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
      'Binding changed before this decision was applied.',
      409
    );
  }

  async readGrant(
    principal: WorkspacePrincipal,
    request: ReadWorkspacePrivateCaseEvidenceRequest
  ): Promise<Readonly<WorkspacePrivateCaseEvidenceReadGrantV1>> {
    validateReadRequest(request);
    assertPrincipal(principal, 'matter:read', this.now());
    let binding: WorkspacePrivateCaseEvidenceBindingRecord | undefined;
    try {
      binding = await this.options.repository.findById(request.bindingId);
    } catch (cause) {
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
        'Workspace private Case evidence persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!binding || binding.workspaceId !== principal.workspaceId)
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_NOT_FOUND',
        'Workspace private Case evidence binding was not found.',
        404
      );
    if (
      binding.status !== 'ACCEPTED' ||
      binding.version !== request.expectedVersion ||
      !binding.decidedAuthority
    )
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
        'Only the exact accepted current binding can authorize a private evidence read.',
        409
      );
    const authority = await this.authority(principal, 'matter:read', binding.decidedAuthority);
    await this.exactMatter(
      principal,
      binding.formalMatterId,
      binding.formalMatterVersion,
      binding.formalMatterSnapshotSha256
    );
    await this.exactSource(principal.workspaceId, binding.readyPackageId, {
      coreIntakeId: binding.coreIntakeId,
      knowledgeWorkspaceId: binding.knowledgeWorkspaceId,
      readyPackageId: binding.readyPackageId,
      readyPackageDigest: binding.readyPackageDigest,
      contentExportSha256: binding.contentExportSha256,
      stagingDocumentId: binding.stagingDocumentId,
      stagingSha256: binding.stagingSha256,
      rawArtifactId: binding.rawArtifactId,
      rawArtifactSha256: binding.rawArtifactSha256
    });
    const verifiedAt = this.now();
    const grant: WorkspacePrivateCaseEvidenceReadGrantV1 = {
      protocolVersion: '1.0',
      objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT',
      bindingId: binding.bindingId,
      bindingVersion: binding.version,
      workspaceId: binding.workspaceId,
      userId: principal.userId,
      membershipId: principal.membershipId,
      knowledgeWorkspaceId: binding.knowledgeWorkspaceId,
      readyPackageId: binding.readyPackageId,
      readyPackageDigest: binding.readyPackageDigest,
      coreIntakeId: binding.coreIntakeId,
      contentExportSha256: binding.contentExportSha256,
      stagingDocumentId: binding.stagingDocumentId,
      stagingSha256: binding.stagingSha256,
      rawArtifactId: binding.rawArtifactId,
      rawArtifactSha256: binding.rawArtifactSha256,
      caseId: binding.formalMatterId,
      caseVersion: binding.formalMatterVersion,
      caseSnapshotSha256: binding.formalMatterSnapshotSha256,
      sourceLocators: [...binding.sourceLocators],
      authoritySnapshot: authoritySnapshot(authority),
      currentness: {
        workspaceAuthority: 'CURRENT',
        formalMatter: 'CURRENT',
        coreKnowledgeEvidence: 'CURRENT',
        knowledgeRetrieval: 'MUST_VERIFY'
      },
      consequences: {
        officialTruthCreated: false,
        filingAuthorized: false,
        externalActionAuthorized: false
      },
      verifiedAt: verifiedAt.toISOString(),
      expiresAt: new Date(verifiedAt.getTime() + READ_GRANT_TTL_MS).toISOString()
    };
    return Object.freeze(grant);
  }
}

export function projectWorkspacePrivateCaseEvidenceBindingV1(
  binding: Readonly<WorkspacePrivateCaseEvidenceBindingRecord>
): WorkspacePrivateDocumentBindingV1 {
  return {
    bindingId: binding.bindingId,
    workspaceId: binding.workspaceId,
    knowledgeWorkspaceId: binding.knowledgeWorkspaceId,
    readyPackageId: binding.readyPackageId,
    canonicalDocumentId: binding.stagingDocumentId,
    artifactRefs: [binding.rawArtifactId],
    targetKind: 'CASE',
    targetId: binding.formalMatterId,
    status: binding.status,
    confidence: binding.status === 'SUGGESTED' ? 0 : 1,
    reviewRequired: binding.status === 'SUGGESTED',
    provenanceClass: binding.status === 'SUGGESTED' ? 'WORKSPACE_EVIDENCE' : 'USER_CONFIRMED',
    sourceLocators: [...binding.sourceLocators],
    methodProvenanceRefs: [...binding.methodProvenanceRefs],
    ...(binding.status === 'ACCEPTED' && binding.decidedAt ? { acceptedAt: binding.decidedAt } : {})
  };
}

export class HttpFormalMatterCurrentnessSource implements FormalMatterCurrentnessSource {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    const parsed = new URL(baseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
      throw new TypeError('MarkReg base URL must be an HTTP(S) origin without credentials.');
    if (Buffer.byteLength(internalServiceSecret, 'utf8') < 32)
      throw new TypeError('Internal service secret must contain at least 32 bytes.');
    this.baseUrl = parsed.toString().replace(/\/$/u, '');
  }
  async read(
    principal: WorkspacePrincipal,
    formalMatterId: string
  ): Promise<FormalMatterCurrentSnapshot> {
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.baseUrl}/internal/v1/formal-matters/${encodeURIComponent(formalMatterId)}/evidence`,
        {
          method: 'GET',
          headers: {
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
            'x-markorbit-workspace-id': principal.workspaceId
          }
        }
      );
    } catch (cause) {
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
        'MarkReg Formal Matter currentness source is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!response.ok) {
      const status = response.status;
      if (status === 404)
        throw new WorkspacePrivateCaseEvidenceError(
          'WORKSPACE_PRIVATE_CASE_EVIDENCE_NOT_FOUND',
          'Formal Matter was not found.',
          404
        );
      if (status === 401 || status === 403)
        throw new WorkspacePrivateCaseEvidenceError(
          'WORKSPACE_PRIVATE_CASE_EVIDENCE_PERMISSION_DENIED',
          'Formal Matter currentness read was denied.',
          status
        );
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
        'MarkReg Formal Matter currentness source is unavailable.',
        503,
        true
      );
    }
    const value = (await response.json()) as Record<string, unknown>;
    const matter = value.formalMatter as Record<string, unknown> | undefined;
    if (
      value.workspaceId !== principal.workspaceId ||
      !matter ||
      typeof matter.formalMatterId !== 'string' ||
      !validVersion(Number(matter.version)) ||
      typeof matter.snapshotSha256 !== 'string' ||
      !validDigest(matter.snapshotSha256) ||
      typeof matter.status !== 'string'
    )
      throw new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
        'MarkReg returned an invalid Formal Matter currentness payload.',
        503
      );
    return {
      workspaceId: principal.workspaceId,
      formalMatterId: matter.formalMatterId,
      version: Number(matter.version),
      snapshotSha256: matter.snapshotSha256,
      status: matter.status
    };
  }
}
