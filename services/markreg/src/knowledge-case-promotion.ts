import { createHash, timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type FormalMatter,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';
import type { FormalMatterRepository } from './formal-matter.js';

export const KNOWLEDGE_CASE_CLASSIFICATIONS = [
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED'
] as const;
export type KnowledgeCaseClassification = (typeof KNOWLEDGE_CASE_CLASSIFICATIONS)[number];

export type KnowledgeCaseCandidateV1 = {
  protocolVersion: '1.0';
  objectType: 'CASE_CANDIDATE';
  candidateId: string;
  sourceSystem: 'MARKREG';
  sourceMatterId: string;
  sourceMatterVersion: number;
  sourceSnapshotSha256: string;
  sourceRetrievalRef: string;
  promotedBy: string;
  promotedAt: string;
  operatorCaseValueNote?: string;
  accessScope: {
    sourceWorkspaceId: string;
    classification: KnowledgeCaseClassification;
  };
  idempotencyKey: string;
};

export type KnowledgeCaseIntakeV1 = {
  protocolVersion: '1.0';
  objectType: 'CASE_CANDIDATE_INTAKE';
  candidateId: string;
  sourceIdentitySha256: string;
  collectionState: 'PENDING' | 'WAITING_SOURCE' | 'COLLECTED';
  acceptedAt: string;
  updatedAt: string;
  sourceUnavailable?: {
    code: string;
    message: string;
    observedAt: string;
    retryable: true;
  };
  collectionRef?: string;
  collectedAt?: string;
};

export type KnowledgeCaseIntakeReceiptV1 = {
  candidate: KnowledgeCaseCandidateV1;
  intake: KnowledgeCaseIntakeV1;
};

export type KnowledgeCasePromotionState =
  | 'CLAIMED'
  | 'DISPATCHING'
  | 'COMPLETED'
  | 'RECONCILIATION_REQUIRED';

export type KnowledgeCasePromotionRecord = {
  producerPromotionRef: string;
  workspaceId: string;
  sourceIdentitySha256: string;
  requestFingerprintSha256: string;
  candidate: KnowledgeCaseCandidateV1;
  state: KnowledgeCasePromotionState;
  receipt?: KnowledgeCaseIntakeReceiptV1;
  reconciliationReason?: string;
  createdAt: string;
  updatedAt: string;
  dispatchedAt?: string;
  completedAt?: string;
};

export type KnowledgeCasePromotionClaim = {
  acquired: boolean;
  record: KnowledgeCasePromotionRecord;
};

export interface KnowledgeCasePromotionRepository {
  claim(input: {
    record: KnowledgeCasePromotionRecord;
    idempotencyKey: string;
  }): Promise<KnowledgeCasePromotionClaim>;
  markDispatching(producerPromotionRef: string, at: string): Promise<KnowledgeCasePromotionRecord>;
  markCompleted(
    producerPromotionRef: string,
    receipt: KnowledgeCaseIntakeReceiptV1,
    at: string
  ): Promise<KnowledgeCasePromotionRecord>;
  markReconciliationRequired(
    producerPromotionRef: string,
    reason: string,
    at: string
  ): Promise<KnowledgeCasePromotionRecord>;
}

export interface KnowledgeCaseIntakeClient {
  accept(candidate: KnowledgeCaseCandidateV1): Promise<KnowledgeCaseIntakeReceiptV1>;
}

export type KnowledgeCasePromotionErrorCode =
  | 'INVALID_KNOWLEDGE_CASE_PROMOTION'
  | 'AUTHENTICATION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'FORMAL_MATTER_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SOURCE_PROMOTION_CONFLICT'
  | 'PROMOTION_IN_PROGRESS'
  | 'KNOWLEDGE_INTAKE_RECONCILIATION_REQUIRED'
  | 'PERSISTENCE_UNAVAILABLE';

export class KnowledgeCasePromotionError extends Error {
  constructor(
    readonly code: KnowledgeCasePromotionErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'KnowledgeCasePromotionError';
  }
}

const clone = <T>(value: T): T => structuredClone(value);
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const timestamp = (value: unknown): value is string =>
  nonEmpty(value) && !Number.isNaN(Date.parse(value));

export function canonicalKnowledgeCaseJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalKnowledgeCaseJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalKnowledgeCaseJson(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

export function knowledgeCaseSourceIdentityKey(input: {
  workspaceId: string;
  formalMatterId: string;
  formalMatterVersion: number;
  snapshotSha256: string;
}): string {
  return [
    '1.0',
    'MARKREG',
    input.workspaceId.trim().toLowerCase(),
    input.formalMatterId,
    String(input.formalMatterVersion),
    input.snapshotSha256
  ].join('\u001f');
}

export function knowledgeCaseSourceIdentitySha256(input: {
  workspaceId: string;
  formalMatterId: string;
  formalMatterVersion: number;
  snapshotSha256: string;
}): string {
  return sha256(knowledgeCaseSourceIdentityKey(input));
}

function assertPromotionInput(value: unknown): {
  classification: KnowledgeCaseClassification;
  operatorCaseValueNote?: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new KnowledgeCasePromotionError(
      'INVALID_KNOWLEDGE_CASE_PROMOTION',
      'A Knowledge Case promotion body is required.'
    );
  const body = value as Record<string, unknown>;
  if (!Object.keys(body).every((key) => ['classification', 'operatorCaseValueNote'].includes(key)))
    throw new KnowledgeCasePromotionError(
      'INVALID_KNOWLEDGE_CASE_PROMOTION',
      'Knowledge Case promotion contains unsupported fields.'
    );
  if (!KNOWLEDGE_CASE_CLASSIFICATIONS.includes(body.classification as KnowledgeCaseClassification))
    throw new KnowledgeCasePromotionError(
      'INVALID_KNOWLEDGE_CASE_PROMOTION',
      'classification must be INTERNAL, CONFIDENTIAL, or RESTRICTED.'
    );
  if (body.operatorCaseValueNote !== undefined && !nonEmpty(body.operatorCaseValueNote))
    throw new KnowledgeCasePromotionError(
      'INVALID_KNOWLEDGE_CASE_PROMOTION',
      'operatorCaseValueNote must be non-empty when supplied.'
    );
  return {
    classification: body.classification as KnowledgeCaseClassification,
    ...(body.operatorCaseValueNote !== undefined
      ? { operatorCaseValueNote: String(body.operatorCaseValueNote).trim() }
      : {})
  };
}

function assertIdempotencyKey(value: string | undefined): string {
  if (!value || value.length < 8 || value.length > 200)
    throw new KnowledgeCasePromotionError(
      'INVALID_KNOWLEDGE_CASE_PROMOTION',
      'idempotency-key must contain between 8 and 200 characters.'
    );
  return value;
}

function assertPrincipal(principal: WorkspacePrincipal, workspaceId: string): void {
  if (principal.kind !== 'WORKSPACE')
    throw new KnowledgeCasePromotionError(
      'AUTHENTICATION_REQUIRED',
      'A Workspace Principal is required.'
    );
  if (principal.workspaceId !== workspaceId)
    throw new KnowledgeCasePromotionError(
      'PERMISSION_DENIED',
      'Workspace context does not match the Formal Matter.'
    );
  if (!principal.permissions.includes('matter:promote-knowledge'))
    throw new KnowledgeCasePromotionError(
      'PERMISSION_DENIED',
      'matter:promote-knowledge permission is required.'
    );
}

function isCandidate(value: unknown): value is KnowledgeCaseCandidateV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const access = item.accessScope as Record<string, unknown> | undefined;
  return (
    item.protocolVersion === '1.0' &&
    item.objectType === 'CASE_CANDIDATE' &&
    typeof item.candidateId === 'string' &&
    /^case-candidate_[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/u.test(item.candidateId) &&
    item.sourceSystem === 'MARKREG' &&
    typeof item.sourceMatterId === 'string' &&
    /^formal-matter_[a-zA-Z0-9][a-zA-Z0-9._:-]{2,255}$/u.test(item.sourceMatterId) &&
    typeof item.sourceMatterVersion === 'number' &&
    Number.isSafeInteger(item.sourceMatterVersion) &&
    item.sourceMatterVersion >= 1 &&
    typeof item.sourceSnapshotSha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(item.sourceSnapshotSha256) &&
    nonEmpty(item.sourceRetrievalRef) &&
    nonEmpty(item.promotedBy) &&
    timestamp(item.promotedAt) &&
    (item.operatorCaseValueNote === undefined || nonEmpty(item.operatorCaseValueNote)) &&
    access !== undefined &&
    nonEmpty(access.sourceWorkspaceId) &&
    KNOWLEDGE_CASE_CLASSIFICATIONS.includes(access.classification as KnowledgeCaseClassification) &&
    nonEmpty(item.idempotencyKey) &&
    String(item.idempotencyKey).length >= 8 &&
    String(item.idempotencyKey).length <= 200
  );
}

function isIntake(value: unknown): value is KnowledgeCaseIntakeV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (
    item.protocolVersion !== '1.0' ||
    item.objectType !== 'CASE_CANDIDATE_INTAKE' ||
    !nonEmpty(item.candidateId) ||
    typeof item.sourceIdentitySha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(item.sourceIdentitySha256) ||
    !['PENDING', 'WAITING_SOURCE', 'COLLECTED'].includes(String(item.collectionState)) ||
    !timestamp(item.acceptedAt) ||
    !timestamp(item.updatedAt)
  )
    return false;
  if (item.collectionState === 'WAITING_SOURCE') {
    const unavailable = item.sourceUnavailable as Record<string, unknown> | undefined;
    return Boolean(
      unavailable &&
        nonEmpty(unavailable.code) &&
        nonEmpty(unavailable.message) &&
        timestamp(unavailable.observedAt) &&
        unavailable.retryable === true &&
        item.collectionRef === undefined &&
        item.collectedAt === undefined
    );
  }
  if (item.collectionState === 'COLLECTED')
    return (
      item.sourceUnavailable === undefined &&
      nonEmpty(item.collectionRef) &&
      timestamp(item.collectedAt)
    );
  return (
    item.sourceUnavailable === undefined &&
    item.collectionRef === undefined &&
    item.collectedAt === undefined
  );
}

export function isKnowledgeCaseIntakeReceiptV1(value: unknown): value is KnowledgeCaseIntakeReceiptV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return isCandidate(item.candidate) && isIntake(item.intake);
}

export class HttpKnowledgeCaseIntakeClient implements KnowledgeCaseIntakeClient {
  private readonly endpoint: string;
  constructor(
    baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    const trimmed = baseUrl.trim().replace(/\/+$/u, '');
    if (!/^https?:\/\//u.test(trimmed)) throw new TypeError('Knowledge base URL must use HTTP(S).');
    this.endpoint = `${trimmed}/api/case-candidates`;
  }

  async accept(candidate: KnowledgeCaseCandidateV1): Promise<KnowledgeCaseIntakeReceiptV1> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(candidate)
      });
    } catch (cause) {
      throw new Error('Knowledge Case intake delivery is uncertain.', {
        cause: cause instanceof Error ? cause : undefined
      });
    }
    if (response.status !== 202)
      throw new Error(`Knowledge Case intake returned unexpected HTTP ${response.status}.`);
    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new Error('Knowledge Case intake returned invalid JSON.', {
        cause: cause instanceof Error ? cause : undefined
      });
    }
    if (!isKnowledgeCaseIntakeReceiptV1(body))
      throw new Error('Knowledge Case intake returned an invalid receipt.');
    if (canonicalKnowledgeCaseJson(body.candidate) !== canonicalKnowledgeCaseJson(candidate))
      throw new Error('Knowledge Case intake receipt does not match the promoted candidate.');
    const expectedSourceIdentity = knowledgeCaseSourceIdentitySha256({
      workspaceId: candidate.accessScope.sourceWorkspaceId,
      formalMatterId: candidate.sourceMatterId,
      formalMatterVersion: candidate.sourceMatterVersion,
      snapshotSha256: candidate.sourceSnapshotSha256
    });
    if (
      body.intake.candidateId !== candidate.candidateId ||
      body.intake.sourceIdentitySha256 !== expectedSourceIdentity
    )
      throw new Error('Knowledge Case intake receipt source identity does not match the candidate.');
    return clone(body);
  }
}

export class InMemoryKnowledgeCasePromotionRepository implements KnowledgeCasePromotionRepository {
  private readonly promotions = new Map<string, KnowledgeCasePromotionRecord>();
  private readonly commands = new Map<
    string,
    { requestFingerprintSha256: string; producerPromotionRef: string }
  >();
  private readonly sources = new Map<string, string>();
  private chain: Promise<void> = Promise.resolve();

  async claim(input: {
    record: KnowledgeCasePromotionRecord;
    idempotencyKey: string;
  }): Promise<KnowledgeCasePromotionClaim> {
    let result!: KnowledgeCasePromotionClaim;
    const work = this.chain.then(() => {
      const commandKey = `${input.record.workspaceId}:${input.idempotencyKey}`;
      const prior = this.commands.get(commandKey);
      if (prior) {
        if (prior.requestFingerprintSha256 !== input.record.requestFingerprintSha256)
          throw new KnowledgeCasePromotionError(
            'IDEMPOTENCY_CONFLICT',
            'Knowledge Case promotion idempotency key has conflicting input.'
          );
        result = { acquired: false, record: clone(this.require(prior.producerPromotionRef)) };
        return;
      }
      const sourceKey = `${input.record.workspaceId}:${input.record.sourceIdentitySha256}`;
      const sourceRef = this.sources.get(sourceKey);
      if (sourceRef) {
        const existing = this.require(sourceRef);
        if (existing.requestFingerprintSha256 !== input.record.requestFingerprintSha256)
          throw new KnowledgeCasePromotionError(
            'SOURCE_PROMOTION_CONFLICT',
            'The exact Formal Matter snapshot already has different Knowledge promotion semantics.'
          );
        this.commands.set(commandKey, {
          requestFingerprintSha256: input.record.requestFingerprintSha256,
          producerPromotionRef: existing.producerPromotionRef
        });
        result = { acquired: false, record: clone(existing) };
        return;
      }
      this.promotions.set(input.record.producerPromotionRef, clone(input.record));
      this.sources.set(sourceKey, input.record.producerPromotionRef);
      this.commands.set(commandKey, {
        requestFingerprintSha256: input.record.requestFingerprintSha256,
        producerPromotionRef: input.record.producerPromotionRef
      });
      result = { acquired: true, record: clone(input.record) };
    });
    this.chain = work.then(
      () => undefined,
      () => undefined
    );
    await work;
    return result;
  }

  markDispatching(ref: string, at: string): Promise<KnowledgeCasePromotionRecord> {
    const record = this.require(ref);
    if (record.state !== 'CLAIMED')
      throw new KnowledgeCasePromotionError(
        'PROMOTION_IN_PROGRESS',
        'Knowledge Case promotion is not claimable for dispatch.'
      );
    return Promise.resolve(this.save(ref, { ...record, state: 'DISPATCHING', dispatchedAt: at, updatedAt: at }));
  }

  markCompleted(
    ref: string,
    receipt: KnowledgeCaseIntakeReceiptV1,
    at: string
  ): Promise<KnowledgeCasePromotionRecord> {
    const record = this.require(ref);
    if (record.state !== 'DISPATCHING')
      throw new KnowledgeCasePromotionError(
        'PROMOTION_IN_PROGRESS',
        'Knowledge Case promotion is not dispatching.'
      );
    return Promise.resolve(
      this.save(ref, { ...record, state: 'COMPLETED', receipt: clone(receipt), completedAt: at, updatedAt: at })
    );
  }

  markReconciliationRequired(
    ref: string,
    reason: string,
    at: string
  ): Promise<KnowledgeCasePromotionRecord> {
    const record = this.require(ref);
    return Promise.resolve(
      this.save(ref, {
        ...record,
        state: 'RECONCILIATION_REQUIRED',
        reconciliationReason: reason,
        updatedAt: at
      })
    );
  }

  private require(ref: string): KnowledgeCasePromotionRecord {
    const record = this.promotions.get(ref);
    if (!record)
      throw new KnowledgeCasePromotionError(
        'PERSISTENCE_UNAVAILABLE',
        'Knowledge Case promotion record is unavailable.',
        true
      );
    return record;
  }

  private save(ref: string, record: KnowledgeCasePromotionRecord): KnowledgeCasePromotionRecord {
    this.promotions.set(ref, clone(record));
    return clone(record);
  }
}

export class KnowledgeCasePromotionService {
  constructor(
    private readonly formalMatters: FormalMatterRepository,
    private readonly promotions: KnowledgeCasePromotionRepository,
    private readonly intake: KnowledgeCaseIntakeClient,
    private readonly now = () => new Date().toISOString()
  ) {}

  async promote(
    principal: WorkspacePrincipal,
    formalMatterId: string,
    idempotencyKeyValue: string | undefined,
    rawInput: unknown
  ) {
    const idempotencyKey = assertIdempotencyKey(idempotencyKeyValue);
    const input = assertPromotionInput(rawInput);
    assertPrincipal(principal, principal.workspaceId);
    const matter = await this.formalMatters.findById(principal.workspaceId, formalMatterId);
    if (!matter)
      throw new KnowledgeCasePromotionError(
        'FORMAL_MATTER_NOT_FOUND',
        'Formal Matter was not found in this Workspace.'
      );
    assertPrincipal(principal, matter.workspaceId);
    return this.promoteMatter(principal, matter, idempotencyKey, input);
  }

  private async promoteMatter(
    principal: WorkspacePrincipal,
    matter: FormalMatter,
    idempotencyKey: string,
    input: { classification: KnowledgeCaseClassification; operatorCaseValueNote?: string }
  ) {
    const sourceIdentitySha256 = knowledgeCaseSourceIdentitySha256({
      workspaceId: matter.workspaceId,
      formalMatterId: matter.formalMatterId,
      formalMatterVersion: matter.version,
      snapshotSha256: matter.snapshotSha256
    });
    const sourceRetrievalRef = `markreg:case-source:v1:${sourceIdentitySha256}`;
    const producerPromotionRef = `markreg:case-promotion:v1:${sourceIdentitySha256}`;
    const requestFingerprintSha256 = sha256(
      canonicalKnowledgeCaseJson({
        sourceIdentitySha256,
        sourceRetrievalRef,
        classification: input.classification,
        operatorCaseValueNote: input.operatorCaseValueNote ?? null
      })
    );
    const promotedAt = this.now();
    const candidate: KnowledgeCaseCandidateV1 = {
      protocolVersion: '1.0',
      objectType: 'CASE_CANDIDATE',
      candidateId: `case-candidate_${sourceIdentitySha256}`,
      sourceSystem: 'MARKREG',
      sourceMatterId: matter.formalMatterId,
      sourceMatterVersion: matter.version,
      sourceSnapshotSha256: matter.snapshotSha256,
      sourceRetrievalRef,
      promotedBy: principal.userId,
      promotedAt,
      ...(input.operatorCaseValueNote ? { operatorCaseValueNote: input.operatorCaseValueNote } : {}),
      accessScope: {
        sourceWorkspaceId: matter.workspaceId,
        classification: input.classification
      },
      idempotencyKey
    };
    const claim = await this.promotions.claim({
      idempotencyKey,
      record: {
        producerPromotionRef,
        workspaceId: matter.workspaceId,
        sourceIdentitySha256,
        requestFingerprintSha256,
        candidate,
        state: 'CLAIMED',
        createdAt: promotedAt,
        updatedAt: promotedAt
      }
    });
    if (!claim.acquired) return this.resolveExisting(claim.record);

    const dispatchAt = this.now();
    await this.promotions.markDispatching(producerPromotionRef, dispatchAt);
    let receipt: KnowledgeCaseIntakeReceiptV1;
    try {
      receipt = await this.intake.accept(candidate);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'Knowledge Case intake delivery is uncertain.';
      try {
        await this.promotions.markReconciliationRequired(producerPromotionRef, reason, this.now());
      } catch (persistenceCause) {
        throw new KnowledgeCasePromotionError(
          'PERSISTENCE_UNAVAILABLE',
          'Knowledge Case promotion entered dispatch but reconciliation state could not be persisted.',
          true,
          { cause: persistenceCause instanceof Error ? persistenceCause : undefined }
        );
      }
      throw new KnowledgeCasePromotionError(
        'KNOWLEDGE_INTAKE_RECONCILIATION_REQUIRED',
        'Knowledge Case intake was not safely finalized; reconciliation is required before any retry.',
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const completed = await this.promotions.markCompleted(producerPromotionRef, receipt, this.now());
    return this.result(completed, false);
  }

  private resolveExisting(record: KnowledgeCasePromotionRecord) {
    if (record.state === 'COMPLETED' && record.receipt) return this.result(record, true);
    if (record.state === 'RECONCILIATION_REQUIRED')
      throw new KnowledgeCasePromotionError(
        'KNOWLEDGE_INTAKE_RECONCILIATION_REQUIRED',
        'This Knowledge Case promotion requires reconciliation before any retry.'
      );
    throw new KnowledgeCasePromotionError(
      'PROMOTION_IN_PROGRESS',
      'This Knowledge Case promotion already has an active durable claim.',
      true
    );
  }

  private result(record: KnowledgeCasePromotionRecord, replayed: boolean) {
    if (!record.receipt)
      throw new KnowledgeCasePromotionError(
        'PERSISTENCE_UNAVAILABLE',
        'Completed Knowledge Case promotion is missing its intake receipt.',
        true
      );
    return {
      producerPromotionRef: record.producerPromotionRef,
      candidate: clone(record.receipt.candidate),
      intake: clone(record.receipt.intake),
      delivery: { state: 'ACCEPTED' as const, replayed }
    };
  }
}

function authorized(secret: string, supplied: string | undefined): boolean {
  if (!supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function routeError(error: unknown): never {
  if (error instanceof KnowledgeCasePromotionError) {
    const status =
      error.code === 'AUTHENTICATION_REQUIRED'
        ? 401
        : error.code === 'PERMISSION_DENIED'
          ? 403
          : error.code === 'FORMAL_MATTER_NOT_FOUND'
            ? 404
            : error.code === 'INVALID_KNOWLEDGE_CASE_PROMOTION'
              ? 400
              : error.code === 'PERSISTENCE_UNAVAILABLE'
                ? 503
                : error.code === 'KNOWLEDGE_INTAKE_RECONCILIATION_REQUIRED'
                  ? 503
                  : 409;
    throw new HttpError(status, error.code, error.message, error.retryable);
  }
  throw error;
}

export function createKnowledgeCasePromotionRoutes(options: {
  internalServiceSecret: string;
  formalMatterRepository: FormalMatterRepository;
  promotionRepository: KnowledgeCasePromotionRepository;
  intakeClient: KnowledgeCaseIntakeClient;
  now?: () => string;
}): readonly JsonRoute[] {
  if (Buffer.byteLength(options.internalServiceSecret, 'utf8') < 32)
    throw new TypeError('Knowledge Case promotion internal service secret must be at least 32 bytes.');
  const service = new KnowledgeCasePromotionService(
    options.formalMatterRepository,
    options.promotionRepository,
    options.intakeClient,
    options.now
  );
  return [
    {
      method: 'POST',
      path: '/v1/formal-matters/:formalMatterId/knowledge-case-promotions',
      handle: async (request) => {
        if (
          !authorized(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'INTERNAL_SERVICE_UNAUTHORIZED',
            'Internal service authentication is required.'
          );
        let principal: WorkspacePrincipal;
        try {
          principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
        } catch (error) {
          if (error instanceof AuthenticationError)
            throw new HttpError(401, error.code, error.message, false);
          throw error;
        }
        try {
          const result = await service.promote(
            principal,
            request.params.formalMatterId ?? '',
            request.headers['idempotency-key'],
            request.body
          );
          return json(result.delivery.replayed ? 200 : 202, result);
        } catch (error) {
          return routeError(error);
        }
      }
    }
  ];
}
