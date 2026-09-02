import { createHash, randomUUID } from 'node:crypto';
import {
  noDownstreamProviderSelectionAuthorityConsequences,
  type CreateOrReplaceProviderSelectionCommandV1,
  type ProviderSelectionCurrentValidationV1,
  type ProviderSelectionId,
  type ProviderSelectionMutationKind,
  type ProviderSelectionMutationResultV1,
  type ProviderSelectionScopeReferenceV1,
  type ProviderSelectionSourceLineageV1,
  type ProviderSelectionTrustedHumanAuthorityV1,
  type ProviderSelectionV1,
  type ProviderSelectionValidationDenialReason,
  type ProviderSelectionValidationPurpose,
  type ProviderSelectionVersionReferenceV1,
  type RevokeProviderSelectionCommandV1
} from '@markorbit/contracts/provider-selection';

export const PROVIDER_SELECTION_VALIDATION_POLICY_VERSION =
  'mgsn-provider-selection-validation-v1';

const sha256Pattern = /^[0-9a-f]{64}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ProviderSelectionPrincipal {
  workspaceId: string;
  actorId: string;
  actorKind: 'HUMAN_USER' | 'SYSTEM' | 'AI_AGENT';
  principalReference: string;
  workspaceMembershipReference: string;
  selectionAuthorityReference: string;
  selectionAuthorityVersion: number | string;
  authenticatedAt: string;
  affirmativeHumanActionEvidenceReference: string;
}

export type ProviderSelectionErrorCode =
  | 'INVALID_INPUT'
  | 'REQUESTER_WORKSPACE_MISMATCH'
  | 'SELECTING_ACTOR_MISMATCH'
  | 'HUMAN_ACTION_REQUIRED'
  | 'SELECTION_NOT_FOUND'
  | 'SELECTION_ALREADY_EXISTS'
  | 'STALE_SELECTION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CURRENT_AUTHORITY_DENIED'
  | 'AUTHORITY_UNAVAILABLE';

export class ProviderSelectionError extends Error {
  constructor(
    public readonly code: ProviderSelectionErrorCode,
    message: string,
    public readonly status = 400,
    public readonly denialReason?: ProviderSelectionValidationDenialReason
  ) {
    super(message);
    this.name = 'ProviderSelectionError';
  }
}

export interface ProviderSelectionCurrentAuthoritySnapshot {
  authorityAvailable: boolean;
  requesterAuthorityCurrent: boolean;
  actorAuthorityCurrent: boolean;
  candidateCurrent: boolean;
  participationActive: boolean;
  visibilityAuthorized: boolean;
  trustedRelationshipRequired: boolean;
  trustedRelationshipCurrent: boolean;
  providerOperational: boolean;
  supplyCurrent: boolean;
  directExecutorEstablished: boolean;
  sourceVersionsMatch: boolean;
  checkedAuthorityReferences: readonly string[];
}

export interface ProviderSelectionCurrentAuthoritySource {
  evaluateCurrentAuthority(input: {
    requesterWorkspaceId: string;
    selectingActorId: string;
    scope: Readonly<ProviderSelectionScopeReferenceV1>;
    sourceLineage: Readonly<ProviderSelectionSourceLineageV1>;
    trustedHumanAuthority: Readonly<ProviderSelectionTrustedHumanAuthorityV1>;
    purpose: ProviderSelectionValidationPurpose;
    checkedAt: string;
  }): Promise<Readonly<ProviderSelectionCurrentAuthoritySnapshot>>;
}

export interface ProviderSelectionScopeState {
  scopeVersion: number;
  current?: ProviderSelectionV1;
}

export interface ProviderSelectionReplayRecord {
  scopeKey: string;
  idempotencyKey: string;
  effectiveCommandFingerprintSha256: string;
  mutation: ProviderSelectionMutationKind;
  response: ProviderSelectionMutationResultV1;
}

export interface ProviderSelectionAuditEvent {
  scopeKey: string;
  requesterWorkspaceId: string;
  action: ProviderSelectionMutationKind;
  actorId: string;
  selectionAuthorityReference: string;
  commandFingerprintSha256: string;
  previousSelection?: ProviderSelectionVersionReferenceV1;
  selection: ProviderSelectionVersionReferenceV1;
  occurredAt: string;
  correlationId: string;
}

export interface ProviderSelectionCommit {
  scopeKey: string;
  expectedScopeVersion: number;
  expectedCurrent: ProviderSelectionVersionReferenceV1 | null;
  newScopeVersion: number;
  appendedSelections: readonly ProviderSelectionV1[];
  newCurrent: ProviderSelectionV1 | null;
  replay: ProviderSelectionReplayRecord;
  audit: ProviderSelectionAuditEvent;
}

export interface ProviderSelectionRepository {
  findScopeState(scopeKey: string): Promise<ProviderSelectionScopeState>;
  findLatestSelection(providerSelectionId: ProviderSelectionId): Promise<ProviderSelectionV1 | undefined>;
  findReplay(
    scopeKey: string,
    idempotencyKey: string
  ): Promise<ProviderSelectionReplayRecord | undefined>;
  commit(mutation: ProviderSelectionCommit): Promise<ProviderSelectionReplayRecord | undefined>;
  listSelectionHistory(providerSelectionId: ProviderSelectionId): Promise<ProviderSelectionV1[]>;
  listAuditHistory(scopeKey: string): Promise<ProviderSelectionAuditEvent[]>;
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function replayKey(scopeKey: string, idempotencyKey: string): string {
  return `${scopeKey}:${idempotencyKey}`;
}

function selectionReference(
  selection: ProviderSelectionV1
): ProviderSelectionVersionReferenceV1 {
  return {
    providerSelectionId: selection.providerSelectionId,
    version: selection.version,
    scopeVersion: selection.scopeVersion
  };
}

function sameReference(
  left: ProviderSelectionVersionReferenceV1 | null,
  right: ProviderSelectionVersionReferenceV1 | null
): boolean {
  return (
    left?.providerSelectionId === right?.providerSelectionId &&
    left?.version === right?.version &&
    left?.scopeVersion === right?.scopeVersion
  );
}

/** Reference repository only. It is never wired as a production durable fallback. */
export class InMemoryProviderSelectionRepository implements ProviderSelectionRepository {
  private readonly currentByScope = new Map<string, ProviderSelectionId>();
  private readonly scopeVersions = new Map<string, number>();
  private readonly histories = new Map<ProviderSelectionId, ProviderSelectionV1[]>();
  private readonly replays = new Map<string, ProviderSelectionReplayRecord>();
  private readonly audits = new Map<string, ProviderSelectionAuditEvent[]>();

  async findScopeState(scopeKey: string): Promise<ProviderSelectionScopeState> {
    const currentId = this.currentByScope.get(scopeKey);
    const current = currentId ? this.histories.get(currentId)?.at(-1) : undefined;
    return {
      scopeVersion: this.scopeVersions.get(scopeKey) ?? 0,
      ...(current ? { current: copy(current) } : {})
    };
  }

  async findLatestSelection(providerSelectionId: ProviderSelectionId) {
    const latest = this.histories.get(providerSelectionId)?.at(-1);
    return latest ? copy(latest) : undefined;
  }

  async findReplay(scopeKey: string, idempotencyKey: string) {
    const replay = this.replays.get(replayKey(scopeKey, idempotencyKey));
    return replay ? copy(replay) : undefined;
  }

  // No await: CAS, immutable appends, pointer, replay and audit commit in one JS turn.
  commit(mutation: ProviderSelectionCommit): Promise<ProviderSelectionReplayRecord | undefined> {
    const replayLookupKey = replayKey(
      mutation.replay.scopeKey,
      mutation.replay.idempotencyKey
    );
    const existingReplay = this.replays.get(replayLookupKey);
    if (existingReplay) {
      if (
        existingReplay.effectiveCommandFingerprintSha256 !==
          mutation.replay.effectiveCommandFingerprintSha256 ||
        existingReplay.mutation !== mutation.replay.mutation
      ) {
        throw new ProviderSelectionError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different trusted context or command payload.',
          409
        );
      }
      return Promise.resolve(copy(existingReplay));
    }

    const currentScopeVersion = this.scopeVersions.get(mutation.scopeKey) ?? 0;
    const currentId = this.currentByScope.get(mutation.scopeKey);
    const current = currentId ? this.histories.get(currentId)?.at(-1) : undefined;
    const currentReference = current ? selectionReference(current) : null;
    if (
      currentScopeVersion !== mutation.expectedScopeVersion ||
      !sameReference(currentReference, mutation.expectedCurrent)
    ) {
      throw new ProviderSelectionError(
        'STALE_SELECTION',
        'Human Provider Selection changed; reload the exact current scope version.',
        409
      );
    }
    if (mutation.newScopeVersion !== currentScopeVersion + 1) {
      throw new ProviderSelectionError(
        'STALE_SELECTION',
        'Selection scope history is not appendable at the requested version.',
        409
      );
    }

    const plannedHistories = new Map<ProviderSelectionId, ProviderSelectionV1[]>();
    for (const selection of mutation.appendedSelections) {
      const base = plannedHistories.get(selection.providerSelectionId) ?? [
        ...(this.histories.get(selection.providerSelectionId) ?? [])
      ];
      const previous = base.at(-1);
      if (selection.version !== (previous?.version ?? 0) + 1) {
        throw new ProviderSelectionError(
          'STALE_SELECTION',
          'Selection identity history is not appendable at the requested version.',
          409
        );
      }
      if (
        previous &&
        (previous.requesterWorkspaceId.toLowerCase() !==
          selection.requesterWorkspaceId.toLowerCase() ||
          previous.scope.owner !== selection.scope.owner ||
          previous.scope.reference !== selection.scope.reference)
      ) {
        throw new ProviderSelectionError(
          'INVALID_INPUT',
          'Selection identity binding is immutable.',
          422
        );
      }
      plannedHistories.set(selection.providerSelectionId, [...base, copy(selection)]);
    }

    if (mutation.newCurrent) {
      if (
        mutation.newCurrent.status !== 'CURRENT' ||
        mutation.newCurrent.scopeVersion !== mutation.newScopeVersion
      ) {
        throw new ProviderSelectionError(
          'INVALID_INPUT',
          'The new current Selection pointer must reference the exact CURRENT scope version.',
          422
        );
      }
      const planned = plannedHistories.get(mutation.newCurrent.providerSelectionId);
      if (!planned?.some((selection) => selection.version === mutation.newCurrent?.version)) {
        throw new ProviderSelectionError(
          'INVALID_INPUT',
          'The new current Selection must be part of the same atomic append.',
          422
        );
      }
    }

    for (const [selectionId, history] of plannedHistories) {
      this.histories.set(selectionId, history);
    }
    this.scopeVersions.set(mutation.scopeKey, mutation.newScopeVersion);
    if (mutation.newCurrent) {
      this.currentByScope.set(mutation.scopeKey, mutation.newCurrent.providerSelectionId);
    } else {
      this.currentByScope.delete(mutation.scopeKey);
    }
    this.replays.set(replayLookupKey, copy(mutation.replay));
    const auditHistory = this.audits.get(mutation.scopeKey) ?? [];
    this.audits.set(mutation.scopeKey, [...auditHistory, copy(mutation.audit)]);
    return Promise.resolve(undefined);
  }

  async listSelectionHistory(providerSelectionId: ProviderSelectionId) {
    return copy(this.histories.get(providerSelectionId) ?? []);
  }

  async listAuditHistory(scopeKey: string) {
    return copy(this.audits.get(scopeKey) ?? []);
  }
}

export function providerSelectionStableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => providerSelectionStableSerialize(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${providerSelectionStableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function providerSelectionFingerprint(value: unknown): string {
  return createHash('sha256').update(providerSelectionStableSerialize(value)).digest('hex');
}

function cleanText(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      `${field} must be a non-empty value no longer than ${maximum} characters.`,
      422
    );
  }
  return value.trim();
}

function cleanWorkspaceId(value: unknown, field: string): string {
  const workspaceId = cleanText(value, field, 100).toLowerCase();
  if (!uuidPattern.test(workspaceId)) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      `${field} must be a Core Workspace UUID.`,
      422
    );
  }
  return workspaceId;
}

function instant(value: unknown, field: string): string {
  const text = cleanText(value, field, 100);
  if (!Number.isFinite(Date.parse(text))) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  }
  return new Date(text).toISOString();
}

function exactSha256(value: unknown, field: string): string {
  const text = cleanText(value, field, 64);
  if (!sha256Pattern.test(text)) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 value.`,
      422
    );
  }
  return text;
}

function positiveVersion(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new ProviderSelectionError('INVALID_INPUT', `${field} must be positive.`, 422);
  }
  return Number(value);
}

function versionValue(value: unknown, field: string): number | string {
  if (typeof value === 'number') {
    return positiveVersion(value, field);
  }
  return cleanText(value, field, 200);
}

function sameVersion(left: number | string, right: number | string): boolean {
  return left === right;
}

function selectionScopeKey(
  workspaceId: string,
  scope: Readonly<ProviderSelectionScopeReferenceV1>
): string {
  return [
    'provider-selection',
    workspaceId.toLowerCase(),
    scope.owner,
    encodeURIComponent(scope.reference)
  ].join(':');
}

function exactScope(
  left: Readonly<ProviderSelectionScopeReferenceV1>,
  right: Readonly<ProviderSelectionScopeReferenceV1>
): boolean {
  return (
    left.owner === right.owner &&
    left.reference === right.reference &&
    sameVersion(left.version, right.version) &&
    left.fingerprintSha256 === right.fingerprintSha256
  );
}

function assertScope(scope: Readonly<ProviderSelectionScopeReferenceV1>): void {
  cleanText(scope.owner, 'scope.owner', 100);
  cleanText(scope.reference, 'scope.reference');
  versionValue(scope.version, 'scope.version');
  exactSha256(scope.fingerprintSha256, 'scope.fingerprintSha256');
}

function assertLineage(
  requesterWorkspaceId: string,
  scope: Readonly<ProviderSelectionScopeReferenceV1>,
  lineage: Readonly<ProviderSelectionSourceLineageV1>
): void {
  const lineageWorkspaceId = cleanWorkspaceId(
    lineage.discoveryRequest.requesterWorkspaceId,
    'sourceLineage.discoveryRequest.requesterWorkspaceId'
  );
  if (lineageWorkspaceId !== requesterWorkspaceId) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      'Discovery lineage belongs to a different requester Workspace.',
      422
    );
  }
  cleanText(lineage.discoveryRequest.providerDiscoveryRequestId, 'providerDiscoveryRequestId', 200);
  exactSha256(lineage.discoveryRequest.requestFingerprintSha256, 'requestFingerprintSha256');
  cleanText(lineage.discoveryRequest.needReference, 'needReference');
  versionValue(lineage.discoveryRequest.needVersion, 'needVersion');
  exactSha256(lineage.discoveryRequest.needFingerprintSha256, 'needFingerprintSha256');
  if (lineage.discoveryRequest.purpose !== 'PROVIDER_DISCOVERY') {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      'Selection lineage must come from Provider Discovery.',
      422
    );
  }
  cleanText(lineage.discoveryRequest.contextReference, 'contextReference');
  exactSha256(lineage.discoveryResult.resultFingerprintSha256, 'resultFingerprintSha256');
  instant(lineage.discoveryResult.evaluatedAt, 'discoveryResult.evaluatedAt');
  cleanText(
    lineage.discoveryCandidate.providerDiscoveryCandidateId,
    'providerDiscoveryCandidateId',
    200
  );
  exactSha256(
    lineage.discoveryCandidate.candidateFingerprintSha256,
    'candidateFingerprintSha256'
  );
  instant(lineage.discoveryCandidate.generatedAt, 'candidate.generatedAt');
  cleanText(lineage.discoveryCandidate.evaluationPolicyVersion, 'evaluationPolicyVersion', 200);
  cleanText(lineage.provider.providerId, 'providerId', 200);
  cleanWorkspaceId(lineage.provider.providerWorkspaceId, 'providerWorkspaceId');
  cleanText(lineage.providerSupplyCapability.id, 'providerSupplyCapability.id', 200);
  positiveVersion(lineage.providerSupplyCapability.version, 'providerSupplyCapability.version');
  exactSha256(
    lineage.providerSupplyCapability.fingerprintSha256,
    'providerSupplyCapability.fingerprintSha256'
  );
  cleanText(
    lineage.visibilityAuthorizationAtReview.networkParticipationId,
    'networkParticipationId',
    200
  );
  positiveVersion(
    lineage.visibilityAuthorizationAtReview.participationVersion,
    'participationVersion'
  );
  positiveVersion(
    lineage.visibilityAuthorizationAtReview.visibilityPolicyVersion,
    'visibilityPolicyVersion'
  );
  instant(lineage.visibilityAuthorizationAtReview.evaluatedAt, 'visibility.evaluatedAt');
  if (
    lineage.visibilityAuthorizationAtReview.currentAuthorityRevalidationRequiredBeforeServe !==
    true
  ) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      'Visibility authority must require current revalidation before use.',
      422
    );
  }
  if (
    lineage.currentAuthorityRevalidationRequiredBeforeSelectionCommit !== true ||
    lineage.currentAuthorityRevalidationRequiredBeforeDownstreamUse !== true
  ) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      'Selection lineage must require current authority revalidation.',
      422
    );
  }
  if (
    lineage.discoveryRequest.needReference !== scope.reference ||
    !sameVersion(lineage.discoveryRequest.needVersion, scope.version) ||
    lineage.discoveryRequest.needFingerprintSha256 !== scope.fingerprintSha256
  ) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      'Discovery Need lineage must match the exact Selection scope.',
      422
    );
  }
  for (const source of lineage.historicalSourceVersions) {
    cleanText(source.owner, 'historicalSource.owner', 100);
    cleanText(source.sourceType, 'historicalSource.sourceType', 100);
    cleanText(source.sourceId, 'historicalSource.sourceId', 200);
    versionValue(source.version, 'historicalSource.version');
    exactSha256(source.fingerprintSha256, 'historicalSource.fingerprintSha256');
    instant(source.checkedAt, 'historicalSource.checkedAt');
  }
  for (const reference of lineage.directExecutorDisclosureAtReview.evidenceReferences) {
    cleanText(reference, 'directExecutorEvidenceReference', 200);
  }
}

function assertAcknowledgement(
  command: CreateOrReplaceProviderSelectionCommandV1
): void {
  const acknowledgement = command.acknowledgement;
  if (
    acknowledgement.affirmativeHumanAction !== true ||
    acknowledgement.acknowledgementCode !== 'HUMAN_PROVIDER_SELECTION_V1'
  ) {
    throw new ProviderSelectionError(
      'HUMAN_ACTION_REQUIRED',
      'An explicit Human Provider Selection acknowledgement is required.',
      403
    );
  }
  cleanText(acknowledgement.acknowledgementTextVersion, 'acknowledgementTextVersion', 100);
  instant(acknowledgement.reviewedAt, 'acknowledgement.reviewedAt');
  if (
    acknowledgement.reviewedCandidateId !==
      command.sourceLineage.discoveryCandidate.providerDiscoveryCandidateId ||
    acknowledgement.reviewedCandidateFingerprintSha256 !==
      command.sourceLineage.discoveryCandidate.candidateFingerprintSha256
  ) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      'Acknowledgement must reference the exact reviewed Discovery candidate.',
      422
    );
  }
  if (acknowledgement.reviewedScopeFingerprintSha256 !== command.scope.fingerprintSha256) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      'Acknowledgement must reference the exact reviewed Selection scope.',
      422
    );
  }
  if (
    acknowledgement.containsCustomerDocuments !== false ||
    acknowledgement.containsRawEvidenceArtifacts !== false ||
    acknowledgement.containsEndClientRelationshipInformation !== false ||
    acknowledgement.containsApplicantOwnerOfficialData !== false ||
    acknowledgement.containsCommercialMarginOrProfit !== false
  ) {
    throw new ProviderSelectionError(
      'INVALID_INPUT',
      'Human Provider Selection cannot embed protected customer or commercial data.',
      422
    );
  }
  if (acknowledgement.rationale !== undefined) {
    cleanText(acknowledgement.rationale, 'acknowledgement.rationale', 500);
  }
}

function assertTrustedAuthority(
  principal: ProviderSelectionPrincipal,
  requesterWorkspaceIdInput: string,
  authority: Readonly<ProviderSelectionTrustedHumanAuthorityV1>
): string {
  const principalWorkspaceId = cleanWorkspaceId(principal.workspaceId, 'principal.workspaceId');
  const requesterWorkspaceId = cleanWorkspaceId(
    requesterWorkspaceIdInput,
    'requesterWorkspaceId'
  );
  const authorityWorkspaceId = cleanWorkspaceId(
    authority.requesterWorkspaceId,
    'trustedHumanAuthority.requesterWorkspaceId'
  );
  if (
    principalWorkspaceId !== requesterWorkspaceId ||
    authorityWorkspaceId !== requesterWorkspaceId
  ) {
    throw new ProviderSelectionError(
      'REQUESTER_WORKSPACE_MISMATCH',
      'Human Provider Selection is unavailable for this Workspace.',
      403
    );
  }
  if (principal.actorKind !== 'HUMAN_USER') {
    throw new ProviderSelectionError(
      'HUMAN_ACTION_REQUIRED',
      'Human Provider Selection requires an authenticated human action.',
      403
    );
  }
  const actorId = cleanText(principal.actorId, 'principal.actorId', 200);
  if (actorId !== cleanText(authority.selectingActorId, 'selectingActorId', 200)) {
    throw new ProviderSelectionError(
      'SELECTING_ACTOR_MISMATCH',
      'Human Provider Selection actor authority does not match.',
      403
    );
  }
  const exactAuthority =
    authority.source === 'CORE_WORKSPACE_PRINCIPAL' &&
    authority.payloadIdentityAuthoritative === false &&
    principal.principalReference === authority.principalReference &&
    principal.workspaceMembershipReference === authority.workspaceMembershipReference &&
    principal.selectionAuthorityReference === authority.selectionAuthorityReference &&
    sameVersion(principal.selectionAuthorityVersion, authority.selectionAuthorityVersion) &&
    instant(principal.authenticatedAt, 'principal.authenticatedAt') ===
      instant(authority.authenticatedAt, 'trustedHumanAuthority.authenticatedAt') &&
    principal.affirmativeHumanActionEvidenceReference ===
      authority.affirmativeHumanActionEvidenceReference;
  if (!exactAuthority) {
    throw new ProviderSelectionError(
      'SELECTING_ACTOR_MISMATCH',
      'Human Provider Selection authority does not match the trusted principal.',
      403
    );
  }
  cleanText(authority.principalReference, 'principalReference', 200);
  cleanText(authority.workspaceMembershipReference, 'workspaceMembershipReference', 200);
  cleanText(authority.selectionAuthorityReference, 'selectionAuthorityReference', 200);
  versionValue(authority.selectionAuthorityVersion, 'selectionAuthorityVersion');
  cleanText(
    authority.affirmativeHumanActionEvidenceReference,
    'affirmativeHumanActionEvidenceReference',
    200
  );
  return requesterWorkspaceId;
}

function assertCreateCommand(
  principal: ProviderSelectionPrincipal,
  command: CreateOrReplaceProviderSelectionCommandV1
): string {
  if (command.schemaVersion !== 1) {
    throw new ProviderSelectionError('INVALID_INPUT', 'Unsupported Selection schema version.', 422);
  }
  const requesterWorkspaceId = assertTrustedAuthority(
    principal,
    command.requesterWorkspaceId,
    command.trustedHumanAuthority
  );
  assertScope(command.scope);
  assertLineage(requesterWorkspaceId, command.scope, command.sourceLineage);
  assertAcknowledgement(command);
  cleanText(command.idempotencyKey, 'idempotencyKey', 200);
  exactSha256(command.commandFingerprintSha256, 'commandFingerprintSha256');
  cleanText(command.correlationId, 'correlationId', 200);
  if (!Number.isInteger(command.expectedCurrent.expectedScopeVersion)) {
    throw new ProviderSelectionError('INVALID_INPUT', 'expectedScopeVersion is invalid.', 422);
  }
  if (command.expectedCurrent.expectedScopeVersion < 0) {
    throw new ProviderSelectionError('INVALID_INPUT', 'expectedScopeVersion is invalid.', 422);
  }
  if (command.expectedCurrent.kind === 'EXACT') {
    cleanText(command.expectedCurrent.providerSelectionId, 'providerSelectionId', 200);
    positiveVersion(command.expectedCurrent.version, 'expectedCurrent.version');
  }
  return requesterWorkspaceId;
}

function assertRevokeCommand(
  principal: ProviderSelectionPrincipal,
  command: RevokeProviderSelectionCommandV1
): string {
  if (command.schemaVersion !== 1) {
    throw new ProviderSelectionError('INVALID_INPUT', 'Unsupported Selection schema version.', 422);
  }
  const requesterWorkspaceId = assertTrustedAuthority(
    principal,
    command.requesterWorkspaceId,
    command.trustedHumanAuthority
  );
  assertScope(command.scope);
  cleanText(command.target.providerSelectionId, 'providerSelectionId', 200);
  positiveVersion(command.target.version, 'target.version');
  positiveVersion(command.target.scopeVersion, 'target.scopeVersion');
  cleanText(command.idempotencyKey, 'idempotencyKey', 200);
  exactSha256(command.commandFingerprintSha256, 'commandFingerprintSha256');
  cleanText(command.correlationId, 'correlationId', 200);
  if (command.rationale !== undefined) {
    cleanText(command.rationale, 'revoke.rationale', 500);
  }
  return requesterWorkspaceId;
}

function trustedPrincipalFingerprint(principal: ProviderSelectionPrincipal) {
  return {
    workspaceId: principal.workspaceId.toLowerCase(),
    actorId: principal.actorId,
    actorKind: principal.actorKind,
    principalReference: principal.principalReference,
    workspaceMembershipReference: principal.workspaceMembershipReference,
    selectionAuthorityReference: principal.selectionAuthorityReference,
    selectionAuthorityVersion: principal.selectionAuthorityVersion,
    authenticatedAt: principal.authenticatedAt,
    affirmativeHumanActionEvidenceReference: principal.affirmativeHumanActionEvidenceReference
  };
}

function effectiveCommandFingerprint(
  principal: ProviderSelectionPrincipal,
  command: CreateOrReplaceProviderSelectionCommandV1 | RevokeProviderSelectionCommandV1
): string {
  return providerSelectionFingerprint({
    trustedPrincipal: trustedPrincipalFingerprint(principal),
    command
  });
}

function denial(
  selection: ProviderSelectionV1,
  purpose: ProviderSelectionValidationPurpose,
  evaluatedAt: string,
  denialReason: ProviderSelectionValidationDenialReason,
  publicReason: string,
  checkedAuthorityReferences: readonly string[] = []
): ProviderSelectionCurrentValidationV1 {
  return {
    schemaVersion: 1,
    selection: selectionReference(selection),
    requesterWorkspaceId: selection.requesterWorkspaceId,
    scope: selection.scope,
    purpose,
    evaluatedAt,
    validationPolicyVersion: PROVIDER_SELECTION_VALIDATION_POLICY_VERSION,
    checkedAuthorityReferences,
    authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences,
    validationDoesNotAuthorizeDownstreamAction: true,
    decision: 'DENY',
    currentlyUsable: false,
    denialReason,
    publicReason
  };
}

function allowed(
  selection: ProviderSelectionV1,
  purpose: ProviderSelectionValidationPurpose,
  evaluatedAt: string,
  checkedAuthorityReferences: readonly string[]
): ProviderSelectionCurrentValidationV1 {
  return {
    schemaVersion: 1,
    selection: selectionReference(selection),
    requesterWorkspaceId: selection.requesterWorkspaceId,
    scope: selection.scope,
    purpose,
    evaluatedAt,
    validationPolicyVersion: PROVIDER_SELECTION_VALIDATION_POLICY_VERSION,
    checkedAuthorityReferences,
    authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences,
    validationDoesNotAuthorizeDownstreamAction: true,
    decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
    currentlyUsable: true,
    publicReason: 'Current authority permits this Selection for the bounded review.'
  };
}

function sanitizeAuthorityReferences(references: readonly string[]): readonly string[] {
  const unique = new Set<string>();
  for (const reference of references) {
    unique.add(cleanText(reference, 'checkedAuthorityReference', 200));
    if (unique.size > 100) {
      throw new ProviderSelectionError(
        'INVALID_INPUT',
        'Too many current authority references were returned.',
        422
      );
    }
  }
  return [...unique];
}

function evaluateSnapshotDenial(
  snapshot: Readonly<ProviderSelectionCurrentAuthoritySnapshot>
): ProviderSelectionValidationDenialReason | null {
  if (!snapshot.authorityAvailable) {
    return 'AUTHORITY_UNAVAILABLE';
  }
  if (!snapshot.requesterAuthorityCurrent) {
    return 'REQUESTER_AUTHORITY_NOT_CURRENT';
  }
  if (!snapshot.actorAuthorityCurrent) {
    return 'ACTOR_AUTHORITY_NOT_CURRENT';
  }
  if (!snapshot.candidateCurrent) {
    return 'STALE_CANDIDATE';
  }
  if (!snapshot.participationActive) {
    return 'PARTICIPATION_NOT_ACTIVE';
  }
  if (!snapshot.visibilityAuthorized) {
    return 'VISIBILITY_NO_LONGER_AUTHORIZED';
  }
  if (snapshot.trustedRelationshipRequired && !snapshot.trustedRelationshipCurrent) {
    return 'TRUSTED_RELATIONSHIP_NOT_CURRENT';
  }
  if (!snapshot.providerOperational) {
    return 'PROVIDER_NOT_OPERATIONAL';
  }
  if (!snapshot.supplyCurrent) {
    return 'SUPPLY_NOT_CURRENT';
  }
  if (!snapshot.directExecutorEstablished) {
    return 'DIRECT_EXECUTOR_NOT_ESTABLISHED';
  }
  if (!snapshot.sourceVersionsMatch) {
    return 'SOURCE_VERSION_MISMATCH';
  }
  return null;
}

function publicReasonForDenial(reason: ProviderSelectionValidationDenialReason): string {
  switch (reason) {
    case 'SELECTION_SUPERSEDED':
      return 'The recorded Selection has been superseded.';
    case 'SELECTION_REVOKED':
      return 'The recorded Selection has been revoked.';
    case 'STALE_CANDIDATE':
      return 'The reviewed Provider candidate is no longer current.';
    case 'REQUESTER_AUTHORITY_NOT_CURRENT':
      return 'Requester authority is not current for this bounded review.';
    case 'ACTOR_AUTHORITY_NOT_CURRENT':
      return 'Selecting actor authority is not current for this bounded review.';
    case 'PARTICIPATION_NOT_ACTIVE':
      return 'Current network participation does not permit this bounded review.';
    case 'VISIBILITY_NO_LONGER_AUTHORIZED':
      return 'Current Provider visibility authority no longer permits this bounded review.';
    case 'TRUSTED_RELATIONSHIP_NOT_CURRENT':
      return 'Required trusted relationship authority is not current.';
    case 'PROVIDER_NOT_OPERATIONAL':
      return 'The Provider is not currently operational for this bounded review.';
    case 'SUPPLY_NOT_CURRENT':
      return 'The reviewed Provider supply capability is no longer current.';
    case 'DIRECT_EXECUTOR_NOT_ESTABLISHED':
      return 'Current Direct Executor responsibility is not established.';
    case 'SOURCE_VERSION_MISMATCH':
      return 'Current source lineage no longer matches the reviewed Selection.';
    case 'AUTHORITY_UNAVAILABLE':
      return 'Current authority could not be established.';
  }
}

export class ProviderSelectionService {
  constructor(
    private readonly repository: ProviderSelectionRepository,
    private readonly currentAuthoritySource: ProviderSelectionCurrentAuthoritySource,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextSelectionId: () => ProviderSelectionId = () =>
      `provider-selection_${randomUUID()}` as ProviderSelectionId
  ) {}

  async createOrReplace(
    principal: ProviderSelectionPrincipal,
    command: CreateOrReplaceProviderSelectionCommandV1
  ): Promise<ProviderSelectionMutationResultV1> {
    const requesterWorkspaceId = assertCreateCommand(principal, command);
    const key = selectionScopeKey(requesterWorkspaceId, command.scope);
    const fingerprint = effectiveCommandFingerprint(principal, command);
    const replay = await this.findReplay(
      key,
      command.idempotencyKey,
      fingerprint,
      command.expectedCurrent.kind === 'ABSENT' ? 'CREATED' : 'REPLACED'
    );
    if (replay) {
      return replay;
    }

    const currentValidation = await this.evaluateCurrentAuthority(
      requesterWorkspaceId,
      command.trustedHumanAuthority.selectingActorId,
      command.scope,
      command.sourceLineage,
      command.trustedHumanAuthority,
      'SELECTION_COMMIT'
    );
    const denialReason = evaluateSnapshotDenial(currentValidation.snapshot);
    if (denialReason) {
      throw new ProviderSelectionError(
        denialReason === 'AUTHORITY_UNAVAILABLE'
          ? 'AUTHORITY_UNAVAILABLE'
          : 'CURRENT_AUTHORITY_DENIED',
        publicReasonForDenial(denialReason),
        denialReason === 'AUTHORITY_UNAVAILABLE' ? 503 : 409,
        denialReason
      );
    }

    const state = await this.repository.findScopeState(key);
    const expected = this.assertExpectedCurrent(command, state);
    const newScopeVersion = state.scopeVersion + 1;
    const selectedAt = this.now();
    const newSelectionId = this.nextSelectionId();
    const newSelection: ProviderSelectionV1 = {
      schemaVersion: 1,
      providerSelectionId: newSelectionId,
      requesterWorkspaceId,
      scope: copy(command.scope),
      scopeVersion: newScopeVersion,
      sourceLineage: copy(command.sourceLineage),
      trustedHumanAuthority: copy(command.trustedHumanAuthority),
      acknowledgement: copy(command.acknowledgement),
      selectedAt,
      version: 1,
      correlationId: command.correlationId,
      authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences,
      status: 'CURRENT',
      supersededBy: null,
      revokedAt: null
    };

    const previous = state.current;
    const replacement = previous
      ? ({
          ...previous,
          scopeVersion: newScopeVersion,
          version: previous.version + 1,
          status: 'SUPERSEDED',
          supersededBy: selectionReference(newSelection),
          revokedAt: null
        } satisfies ProviderSelectionV1)
      : undefined;
    const mutation: ProviderSelectionMutationKind = previous ? 'REPLACED' : 'CREATED';
    const result: ProviderSelectionMutationResultV1 = {
      schemaVersion: 1,
      mutation,
      selection: newSelection,
      ...(previous ? { previousSelection: selectionReference(previous) } : {}),
      replayed: false,
      replayDoesNotEstablishCurrentUsability: true,
      correlationId: command.correlationId
    };
    const audit: ProviderSelectionAuditEvent = {
      scopeKey: key,
      requesterWorkspaceId,
      action: mutation,
      actorId: principal.actorId,
      selectionAuthorityReference: principal.selectionAuthorityReference,
      commandFingerprintSha256: command.commandFingerprintSha256,
      ...(previous ? { previousSelection: selectionReference(previous) } : {}),
      selection: selectionReference(newSelection),
      occurredAt: selectedAt,
      correlationId: command.correlationId
    };
    const committedReplay = await this.repository.commit({
      scopeKey: key,
      expectedScopeVersion: state.scopeVersion,
      expectedCurrent: expected,
      newScopeVersion,
      appendedSelections: replacement ? [replacement, newSelection] : [newSelection],
      newCurrent: newSelection,
      replay: {
        scopeKey: key,
        idempotencyKey: command.idempotencyKey,
        effectiveCommandFingerprintSha256: fingerprint,
        mutation,
        response: result
      },
      audit
    });
    return committedReplay ? this.asReplay(committedReplay.response) : result;
  }

  async revoke(
    principal: ProviderSelectionPrincipal,
    command: RevokeProviderSelectionCommandV1
  ): Promise<ProviderSelectionMutationResultV1> {
    const requesterWorkspaceId = assertRevokeCommand(principal, command);
    const key = selectionScopeKey(requesterWorkspaceId, command.scope);
    const fingerprint = effectiveCommandFingerprint(principal, command);
    const replay = await this.findReplay(
      key,
      command.idempotencyKey,
      fingerprint,
      'REVOKED'
    );
    if (replay) {
      return replay;
    }

    const state = await this.repository.findScopeState(key);
    const current = state.current;
    if (
      !current ||
      current.status !== 'CURRENT' ||
      !exactScope(current.scope, command.scope) ||
      !sameReference(selectionReference(current), command.target)
    ) {
      throw new ProviderSelectionError(
        'STALE_SELECTION',
        'Human Provider Selection changed; reload the exact current scope version.',
        409
      );
    }
    const revokedAt = this.now();
    const newScopeVersion = state.scopeVersion + 1;
    const revoked: ProviderSelectionV1 = {
      ...current,
      scopeVersion: newScopeVersion,
      version: current.version + 1,
      status: 'REVOKED',
      supersededBy: null,
      revokedAt,
      revocationReasonCode: command.reasonCode
    };
    const result: ProviderSelectionMutationResultV1 = {
      schemaVersion: 1,
      mutation: 'REVOKED',
      selection: revoked,
      previousSelection: selectionReference(current),
      replayed: false,
      replayDoesNotEstablishCurrentUsability: true,
      correlationId: command.correlationId
    };
    const committedReplay = await this.repository.commit({
      scopeKey: key,
      expectedScopeVersion: state.scopeVersion,
      expectedCurrent: selectionReference(current),
      newScopeVersion,
      appendedSelections: [revoked],
      newCurrent: null,
      replay: {
        scopeKey: key,
        idempotencyKey: command.idempotencyKey,
        effectiveCommandFingerprintSha256: fingerprint,
        mutation: 'REVOKED',
        response: result
      },
      audit: {
        scopeKey: key,
        requesterWorkspaceId,
        action: 'REVOKED',
        actorId: principal.actorId,
        selectionAuthorityReference: principal.selectionAuthorityReference,
        commandFingerprintSha256: command.commandFingerprintSha256,
        previousSelection: selectionReference(current),
        selection: selectionReference(revoked),
        occurredAt: revokedAt,
        correlationId: command.correlationId
      }
    });
    return committedReplay ? this.asReplay(committedReplay.response) : result;
  }

  async validateCurrent(
    principal: Pick<ProviderSelectionPrincipal, 'workspaceId'>,
    input: {
      scope: Readonly<ProviderSelectionScopeReferenceV1>;
      providerSelectionId: ProviderSelectionId;
      purpose: ProviderSelectionValidationPurpose;
      checkedAt?: string;
    }
  ): Promise<ProviderSelectionCurrentValidationV1> {
    const workspaceId = cleanWorkspaceId(principal.workspaceId, 'principal.workspaceId');
    assertScope(input.scope);
    cleanText(input.providerSelectionId, 'providerSelectionId', 200);
    const evaluatedAt = input.checkedAt
      ? instant(input.checkedAt, 'checkedAt')
      : instant(this.now(), 'checkedAt');
    const selection = await this.repository.findLatestSelection(input.providerSelectionId);
    if (
      !selection ||
      selection.requesterWorkspaceId.toLowerCase() !== workspaceId ||
      !exactScope(selection.scope, input.scope)
    ) {
      throw new ProviderSelectionError(
        'SELECTION_NOT_FOUND',
        'Human Provider Selection is unavailable for this Workspace and scope.',
        404
      );
    }
    if (selection.status === 'SUPERSEDED') {
      return denial(
        selection,
        input.purpose,
        evaluatedAt,
        'SELECTION_SUPERSEDED',
        publicReasonForDenial('SELECTION_SUPERSEDED')
      );
    }
    if (selection.status === 'REVOKED') {
      return denial(
        selection,
        input.purpose,
        evaluatedAt,
        'SELECTION_REVOKED',
        publicReasonForDenial('SELECTION_REVOKED')
      );
    }

    const state = await this.repository.findScopeState(selectionScopeKey(workspaceId, input.scope));
    if (
      !state.current ||
      state.current.providerSelectionId !== selection.providerSelectionId ||
      state.current.version !== selection.version ||
      state.current.scopeVersion !== selection.scopeVersion
    ) {
      return denial(
        selection,
        input.purpose,
        evaluatedAt,
        'SELECTION_SUPERSEDED',
        publicReasonForDenial('SELECTION_SUPERSEDED')
      );
    }

    const currentValidation = await this.evaluateCurrentAuthority(
      workspaceId,
      selection.trustedHumanAuthority.selectingActorId,
      selection.scope,
      selection.sourceLineage,
      selection.trustedHumanAuthority,
      input.purpose,
      evaluatedAt
    );
    const denialReason = evaluateSnapshotDenial(currentValidation.snapshot);
    const references = sanitizeAuthorityReferences(
      currentValidation.snapshot.checkedAuthorityReferences
    );
    if (denialReason) {
      return denial(
        selection,
        input.purpose,
        evaluatedAt,
        denialReason,
        publicReasonForDenial(denialReason),
        references
      );
    }
    return allowed(selection, input.purpose, evaluatedAt, references);
  }

  private assertExpectedCurrent(
    command: CreateOrReplaceProviderSelectionCommandV1,
    state: ProviderSelectionScopeState
  ): ProviderSelectionVersionReferenceV1 | null {
    if (command.expectedCurrent.expectedScopeVersion !== state.scopeVersion) {
      throw new ProviderSelectionError(
        'STALE_SELECTION',
        'Human Provider Selection changed; reload the exact current scope version.',
        409
      );
    }
    if (command.expectedCurrent.kind === 'ABSENT') {
      if (state.current) {
        throw new ProviderSelectionError(
          'SELECTION_ALREADY_EXISTS',
          'A current Human Provider Selection already exists for this scope.',
          409
        );
      }
      return null;
    }
    const current = state.current;
    if (
      !current ||
      current.status !== 'CURRENT' ||
      current.providerSelectionId !== command.expectedCurrent.providerSelectionId ||
      current.version !== command.expectedCurrent.version ||
      current.scopeVersion !== command.expectedCurrent.expectedScopeVersion
    ) {
      throw new ProviderSelectionError(
        'STALE_SELECTION',
        'Human Provider Selection changed; reload the exact current scope version.',
        409
      );
    }
    return selectionReference(current);
  }

  private async findReplay(
    scopeKeyValue: string,
    idempotencyKey: string,
    effectiveFingerprint: string,
    mutation: ProviderSelectionMutationKind
  ): Promise<ProviderSelectionMutationResultV1 | undefined> {
    const replay = await this.repository.findReplay(scopeKeyValue, idempotencyKey);
    if (!replay) {
      return undefined;
    }
    if (
      replay.effectiveCommandFingerprintSha256 !== effectiveFingerprint ||
      replay.mutation !== mutation
    ) {
      throw new ProviderSelectionError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different trusted context or command payload.',
        409
      );
    }
    return this.asReplay(replay.response);
  }

  private asReplay(result: ProviderSelectionMutationResultV1): ProviderSelectionMutationResultV1 {
    return {
      ...copy(result),
      replayed: true,
      replayDoesNotEstablishCurrentUsability: true
    };
  }

  private async evaluateCurrentAuthority(
    requesterWorkspaceId: string,
    selectingActorId: string,
    scope: Readonly<ProviderSelectionScopeReferenceV1>,
    sourceLineage: Readonly<ProviderSelectionSourceLineageV1>,
    trustedHumanAuthority: Readonly<ProviderSelectionTrustedHumanAuthorityV1>,
    purpose: ProviderSelectionValidationPurpose,
    checkedAtInput?: string
  ): Promise<{ snapshot: Readonly<ProviderSelectionCurrentAuthoritySnapshot>; checkedAt: string }> {
    const checkedAt = checkedAtInput
      ? instant(checkedAtInput, 'checkedAt')
      : instant(this.now(), 'checkedAt');
    try {
      const snapshot = await this.currentAuthoritySource.evaluateCurrentAuthority({
        requesterWorkspaceId,
        selectingActorId,
        scope,
        sourceLineage,
        trustedHumanAuthority,
        purpose,
        checkedAt
      });
      return { snapshot, checkedAt };
    } catch {
      return {
        checkedAt,
        snapshot: {
          authorityAvailable: false,
          requesterAuthorityCurrent: false,
          actorAuthorityCurrent: false,
          candidateCurrent: false,
          participationActive: false,
          visibilityAuthorized: false,
          trustedRelationshipRequired: false,
          trustedRelationshipCurrent: false,
          providerOperational: false,
          supplyCurrent: false,
          directExecutorEstablished: false,
          sourceVersionsMatch: false,
          checkedAuthorityReferences: []
        }
      };
    }
  }
}
