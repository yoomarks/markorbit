import { createHash } from 'node:crypto';

import type { CustomerRelationshipId } from './customer-context.js';
import type { FormalMatterId } from './index.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';
import type { WorkspaceDirectoryEntryId } from './workspace-directory.js';

/** Durable Workspace-local decision about one communication source scope × one exact target. */
export type CommunicationLinkId = `communication-link_${string}`;

export const communicationLinkSourceScopes = ['MESSAGE', 'THREAD'] as const;
export type CommunicationLinkSourceScope = (typeof communicationLinkSourceScopes)[number];

export const communicationLinkDecisionStatuses = ['CONFIRMED', 'REJECTED'] as const;
export type CommunicationLinkDecisionStatus = (typeof communicationLinkDecisionStatuses)[number];

export const communicationLinkDecisionBases = [
  'MANUAL',
  'EXACT_IDENTIFIER',
  'CONFIRMED_THREAD_INHERITANCE'
] as const;
export type CommunicationLinkDecisionBasis = (typeof communicationLinkDecisionBases)[number];

export const communicationLinkLifecycleStates = ['ACTIVE', 'ARCHIVED'] as const;
export type CommunicationLinkLifecycle = (typeof communicationLinkLifecycleStates)[number];

export const communicationLinkTargetKinds = [
  'CUSTOMER_RELATIONSHIP',
  'WORKSPACE_DIRECTORY_ENTRY',
  'TRADEMARK_ASSET',
  'FORMAL_MATTER',
  'PRODUCTION_INTAKE'
] as const;
export type CommunicationLinkTargetKind = (typeof communicationLinkTargetKinds)[number];
export interface CommunicationLinkMessageSourceReferenceV1 {
  owner: 'MANAGED_COMMUNICATION';
  scope: 'MESSAGE';
  accountRef: string;
  messageId: string;
  threadRef: string;
  provider: string;
  providerMessageId: string;
  observedAt: string;
}

export interface CommunicationLinkThreadSourceReferenceV1 {
  owner: 'MANAGED_COMMUNICATION';
  scope: 'THREAD';
  accountRef: string;
  messageId: string;
  threadRef: string;
  provider: string;
  providerMessageId: string;
  observedAt: string;
}

export type CommunicationLinkSourceReferenceV1 =
  CommunicationLinkMessageSourceReferenceV1 | CommunicationLinkThreadSourceReferenceV1;

export interface CommunicationLinkCustomerRelationshipTargetV1 {
  targetKind: 'CUSTOMER_RELATIONSHIP';
  owner: 'MARKREG';
  workspaceId: string;
  customerRelationshipId: CustomerRelationshipId;
  version: number;
}
export interface CommunicationLinkDirectoryTargetV1 {
  targetKind: 'WORKSPACE_DIRECTORY_ENTRY';
  owner: 'LITE';
  workspaceId: string;
  workspaceDirectoryEntryId: WorkspaceDirectoryEntryId;
  version: number;
}

export interface CommunicationLinkTrademarkAssetTargetV1 {
  targetKind: 'TRADEMARK_ASSET';
  owner: 'LITE';
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  version: number;
}

export interface CommunicationLinkFormalMatterTargetV1 {
  targetKind: 'FORMAL_MATTER';
  owner: 'MARKREG';
  workspaceId: string;
  formalMatterId: FormalMatterId;
  version: number;
}

export interface CommunicationLinkProductionIntakeTargetV1 {
  targetKind: 'PRODUCTION_INTAKE';
  owner: 'MARKREG';
  workspaceId: string;
  intakeId: `production-intake_${string}`;
  version: number;
  fingerprintSha256: string;
}

export type CommunicationLinkTargetReferenceV1 =
  | CommunicationLinkCustomerRelationshipTargetV1
  | CommunicationLinkDirectoryTargetV1
  | CommunicationLinkTrademarkAssetTargetV1
  | CommunicationLinkFormalMatterTargetV1
  | CommunicationLinkProductionIntakeTargetV1;

export interface CommunicationLinkHumanDecisionV1 {
  status: CommunicationLinkDecisionStatus;
  basis: CommunicationLinkDecisionBasis;
  authority: 'HUMAN';
  decidedByPrincipalId: string;
  decidedAt: string;
  reason: string | null;
  evidenceReferences: readonly string[];
  decisionFingerprintSha256: string;
}

export const noCommunicationLinkAuthorityConsequencesV1 = Object.freeze({
  customerTruthMutated: false,
  directoryTruthMutated: false,
  trademarkAssetMutated: false,
  matterTruthMutated: false,
  productionIntakeMutated: false,
  customerContactAuthorized: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  deadlineCertified: false,
  officialTruthCreated: false,
  legalConclusionCreated: false,
  protectedActionAuthorized: false,
  externalActionAuthorized: false
});
export type CommunicationLinkAuthorityConsequencesV1 =
  typeof noCommunicationLinkAuthorityConsequencesV1;

export interface CommunicationLinkV1 {
  schemaVersion: 1;
  communicationLinkId: CommunicationLinkId;
  workspaceId: string;
  version: number;
  source: Readonly<CommunicationLinkSourceReferenceV1>;
  target: Readonly<CommunicationLinkTargetReferenceV1>;
  decision: Readonly<CommunicationLinkHumanDecisionV1>;
  lifecycle: CommunicationLinkLifecycle;
  archivedAt: string | null;
  authorityConsequences: Readonly<CommunicationLinkAuthorityConsequencesV1>;
  createdAt: string;
  updatedAt: string;
}

export const communicationLinkThreadLookupStates = [
  'RESULTS',
  'EMPTY',
  'NOT_OBSERVED',
  'UNAVAILABLE'
] as const;
export type CommunicationLinkThreadLookupState =
  (typeof communicationLinkThreadLookupStates)[number];

export interface CommunicationLinkThreadLookupResultV1 {
  schemaVersion: 1;
  workspaceId: string;
  accountRef: string;
  threadRef: string;
  readState: CommunicationLinkThreadLookupState;
  links: ReadonlyArray<Readonly<CommunicationLinkV1>>;
  evaluatedAt: string;
}

export class CommunicationLinkContractValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'CommunicationLinkContractValidationError';
  }
}

type JsonRecord = Record<string, unknown>;
const linkIdPattern = /^communication-link_[A-Za-z0-9_-]+$/u;
const customerRelationshipIdPattern = /^customer-relationship_[A-Za-z0-9_-]+$/u;
const directoryEntryIdPattern = /^workspace-directory-entry_[A-Za-z0-9_-]+$/u;
const trademarkAssetIdPattern = /^trademark-asset_[A-Za-z0-9_-]+$/u;
const formalMatterIdPattern = /^formal-matter_[A-Za-z0-9_-]+$/u;
const productionIntakeIdPattern = /^production-intake_[A-Za-z0-9_-]+$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function sha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function sha256Hex(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!sha256Pattern.test(result)) {
    throw new CommunicationLinkContractValidationError(`${field} must be lowercase SHA-256 hex.`);
  }
  return result;
}

export function communicationLinkDecisionFingerprintSha256V1(
  input: Readonly<{
    source: Readonly<CommunicationLinkSourceReferenceV1>;
    target: Readonly<CommunicationLinkTargetReferenceV1>;
    status: CommunicationLinkDecisionStatus;
    basis: CommunicationLinkDecisionBasis;
    reason: string | null;
    evidenceReferences: readonly string[];
  }>
): string {
  return sha256({
    source: input.source,
    target: input.target,
    status: input.status,
    basis: input.basis,
    reason: input.reason,
    evidenceReferences: input.evidenceReferences
  });
}
function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CommunicationLinkContractValidationError(`${field} must be an object.`);
  }
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (unsupported.length > 0 || missing.length > 0) {
    throw new CommunicationLinkContractValidationError(
      `${field} must contain exactly the V1 fields; unsupported=${unsupported.join(',') || 'none'}; missing=${missing.join(',') || 'none'}.`
    );
  }
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') {
    throw new CommunicationLinkContractValidationError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new CommunicationLinkContractValidationError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  }
  return normalized;
}
function nullableText(value: unknown, field: string, maximum = 1000): string | null {
  if (value === null) return null;
  return text(value, field, maximum);
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new CommunicationLinkContractValidationError(`${field} must be a positive safe integer.`);
  }
  return value as number;
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 80);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== result) {
    throw new CommunicationLinkContractValidationError(
      `${field} must be a canonical ISO timestamp.`
    );
  }
  return result;
}

function literal<T extends string>(value: unknown, expected: T, field: string): T {
  if (value !== expected) {
    throw new CommunicationLinkContractValidationError(`${field} must be ${expected}.`);
  }
  return expected;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new CommunicationLinkContractValidationError(`${field} is invalid.`);
  }
  return value as T;
}
function brandedId<T extends string>(value: unknown, pattern: RegExp, field: string): T {
  const result = text(value, field, 200);
  if (!pattern.test(result)) {
    throw new CommunicationLinkContractValidationError(`${field} is invalid.`);
  }
  return result as T;
}

function parseSource(value: unknown): CommunicationLinkSourceReferenceV1 {
  const source = record(value, 'communicationLink.source');
  const scope = oneOf(
    source.scope,
    communicationLinkSourceScopes,
    'communicationLink.source.scope'
  );
  exactKeys(
    source,
    [
      'owner',
      'scope',
      'accountRef',
      'messageId',
      'threadRef',
      'provider',
      'providerMessageId',
      'observedAt'
    ],
    'communicationLink.source'
  );
  return {
    owner: literal(source.owner, 'MANAGED_COMMUNICATION', 'communicationLink.source.owner'),
    scope,
    accountRef: text(source.accountRef, 'communicationLink.source.accountRef'),
    messageId: text(source.messageId, 'communicationLink.source.messageId'),
    threadRef: text(source.threadRef, 'communicationLink.source.threadRef'),
    provider: text(source.provider, 'communicationLink.source.provider'),
    providerMessageId: text(source.providerMessageId, 'communicationLink.source.providerMessageId'),
    observedAt: timestamp(source.observedAt, 'communicationLink.source.observedAt')
  };
}
function targetBase(value: JsonRecord, workspaceId: string, owner: 'LITE' | 'MARKREG'): void {
  literal(value.owner, owner, 'communicationLink.target.owner');
  if (text(value.workspaceId, 'communicationLink.target.workspaceId') !== workspaceId) {
    throw new CommunicationLinkContractValidationError(
      'communicationLink target Workspace does not match.'
    );
  }
}

export function parseCommunicationLinkTargetReferenceV1(
  value: unknown,
  workspaceId: string
): CommunicationLinkTargetReferenceV1 {
  const target = record(value, 'communicationLink.target');
  const targetKind = oneOf(
    target.targetKind,
    communicationLinkTargetKinds,
    'communicationLink.target.targetKind'
  );
  switch (targetKind) {
    case 'CUSTOMER_RELATIONSHIP': {
      exactKeys(
        target,
        ['targetKind', 'owner', 'workspaceId', 'customerRelationshipId', 'version'],
        'communicationLink.target'
      );
      targetBase(target, workspaceId, 'MARKREG');
      return {
        targetKind,
        owner: 'MARKREG',
        workspaceId,
        customerRelationshipId: brandedId<CustomerRelationshipId>(
          target.customerRelationshipId,
          customerRelationshipIdPattern,
          'communicationLink.target.customerRelationshipId'
        ),
        version: positiveInteger(target.version, 'communicationLink.target.version')
      };
    }
    case 'WORKSPACE_DIRECTORY_ENTRY': {
      exactKeys(
        target,
        ['targetKind', 'owner', 'workspaceId', 'workspaceDirectoryEntryId', 'version'],
        'communicationLink.target'
      );
      targetBase(target, workspaceId, 'LITE');
      return {
        targetKind,
        owner: 'LITE',
        workspaceId,
        workspaceDirectoryEntryId: brandedId<WorkspaceDirectoryEntryId>(
          target.workspaceDirectoryEntryId,
          directoryEntryIdPattern,
          'communicationLink.target.workspaceDirectoryEntryId'
        ),
        version: positiveInteger(target.version, 'communicationLink.target.version')
      };
    }
    case 'TRADEMARK_ASSET': {
      exactKeys(
        target,
        ['targetKind', 'owner', 'workspaceId', 'trademarkAssetId', 'version'],
        'communicationLink.target'
      );
      targetBase(target, workspaceId, 'LITE');
      return {
        targetKind,
        owner: 'LITE',
        workspaceId,
        trademarkAssetId: brandedId<TrademarkAssetId>(
          target.trademarkAssetId,
          trademarkAssetIdPattern,
          'communicationLink.target.trademarkAssetId'
        ),
        version: positiveInteger(target.version, 'communicationLink.target.version')
      };
    }
    case 'FORMAL_MATTER': {
      exactKeys(
        target,
        ['targetKind', 'owner', 'workspaceId', 'formalMatterId', 'version'],
        'communicationLink.target'
      );
      targetBase(target, workspaceId, 'MARKREG');
      return {
        targetKind,
        owner: 'MARKREG',
        workspaceId,
        formalMatterId: brandedId<FormalMatterId>(
          target.formalMatterId,
          formalMatterIdPattern,
          'communicationLink.target.formalMatterId'
        ),
        version: positiveInteger(target.version, 'communicationLink.target.version')
      };
    }
    case 'PRODUCTION_INTAKE': {
      exactKeys(
        target,
        ['targetKind', 'owner', 'workspaceId', 'intakeId', 'version', 'fingerprintSha256'],
        'communicationLink.target'
      );
      targetBase(target, workspaceId, 'MARKREG');
      return {
        targetKind,
        owner: 'MARKREG',
        workspaceId,
        intakeId: brandedId<`production-intake_${string}`>(
          target.intakeId,
          productionIntakeIdPattern,
          'communicationLink.target.intakeId'
        ),
        version: positiveInteger(target.version, 'communicationLink.target.version'),
        fingerprintSha256: sha256Hex(
          target.fingerprintSha256,
          'communicationLink.target.fingerprintSha256'
        )
      };
    }
  }
}
function parseEvidenceReferences(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 20) {
    throw new CommunicationLinkContractValidationError(
      'communicationLink.decision.evidenceReferences must contain at most 20 items.'
    );
  }
  const result = value.map((item, index) =>
    text(item, `communicationLink.decision.evidenceReferences[${index}]`, 500)
  );
  if (new Set(result).size !== result.length) {
    throw new CommunicationLinkContractValidationError(
      'communicationLink.decision.evidenceReferences must be unique.'
    );
  }
  return result;
}

function parseDecision(
  value: unknown,
  source: Readonly<CommunicationLinkSourceReferenceV1>,
  target: Readonly<CommunicationLinkTargetReferenceV1>
): CommunicationLinkHumanDecisionV1 {
  const decision = record(value, 'communicationLink.decision');
  exactKeys(
    decision,
    [
      'status',
      'basis',
      'authority',
      'decidedByPrincipalId',
      'decidedAt',
      'reason',
      'evidenceReferences',
      'decisionFingerprintSha256'
    ],
    'communicationLink.decision'
  );
  const status = oneOf(
    decision.status,
    communicationLinkDecisionStatuses,
    'communicationLink.decision.status'
  );
  const basis = oneOf(
    decision.basis,
    communicationLinkDecisionBases,
    'communicationLink.decision.basis'
  );
  const reason = nullableText(decision.reason, 'communicationLink.decision.reason');
  const evidenceReferences = parseEvidenceReferences(decision.evidenceReferences);
  const decisionFingerprintSha256 = sha256Hex(
    decision.decisionFingerprintSha256,
    'communicationLink.decision.decisionFingerprintSha256'
  );
  const expectedFingerprint = communicationLinkDecisionFingerprintSha256V1({
    source,
    target,
    status,
    basis,
    reason,
    evidenceReferences
  });
  if (decisionFingerprintSha256 !== expectedFingerprint) {
    throw new CommunicationLinkContractValidationError(
      'communicationLink.decision.decisionFingerprintSha256 does not match reviewed decision material.'
    );
  }
  return {
    status,
    basis,
    authority: literal(decision.authority, 'HUMAN', 'communicationLink.decision.authority'),
    decidedByPrincipalId: text(
      decision.decidedByPrincipalId,
      'communicationLink.decision.decidedByPrincipalId'
    ),
    decidedAt: timestamp(decision.decidedAt, 'communicationLink.decision.decidedAt'),
    reason,
    evidenceReferences,
    decisionFingerprintSha256
  };
}
function parseAuthority(value: unknown): CommunicationLinkAuthorityConsequencesV1 {
  const authority = record(value, 'communicationLink.authorityConsequences');
  const expected = noCommunicationLinkAuthorityConsequencesV1;
  exactKeys(authority, Object.keys(expected), 'communicationLink.authorityConsequences');
  for (const key of Object.keys(expected) as Array<
    keyof CommunicationLinkAuthorityConsequencesV1
  >) {
    if (authority[key] !== false) {
      throw new CommunicationLinkContractValidationError(
        `communicationLink.authorityConsequences.${key} must be false.`
      );
    }
  }
  return expected;
}

export function parseCommunicationLinkV1(
  value: unknown,
  expectedWorkspaceId?: string
): CommunicationLinkV1 {
  const link = record(value, 'communicationLink');
  exactKeys(
    link,
    [
      'schemaVersion',
      'communicationLinkId',
      'workspaceId',
      'version',
      'source',
      'target',
      'decision',
      'lifecycle',
      'archivedAt',
      'authorityConsequences',
      'createdAt',
      'updatedAt'
    ],
    'communicationLink'
  );
  if (link.schemaVersion !== 1) {
    throw new CommunicationLinkContractValidationError(
      'communicationLink.schemaVersion must be 1.'
    );
  }
  const workspaceId = text(link.workspaceId, 'communicationLink.workspaceId');
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId) {
    throw new CommunicationLinkContractValidationError(
      'communicationLink Workspace does not match.'
    );
  }
  const version = positiveInteger(link.version, 'communicationLink.version');
  const source = parseSource(link.source);
  const target = parseCommunicationLinkTargetReferenceV1(link.target, workspaceId);
  const decision = parseDecision(link.decision, source, target);
  const lifecycle = oneOf(
    link.lifecycle,
    communicationLinkLifecycleStates,
    'communicationLink.lifecycle'
  );
  const archivedAt =
    link.archivedAt === null ? null : timestamp(link.archivedAt, 'communicationLink.archivedAt');
  if (lifecycle === 'ACTIVE' && archivedAt !== null) {
    throw new CommunicationLinkContractValidationError(
      'ACTIVE communicationLink cannot have archivedAt.'
    );
  }
  if (lifecycle === 'ARCHIVED' && archivedAt === null) {
    throw new CommunicationLinkContractValidationError(
      'ARCHIVED communicationLink requires archivedAt.'
    );
  }
  const createdAt = timestamp(link.createdAt, 'communicationLink.createdAt');
  const updatedAt = timestamp(link.updatedAt, 'communicationLink.updatedAt');
  if (
    Date.parse(source.observedAt) > Date.parse(decision.decidedAt) ||
    Date.parse(createdAt) > Date.parse(updatedAt) ||
    Date.parse(decision.decidedAt) > Date.parse(updatedAt) ||
    (archivedAt !== null &&
      (Date.parse(archivedAt) < Date.parse(decision.decidedAt) ||
        Date.parse(archivedAt) > Date.parse(updatedAt)))
  ) {
    throw new CommunicationLinkContractValidationError(
      'communicationLink timestamps are out of order.'
    );
  }
  return {
    schemaVersion: 1,
    communicationLinkId: brandedId<CommunicationLinkId>(
      link.communicationLinkId,
      linkIdPattern,
      'communicationLink.communicationLinkId'
    ),
    workspaceId,
    version,
    source,
    target,
    decision,
    lifecycle,
    archivedAt,
    authorityConsequences: parseAuthority(link.authorityConsequences),
    createdAt,
    updatedAt
  };
}

export function isCommunicationLinkThreadInheritanceEligibleV1(
  link: Readonly<CommunicationLinkV1>
): boolean {
  return (
    link.lifecycle === 'ACTIVE' &&
    link.decision.status === 'CONFIRMED' &&
    link.decision.authority === 'HUMAN' &&
    link.source.scope === 'THREAD'
  );
}

export function parseCommunicationLinkThreadLookupResultV1(
  value: unknown,
  expectedWorkspaceId?: string
): CommunicationLinkThreadLookupResultV1 {
  const result = record(value, 'communicationLinkThreadLookupResult');
  exactKeys(
    result,
    [
      'schemaVersion',
      'workspaceId',
      'accountRef',
      'threadRef',
      'readState',
      'links',
      'evaluatedAt'
    ],
    'communicationLinkThreadLookupResult'
  );
  if (result.schemaVersion !== 1) {
    throw new CommunicationLinkContractValidationError(
      'communicationLinkThreadLookupResult.schemaVersion must be 1.'
    );
  }
  const workspaceId = text(result.workspaceId, 'communicationLinkThreadLookupResult.workspaceId');
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId) {
    throw new CommunicationLinkContractValidationError(
      'communicationLinkThreadLookupResult Workspace does not match.'
    );
  }
  const accountRef = text(result.accountRef, 'communicationLinkThreadLookupResult.accountRef');
  const threadRef = text(result.threadRef, 'communicationLinkThreadLookupResult.threadRef');
  const readState = oneOf(
    result.readState,
    communicationLinkThreadLookupStates,
    'communicationLinkThreadLookupResult.readState'
  );
  if (!Array.isArray(result.links) || result.links.length > 100) {
    throw new CommunicationLinkContractValidationError(
      'communicationLinkThreadLookupResult.links must contain at most 100 items.'
    );
  }
  const links = result.links.map((item) => parseCommunicationLinkV1(item, workspaceId));
  if (readState === 'RESULTS' && links.length === 0) {
    throw new CommunicationLinkContractValidationError(
      'RESULTS requires at least one Communication Link.'
    );
  }
  if (readState !== 'RESULTS' && links.length !== 0) {
    throw new CommunicationLinkContractValidationError(
      `${readState} cannot carry Communication Links.`
    );
  }
  const identities = new Set<string>();
  for (const link of links) {
    if (link.lifecycle !== 'ACTIVE' || link.source.scope !== 'THREAD') {
      throw new CommunicationLinkContractValidationError(
        'Thread lookup may expose only ACTIVE THREAD decisions.'
      );
    }
    if (link.source.accountRef !== accountRef || link.source.threadRef !== threadRef) {
      throw new CommunicationLinkContractValidationError(
        'Thread lookup source does not match the requested thread.'
      );
    }
    const identity = `${link.communicationLinkId}:${link.version}`;
    if (identities.has(identity)) {
      throw new CommunicationLinkContractValidationError(
        'Thread lookup contains a duplicate exact Link version.'
      );
    }
    identities.add(identity);
  }
  const evaluatedAt = timestamp(
    result.evaluatedAt,
    'communicationLinkThreadLookupResult.evaluatedAt'
  );
  if (links.some((link) => Date.parse(link.updatedAt) > Date.parse(evaluatedAt))) {
    throw new CommunicationLinkContractValidationError(
      'Thread lookup cannot contain future Link evidence.'
    );
  }
  return {
    schemaVersion: 1,
    workspaceId,
    accountRef,
    threadRef,
    readState,
    links,
    evaluatedAt
  };
}
