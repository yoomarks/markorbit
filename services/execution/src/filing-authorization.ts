/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- asynchronous clone-on-read fixture persistence and generic locked instruction values intentionally implement the production boundary. */
import { createHash, randomUUID } from 'node:crypto';
import type {
  AuthorizationCapacity,
  ExecutionRelease,
  ExecutionReleaseAssignment,
  ExecutionReleaseCheck,
  ExecutionReleaseId,
  FilingAuthorization,
  FilingAuthorizationAcknowledgementCode,
  FilingAuthorizationId,
  FilingAuthorizationScope,
  FilingExecutionChannel,
  FilingExecutionTaskDraft,
  FilingExecutionTaskDraftId,
  MarkOrbitId,
  PreparationLock,
  PreparationLockId
} from '@markorbit/contracts';
import { noAuthorizationAuthorityConsequences } from '@markorbit/contracts';

export class FilingGovernanceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409
  ) {
    super(message);
  }
}
type KeyEntry<T> = { fingerprint: string; id: T };
const clone = <T>(value: T): T => structuredClone(value);
const activeAuthorization = (v: FilingAuthorization) =>
  !['WITHDRAWN', 'STALE', 'EXPIRED'].includes(v.status);
const activeRelease = (v: ExecutionRelease) =>
  !['WITHDRAWN', 'STALE', 'RELEASED_FOR_EXECUTION'].includes(v.status);
export interface PreparationLockSource {
  getPreparationLock(id: PreparationLockId): Promise<PreparationLock | undefined>;
}
export interface FilingAuthorizationRepository {
  create(value: FilingAuthorization, key: string, fingerprint: string): Promise<void>;
  findById(id: FilingAuthorizationId): Promise<FilingAuthorization | undefined>;
  findActiveByPreparationLockVersion(
    id: PreparationLockId,
    version: string
  ): Promise<FilingAuthorization | undefined>;
  findByIdempotencyKey(key: string): Promise<KeyEntry<FilingAuthorizationId> | undefined>;
  confirm(value: FilingAuthorization, key: string, fingerprint: string): Promise<void>;
  withdraw(value: FilingAuthorization): Promise<void>;
  markStale(value: FilingAuthorization): Promise<void>;
  markExpired(value: FilingAuthorization): Promise<void>;
}
export interface ExecutionReleaseRepository {
  create(value: ExecutionRelease, key: string, fingerprint: string): Promise<void>;
  findById(id: ExecutionReleaseId): Promise<ExecutionRelease | undefined>;
  list(): Promise<ExecutionRelease[]>;
  findActiveByAuthorizationVersion(
    id: FilingAuthorizationId,
    version: number
  ): Promise<ExecutionRelease | undefined>;
  findByIdempotencyKey(key: string): Promise<KeyEntry<ExecutionReleaseId> | undefined>;
  evaluateChecks(value: ExecutionRelease): Promise<void>;
  updateAssignment(value: ExecutionRelease): Promise<void>;
  recordDecision(value: ExecutionRelease, key: string, fingerprint: string): Promise<void>;
  release(value: ExecutionRelease): Promise<void>;
  withdraw(value: ExecutionRelease): Promise<void>;
  markStale(value: ExecutionRelease): Promise<void>;
}
export interface FilingExecutionTaskDraftRepository {
  createFromReleasedExecution(value: FilingExecutionTaskDraft): Promise<void>;
  findById(id: FilingExecutionTaskDraftId): Promise<FilingExecutionTaskDraft | undefined>;
  findByExecutionRelease(id: ExecutionReleaseId): Promise<FilingExecutionTaskDraft | undefined>;
  markStale(value: FilingExecutionTaskDraft): Promise<void>;
  cancel(value: FilingExecutionTaskDraft): Promise<void>;
}
export class InMemoryFilingGovernanceRepository {
  private authorizations = new Map<FilingAuthorizationId, FilingAuthorization>();
  private releases = new Map<ExecutionReleaseId, ExecutionRelease>();
  private tasks = new Map<FilingExecutionTaskDraftId, FilingExecutionTaskDraft>();
  private authorizationKeys = new Map<string, KeyEntry<FilingAuthorizationId>>();
  private releaseKeys = new Map<string, KeyEntry<ExecutionReleaseId>>();
  private decisionKeys = new Map<string, KeyEntry<ExecutionReleaseId>>();
  async create(value: FilingAuthorization | ExecutionRelease, key: string, fingerprint: string) {
    if ('filingAuthorizationId' in value && !('executionReleaseId' in value)) {
      this.authorizations.set(value.filingAuthorizationId, clone(value));
      this.authorizationKeys.set(key, { id: value.filingAuthorizationId, fingerprint });
    } else {
      const release = value as ExecutionRelease;
      this.releases.set(release.executionReleaseId, clone(release));
      this.releaseKeys.set(key, { id: release.executionReleaseId, fingerprint });
    }
  }
  async findById(id: FilingAuthorizationId | ExecutionReleaseId | FilingExecutionTaskDraftId) {
    return clone(
      (this.authorizations.get(id as FilingAuthorizationId) ??
        this.releases.get(id as ExecutionReleaseId) ??
        this.tasks.get(id as FilingExecutionTaskDraftId))!
    );
  }
  async findActiveByPreparationLockVersion(id: PreparationLockId, version: string) {
    return (await this.authorizationList()).find(
      (v) =>
        v.preparationLockId === id && v.preparationLockVersion === version && activeAuthorization(v)
    );
  }
  async findByIdempotencyKey(key: string) {
    return clone(
      (this.authorizationKeys.get(key) ?? this.releaseKeys.get(key) ?? this.decisionKeys.get(key))!
    );
  }
  private async saveAuthorization(value: FilingAuthorization) {
    this.authorizations.set(value.filingAuthorizationId, clone(value));
  }
  async confirm(value: FilingAuthorization, key: string, fingerprint: string) {
    await this.saveAuthorization(value);
    this.decisionKeys.set(key, {
      id: value.filingAuthorizationId as unknown as ExecutionReleaseId,
      fingerprint
    });
  }
  withdraw(value: FilingAuthorization | ExecutionRelease) {
    return 'executionReleaseId' in value ? this.saveRelease(value) : this.saveAuthorization(value);
  }
  markStale(value: FilingAuthorization | ExecutionRelease | FilingExecutionTaskDraft) {
    if ('filingExecutionTaskDraftId' in value) return this.saveTask(value);
    return 'executionReleaseId' in value ? this.saveRelease(value) : this.saveAuthorization(value);
  }
  markExpired(value: FilingAuthorization) {
    return this.saveAuthorization(value);
  }
  async list() {
    return this.releaseList();
  }
  async findActiveByAuthorizationVersion(id: FilingAuthorizationId, version: number) {
    return (await this.releaseList()).find(
      (v) =>
        v.filingAuthorizationId === id &&
        v.filingAuthorizationVersion === version &&
        activeRelease(v)
    );
  }
  private async saveRelease(value: ExecutionRelease) {
    this.releases.set(value.executionReleaseId, clone(value));
  }
  evaluateChecks(value: ExecutionRelease) {
    return this.saveRelease(value);
  }
  updateAssignment(value: ExecutionRelease) {
    return this.saveRelease(value);
  }
  async recordDecision(value: ExecutionRelease, key: string, fingerprint: string) {
    await this.saveRelease(value);
    this.decisionKeys.set(key, { id: value.executionReleaseId, fingerprint });
  }
  release(value: ExecutionRelease) {
    return this.saveRelease(value);
  }
  async createFromReleasedExecution(value: FilingExecutionTaskDraft) {
    this.tasks.set(value.filingExecutionTaskDraftId, clone(value));
  }
  async findByExecutionRelease(id: ExecutionReleaseId) {
    return clone((await this.taskList()).find((v) => v.executionReleaseId === id)!);
  }
  private async saveTask(value: FilingExecutionTaskDraft) {
    this.tasks.set(value.filingExecutionTaskDraftId, clone(value));
  }
  cancel(value: FilingExecutionTaskDraft) {
    return this.saveTask(value);
  }
  private async authorizationList() {
    return [...this.authorizations.values()].map(clone);
  }
  private async releaseList() {
    return [...this.releases.values()].map(clone);
  }
  private async taskList() {
    return [...this.tasks.values()].map(clone);
  }
}
const acknowledgementCodes: FilingAuthorizationAcknowledgementCode[] = [
  'APPLICANT_OWNER_CONFIRMED',
  'MARK_CONFIRMED',
  'JURISDICTION_CLASSES_GOODS_CONFIRMED',
  'LOCKED_DOCUMENT_USE_AUTHORIZED',
  'FILING_INSTRUCTION_PREPARATION_AUTHORIZED',
  'AUTHORIZATION_IS_NOT_SUBMISSION',
  'REPRESENTATIVE_APPOINTMENT_MAY_BE_REQUIRED',
  'SCOPE_CHANGE_REQUIRES_REAUTHORIZATION',
  'OFFICE_ACCEPTANCE_NOT_GUARANTEED'
];
const checkCodes = [
  'PREPARATION_LOCK_CURRENT',
  'DOCUMENT_PACKAGE_LOCKED',
  'INSTRUCTION_LEDGER_LOCKED',
  'PROFESSIONAL_REVIEW_CURRENT',
  'FILING_AUTHORIZATION_CURRENT',
  'AUTHORIZED_PARTY_RECORDED',
  'AUTHORIZATION_CAPACITY_RECORDED',
  'AUTHORIZATION_SCOPE_MATCHES_PREPARATION',
  'JURISDICTION_CONFIRMED',
  'APPLICANT_CONFIRMED',
  'MARK_CONFIRMED',
  'CLASSES_CONFIRMED',
  'GOODS_SERVICES_CONFIRMED',
  'FILING_BASIS_CONFIRMED',
  'PRIORITY_CLAIM_RECORDED_OR_NOT_APPLICABLE',
  'REPRESENTATIVE_REQUIREMENT_EVALUATED',
  'EXECUTION_CHANNEL_SELECTED',
  'COMMERCIAL_SCOPE_UNCHANGED',
  'EXECUTION_WINDOW_VALID',
  'AUTHORITY_BOUNDARIES_ACKNOWLEDGED'
] as const;
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const lockVersion = (lock: PreparationLock) =>
  `${lock.documentPackageVersion}:${lock.instructionLedgerVersion}:${lock.lockedAt}`;
function instruction(lock: PreparationLock, type: string): unknown {
  return lock.snapshot.instructionLedger.entries.find(
    (v) => v.type === type && v.status === 'CONFIRMED'
  )?.structuredValue;
}
const stringValue = (value: unknown, fallback: string) =>
  typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? (Object.values(value)[0]?.toString() ?? fallback)
      : fallback;
const arrayValue = (value: unknown, fallback: string[]) =>
  Array.isArray(value)
    ? value.map(String)
    : value && typeof value === 'object'
      ? Object.values(value).flatMap((v) => (Array.isArray(v) ? v.map(String) : [String(v)]))
      : fallback;
function authoritativeScope(
  lock: PreparationLock,
  channel: FilingExecutionChannel,
  now: string,
  expiresAt?: string
): FilingAuthorizationScope {
  const packageValue = lock.snapshot.documentPackage;
  return {
    jurisdiction: packageValue.jurisdiction,
    applicantOwnerReference: stringValue(
      instruction(lock, 'APPLICANT_IDENTITY'),
      'Locked applicant/owner'
    ),
    trademarkReference: packageValue.trademarkReference,
    classes: arrayValue(instruction(lock, 'CLASS_SELECTION'), ['Locked class']),
    goodsServices: arrayValue(instruction(lock, 'GOODS_SERVICES'), ['Locked goods/services']),
    filingBasis: stringValue(instruction(lock, 'FILING_BASIS'), 'Locked filing basis'),
    priorityClaim: instruction(lock, 'PRIORITY_CLAIM')
      ? stringValue(instruction(lock, 'PRIORITY_CLAIM'), 'Recorded')
      : undefined,
    useLockedDocuments: true,
    representativeUse: packageValue.requirements.some((v) => v.code === 'POWER_OF_ATTORNEY')
      ? 'PERMITTED_WHERE_REQUIRED'
      : 'NOT_REQUIRED',
    permittedFilingChannel: channel,
    permittedExecutionWindow: {
      startsAt: now,
      endsAt: expiresAt ?? new Date(Date.parse(now) + 30 * 86400000).toISOString()
    }
  };
}
export class FilingGovernanceService {
  private readonly confirmationKeys = new Map<
    string,
    { fingerprint: string; id: FilingAuthorizationId }
  >();
  constructor(
    private authorizations: FilingAuthorizationRepository,
    private releases: ExecutionReleaseRepository,
    private tasks: FilingExecutionTaskDraftRepository,
    private source: PreparationLockSource,
    private now = () => new Date().toISOString()
  ) {}
  consequences = noAuthorizationAuthorityConsequences;
  private async authorization(id: FilingAuthorizationId) {
    const value = await this.authorizations.findById(id);
    if (!value)
      throw new FilingGovernanceError(
        'FILING_AUTHORIZATION_NOT_FOUND',
        'Filing Authorization was not found.',
        404
      );
    return value;
  }
  private async releaseRecord(id: ExecutionReleaseId) {
    const value = await this.releases.findById(id);
    if (!value)
      throw new FilingGovernanceError(
        'EXECUTION_RELEASE_NOT_FOUND',
        'Execution Release was not found.',
        404
      );
    return value;
  }
  async createAuthorization(command: {
    preparationLockId: PreparationLockId;
    preparationLockVersion: string;
    authorizedParty: { partyId: MarkOrbitId; displayName: string };
    authorizationCapacity: AuthorizationCapacity;
    executionChannel: FilingExecutionChannel;
    expiresAt?: string;
    idempotencyKey: string;
  }) {
    const fp = fingerprint(command);
    const existing = await this.authorizations.findByIdempotencyKey(command.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fp)
        throw new FilingGovernanceError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different payload.'
        );
      return this.authorization(existing.id as unknown as FilingAuthorizationId);
    }
    const lock = await this.source.getPreparationLock(command.preparationLockId);
    if (!lock)
      throw new FilingGovernanceError(
        'PREPARATION_LOCK_NOT_FOUND',
        'Preparation Lock was not found.',
        404
      );
    if (lockVersion(lock) !== command.preparationLockVersion)
      throw new FilingGovernanceError(
        'SOURCE_VERSION_MISMATCH',
        'Exact Preparation Lock version is required.'
      );
    if (
      lock.snapshot.documentPackage.status !== 'LOCKED_FOR_PREPARATION' ||
      lock.snapshot.instructionLedger.status !== 'LOCKED_FOR_PREPARATION'
    )
      throw new FilingGovernanceError(
        'PREPARATION_LOCK_NOT_CURRENT',
        'Preparation Lock is not LOCKED_FOR_PREPARATION.',
        422
      );
    if (
      await this.authorizations.findActiveByPreparationLockVersion(
        command.preparationLockId,
        command.preparationLockVersion
      )
    )
      throw new FilingGovernanceError(
        'ACTIVE_FILING_AUTHORIZATION_EXISTS',
        'An active authorization already exists.'
      );
    const at = this.now();
    const scope = authoritativeScope(lock, command.executionChannel, at, command.expiresAt);
    const pkg = lock.snapshot.documentPackage;
    const value: FilingAuthorization = {
      schemaVersion: 1,
      version: 1,
      filingAuthorizationId: `filing-authorization_${randomUUID()}`,
      preparationLockId: lock.preparationLockId,
      preparationLockVersion: command.preparationLockVersion,
      preparationSnapshot: clone(lock.snapshot),
      professionalReviewCaseId: pkg.professionalReviewCaseId,
      professionalReviewVersion: pkg.professionalReviewDecisionVersion,
      customerId: pkg.customerId,
      authorizedParty: clone(command.authorizedParty),
      authorizationCapacity: command.authorizationCapacity,
      jurisdiction: scope.jurisdiction,
      applicantOwnerReference: scope.applicantOwnerReference,
      trademarkReference: scope.trademarkReference,
      classes: scope.classes,
      goodsServices: scope.goodsServices,
      filingBasis: scope.filingBasis,
      representativeRequirement: scope.representativeUse,
      scope,
      termsVersion: 'filing-authorization-terms-v1',
      acknowledgements: [],
      evidence: [
        { reference: lock.preparationLockId, source: 'MARKREG_PREPARATION_LOCK', recordedAt: at }
      ],
      status: 'PENDING_CONFIRMATION',
      ...(command.expiresAt ? { expiresAt: command.expiresAt } : {}),
      createdAt: at,
      updatedAt: at
    };
    await this.authorizations.create(value, command.idempotencyKey, fp);
    return value;
  }
  async getAuthorization(id: FilingAuthorizationId) {
    const value = await this.authorization(id);
    if (['WITHDRAWN', 'STALE', 'EXPIRED'].includes(value.status)) return value;
    const at = this.now();
    if (value.expiresAt && Date.parse(at) >= Date.parse(value.expiresAt)) {
      const expired = { ...value, status: 'EXPIRED' as const, updatedAt: at };
      await this.authorizations.markExpired(expired);
      return expired;
    }
    const current = await this.source.getPreparationLock(value.preparationLockId);
    if (!current || lockVersion(current) !== value.preparationLockVersion) {
      const stale = { ...value, status: 'STALE' as const, updatedAt: at };
      await this.authorizations.markStale(stale);
      return stale;
    }
    return value;
  }
  async confirmAuthorization(
    id: FilingAuthorizationId,
    command: {
      acknowledgementCodes: FilingAuthorizationAcknowledgementCode[];
      acknowledgedBy: MarkOrbitId;
      idempotencyKey: string;
    }
  ) {
    const fp = fingerprint(command);
    const replay = this.confirmationKeys.get(command.idempotencyKey);
    if (replay) {
      if (replay.fingerprint !== fp || replay.id !== id)
        throw new FilingGovernanceError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different confirmation payload.'
        );
      return this.authorization(id);
    }
    const value = await this.getAuthorization(id);
    if (value.status === 'AUTHORIZED')
      throw new FilingGovernanceError(
        'FILING_AUTHORIZATION_IMMUTABLE',
        'An authorized record is immutable.'
      );
    if (value.status !== 'PENDING_CONFIRMATION')
      throw new FilingGovernanceError(
        'FILING_AUTHORIZATION_IMMUTABLE',
        'Authorization cannot be changed in its current state.'
      );
    const supplied = new Set(command.acknowledgementCodes);
    const missing = acknowledgementCodes.filter((code) => !supplied.has(code));
    if (missing.length)
      throw new FilingGovernanceError(
        'MANDATORY_ACKNOWLEDGEMENT_MISSING',
        `Missing active acknowledgements: ${missing.join(', ')}`,
        422
      );
    const at = this.now();
    const next: FilingAuthorization = {
      ...value,
      status: 'AUTHORIZED',
      version: value.version + 1,
      authorizedAt: at,
      updatedAt: at,
      acknowledgements: acknowledgementCodes.map((code) => ({
        code,
        version: 1,
        acknowledgedBy: command.acknowledgedBy,
        acknowledgedAt: at,
        evidenceReference: `authorization-acknowledgement:${code}:${at}`
      }))
    };
    await this.authorizations.confirm(next, command.idempotencyKey, fp);
    this.confirmationKeys.set(command.idempotencyKey, { fingerprint: fp, id });
    return next;
  }
  async withdrawAuthorization(id: FilingAuthorizationId) {
    const value = await this.authorization(id);
    if (['WITHDRAWN', 'STALE', 'EXPIRED'].includes(value.status)) return value;
    const at = this.now();
    const next = {
      ...value,
      status: 'WITHDRAWN' as const,
      version: value.version + 1,
      withdrawnAt: at,
      updatedAt: at
    };
    await this.authorizations.withdraw(next);
    return next;
  }
  async createRelease(command: {
    filingAuthorizationId: FilingAuthorizationId;
    filingAuthorizationVersion: number;
    requestedExecutionChannel: FilingExecutionChannel;
    idempotencyKey: string;
  }) {
    const fp = fingerprint(command);
    const keyed = await this.releases.findByIdempotencyKey(command.idempotencyKey);
    if (keyed) {
      if (keyed.fingerprint !== fp)
        throw new FilingGovernanceError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different payload.'
        );
      return this.releaseRecord(keyed.id as ExecutionReleaseId);
    }
    const auth = await this.getAuthorization(command.filingAuthorizationId);
    if (auth.version !== command.filingAuthorizationVersion)
      throw new FilingGovernanceError(
        'AUTHORIZATION_VERSION_MISMATCH',
        'Exact Filing Authorization version is required.'
      );
    if (auth.status !== 'AUTHORIZED')
      throw new FilingGovernanceError(
        'AUTHORIZATION_NOT_RELEASABLE',
        'Only current AUTHORIZED authority can be reviewed for release.',
        422
      );
    if (
      await this.releases.findActiveByAuthorizationVersion(auth.filingAuthorizationId, auth.version)
    )
      throw new FilingGovernanceError(
        'ACTIVE_EXECUTION_RELEASE_EXISTS',
        'An active Execution Release already exists.'
      );
    const at = this.now();
    const value: ExecutionRelease = {
      schemaVersion: 1,
      version: 1,
      executionReleaseId: `execution-release_${randomUUID()}`,
      filingAuthorizationId: auth.filingAuthorizationId,
      filingAuthorizationVersion: auth.version,
      preparationLockId: auth.preparationLockId,
      preparationLockVersion: auth.preparationLockVersion,
      professionalReviewCaseId: auth.professionalReviewCaseId,
      professionalReviewVersion: auth.professionalReviewVersion,
      customerId: auth.customerId,
      jurisdiction: auth.jurisdiction,
      requestedExecutionChannel: command.requestedExecutionChannel,
      checks: checkCodes.map((code) => ({
        code,
        status: 'UNKNOWN',
        blocking: true,
        explanation: 'Server evaluation has not completed.',
        source: 'EXECUTION_RELEASE_POLICY_V1',
        checkedAt: at
      })),
      assignment: {},
      evidence: [],
      status: 'DRAFT',
      createdAt: at,
      updatedAt: at
    };
    await this.releases.create(value, command.idempotencyKey, fp);
    return value;
  }
  async listReleases() {
    const values = await this.releases.list();
    return Promise.all(values.map((value) => this.refreshRelease(value)));
  }
  async getRelease(id: ExecutionReleaseId) {
    return this.refreshRelease(await this.releaseRecord(id));
  }
  private async refreshRelease(value: ExecutionRelease) {
    if (['WITHDRAWN', 'STALE'].includes(value.status)) return value;
    const authorization = await this.getAuthorization(value.filingAuthorizationId);
    if (
      authorization.status === 'AUTHORIZED' &&
      authorization.version === value.filingAuthorizationVersion
    )
      return value;
    const stale = { ...value, status: 'STALE' as const, updatedAt: this.now() };
    await this.releases.markStale(stale);
    const task = await this.tasks.findByExecutionRelease(value.executionReleaseId);
    if (task) await this.tasks.markStale({ ...task, status: 'STALE' });
    return stale;
  }
  async evaluate(id: ExecutionReleaseId) {
    const value = await this.getRelease(id);
    if (!['DRAFT', 'BLOCKED', 'READY_FOR_RELEASE'].includes(value.status))
      throw new FilingGovernanceError(
        'EXECUTION_RELEASE_IMMUTABLE',
        'Release checks cannot be changed.'
      );
    const auth = await this.authorization(value.filingAuthorizationId);
    const lock = await this.source.getPreparationLock(value.preparationLockId);
    const current =
      !!lock &&
      lockVersion(lock) === value.preparationLockVersion &&
      auth.status === 'AUTHORIZED' &&
      auth.version === value.filingAuthorizationVersion;
    const at = this.now();
    const checks: ExecutionReleaseCheck[] = value.checks.map((check) => ({
      ...check,
      status: current ? 'PASS' : 'FAIL',
      explanation: current
        ? 'Authoritative source evidence satisfies this check.'
        : 'Authoritative source lineage is no longer current.',
      ...(current ? { evidenceReference: value.preparationLockId } : {}),
      checkedAt: at
    }));
    const blocked = checks.some(
      (v) => v.blocking && (v.status === 'FAIL' || v.status === 'UNKNOWN')
    );
    const next = {
      ...value,
      checks,
      status: blocked ? ('BLOCKED' as const) : ('READY_FOR_RELEASE' as const),
      updatedAt: at
    };
    await this.releases.evaluateChecks(next);
    return next;
  }
  async assign(id: ExecutionReleaseId, assignment: ExecutionReleaseAssignment) {
    const value = await this.releaseRecord(id);
    if (value.status === 'RELEASED_FOR_EXECUTION')
      throw new FilingGovernanceError(
        'EXECUTION_RELEASE_IMMUTABLE',
        'Released assignment is immutable.'
      );
    const next = {
      ...value,
      assignment: { ...clone(assignment), assignedAt: this.now() },
      updatedAt: this.now()
    };
    await this.releases.updateAssignment(next);
    return next;
  }
  async release(
    id: ExecutionReleaseId,
    command: { decidedBy: MarkOrbitId; rationale: string; idempotencyKey: string }
  ) {
    const fp = fingerprint(command);
    const keyed = await this.releases.findByIdempotencyKey(command.idempotencyKey);
    if (keyed) {
      if (keyed.fingerprint !== fp)
        throw new FilingGovernanceError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different payload.'
        );
      const release = await this.releaseRecord(id);
      return { release, taskDraft: await this.tasks.findByExecutionRelease(id) };
    }
    const value = await this.getRelease(id);
    if (value.status !== 'READY_FOR_RELEASE')
      throw new FilingGovernanceError(
        'RELEASE_CHECKS_BLOCKING',
        'All blocking checks must PASS before release.',
        422
      );
    if (!command.rationale.trim())
      throw new FilingGovernanceError(
        'RELEASE_RATIONALE_REQUIRED',
        'Explicit release rationale is required.',
        422
      );
    if (!value.assignment.internalExecutorId)
      throw new FilingGovernanceError(
        'EXECUTOR_ASSIGNMENT_REQUIRED',
        'An internal executor must be assigned.',
        422
      );
    const at = this.now();
    const next: ExecutionRelease = {
      ...value,
      version: value.version + 1,
      decision: {
        decision: 'RELEASE',
        decidedBy: command.decidedBy,
        rationale: command.rationale,
        decidedAt: at
      },
      status: 'RELEASED_FOR_EXECUTION',
      releasedAt: at,
      updatedAt: at
    };
    await this.releases.recordDecision(next, command.idempotencyKey, fp);
    await this.releases.release(next);
    const existing = await this.tasks.findByExecutionRelease(id);
    if (existing) return { release: next, taskDraft: existing };
    const auth = await this.authorization(value.filingAuthorizationId);
    const taskDraft: FilingExecutionTaskDraft = {
      schemaVersion: 1,
      filingExecutionTaskDraftId: `filing-task-draft_${randomUUID()}`,
      executionReleaseId: id,
      filingAuthorizationId: auth.filingAuthorizationId,
      preparationLockId: auth.preparationLockId,
      executionSnapshot: clone(auth.scope),
      jurisdiction: auth.jurisdiction,
      applicant: auth.applicantOwnerReference,
      trademark: auth.trademarkReference,
      classes: auth.classes,
      goodsServices: auth.goodsServices,
      filingBasis: auth.filingBasis,
      documentReferences: auth.preparationSnapshot.documentPackage.documentItems.map(
        (v) => v.documentReference.fileName
      ),
      instructionReferences: auth.preparationSnapshot.instructionLedger.entries.map(
        (v) => v.instructionEntryId
      ),
      representativeRequirement: auth.representativeRequirement,
      executionChannel: value.requestedExecutionChannel,
      internalAssigneeReference: value.assignment.internalExecutorId,
      status: 'PREPARED',
      createdAt: at
    };
    await this.tasks.createFromReleasedExecution(taskDraft);
    return { release: next, taskDraft };
  }
  async withdrawRelease(id: ExecutionReleaseId) {
    const value = await this.releaseRecord(id);
    if (value.status === 'RELEASED_FOR_EXECUTION')
      throw new FilingGovernanceError(
        'EXECUTION_RELEASE_IMMUTABLE',
        'A released decision is immutable.'
      );
    const next = { ...value, status: 'WITHDRAWN' as const, updatedAt: this.now() };
    await this.releases.withdraw(next);
    return next;
  }
  async getTask(id: FilingExecutionTaskDraftId) {
    const value = await this.tasks.findById(id);
    if (!value)
      throw new FilingGovernanceError(
        'FILING_TASK_DRAFT_NOT_FOUND',
        'Filing Execution Task Draft was not found.',
        404
      );
    return value;
  }
  async getTaskForRelease(id: ExecutionReleaseId) {
    const value = await this.tasks.findByExecutionRelease(id);
    if (!value)
      throw new FilingGovernanceError(
        'FILING_TASK_DRAFT_NOT_FOUND',
        'Filing Execution Task Draft was not found.',
        404
      );
    return value;
  }
}
