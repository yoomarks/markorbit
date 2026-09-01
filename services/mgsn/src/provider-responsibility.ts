import { createHash, randomUUID } from 'node:crypto';
import type { MarkOrbitId } from '@markorbit/contracts';
import {
  noProviderResponsibilityAuthorityConsequences,
  type NoRebrokeringCommitmentState,
  type ProviderDirectExecutorAssessmentState,
  type ProviderDirectExecutorAssessmentV1,
  type ProviderDirectResponsibilityStatus,
  type ProviderFinalExecutorStatus,
  type ProviderIntermediaryDisclosureState,
  type ProviderLegallyRequiredDistinctSignerV1,
  type ProviderResponsibilityAuthorityState,
  type ProviderResponsibilityEvidenceReferenceV1,
  type ProviderResponsibilityExecutionTeamReferenceV1,
  type ProviderResponsibilityProfileId,
  type ProviderResponsibilityProfileV1
} from '@markorbit/contracts/provider-responsibility';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import type { ProviderRegistryRepository } from './provider-registry.js';

const assessmentPolicyVersion = 'mgsn-provider-responsibility-v1';
const sha256Pattern = /^[0-9a-f]{64}$/;

export interface ProviderResponsibilityPrincipal {
  workspaceId: string;
  actorId: string;
}

export interface ProviderResponsibilityVerifierPrincipal {
  actorId: string;
  verifierAuthorityReference: string;
  authority: 'MGSN_INTERNAL_RESPONSIBILITY_VERIFIER';
}

interface ResponsibilityDisclosure {
  finalExecutorStatus: ProviderFinalExecutorStatus;
  directResponsibilityStatus: ProviderDirectResponsibilityStatus;
  noRebrokeringCommitmentState: NoRebrokeringCommitmentState;
  intermediaryDisclosureState: ProviderIntermediaryDisclosureState;
  executionTeamReferences: readonly ProviderResponsibilityExecutionTeamReferenceV1[];
  legallyRequiredDistinctSigner: ProviderLegallyRequiredDistinctSignerV1;
  evidenceReferences: readonly ProviderResponsibilityEvidenceReferenceV1[];
  effectiveFrom: string;
  effectiveUntil?: string;
}

export interface CreateProviderResponsibilityProfileCommand extends ResponsibilityDisclosure {
  schemaVersion: 1;
  providerId: ProviderId;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface ReviseProviderResponsibilityProfileCommand extends ResponsibilityDisclosure {
  schemaVersion: 1;
  providerId: ProviderId;
  providerResponsibilityProfileId: ProviderResponsibilityProfileId;
  expectedProfileVersion: number;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface ChangeProviderResponsibilityProfileStatusCommand {
  schemaVersion: 1;
  providerId: ProviderId;
  providerResponsibilityProfileId: ProviderResponsibilityProfileId;
  expectedProfileVersion: number;
  action: 'SUSPEND' | 'RESUME' | 'REVOKE';
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface RecordProviderResponsibilityVerificationCommand {
  schemaVersion: 1;
  providerId: ProviderId;
  providerWorkspaceId: string;
  providerResponsibilityProfileId: ProviderResponsibilityProfileId;
  expectedProfileVersion: number;
  directResponsibilityStatus: ProviderDirectResponsibilityStatus;
  authorityState: ProviderResponsibilityAuthorityState;
  evidenceReferences: readonly ProviderResponsibilityEvidenceReferenceV1[];
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface RevalidateProviderResponsibilityCurrentAuthorityCommand {
  schemaVersion: 1;
  providerId: ProviderId;
  providerWorkspaceId: string;
  providerResponsibilityProfileId: ProviderResponsibilityProfileId;
  expectedProfileVersion: number;
  evidenceReferences: readonly ProviderResponsibilityEvidenceReferenceV1[];
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export type ProviderResponsibilityErrorCode =
  | 'INVALID_INPUT'
  | 'PROVIDER_NOT_FOUND'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_ALREADY_EXISTS'
  | 'PROFILE_REVOKED'
  | 'INVALID_PROFILE_TRANSITION'
  | 'STALE_PROFILE'
  | 'CURRENT_AUTHORITY_REVALIDATION_REQUIRED'
  | 'SELF_VERIFICATION_FORBIDDEN'
  | 'INVALID_VERIFIER_AUTHORITY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class ProviderResponsibilityError extends Error {
  constructor(
    public readonly code: ProviderResponsibilityErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'ProviderResponsibilityError';
  }
}

export type ProviderResponsibilityAuditAction =
  | 'CREATED'
  | 'REVISED'
  | 'SUSPENDED'
  | 'RESUMED'
  | 'REVOKED'
  | 'VERIFICATION_RECORDED'
  | 'VERIFICATION_CORRECTED'
  | 'CURRENT_AUTHORITY_REVALIDATED'
  | 'DISPUTE_RECORDED'
  | 'VIOLATION_RECORDED';

export interface ProviderResponsibilityAuditEvent {
  providerResponsibilityProfileId: ProviderResponsibilityProfileId;
  providerId: ProviderId;
  providerWorkspaceId: string;
  previousVersion: number | null;
  newVersion: number;
  action: ProviderResponsibilityAuditAction;
  actorReference: string;
  requestFingerprintSha256: string;
  occurredAt: string;
}

export type ProviderResponsibilityCommandType =
  'CREATE' | 'REVISE' | 'SUSPEND' | 'RESUME' | 'REVOKE' | 'VERIFY' | 'REVALIDATE_CURRENT_AUTHORITY';

export interface ProviderResponsibilityReplayRecord {
  scopeKey: string;
  idempotencyKey: string;
  requestFingerprintSha256: string;
  commandType: ProviderResponsibilityCommandType;
  response: ProviderResponsibilityProfileV1;
}

export interface ProviderResponsibilityCommit {
  providerId: ProviderId;
  providerWorkspaceId: string;
  expectedCurrentProfileId: ProviderResponsibilityProfileId | null;
  expectedCurrentProfileVersion: number | null;
  profile: ProviderResponsibilityProfileV1;
  replay: ProviderResponsibilityReplayRecord;
  audit: ProviderResponsibilityAuditEvent;
}

export interface ProviderResponsibilityRepository {
  findCurrentProfile(
    providerId: ProviderId,
    providerWorkspaceId: string
  ): Promise<ProviderResponsibilityProfileV1 | undefined>;
  findLatestProfile(
    providerResponsibilityProfileId: ProviderResponsibilityProfileId
  ): Promise<ProviderResponsibilityProfileV1 | undefined>;
  findReplay(
    scopeKey: string,
    idempotencyKey: string
  ): Promise<ProviderResponsibilityReplayRecord | undefined>;
  commit(
    mutation: ProviderResponsibilityCommit
  ): Promise<ProviderResponsibilityReplayRecord | undefined>;
  listProfileHistory(
    providerResponsibilityProfileId: ProviderResponsibilityProfileId
  ): Promise<ProviderResponsibilityProfileV1[]>;
  listAuditHistory(
    providerResponsibilityProfileId: ProviderResponsibilityProfileId
  ): Promise<ProviderResponsibilityAuditEvent[]>;
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function bindingKey(providerId: ProviderId, providerWorkspaceId: string): string {
  return `${providerWorkspaceId.toLowerCase()}:${providerId}`;
}

function replayKey(scopeKey: string, idempotencyKey: string): string {
  return `${scopeKey}:${idempotencyKey}`;
}

/** Migration-ready atomic reference repository. Durable PostgreSQL wiring is a later owner task. */
export class InMemoryProviderResponsibilityRepository implements ProviderResponsibilityRepository {
  private readonly currentByBinding = new Map<string, ProviderResponsibilityProfileId>();
  private readonly histories = new Map<
    ProviderResponsibilityProfileId,
    ProviderResponsibilityProfileV1[]
  >();
  private readonly replays = new Map<string, ProviderResponsibilityReplayRecord>();
  private readonly audits = new Map<
    ProviderResponsibilityProfileId,
    ProviderResponsibilityAuditEvent[]
  >();

  async findCurrentProfile(providerId: ProviderId, providerWorkspaceId: string) {
    const profileId = this.currentByBinding.get(bindingKey(providerId, providerWorkspaceId));
    return profileId ? this.findLatestProfile(profileId) : undefined;
  }

  findLatestProfile(providerResponsibilityProfileId: ProviderResponsibilityProfileId) {
    const latest = this.histories.get(providerResponsibilityProfileId)?.at(-1);
    return Promise.resolve(latest ? copy(latest) : undefined);
  }

  findReplay(scopeKey: string, idempotencyKey: string) {
    const replay = this.replays.get(replayKey(scopeKey, idempotencyKey));
    return Promise.resolve(replay ? copy(replay) : undefined);
  }

  // Deliberately contains no await: CAS, history, replay, audit and pointer commit in one JS turn.
  commit(
    mutation: ProviderResponsibilityCommit
  ): Promise<ProviderResponsibilityReplayRecord | undefined> {
    const committedReplay = this.replays.get(
      replayKey(mutation.replay.scopeKey, mutation.replay.idempotencyKey)
    );
    if (committedReplay) {
      if (
        committedReplay.requestFingerprintSha256 !== mutation.replay.requestFingerprintSha256 ||
        committedReplay.commandType !== mutation.replay.commandType
      )
        throw new ProviderResponsibilityError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different trusted context or command payload.',
          409
        );
      return Promise.resolve(copy(committedReplay));
    }

    const key = bindingKey(mutation.providerId, mutation.providerWorkspaceId);
    const currentProfileId = this.currentByBinding.get(key) ?? null;
    const current = currentProfileId ? this.histories.get(currentProfileId)?.at(-1) : undefined;
    if (
      currentProfileId !== mutation.expectedCurrentProfileId ||
      (current?.version ?? null) !== mutation.expectedCurrentProfileVersion
    )
      throw new ProviderResponsibilityError(
        'STALE_PROFILE',
        'Provider Responsibility changed; reload the exact current profile version.',
        409
      );

    const history = this.histories.get(mutation.profile.providerResponsibilityProfileId) ?? [];
    const previous = history.at(-1);
    if (previous?.status === 'REVOKED')
      throw new ProviderResponsibilityError(
        'PROFILE_REVOKED',
        'Revoked Provider Responsibility cannot be revived; create a fresh profile.',
        409
      );
    if (mutation.profile.version !== (previous?.version ?? 0) + 1)
      throw new ProviderResponsibilityError(
        'STALE_PROFILE',
        'Provider Responsibility history is not appendable at the requested version.',
        409
      );
    if (
      previous &&
      (previous.providerId !== mutation.profile.providerId ||
        previous.providerWorkspaceId.toLowerCase() !==
          mutation.profile.providerWorkspaceId.toLowerCase())
    )
      throw new ProviderResponsibilityError(
        'INVALID_INPUT',
        'Provider Responsibility identity binding is immutable.',
        422
      );

    this.histories.set(mutation.profile.providerResponsibilityProfileId, [
      ...history,
      copy(mutation.profile)
    ]);
    this.currentByBinding.set(key, mutation.profile.providerResponsibilityProfileId);
    this.replays.set(
      replayKey(mutation.replay.scopeKey, mutation.replay.idempotencyKey),
      copy(mutation.replay)
    );
    const auditHistory = this.audits.get(mutation.profile.providerResponsibilityProfileId) ?? [];
    this.audits.set(mutation.profile.providerResponsibilityProfileId, [
      ...auditHistory,
      copy(mutation.audit)
    ]);
    return Promise.resolve(undefined);
  }

  listProfileHistory(providerResponsibilityProfileId: ProviderResponsibilityProfileId) {
    return Promise.resolve(copy(this.histories.get(providerResponsibilityProfileId) ?? []));
  }

  listAuditHistory(providerResponsibilityProfileId: ProviderResponsibilityProfileId) {
    return Promise.resolve(copy(this.audits.get(providerResponsibilityProfileId) ?? []));
  }
}

export interface ProviderDirectExecutorAssessmentResult {
  state: ProviderDirectExecutorAssessmentState;
  assessment: ProviderDirectExecutorAssessmentV1 | null;
}

function cleanText(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maximum)
    throw new ProviderResponsibilityError(
      'INVALID_INPUT',
      `${field} must be a non-empty string no longer than ${maximum} characters.`,
      422
    );
  return value.trim();
}

function positiveVersion(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new ProviderResponsibilityError(
      'INVALID_INPUT',
      `${field} must be a positive integer.`,
      422
    );
  return Number(value);
}

function instant(value: unknown, field: string): string {
  const text = cleanText(value, field, 100);
  if (!Number.isFinite(Date.parse(text)))
    throw new ProviderResponsibilityError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return text;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function profileScope(providerWorkspaceId: string, providerId: ProviderId): string {
  return `provider-responsibility:${providerWorkspaceId.toLowerCase()}:${providerId}`;
}

function validateSigner(
  intermediaryDisclosureState: ProviderIntermediaryDisclosureState,
  signer: ProviderLegallyRequiredDistinctSignerV1
): void {
  if (signer.kind === 'NONE') {
    if (signer.distinctSignerRequired !== false)
      throw new ProviderResponsibilityError(
        'INVALID_INPUT',
        'Signer disclosure is malformed.',
        422
      );
    if (intermediaryDisclosureState === 'LEGALLY_REQUIRED_SIGNER_ONLY')
      throw new ProviderResponsibilityError(
        'INVALID_INPUT',
        'A legally required signer disclosure requires an exact signer reference.',
        422
      );
    return;
  }
  cleanText(signer.signerReference, 'signerReference');
  cleanText(signer.signerIdentityAuthorityReference, 'signerIdentityAuthorityReference');
  cleanText(signer.legalBasisReference, 'legalBasisReference');
  cleanText(signer.jurisdiction, 'jurisdiction', 100);
  if (
    signer.distinctSignerRequired !== true ||
    signer.function !== 'SIGNING_OR_FILING_ONLY' ||
    signer.transparentlyDisclosed !== true ||
    signer.receivesHandoffDataByDefault !== false ||
    signer.doesNotReplaceFinalExecutionProvider !== true ||
    intermediaryDisclosureState !== 'LEGALLY_REQUIRED_SIGNER_ONLY'
  )
    throw new ProviderResponsibilityError(
      'INVALID_INPUT',
      'The distinct signer must be transparent, legally bounded, receive no default Handoff data and not replace the final Provider.',
      422
    );
}

function validateTeamReferences(
  references: readonly ProviderResponsibilityExecutionTeamReferenceV1[]
): void {
  if (references.length > 100)
    throw new ProviderResponsibilityError(
      'INVALID_INPUT',
      'Execution team references are invalid.',
      422
    );
  for (const reference of references) {
    cleanText(reference.teamReference, 'teamReference');
    cleanText(reference.roleReference, 'roleReference');
    cleanText(reference.identityAuthorityReference, 'identityAuthorityReference');
    if (reference.contactDataEmbedded !== false)
      throw new ProviderResponsibilityError(
        'INVALID_INPUT',
        'Execution team references cannot embed contact data.',
        422
      );
  }
}

function validateEvidenceReference(reference: ProviderResponsibilityEvidenceReferenceV1): void {
  cleanText(reference.evidenceReference, 'evidenceReference');
  cleanText(reference.sourceType, 'sourceType');
  cleanText(reference.sourceId, 'sourceId');
  if (
    (typeof reference.sourceVersion !== 'string' &&
      (!Number.isInteger(reference.sourceVersion) || reference.sourceVersion < 1)) ||
    (typeof reference.sourceVersion === 'string' && reference.sourceVersion.trim().length === 0)
  )
    throw new ProviderResponsibilityError('INVALID_INPUT', 'sourceVersion is invalid.', 422);
  if (!sha256Pattern.test(reference.sourceFingerprintSha256))
    throw new ProviderResponsibilityError(
      'INVALID_INPUT',
      'sourceFingerprintSha256 must be a lowercase SHA-256 value.',
      422
    );
  instant(reference.observedAt, 'observedAt');
  const effectiveFrom = reference.effectiveFrom
    ? instant(reference.effectiveFrom, 'evidence.effectiveFrom')
    : undefined;
  const effectiveUntil = reference.effectiveUntil
    ? instant(reference.effectiveUntil, 'evidence.effectiveUntil')
    : undefined;
  if (effectiveFrom && effectiveUntil && Date.parse(effectiveUntil) <= Date.parse(effectiveFrom))
    throw new ProviderResponsibilityError(
      'INVALID_INPUT',
      'Evidence effectiveUntil must be after effectiveFrom.',
      422
    );
  if (reference.artifactAccessAuthorized !== false)
    throw new ProviderResponsibilityError(
      'INVALID_INPUT',
      'Evidence references never authorize artifact access.',
      422
    );
}

function validateEvidence(
  references: readonly ProviderResponsibilityEvidenceReferenceV1[],
  origin: 'PROVIDER' | 'VERIFIER'
): void {
  if (references.length > 100)
    throw new ProviderResponsibilityError('INVALID_INPUT', 'Evidence references are invalid.', 422);
  const seen = new Set<string>();
  for (const reference of references) {
    validateEvidenceReference(reference);
    if (seen.has(reference.evidenceReference))
      throw new ProviderResponsibilityError(
        'INVALID_INPUT',
        'Evidence references must be unique within a profile version.',
        422
      );
    seen.add(reference.evidenceReference);
    if (
      origin === 'PROVIDER' &&
      (reference.verificationState !== 'CLAIM_ONLY' ||
        !['PROVIDER_ATTESTATION', 'ORGANIZATION_ATTESTATION'].includes(reference.authorityClass))
    )
      throw new ProviderResponsibilityError(
        'SELF_VERIFICATION_FORBIDDEN',
        'Provider disclosure cannot create independently verified evidence or verifier authority.',
        403
      );
  }
}

function validateDisclosure(disclosure: ResponsibilityDisclosure, origin: 'PROVIDER' | 'VERIFIER') {
  const effectiveFrom = instant(disclosure.effectiveFrom, 'effectiveFrom');
  const effectiveUntil = disclosure.effectiveUntil
    ? instant(disclosure.effectiveUntil, 'effectiveUntil')
    : undefined;
  if (effectiveUntil && Date.parse(effectiveUntil) <= Date.parse(effectiveFrom))
    throw new ProviderResponsibilityError(
      'INVALID_INPUT',
      'effectiveUntil must be after effectiveFrom.',
      422
    );
  validateSigner(disclosure.intermediaryDisclosureState, disclosure.legallyRequiredDistinctSigner);
  validateTeamReferences(disclosure.executionTeamReferences);
  validateEvidence(disclosure.evidenceReferences, origin);
  if (origin === 'PROVIDER' && disclosure.directResponsibilityStatus === 'VERIFIED')
    throw new ProviderResponsibilityError(
      'SELF_VERIFICATION_FORBIDDEN',
      'Provider disclosure cannot establish VERIFIED responsibility.',
      403
    );
}

function isCurrentAt(from: string, until: string | undefined, checkedAt: string): boolean {
  const checked = Date.parse(checkedAt);
  return Date.parse(from) <= checked && (until === undefined || checked < Date.parse(until));
}

function isAppropriateIndependentEvidence(
  evidence: ProviderResponsibilityEvidenceReferenceV1,
  checkedAt: string
): boolean {
  return (
    evidence.verificationState === 'INDEPENDENTLY_VERIFIED' &&
    ['MGSN_VERIFIED_REFERENCE', 'CANONICAL_OWNER_REFERENCE'].includes(evidence.authorityClass) &&
    isCurrentAt(evidence.effectiveFrom ?? evidence.observedAt, evidence.effectiveUntil, checkedAt)
  );
}

function assessmentFingerprint(
  value: Omit<ProviderDirectExecutorAssessmentV1, 'assessmentFingerprintSha256'>
) {
  return fingerprint(value);
}

function negativeAssessment(
  profile: ProviderResponsibilityProfileV1,
  checkedAt: string,
  state: Exclude<
    ProviderDirectExecutorAssessmentState,
    'DIRECT_FINAL_EXECUTOR_ESTABLISHED' | 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED'
  >,
  publicReason: string
): ProviderDirectExecutorAssessmentV1 {
  const base = {
    schemaVersion: 1 as const,
    provider: {
      providerId: profile.providerId,
      providerWorkspaceId: profile.providerWorkspaceId
    },
    profile: {
      providerResponsibilityProfileId: profile.providerResponsibilityProfileId,
      version: profile.version,
      profileFingerprintSha256: profile.profileFingerprintSha256
    },
    state,
    directExecutorEstablished: false as const,
    profileAuthorityState: profile.authorityState,
    publicReason,
    evidenceReferences: profile.evidenceReferences.map((reference) => reference.evidenceReference),
    checkedAt,
    assessmentPolicyVersion,
    hiddenIntermediaryAllowed: false as const,
    currentAuthorityRevalidationRequiredBeforeUse: true as const,
    authorityConsequences: noProviderResponsibilityAuthorityConsequences
  };
  return { ...base, assessmentFingerprintSha256: assessmentFingerprint(base) };
}

/** Pure deterministic fail-closed assessment for an exact profile and check time. */
export function assessProviderDirectExecutor(
  profile: ProviderResponsibilityProfileV1,
  checkedAtInput: string
): ProviderDirectExecutorAssessmentV1 {
  const checkedAt = instant(checkedAtInput, 'checkedAt');
  if (profile.status === 'SUSPENDED')
    return negativeAssessment(
      profile,
      checkedAt,
      'PROFILE_SUSPENDED',
      'The responsibility profile is suspended.'
    );
  if (profile.status === 'REVOKED')
    return negativeAssessment(
      profile,
      checkedAt,
      'PROFILE_REVOKED',
      'The responsibility profile is revoked.'
    );
  if (profile.authorityState === 'UNAVAILABLE')
    return negativeAssessment(
      profile,
      checkedAt,
      'AUTHORITY_UNAVAILABLE',
      'Current responsibility authority is unavailable.'
    );
  if (
    profile.authorityState !== 'CURRENT' ||
    !isCurrentAt(profile.effectiveFrom, profile.effectiveUntil, checkedAt)
  )
    return negativeAssessment(
      profile,
      checkedAt,
      'AUTHORITY_NOT_CURRENT',
      'Current responsibility authority is not established.'
    );
  if (
    profile.directResponsibilityStatus === 'DISPUTED' ||
    profile.evidenceReferences.some((evidence) => evidence.verificationState === 'DISPUTED')
  )
    return negativeAssessment(
      profile,
      checkedAt,
      'RESPONSIBILITY_DISPUTED',
      'Direct responsibility is disputed.'
    );
  if (profile.intermediaryDisclosureState === 'REBROKERING_OR_SUBAGENT_DISCLOSED')
    return negativeAssessment(
      profile,
      checkedAt,
      'REBROKERING_OR_SUBAGENT_DISCLOSED',
      'Rebrokering or a sub-agent is disclosed.'
    );
  if (profile.finalExecutorStatus === 'PROVIDER_IS_NOT_FINAL_EXECUTOR')
    return negativeAssessment(
      profile,
      checkedAt,
      'PROVIDER_NOT_FINAL_EXECUTOR',
      'The Provider is not the final executor.'
    );
  if (profile.noRebrokeringCommitmentState !== 'COMMITTED')
    return negativeAssessment(
      profile,
      checkedAt,
      'NO_REBROKERING_COMMITMENT_NOT_CURRENT',
      'The no-rebrokering commitment is not current.'
    );
  if (
    profile.finalExecutorStatus !== 'PROVIDER_IS_FINAL_EXECUTOR' ||
    profile.directResponsibilityStatus !== 'VERIFIED' ||
    profile.evidenceReferences.some((evidence) => evidence.verificationState === 'REVOKED')
  )
    return negativeAssessment(
      profile,
      checkedAt,
      'UNKNOWN_OR_UNPROVEN',
      'Direct execution is unknown or unproven.'
    );
  const independentEvidence = profile.evidenceReferences.filter((evidence) =>
    isAppropriateIndependentEvidence(evidence, checkedAt)
  );
  if (independentEvidence.length === 0)
    return negativeAssessment(
      profile,
      checkedAt,
      'UNKNOWN_OR_UNPROVEN',
      'Current independently verified evidence is unavailable.'
    );

  const common = {
    schemaVersion: 1 as const,
    provider: {
      providerId: profile.providerId,
      providerWorkspaceId: profile.providerWorkspaceId
    },
    profile: {
      providerResponsibilityProfileId: profile.providerResponsibilityProfileId,
      version: profile.version,
      profileFingerprintSha256: profile.profileFingerprintSha256
    },
    directExecutorEstablished: true as const,
    profileAuthorityState: 'CURRENT' as const,
    finalExecutionProviderId: profile.providerId,
    finalExecutionProviderWorkspaceId: profile.providerWorkspaceId,
    evidenceReferences: independentEvidence.map((evidence) => evidence.evidenceReference),
    checkedAt,
    assessmentPolicyVersion,
    hiddenIntermediaryAllowed: false as const,
    currentAuthorityRevalidationRequiredBeforeUse: true as const,
    authorityConsequences: noProviderResponsibilityAuthorityConsequences
  };
  const result =
    profile.intermediaryDisclosureState === 'LEGALLY_REQUIRED_SIGNER_ONLY' &&
    profile.legallyRequiredDistinctSigner.kind === 'REQUIRED'
      ? {
          ...common,
          state: 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED' as const,
          legallyRequiredDistinctSigner: profile.legallyRequiredDistinctSigner
        }
      : {
          ...common,
          state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED' as const,
          legallyRequiredDistinctSigner: { kind: 'NONE', distinctSignerRequired: false } as const
        };
  return { ...result, assessmentFingerprintSha256: assessmentFingerprint(result) };
}

type ProviderLookup = Pick<ProviderRegistryRepository, 'findProviderById'>;

export class ProviderResponsibilityService {
  constructor(
    private readonly repository: ProviderResponsibilityRepository,
    private readonly providerRegistry: ProviderLookup,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextProfileId: () => ProviderResponsibilityProfileId = () =>
      `provider-responsibility_${randomUUID()}`
  ) {}

  async createProfile(
    principal: ProviderResponsibilityPrincipal,
    command: CreateProviderResponsibilityProfileCommand
  ): Promise<ProviderResponsibilityProfileV1> {
    this.assertSchema(command.schemaVersion);
    const providerWorkspaceId = await this.assertProviderBinding(principal, command.providerId);
    const actorId = cleanText(principal.actorId, 'principal.actorId');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 200);
    const correlationId = cleanText(command.correlationId, 'correlationId') as MarkOrbitId;
    validateDisclosure(command, 'PROVIDER');
    const scopeKey = profileScope(providerWorkspaceId, command.providerId);
    const requestFingerprintSha256 = fingerprint({
      commandType: 'CREATE',
      providerWorkspaceId,
      actorId,
      ...command
    });
    const replay = await this.replay(scopeKey, idempotencyKey, requestFingerprintSha256, 'CREATE');
    if (replay) return replay;
    const current = await this.repository.findCurrentProfile(
      command.providerId,
      providerWorkspaceId
    );
    if (current && current.status !== 'REVOKED')
      throw new ProviderResponsibilityError(
        'PROFILE_ALREADY_EXISTS',
        'A current Provider Responsibility profile already exists.',
        409
      );
    const at = this.now();
    const profile = this.buildProfile({
      profileId: this.nextProfileId(),
      providerId: command.providerId,
      providerWorkspaceId,
      status: 'CURRENT',
      disclosure: command,
      authorityState: 'CURRENT',
      checkedAt: at,
      version: 1,
      correlationId
    });
    return this.commit({
      profile,
      current,
      actorReference: actorId,
      action: 'CREATED',
      commandType: 'CREATE',
      scopeKey,
      idempotencyKey,
      requestFingerprintSha256
    });
  }

  async reviseProfile(
    principal: ProviderResponsibilityPrincipal,
    command: ReviseProviderResponsibilityProfileCommand
  ): Promise<ProviderResponsibilityProfileV1> {
    this.assertSchema(command.schemaVersion);
    const providerWorkspaceId = await this.assertProviderBinding(principal, command.providerId);
    const actorId = cleanText(principal.actorId, 'principal.actorId');
    const expectedVersion = positiveVersion(
      command.expectedProfileVersion,
      'expectedProfileVersion'
    );
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 200);
    const correlationId = cleanText(command.correlationId, 'correlationId') as MarkOrbitId;
    validateDisclosure(command, 'PROVIDER');
    const scopeKey = profileScope(providerWorkspaceId, command.providerId);
    const requestFingerprintSha256 = fingerprint({
      commandType: 'REVISE',
      providerWorkspaceId,
      actorId,
      ...command
    });
    const replay = await this.replay(scopeKey, idempotencyKey, requestFingerprintSha256, 'REVISE');
    if (replay) return replay;
    const current = await this.requireCurrent(
      command.providerId,
      providerWorkspaceId,
      command.providerResponsibilityProfileId
    );
    this.assertMutable(current, expectedVersion);
    const at = this.now();
    const profile = this.buildProfile({
      profileId: current.providerResponsibilityProfileId,
      providerId: current.providerId,
      providerWorkspaceId,
      status: 'CURRENT',
      disclosure: command,
      authorityState: current.authorityState,
      checkedAt: at,
      version: current.version + 1,
      correlationId
    });
    const action: ProviderResponsibilityAuditAction =
      profile.directResponsibilityStatus === 'DISPUTED' &&
      current.directResponsibilityStatus !== 'DISPUTED'
        ? 'DISPUTE_RECORDED'
        : profile.noRebrokeringCommitmentState === 'VIOLATION_RECORDED' &&
            current.noRebrokeringCommitmentState !== 'VIOLATION_RECORDED'
          ? 'VIOLATION_RECORDED'
          : 'REVISED';
    return this.commit({
      profile,
      current,
      actorReference: actorId,
      action,
      commandType: 'REVISE',
      scopeKey,
      idempotencyKey,
      requestFingerprintSha256
    });
  }

  async changeStatus(
    principal: ProviderResponsibilityPrincipal,
    command: ChangeProviderResponsibilityProfileStatusCommand
  ): Promise<ProviderResponsibilityProfileV1> {
    this.assertSchema(command.schemaVersion);
    const providerWorkspaceId = await this.assertProviderBinding(principal, command.providerId);
    const actorId = cleanText(principal.actorId, 'principal.actorId');
    const expectedVersion = positiveVersion(
      command.expectedProfileVersion,
      'expectedProfileVersion'
    );
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 200);
    const correlationId = cleanText(command.correlationId, 'correlationId') as MarkOrbitId;
    const commandType = command.action;
    if (!['SUSPEND', 'RESUME', 'REVOKE'].includes(commandType))
      throw new ProviderResponsibilityError('INVALID_INPUT', 'Unknown profile action.', 422);
    const scopeKey = profileScope(providerWorkspaceId, command.providerId);
    const requestFingerprintSha256 = fingerprint({
      commandType,
      providerWorkspaceId,
      actorId,
      ...command
    });
    const replay = await this.replay(
      scopeKey,
      idempotencyKey,
      requestFingerprintSha256,
      commandType
    );
    if (replay) return replay;
    const current = await this.requireCurrent(
      command.providerId,
      providerWorkspaceId,
      command.providerResponsibilityProfileId
    );
    if (current.status === 'REVOKED')
      throw new ProviderResponsibilityError(
        'PROFILE_REVOKED',
        'Revoked responsibility is terminal.',
        409
      );
    if (current.version !== expectedVersion)
      throw new ProviderResponsibilityError(
        'STALE_PROFILE',
        'Provider Responsibility version is stale.',
        409
      );
    const valid =
      (command.action === 'SUSPEND' && current.status === 'CURRENT') ||
      (command.action === 'RESUME' && current.status === 'SUSPENDED') ||
      command.action === 'REVOKE';
    if (!valid)
      throw new ProviderResponsibilityError(
        'INVALID_PROFILE_TRANSITION',
        `${current.status} cannot transition through ${command.action}.`,
        409
      );
    if (command.action === 'RESUME')
      await this.assertCurrentAuthorityRevalidatedAfterSuspension(current);
    const status =
      command.action === 'SUSPEND'
        ? 'SUSPENDED'
        : command.action === 'RESUME'
          ? 'CURRENT'
          : 'REVOKED';
    const at = this.now();
    const profile = this.buildProfile({
      profileId: current.providerResponsibilityProfileId,
      providerId: current.providerId,
      providerWorkspaceId,
      status,
      disclosure: current,
      authorityState:
        command.action === 'SUSPEND' && current.authorityState === 'CURRENT'
          ? 'STALE'
          : current.authorityState,
      checkedAt: at,
      version: current.version + 1,
      correlationId
    });
    return this.commit({
      profile,
      current,
      actorReference: actorId,
      action:
        command.action === 'SUSPEND'
          ? 'SUSPENDED'
          : command.action === 'RESUME'
            ? 'RESUMED'
            : 'REVOKED',
      commandType,
      scopeKey,
      idempotencyKey,
      requestFingerprintSha256
    });
  }

  async recordVerification(
    principal: ProviderResponsibilityVerifierPrincipal,
    command: RecordProviderResponsibilityVerificationCommand
  ): Promise<ProviderResponsibilityProfileV1> {
    this.assertSchema(command.schemaVersion);
    if (principal.authority !== 'MGSN_INTERNAL_RESPONSIBILITY_VERIFIER')
      throw new ProviderResponsibilityError(
        'INVALID_VERIFIER_AUTHORITY',
        'A governed MGSN responsibility verifier is required.',
        403
      );
    const actorId = cleanText(principal.actorId, 'principal.actorId');
    const verifierAuthorityReference = cleanText(
      principal.verifierAuthorityReference,
      'verifierAuthorityReference'
    );
    const { providerWorkspaceId: requestedProviderWorkspaceId, ...verificationCommand } = command;
    const providerWorkspaceId = cleanText(
      requestedProviderWorkspaceId,
      'providerWorkspaceId',
      100
    ).toLowerCase();
    await this.assertExactProviderBinding(command.providerId, providerWorkspaceId);
    const expectedVersion = positiveVersion(
      command.expectedProfileVersion,
      'expectedProfileVersion'
    );
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 200);
    const correlationId = cleanText(command.correlationId, 'correlationId') as MarkOrbitId;
    validateEvidence(command.evidenceReferences, 'VERIFIER');
    if (command.directResponsibilityStatus === 'ATTESTED')
      throw new ProviderResponsibilityError(
        'INVALID_INPUT',
        'Governed verification cannot rewrite responsibility as Provider attestation.',
        422
      );
    const scopeKey = profileScope(providerWorkspaceId, command.providerId);
    const requestFingerprintSha256 = fingerprint({
      commandType: 'VERIFY',
      ...verificationCommand,
      providerWorkspaceId,
      actorId,
      verifierAuthorityReference
    });
    const replay = await this.replay(scopeKey, idempotencyKey, requestFingerprintSha256, 'VERIFY');
    if (replay) return replay;
    const current = await this.requireCurrent(
      command.providerId,
      providerWorkspaceId,
      command.providerResponsibilityProfileId
    );
    this.assertMutable(current, expectedVersion);
    const at = this.now();
    const profile = this.buildProfile({
      profileId: current.providerResponsibilityProfileId,
      providerId: current.providerId,
      providerWorkspaceId,
      status: 'CURRENT',
      disclosure: {
        ...current,
        directResponsibilityStatus: command.directResponsibilityStatus,
        evidenceReferences: command.evidenceReferences
      },
      authorityState: command.authorityState,
      checkedAt: at,
      version: current.version + 1,
      correlationId
    });
    const action: ProviderResponsibilityAuditAction =
      command.directResponsibilityStatus === 'DISPUTED' ||
      command.evidenceReferences.some((reference) => reference.verificationState === 'DISPUTED')
        ? 'DISPUTE_RECORDED'
        : current.directResponsibilityStatus === 'VERIFIED'
          ? 'VERIFICATION_CORRECTED'
          : 'VERIFICATION_RECORDED';
    return this.commit({
      profile,
      current,
      actorReference: `${actorId}:${verifierAuthorityReference}`,
      action,
      commandType: 'VERIFY',
      scopeKey,
      idempotencyKey,
      requestFingerprintSha256
    });
  }

  async revalidateCurrentAuthority(
    principal: ProviderResponsibilityVerifierPrincipal,
    command: RevalidateProviderResponsibilityCurrentAuthorityCommand
  ): Promise<ProviderResponsibilityProfileV1> {
    this.assertSchema(command.schemaVersion);
    this.assertVerifierAuthority(principal);
    const actorId = cleanText(principal.actorId, 'principal.actorId');
    const verifierAuthorityReference = cleanText(
      principal.verifierAuthorityReference,
      'verifierAuthorityReference'
    );
    const { providerWorkspaceId: requestedProviderWorkspaceId, ...revalidationCommand } = command;
    const providerWorkspaceId = cleanText(
      requestedProviderWorkspaceId,
      'providerWorkspaceId',
      100
    ).toLowerCase();
    await this.assertExactProviderBinding(command.providerId, providerWorkspaceId);
    const expectedVersion = positiveVersion(
      command.expectedProfileVersion,
      'expectedProfileVersion'
    );
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 200);
    const correlationId = cleanText(command.correlationId, 'correlationId') as MarkOrbitId;
    validateEvidence(command.evidenceReferences, 'VERIFIER');
    const at = this.now();
    const scopeKey = profileScope(providerWorkspaceId, command.providerId);
    const requestFingerprintSha256 = fingerprint({
      commandType: 'REVALIDATE_CURRENT_AUTHORITY',
      ...revalidationCommand,
      providerWorkspaceId,
      actorId,
      verifierAuthorityReference
    });
    const replay = await this.replay(
      scopeKey,
      idempotencyKey,
      requestFingerprintSha256,
      'REVALIDATE_CURRENT_AUTHORITY'
    );
    if (replay) return replay;
    const current = await this.requireCurrent(
      command.providerId,
      providerWorkspaceId,
      command.providerResponsibilityProfileId
    );
    if (current.status === 'REVOKED')
      throw new ProviderResponsibilityError(
        'PROFILE_REVOKED',
        'Revoked responsibility is terminal.',
        409
      );
    if (current.status !== 'SUSPENDED')
      throw new ProviderResponsibilityError(
        'INVALID_PROFILE_TRANSITION',
        'Current-authority revalidation is available only for suspended responsibility.',
        409
      );
    if (current.version !== expectedVersion)
      throw new ProviderResponsibilityError(
        'STALE_PROFILE',
        'Provider Responsibility version is stale.',
        409
      );
    if (
      command.evidenceReferences.some((reference) =>
        ['DISPUTED', 'REVOKED'].includes(reference.verificationState)
      ) ||
      !command.evidenceReferences.some(
        (reference) =>
          isAppropriateIndependentEvidence(reference, at) &&
          Date.parse(reference.observedAt) > Date.parse(current.checkedAt)
      )
    )
      throw new ProviderResponsibilityError(
        'INVALID_INPUT',
        'Current-authority revalidation requires post-suspension attributable independently verified evidence without dispute or revocation.',
        422
      );
    const profile = this.buildProfile({
      profileId: current.providerResponsibilityProfileId,
      providerId: current.providerId,
      providerWorkspaceId,
      status: 'SUSPENDED',
      disclosure: {
        ...current,
        directResponsibilityStatus: 'VERIFIED',
        evidenceReferences: command.evidenceReferences
      },
      authorityState: 'CURRENT',
      checkedAt: at,
      version: current.version + 1,
      correlationId
    });
    return this.commit({
      profile,
      current,
      actorReference: `${actorId}:${verifierAuthorityReference}`,
      action: 'CURRENT_AUTHORITY_REVALIDATED',
      commandType: 'REVALIDATE_CURRENT_AUTHORITY',
      scopeKey,
      idempotencyKey,
      requestFingerprintSha256
    });
  }

  async assessCurrent(
    providerId: ProviderId,
    providerWorkspaceIdInput: string,
    checkedAtInput = this.now()
  ): Promise<ProviderDirectExecutorAssessmentResult> {
    const providerWorkspaceId = cleanText(
      providerWorkspaceIdInput,
      'providerWorkspaceId',
      100
    ).toLowerCase();
    await this.assertExactProviderBinding(providerId, providerWorkspaceId);
    const checkedAt = instant(checkedAtInput, 'checkedAt');
    const profile = await this.repository.findCurrentProfile(providerId, providerWorkspaceId);
    if (!profile) return { state: 'UNKNOWN_OR_UNPROVEN', assessment: null };
    const assessment = assessProviderDirectExecutor(profile, checkedAt);
    return { state: assessment.state, assessment };
  }

  private buildProfile(input: {
    profileId: ProviderResponsibilityProfileId;
    providerId: ProviderId;
    providerWorkspaceId: string;
    status: ProviderResponsibilityProfileV1['status'];
    disclosure: ResponsibilityDisclosure;
    authorityState: ProviderResponsibilityAuthorityState;
    checkedAt: string;
    version: number;
    correlationId: MarkOrbitId;
  }): ProviderResponsibilityProfileV1 {
    const withoutFingerprint = {
      schemaVersion: 1 as const,
      providerResponsibilityProfileId: input.profileId,
      providerId: input.providerId,
      providerWorkspaceId: input.providerWorkspaceId,
      status: input.status,
      finalExecutorStatus: input.disclosure.finalExecutorStatus,
      directResponsibilityStatus: input.disclosure.directResponsibilityStatus,
      noRebrokeringCommitmentState: input.disclosure.noRebrokeringCommitmentState,
      intermediaryDisclosureState: input.disclosure.intermediaryDisclosureState,
      executionTeamReferences: copy(input.disclosure.executionTeamReferences),
      legallyRequiredDistinctSigner: copy(input.disclosure.legallyRequiredDistinctSigner),
      evidenceReferences: copy(input.disclosure.evidenceReferences),
      authorityState: input.authorityState,
      effectiveFrom: input.disclosure.effectiveFrom,
      ...(input.disclosure.effectiveUntil
        ? { effectiveUntil: input.disclosure.effectiveUntil }
        : {}),
      checkedAt: input.checkedAt,
      version: input.version,
      correlationId: input.correlationId,
      authorityConsequences: noProviderResponsibilityAuthorityConsequences
    };
    return { ...withoutFingerprint, profileFingerprintSha256: fingerprint(withoutFingerprint) };
  }

  private async commit(input: {
    profile: ProviderResponsibilityProfileV1;
    current: ProviderResponsibilityProfileV1 | undefined;
    actorReference: string;
    action: ProviderResponsibilityAuditAction;
    commandType: ProviderResponsibilityCommandType;
    scopeKey: string;
    idempotencyKey: string;
    requestFingerprintSha256: string;
  }): Promise<ProviderResponsibilityProfileV1> {
    const replay: ProviderResponsibilityReplayRecord = {
      scopeKey: input.scopeKey,
      idempotencyKey: input.idempotencyKey,
      requestFingerprintSha256: input.requestFingerprintSha256,
      commandType: input.commandType,
      response: input.profile
    };
    const committed = await this.repository.commit({
      providerId: input.profile.providerId,
      providerWorkspaceId: input.profile.providerWorkspaceId,
      expectedCurrentProfileId: input.current?.providerResponsibilityProfileId ?? null,
      expectedCurrentProfileVersion: input.current?.version ?? null,
      profile: input.profile,
      replay,
      audit: {
        providerResponsibilityProfileId: input.profile.providerResponsibilityProfileId,
        providerId: input.profile.providerId,
        providerWorkspaceId: input.profile.providerWorkspaceId,
        previousVersion: input.current?.version ?? null,
        newVersion: input.profile.version,
        action: input.action,
        actorReference: input.actorReference,
        requestFingerprintSha256: input.requestFingerprintSha256,
        occurredAt: input.profile.checkedAt
      }
    });
    return committed?.response ?? input.profile;
  }

  private assertSchema(schemaVersion: unknown): void {
    if (schemaVersion !== 1)
      throw new ProviderResponsibilityError('INVALID_INPUT', 'schemaVersion must be 1.', 422);
  }

  private async assertProviderBinding(
    principal: ProviderResponsibilityPrincipal,
    providerId: ProviderId
  ): Promise<string> {
    const workspaceId = cleanText(
      principal.workspaceId,
      'principal.workspaceId',
      100
    ).toLowerCase();
    cleanText(principal.actorId, 'principal.actorId');
    await this.assertExactProviderBinding(providerId, workspaceId);
    return workspaceId;
  }

  private async assertExactProviderBinding(providerId: ProviderId, workspaceId: string) {
    const provider = await this.providerRegistry.findProviderById(providerId);
    if (!provider || provider.providerWorkspaceId.toLowerCase() !== workspaceId.toLowerCase())
      throw new ProviderResponsibilityError(
        'PROVIDER_NOT_FOUND',
        'Provider Responsibility target was not found.',
        404
      );
  }

  private async requireCurrent(
    providerId: ProviderId,
    providerWorkspaceId: string,
    profileId: ProviderResponsibilityProfileId
  ): Promise<ProviderResponsibilityProfileV1> {
    const current = await this.repository.findCurrentProfile(providerId, providerWorkspaceId);
    if (current?.providerResponsibilityProfileId === profileId) return current;
    const historical = await this.repository.findLatestProfile(profileId);
    if (
      historical?.providerId === providerId &&
      historical.providerWorkspaceId.toLowerCase() === providerWorkspaceId.toLowerCase() &&
      historical.status === 'REVOKED'
    )
      throw new ProviderResponsibilityError(
        'PROFILE_REVOKED',
        'Revoked responsibility is terminal.',
        409
      );
    throw new ProviderResponsibilityError(
      'PROFILE_NOT_FOUND',
      'Current responsibility profile was not found.',
      404
    );
  }

  private assertMutable(profile: ProviderResponsibilityProfileV1, expectedVersion: number): void {
    if (profile.status === 'REVOKED')
      throw new ProviderResponsibilityError(
        'PROFILE_REVOKED',
        'Revoked responsibility is terminal.',
        409
      );
    if (profile.status !== 'CURRENT')
      throw new ProviderResponsibilityError(
        'INVALID_PROFILE_TRANSITION',
        'Suspended responsibility must be explicitly resumed before correction.',
        409
      );
    if (profile.version !== expectedVersion)
      throw new ProviderResponsibilityError(
        'STALE_PROFILE',
        'Provider Responsibility version is stale.',
        409
      );
  }

  private async assertCurrentAuthorityRevalidatedAfterSuspension(
    profile: ProviderResponsibilityProfileV1
  ): Promise<void> {
    const audits = await this.repository.listAuditHistory(profile.providerResponsibilityProfileId);
    const latestAudit = audits.at(-1);
    if (
      profile.authorityState !== 'CURRENT' ||
      latestAudit?.action !== 'CURRENT_AUTHORITY_REVALIDATED' ||
      latestAudit.newVersion !== profile.version
    )
      throw new ProviderResponsibilityError(
        'CURRENT_AUTHORITY_REVALIDATION_REQUIRED',
        'Resume requires governed current-authority revalidation after suspension.',
        409
      );
  }

  private assertVerifierAuthority(principal: ProviderResponsibilityVerifierPrincipal): void {
    if (principal.authority !== 'MGSN_INTERNAL_RESPONSIBILITY_VERIFIER')
      throw new ProviderResponsibilityError(
        'INVALID_VERIFIER_AUTHORITY',
        'A governed MGSN responsibility verifier is required.',
        403
      );
  }

  private async replay(
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprintSha256: string,
    commandType: ProviderResponsibilityCommandType
  ): Promise<ProviderResponsibilityProfileV1 | undefined> {
    const replay = await this.repository.findReplay(scopeKey, idempotencyKey);
    if (!replay) return undefined;
    if (
      replay.requestFingerprintSha256 !== requestFingerprintSha256 ||
      replay.commandType !== commandType
    )
      throw new ProviderResponsibilityError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different trusted context or command payload.',
        409
      );
    return replay.response;
  }
}
