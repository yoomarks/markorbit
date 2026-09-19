import {
  noChannelNotificationAuthorityConsequencesV1,
  parseChannelNotificationRuleSpecV1,
  type ChannelNotificationAuthorityConsequencesV1,
  type ChannelNotificationRuleId,
  type ChannelNotificationRuleSpecV1
} from './channel-notification.js';

export const channelNotificationAutomationRuleStatusesV1 = [
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED'
] as const;
export type ChannelNotificationAutomationRuleStatusV1 =
  (typeof channelNotificationAutomationRuleStatusesV1)[number];

export const channelNotificationAutomationGovernanceActionsV1 = ['ACTIVATE', 'REVOKE'] as const;
export type ChannelNotificationAutomationGovernanceActionV1 =
  (typeof channelNotificationAutomationGovernanceActionsV1)[number];

export interface ChannelNotificationAutomationGovernanceEvidenceV1 {
  owner: 'CORE';
  kind: 'GOVERNED_HUMAN_ACTION_RECEIPT';
  action: ChannelNotificationAutomationGovernanceActionV1;
  workspaceId: string;
  notificationRuleId: ChannelNotificationRuleId;
  authorizedRuleVersion: number;
  authorizedRuleFingerprintSha256: string;
  evidenceRef: string;
  evidenceFingerprintSha256: string;
  verifiedAt: string;
}

export interface ChannelNotificationAutomationRuleV1 {
  schemaVersion: 1;
  workspaceId: string;
  notificationRuleId: ChannelNotificationRuleId;
  version: number;
  status: ChannelNotificationAutomationRuleStatusV1;
  spec: Readonly<ChannelNotificationRuleSpecV1>;
  ruleIntentFingerprintSha256: string;
  activationEvidence: Readonly<ChannelNotificationAutomationGovernanceEvidenceV1> | null;
  revocationEvidence: Readonly<ChannelNotificationAutomationGovernanceEvidenceV1> | null;
  createdByPrincipalId: string;
  updatedByPrincipalId: string;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  revokedAt: string | null;
  authority: Readonly<ChannelNotificationAuthorityConsequencesV1>;
}

export class ChannelNotificationAutomationContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ChannelNotificationAutomationContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const RULE = /^channel-notification-rule_[A-Za-z0-9_-]+$/u;

function object(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ChannelNotificationAutomationContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (actual.join(',') !== expected.join(','))
    throw new ChannelNotificationAutomationContractError(
      `${field} must contain exactly the bounded V1 fields.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new ChannelNotificationAutomationContractError(`${field} must be a string.`);
  const result = value.trim();
  if (!result || result.length > maximum || result.includes('@'))
    throw new ChannelNotificationAutomationContractError(
      `${field} must be bounded opaque text without raw email material.`
    );
  return result;
}

function workspace(value: unknown, field = 'workspaceId'): string {
  const result = text(value, field, 80).toLowerCase();
  if (!UUID.test(result))
    throw new ChannelNotificationAutomationContractError(`${field} must be a Workspace UUID.`);
  return result;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new ChannelNotificationAutomationContractError(
      `${field} must be a positive safe integer.`
    );
  return value as number;
}

function sha(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256.test(value))
    throw new ChannelNotificationAutomationContractError(
      `${field} must be lowercase SHA-256 hex.`
    );
  return value;
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string')
    throw new ChannelNotificationAutomationContractError(`${field} must be a timestamp.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value)
    throw new ChannelNotificationAutomationContractError(
      `${field} must be a canonical ISO timestamp.`
    );
  return value;
}

function ruleId(value: unknown, field = 'notificationRuleId'): ChannelNotificationRuleId {
  const result = text(value, field, 300);
  if (!RULE.test(result))
    throw new ChannelNotificationAutomationContractError(`${field} is invalid.`);
  return result as ChannelNotificationRuleId;
}

function action(
  value: unknown,
  field = 'action'
): ChannelNotificationAutomationGovernanceActionV1 {
  const matched = channelNotificationAutomationGovernanceActionsV1.find(
    (candidate) => candidate === value
  );
  if (!matched)
    throw new ChannelNotificationAutomationContractError(`${field} is invalid.`);
  return matched;
}

function status(value: unknown): ChannelNotificationAutomationRuleStatusV1 {
  const matched = channelNotificationAutomationRuleStatusesV1.find(
    (candidate) => candidate === value
  );
  if (!matched) throw new ChannelNotificationAutomationContractError('status is invalid.');
  return matched;
}

function authority(value: unknown): ChannelNotificationAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  const keys = Object.keys(noChannelNotificationAuthorityConsequencesV1);
  exactKeys(item, keys, 'authority');
  for (const key of keys as Array<keyof ChannelNotificationAuthorityConsequencesV1>) {
    if (item[key] !== false)
      throw new ChannelNotificationAutomationContractError(
        `authority.${key} must remain false.`
      );
  }
  return noChannelNotificationAuthorityConsequencesV1;
}

export function parseChannelNotificationAutomationGovernanceEvidenceV1(
  value: unknown
): ChannelNotificationAutomationGovernanceEvidenceV1 {
  const item = object(value, 'governanceEvidence');
  exactKeys(
    item,
    [
      'owner',
      'kind',
      'action',
      'workspaceId',
      'notificationRuleId',
      'authorizedRuleVersion',
      'authorizedRuleFingerprintSha256',
      'evidenceRef',
      'evidenceFingerprintSha256',
      'verifiedAt'
    ],
    'governanceEvidence'
  );
  if (item.owner !== 'CORE' || item.kind !== 'GOVERNED_HUMAN_ACTION_RECEIPT')
    throw new ChannelNotificationAutomationContractError(
      'governanceEvidence must be verified Core governed-human-action evidence.'
    );
  return {
    owner: 'CORE',
    kind: 'GOVERNED_HUMAN_ACTION_RECEIPT',
    action: action(item.action, 'governanceEvidence.action'),
    workspaceId: workspace(item.workspaceId, 'governanceEvidence.workspaceId'),
    notificationRuleId: ruleId(
      item.notificationRuleId,
      'governanceEvidence.notificationRuleId'
    ),
    authorizedRuleVersion: positiveInteger(
      item.authorizedRuleVersion,
      'governanceEvidence.authorizedRuleVersion'
    ),
    authorizedRuleFingerprintSha256: sha(
      item.authorizedRuleFingerprintSha256,
      'governanceEvidence.authorizedRuleFingerprintSha256'
    ),
    evidenceRef: text(item.evidenceRef, 'governanceEvidence.evidenceRef', 500),
    evidenceFingerprintSha256: sha(
      item.evidenceFingerprintSha256,
      'governanceEvidence.evidenceFingerprintSha256'
    ),
    verifiedAt: timestamp(item.verifiedAt, 'governanceEvidence.verifiedAt')
  };
}

export function isChannelNotificationAutomationRuleStatusTransitionAllowedV1(
  from: ChannelNotificationAutomationRuleStatusV1,
  to: ChannelNotificationAutomationRuleStatusV1
): boolean {
  return (
    (from === 'DRAFT' && (to === 'ACTIVE' || to === 'REVOKED')) ||
    (from === 'ACTIVE' && (to === 'SUSPENDED' || to === 'REVOKED')) ||
    (from === 'SUSPENDED' && (to === 'ACTIVE' || to === 'REVOKED'))
  );
}

function validateEvidenceBinding(
  evidence: ChannelNotificationAutomationGovernanceEvidenceV1,
  item: Pick<
    ChannelNotificationAutomationRuleV1,
    'workspaceId' | 'notificationRuleId' | 'version' | 'spec'
  >,
  expectedAction: ChannelNotificationAutomationGovernanceActionV1,
  requireCurrentVersion: boolean
): void {
  if (
    evidence.workspaceId !== item.workspaceId ||
    evidence.notificationRuleId !== item.notificationRuleId ||
    evidence.action !== expectedAction
  )
    throw new ChannelNotificationAutomationContractError(
      `${expectedAction} governance evidence does not bind this Workspace rule.`
    );
  if (
    requireCurrentVersion &&
    (evidence.authorizedRuleVersion !== item.version ||
      evidence.authorizedRuleFingerprintSha256 !== item.spec.ruleFingerprintSha256)
  )
    throw new ChannelNotificationAutomationContractError(
      `${expectedAction} governance evidence must bind the exact current rule version and fingerprint.`
    );
  if (!requireCurrentVersion && evidence.authorizedRuleVersion >= item.version)
    throw new ChannelNotificationAutomationContractError(
      'Suspended rule activation evidence must bind an earlier ACTIVE rule version.'
    );
}

export function parseChannelNotificationAutomationRuleV1(
  value: unknown,
  expectedWorkspaceId?: string
): ChannelNotificationAutomationRuleV1 {
  const item = object(value, 'notificationAutomationRule');
  exactKeys(
    item,
    [
      'schemaVersion',
      'workspaceId',
      'notificationRuleId',
      'version',
      'status',
      'spec',
      'ruleIntentFingerprintSha256',
      'activationEvidence',
      'revocationEvidence',
      'createdByPrincipalId',
      'updatedByPrincipalId',
      'createdAt',
      'updatedAt',
      'suspendedAt',
      'revokedAt',
      'authority'
    ],
    'notificationAutomationRule'
  );
  if (item.schemaVersion !== 1)
    throw new ChannelNotificationAutomationContractError('schemaVersion must be 1.');

  const workspaceId = workspace(item.workspaceId);
  if (
    expectedWorkspaceId !== undefined &&
    workspaceId !== workspace(expectedWorkspaceId, 'expectedWorkspaceId')
  )
    throw new ChannelNotificationAutomationContractError('Rule Workspace does not match.');

  const notificationRuleId = ruleId(item.notificationRuleId);
  const version = positiveInteger(item.version, 'version');
  let spec: ChannelNotificationRuleSpecV1;
  try {
    spec = parseChannelNotificationRuleSpecV1(item.spec);
  } catch (error) {
    throw new ChannelNotificationAutomationContractError(
      `spec failed Channel Notification validation: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
  }
  if (
    spec.workspaceId !== workspaceId ||
    spec.notificationRuleId !== notificationRuleId ||
    spec.version !== version
  )
    throw new ChannelNotificationAutomationContractError(
      'spec must bind the exact durable rule id, Workspace, and version.'
    );

  const ruleStatus = status(item.status);
  const activationEvidence =
    item.activationEvidence === null
      ? null
      : parseChannelNotificationAutomationGovernanceEvidenceV1(item.activationEvidence);
  const revocationEvidence =
    item.revocationEvidence === null
      ? null
      : parseChannelNotificationAutomationGovernanceEvidenceV1(item.revocationEvidence);
  const createdAt = timestamp(item.createdAt, 'createdAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  if (Date.parse(updatedAt) < Date.parse(createdAt))
    throw new ChannelNotificationAutomationContractError('updatedAt cannot precede createdAt.');
  const suspendedAt =
    item.suspendedAt === null ? null : timestamp(item.suspendedAt, 'suspendedAt');
  const revokedAt = item.revokedAt === null ? null : timestamp(item.revokedAt, 'revokedAt');

  if (ruleStatus === 'DRAFT') {
    if (activationEvidence || revocationEvidence || suspendedAt || revokedAt)
      throw new ChannelNotificationAutomationContractError(
        'DRAFT rule cannot carry activation, revocation, suspension, or revocation state.'
      );
  } else if (ruleStatus === 'ACTIVE') {
    if (!activationEvidence || revocationEvidence || suspendedAt || revokedAt)
      throw new ChannelNotificationAutomationContractError(
        'ACTIVE rule requires only current ACTIVATE governance evidence.'
      );
    validateEvidenceBinding(activationEvidence, { workspaceId, notificationRuleId, version, spec }, 'ACTIVATE', true);
  } else if (ruleStatus === 'SUSPENDED') {
    if (!activationEvidence || revocationEvidence || !suspendedAt || revokedAt)
      throw new ChannelNotificationAutomationContractError(
        'SUSPENDED rule requires prior activation evidence and suspendedAt only.'
      );
    validateEvidenceBinding(activationEvidence, { workspaceId, notificationRuleId, version, spec }, 'ACTIVATE', false);
  } else {
    if (!revocationEvidence || !revokedAt || suspendedAt)
      throw new ChannelNotificationAutomationContractError(
        'REVOKED rule requires current REVOKE governance evidence and revokedAt.'
      );
    validateEvidenceBinding(revocationEvidence, { workspaceId, notificationRuleId, version, spec }, 'REVOKE', true);
  }

  for (const evidence of [activationEvidence, revocationEvidence]) {
    if (evidence && Date.parse(evidence.verifiedAt) > Date.parse(updatedAt))
      throw new ChannelNotificationAutomationContractError(
        'Governance evidence cannot be verified after the durable rule update.'
      );
  }

  return {
    schemaVersion: 1,
    workspaceId,
    notificationRuleId,
    version,
    status: ruleStatus,
    spec,
    ruleIntentFingerprintSha256: sha(
      item.ruleIntentFingerprintSha256,
      'ruleIntentFingerprintSha256'
    ),
    activationEvidence,
    revocationEvidence,
    createdByPrincipalId: text(item.createdByPrincipalId, 'createdByPrincipalId', 240),
    updatedByPrincipalId: text(item.updatedByPrincipalId, 'updatedByPrincipalId', 240),
    createdAt,
    updatedAt,
    suspendedAt,
    revokedAt,
    authority: authority(item.authority)
  };
}
