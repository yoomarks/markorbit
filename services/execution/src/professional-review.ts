import { createHash, randomUUID } from 'node:crypto';
/* eslint-disable @typescript-eslint/require-await -- the in-memory async repository intentionally matches the production persistence boundary. */
import type {
  InformationRequestDraft,
  MarkOrbitId,
  MatterDraftId,
  MatterDraftReviewSnapshot,
  ProfessionalReviewCase,
  ProfessionalReviewCaseId,
  ProfessionalReviewChecklistCode,
  ProfessionalReviewChecklistItem,
  ProfessionalReviewDecisionCode,
  ProfessionalReviewPriority
} from '@markorbit/contracts';
import { noReviewAuthorityConsequences } from '@markorbit/contracts';

export class ProfessionalReviewError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
  }
}
export interface MatterDraftReviewSource {
  getMatterDraft(id: MatterDraftId): Promise<MatterDraftReviewSnapshot | undefined>;
}
interface KeyEntry {
  fingerprint: string;
  reviewCaseId: ProfessionalReviewCaseId;
}
export interface ProfessionalReviewRepository {
  create(value: ProfessionalReviewCase, idempotencyKey: string, fingerprint: string): Promise<void>;
  findById(id: ProfessionalReviewCaseId): Promise<ProfessionalReviewCase | undefined>;
  list(): Promise<ProfessionalReviewCase[]>;
  findByIdempotencyKey(key: string): Promise<KeyEntry | undefined>;
  findActiveByMatterDraftVersion(
    id: MatterDraftId,
    version: string
  ): Promise<ProfessionalReviewCase | undefined>;
  claim(value: ProfessionalReviewCase): Promise<void>;
  updateChecklist(value: ProfessionalReviewCase): Promise<void>;
  prepareInformationRequest(value: ProfessionalReviewCase): Promise<void>;
  recordDecision(value: ProfessionalReviewCase): Promise<void>;
  markStale(value: ProfessionalReviewCase): Promise<void>;
  withdraw(value: ProfessionalReviewCase): Promise<void>;
}
export class InMemoryProfessionalReviewRepository implements ProfessionalReviewRepository {
  private cases = new Map<ProfessionalReviewCaseId, ProfessionalReviewCase>();
  private keys = new Map<string, KeyEntry>();
  async create(v: ProfessionalReviewCase, key: string, fingerprint: string) {
    this.cases.set(v.reviewCaseId, structuredClone(v));
    this.keys.set(key, { fingerprint, reviewCaseId: v.reviewCaseId });
  }
  async findById(id: ProfessionalReviewCaseId) {
    const v = this.cases.get(id);
    return v && structuredClone(v);
  }
  async list(): Promise<ProfessionalReviewCase[]> {
    return [...this.cases.values()].map((value) => structuredClone(value));
  }
  snapshotIdempotencyCount() {
    return this.keys.size;
  }
  async findByIdempotencyKey(key: string) {
    const v = this.keys.get(key);
    return v && structuredClone(v);
  }
  async findActiveByMatterDraftVersion(id: MatterDraftId, version: string) {
    return (await this.list()).find(
      (v) =>
        v.source.matterDraftId === id &&
        v.source.matterDraftVersion === version &&
        !['STALE', 'WITHDRAWN', 'REVIEWED_READY_FOR_NEXT_STEP'].includes(v.status)
    );
  }
  private save(v: ProfessionalReviewCase) {
    const current = this.cases.get(v.reviewCaseId);
    if (current?.version !== undefined && v.version !== (current.version ?? 0) + 1)
      return Promise.reject(
        new ProfessionalReviewError(
          'STALE_PROFESSIONAL_REVIEW',
          'The Review Case changed; reload the exact latest version.',
          409
        )
      );
    this.cases.set(v.reviewCaseId, structuredClone(v));
    return Promise.resolve();
  }
  claim(v: ProfessionalReviewCase) {
    return this.save(v);
  }
  updateChecklist(v: ProfessionalReviewCase) {
    return this.save(v);
  }
  prepareInformationRequest(v: ProfessionalReviewCase) {
    return this.save(v);
  }
  recordDecision(v: ProfessionalReviewCase) {
    return this.save(v);
  }
  markStale(v: ProfessionalReviewCase) {
    return this.save(v);
  }
  withdraw(v: ProfessionalReviewCase) {
    return this.save(v);
  }
}
const codes: ProfessionalReviewChecklistCode[] = [
  'SOURCE_MATTER_DRAFT_CURRENT',
  'CUSTOMER_CONFIRMATION_VALID',
  'APPLICANT_INFORMATION_REVIEWED',
  'MARK_REPRESENTATION_REVIEWED',
  'JURISDICTION_REVIEWED',
  'CLASS_SELECTION_REVIEWED',
  'GOODS_SERVICES_REVIEWED',
  'FILING_BASIS_REVIEWED',
  'REPRESENTATIVE_REQUIREMENT_REVIEWED',
  'DOCUMENT_READINESS_REVIEWED',
  'COMMERCIAL_SCOPE_UNCHANGED',
  'AUTHORITY_BOUNDARIES_ACKNOWLEDGED'
];
const checklist = (): ProfessionalReviewChecklistItem[] =>
  codes.map((code) => ({
    code,
    status: 'UNKNOWN',
    blocking: true,
    explanation: 'Professional review evidence is required.'
  }));
export class ProfessionalReviewService {
  constructor(
    private repository: ProfessionalReviewRepository,
    private source: MatterDraftReviewSource,
    private now = () => new Date().toISOString()
  ) {}
  async create(command: {
    matterDraftId: MatterDraftId;
    matterDraftVersion: string;
    idempotencyKey: string;
    requestedBy: MarkOrbitId;
    priority?: ProfessionalReviewPriority;
    workspaceId?: string;
    formalMatterId?: ProfessionalReviewCase['formalMatterId'];
    sourceFormalMatterVersion?: number;
    sourceSnapshotSha256?: string;
  }) {
    const fingerprint = createHash('sha256').update(JSON.stringify(command)).digest('hex');
    const key = await this.repository.findByIdempotencyKey(command.idempotencyKey);
    if (key) {
      if (key.fingerprint !== fingerprint)
        throw new ProfessionalReviewError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different payload.'
        );
      return this.required(key.reviewCaseId);
    }
    const source = await this.source.getMatterDraft(command.matterDraftId);
    if (!source)
      throw new ProfessionalReviewError(
        'SOURCE_MATTER_DRAFT_NOT_FOUND',
        'Source Matter Draft was not found.',
        404
      );
    if (source.matterDraftVersion !== command.matterDraftVersion)
      throw new ProfessionalReviewError(
        'SOURCE_VERSION_MISMATCH',
        'Exact source Matter Draft version is required.'
      );
    if (source.status !== 'READY_FOR_PROFESSIONAL_REVIEW')
      throw new ProfessionalReviewError(
        'SOURCE_NOT_READY',
        'Matter Draft is not ready for professional review.',
        422
      );
    if (
      await this.repository.findActiveByMatterDraftVersion(
        command.matterDraftId,
        command.matterDraftVersion
      )
    )
      throw new ProfessionalReviewError(
        'ACTIVE_REVIEW_CASE_EXISTS',
        'An active case already exists for this Matter Draft version.',
        409,
        { stage: 'Professional Review', state: 'ACTIVE' }
      );
    const at = this.now();
    const value: ProfessionalReviewCase = {
      schemaVersion: 1,
      reviewCaseId: `professional-review_${randomUUID()}`,
      ...(command.workspaceId ? { workspaceId: command.workspaceId } : {}),
      ...(command.formalMatterId ? { formalMatterId: command.formalMatterId } : {}),
      ...(command.sourceFormalMatterVersion
        ? { sourceFormalMatterVersion: command.sourceFormalMatterVersion }
        : {}),
      ...(command.sourceSnapshotSha256
        ? { sourceSnapshotSha256: command.sourceSnapshotSha256 }
        : {}),
      version: 1,
      source: structuredClone(source),
      status: 'QUEUED',
      priority: command.priority ?? 'NORMAL',
      requestedBy: command.requestedBy,
      createdAt: at,
      updatedAt: at,
      assignment: { status: 'UNASSIGNED', professionalAppointed: false },
      checklist: checklist(),
      evidence: []
    };
    await this.repository.create(value, command.idempotencyKey, fingerprint);
    return value;
  }
  async list() {
    const values = await this.repository.list();
    for (const v of values) await this.refresh(v);
    return this.repository.list();
  }
  async get(id: ProfessionalReviewCaseId) {
    const v = await this.required(id);
    await this.refresh(v);
    return this.required(id);
  }
  private async required(id: ProfessionalReviewCaseId) {
    const v = await this.repository.findById(id);
    if (!v)
      throw new ProfessionalReviewError(
        'REVIEW_CASE_NOT_FOUND',
        'Professional Review Case was not found.',
        404
      );
    return v;
  }
  private async refresh(v: ProfessionalReviewCase) {
    if (['STALE', 'WITHDRAWN', 'REVIEWED_READY_FOR_NEXT_STEP'].includes(v.status)) return;
    const current = await this.source.getMatterDraft(v.source.matterDraftId);
    if (!current || current.matterDraftVersion !== v.source.matterDraftVersion)
      await this.repository.markStale({
        ...v,
        status: 'STALE',
        version: (v.version ?? 0) + 1,
        updatedAt: this.now()
      });
  }
  async claim(id: ProfessionalReviewCaseId, reviewerId: MarkOrbitId, expectedVersion?: number) {
    const v = await this.get(id);
    this.exact(v, expectedVersion);
    if (v.status !== 'QUEUED')
      throw new ProfessionalReviewError('CASE_NOT_CLAIMABLE', 'Only a queued case may be claimed.');
    const at = this.now();
    const next = {
      ...v,
      status: 'IN_REVIEW' as const,
      updatedAt: at,
      version: (v.version ?? 0) + 1,
      assignment: {
        assignedReviewerId: reviewerId,
        assignedAt: at,
        claimedBy: reviewerId,
        claimedAt: at,
        status: 'CLAIMED' as const,
        professionalAppointed: false as const
      }
    };
    await this.repository.claim(next);
    return next;
  }
  async updateChecklist(
    id: ProfessionalReviewCaseId,
    reviewerId: MarkOrbitId,
    updates: Partial<ProfessionalReviewChecklistItem>[],
    expectedVersion?: number
  ) {
    const v = await this.reviewable(id, reviewerId);
    this.exact(v, expectedVersion);
    const at = this.now();
    const next = {
      ...v,
      updatedAt: at,
      version: (v.version ?? 0) + 1,
      checklist: v.checklist.map((item) => {
        const u = updates.find((x) => x.code === item.code);
        return u ? { ...item, ...structuredClone(u), code: item.code, reviewedAt: at } : item;
      })
    };
    await this.repository.updateChecklist(next);
    return next;
  }
  async requestInformation(
    id: ProfessionalReviewCaseId,
    reviewerId: MarkOrbitId,
    input: Omit<InformationRequestDraft, 'createdAt' | 'sent'>,
    expectedVersion?: number
  ) {
    const v = await this.reviewable(id, reviewerId);
    this.exact(v, expectedVersion);
    if (!input.requestedFields.length)
      throw new ProfessionalReviewError(
        'REQUIRED_INFORMATION_EMPTY',
        'At least one requested field is required.',
        422
      );
    const draft = { ...structuredClone(input), createdAt: this.now(), sent: false as const };
    const next = {
      ...v,
      status: 'NEEDS_INFORMATION' as const,
      updatedAt: draft.createdAt,
      version: (v.version ?? 0) + 1,
      informationRequest: draft
    };
    await this.repository.prepareInformationRequest(next);
    return next;
  }
  async complete(
    id: ProfessionalReviewCaseId,
    reviewerId: MarkOrbitId,
    code: ProfessionalReviewDecisionCode,
    rationale: string,
    expectedVersion?: number
  ) {
    const v = await this.reviewable(id, reviewerId);
    if (v.decision) {
      if (
        v.decision.code === code &&
        v.decision.rationale === rationale &&
        v.decision.reviewerId === reviewerId
      )
        return v;
      throw new ProfessionalReviewError('DECISION_IMMUTABLE', 'A completed decision is immutable.');
    }
    this.exact(v, expectedVersion);
    if (
      code === 'MARK_READY_FOR_NEXT_STEP' &&
      v.checklist.some((x) => x.blocking && !['PASS', 'NOT_APPLICABLE'].includes(x.status))
    )
      throw new ProfessionalReviewError(
        'BLOCKING_CHECKLIST_ITEMS',
        'FAIL and UNKNOWN blocking items prevent completion.',
        422
      );
    const at = this.now();
    const decision = {
      code,
      reviewerId,
      decidedAt: at,
      rationale,
      checklistSnapshot: structuredClone(v.checklist),
      evidenceReferences: v.evidence.map((x) => x.reference),
      sourceMatterDraftVersion: v.source.matterDraftVersion,
      consequences: noReviewAuthorityConsequences
    };
    const status =
      code === 'MARK_READY_FOR_NEXT_STEP'
        ? ('REVIEWED_READY_FOR_NEXT_STEP' as const)
        : code === 'REQUEST_INFORMATION'
          ? ('NEEDS_INFORMATION' as const)
          : ('WITHDRAWN' as const);
    const next = {
      ...v,
      status,
      updatedAt: at,
      version: (v.version ?? 0) + 1,
      decision,
      completedAt: at,
      completedBy: reviewerId
    };
    await this.repository.recordDecision(next);
    return next;
  }
  async withdraw(id: ProfessionalReviewCaseId) {
    const v = await this.required(id);
    if (v.decision)
      throw new ProfessionalReviewError('DECISION_IMMUTABLE', 'A completed decision is immutable.');
    const next = {
      ...v,
      status: 'WITHDRAWN' as const,
      version: (v.version ?? 0) + 1,
      updatedAt: this.now()
    };
    await this.repository.withdraw(next);
    return next;
  }
  private async reviewable(id: ProfessionalReviewCaseId, reviewerId: MarkOrbitId) {
    const v = await this.get(id);
    if (v.status === 'STALE')
      throw new ProfessionalReviewError(
        'STALE_PROFESSIONAL_REVIEW',
        'A stale case cannot be reviewed.',
        409,
        {
          stage: 'Professional Review',
          state: v.status,
          actualVersion: v.source.matterDraftVersion
        }
      );
    if (v.status === 'WITHDRAWN')
      throw new ProfessionalReviewError('CASE_WITHDRAWN', 'A withdrawn case cannot be reviewed.');
    if (v.assignment.claimedBy !== reviewerId)
      throw new ProfessionalReviewError(
        'REVIEWER_MISMATCH',
        'Reviewer must claim the case first.',
        403
      );
    return v;
  }
  private exact(value: ProfessionalReviewCase, expectedVersion?: number) {
    if (expectedVersion !== undefined && expectedVersion !== value.version)
      throw new ProfessionalReviewError(
        'STALE_PROFESSIONAL_REVIEW',
        'The Review Case changed; reload the exact latest version.',
        409,
        { expectedVersion, actualVersion: value.version }
      );
  }
}
