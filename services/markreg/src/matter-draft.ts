import { randomUUID } from 'node:crypto';
import type {
  MatterDraftPreparation,
  MatterDraftStatus,
  MatterReadiness,
  MatterReadinessCheck,
  Permission,
  WorkspacePrincipal
} from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import type { CustomerConfirmationRepository } from './customer-confirmation.js';

export interface MatterDraftRecord {
  schemaVersion: 1;
  matterDraftId: string;
  workspaceId: string;
  customerConfirmationId: string;
  customerConfirmationVersion: number;
  sourceQuoteId: string;
  sourceQuoteVersion: string;
  preparation: Readonly<MatterDraftPreparation>;
  instructionCompleteness: 'INCOMPLETE' | 'COMPLETE';
  documentReadiness: 'MISSING' | 'READY';
  readiness: MatterReadiness;
  missingInformation: string[];
  status: MatterDraftStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export type MatterDraftErrorCode =
  | 'MATTER_DRAFT_NOT_FOUND'
  | 'MATTER_DRAFT_DUPLICATE'
  | 'MATTER_DRAFT_STALE_VERSION'
  | 'MATTER_DRAFT_WORKSPACE_MISMATCH'
  | 'MATTER_DRAFT_INVALID_SOURCE'
  | 'CUSTOMER_CONFIRMATION_WITHDRAWN'
  | 'PERMISSION_DENIED'
  | 'AUTHENTICATION_REQUIRED'
  | 'PERSISTENCE_UNAVAILABLE';
export class MatterDraftError extends Error {
  constructor(
    readonly code: MatterDraftErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MatterDraftError';
  }
}
export interface MatterDraftRepository {
  create(value: MatterDraftRecord): Promise<MatterDraftRecord>;
  findById(workspaceId: string, id: string): Promise<MatterDraftRecord | null>;
  findByConfirmation(
    workspaceId: string,
    confirmationId: string
  ): Promise<MatterDraftRecord | null>;
  update(
    workspaceId: string,
    id: string,
    expectedVersion: number,
    value: MatterDraftRecord
  ): Promise<MatterDraftRecord>;
}
const clone = <T>(value: T): T => structuredClone(value);
export class InMemoryMatterDraftRepository implements MatterDraftRepository {
  private readonly values = new Map<string, MatterDraftRecord>();
  async create(value: MatterDraftRecord) {
    if (await this.findByConfirmation(value.workspaceId, value.customerConfirmationId))
      throw new MatterDraftError(
        'MATTER_DRAFT_DUPLICATE',
        'A Matter Draft already exists for this Customer Confirmation.'
      );
    this.values.set(value.matterDraftId, clone(value));
    return clone(value);
  }
  findById(workspaceId: string, id: string) {
    const value = this.values.get(id);
    return Promise.resolve(value?.workspaceId === workspaceId ? clone(value) : null);
  }
  findByConfirmation(workspaceId: string, confirmationId: string) {
    return Promise.resolve(
      clone(
        [...this.values.values()].find(
          (v) => v.workspaceId === workspaceId && v.customerConfirmationId === confirmationId
        ) ?? null
      )
    );
  }
  async update(workspaceId: string, id: string, expectedVersion: number, value: MatterDraftRecord) {
    const current = await this.findById(workspaceId, id);
    if (!current)
      throw new MatterDraftError('MATTER_DRAFT_NOT_FOUND', 'Matter Draft was not found.');
    if (current.version !== expectedVersion)
      throw new MatterDraftError('MATTER_DRAFT_STALE_VERSION', 'Matter Draft version is stale.');
    const next = { ...clone(value), version: current.version + 1 };
    this.values.set(id, next);
    return clone(next);
  }
}
type Row = Record<string, unknown>;
export class PostgresMatterDraftRepository implements MatterDraftRepository {
  constructor(private readonly db: QueryClient) {}
  async create(v: MatterDraftRecord) {
    try {
      const r = await this.db.query(
        'INSERT INTO matter_drafts (matter_draft_id,workspace_id,customer_confirmation_id,customer_confirmation_version,source_quote_id,source_quote_version,preparation,instruction_completeness,document_readiness,readiness,missing_information,status,version,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15) RETURNING *',
        [
          v.matterDraftId,
          v.workspaceId,
          v.customerConfirmationId,
          v.customerConfirmationVersion,
          v.sourceQuoteId,
          v.sourceQuoteVersion,
          JSON.stringify(v.preparation),
          v.instructionCompleteness,
          v.documentReadiness,
          JSON.stringify(v.readiness),
          JSON.stringify(v.missingInformation),
          v.status,
          v.version,
          v.createdAt,
          v.updatedAt
        ]
      );
      return this.map(r.rows[0] as Row);
    } catch (cause) {
      if ((cause as { code?: string }).code === '23505')
        throw new MatterDraftError(
          'MATTER_DRAFT_DUPLICATE',
          'A Matter Draft already exists for this Customer Confirmation.'
        );
      throw unavailable(cause);
    }
  }
  async findById(workspaceId: string, id: string) {
    try {
      const r = await this.db.query(
        'SELECT * FROM matter_drafts WHERE workspace_id=$1 AND matter_draft_id=$2',
        [workspaceId, id]
      );
      return r.rowCount ? this.map(r.rows[0] as Row) : null;
    } catch (cause) {
      throw unavailable(cause);
    }
  }
  async findByConfirmation(workspaceId: string, confirmationId: string) {
    try {
      const r = await this.db.query(
        'SELECT * FROM matter_drafts WHERE workspace_id=$1 AND customer_confirmation_id=$2',
        [workspaceId, confirmationId]
      );
      return r.rowCount ? this.map(r.rows[0] as Row) : null;
    } catch (cause) {
      throw unavailable(cause);
    }
  }
  async update(workspaceId: string, id: string, expectedVersion: number, v: MatterDraftRecord) {
    try {
      const r = await this.db.query(
        'UPDATE matter_drafts SET preparation=$4::jsonb,instruction_completeness=$5,document_readiness=$6,readiness=$7::jsonb,missing_information=$8::jsonb,status=$9,version=version+1,updated_at=$10 WHERE workspace_id=$1 AND matter_draft_id=$2 AND version=$3 RETURNING *',
        [
          workspaceId,
          id,
          expectedVersion,
          JSON.stringify(v.preparation),
          v.instructionCompleteness,
          v.documentReadiness,
          JSON.stringify(v.readiness),
          JSON.stringify(v.missingInformation),
          v.status,
          v.updatedAt
        ]
      );
      if (r.rowCount) return this.map(r.rows[0] as Row);
      if (!(await this.findById(workspaceId, id)))
        throw new MatterDraftError('MATTER_DRAFT_NOT_FOUND', 'Matter Draft was not found.');
      throw new MatterDraftError('MATTER_DRAFT_STALE_VERSION', 'Matter Draft version is stale.');
    } catch (cause) {
      if (cause instanceof MatterDraftError) throw cause;
      throw unavailable(cause);
    }
  }
  private map(r: Row): MatterDraftRecord {
    return {
      schemaVersion: 1,
      matterDraftId: String(r.matter_draft_id),
      workspaceId: String(r.workspace_id),
      customerConfirmationId: String(r.customer_confirmation_id),
      customerConfirmationVersion: Number(r.customer_confirmation_version),
      sourceQuoteId: String(r.source_quote_id),
      sourceQuoteVersion: String(r.source_quote_version),
      preparation: clone(r.preparation as MatterDraftPreparation),
      instructionCompleteness:
        r.instruction_completeness as MatterDraftRecord['instructionCompleteness'],
      documentReadiness: r.document_readiness as MatterDraftRecord['documentReadiness'],
      readiness: clone(r.readiness as MatterReadiness),
      missingInformation: clone(r.missing_information as string[]),
      status: r.status as MatterDraftStatus,
      version: Number(r.version),
      createdAt: new Date(r.created_at as string).toISOString(),
      updatedAt: new Date(r.updated_at as string).toISOString()
    };
  }
}
function unavailable(cause: unknown) {
  return new MatterDraftError(
    'PERSISTENCE_UNAVAILABLE',
    'Matter Draft persistence is unavailable.',
    { cause: cause instanceof Error ? cause : undefined }
  );
}
function authorize(p: WorkspacePrincipal, workspaceId: string, permission: Permission) {
  if (p.kind !== 'WORKSPACE')
    throw new MatterDraftError('AUTHENTICATION_REQUIRED', 'A Workspace Principal is required.');
  if (p.workspaceId !== workspaceId)
    throw new MatterDraftError(
      'MATTER_DRAFT_WORKSPACE_MISMATCH',
      'Workspace context does not match.'
    );
  if (!p.permissions.includes(permission))
    throw new MatterDraftError('PERMISSION_DENIED', 'Permission is required.');
}
function readiness(
  confirmationStatus: 'CONFIRMED' | 'WITHDRAWN',
  p: MatterDraftPreparation,
  at: string
): MatterReadiness {
  const c = (
    code: MatterReadinessCheck['code'],
    pass: boolean | undefined,
    explanation: string
  ): MatterReadinessCheck => ({
    code,
    status: pass === undefined ? 'UNKNOWN' : pass ? 'PASS' : 'FAIL',
    explanation,
    blocking: true
  });
  const checks = [
    c(
      'CUSTOMER_CONFIRMATION_VALID',
      confirmationStatus === 'CONFIRMED',
      'Customer Confirmation must remain current.'
    ),
    c('APPLICANT_IDENTITY_PRESENT', !!p.applicantName, 'Applicant identity is required.'),
    c('APPLICANT_ADDRESS_PRESENT', !!p.applicantAddress, 'Applicant address is required.'),
    c('MARK_REPRESENTATION_PRESENT', !!p.trademark, 'A mark representation is required.'),
    c('JURISDICTION_SELECTED', !!p.targetJurisdiction, 'A target jurisdiction is required.'),
    c('CLASS_SELECTION_PRESENT', p.classes.length > 0, 'At least one class is required.'),
    c('GOODS_SERVICES_PRESENT', !!p.goodsServices, 'Goods/services are required.'),
    c(
      'FILING_BASIS_PRESENT_OR_NOT_REQUIRED',
      p.filingBasis ? true : undefined,
      'Filing basis must be supplied or established as not applicable.'
    ),
    c(
      'REPRESENTATIVE_REQUIREMENT_EVALUATED',
      p.representativeRequired === undefined ? undefined : true,
      'Representative requirement must be evaluated.'
    ),
    c(
      'REQUIRED_DOCUMENTS_PRESENT',
      p.documentReferences.length > 0,
      'Required document evidence is needed.'
    ),
    c(
      'COMMERCIAL_SCOPE_UNCHANGED',
      p.commercialScopeUnchanged,
      'Commercial scope must match the confirmed snapshot.'
    )
  ];
  return {
    evaluatedAt: at,
    checks,
    readyForProfessionalReview: checks.every(
      (x) => x.status === 'PASS' || x.status === 'NOT_APPLICABLE'
    )
  };
}
export class MatterDraftService {
  constructor(
    private readonly repository: MatterDraftRepository,
    private readonly confirmations: CustomerConfirmationRepository,
    private readonly now = () => new Date().toISOString()
  ) {}
  async create(
    p: WorkspacePrincipal,
    input: {
      workspaceId: string;
      customerConfirmationId: string;
      customerConfirmationVersion: number;
    }
  ) {
    authorize(p, input.workspaceId, 'matter:create');
    const existing = await this.repository.findByConfirmation(
      input.workspaceId,
      input.customerConfirmationId
    );
    if (existing) return existing;
    const confirmation = await this.confirmations.findById(
      input.workspaceId,
      input.customerConfirmationId
    );
    if (!confirmation)
      throw new MatterDraftError(
        'MATTER_DRAFT_INVALID_SOURCE',
        'Customer Confirmation was not found in this Workspace.'
      );
    if (confirmation.status === 'WITHDRAWN')
      throw new MatterDraftError(
        'CUSTOMER_CONFIRMATION_WITHDRAWN',
        'A withdrawn Customer Confirmation cannot prepare a Matter Draft.'
      );
    if (confirmation.version !== input.customerConfirmationVersion)
      throw new MatterDraftError(
        'MATTER_DRAFT_INVALID_SOURCE',
        'The exact Customer Confirmation version is required.'
      );
    const at = this.now(),
      preparation = { classes: [], documentReferences: [] },
      r = readiness(confirmation.status, preparation, at);
    return this.repository.create({
      schemaVersion: 1,
      matterDraftId: `matter-draft_${randomUUID()}`,
      workspaceId: input.workspaceId,
      customerConfirmationId: confirmation.confirmationId,
      customerConfirmationVersion: confirmation.version,
      sourceQuoteId: confirmation.sourceQuoteId,
      sourceQuoteVersion: confirmation.sourceQuoteVersion,
      preparation,
      instructionCompleteness: 'INCOMPLETE',
      documentReadiness: 'MISSING',
      readiness: r,
      missingInformation: r.checks
        .filter((x) => x.blocking && x.status !== 'PASS')
        .map((x) => x.code),
      status: 'NEEDS_INFORMATION',
      version: 1,
      createdAt: at,
      updatedAt: at
    });
  }
  async get(p: WorkspacePrincipal, workspaceId: string, id: string) {
    authorize(p, workspaceId, 'matter:read');
    const v = await this.repository.findById(workspaceId, id);
    if (!v) throw new MatterDraftError('MATTER_DRAFT_NOT_FOUND', 'Matter Draft was not found.');
    return v;
  }
  async update(
    p: WorkspacePrincipal,
    workspaceId: string,
    id: string,
    expectedVersion: number,
    patch: Partial<MatterDraftPreparation>
  ) {
    authorize(p, workspaceId, 'matter:manage');
    const v = await this.get(p, workspaceId, id);
    const preparation = { ...v.preparation, ...clone(patch) };
    return this.repository.update(workspaceId, id, expectedVersion, {
      ...v,
      preparation,
      updatedAt: this.now()
    });
  }
  async evaluate(p: WorkspacePrincipal, workspaceId: string, id: string, expectedVersion: number) {
    authorize(
      p,
      workspaceId,
      p.permissions.includes('matter:manage') ? 'matter:manage' : 'review:perform'
    );
    const v = await this.get(p, workspaceId, id),
      confirmation = await this.confirmations.findById(workspaceId, v.customerConfirmationId);
    if (!confirmation)
      throw new MatterDraftError(
        'MATTER_DRAFT_INVALID_SOURCE',
        'Customer Confirmation is unavailable.'
      );
    const at = this.now(),
      r = readiness(confirmation.status, v.preparation, at),
      missing = r.checks
        .filter((x) => x.blocking && x.status !== 'PASS' && x.status !== 'NOT_APPLICABLE')
        .map((x) => x.code);
    return this.repository.update(workspaceId, id, expectedVersion, {
      ...v,
      readiness: r,
      missingInformation: missing,
      instructionCompleteness: r.readyForProfessionalReview ? 'COMPLETE' : 'INCOMPLETE',
      documentReadiness: v.preparation.documentReferences.length ? 'READY' : 'MISSING',
      status: r.readyForProfessionalReview ? 'READY_FOR_PROFESSIONAL_REVIEW' : 'NEEDS_INFORMATION',
      updatedAt: at
    });
  }
  async progress(p: WorkspacePrincipal, workspaceId: string, id: string, expectedVersion: number) {
    authorize(p, workspaceId, 'matter:manage');
    const value = await this.get(p, workspaceId, id);
    if (value.version !== expectedVersion)
      throw new MatterDraftError('MATTER_DRAFT_STALE_VERSION', 'Matter Draft version is stale.');
    if (!value.readiness.readyForProfessionalReview)
      throw new MatterDraftError('MATTER_DRAFT_INVALID_SOURCE', 'Matter Draft is not ready.');
    return value;
  }
}
