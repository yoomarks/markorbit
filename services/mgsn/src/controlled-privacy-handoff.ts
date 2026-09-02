import { createHash, randomUUID } from 'node:crypto';
import {
  controlledHandoffAuthorizedDataClasses,
  controlledHandoffForbiddenGenericDataClasses,
  noDownstreamHandoffAuthorityConsequences,
  type AuthorizeOrReplaceControlledHandoffCommandV1,
  type ControlledHandoffConsumptionAttemptV1,
  type ControlledHandoffCurrentValidationV1,
  type ControlledHandoffEnvelopeV1,
  type ControlledHandoffId,
  type ControlledHandoffMutationResultV1,
  type ControlledHandoffValidationDenialReason,
  type ControlledHandoffValidationPurpose,
  type RevokeControlledHandoffCommandV1
} from '@markorbit/contracts/controlled-privacy-handoff';

const validationPolicyVersion = 'mgsn-controlled-handoff-validation-v1';
const sha256 = /^[0-9a-f]{64}$/;

export interface ControlledHandoffPrincipal {
  workspaceId: string;
  actorId: string;
  actorKind: 'HUMAN_USER' | 'SYSTEM' | 'AI_AGENT';
  principalReference: string;
  workspaceMembershipReference: string;
  handoffAuthorityReference: string;
  handoffAuthorityVersion: number | string;
  authenticatedAt: string;
  affirmativeHumanActionEvidenceReference: string;
}

export interface ControlledHandoffCurrentAuthoritySnapshot {
  authorityAvailable: boolean;
  selectionCurrent: boolean;
  selectionScopeMatch: boolean;
  sourceVersionsMatch: boolean;
  sourceAccessCurrent: boolean;
  participationActive: boolean;
  visibilityAuthorized: boolean;
  directExecutorEstablished: boolean;
  hiddenIntermediaryDetected: boolean;
  evidenceArtifactAccessAuthorized: boolean;
  checkedAuthorityReferences: readonly string[];
}

export interface ControlledHandoffCurrentAuthoritySource {
  evaluateCurrentAuthority(input: {
    envelope?: ControlledHandoffEnvelopeV1;
    command?: AuthorizeOrReplaceControlledHandoffCommandV1;
    purpose: 'HANDOFF_AUTHORIZE' | ControlledHandoffValidationPurpose;
    attempt?: ControlledHandoffConsumptionAttemptV1;
  }): Promise<ControlledHandoffCurrentAuthoritySnapshot>;
}

interface ControlledHandoffReplayRecord {
  fingerprint: string;
  actorId: string;
  principalReference: string;
  result: ControlledHandoffMutationResultV1;
}

interface ControlledHandoffSlotState {
  current: ControlledHandoffEnvelopeV1 | undefined;
  version: number;
}

interface ControlledHandoffCommit {
  slotKey: string;
  expectedCurrent: AuthorizeOrReplaceControlledHandoffCommandV1['expectedCurrent'];
  previous: ControlledHandoffEnvelopeV1 | undefined;
  next: ControlledHandoffEnvelopeV1;
  replayKey: string;
  replay: ControlledHandoffReplayRecord;
}

export interface ControlledHandoffRepository {
  findSlotState(slotKey: string): Promise<ControlledHandoffSlotState>;
  findLatest(controlledHandoffId: ControlledHandoffId): Promise<ControlledHandoffEnvelopeV1 | undefined>;
  findReplay(slotKey: string, idempotencyKey: string): Promise<ControlledHandoffReplayRecord | undefined>;
  commit(mutation: ControlledHandoffCommit): Promise<void>;
}

export class ControlledHandoffError extends Error {
  constructor(
    readonly code:
      | 'INVALID_INPUT'
      | 'HUMAN_ACTION_REQUIRED'
      | 'ORIGINATING_WORKSPACE_MISMATCH'
      | 'AUTHORIZING_ACTOR_MISMATCH'
      | 'STALE_HANDOFF'
      | 'HANDOFF_NOT_FOUND'
      | 'IDEMPOTENCY_CONFLICT'
      | 'CURRENT_AUTHORITY_DENIED'
      | 'AUTHORITY_UNAVAILABLE',
    readonly status: number,
    message: string,
    readonly denialReason?: ControlledHandoffValidationDenialReason
  ) {
    super(message);
    this.name = 'ControlledHandoffError';
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactVersion(value: unknown): value is number | string {
  return (typeof value === 'number' && Number.isInteger(value) && value > 0) || nonEmpty(value);
}

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sameVersion(left: number | string, right: number | string): boolean {
  return typeof left === typeof right && left === right;
}

function envelopeReference(envelope: ControlledHandoffEnvelopeV1) {
  return { controlledHandoffId: envelope.controlledHandoffId, version: envelope.version } as const;
}

function sameEnvelopeReference(
  left: { controlledHandoffId: ControlledHandoffId; version: number },
  right: { controlledHandoffId: ControlledHandoffId; version: number }
): boolean {
  return left.controlledHandoffId === right.controlledHandoffId && left.version === right.version;
}

function sameSelectionReference(
  left: { providerSelectionId: string; version: number; scopeVersion: number },
  right: { providerSelectionId: string; version: number; scopeVersion: number }
): boolean {
  return (
    left.providerSelectionId === right.providerSelectionId &&
    left.version === right.version &&
    left.scopeVersion === right.scopeVersion
  );
}

function slotKey(command: AuthorizeOrReplaceControlledHandoffCommandV1): string {
  const selection = command.sourceLineage.selectionLineage.selection;
  return [
    'controlled-handoff',
    command.originatingWorkspaceId,
    selection.providerSelectionId,
    command.recipient.providerId,
    encodeURIComponent(command.purpose.contextReference)
  ].join(':');
}

function runtimeProjectionGuard(command: AuthorizeOrReplaceControlledHandoffCommandV1): void {
  const projection = command.authorizedProjection;
  if (
    projection.schemaVersion !== 1 ||
    projection.items.length === 0 ||
    projection.wildcardAllowed !== false ||
    projection.wholeRecordAllowed !== false ||
    projection.implicitFieldExpansionAllowed !== false ||
    projection.fieldValuesEmbeddedInEnvelope !== false ||
    projection.requestedAuthorizedMinimumNecessaryIntersectionRequired !== true ||
    !sha256.test(projection.projectionFingerprintSha256) ||
    !sha256.test(projection.sourceSetFingerprintSha256)
  ) {
    throw new ControlledHandoffError('INVALID_INPUT', 400, 'Controlled Handoff projection is invalid.');
  }
  if (
    projection.forbiddenGenericDataClasses.length !== controlledHandoffForbiddenGenericDataClasses.length ||
    controlledHandoffForbiddenGenericDataClasses.some(
      (dataClass) => !projection.forbiddenGenericDataClasses.includes(dataClass)
    )
  ) {
    throw new ControlledHandoffError(
      'INVALID_INPUT',
      400,
      'Controlled Handoff forbidden data-class floor cannot be weakened.'
    );
  }
  for (const item of projection.items) {
    if (
      !controlledHandoffAuthorizedDataClasses.includes(item.dataClass) ||
      !nonEmpty(item.fieldPath) ||
      item.fieldPath.includes('*') ||
      !nonEmpty(item.sourceReference) ||
      !exactVersion(item.sourceVersion) ||
      !sha256.test(item.sourceFingerprintSha256) ||
      !nonEmpty(item.necessityReference) ||
      item.requested !== true ||
      item.authorizedBySourceOwner !== true ||
      item.minimumNecessary !== true ||
      item.fieldValueEmbeddedInEnvelope !== false
    ) {
      throw new ControlledHandoffError(
        'INVALID_INPUT',
        400,
        'Controlled Handoff projection must be exact, source-authorized and minimum necessary.'
      );
    }
  }
}

function commandGuard(command: AuthorizeOrReplaceControlledHandoffCommandV1): void {
  if (
    command.schemaVersion !== 1 ||
    !nonEmpty(command.originatingWorkspaceId) ||
    !nonEmpty(command.recipient.providerId) ||
    !nonEmpty(command.recipient.providerWorkspaceId) ||
    command.recipient.role !== 'FINAL_EXECUTION_PROVIDER' ||
    !nonEmpty(command.purpose.contextReference) ||
    !nonEmpty(command.purpose.instructionReference) ||
    command.purpose.unrestrictedPurposeAllowed !== false ||
    !sha256.test(command.purpose.purposeFingerprintSha256) ||
    !nonEmpty(command.idempotencyKey) ||
    !sha256.test(command.commandFingerprintSha256) ||
    !nonEmpty(command.correlationId)
  ) {
    throw new ControlledHandoffError('INVALID_INPUT', 400, 'Controlled Handoff command is invalid.');
  }
  const validFrom = Date.parse(command.validFrom);
  const validUntil = Date.parse(command.validUntil);
  if (!Number.isFinite(validFrom) || !Number.isFinite(validUntil) || validFrom >= validUntil) {
    throw new ControlledHandoffError(
      'INVALID_INPUT',
      400,
      'Controlled Handoff requires a finite positive validity window.'
    );
  }
  runtimeProjectionGuard(command);
  const selection = command.sourceLineage.selectionLineage;
  const direct = command.sourceLineage.directExecutorAuthority;
  if (
    selection.currentSelectionValidation.purpose !== 'CONTROLLED_HANDOFF_REVIEW' ||
    selection.currentSelectionValidation.decision !== 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW' ||
    selection.currentSelectionValidation.currentlyUsable !== true ||
    selection.selectedProvider.providerId !== command.recipient.providerId ||
    selection.selectedProvider.providerWorkspaceId !== command.recipient.providerWorkspaceId ||
    direct.directExecutorEstablished !== true ||
    direct.disclosureState !== 'INDEPENDENT_EVIDENCE_REFERENCED' ||
    direct.finalExecutionProviderId !== command.recipient.providerId ||
    direct.finalExecutionProviderWorkspaceId !== command.recipient.providerWorkspaceId ||
    direct.hiddenIntermediaryAllowed !== false ||
    direct.onwardRecipientAuthorization !== 'NONE' ||
    command.sourceLineage.currentAuthorityRevalidationRequiredBeforeAuthorize !== true ||
    command.sourceLineage.currentAuthorityRevalidationRequiredBeforeConsumption !== true ||
    command.sourceLineage.evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval !== true
  ) {
    throw new ControlledHandoffError('INVALID_INPUT', 400, 'Controlled Handoff source lineage is invalid.');
  }
  const preview = command.privacyPreviewAcknowledgement;
  if (
    preview.affirmativeHumanAction !== true ||
    preview.acknowledgementCode !== 'CONTROLLED_PRIVACY_HANDOFF_V1' ||
    preview.originatingWorkspaceId !== command.originatingWorkspaceId ||
    preview.recipientProviderId !== command.recipient.providerId ||
    preview.recipientProviderWorkspaceId !== command.recipient.providerWorkspaceId ||
    !sameSelectionReference(preview.selection, selection.selection) ||
    preview.purposeFingerprintSha256 !== command.purpose.purposeFingerprintSha256 ||
    preview.projectionFingerprintSha256 !== command.authorizedProjection.projectionFingerprintSha256 ||
    preview.sourceSetFingerprintSha256 !== command.authorizedProjection.sourceSetFingerprintSha256 ||
    !sha256.test(preview.previewFingerprintSha256)
  ) {
    throw new ControlledHandoffError(
      'INVALID_INPUT',
      400,
      'Privacy Preview acknowledgement does not match the exact handoff.'
    );
  }
}

function assertPrincipal(
  principal: ControlledHandoffPrincipal,
  authority: AuthorizeOrReplaceControlledHandoffCommandV1['trustedHumanAuthority'] | RevokeControlledHandoffCommandV1['trustedHumanAuthority']
): void {
  if (principal.actorKind !== 'HUMAN_USER') {
    throw new ControlledHandoffError(
      'HUMAN_ACTION_REQUIRED',
      403,
      'Controlled Privacy Handoff requires explicit human action.'
    );
  }
  if (principal.workspaceId !== authority.originatingWorkspaceId) {
    throw new ControlledHandoffError(
      'ORIGINATING_WORKSPACE_MISMATCH',
      403,
      'Originating Workspace does not match trusted authority.'
    );
  }
  if (
    principal.actorId !== authority.authorizingActorId ||
    principal.principalReference !== authority.principalReference ||
    principal.workspaceMembershipReference !== authority.workspaceMembershipReference ||
    principal.handoffAuthorityReference !== authority.handoffAuthorityReference ||
    !sameVersion(principal.handoffAuthorityVersion, authority.handoffAuthorityVersion) ||
    principal.affirmativeHumanActionEvidenceReference !==
      authority.affirmativeHumanActionEvidenceReference ||
    authority.payloadIdentityAuthoritative !== false
  ) {
    throw new ControlledHandoffError(
      'AUTHORIZING_ACTOR_MISMATCH',
      403,
      'Trusted human authority does not match the authenticated principal.'
    );
  }
}

function denialFromAuthority(
  snapshot: ControlledHandoffCurrentAuthoritySnapshot,
  artifactRetrievalRequested: boolean
): ControlledHandoffValidationDenialReason | undefined {
  if (!snapshot.authorityAvailable) return 'AUTHORITY_UNAVAILABLE';
  if (!snapshot.selectionCurrent) return 'SELECTION_NOT_CURRENT';
  if (!snapshot.selectionScopeMatch) return 'SELECTION_SCOPE_MISMATCH';
  if (!snapshot.sourceVersionsMatch) return 'SOURCE_VERSION_MISMATCH';
  if (!snapshot.sourceAccessCurrent) return 'SOURCE_ACCESS_NOT_CURRENT';
  if (!snapshot.participationActive) return 'PARTICIPATION_NOT_ACTIVE';
  if (!snapshot.visibilityAuthorized) return 'VISIBILITY_NO_LONGER_AUTHORIZED';
  if (!snapshot.directExecutorEstablished) return 'DIRECT_EXECUTOR_NOT_ESTABLISHED';
  if (snapshot.hiddenIntermediaryDetected) return 'HIDDEN_INTERMEDIARY_DETECTED';
  if (artifactRetrievalRequested && !snapshot.evidenceArtifactAccessAuthorized) {
    return 'EVIDENCE_ARTIFACT_ACCESS_NOT_AUTHORIZED';
  }
  return undefined;
}

function replayResult(record: ControlledHandoffReplayRecord): ControlledHandoffMutationResultV1 {
  return { ...clone(record.result), replayed: true, replayDoesNotEstablishCurrentUsability: true };
}

export class InMemoryControlledHandoffRepository implements ControlledHandoffRepository {
  private readonly slots = new Map<string, ControlledHandoffSlotState>();
  private readonly history = new Map<ControlledHandoffId, ControlledHandoffEnvelopeV1[]>();
  private readonly replay = new Map<string, ControlledHandoffReplayRecord>();

  async findSlotState(key: string): Promise<ControlledHandoffSlotState> {
    const state = this.slots.get(key);
    return state ? clone(state) : { current: undefined, version: 0 };
  }

  async findLatest(id: ControlledHandoffId): Promise<ControlledHandoffEnvelopeV1 | undefined> {
    return clone(this.history.get(id)?.at(-1));
  }

  async findReplay(key: string, idempotencyKey: string): Promise<ControlledHandoffReplayRecord | undefined> {
    return clone(this.replay.get(`${key}\u0000${idempotencyKey}`));
  }

  async commit(mutation: ControlledHandoffCommit): Promise<void> {
    const state = this.slots.get(mutation.slotKey) ?? { current: undefined, version: 0 };
    if (mutation.expectedCurrent.kind === 'ABSENT') {
      if (state.current) {
        throw new ControlledHandoffError('STALE_HANDOFF', 409, 'A current Handoff already exists.');
      }
    } else if (
      !state.current ||
      state.current.controlledHandoffId !== mutation.expectedCurrent.controlledHandoffId ||
      state.current.version !== mutation.expectedCurrent.version
    ) {
      throw new ControlledHandoffError('STALE_HANDOFF', 409, 'Expected current Handoff is stale.');
    }
    const replayMapKey = `${mutation.slotKey}\u0000${mutation.replayKey}`;
    if (this.replay.has(replayMapKey)) {
      throw new ControlledHandoffError('IDEMPOTENCY_CONFLICT', 409, 'Replay key already committed.');
    }
    const history = this.history.get(mutation.next.controlledHandoffId) ?? [];
    history.push(clone(mutation.next));
    this.history.set(mutation.next.controlledHandoffId, history);
    this.slots.set(mutation.slotKey, {
      current: mutation.next.status === 'AUTHORIZED' ? clone(mutation.next) : undefined,
      version: state.version + 1
    });
    this.replay.set(replayMapKey, clone(mutation.replay));
  }

  listHistory(id: ControlledHandoffId): ControlledHandoffEnvelopeV1[] {
    return clone(this.history.get(id) ?? []);
  }
}

export class ControlledPrivacyHandoffService {
  constructor(
    private readonly repository: ControlledHandoffRepository,
    private readonly currentAuthority: ControlledHandoffCurrentAuthoritySource,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextId: () => ControlledHandoffId = () =>
      `controlled-handoff_${randomUUID()}` as ControlledHandoffId
  ) {}

  async authorizeOrReplace(
    principal: ControlledHandoffPrincipal,
    command: AuthorizeOrReplaceControlledHandoffCommandV1
  ): Promise<ControlledHandoffMutationResultV1> {
    assertPrincipal(principal, command.trustedHumanAuthority);
    if (command.originatingWorkspaceId !== principal.workspaceId) {
      throw new ControlledHandoffError(
        'ORIGINATING_WORKSPACE_MISMATCH',
        403,
        'Originating Workspace does not match the authenticated principal.'
      );
    }
    commandGuard(command);
    const key = slotKey(command);
    const existingReplay = await this.repository.findReplay(key, command.idempotencyKey);
    if (existingReplay) {
      if (
        existingReplay.fingerprint !== command.commandFingerprintSha256 ||
        existingReplay.actorId !== principal.actorId ||
        existingReplay.principalReference !== principal.principalReference
      ) {
        throw new ControlledHandoffError(
          'IDEMPOTENCY_CONFLICT',
          409,
          'Controlled Handoff idempotency key was reused with different authority or fingerprint.'
        );
      }
      return replayResult(existingReplay);
    }
    const snapshot = await this.evaluateAuthority({ command, purpose: 'HANDOFF_AUTHORIZE' });
    const denial = denialFromAuthority(snapshot, false);
    if (denial) this.throwAuthorityDenial(denial);
    const state = await this.repository.findSlotState(key);
    const previous = state.current;
    if (command.expectedCurrent.kind === 'ABSENT' && previous) {
      throw new ControlledHandoffError('STALE_HANDOFF', 409, 'A current Handoff already exists.');
    }
    if (
      command.expectedCurrent.kind === 'EXACT' &&
      (!previous ||
        previous.controlledHandoffId !== command.expectedCurrent.controlledHandoffId ||
        previous.version !== command.expectedCurrent.version)
    ) {
      throw new ControlledHandoffError('STALE_HANDOFF', 409, 'Expected current Handoff is stale.');
    }
    const id = previous?.controlledHandoffId ?? this.nextId();
    const at = this.now();
    const version = (previous?.version ?? 0) + 1;
    const base = {
      schemaVersion: 1 as const,
      controlledHandoffId: id,
      originatingWorkspaceId: command.originatingWorkspaceId,
      recipient: clone(command.recipient),
      purpose: clone(command.purpose),
      authorizedProjection: clone(command.authorizedProjection),
      sourceLineage: clone(command.sourceLineage),
      trustedHumanAuthority: clone(command.trustedHumanAuthority),
      privacyPreviewAcknowledgement: clone(command.privacyPreviewAcknowledgement),
      authorizedAt: at,
      validFrom: command.validFrom,
      validUntil: command.validUntil,
      version,
      correlationId: command.correlationId,
      authorityConsequences: noDownstreamHandoffAuthorityConsequences,
      status: 'AUTHORIZED' as const,
      revokedAt: null
    };
    const envelope: ControlledHandoffEnvelopeV1 = {
      ...base,
      envelopeFingerprintSha256: canonicalHash(base)
    };
    const result: ControlledHandoffMutationResultV1 = {
      schemaVersion: 1,
      mutation: previous ? 'REPLACED' : 'AUTHORIZED',
      envelope,
      ...(previous ? { previousEnvelope: envelopeReference(previous) } : {}),
      replayed: false,
      replayDoesNotEstablishCurrentUsability: true,
      correlationId: command.correlationId
    };
    await this.repository.commit({
      slotKey: key,
      expectedCurrent: command.expectedCurrent,
      previous,
      next: envelope,
      replayKey: command.idempotencyKey,
      replay: {
        fingerprint: command.commandFingerprintSha256,
        actorId: principal.actorId,
        principalReference: principal.principalReference,
        result
      }
    });
    return clone(result);
  }

  async revoke(
    principal: ControlledHandoffPrincipal,
    command: RevokeControlledHandoffCommandV1
  ): Promise<ControlledHandoffMutationResultV1> {
    assertPrincipal(principal, command.trustedHumanAuthority);
    if (command.originatingWorkspaceId !== principal.workspaceId) {
      throw new ControlledHandoffError(
        'ORIGINATING_WORKSPACE_MISMATCH',
        403,
        'Originating Workspace does not match the authenticated principal.'
      );
    }
    if (
      command.schemaVersion !== 1 ||
      !nonEmpty(command.idempotencyKey) ||
      !sha256.test(command.commandFingerprintSha256) ||
      !nonEmpty(command.target.controlledHandoffId) ||
      !Number.isInteger(command.target.version) ||
      command.target.version <= 0
    ) {
      throw new ControlledHandoffError('INVALID_INPUT', 400, 'Controlled Handoff revocation is invalid.');
    }
    const current = await this.repository.findLatest(command.target.controlledHandoffId);
    if (!current || current.originatingWorkspaceId !== principal.workspaceId) {
      throw new ControlledHandoffError('HANDOFF_NOT_FOUND', 404, 'Controlled Handoff was not found.');
    }
    const key = this.slotKeyFromEnvelope(current);
    const existingReplay = await this.repository.findReplay(key, command.idempotencyKey);
    if (existingReplay) {
      if (
        existingReplay.fingerprint !== command.commandFingerprintSha256 ||
        existingReplay.actorId !== principal.actorId ||
        existingReplay.principalReference !== principal.principalReference
      ) {
        throw new ControlledHandoffError('IDEMPOTENCY_CONFLICT', 409, 'Revocation replay conflicts.');
      }
      return replayResult(existingReplay);
    }
    if (
      current.status !== 'AUTHORIZED' ||
      current.version !== command.target.version ||
      current.controlledHandoffId !== command.target.controlledHandoffId
    ) {
      throw new ControlledHandoffError('STALE_HANDOFF', 409, 'Revocation target is not current.');
    }
    const at = this.now();
    const base = {
      ...clone(current),
      version: current.version + 1,
      status: 'REVOKED' as const,
      revokedAt: at,
      revocationReasonCode: command.reasonCode,
      correlationId: command.correlationId
    };
    const { envelopeFingerprintSha256: _oldFingerprint, ...withoutFingerprint } = base;
    const revoked: ControlledHandoffEnvelopeV1 = {
      ...base,
      envelopeFingerprintSha256: canonicalHash(withoutFingerprint)
    };
    const result: ControlledHandoffMutationResultV1 = {
      schemaVersion: 1,
      mutation: 'REVOKED',
      envelope: revoked,
      previousEnvelope: envelopeReference(current),
      replayed: false,
      replayDoesNotEstablishCurrentUsability: true,
      correlationId: command.correlationId
    };
    await this.repository.commit({
      slotKey: key,
      expectedCurrent: {
        kind: 'EXACT',
        controlledHandoffId: current.controlledHandoffId,
        version: current.version
      },
      previous: current,
      next: revoked,
      replayKey: command.idempotencyKey,
      replay: {
        fingerprint: command.commandFingerprintSha256,
        actorId: principal.actorId,
        principalReference: principal.principalReference,
        result
      }
    });
    return clone(result);
  }

  async validateCurrent(
    principal: Pick<ControlledHandoffPrincipal, 'workspaceId'>,
    input: {
      envelope: { controlledHandoffId: ControlledHandoffId; version: number };
      purpose: ControlledHandoffValidationPurpose;
      attempt: ControlledHandoffConsumptionAttemptV1;
    }
  ): Promise<ControlledHandoffCurrentValidationV1> {
    const envelope = await this.repository.findLatest(input.envelope.controlledHandoffId);
    if (!envelope || envelope.originatingWorkspaceId !== principal.workspaceId) {
      throw new ControlledHandoffError('HANDOFF_NOT_FOUND', 404, 'Controlled Handoff was not found.');
    }
    const deny = (
      denialReason: ControlledHandoffValidationDenialReason,
      checkedAuthorityReferences: readonly string[] = []
    ): ControlledHandoffCurrentValidationV1 => ({
      schemaVersion: 1,
      envelope: input.envelope,
      purpose: input.purpose,
      attempt: clone(input.attempt),
      evaluatedAt: this.now(),
      validationPolicyVersion,
      checkedAuthorityReferences: [...checkedAuthorityReferences],
      authorityConsequences: noDownstreamHandoffAuthorityConsequences,
      validationIsNotBearerCapability: true,
      validationDoesNotAuthorizeDownstreamAction: true,
      decision: 'DENY',
      currentlyUsable: false,
      currentExactDisclosurePermitted: false,
      denialReason,
      publicReason: `Controlled Handoff current validation denied: ${denialReason}.`
    });
    if (!sameEnvelopeReference(input.envelope, envelopeReference(envelope))) {
      return deny('SOURCE_VERSION_MISMATCH');
    }
    if (envelope.status === 'REVOKED') return deny('HANDOFF_REVOKED');
    const attemptedAt = Date.parse(input.attempt.attemptedAt);
    if (!Number.isFinite(attemptedAt)) return deny('SOURCE_ACCESS_NOT_CURRENT');
    if (attemptedAt < Date.parse(envelope.validFrom)) return deny('HANDOFF_NOT_YET_VALID');
    if (attemptedAt >= Date.parse(envelope.validUntil)) return deny('HANDOFF_EXPIRED');
    if (input.attempt.originatingWorkspaceId !== envelope.originatingWorkspaceId) {
      return deny('WRONG_ORIGINATING_WORKSPACE');
    }
    if (
      input.attempt.recipientProviderId !== envelope.recipient.providerId ||
      input.attempt.recipientProviderWorkspaceId !== envelope.recipient.providerWorkspaceId
    ) {
      return deny('WRONG_RECIPIENT');
    }
    if (input.attempt.purposeFingerprintSha256 !== envelope.purpose.purposeFingerprintSha256) {
      return deny('PURPOSE_MISMATCH');
    }
    if (
      input.attempt.projectionFingerprintSha256 !==
        envelope.authorizedProjection.projectionFingerprintSha256 ||
      input.attempt.sourceSetFingerprintSha256 !== envelope.authorizedProjection.sourceSetFingerprintSha256
    ) {
      return deny('PROJECTION_MISMATCH');
    }
    const snapshot = await this.evaluateAuthority({
      envelope,
      purpose: input.purpose,
      attempt: input.attempt
    });
    const authorityDenial = denialFromAuthority(snapshot, input.attempt.artifactRetrievalRequested);
    if (authorityDenial) return deny(authorityDenial, snapshot.checkedAuthorityReferences);
    return {
      schemaVersion: 1,
      envelope: input.envelope,
      purpose: input.purpose,
      attempt: clone(input.attempt),
      evaluatedAt: this.now(),
      validationPolicyVersion,
      checkedAuthorityReferences: [...snapshot.checkedAuthorityReferences],
      authorityConsequences: noDownstreamHandoffAuthorityConsequences,
      validationIsNotBearerCapability: true,
      validationDoesNotAuthorizeDownstreamAction: true,
      decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
      currentlyUsable: true,
      currentExactDisclosurePermitted: true,
      publicReason:
        'Current authority permits only the exact reviewed projection for this recipient and purpose.'
    };
  }

  private async evaluateAuthority(
    input: Parameters<ControlledHandoffCurrentAuthoritySource['evaluateCurrentAuthority']>[0]
  ): Promise<ControlledHandoffCurrentAuthoritySnapshot> {
    try {
      return await this.currentAuthority.evaluateCurrentAuthority(input);
    } catch {
      throw new ControlledHandoffError(
        'AUTHORITY_UNAVAILABLE',
        503,
        'Current Controlled Handoff authority is unavailable.',
        'AUTHORITY_UNAVAILABLE'
      );
    }
  }

  private throwAuthorityDenial(denial: ControlledHandoffValidationDenialReason): never {
    if (denial === 'AUTHORITY_UNAVAILABLE') {
      throw new ControlledHandoffError(
        'AUTHORITY_UNAVAILABLE',
        503,
        'Current Controlled Handoff authority is unavailable.',
        denial
      );
    }
    throw new ControlledHandoffError(
      'CURRENT_AUTHORITY_DENIED',
      409,
      `Current Controlled Handoff authority denied: ${denial}.`,
      denial
    );
  }

  private slotKeyFromEnvelope(envelope: ControlledHandoffEnvelopeV1): string {
    const selection = envelope.sourceLineage.selectionLineage.selection;
    return [
      'controlled-handoff',
      envelope.originatingWorkspaceId,
      selection.providerSelectionId,
      envelope.recipient.providerId,
      encodeURIComponent(envelope.purpose.contextReference)
    ].join(':');
  }
}
