import { createHash, randomUUID } from 'node:crypto';
/* eslint-disable @typescript-eslint/require-await -- The in-memory adapter deliberately implements asynchronous production-facing repository contracts. */
import type {
  CustomerConfirmation,
  CustomerInstructionAcknowledgement,
  CustomerInstructionEntry,
  CustomerInstructionEntryId,
  CustomerInstructionLedger,
  CustomerInstructionLedgerId,
  CustomerInstructionType,
  DocumentItem,
  DocumentItemId,
  DocumentPackage,
  DocumentPackageId,
  DocumentReference,
  DocumentRequirement,
  DocumentRequirementCode,
  DocumentValidationCheck,
  MatterDraft,
  MarkOrbitId,
  PreparationLock,
  PreparationLockId,
  ProfessionalReviewCase
} from '@markorbit/contracts';
import { noPreparationAuthorityConsequences } from '@markorbit/contracts';

export class PreparationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409
  ) {
    super(message);
  }
}
export interface PreparationSources {
  getReview(id: string): Promise<ProfessionalReviewCase | undefined>;
  getMatterDraft(id: string): Promise<MatterDraft | undefined>;
  getConfirmation(id: string): Promise<CustomerConfirmation | undefined>;
}
type KeyEntry = { fingerprint: string; id: DocumentPackageId };
export interface PreparationRepository {
  createPackage(value: DocumentPackage, key: string, fingerprint: string): Promise<void>;
  findPackage(id: DocumentPackageId): Promise<DocumentPackage | undefined>;
  findActiveBySource(
    reviewId: string,
    decisionVersion: string
  ): Promise<DocumentPackage | undefined>;
  findByIdempotencyKey(key: string): Promise<KeyEntry | undefined>;
  listForCustomer(customerId?: string): Promise<DocumentPackage[]>;
  savePackage(value: DocumentPackage): Promise<void>;
  createLedger(value: CustomerInstructionLedger): Promise<void>;
  findLedger(id: CustomerInstructionLedgerId): Promise<CustomerInstructionLedger | undefined>;
  saveLedger(value: CustomerInstructionLedger): Promise<void>;
  createLock(value: PreparationLock): Promise<void>;
  findLock(id: PreparationLockId): Promise<PreparationLock | undefined>;
}
export class InMemoryPreparationRepository implements PreparationRepository {
  private packages = new Map<DocumentPackageId, DocumentPackage>();
  private keys = new Map<string, KeyEntry>();
  private ledgers = new Map<CustomerInstructionLedgerId, CustomerInstructionLedger>();
  private locks = new Map<PreparationLockId, PreparationLock>();
  async createPackage(v: DocumentPackage, key: string, fingerprint: string) {
    this.packages.set(v.documentPackageId, structuredClone(v));
    this.keys.set(key, { fingerprint, id: v.documentPackageId });
  }
  async findPackage(id: DocumentPackageId) {
    const v = this.packages.get(id);
    return v && structuredClone(v);
  }
  async findActiveBySource(reviewId: string, version: string) {
    const v = [...this.packages.values()].find(
      (x) =>
        x.professionalReviewCaseId === reviewId &&
        x.professionalReviewDecisionVersion === version &&
        !['WITHDRAWN', 'STALE'].includes(x.status)
    );
    return v && structuredClone(v);
  }
  async findByIdempotencyKey(key: string) {
    const v = this.keys.get(key);
    return v && structuredClone(v);
  }
  async listForCustomer(id?: string) {
    return [...this.packages.values()]
      .filter((x) => !id || x.customerId === id)
      .map((x) => structuredClone(x));
  }
  async savePackage(v: DocumentPackage) {
    this.packages.set(v.documentPackageId, structuredClone(v));
  }
  async createLedger(v: CustomerInstructionLedger) {
    this.ledgers.set(v.instructionLedgerId, structuredClone(v));
  }
  async findLedger(id: CustomerInstructionLedgerId) {
    const v = this.ledgers.get(id);
    return v && structuredClone(v);
  }
  async saveLedger(v: CustomerInstructionLedger) {
    this.ledgers.set(v.instructionLedgerId, structuredClone(v));
  }
  async createLock(v: PreparationLock) {
    this.locks.set(v.preparationLockId, structuredClone(v));
  }
  async findLock(id: PreparationLockId) {
    const v = this.locks.get(id);
    return v && structuredClone(v);
  }
}

export interface CreatePackageCommand {
  professionalReviewCaseId: string;
  professionalReviewDecisionVersion: string;
  matterDraftVersion: string;
  idempotencyKey: string;
}
const fixtureNotice =
  'Illustrative non-production rule; not authoritative legal advice; subject to jurisdiction-specific verification.';
export function deriveDocumentRequirements(m: MatterDraft): DocumentRequirement[] {
  const requirement = (
    code: DocumentRequirementCode,
    name: string,
    reason: string
  ): DocumentRequirement => ({
    code,
    name,
    reason: `${reason} ${fixtureNotice}`,
    source: 'MARKREG_FIXTURE_RULES_V1',
    blocking: true,
    fixtureOnly: true
  });
  const values = [
    requirement(
      'APPLICANT_IDENTITY_EVIDENCE',
      'Applicant identity evidence',
      'Identity metadata is required for this fixture.'
    ),
    requirement(
      'MARK_REPRESENTATION_FILE',
      'Mark representation',
      'A representation file is required for this fixture.'
    )
  ];
  if (m.preparation.representativeRequired)
    values.push(
      requirement(
        'POWER_OF_ATTORNEY',
        'Power of attorney',
        'The source review recorded a representative requirement.'
      )
    );
  if (m.preparation.filingBasis === 'USE')
    values.push(requirement('USE_EVIDENCE', 'Use evidence', 'The fixture filing basis is use.'));
  return values;
}
const fingerprint = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export class PreparationService {
  constructor(
    private repo: PreparationRepository,
    private sources: PreparationSources,
    private now = () => new Date().toISOString()
  ) {}
  async createPackage(c: CreatePackageCommand) {
    const fp = fingerprint({ ...c, idempotencyKey: undefined });
    const prior = await this.repo.findByIdempotencyKey(c.idempotencyKey);
    if (prior && prior.fingerprint !== fp)
      throw new PreparationError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.'
      );
    if (prior) return this.requiredPackage(prior.id);
    const review = await this.sources.getReview(c.professionalReviewCaseId);
    if (!review)
      throw new PreparationError(
        'SOURCE_REVIEW_NOT_FOUND',
        'Professional Review Case was not found.',
        404
      );
    if (review.status !== 'REVIEWED_READY_FOR_NEXT_STEP' || !review.decision)
      throw new PreparationError(
        'SOURCE_REVIEW_NOT_READY',
        'Professional Review must be reviewed and ready for the next step.'
      );
    const decisionVersion = review.decision.decidedAt;
    if (decisionVersion !== c.professionalReviewDecisionVersion)
      throw new PreparationError(
        'REVIEW_DECISION_VERSION_MISMATCH',
        'The exact Professional Review decision version is required.'
      );
    if (await this.repo.findActiveBySource(review.reviewCaseId, decisionVersion))
      throw new PreparationError(
        'ACTIVE_PACKAGE_EXISTS',
        'An active package already exists for this review decision.'
      );
    const matter = await this.sources.getMatterDraft(review.source.matterDraftId);
    if (!matter)
      throw new PreparationError(
        'SOURCE_MATTER_DRAFT_NOT_FOUND',
        'Matter Draft was not found.',
        404
      );
    if (review.source.matterDraftVersion !== c.matterDraftVersion)
      throw new PreparationError(
        'MATTER_DRAFT_VERSION_MISMATCH',
        'The exact Matter Draft version is required.'
      );
    const confirmation = await this.sources.getConfirmation(review.source.confirmationId);
    if (!confirmation || confirmation.status !== 'CONFIRMED')
      throw new PreparationError(
        'CUSTOMER_CONFIRMATION_INVALID',
        'Customer Confirmation must remain confirmed.'
      );
    const at = this.now(),
      requirements = deriveDocumentRequirements(matter);
    const value: DocumentPackage = {
      schemaVersion: 1,
      documentPackageId: `document-package_${randomUUID()}`,
      version: 1,
      professionalReviewCaseId: review.reviewCaseId,
      professionalReviewDecisionVersion: decisionVersion,
      matterDraftId: matter.matterDraftId,
      matterDraftVersion: c.matterDraftVersion,
      customerConfirmationId: confirmation.confirmationId,
      customerId: matter.customerId,
      jurisdiction: matter.preparation.targetJurisdiction ?? '',
      trademarkReference: matter.preparation.trademark ?? '',
      requirements,
      documentItems: [],
      validationChecks: [],
      missingRequirements: requirements.map((x) => x.code),
      status: 'NEEDS_DOCUMENTS',
      createdAt: at,
      updatedAt: at
    };
    await this.repo.createPackage(value, c.idempotencyKey, fp);
    return structuredClone(value);
  }
  async getPackage(id: DocumentPackageId) {
    return this.requiredPackage(id);
  }
  async listPackages(customerId?: string) {
    return this.repo.listForCustomer(customerId);
  }
  private async requiredPackage(id: DocumentPackageId) {
    const v = await this.repo.findPackage(id);
    if (!v)
      throw new PreparationError(
        'DOCUMENT_PACKAGE_NOT_FOUND',
        'Document Package was not found.',
        404
      );
    return v;
  }
  private mutable(p: DocumentPackage) {
    if (['LOCKED_FOR_PREPARATION', 'WITHDRAWN'].includes(p.status))
      throw new PreparationError('PACKAGE_IMMUTABLE', 'The Document Package cannot be changed.');
  }
  async addDocument(
    id: DocumentPackageId,
    input: {
      requirementCode: DocumentRequirementCode;
      documentType: string;
      documentReference: DocumentReference;
      suppliedBy: MarkOrbitId;
    }
  ) {
    const p = await this.requiredPackage(id);
    this.mutable(p);
    if (!p.requirements.some((x) => x.code === input.requirementCode))
      throw new PreparationError(
        'REQUIREMENT_NOT_FOUND',
        'Document requirement was not derived by the server.',
        422
      );
    if (
      p.documentItems.some(
        (x) => x.requirementCode === input.requirementCode && x.status !== 'SUPERSEDED'
      )
    )
      throw new PreparationError(
        'DOCUMENT_REPLACEMENT_REQUIRES_SUPERSEDE',
        'Use the supersede action to replace a document.'
      );
    const at = this.now();
    const item: DocumentItem = {
      documentItemId: `document-item_${randomUUID()}`,
      documentPackageId: id,
      documentType: input.documentType,
      requirementCode: input.requirementCode,
      version: 1,
      status: 'PROVIDED',
      documentReference: structuredClone(input.documentReference),
      suppliedBy: input.suppliedBy,
      suppliedAt: at,
      validationChecks: [],
      createdAt: at,
      updatedAt: at
    };
    await this.repo.savePackage({
      ...p,
      version: p.version + 1,
      documentItems: [...p.documentItems, item],
      updatedAt: at
    });
    return item;
  }
  async supersedeDocument(
    id: DocumentPackageId,
    oldId: DocumentItemId,
    input: { documentType: string; documentReference: DocumentReference; suppliedBy: MarkOrbitId }
  ) {
    const p = await this.requiredPackage(id);
    this.mutable(p);
    const old = p.documentItems.find((x) => x.documentItemId === oldId);
    if (!old || old.status === 'SUPERSEDED')
      throw new PreparationError(
        'DOCUMENT_ITEM_NOT_CURRENT',
        'Current document item was not found.'
      );
    const at = this.now();
    const replacement: DocumentItem = {
      ...old,
      documentItemId: `document-item_${randomUUID()}`,
      documentType: input.documentType,
      documentReference: structuredClone(input.documentReference),
      suppliedBy: input.suppliedBy,
      suppliedAt: at,
      version: old.version + 1,
      status: 'PROVIDED',
      supersedesDocumentItemId: old.documentItemId,
      validationChecks: [],
      createdAt: at,
      updatedAt: at
    };
    await this.repo.savePackage({
      ...p,
      version: p.version + 1,
      documentItems: p.documentItems
        .map((x) =>
          x.documentItemId === oldId ? { ...x, status: 'SUPERSEDED' as const, updatedAt: at } : x
        )
        .concat(replacement),
      updatedAt: at
    });
    return replacement;
  }
  async updateDocument(
    id: DocumentPackageId,
    itemId: DocumentItemId,
    patch: {
      documentReference?: Partial<DocumentReference>;
      status?: DocumentItem['status'];
      reviewNote?: string;
    }
  ) {
    const p = await this.requiredPackage(id);
    this.mutable(p);
    const item = p.documentItems.find((x) => x.documentItemId === itemId);
    if (!item)
      throw new PreparationError('DOCUMENT_ITEM_NOT_FOUND', 'Document item was not found.', 404);
    if (item.status === 'SUPERSEDED')
      throw new PreparationError('DOCUMENT_ITEM_IMMUTABLE', 'Superseded documents are immutable.');
    const at = this.now();
    const updated = {
      ...item,
      ...patch,
      documentReference: { ...item.documentReference, ...patch.documentReference },
      updatedAt: at
    };
    await this.repo.savePackage({
      ...p,
      version: p.version + 1,
      documentItems: p.documentItems.map((x) => (x.documentItemId === itemId ? updated : x)),
      updatedAt: at
    });
    return updated;
  }
  async evaluate(id: DocumentPackageId) {
    const p = await this.requiredPackage(id);
    this.mutable(p);
    const at = this.now();
    const current = p.documentItems.filter(
      (x) => x.status !== 'SUPERSEDED' && x.status !== 'REJECTED'
    );
    const missing = p.requirements
      .filter((r) => !current.some((i) => i.requirementCode === r.code))
      .map((r) => r.code);
    const checks: DocumentValidationCheck[] = p.requirements.flatMap((r) => {
      const i = current.find((x) => x.requirementCode === r.code);
      return [
        this.check('REQUIRED_DOCUMENT_PRESENT', !!i, r.blocking, i?.documentItemId, at),
        this.check(
          'FILE_METADATA_PRESENT',
          !!i?.documentReference.fileName &&
            !!i.documentReference.contentType &&
            i.documentReference.byteSize > 0,
          r.blocking,
          i?.documentItemId,
          at
        ),
        this.check(
          'CHECKSUM_PRESENT',
          i ? !!i.documentReference.checksum : false,
          r.blocking,
          i?.documentItemId,
          at
        ),
        this.check(
          'LANGUAGE_IDENTIFIED',
          i ? (i.documentReference.language ? true : undefined) : false,
          r.blocking,
          i?.documentItemId,
          at
        )
      ];
    });
    checks.push(
      this.check('SOURCE_REVIEW_CURRENT', true, true, p.professionalReviewDecisionVersion, at),
      this.check('SOURCE_MATTER_DRAFT_CURRENT', true, true, p.matterDraftVersion, at),
      this.check('COMMERCIAL_SCOPE_UNCHANGED', true, true, p.customerConfirmationId, at)
    );
    const ready =
      !missing.length &&
      checks.every((x) => !x.blocking || ['PASS', 'NOT_APPLICABLE'].includes(x.status));
    const value: DocumentPackage = {
      ...p,
      version: p.version + 1,
      validationChecks: checks,
      missingRequirements: missing,
      status: ready ? 'READY_FOR_CUSTOMER_CONFIRMATION' : 'NEEDS_DOCUMENTS',
      updatedAt: at
    };
    await this.repo.savePackage(value);
    return value;
  }
  private check(
    code: DocumentValidationCheck['code'],
    pass: boolean | undefined,
    blocking: boolean,
    evidenceReference: string | undefined,
    at: string
  ): DocumentValidationCheck {
    return {
      code,
      status: pass === undefined ? 'UNKNOWN' : pass ? 'PASS' : 'FAIL',
      blocking,
      explanation: pass
        ? 'Recorded evidence satisfies this preparation check.'
        : 'Required preparation evidence is missing or unknown.',
      ...(evidenceReference ? { evidenceReference } : {}),
      checkedAt: at,
      source: 'MARKREG_PREPARATION_V1'
    };
  }
  async withdrawPackage(id: DocumentPackageId) {
    const p = await this.requiredPackage(id);
    if (p.status === 'LOCKED_FOR_PREPARATION')
      throw new PreparationError(
        'LOCKED_PACKAGE_IMMUTABLE',
        'A locked package requires lock invalidation outside this task.'
      );
    const v = { ...p, status: 'WITHDRAWN' as const, version: p.version + 1, updatedAt: this.now() };
    await this.repo.savePackage(v);
    return v;
  }
  async createLedger(packageId: DocumentPackageId) {
    const p = await this.requiredPackage(packageId);
    if (p.status === 'STALE' || p.status === 'WITHDRAWN')
      throw new PreparationError(
        'PACKAGE_NOT_ELIGIBLE',
        'Package is not eligible for instructions.'
      );
    const at = this.now();
    const v: CustomerInstructionLedger = {
      schemaVersion: 1,
      instructionLedgerId: `instruction-ledger_${randomUUID()}`,
      version: 1,
      documentPackageId: p.documentPackageId,
      documentPackageVersion: p.version,
      customerId: p.customerId,
      matterDraftId: p.matterDraftId,
      matterDraftVersion: p.matterDraftVersion,
      professionalReviewCaseId: p.professionalReviewCaseId,
      professionalReviewDecisionVersion: p.professionalReviewDecisionVersion,
      entries: [],
      acknowledgements: [],
      status: 'DRAFT',
      currentEffectiveInstructionSet: {},
      createdAt: at,
      updatedAt: at
    };
    await this.repo.createLedger(v);
    return v;
  }
  private async ledger(id: CustomerInstructionLedgerId) {
    const v = await this.repo.findLedger(id);
    if (!v)
      throw new PreparationError(
        'INSTRUCTION_LEDGER_NOT_FOUND',
        'Instruction Ledger was not found.',
        404
      );
    return v;
  }
  async getLedger(id: CustomerInstructionLedgerId) {
    return this.ledger(id);
  }
  async appendInstruction(
    id: CustomerInstructionLedgerId,
    input: {
      type: CustomerInstructionType;
      structuredValue: Record<string, unknown>;
      note?: string;
      evidence?: CustomerInstructionEntry['evidence'];
      supersedesInstructionEntryId?: CustomerInstructionEntryId;
    }
  ) {
    const l = await this.ledger(id);
    if (l.status !== 'DRAFT')
      throw new PreparationError(
        'LEDGER_IMMUTABLE',
        'Confirmed, stale, withdrawn, or locked ledgers are immutable.'
      );
    if (!Object.keys(input.structuredValue).length)
      throw new PreparationError(
        'STRUCTURED_VALUE_REQUIRED',
        'A structured instruction value is required.',
        422
      );
    if (
      input.supersedesInstructionEntryId &&
      !l.entries.some((x) => x.instructionEntryId === input.supersedesInstructionEntryId)
    )
      throw new PreparationError(
        'SUPERSEDED_INSTRUCTION_NOT_FOUND',
        'Superseded instruction was not found.'
      );
    const at = this.now();
    const e: CustomerInstructionEntry = {
      instructionEntryId: `instruction-entry_${randomUUID()}`,
      type: input.type,
      structuredValue: structuredClone(input.structuredValue),
      ...(input.note ? { note: input.note } : {}),
      status: 'PROPOSED',
      createdAt: at,
      evidence: structuredClone(input.evidence ?? []),
      ...(input.supersedesInstructionEntryId
        ? { supersedesInstructionEntryId: input.supersedesInstructionEntryId }
        : {})
    };
    const entries = l.entries
      .map((x) =>
        x.instructionEntryId === input.supersedesInstructionEntryId
          ? { ...x, status: 'SUPERSEDED' as const }
          : x
      )
      .concat(e);
    await this.repo.saveLedger({
      ...l,
      version: l.version + 1,
      entries,
      currentEffectiveInstructionSet: {
        ...l.currentEffectiveInstructionSet,
        [input.type]: e.instructionEntryId
      },
      updatedAt: at
    });
    return e;
  }
  async confirmInstruction(id: CustomerInstructionLedgerId, entryId: CustomerInstructionEntryId) {
    const l = await this.ledger(id);
    if (l.status !== 'DRAFT')
      throw new PreparationError('LEDGER_IMMUTABLE', 'Ledger is immutable.');
    const e = l.entries.find((x) => x.instructionEntryId === entryId);
    if (!e) throw new PreparationError('INSTRUCTION_NOT_FOUND', 'Instruction was not found.', 404);
    if (e.status !== 'PROPOSED')
      throw new PreparationError(
        'INSTRUCTION_IMMUTABLE',
        'Only proposed instructions can be confirmed.'
      );
    const at = this.now();
    const value = {
      ...l,
      version: l.version + 1,
      entries: l.entries.map((x) =>
        x.instructionEntryId === entryId
          ? { ...x, status: 'CONFIRMED' as const, confirmedAt: at }
          : x
      ),
      updatedAt: at
    };
    await this.repo.saveLedger(value);
    return value;
  }
  async confirmLedger(
    id: CustomerInstructionLedgerId,
    acknowledgements: CustomerInstructionAcknowledgement[]
  ) {
    const l = await this.ledger(id);
    if (l.status !== 'DRAFT')
      throw new PreparationError('LEDGER_IMMUTABLE', 'Ledger is immutable.');
    const required = [
      'APPLICANT_OWNER',
      'MARK_REPRESENTATION',
      'SCOPE',
      'DOCUMENT_USE',
      'NO_SUBMISSION',
      'CHANGE_REVIEW_OR_QUOTE'
    ];
    if (required.some((code) => !acknowledgements.some((x) => x.code === code && x.acknowledged)))
      throw new PreparationError(
        'ACKNOWLEDGEMENTS_REQUIRED',
        'Every acknowledgement must be actively selected.',
        422
      );
    if (!l.entries.length || l.entries.some((x) => x.status === 'PROPOSED'))
      throw new PreparationError(
        'INSTRUCTIONS_INCOMPLETE',
        'Every current instruction must be confirmed.'
      );
    const at = this.now();
    const v = {
      ...l,
      version: l.version + 1,
      acknowledgements: structuredClone(acknowledgements),
      status: 'CONFIRMED' as const,
      confirmedAt: at,
      updatedAt: at
    };
    await this.repo.saveLedger(v);
    return { instructionLedger: v, consequences: noPreparationAuthorityConsequences };
  }
  async withdrawLedger(id: CustomerInstructionLedgerId) {
    const l = await this.ledger(id);
    if (l.status === 'LOCKED_FOR_PREPARATION')
      throw new PreparationError('LOCKED_LEDGER_IMMUTABLE', 'Locked ledger is immutable.');
    const v = { ...l, version: l.version + 1, status: 'WITHDRAWN' as const, updatedAt: this.now() };
    await this.repo.saveLedger(v);
    return v;
  }
  async lock(packageId: DocumentPackageId, ledgerId: CustomerInstructionLedgerId) {
    const p = await this.requiredPackage(packageId),
      l = await this.ledger(ledgerId);
    if (p.status !== 'READY_FOR_CUSTOMER_CONFIRMATION')
      throw new PreparationError('DOCUMENTS_NOT_READY', 'All blocking document checks must pass.');
    if (l.status !== 'CONFIRMED')
      throw new PreparationError(
        'INSTRUCTIONS_NOT_CONFIRMED',
        'Instruction Ledger must be confirmed.'
      );
    if (l.documentPackageId !== p.documentPackageId || l.documentPackageVersion > p.version)
      throw new PreparationError(
        'LEDGER_PACKAGE_MISMATCH',
        'Ledger does not reference this package lineage.'
      );
    const at = this.now();
    const lockedP = {
      ...p,
      status: 'LOCKED_FOR_PREPARATION' as const,
      version: p.version + 1,
      lockedAt: at,
      updatedAt: at
    };
    const lockedL = {
      ...l,
      status: 'LOCKED_FOR_PREPARATION' as const,
      version: l.version + 1,
      lockedAt: at,
      updatedAt: at
    };
    const value: PreparationLock = {
      schemaVersion: 1,
      preparationLockId: `preparation-lock_${randomUUID()}`,
      documentPackageId: lockedP.documentPackageId,
      documentPackageVersion: lockedP.version,
      instructionLedgerId: lockedL.instructionLedgerId,
      instructionLedgerVersion: lockedL.version,
      lockedAt: at,
      snapshot: {
        documentPackage: structuredClone(lockedP),
        instructionLedger: structuredClone(lockedL),
        sourceReviewDecisionVersion: p.professionalReviewDecisionVersion,
        sourceMatterDraftVersion: p.matterDraftVersion,
        commercialScopeUnchanged: true
      },
      nextPermittedAction: 'GOVERNED_FILING_AUTHORITY_REVIEW',
      consequences: noPreparationAuthorityConsequences
    };
    await this.repo.savePackage(lockedP);
    await this.repo.saveLedger(lockedL);
    await this.repo.createLock(value);
    return structuredClone(value);
  }
  async getLock(id: PreparationLockId) {
    const v = await this.repo.findLock(id);
    if (!v)
      throw new PreparationError(
        'PREPARATION_LOCK_NOT_FOUND',
        'Preparation Lock was not found.',
        404
      );
    return v;
  }
}
