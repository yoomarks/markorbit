import { createHash, randomUUID } from 'node:crypto';
import {
  channelNotificationAutomationRuleStatusesV1,
  isChannelNotificationAutomationRuleStatusTransitionAllowedV1,
  parseChannelNotificationAutomationGovernanceEvidenceV1,
  parseChannelNotificationAutomationRuleV1,
  type ChannelNotificationAutomationGovernanceActionV1,
  type ChannelNotificationAutomationGovernanceEvidenceV1,
  type ChannelNotificationAutomationRuleStatusV1,
  type ChannelNotificationAutomationRuleV1
} from '@markorbit/contracts/channel-notification-automation';
import {
  noChannelNotificationAuthorityConsequencesV1,
  parseChannelNotificationRuleSpecV1,
  type ChannelNotificationRuleId,
  type ChannelNotificationRuleSpecV1
} from '@markorbit/contracts/channel-notification';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

type Row = Record<string, unknown>;
type CommandType = 'CREATE_DRAFT' | 'ACTIVATE' | 'SUSPEND' | 'REVOKE';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RULE_ID = /^channel-notification-rule_[A-Za-z0-9_-]+$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

export type NotificationAutomationRuleRuntimeErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'ACTIVE_INTENT_CONFLICT'
  | 'GOVERNANCE_VERIFIER_UNAVAILABLE'
  | 'GOVERNANCE_VERIFICATION_FAILED'
  | 'GOVERNANCE_EVIDENCE_INVALID'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class NotificationAutomationRuleRuntimeError extends Error {
  constructor(
    readonly code: NotificationAutomationRuleRuntimeErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'NotificationAutomationRuleRuntimeError';
  }
}

export interface CreateNotificationAutomationRuleCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  triggerSelector: Readonly<ChannelNotificationRuleSpecV1['triggerSelector']>;
  content: Readonly<ChannelNotificationRuleSpecV1['content']>;
  senderProfile: Readonly<ChannelNotificationRuleSpecV1['senderProfile']>;
  ratePolicyRef: string;
}

export interface ActivateNotificationAutomationRuleCommand {
  workspaceId: string;
  notificationRuleId: ChannelNotificationRuleId;
  expectedVersion: number;
  actorPrincipalId: string;
  idempotencyKey: string;
  governanceEvidenceRef: string;
}

export interface SuspendNotificationAutomationRuleCommand {
  workspaceId: string;
  notificationRuleId: ChannelNotificationRuleId;
  expectedVersion: number;
  actorPrincipalId: string;
  idempotencyKey: string;
}

export interface RevokeNotificationAutomationRuleCommand {
  workspaceId: string;
  notificationRuleId: ChannelNotificationRuleId;
  expectedVersion: number;
  actorPrincipalId: string;
  idempotencyKey: string;
  governanceEvidenceRef: string;
}

export interface ListNotificationAutomationRulesOptions {
  status?: ChannelNotificationAutomationRuleStatusV1;
  limit?: number;
}

export interface NotificationAutomationGovernanceVerificationRequestV1 {
  action: ChannelNotificationAutomationGovernanceActionV1;
  workspaceId: string;
  notificationRuleId: ChannelNotificationRuleId;
  candidateRuleVersion: number;
  candidateRuleFingerprintSha256: string;
  governanceEvidenceRef: string;
}

export interface NotificationAutomationGovernanceVerifierV1 {
  verify(
    request: Readonly<NotificationAutomationGovernanceVerificationRequestV1>
  ): Promise<Readonly<ChannelNotificationAutomationGovernanceEvidenceV1>>;
}

interface NormalizedRuleDefinition {
  triggerSelector: ChannelNotificationRuleSpecV1['triggerSelector'];
  content: ChannelNotificationRuleSpecV1['content'];
  senderProfile: ChannelNotificationRuleSpecV1['senderProfile'];
  ratePolicyRef: string;
}

const clone = <T>(value: T): T => structuredClone(value);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function cleanWorkspaceId(value: string): string {
  const result = value.trim().toLowerCase();
  if (!UUID.test(result))
    throw new NotificationAutomationRuleRuntimeError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return result;
}

function cleanText(value: string, field: string, maximum = 500): string {
  const result = value.trim();
  if (!result || result.length > maximum || result.includes('@'))
    throw new NotificationAutomationRuleRuntimeError(
      'INVALID_INPUT',
      `${field} must be bounded opaque text without raw email material.`,
      422
    );
  return result;
}

function cleanRuleId(value: ChannelNotificationRuleId): ChannelNotificationRuleId {
  const result = value.trim();
  if (!RULE_ID.test(result))
    throw new NotificationAutomationRuleRuntimeError(
      'INVALID_INPUT',
      'notificationRuleId is invalid.',
      422
    );
  return result as ChannelNotificationRuleId;
}

function cleanVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new NotificationAutomationRuleRuntimeError(
      'INVALID_INPUT',
      'expectedVersion must be a positive safe integer.',
      422
    );
  return value;
}

function cleanStatus(
  value: ChannelNotificationAutomationRuleStatusV1
): ChannelNotificationAutomationRuleStatusV1 {
  if (!channelNotificationAutomationRuleStatusesV1.includes(value))
    throw new NotificationAutomationRuleRuntimeError('INVALID_INPUT', 'status is invalid.', 422);
  return value;
}

function timestamp(value: string, field = 'now'): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new NotificationAutomationRuleRuntimeError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return parsed.toISOString();
}

function laterTimestamp(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function parseRuntimeRule(
  value: unknown,
  workspaceId: string
): ChannelNotificationAutomationRuleV1 {
  try {
    return parseChannelNotificationAutomationRuleV1(value, workspaceId);
  } catch (error) {
    throw new NotificationAutomationRuleRuntimeError(
      'INVALID_INPUT',
      'Notification Automation Rule contract validation failed.',
      422,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function parsePersistedRule(
  value: unknown,
  workspaceId: string
): ChannelNotificationAutomationRuleV1 {
  try {
    return parseChannelNotificationAutomationRuleV1(value, workspaceId);
  } catch (error) {
    throw new NotificationAutomationRuleRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Notification Automation Rule failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function definitionFromSpec(
  spec: Readonly<ChannelNotificationRuleSpecV1>
): NormalizedRuleDefinition {
  return {
    triggerSelector: clone(spec.triggerSelector),
    content: clone(spec.content),
    senderProfile: clone(spec.senderProfile),
    ratePolicyRef: spec.ratePolicyRef
  };
}

function specFingerprintInput(
  workspaceId: string,
  notificationRuleId: ChannelNotificationRuleId,
  version: number,
  definition: Readonly<NormalizedRuleDefinition>
): unknown {
  return {
    schemaVersion: 1,
    notificationRuleId,
    workspaceId,
    version,
    featureKey: 'EMAIL_NOTIFICATION',
    triggerSelector: definition.triggerSelector,
    destinationResolver: { kind: 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_EMAIL' },
    content: definition.content,
    senderProfile: definition.senderProfile,
    ratePolicyRef: definition.ratePolicyRef,
    dedupePolicy: { mode: 'ONE_PER_RULE_TRIGGER' }
  };
}

function materializeSpec(
  workspaceId: string,
  notificationRuleId: ChannelNotificationRuleId,
  version: number,
  definition: Readonly<NormalizedRuleDefinition>
): ChannelNotificationRuleSpecV1 {
  const input = specFingerprintInput(workspaceId, notificationRuleId, version, definition);
  try {
    return parseChannelNotificationRuleSpecV1({
      ...input,
      ruleFingerprintSha256: fingerprint(input),
      authority: noChannelNotificationAuthorityConsequencesV1
    });
  } catch (error) {
    throw new NotificationAutomationRuleRuntimeError(
      'INVALID_INPUT',
      'Notification Rule definition failed bounded V1 validation.',
      422,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function normalizeDefinition(
  command: Readonly<CreateNotificationAutomationRuleCommand>
): NormalizedRuleDefinition {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  const validationId = 'channel-notification-rule_validation' as ChannelNotificationRuleId;
  const spec = materializeSpec(workspaceId, validationId, 1, {
    triggerSelector: command.triggerSelector,
    content: command.content,
    senderProfile: command.senderProfile,
    ratePolicyRef: cleanText(command.ratePolicyRef, 'ratePolicyRef', 300)
  });
  return definitionFromSpec(spec);
}

export function notificationAutomationRuleIntentFingerprintSha256V1(
  definition: Readonly<NormalizedRuleDefinition>
): string {
  return fingerprint({
    featureKey: 'EMAIL_NOTIFICATION',
    triggerSelector: definition.triggerSelector,
    destinationResolver: { kind: 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_EMAIL' },
    content: definition.content,
    senderProfile: definition.senderProfile,
    ratePolicyRef: definition.ratePolicyRef,
    dedupePolicy: { mode: 'ONE_PER_RULE_TRIGGER' }
  });
}

export function materializeNotificationAutomationDraftV1(
  command: Readonly<CreateNotificationAutomationRuleCommand>,
  at: string,
  notificationRuleId: ChannelNotificationRuleId
): ChannelNotificationAutomationRuleV1 {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  const definition = normalizeDefinition(command);
  const createdAt = timestamp(at);
  const spec = materializeSpec(workspaceId, cleanRuleId(notificationRuleId), 1, definition);
  const actor = cleanText(command.actorPrincipalId, 'actorPrincipalId', 240);
  return parseRuntimeRule(
    {
      schemaVersion: 1,
      workspaceId,
      notificationRuleId: spec.notificationRuleId,
      version: 1,
      status: 'DRAFT',
      spec,
      ruleIntentFingerprintSha256: notificationAutomationRuleIntentFingerprintSha256V1(definition),
      activationEvidence: null,
      revocationEvidence: null,
      createdByPrincipalId: actor,
      updatedByPrincipalId: actor,
      createdAt,
      updatedAt: createdAt,
      suspendedAt: null,
      revokedAt: null,
      authority: noChannelNotificationAuthorityConsequencesV1
    },
    workspaceId
  );
}

function nextSpec(
  current: Readonly<ChannelNotificationAutomationRuleV1>
): ChannelNotificationRuleSpecV1 {
  return materializeSpec(
    current.workspaceId,
    current.notificationRuleId,
    current.version + 1,
    definitionFromSpec(current.spec)
  );
}

function timestampEqual(left: unknown, right: string | null): boolean {
  if (right === null) return left === null || left === undefined;
  if (left === null || left === undefined) return false;
  const leftTime =
    left instanceof Date ? left.getTime() : typeof left === 'string' ? Date.parse(left) : NaN;
  return Number.isFinite(leftTime) && leftTime === Date.parse(right);
}

function versionItemFromRow(row: Row): ChannelNotificationAutomationRuleV1 {
  const workspaceId = String(row.workspace_id);
  const item = parsePersistedRule(row.document_json, workspaceId);
  const mismatch =
    item.notificationRuleId !== String(row.notification_rule_id) ||
    item.version !== Number(row.version) ||
    item.status !== String(row.status) ||
    item.spec.featureKey !== String(row.feature_key) ||
    item.spec.triggerSelector.owner !== String(row.trigger_owner) ||
    item.spec.triggerSelector.eventType !== String(row.trigger_event_type) ||
    item.spec.triggerSelector.subjectKind !== String(row.trigger_subject_kind) ||
    item.spec.content.publishPackageId !== String(row.publish_package_id) ||
    item.spec.content.version !== Number(row.publish_package_version) ||
    item.spec.content.fingerprintSha256 !== String(row.publish_package_fingerprint_sha256) ||
    item.spec.senderProfile.senderProfileId !== String(row.sender_profile_id) ||
    item.spec.senderProfile.version !== Number(row.sender_profile_version) ||
    item.spec.senderProfile.fingerprintSha256 !== String(row.sender_profile_fingerprint_sha256) ||
    item.spec.ratePolicyRef !== String(row.rate_policy_ref) ||
    item.ruleIntentFingerprintSha256 !== String(row.rule_intent_fingerprint_sha256) ||
    item.spec.ruleFingerprintSha256 !== String(row.rule_fingerprint_sha256) ||
    !timestampEqual(row.created_at, item.createdAt) ||
    !timestampEqual(row.updated_at, item.updatedAt) ||
    !timestampEqual(row.suspended_at, item.suspendedAt) ||
    !timestampEqual(row.revoked_at, item.revokedAt);
  if (mismatch)
    throw new NotificationAutomationRuleRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Notification Automation Rule columns do not match document_json.',
      500
    );
  return item;
}

function latestItemFromRow(row: Row): ChannelNotificationAutomationRuleV1 {
  const item = versionItemFromRow(row);
  const mismatch =
    item.version !== Number(row.head_latest_version) ||
    item.status !== String(row.head_status) ||
    item.spec.featureKey !== String(row.head_feature_key) ||
    item.spec.triggerSelector.owner !== String(row.head_trigger_owner) ||
    item.spec.triggerSelector.eventType !== String(row.head_trigger_event_type) ||
    item.spec.triggerSelector.subjectKind !== String(row.head_trigger_subject_kind) ||
    item.spec.content.publishPackageId !== String(row.head_publish_package_id) ||
    item.spec.content.version !== Number(row.head_publish_package_version) ||
    item.spec.content.fingerprintSha256 !== String(row.head_publish_package_fingerprint_sha256) ||
    item.spec.senderProfile.senderProfileId !== String(row.head_sender_profile_id) ||
    item.spec.senderProfile.version !== Number(row.head_sender_profile_version) ||
    item.spec.senderProfile.fingerprintSha256 !==
      String(row.head_sender_profile_fingerprint_sha256) ||
    item.spec.ratePolicyRef !== String(row.head_rate_policy_ref) ||
    item.ruleIntentFingerprintSha256 !== String(row.head_rule_intent_fingerprint_sha256) ||
    item.spec.ruleFingerprintSha256 !== String(row.head_rule_fingerprint_sha256) ||
    !timestampEqual(row.head_updated_at, item.updatedAt);
  if (mismatch)
    throw new NotificationAutomationRuleRuntimeError(
      'INTEGRITY_FAILURE',
      'Notification Automation Rule head does not match its latest durable version.',
      500
    );
  return item;
}

const latestSelect = `SELECT v.*,
       h.latest_version AS head_latest_version,
       h.status AS head_status,
       h.feature_key AS head_feature_key,
       h.trigger_owner AS head_trigger_owner,
       h.trigger_event_type AS head_trigger_event_type,
       h.trigger_subject_kind AS head_trigger_subject_kind,
       h.publish_package_id AS head_publish_package_id,
       h.publish_package_version AS head_publish_package_version,
       h.publish_package_fingerprint_sha256 AS head_publish_package_fingerprint_sha256,
       h.sender_profile_id AS head_sender_profile_id,
       h.sender_profile_version AS head_sender_profile_version,
       h.sender_profile_fingerprint_sha256 AS head_sender_profile_fingerprint_sha256,
       h.rate_policy_ref AS head_rate_policy_ref,
       h.rule_intent_fingerprint_sha256 AS head_rule_intent_fingerprint_sha256,
       h.rule_fingerprint_sha256 AS head_rule_fingerprint_sha256,
       h.updated_at AS head_updated_at
  FROM lite_notification_automation_rule_heads h
  JOIN lite_notification_automation_rule_versions v
    ON v.workspace_id=h.workspace_id
   AND v.notification_rule_id=h.notification_rule_id
   AND v.version=h.latest_version`;

export class PostgresNotificationAutomationRuleStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly governanceVerifier?: NotificationAutomationGovernanceVerifierV1,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => ChannelNotificationRuleId = () =>
      `channel-notification-rule_${randomUUID().replaceAll('-', '')}`
  ) {}

  async createDraft(
    command: Readonly<CreateNotificationAutomationRuleCommand>
  ): Promise<ChannelNotificationAutomationRuleV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const actor = cleanText(command.actorPrincipalId, 'actorPrincipalId', 240);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const definition = normalizeDefinition(command);
    const requestFingerprint = fingerprint({
      commandType: 'CREATE_DRAFT',
      workspaceId,
      actor,
      definition
    });

    return this.command(
      workspaceId,
      idempotencyKey,
      'CREATE_DRAFT',
      requestFingerprint,
      async (client) => {
        const created = materializeNotificationAutomationDraftV1(
          { ...command, workspaceId, actorPrincipalId: actor },
          this.timestamp(),
          this.id()
        );
        await this.insertVersion(client, created);
        await this.insertHead(client, created);
        return created;
      }
    );
  }

  async activate(
    command: Readonly<ActivateNotificationAutomationRuleCommand>
  ): Promise<ChannelNotificationAutomationRuleV1> {
    return this.governedTransition(command, 'ACTIVATE');
  }

  async suspend(
    command: Readonly<SuspendNotificationAutomationRuleCommand>
  ): Promise<ChannelNotificationAutomationRuleV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const notificationRuleId = cleanRuleId(command.notificationRuleId);
    const expectedVersion = cleanVersion(command.expectedVersion);
    const actor = cleanText(command.actorPrincipalId, 'actorPrincipalId', 240);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const requestFingerprint = fingerprint({
      commandType: 'SUSPEND',
      workspaceId,
      notificationRuleId,
      expectedVersion,
      actor
    });

    return this.command(
      workspaceId,
      idempotencyKey,
      'SUSPEND',
      requestFingerprint,
      async (client) => {
        await this.lock(client, `${workspaceId}:notification-rule:${notificationRuleId}`);
        const current = await this.requireLatest(client, workspaceId, notificationRuleId);
        this.assertExpectedVersion(current, expectedVersion);
        this.assertTransition(current.status, 'SUSPENDED');

        const updatedAt = this.transitionTimestamp(current.updatedAt);
        const spec = nextSpec(current);
        const next = parseRuntimeRule(
          {
            ...clone(current),
            version: spec.version,
            status: 'SUSPENDED',
            spec,
            updatedByPrincipalId: actor,
            updatedAt,
            suspendedAt: updatedAt,
            revokedAt: null
          },
          workspaceId
        );
        await this.insertVersion(client, next);
        await this.updateHead(client, next, expectedVersion);
        return next;
      }
    );
  }

  async revoke(
    command: Readonly<RevokeNotificationAutomationRuleCommand>
  ): Promise<ChannelNotificationAutomationRuleV1> {
    return this.governedTransition(command, 'REVOKE');
  }

  async getExact(
    workspaceIdValue: string,
    notificationRuleIdValue: ChannelNotificationRuleId,
    versionValue: number
  ): Promise<ChannelNotificationAutomationRuleV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const notificationRuleId = cleanRuleId(notificationRuleIdValue);
    const version = cleanVersion(versionValue);
    try {
      return await this.readExact(this.query, workspaceId, notificationRuleId, version);
    } catch (error) {
      if (error instanceof NotificationAutomationRuleRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async getLatest(
    workspaceIdValue: string,
    notificationRuleIdValue: ChannelNotificationRuleId
  ): Promise<ChannelNotificationAutomationRuleV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const notificationRuleId = cleanRuleId(notificationRuleIdValue);
    try {
      const result = await this.query.query<Row>(
        `${latestSelect}
         WHERE h.workspace_id=$1 AND h.notification_rule_id=$2`,
        [workspaceId, notificationRuleId]
      );
      return result.rows[0] ? latestItemFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof NotificationAutomationRuleRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async listLatest(
    workspaceIdValue: string,
    options: Readonly<ListNotificationAutomationRulesOptions> = {}
  ): Promise<readonly ChannelNotificationAutomationRuleV1[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const statusValue = options.status === undefined ? null : cleanStatus(options.status);
    const limit = options.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new NotificationAutomationRuleRuntimeError(
        'INVALID_INPUT',
        'limit must be between 1 and 100.',
        422
      );
    try {
      const result = await this.query.query<Row>(
        `${latestSelect}
         WHERE h.workspace_id=$1
           AND ($2::text IS NULL OR h.status=$2)
         ORDER BY h.updated_at DESC, h.notification_rule_id ASC
         LIMIT $3`,
        [workspaceId, statusValue, limit]
      );
      return result.rows.map(latestItemFromRow);
    } catch (error) {
      if (error instanceof NotificationAutomationRuleRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async governedTransition(
    command: Readonly<
      ActivateNotificationAutomationRuleCommand | RevokeNotificationAutomationRuleCommand
    >,
    action: ChannelNotificationAutomationGovernanceActionV1
  ): Promise<ChannelNotificationAutomationRuleV1> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const notificationRuleId = cleanRuleId(command.notificationRuleId);
    const expectedVersion = cleanVersion(command.expectedVersion);
    const actor = cleanText(command.actorPrincipalId, 'actorPrincipalId', 240);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 500);
    const governanceEvidenceRef = cleanText(
      command.governanceEvidenceRef,
      'governanceEvidenceRef',
      500
    );
    const requestFingerprint = fingerprint({
      commandType: action,
      workspaceId,
      notificationRuleId,
      expectedVersion,
      actor,
      governanceEvidenceRef
    });

    const replay = await this.readReplay(workspaceId, idempotencyKey, action, requestFingerprint);
    if (replay) return replay;

    const current = await this.getLatest(workspaceId, notificationRuleId);
    if (!current)
      throw new NotificationAutomationRuleRuntimeError(
        'NOT_FOUND',
        'Notification Automation Rule was not found.',
        404
      );
    this.assertExpectedVersion(current, expectedVersion);
    const targetStatus = action === 'ACTIVATE' ? 'ACTIVE' : 'REVOKED';
    this.assertTransition(current.status, targetStatus);
    const candidateSpec = nextSpec(current);
    const evidence = await this.verifyGovernance({
      action,
      workspaceId,
      notificationRuleId,
      candidateRuleVersion: candidateSpec.version,
      candidateRuleFingerprintSha256: candidateSpec.ruleFingerprintSha256,
      governanceEvidenceRef
    });

    return this.command(workspaceId, idempotencyKey, action, requestFingerprint, async (client) => {
      await this.lock(client, `${workspaceId}:notification-rule:${notificationRuleId}`);
      const latest = await this.requireLatest(client, workspaceId, notificationRuleId);
      this.assertExpectedVersion(latest, expectedVersion);
      this.assertTransition(latest.status, targetStatus);
      const spec = nextSpec(latest);
      this.assertEvidenceBindsCandidate(evidence, action, latest, spec, governanceEvidenceRef);

      if (action === 'ACTIVATE') {
        await this.lock(
          client,
          `${workspaceId}:notification-active-intent:${latest.ruleIntentFingerprintSha256}`
        );
        const existing = await this.findActiveByIntent(
          client,
          workspaceId,
          latest.ruleIntentFingerprintSha256
        );
        if (existing && existing.notificationRuleId !== notificationRuleId)
          throw new NotificationAutomationRuleRuntimeError(
            'ACTIVE_INTENT_CONFLICT',
            'An ACTIVE notification rule already owns this exact Workspace intent.'
          );
      }

      const verifiedAt = evidence.verifiedAt;
      const updatedAt = this.transitionTimestamp(latest.updatedAt, verifiedAt);
      const next = parseRuntimeRule(
        {
          ...clone(latest),
          version: spec.version,
          status: targetStatus,
          spec,
          activationEvidence: action === 'ACTIVATE' ? evidence : latest.activationEvidence,
          revocationEvidence: action === 'REVOKE' ? evidence : null,
          updatedByPrincipalId: actor,
          updatedAt,
          suspendedAt: null,
          revokedAt: action === 'REVOKE' ? updatedAt : null
        },
        workspaceId
      );
      await this.insertVersion(client, next);
      await this.updateHead(client, next, expectedVersion);
      return next;
    });
  }

  private async verifyGovernance(
    request: Readonly<NotificationAutomationGovernanceVerificationRequestV1>
  ): Promise<ChannelNotificationAutomationGovernanceEvidenceV1> {
    if (!this.governanceVerifier)
      throw new NotificationAutomationRuleRuntimeError(
        'GOVERNANCE_VERIFIER_UNAVAILABLE',
        'Notification rule activation/revocation requires a governed human-action verifier.',
        503,
        true
      );
    let returned: Readonly<ChannelNotificationAutomationGovernanceEvidenceV1>;
    try {
      returned = await this.governanceVerifier.verify(request);
    } catch (error) {
      throw new NotificationAutomationRuleRuntimeError(
        'GOVERNANCE_VERIFICATION_FAILED',
        'Governed human-action evidence could not be verified.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }

    try {
      const evidence = parseChannelNotificationAutomationGovernanceEvidenceV1(returned);
      this.assertEvidenceRequest(evidence, request);
      return evidence;
    } catch (error) {
      if (error instanceof NotificationAutomationRuleRuntimeError) throw error;
      throw new NotificationAutomationRuleRuntimeError(
        'GOVERNANCE_EVIDENCE_INVALID',
        'Verifier returned governance evidence outside the exact requested rule binding.',
        409,
        false,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  private assertEvidenceRequest(
    evidence: Readonly<ChannelNotificationAutomationGovernanceEvidenceV1>,
    request: Readonly<NotificationAutomationGovernanceVerificationRequestV1>
  ): void {
    if (
      evidence.action !== request.action ||
      evidence.workspaceId !== request.workspaceId ||
      evidence.notificationRuleId !== request.notificationRuleId ||
      evidence.authorizedRuleVersion !== request.candidateRuleVersion ||
      evidence.authorizedRuleFingerprintSha256 !== request.candidateRuleFingerprintSha256 ||
      evidence.evidenceRef !== request.governanceEvidenceRef
    )
      throw new NotificationAutomationRuleRuntimeError(
        'GOVERNANCE_EVIDENCE_INVALID',
        'Governance evidence does not bind the exact requested rule candidate.'
      );
  }

  private assertEvidenceBindsCandidate(
    evidence: Readonly<ChannelNotificationAutomationGovernanceEvidenceV1>,
    action: ChannelNotificationAutomationGovernanceActionV1,
    current: Readonly<ChannelNotificationAutomationRuleV1>,
    candidateSpec: Readonly<ChannelNotificationRuleSpecV1>,
    evidenceRef: string
  ): void {
    this.assertEvidenceRequest(evidence, {
      action,
      workspaceId: current.workspaceId,
      notificationRuleId: current.notificationRuleId,
      candidateRuleVersion: candidateSpec.version,
      candidateRuleFingerprintSha256: candidateSpec.ruleFingerprintSha256,
      governanceEvidenceRef: evidenceRef
    });
  }

  private assertExpectedVersion(
    current: Readonly<ChannelNotificationAutomationRuleV1>,
    expectedVersion: number
  ): void {
    if (current.version !== expectedVersion)
      throw new NotificationAutomationRuleRuntimeError(
        'VERSION_CONFLICT',
        `Expected Notification Automation Rule version ${expectedVersion}, found ${current.version}.`
      );
  }

  private assertTransition(
    from: ChannelNotificationAutomationRuleStatusV1,
    to: ChannelNotificationAutomationRuleStatusV1
  ): void {
    if (!isChannelNotificationAutomationRuleStatusTransitionAllowedV1(from, to))
      throw new NotificationAutomationRuleRuntimeError(
        'INVALID_TRANSITION',
        `Notification Automation Rule cannot transition from ${from} to ${to}.`
      );
  }

  private transitionTimestamp(current: string, evidenceVerifiedAt?: string): string {
    let result = laterTimestamp(current, this.timestamp());
    if (evidenceVerifiedAt) result = laterTimestamp(result, timestamp(evidenceVerifiedAt));
    return result;
  }

  private async readReplay(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprint: string
  ): Promise<ChannelNotificationAutomationRuleV1 | undefined> {
    try {
      const result = await this.query.query<Row>(
        `SELECT command_type,request_fingerprint_sha256,result_json
           FROM lite_notification_automation_rule_commands
          WHERE workspace_id=$1 AND idempotency_key=$2`,
        [workspaceId, idempotencyKey]
      );
      const prior = result.rows[0];
      if (!prior) return undefined;
      return await this.validateReplay(
        this.query,
        workspaceId,
        prior,
        commandType,
        requestFingerprint
      );
    } catch (error) {
      if (error instanceof NotificationAutomationRuleRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async command(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprint: string,
    write: (client: QueryClient) => Promise<ChannelNotificationAutomationRuleV1>
  ): Promise<ChannelNotificationAutomationRuleV1> {
    try {
      return await this.database.transact(async (client) => {
        await this.lock(client, `${workspaceId}:notification-idempotency:${idempotencyKey}`);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_notification_automation_rule_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0];
        if (prior)
          return this.validateReplay(client, workspaceId, prior, commandType, requestFingerprint);

        const result = await write(client);
        await client.query(
          `INSERT INTO lite_notification_automation_rule_commands(
             workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
           ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [
            workspaceId,
            idempotencyKey,
            commandType,
            requestFingerprint,
            JSON.stringify(result),
            this.timestamp()
          ]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof NotificationAutomationRuleRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async validateReplay(
    client: QueryClient,
    workspaceId: string,
    row: Row,
    commandType: CommandType,
    requestFingerprint: string
  ): Promise<ChannelNotificationAutomationRuleV1> {
    if (
      String(row.command_type) !== commandType ||
      String(row.request_fingerprint_sha256) !== requestFingerprint
    )
      throw new NotificationAutomationRuleRuntimeError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used for a different Notification Automation command.'
      );
    const replay = parsePersistedRule(row.result_json, workspaceId);
    const durable = await this.readExact(
      client,
      workspaceId,
      replay.notificationRuleId,
      replay.version
    );
    if (!durable || fingerprint(durable) !== fingerprint(replay))
      throw new NotificationAutomationRuleRuntimeError(
        'INTEGRITY_FAILURE',
        'Notification Automation command replay no longer matches durable rule truth.',
        500
      );
    return clone(replay);
  }

  private async requireLatest(
    client: QueryClient,
    workspaceId: string,
    notificationRuleId: ChannelNotificationRuleId
  ): Promise<ChannelNotificationAutomationRuleV1> {
    const result = await client.query<Row>(
      `${latestSelect}
       WHERE h.workspace_id=$1 AND h.notification_rule_id=$2`,
      [workspaceId, notificationRuleId]
    );
    if (!result.rows[0])
      throw new NotificationAutomationRuleRuntimeError(
        'NOT_FOUND',
        'Notification Automation Rule was not found.',
        404
      );
    return latestItemFromRow(result.rows[0]);
  }

  private async readExact(
    client: QueryClient,
    workspaceId: string,
    notificationRuleId: ChannelNotificationRuleId,
    version: number
  ): Promise<ChannelNotificationAutomationRuleV1 | undefined> {
    const result = await client.query<Row>(
      `SELECT * FROM lite_notification_automation_rule_versions
        WHERE workspace_id=$1 AND notification_rule_id=$2 AND version=$3`,
      [workspaceId, notificationRuleId, version]
    );
    return result.rows[0] ? versionItemFromRow(result.rows[0]) : undefined;
  }

  private async findActiveByIntent(
    client: QueryClient,
    workspaceId: string,
    ruleIntentFingerprintSha256: string
  ): Promise<ChannelNotificationAutomationRuleV1 | undefined> {
    const result = await client.query<Row>(
      `${latestSelect}
       WHERE h.workspace_id=$1
         AND h.status='ACTIVE'
         AND h.rule_intent_fingerprint_sha256=$2`,
      [workspaceId, ruleIntentFingerprintSha256]
    );
    return result.rows[0] ? latestItemFromRow(result.rows[0]) : undefined;
  }

  private async insertVersion(
    client: QueryClient,
    item: Readonly<ChannelNotificationAutomationRuleV1>
  ): Promise<void> {
    const parsed = parseRuntimeRule(item, item.workspaceId);
    await client.query(
      `INSERT INTO lite_notification_automation_rule_versions(
         workspace_id,notification_rule_id,version,status,feature_key,
         trigger_owner,trigger_event_type,trigger_subject_kind,
         publish_package_id,publish_package_version,publish_package_fingerprint_sha256,
         sender_profile_id,sender_profile_version,sender_profile_fingerprint_sha256,
         rate_policy_ref,rule_intent_fingerprint_sha256,rule_fingerprint_sha256,
         document_json,created_at,updated_at,suspended_at,revoked_at
       ) VALUES(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
         $18::jsonb,$19,$20,$21,$22
       )`,
      [
        parsed.workspaceId,
        parsed.notificationRuleId,
        parsed.version,
        parsed.status,
        parsed.spec.featureKey,
        parsed.spec.triggerSelector.owner,
        parsed.spec.triggerSelector.eventType,
        parsed.spec.triggerSelector.subjectKind,
        parsed.spec.content.publishPackageId,
        parsed.spec.content.version,
        parsed.spec.content.fingerprintSha256,
        parsed.spec.senderProfile.senderProfileId,
        parsed.spec.senderProfile.version,
        parsed.spec.senderProfile.fingerprintSha256,
        parsed.spec.ratePolicyRef,
        parsed.ruleIntentFingerprintSha256,
        parsed.spec.ruleFingerprintSha256,
        JSON.stringify(parsed),
        parsed.createdAt,
        parsed.updatedAt,
        parsed.suspendedAt,
        parsed.revokedAt
      ]
    );
  }

  private async insertHead(
    client: QueryClient,
    item: Readonly<ChannelNotificationAutomationRuleV1>
  ): Promise<void> {
    await client.query(
      `INSERT INTO lite_notification_automation_rule_heads(
         workspace_id,notification_rule_id,latest_version,status,feature_key,
         trigger_owner,trigger_event_type,trigger_subject_kind,
         publish_package_id,publish_package_version,publish_package_fingerprint_sha256,
         sender_profile_id,sender_profile_version,sender_profile_fingerprint_sha256,
         rate_policy_ref,rule_intent_fingerprint_sha256,rule_fingerprint_sha256,updated_at
       ) VALUES(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
       )`,
      this.headValues(item)
    );
  }

  private async updateHead(
    client: QueryClient,
    item: Readonly<ChannelNotificationAutomationRuleV1>,
    expectedVersion: number
  ): Promise<void> {
    const values = this.headValues(item);
    const updated = await client.query(
      `UPDATE lite_notification_automation_rule_heads
          SET latest_version=$3,status=$4,feature_key=$5,
              trigger_owner=$6,trigger_event_type=$7,trigger_subject_kind=$8,
              publish_package_id=$9,publish_package_version=$10,
              publish_package_fingerprint_sha256=$11,
              sender_profile_id=$12,sender_profile_version=$13,
              sender_profile_fingerprint_sha256=$14,rate_policy_ref=$15,
              rule_intent_fingerprint_sha256=$16,rule_fingerprint_sha256=$17,updated_at=$18
        WHERE workspace_id=$1 AND notification_rule_id=$2 AND latest_version=$19`,
      [...values, expectedVersion]
    );
    if (updated.rowCount !== 1)
      throw new NotificationAutomationRuleRuntimeError(
        'VERSION_CONFLICT',
        'Notification Automation Rule changed before the transition could be persisted.'
      );
  }

  private headValues(item: Readonly<ChannelNotificationAutomationRuleV1>): readonly unknown[] {
    return [
      item.workspaceId,
      item.notificationRuleId,
      item.version,
      item.status,
      item.spec.featureKey,
      item.spec.triggerSelector.owner,
      item.spec.triggerSelector.eventType,
      item.spec.triggerSelector.subjectKind,
      item.spec.content.publishPackageId,
      item.spec.content.version,
      item.spec.content.fingerprintSha256,
      item.spec.senderProfile.senderProfileId,
      item.spec.senderProfile.version,
      item.spec.senderProfile.fingerprintSha256,
      item.spec.ratePolicyRef,
      item.ruleIntentFingerprintSha256,
      item.spec.ruleFingerprintSha256,
      item.updatedAt
    ];
  }

  private async lock(client: QueryClient, value: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [value]);
  }

  private timestamp(): string {
    return timestamp(this.now());
  }

  private persistenceError(cause: unknown): NotificationAutomationRuleRuntimeError {
    return new NotificationAutomationRuleRuntimeError(
      'PERSISTENCE_UNAVAILABLE',
      'Notification Automation Rule persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
