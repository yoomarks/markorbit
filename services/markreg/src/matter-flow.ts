import { createHash, randomUUID } from 'node:crypto';
import type {
  ActorContext,
  ConfirmationAcknowledgement,
  CustomerConfirmation,
  CustomerConfirmationId,
  MatterDraft,
  MatterDraftId,
  MatterDraftPreparation,
  MatterReadiness,
  MatterReadinessCheck,
  MarkOrbitId,
  Quote
} from '@markorbit/contracts';
import { noAutomaticConsequences } from '@markorbit/contracts';

export class MatterFlowError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409
  ) {
    super(message);
  }
}
export interface ConfirmQuoteCommand {
  quoteId: MarkOrbitId;
  quoteVersion: string;
  planId: MarkOrbitId;
  planVersion: string;
  customerId: MarkOrbitId;
  termsVersion: string;
  acknowledgements: ConfirmationAcknowledgement[];
  actor: ActorContext;
  idempotencyKey: string;
}
export interface ConfirmationResult {
  confirmation: CustomerConfirmation;
  nextAction: 'PREPARE_MATTER_DRAFT' | 'NONE';
  consequences: typeof noAutomaticConsequences;
}
export interface MatterDraftResult {
  matterDraft: MatterDraft;
  nextAction: 'COMPLETE_REQUIRED_INFORMATION' | 'PROFESSIONAL_REVIEW' | 'NONE';
  consequences: typeof noAutomaticConsequences;
}
interface IdempotentConfirmation {
  fingerprint: string;
  value: CustomerConfirmation;
}
export interface MatterFlowRepository {
  createConfirmation(key: string, fingerprint: string, value: CustomerConfirmation): Promise<void>;
  getConfirmation(id: CustomerConfirmationId): Promise<CustomerConfirmation | undefined>;
  findConfirmationByIdempotencyKey(key: string): Promise<IdempotentConfirmation | undefined>;
  withdrawConfirmation(id: CustomerConfirmationId, at: string): Promise<CustomerConfirmation>;
  createMatterDraft(value: MatterDraft): Promise<void>;
  getMatterDraft(id: MatterDraftId): Promise<MatterDraft | undefined>;
  updateMatterDraft(value: MatterDraft): Promise<void>;
}
export class InMemoryMatterFlowRepository implements MatterFlowRepository {
  private readonly confirmations = new Map<CustomerConfirmationId, CustomerConfirmation>();
  private readonly keys = new Map<string, IdempotentConfirmation>();
  private readonly drafts = new Map<MatterDraftId, MatterDraft>();
  createConfirmation(key: string, fingerprint: string, value: CustomerConfirmation) {
    this.confirmations.set(value.confirmationId, structuredClone(value));
    this.keys.set(key, { fingerprint, value: structuredClone(value) });
    return Promise.resolve();
  }
  getConfirmation(id: CustomerConfirmationId) {
    const value = this.confirmations.get(id);
    return Promise.resolve(value && structuredClone(value));
  }
  findConfirmationByIdempotencyKey(key: string) {
    const value = this.keys.get(key);
    return Promise.resolve(value && structuredClone(value));
  }
  withdrawConfirmation(id: CustomerConfirmationId, at: string) {
    const value = this.confirmations.get(id);
    if (!value)
      throw new MatterFlowError('CONFIRMATION_NOT_FOUND', 'Confirmation was not found.', 404);
    if (value.status === 'WITHDRAWN') return Promise.resolve(structuredClone(value));
    const withdrawn = { ...value, status: 'WITHDRAWN' as const, updatedAt: at };
    this.confirmations.set(id, withdrawn);
    return Promise.resolve(structuredClone(withdrawn));
  }
  createMatterDraft(value: MatterDraft) {
    this.drafts.set(value.matterDraftId, structuredClone(value));
    return Promise.resolve();
  }
  getMatterDraft(id: MatterDraftId) {
    const value = this.drafts.get(id);
    return Promise.resolve(value && structuredClone(value));
  }
  updateMatterDraft(value: MatterDraft) {
    this.drafts.set(value.matterDraftId, structuredClone(value));
    return Promise.resolve();
  }
  snapshotMatterDrafts() {
    return [...this.drafts.values()].map((value) => structuredClone(value));
  }
  snapshotIdempotencyCount() {
    return this.keys.size;
  }
}
const requiredAcknowledgements = [
  'NO_FILING',
  'NO_PROFESSIONAL_APPOINTMENT',
  'REVIEW_MAY_BE_REQUIRED',
  'SCOPE_CHANGE_REQUOTE'
] as const;
export class MatterFlowService {
  constructor(
    private readonly repository: MatterFlowRepository,
    private readonly loadQuote: (id: MarkOrbitId) => Promise<Quote | undefined>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}
  async confirm(command: ConfirmQuoteCommand): Promise<ConfirmationResult> {
    const fingerprint = createHash('sha256').update(JSON.stringify(command)).digest('hex');
    const prior = await this.repository.findConfirmationByIdempotencyKey(command.idempotencyKey);
    if (prior?.fingerprint !== undefined && prior.fingerprint !== fingerprint)
      throw new MatterFlowError('IDEMPOTENCY_CONFLICT', 'Idempotency key has a different payload.');
    if (prior) return this.confirmationResult(prior.value);
    const quote = await this.loadQuote(command.quoteId);
    if (!quote) throw new MatterFlowError('QUOTE_NOT_FOUND', 'Quote was not found.', 404);
    if (command.quoteVersion !== quote.pricingRuleVersion)
      throw new MatterFlowError(
        'QUOTE_VERSION_MISMATCH',
        'The exact current Quote version is required.'
      );
    if (quote.status !== 'READY')
      throw new MatterFlowError('QUOTE_NOT_CONFIRMABLE', 'Only a READY Quote can be confirmed.');
    if (Date.parse(quote.validUntil) <= Date.parse(this.now()))
      throw new MatterFlowError('QUOTE_EXPIRED', 'The Quote is no longer current.');
    if (
      requiredAcknowledgements.some(
        (code) => !command.acknowledgements.some((item) => item.code === code && item.acknowledged)
      )
    )
      throw new MatterFlowError(
        'ACKNOWLEDGEMENTS_REQUIRED',
        'All governed acknowledgements are required.',
        422
      );
    const at = this.now();
    const confirmation: CustomerConfirmation = {
      schemaVersion: 1,
      confirmationId: `confirmation_${randomUUID()}`,
      customerId: command.customerId,
      quoteSnapshot: {
        quoteId: quote.quoteId,
        quoteVersion: command.quoteVersion,
        planId: command.planId,
        planVersion: command.planVersion,
        currency: quote.currency,
        totalMinor: quote.total.amountMinor,
        lineItems: structuredClone(quote.lines)
      },
      confirmedBy: command.actor.actorId,
      confirmedAt: at,
      termsVersion: command.termsVersion,
      acknowledgements: structuredClone(command.acknowledgements),
      status: 'CONFIRMED',
      createdAt: at,
      updatedAt: at
    };
    await this.repository.createConfirmation(command.idempotencyKey, fingerprint, confirmation);
    return this.confirmationResult(confirmation);
  }
  private confirmationResult(confirmation: CustomerConfirmation): ConfirmationResult {
    return {
      confirmation,
      nextAction: confirmation.status === 'CONFIRMED' ? 'PREPARE_MATTER_DRAFT' : 'NONE',
      consequences: noAutomaticConsequences
    };
  }
  async createDraft(confirmationId: CustomerConfirmationId): Promise<MatterDraftResult> {
    const confirmation = await this.repository.getConfirmation(confirmationId);
    if (!confirmation)
      throw new MatterFlowError('CONFIRMATION_NOT_FOUND', 'Confirmation was not found.', 404);
    if (confirmation.status === 'WITHDRAWN')
      throw new MatterFlowError(
        'CONFIRMATION_WITHDRAWN',
        'A withdrawn confirmation cannot prepare a Matter Draft.'
      );
    const at = this.now();
    const preparation: MatterDraftPreparation = { classes: [], documentReferences: [] };
    const readiness = evaluate(confirmation, preparation, at);
    const draft: MatterDraft = {
      schemaVersion: 1,
      matterDraftId: `matter-draft_${randomUUID()}`,
      confirmationId,
      customerId: confirmation.customerId,
      preparation,
      instructionCompleteness: 'INCOMPLETE',
      documentReadiness: 'MISSING',
      readiness,
      missingInformation: missing(readiness),
      status: 'NEEDS_INFORMATION',
      createdAt: at,
      updatedAt: at
    };
    await this.repository.createMatterDraft(draft);
    return result(draft);
  }
  async updateDraft(
    id: MatterDraftId,
    patch: Partial<MatterDraftPreparation>
  ): Promise<MatterDraftResult> {
    const draft = await this.repository.getMatterDraft(id);
    if (!draft)
      throw new MatterFlowError('MATTER_DRAFT_NOT_FOUND', 'Matter Draft was not found.', 404);
    if (draft.status === 'READY_FOR_PROFESSIONAL_REVIEW' || draft.status === 'WITHDRAWN')
      throw new MatterFlowError('MATTER_DRAFT_IMMUTABLE', 'This Matter Draft cannot be edited.');
    const confirmation = await this.repository.getConfirmation(draft.confirmationId);
    if (!confirmation)
      throw new MatterFlowError('CONFIRMATION_NOT_FOUND', 'Confirmation was not found.', 404);
    const preparation = { ...draft.preparation, ...structuredClone(patch) };
    const at = this.now(),
      readiness = evaluate(confirmation, preparation, at);
    const value: MatterDraft = {
      ...draft,
      preparation,
      readiness,
      missingInformation: missing(readiness),
      status: 'NEEDS_INFORMATION',
      updatedAt: at
    };
    await this.repository.updateMatterDraft(value);
    return result(value);
  }
  async evaluateReadiness(id: MatterDraftId): Promise<MatterDraftResult> {
    const draft = await this.repository.getMatterDraft(id);
    if (!draft)
      throw new MatterFlowError('MATTER_DRAFT_NOT_FOUND', 'Matter Draft was not found.', 404);
    const confirmation = await this.repository.getConfirmation(draft.confirmationId);
    if (!confirmation)
      throw new MatterFlowError('CONFIRMATION_NOT_FOUND', 'Confirmation was not found.', 404);
    const at = this.now(),
      readiness = evaluate(confirmation, draft.preparation, at);
    const value: MatterDraft = {
      ...draft,
      readiness,
      missingInformation: missing(readiness),
      instructionCompleteness: readiness.readyForProfessionalReview ? 'COMPLETE' : 'INCOMPLETE',
      documentReadiness: draft.preparation.documentReferences.length ? 'READY' : 'MISSING',
      status: readiness.readyForProfessionalReview
        ? 'READY_FOR_PROFESSIONAL_REVIEW'
        : 'NEEDS_INFORMATION',
      updatedAt: at
    };
    await this.repository.updateMatterDraft(value);
    return result(value);
  }
}
function check(
  code: MatterReadinessCheck['code'],
  pass: boolean | undefined,
  explanation: string,
  evidenceReference?: string
): MatterReadinessCheck {
  return {
    code,
    status: pass === undefined ? 'UNKNOWN' : pass ? 'PASS' : 'FAIL',
    explanation,
    ...(evidenceReference ? { evidenceReference } : {}),
    blocking: true
  };
}
function evaluate(c: CustomerConfirmation, p: MatterDraftPreparation, at: string): MatterReadiness {
  const checks: MatterReadinessCheck[] = [
    check(
      'CUSTOMER_CONFIRMATION_VALID',
      c.status === 'CONFIRMED',
      'Confirmation must remain confirmed.',
      c.confirmationId
    ),
    check('APPLICANT_IDENTITY_PRESENT', !!p.applicantName, 'Applicant identity is required.'),
    check('APPLICANT_ADDRESS_PRESENT', !!p.applicantAddress, 'Applicant address is required.'),
    check('MARK_REPRESENTATION_PRESENT', !!p.trademark, 'A mark representation is required.'),
    check('JURISDICTION_SELECTED', !!p.targetJurisdiction, 'A target jurisdiction is required.'),
    check('CLASS_SELECTION_PRESENT', p.classes.length > 0, 'At least one class is required.'),
    check('GOODS_SERVICES_PRESENT', !!p.goodsServices, 'Goods/services are required.'),
    check(
      'FILING_BASIS_PRESENT_OR_NOT_REQUIRED',
      p.filingBasis ? true : undefined,
      'Filing basis must be supplied or established as not applicable.'
    ),
    check(
      'REPRESENTATIVE_REQUIREMENT_EVALUATED',
      p.representativeRequired === undefined ? undefined : true,
      'Representative requirement must be evaluated.'
    ),
    check(
      'REQUIRED_DOCUMENTS_PRESENT',
      p.documentReferences.length > 0,
      'Required document evidence is needed.'
    ),
    check(
      'COMMERCIAL_SCOPE_UNCHANGED',
      p.commercialScopeUnchanged,
      'Commercial scope must match the confirmed snapshot.',
      c.quoteSnapshot.quoteId
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
function missing(r: MatterReadiness) {
  return r.checks
    .filter((x) => x.blocking && x.status !== 'PASS' && x.status !== 'NOT_APPLICABLE')
    .map((x) => x.code);
}
function result(matterDraft: MatterDraft): MatterDraftResult {
  return {
    matterDraft,
    nextAction:
      matterDraft.status === 'READY_FOR_PROFESSIONAL_REVIEW'
        ? 'PROFESSIONAL_REVIEW'
        : matterDraft.status === 'WITHDRAWN'
          ? 'NONE'
          : 'COMPLETE_REQUIRED_INFORMATION',
    consequences: noAutomaticConsequences
  };
}
