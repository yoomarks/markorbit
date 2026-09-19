import type { WorkspaceEmailSenderProfileId } from './email-sender-profile.js';
import type { PublishPackageId } from './product-loop.js';

export type ChannelNotificationRuleId = `channel-notification-rule_${string}`;
export type ChannelNotificationTriggerEvidenceId =
  `channel-notification-trigger_${string}`;
export type ChannelNotificationSendIntentId =
  `channel-notification-send-intent_${string}`;

export const noChannelNotificationAuthorityConsequencesV1 = Object.freeze({
  businessTruthCreated: false,
  customerTruthCreated: false,
  matterTruthCreated: false,
  trademarkTruthCreated: false,
  legalNoticeEffective: false,
  providerSelectionAuthorityGranted: false,
  protectedActionAuthorized: false,
  externalSendAuthorized: false,
  externalMessageSent: false
});
export type ChannelNotificationAuthorityConsequencesV1 =
  typeof noChannelNotificationAuthorityConsequencesV1;

export interface ChannelNotificationRuleSpecV1 {
  schemaVersion: 1;
  notificationRuleId: ChannelNotificationRuleId;
  workspaceId: string;
  version: number;
  featureKey: 'EMAIL_NOTIFICATION';
  triggerSelector: Readonly<{
    owner: string;
    eventType: string;
    subjectKind: string;
  }>;
  destinationResolver: Readonly<{
    kind: 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_EMAIL';
  }>;
  content: Readonly<{
    publishPackageId: PublishPackageId;
    version: number;
    fingerprintSha256: string;
  }>;
  senderProfile: Readonly<{
    senderProfileId: WorkspaceEmailSenderProfileId;
    version: number;
    fingerprintSha256: string;
  }>;
  ratePolicyRef: string;
  dedupePolicy: Readonly<{
    mode: 'ONE_PER_RULE_TRIGGER';
  }>;
  ruleFingerprintSha256: string;
  authority: Readonly<ChannelNotificationAuthorityConsequencesV1>;
}

export interface ChannelNotificationTriggerEvidenceV1 {
  schemaVersion: 1;
  notificationTriggerEvidenceId: ChannelNotificationTriggerEvidenceId;
  workspaceId: string;
  version: 1;
  owner: string;
  eventType: string;
  eventId: string;
  subject: Readonly<{
    owner: string;
    kind: string;
    id: string;
    version: number;
  }>;
  occurredAt: string;
  evidenceRefs: readonly string[];
  triggerFingerprintSha256: string;
  authority: Readonly<ChannelNotificationAuthorityConsequencesV1>;
}

export interface ChannelNotificationSendIntentV1 {
  schemaVersion: 1;
  notificationSendIntentId: ChannelNotificationSendIntentId;
  workspaceId: string;
  version: 1;
  featureKey: 'EMAIL_NOTIFICATION';
  rule: Readonly<{
    notificationRuleId: ChannelNotificationRuleId;
    version: number;
    fingerprintSha256: string;
  }>;
  trigger: Readonly<{
    notificationTriggerEvidenceId: ChannelNotificationTriggerEvidenceId;
    version: 1;
    fingerprintSha256: string;
  }>;
  target: Readonly<{
    owner: string;
    kind: string;
    id: string;
    version: number;
    endpointFingerprintSha256: string;
  }>;
  content: Readonly<{
    publishPackageId: PublishPackageId;
    version: number;
    fingerprintSha256: string;
  }>;
  senderProfile: Readonly<{
    senderProfileId: WorkspaceEmailSenderProfileId;
    version: number;
    fingerprintSha256: string;
  }>;
  deliveryPlanFingerprintSha256: string;
  effectFingerprintSha256: string;
  authority: Readonly<ChannelNotificationAuthorityConsequencesV1>;
}

export class ChannelNotificationContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ChannelNotificationContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const RULE = /^channel-notification-rule_[A-Za-z0-9_-]+$/u;
const TRIGGER = /^channel-notification-trigger_[A-Za-z0-9_-]+$/u;
const INTENT = /^channel-notification-send-intent_[A-Za-z0-9_-]+$/u;
const PUBLISH = /^publish-package_[A-Za-z0-9_-]+$/u;
const SENDER = /^email-sender-profile_[A-Za-z0-9_-]+$/u;
const forbiddenKeys = new Set([
  'email',
  'emailaddress',
  'recipient',
  'recipientemail',
  'fromaddress',
  'toaddress',
  'replytoaddress',
  'subject',
  'body',
  'textbody',
  'htmlbody',
  'rawemail',
  'rawpayload',
  'attachment',
  'attachments',
  'providercredential',
  'credential',
  'credentials',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'password',
  'secret'
]);

function normalizedKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}

function rejectForbidden(value: unknown, field: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectForbidden(entry, `${field}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (forbiddenKeys.has(normalizedKey(key)))
      throw new ChannelNotificationContractError(
        `${field}.${key} is forbidden durable notification material.`
      );
    rejectForbidden(nested, `${field}.${key}`);
  }
}

function object(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ChannelNotificationContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (actual.join(',') !== expected.join(','))
    throw new ChannelNotificationContractError(
      `${field} must contain exactly the bounded V1 fields.`
    );
}

function text(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string')
    throw new ChannelNotificationContractError(`${field} must be a string.`);
  const result = value.trim();
  if (!result || result.length > max || result.includes('@'))
    throw new ChannelNotificationContractError(
      `${field} must be a bounded opaque reference/text without raw email data.`
    );
  return result;
}

function workspace(value: unknown): string {
  const result = text(value, 'workspaceId', 80).toLowerCase();
  if (!UUID.test(result))
    throw new ChannelNotificationContractError('workspaceId must be a UUID.');
  return result;
}

function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new ChannelNotificationContractError(`${field} must be a positive safe integer.`);
  return value as number;
}

function sha(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256.test(value))
    throw new ChannelNotificationContractError(`${field} must be lowercase SHA-256 hex.`);
  return value;
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string')
    throw new ChannelNotificationContractError(`${field} must be a timestamp string.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value)
    throw new ChannelNotificationContractError(
      `${field} must be a canonical ISO timestamp.`
    );
  return value;
}

function prefixed<T extends string>(
  value: unknown,
  field: string,
  pattern: RegExp
): T {
  const result = text(value, field, 300);
  if (!pattern.test(result))
    throw new ChannelNotificationContractError(`${field} is invalid.`);
  return result as T;
}

function authority(value: unknown): ChannelNotificationAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  exactKeys(item, Object.keys(noChannelNotificationAuthorityConsequencesV1), 'authority');
  for (const key of Object.keys(
    noChannelNotificationAuthorityConsequencesV1
  ) as Array<keyof ChannelNotificationAuthorityConsequencesV1>) {
    if (item[key] !== false)
      throw new ChannelNotificationContractError(`authority.${key} must remain false.`);
  }
  return noChannelNotificationAuthorityConsequencesV1;
}

function publishPackage(value: unknown, field: string) {
  const item = object(value, field);
  exactKeys(item, ['publishPackageId', 'version', 'fingerprintSha256'], field);
  return {
    publishPackageId: prefixed<PublishPackageId>(
      item.publishPackageId,
      `${field}.publishPackageId`,
      PUBLISH
    ),
    version: integer(item.version, `${field}.version`),
    fingerprintSha256: sha(item.fingerprintSha256, `${field}.fingerprintSha256`)
  } as const;
}

function senderProfile(value: unknown, field: string) {
  const item = object(value, field);
  exactKeys(item, ['senderProfileId', 'version', 'fingerprintSha256'], field);
  return {
    senderProfileId: prefixed<WorkspaceEmailSenderProfileId>(
      item.senderProfileId,
      `${field}.senderProfileId`,
      SENDER
    ),
    version: integer(item.version, `${field}.version`),
    fingerprintSha256: sha(item.fingerprintSha256, `${field}.fingerprintSha256`)
  } as const;
}

function evidenceRefs(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20)
    throw new ChannelNotificationContractError(
      'evidenceRefs must contain between 1 and 20 opaque references.'
    );
  const refs = value.map((entry, index) => text(entry, `evidenceRefs[${index}]`, 500));
  if (new Set(refs).size !== refs.length)
    throw new ChannelNotificationContractError('evidenceRefs must not contain duplicates.');
  return refs;
}

export function parseChannelNotificationRuleSpecV1(
  value: unknown
): ChannelNotificationRuleSpecV1 {
  rejectForbidden(value, 'notificationRule');
  const item = object(value, 'notificationRule');
  exactKeys(
    item,
    [
      'schemaVersion',
      'notificationRuleId',
      'workspaceId',
      'version',
      'featureKey',
      'triggerSelector',
      'destinationResolver',
      'content',
      'senderProfile',
      'ratePolicyRef',
      'dedupePolicy',
      'ruleFingerprintSha256',
      'authority'
    ],
    'notificationRule'
  );
  if (item.schemaVersion !== 1 || item.featureKey !== 'EMAIL_NOTIFICATION')
    throw new ChannelNotificationContractError(
      'Notification Rule V1 supports EMAIL_NOTIFICATION only.'
    );
  const triggerSelector = object(item.triggerSelector, 'triggerSelector');
  exactKeys(triggerSelector, ['owner', 'eventType', 'subjectKind'], 'triggerSelector');
  const destinationResolver = object(item.destinationResolver, 'destinationResolver');
  exactKeys(destinationResolver, ['kind'], 'destinationResolver');
  if (destinationResolver.kind !== 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_EMAIL')
    throw new ChannelNotificationContractError('destinationResolver.kind is invalid.');
  const dedupePolicy = object(item.dedupePolicy, 'dedupePolicy');
  exactKeys(dedupePolicy, ['mode'], 'dedupePolicy');
  if (dedupePolicy.mode !== 'ONE_PER_RULE_TRIGGER')
    throw new ChannelNotificationContractError('dedupePolicy.mode is invalid.');
  return {
    schemaVersion: 1,
    notificationRuleId: prefixed<ChannelNotificationRuleId>(
      item.notificationRuleId,
      'notificationRuleId',
      RULE
    ),
    workspaceId: workspace(item.workspaceId),
    version: integer(item.version, 'version'),
    featureKey: 'EMAIL_NOTIFICATION',
    triggerSelector: {
      owner: text(triggerSelector.owner, 'triggerSelector.owner', 120),
      eventType: text(triggerSelector.eventType, 'triggerSelector.eventType', 160),
      subjectKind: text(triggerSelector.subjectKind, 'triggerSelector.subjectKind', 120)
    },
    destinationResolver: {
      kind: 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_EMAIL'
    },
    content: publishPackage(item.content, 'content'),
    senderProfile: senderProfile(item.senderProfile, 'senderProfile'),
    ratePolicyRef: text(item.ratePolicyRef, 'ratePolicyRef', 300),
    dedupePolicy: { mode: 'ONE_PER_RULE_TRIGGER' },
    ruleFingerprintSha256: sha(item.ruleFingerprintSha256, 'ruleFingerprintSha256'),
    authority: authority(item.authority)
  };
}

export function parseChannelNotificationTriggerEvidenceV1(
  value: unknown
): ChannelNotificationTriggerEvidenceV1 {
  rejectForbidden(value, 'notificationTrigger');
  const item = object(value, 'notificationTrigger');
  exactKeys(
    item,
    [
      'schemaVersion',
      'notificationTriggerEvidenceId',
      'workspaceId',
      'version',
      'owner',
      'eventType',
      'eventId',
      'subject',
      'occurredAt',
      'evidenceRefs',
      'triggerFingerprintSha256',
      'authority'
    ],
    'notificationTrigger'
  );
  if (item.schemaVersion !== 1 || item.version !== 1)
    throw new ChannelNotificationContractError('Notification Trigger schemaVersion/version must be 1.');
  const subject = object(item.subject, 'subject');
  exactKeys(subject, ['owner', 'kind', 'id', 'version'], 'subject');
  return {
    schemaVersion: 1,
    notificationTriggerEvidenceId: prefixed<ChannelNotificationTriggerEvidenceId>(
      item.notificationTriggerEvidenceId,
      'notificationTriggerEvidenceId',
      TRIGGER
    ),
    workspaceId: workspace(item.workspaceId),
    version: 1,
    owner: text(item.owner, 'owner', 120),
    eventType: text(item.eventType, 'eventType', 160),
    eventId: text(item.eventId, 'eventId', 500),
    subject: {
      owner: text(subject.owner, 'subject.owner', 120),
      kind: text(subject.kind, 'subject.kind', 120),
      id: text(subject.id, 'subject.id', 500),
      version: integer(subject.version, 'subject.version')
    },
    occurredAt: timestamp(item.occurredAt, 'occurredAt'),
    evidenceRefs: evidenceRefs(item.evidenceRefs),
    triggerFingerprintSha256: sha(
      item.triggerFingerprintSha256,
      'triggerFingerprintSha256'
    ),
    authority: authority(item.authority)
  };
}

export function parseChannelNotificationSendIntentV1(
  value: unknown
): ChannelNotificationSendIntentV1 {
  rejectForbidden(value, 'notificationSendIntent');
  const item = object(value, 'notificationSendIntent');
  exactKeys(
    item,
    [
      'schemaVersion',
      'notificationSendIntentId',
      'workspaceId',
      'version',
      'featureKey',
      'rule',
      'trigger',
      'target',
      'content',
      'senderProfile',
      'deliveryPlanFingerprintSha256',
      'effectFingerprintSha256',
      'authority'
    ],
    'notificationSendIntent'
  );
  if (
    item.schemaVersion !== 1 ||
    item.version !== 1 ||
    item.featureKey !== 'EMAIL_NOTIFICATION'
  )
    throw new ChannelNotificationContractError(
      'Notification Send Intent V1 supports EMAIL_NOTIFICATION only.'
    );

  const rule = object(item.rule, 'rule');
  exactKeys(rule, ['notificationRuleId', 'version', 'fingerprintSha256'], 'rule');
  const trigger = object(item.trigger, 'trigger');
  exactKeys(
    trigger,
    ['notificationTriggerEvidenceId', 'version', 'fingerprintSha256'],
    'trigger'
  );
  if (trigger.version !== 1)
    throw new ChannelNotificationContractError('trigger.version must be 1.');
  const target = object(item.target, 'target');
  exactKeys(
    target,
    ['owner', 'kind', 'id', 'version', 'endpointFingerprintSha256'],
    'target'
  );

  return {
    schemaVersion: 1,
    notificationSendIntentId: prefixed<ChannelNotificationSendIntentId>(
      item.notificationSendIntentId,
      'notificationSendIntentId',
      INTENT
    ),
    workspaceId: workspace(item.workspaceId),
    version: 1,
    featureKey: 'EMAIL_NOTIFICATION',
    rule: {
      notificationRuleId: prefixed<ChannelNotificationRuleId>(
        rule.notificationRuleId,
        'rule.notificationRuleId',
        RULE
      ),
      version: integer(rule.version, 'rule.version'),
      fingerprintSha256: sha(rule.fingerprintSha256, 'rule.fingerprintSha256')
    },
    trigger: {
      notificationTriggerEvidenceId: prefixed<ChannelNotificationTriggerEvidenceId>(
        trigger.notificationTriggerEvidenceId,
        'trigger.notificationTriggerEvidenceId',
        TRIGGER
      ),
      version: 1,
      fingerprintSha256: sha(trigger.fingerprintSha256, 'trigger.fingerprintSha256')
    },
    target: {
      owner: text(target.owner, 'target.owner', 120),
      kind: text(target.kind, 'target.kind', 120),
      id: text(target.id, 'target.id', 500),
      version: integer(target.version, 'target.version'),
      endpointFingerprintSha256: sha(
        target.endpointFingerprintSha256,
        'target.endpointFingerprintSha256'
      )
    },
    content: publishPackage(item.content, 'content'),
    senderProfile: senderProfile(item.senderProfile, 'senderProfile'),
    deliveryPlanFingerprintSha256: sha(
      item.deliveryPlanFingerprintSha256,
      'deliveryPlanFingerprintSha256'
    ),
    effectFingerprintSha256: sha(item.effectFingerprintSha256, 'effectFingerprintSha256'),
    authority: authority(item.authority)
  };
}
