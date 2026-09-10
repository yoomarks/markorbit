import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_SOURCE_OWNER,
  dataEngineJurisdictions
} from './data-engine.js';
import {
  applicantDiscoveryReadStates,
  normalizeApplicantPortfolioRequestV1,
  type ApplicantDiscoveryReadState,
  type DataEngineApplicantCandidateReferenceV1,
  type DataEngineDiscoverySourceReferenceV1
} from './data-engine-applicant-discovery.js';

/** Workspace-local intent to observe an external candidate; never an Asset relationship. */
export type WorkspaceWatchTargetId = `workspace-watch-target_${string}`;

export const workspaceWatchTargetKinds = ['APPLICANT', 'TRADEMARK'] as const;
export type WorkspaceWatchTargetKind = (typeof workspaceWatchTargetKinds)[number];

export const workspaceWatchPurposes = [
  'ENFORCEMENT',
  'BUSINESS_DEVELOPMENT',
  'COMPETITIVE',
  'ACQUISITION',
  'CLIENT_MONITORING',
  'OTHER'
] as const;
export type WorkspaceWatchPurpose = (typeof workspaceWatchPurposes)[number];

export const workspaceWatchTargetStatuses = ['ACTIVE', 'ARCHIVED'] as const;
export type WorkspaceWatchTargetStatus = (typeof workspaceWatchTargetStatuses)[number];

export interface WorkspaceWatchApplicantTargetReferenceV1 {
  targetKind: 'APPLICANT';
  applicant: Readonly<DataEngineApplicantCandidateReferenceV1>;
}

/**
 * Workspace-owned pointer only. It deliberately retains no mark text, classes, application status,
 * ownership claim or other Data Engine candidate fields.
 */
export interface WorkspaceWatchTrademarkTargetReferenceV1 {
  targetKind: 'TRADEMARK';
  trademarkCandidateId: string;
  applicant: Readonly<DataEngineApplicantCandidateReferenceV1>;
  sourceReference: Readonly<DataEngineDiscoverySourceReferenceV1>;
}

export type WorkspaceWatchExternalTargetReferenceV1 =
  WorkspaceWatchApplicantTargetReferenceV1 | WorkspaceWatchTrademarkTargetReferenceV1;

export const noWorkspaceWatchAuthorityConsequencesV1 = Object.freeze({
  verifiedApplicantIdentityEstablished: false,
  customerRelationshipEstablished: false,
  trademarkAssetCreated: false,
  managedRelationshipEstablished: false,
  representedRelationshipEstablished: false,
  ownedRelationshipEstablished: false,
  automaticTrademarkAdmissionAuthorized: false,
  officialTruthCreated: false,
  legalConclusionCreated: false,
  protectedActionAuthorized: false,
  externalActionAuthorized: false
});
export type WorkspaceWatchAuthorityConsequencesV1 = typeof noWorkspaceWatchAuthorityConsequencesV1;

export interface WorkspaceWatchTargetV1 {
  schemaVersion: 1;
  workspaceWatchTargetId: WorkspaceWatchTargetId;
  workspaceId: string;
  version: number;
  status: WorkspaceWatchTargetStatus;
  purpose: WorkspaceWatchPurpose;
  reason?: string;
  target: Readonly<WorkspaceWatchExternalTargetReferenceV1>;
  userConfirmed: true;
  createdByPrincipalId: string;
  authorityConsequences: Readonly<WorkspaceWatchAuthorityConsequencesV1>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface WorkspaceWatchTargetVersionReferenceV1 {
  workspaceWatchTargetId: WorkspaceWatchTargetId;
  version: number;
}

/**
 * Read-only projection of a future Data Engine refresh/discovery. It is not persisted Watch truth
 * and every returned trademark remains an unadmitted discovery candidate pointer.
 */
export interface WorkspaceWatchDiscoveryResultV1 {
  schemaVersion: 1;
  workspaceId: string;
  watchTarget: Readonly<WorkspaceWatchTargetVersionReferenceV1>;
  readState: ApplicantDiscoveryReadState;
  candidateReferences: ReadonlyArray<Readonly<WorkspaceWatchTrademarkTargetReferenceV1>>;
  evaluatedAt: string;
  automaticAdmissionAuthorized: false;
  trademarkAssetCreated: false;
  officialTruthCreated: false;
  legalConclusionCreated: false;
}

export class WorkspaceWatchContractValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceWatchContractValidationError';
  }
}

type JsonRecord = Record<string, unknown>;
const watchTargetIdPattern = /^workspace-watch-target_[A-Za-z0-9_-]+$/u;
const sha256Pattern = /^sha256:[0-9a-f]{64}$/u;

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WorkspaceWatchContractValidationError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (unsupported.length > 0 || missing.length > 0) {
    throw new WorkspaceWatchContractValidationError(
      `${field} must contain exactly the V1 fields; unsupported=${unsupported.join(',') || 'none'}; missing=${missing.join(',') || 'none'}.`
    );
  }
}

function exactOptionalKeys(
  value: JsonRecord,
  allowed: readonly string[],
  required: readonly string[],
  field: string
): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (unsupported.length > 0 || missing.length > 0) {
    throw new WorkspaceWatchContractValidationError(`${field} is outside the bounded V1 shape.`);
  }
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new WorkspaceWatchContractValidationError(`${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new WorkspaceWatchContractValidationError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  return normalized;
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 80);
  if (!Number.isFinite(Date.parse(result)))
    throw new WorkspaceWatchContractValidationError(`${field} must be an ISO timestamp.`);
  return result;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new WorkspaceWatchContractValidationError(`${field} must be a positive safe integer.`);
  return value as number;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const matched =
    typeof value === 'string' ? allowed.find((candidate) => candidate === value) : undefined;
  if (matched === undefined)
    throw new WorkspaceWatchContractValidationError(`${field} is invalid.`);
  return matched;
}

function noLaterThan(earlier: string, later: string, field: string): void {
  if (Date.parse(earlier) > Date.parse(later))
    throw new WorkspaceWatchContractValidationError(`${field} cannot be later than ${later}.`);
}

function parseApplicantReference(
  value: unknown,
  workspaceId: string
): DataEngineApplicantCandidateReferenceV1 {
  try {
    return normalizeApplicantPortfolioRequestV1({
      requestContext: {
        requester_workspace_id: workspaceId,
        request_id: 'workspace-watch-contract-validation'
      },
      applicant: value as DataEngineApplicantCandidateReferenceV1
    }).applicant;
  } catch {
    throw new WorkspaceWatchContractValidationError(
      'target applicant must be an exact Data Engine Applicant candidate reference.'
    );
  }
}

function parseTrademarkSourceReference(value: unknown): DataEngineDiscoverySourceReferenceV1 {
  const field = 'target.sourceReference';
  const item = record(value, field);
  exactKeys(
    item,
    [
      'owner',
      'authority',
      'jurisdiction',
      'source_kind',
      'source_id',
      'source_version',
      'source_fingerprint_sha256',
      'observed_at'
    ],
    field
  );
  if (item.owner !== DATA_ENGINE_SOURCE_OWNER || item.authority !== DATA_ENGINE_FACT_AUTHORITY)
    throw new WorkspaceWatchContractValidationError(`${field} owner/authority is invalid.`);
  const jurisdiction = oneOf(item.jurisdiction, dataEngineJurisdictions, `${field}.jurisdiction`);
  if (item.source_kind !== 'TRADEMARK_RECORD')
    throw new WorkspaceWatchContractValidationError(
      `${field}.source_kind must be TRADEMARK_RECORD.`
    );
  const fingerprint = text(
    item.source_fingerprint_sha256,
    `${field}.source_fingerprint_sha256`,
    80
  );
  if (!sha256Pattern.test(fingerprint))
    throw new WorkspaceWatchContractValidationError(
      `${field}.source_fingerprint_sha256 is invalid.`
    );
  return {
    owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction,
    source_kind: 'TRADEMARK_RECORD',
    source_id: text(item.source_id, `${field}.source_id`, 1000),
    source_version: text(item.source_version, `${field}.source_version`, 512),
    source_fingerprint_sha256: fingerprint,
    observed_at: timestamp(item.observed_at, `${field}.observed_at`)
  };
}

function parseTargetReference(
  value: unknown,
  workspaceId: string
): WorkspaceWatchExternalTargetReferenceV1 {
  const item = record(value, 'target');
  if (item.targetKind === 'APPLICANT') {
    exactKeys(item, ['targetKind', 'applicant'], 'target');
    return {
      targetKind: 'APPLICANT',
      applicant: parseApplicantReference(item.applicant, workspaceId)
    };
  }
  if (item.targetKind === 'TRADEMARK') {
    exactKeys(
      item,
      ['targetKind', 'trademarkCandidateId', 'applicant', 'sourceReference'],
      'target'
    );
    const applicant = parseApplicantReference(item.applicant, workspaceId);
    const sourceReference = parseTrademarkSourceReference(item.sourceReference);
    if (sourceReference.jurisdiction !== applicant.source_reference.jurisdiction)
      throw new WorkspaceWatchContractValidationError(
        'Trademark target and Applicant reference jurisdiction must match.'
      );
    return {
      targetKind: 'TRADEMARK',
      trademarkCandidateId: text(item.trademarkCandidateId, 'target.trademarkCandidateId', 512),
      applicant,
      sourceReference
    };
  }
  throw new WorkspaceWatchContractValidationError('target.targetKind is invalid.');
}

function parseAuthority(value: unknown): WorkspaceWatchAuthorityConsequencesV1 {
  const item = record(value, 'authorityConsequences');
  const keys = Object.keys(noWorkspaceWatchAuthorityConsequencesV1);
  exactKeys(item, keys, 'authorityConsequences');
  for (const key of keys as Array<keyof WorkspaceWatchAuthorityConsequencesV1>) {
    if (item[key] !== false)
      throw new WorkspaceWatchContractValidationError(
        `authorityConsequences.${key} must be false.`
      );
  }
  return noWorkspaceWatchAuthorityConsequencesV1;
}

function parseWatchId(value: unknown, field = 'workspaceWatchTargetId'): WorkspaceWatchTargetId {
  const id = text(value, field, 240);
  if (!watchTargetIdPattern.test(id))
    throw new WorkspaceWatchContractValidationError(`${field} is invalid.`);
  return id as WorkspaceWatchTargetId;
}

function sourceTimes(target: Readonly<WorkspaceWatchExternalTargetReferenceV1>): readonly string[] {
  return target.targetKind === 'APPLICANT'
    ? [target.applicant.source_reference.observed_at]
    : [target.applicant.source_reference.observed_at, target.sourceReference.observed_at];
}

export function isWorkspaceWatchTargetStatusTransitionAllowedV1(
  from: WorkspaceWatchTargetStatus,
  to: WorkspaceWatchTargetStatus
): boolean {
  return from === 'ACTIVE' && to === 'ARCHIVED';
}

export function parseWorkspaceWatchTargetV1(
  value: unknown,
  expectedWorkspaceId?: string
): WorkspaceWatchTargetV1 {
  const item = record(value, 'workspaceWatchTarget');
  exactOptionalKeys(
    item,
    [
      'schemaVersion',
      'workspaceWatchTargetId',
      'workspaceId',
      'version',
      'status',
      'purpose',
      'reason',
      'target',
      'userConfirmed',
      'createdByPrincipalId',
      'authorityConsequences',
      'createdAt',
      'updatedAt',
      'archivedAt'
    ],
    [
      'schemaVersion',
      'workspaceWatchTargetId',
      'workspaceId',
      'version',
      'status',
      'purpose',
      'target',
      'userConfirmed',
      'createdByPrincipalId',
      'authorityConsequences',
      'createdAt',
      'updatedAt',
      'archivedAt'
    ],
    'workspaceWatchTarget'
  );
  if (item.schemaVersion !== 1)
    throw new WorkspaceWatchContractValidationError('schemaVersion must be 1.');
  const workspaceId = text(item.workspaceId, 'workspaceId', 240);
  if (
    expectedWorkspaceId !== undefined &&
    workspaceId !== text(expectedWorkspaceId, 'expectedWorkspaceId', 240)
  ) {
    throw new WorkspaceWatchContractValidationError('Watch Target Workspace does not match.');
  }
  if (item.userConfirmed !== true)
    throw new WorkspaceWatchContractValidationError('userConfirmed must be true.');

  const status = oneOf(item.status, workspaceWatchTargetStatuses, 'status');
  const createdAt = timestamp(item.createdAt, 'createdAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  noLaterThan(createdAt, updatedAt, 'createdAt');
  const archivedAt = item.archivedAt === null ? null : timestamp(item.archivedAt, 'archivedAt');
  if (status === 'ACTIVE' && archivedAt !== null)
    throw new WorkspaceWatchContractValidationError(
      'ACTIVE Watch Target requires archivedAt = null.'
    );
  if (status === 'ARCHIVED' && archivedAt === null)
    throw new WorkspaceWatchContractValidationError('ARCHIVED Watch Target requires archivedAt.');
  if (archivedAt !== null) {
    noLaterThan(createdAt, archivedAt, 'createdAt');
    noLaterThan(archivedAt, updatedAt, 'archivedAt');
  }
  const target = parseTargetReference(item.target, workspaceId);
  for (const observedAt of sourceTimes(target))
    noLaterThan(observedAt, createdAt, 'source observed_at');
  const reason = item.reason === undefined ? undefined : text(item.reason, 'reason', 1000);

  return {
    schemaVersion: 1,
    workspaceWatchTargetId: parseWatchId(item.workspaceWatchTargetId),
    workspaceId,
    version: positiveInteger(item.version, 'version'),
    status,
    purpose: oneOf(item.purpose, workspaceWatchPurposes, 'purpose'),
    ...(reason ? { reason } : {}),
    target,
    userConfirmed: true,
    createdByPrincipalId: text(item.createdByPrincipalId, 'createdByPrincipalId', 240),
    authorityConsequences: parseAuthority(item.authorityConsequences),
    createdAt,
    updatedAt,
    archivedAt
  };
}

function parseWatchVersionReference(value: unknown): WorkspaceWatchTargetVersionReferenceV1 {
  const item = record(value, 'watchTarget');
  exactKeys(item, ['workspaceWatchTargetId', 'version'], 'watchTarget');
  return {
    workspaceWatchTargetId: parseWatchId(
      item.workspaceWatchTargetId,
      'watchTarget.workspaceWatchTargetId'
    ),
    version: positiveInteger(item.version, 'watchTarget.version')
  };
}

function parseTrademarkCandidateReference(
  value: unknown,
  workspaceId: string,
  index: number
): WorkspaceWatchTrademarkTargetReferenceV1 {
  const parsed = parseTargetReference(value, workspaceId);
  if (parsed.targetKind !== 'TRADEMARK')
    throw new WorkspaceWatchContractValidationError(
      `candidateReferences[${index}] must be a TRADEMARK candidate pointer.`
    );
  return parsed;
}

function candidateIdentity(value: Readonly<WorkspaceWatchTrademarkTargetReferenceV1>): string {
  return [
    value.trademarkCandidateId,
    value.applicant.applicant_candidate_id,
    value.sourceReference.source_id,
    value.sourceReference.source_version,
    value.sourceReference.source_fingerprint_sha256
  ].join('|');
}

export function parseWorkspaceWatchDiscoveryResultV1(
  value: unknown,
  expectedWorkspaceId?: string
): WorkspaceWatchDiscoveryResultV1 {
  const item = record(value, 'workspaceWatchDiscoveryResult');
  exactKeys(
    item,
    [
      'schemaVersion',
      'workspaceId',
      'watchTarget',
      'readState',
      'candidateReferences',
      'evaluatedAt',
      'automaticAdmissionAuthorized',
      'trademarkAssetCreated',
      'officialTruthCreated',
      'legalConclusionCreated'
    ],
    'workspaceWatchDiscoveryResult'
  );
  if (item.schemaVersion !== 1)
    throw new WorkspaceWatchContractValidationError('schemaVersion must be 1.');
  const workspaceId = text(item.workspaceId, 'workspaceId', 240);
  if (
    expectedWorkspaceId !== undefined &&
    workspaceId !== text(expectedWorkspaceId, 'expectedWorkspaceId', 240)
  ) {
    throw new WorkspaceWatchContractValidationError('Discovery Result Workspace does not match.');
  }
  if (
    item.automaticAdmissionAuthorized !== false ||
    item.trademarkAssetCreated !== false ||
    item.officialTruthCreated !== false ||
    item.legalConclusionCreated !== false
  ) {
    throw new WorkspaceWatchContractValidationError(
      'Discovery Result authority fields must remain false.'
    );
  }
  const readState = oneOf(item.readState, applicantDiscoveryReadStates, 'readState');
  if (!Array.isArray(item.candidateReferences) || item.candidateReferences.length > 500)
    throw new WorkspaceWatchContractValidationError(
      'candidateReferences must be an array with at most 500 items.'
    );
  const candidateReferences = item.candidateReferences.map((candidate, index) =>
    parseTrademarkCandidateReference(candidate, workspaceId, index)
  );
  if (readState === 'RESULTS' && candidateReferences.length === 0)
    throw new WorkspaceWatchContractValidationError('RESULTS requires candidate references.');
  if (readState !== 'RESULTS' && candidateReferences.length !== 0)
    throw new WorkspaceWatchContractValidationError(
      `${readState} must not carry discovered candidate references.`
    );
  const identities = candidateReferences.map(candidateIdentity);
  if (new Set(identities).size !== identities.length)
    throw new WorkspaceWatchContractValidationError(
      'candidateReferences must not contain duplicates.'
    );
  const evaluatedAt = timestamp(item.evaluatedAt, 'evaluatedAt');
  for (const candidate of candidateReferences) {
    for (const observedAt of sourceTimes(candidate))
      noLaterThan(observedAt, evaluatedAt, 'candidate source observed_at');
  }

  return {
    schemaVersion: 1,
    workspaceId,
    watchTarget: parseWatchVersionReference(item.watchTarget),
    readState,
    candidateReferences,
    evaluatedAt,
    automaticAdmissionAuthorized: false,
    trademarkAssetCreated: false,
    officialTruthCreated: false,
    legalConclusionCreated: false
  };
}
