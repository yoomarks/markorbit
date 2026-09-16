import { createHash } from 'node:crypto';
import type {
  BusinessAttributionLinkIdV1,
  BusinessAttributionReferenceV1
} from './business-attribution.js';
import type { OutboundContactReadinessV1 } from './outbound-contact-policy.js';

export type EducationCommunityCohortIdV1 = `education-cohort_${string}`;
export type EducationCommunityJourneyIdV1 = `education-journey_${string}`;

export const educationCommunityJourneyStages = [
  'REGISTERED',
  'INVITATION_PREPARED',
  'WORKSPACE_ACTIVATED',
  'FIRST_VALUE_RECORDED',
  'RETAINED'
] as const;
export type EducationCommunityJourneyStageV1 = (typeof educationCommunityJourneyStages)[number];

export const noEducationCommunityAuthorityConsequencesV1 = Object.freeze({
  marketingConsentInferred: false,
  externalInvitationSent: false,
  accountOrWorkspaceCreated: false,
  partnerQualified: false,
  distributorActivated: false,
  mgsnProviderEnrolled: false,
  paymentOrCommercialAuthorityCreated: false
});

export interface EducationCommunityCohortV1 {
  schemaVersion: 1;
  educationCommunityCohortId: EducationCommunityCohortIdV1;
  workspaceId: string;
  version: 1;
  name: string;
  source: Readonly<BusinessAttributionReferenceV1>;
  retentionWindowDays: 7;
  status: 'ACTIVE';
  createdByPrincipalId: string;
  createdAt: string;
  cohortFingerprintSha256: string;
  authorityConsequences: typeof noEducationCommunityAuthorityConsequencesV1;
}

export interface EducationCommunityProductActionReferenceV1 {
  owner: 'LITE';
  kind: 'LITE_WORK_ITEM';
  id: string;
  version: number;
  fingerprintSha256: string;
  observedAt: string;
}

export interface EducationCommunityWorkspaceActivationReferenceV1 {
  owner: 'CORE';
  kind: 'WORKSPACE_ACTIVATION';
  id: string;
  version: number;
  fingerprintSha256: string;
  observedAt: string;
}

export interface EducationCommunityJourneyV1 {
  schemaVersion: 1;
  educationCommunityJourneyId: EducationCommunityJourneyIdV1;
  cohort: Readonly<{
    id: EducationCommunityCohortIdV1;
    version: 1;
    fingerprintSha256: string;
  }>;
  campaignWorkspaceId: string;
  version: number;
  stage: EducationCommunityJourneyStageV1;
  participantRef: string;
  endpointFingerprintSha256: string;
  registeredAt: string;
  invitation?: Readonly<{
    claimFingerprintSha256: string;
    readiness: Readonly<OutboundContactReadinessV1>;
    preparedAt: string;
  }>;
  activatedWorkspace?: Readonly<EducationCommunityWorkspaceActivationReferenceV1>;
  firstValue?: Readonly<EducationCommunityProductActionReferenceV1>;
  retainedUse?: Readonly<EducationCommunityProductActionReferenceV1>;
  acquisitionAttribution?: Readonly<{
    id: BusinessAttributionLinkIdV1;
    version: 1;
    fingerprintSha256: string;
  }>;
  updatedByPrincipalId: string;
  updatedAt: string;
  journeyFingerprintSha256: string;
  authorityConsequences: typeof noEducationCommunityAuthorityConsequencesV1;
}

export class EducationCommunityValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'EducationCommunityValidationError';
  }
}

type JsonObject = Record<string, unknown>;
const SHA256 = /^[0-9a-f]{64}$/u;
const COHORT_ID = /^education-cohort_[A-Za-z0-9_-]+$/u;
const JOURNEY_ID = /^education-journey_[A-Za-z0-9_-]+$/u;
const ATTRIBUTION_ID = /^business-attribution_[A-Za-z0-9_-]+$/u;

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new EducationCommunityValidationError(`${field} must be an object.`);
  return value as JsonObject;
}
function exact(value: JsonObject, fields: readonly string[], field: string): void {
  if (Object.keys(value).sort().join(',') !== [...fields].sort().join(','))
    throw new EducationCommunityValidationError(`${field} must contain exactly the V1 fields.`);
}
function text(value: unknown, field: string, maximum = 300): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new EducationCommunityValidationError(`${field} is invalid.`);
  return value.trim();
}
function opaque(value: unknown, field: string): string {
  const result = text(value, field, 240);
  if (result.includes('@'))
    throw new EducationCommunityValidationError(`${field} must be opaque, not raw contact data.`);
  return result;
}
function positive(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new EducationCommunityValidationError(`${field} must be a positive integer.`);
  return Number(value);
}
function sha(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!SHA256.test(result))
    throw new EducationCommunityValidationError(`${field} must be lowercase SHA-256.`);
  return result;
}
function at(value: unknown, field: string): string {
  const result = text(value, field, 80);
  if (!Number.isFinite(Date.parse(result)))
    throw new EducationCommunityValidationError(`${field} must be an ISO timestamp.`);
  return new Date(result).toISOString();
}
function authority(value: unknown): typeof noEducationCommunityAuthorityConsequencesV1 {
  const result = object(value, 'authorityConsequences');
  exact(result, Object.keys(noEducationCommunityAuthorityConsequencesV1), 'authorityConsequences');
  if (Object.values(result).some((item) => item !== false))
    throw new EducationCommunityValidationError(
      'Education/community authority locks must remain false.'
    );
  return noEducationCommunityAuthorityConsequencesV1;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    );
  return value;
}
function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
function source(value: unknown): BusinessAttributionReferenceV1 {
  const input = object(value, 'source');
  exact(input, ['owner', 'kind', 'id', 'version', 'fingerprintSha256', 'observedAt'], 'source');
  const version = input.version;
  if (!(
    (Number.isSafeInteger(version) && Number(version) >= 1) ||
    (typeof version === 'string' && version.trim())
  ))
    throw new EducationCommunityValidationError('source.version is invalid.');
  return {
    owner: text(input.owner, 'source.owner', 120),
    kind: text(input.kind, 'source.kind', 160),
    id: opaque(input.id, 'source.id'),
    version: typeof version === 'string' ? version.trim() : Number(version),
    fingerprintSha256: sha(input.fingerprintSha256, 'source.fingerprintSha256'),
    observedAt: at(input.observedAt, 'source.observedAt')
  };
}
function productAction(value: unknown, field: string): EducationCommunityProductActionReferenceV1 {
  const input = object(value, field);
  exact(input, ['owner', 'kind', 'id', 'version', 'fingerprintSha256', 'observedAt'], field);
  if (input.owner !== 'LITE' || input.kind !== 'LITE_WORK_ITEM')
    throw new EducationCommunityValidationError(`${field} must reference a Lite Work Item.`);
  return {
    owner: 'LITE',
    kind: 'LITE_WORK_ITEM',
    id: text(input.id, `${field}.id`),
    version: positive(input.version, `${field}.version`),
    fingerprintSha256: sha(input.fingerprintSha256, `${field}.fingerprintSha256`),
    observedAt: at(input.observedAt, `${field}.observedAt`)
  };
}

export function educationCommunityCohortFingerprintSha256V1(
  value: Omit<EducationCommunityCohortV1, 'cohortFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function educationCommunityJourneyFingerprintSha256V1(
  value: Omit<EducationCommunityJourneyV1, 'journeyFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function educationCommunityWorkspaceActivationFingerprintSha256V1(
  value: Omit<EducationCommunityWorkspaceActivationReferenceV1, 'fingerprintSha256'>
): string {
  return fingerprint(value);
}

export function parseEducationCommunityCohortV1(value: unknown): EducationCommunityCohortV1 {
  const input = object(value, 'educationCommunityCohort');
  exact(
    input,
    [
      'schemaVersion',
      'educationCommunityCohortId',
      'workspaceId',
      'version',
      'name',
      'source',
      'retentionWindowDays',
      'status',
      'createdByPrincipalId',
      'createdAt',
      'cohortFingerprintSha256',
      'authorityConsequences'
    ],
    'educationCommunityCohort'
  );
  const id = text(input.educationCommunityCohortId, 'educationCommunityCohortId');
  if (
    input.schemaVersion !== 1 ||
    input.version !== 1 ||
    input.retentionWindowDays !== 7 ||
    input.status !== 'ACTIVE' ||
    !COHORT_ID.test(id)
  )
    throw new EducationCommunityValidationError(
      'Education/community cohort identity or state is invalid.'
    );
  const parsed = {
    schemaVersion: 1 as const,
    educationCommunityCohortId: id as EducationCommunityCohortIdV1,
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: 1 as const,
    name: text(input.name, 'name', 160),
    source: source(input.source),
    retentionWindowDays: 7 as const,
    status: 'ACTIVE' as const,
    createdByPrincipalId: text(input.createdByPrincipalId, 'createdByPrincipalId', 240),
    createdAt: at(input.createdAt, 'createdAt'),
    authorityConsequences: authority(input.authorityConsequences)
  };
  const expected = educationCommunityCohortFingerprintSha256V1(parsed);
  if (sha(input.cohortFingerprintSha256, 'cohortFingerprintSha256') !== expected)
    throw new EducationCommunityValidationError('Education/community cohort fingerprint mismatch.');
  return { ...parsed, cohortFingerprintSha256: expected };
}

export function parseEducationCommunityJourneyV1(value: unknown): EducationCommunityJourneyV1 {
  const input = object(value, 'educationCommunityJourney');
  const optional = [
    'invitation',
    'activatedWorkspace',
    'firstValue',
    'retainedUse',
    'acquisitionAttribution'
  ].filter((key) => input[key] !== undefined);
  exact(
    input,
    [
      'schemaVersion',
      'educationCommunityJourneyId',
      'cohort',
      'campaignWorkspaceId',
      'version',
      'stage',
      'participantRef',
      'endpointFingerprintSha256',
      'registeredAt',
      ...optional,
      'updatedByPrincipalId',
      'updatedAt',
      'journeyFingerprintSha256',
      'authorityConsequences'
    ],
    'educationCommunityJourney'
  );
  const id = text(input.educationCommunityJourneyId, 'educationCommunityJourneyId');
  const stage = text(input.stage, 'stage') as EducationCommunityJourneyStageV1;
  if (
    input.schemaVersion !== 1 ||
    !JOURNEY_ID.test(id) ||
    !educationCommunityJourneyStages.includes(stage)
  )
    throw new EducationCommunityValidationError(
      'Education/community journey identity or stage is invalid.'
    );
  const cohort = object(input.cohort, 'cohort');
  exact(cohort, ['id', 'version', 'fingerprintSha256'], 'cohort');
  const cohortId = text(cohort.id, 'cohort.id');
  if (!COHORT_ID.test(cohortId) || cohort.version !== 1)
    throw new EducationCommunityValidationError('cohort reference is invalid.');
  const invitation =
    input.invitation === undefined
      ? undefined
      : (() => {
          const invitationInput = object(input.invitation, 'invitation');
          exact(
            invitationInput,
            ['claimFingerprintSha256', 'readiness', 'preparedAt'],
            'invitation'
          );
          const readiness = object(
            invitationInput.readiness,
            'invitation.readiness'
          ) as unknown as OutboundContactReadinessV1;
          if (
            readiness.outcome !== 'READY_FOR_HUMAN_SEND' ||
            readiness.purpose !== 'EDUCATION_INVITATION' ||
            readiness.endpointFingerprintSha256 !== input.endpointFingerprintSha256 ||
            readiness.workspaceId !== input.campaignWorkspaceId ||
            readiness.targetRef.owner !== 'LITE' ||
            readiness.targetRef.kind !== 'EDUCATION_COMMUNITY_PARTICIPANT' ||
            readiness.targetRef.id !== id ||
            readiness.targetRef.version !== 1 ||
            Object.values(readiness.authorityConsequences).some((effect) => effect !== false)
          )
            throw new EducationCommunityValidationError(
              'Invitation must retain exact education invitation readiness.'
            );
          return {
            claimFingerprintSha256: sha(
              invitationInput.claimFingerprintSha256,
              'invitation.claimFingerprintSha256'
            ),
            readiness,
            preparedAt: at(invitationInput.preparedAt, 'invitation.preparedAt')
          };
        })();
  const activatedWorkspace =
    input.activatedWorkspace === undefined
      ? undefined
      : (() => {
          const ref = object(input.activatedWorkspace, 'activatedWorkspace');
          exact(
            ref,
            ['owner', 'kind', 'id', 'version', 'fingerprintSha256', 'observedAt'],
            'activatedWorkspace'
          );
          if (ref.owner !== 'CORE' || ref.kind !== 'WORKSPACE_ACTIVATION')
            throw new EducationCommunityValidationError(
              'activatedWorkspace must reference Core Workspace activation.'
            );
          return {
            owner: 'CORE' as const,
            kind: 'WORKSPACE_ACTIVATION' as const,
            id: text(ref.id, 'activatedWorkspace.id', 80),
            version: positive(ref.version, 'activatedWorkspace.version'),
            fingerprintSha256: sha(ref.fingerprintSha256, 'activatedWorkspace.fingerprintSha256'),
            observedAt: at(ref.observedAt, 'activatedWorkspace.observedAt')
          };
        })();
  const firstValue =
    input.firstValue === undefined ? undefined : productAction(input.firstValue, 'firstValue');
  const retainedUse =
    input.retainedUse === undefined ? undefined : productAction(input.retainedUse, 'retainedUse');
  const acquisitionAttribution =
    input.acquisitionAttribution === undefined
      ? undefined
      : (() => {
          const ref = object(input.acquisitionAttribution, 'acquisitionAttribution');
          exact(ref, ['id', 'version', 'fingerprintSha256'], 'acquisitionAttribution');
          const attributionId = text(ref.id, 'acquisitionAttribution.id');
          if (!ATTRIBUTION_ID.test(attributionId) || ref.version !== 1)
            throw new EducationCommunityValidationError(
              'acquisitionAttribution reference is invalid.'
            );
          return {
            id: attributionId as BusinessAttributionLinkIdV1,
            version: 1 as const,
            fingerprintSha256: sha(
              ref.fingerprintSha256,
              'acquisitionAttribution.fingerprintSha256'
            )
          };
        })();
  const requiredCount = educationCommunityJourneyStages.indexOf(stage);
  if (
    requiredCount >= 1 !== Boolean(invitation) ||
    requiredCount >= 2 !== Boolean(activatedWorkspace) ||
    requiredCount >= 3 !== Boolean(firstValue) ||
    requiredCount >= 4 !== Boolean(retainedUse && acquisitionAttribution)
  )
    throw new EducationCommunityValidationError(
      'Journey stage does not match its exact milestone lineage.'
    );
  if (
    firstValue &&
    retainedUse &&
    (firstValue.id === retainedUse.id ||
      Date.parse(retainedUse.observedAt) - Date.parse(firstValue.observedAt) <
        7 * 24 * 60 * 60 * 1000)
  )
    throw new EducationCommunityValidationError(
      'Retained use requires a distinct action at least seven days after first value.'
    );
  const parsed = {
    schemaVersion: 1 as const,
    educationCommunityJourneyId: id as EducationCommunityJourneyIdV1,
    cohort: {
      id: cohortId as EducationCommunityCohortIdV1,
      version: 1 as const,
      fingerprintSha256: sha(cohort.fingerprintSha256, 'cohort.fingerprintSha256')
    },
    campaignWorkspaceId: text(input.campaignWorkspaceId, 'campaignWorkspaceId', 80),
    version: positive(input.version, 'version'),
    stage,
    participantRef: opaque(input.participantRef, 'participantRef'),
    endpointFingerprintSha256: sha(input.endpointFingerprintSha256, 'endpointFingerprintSha256'),
    registeredAt: at(input.registeredAt, 'registeredAt'),
    ...(invitation ? { invitation } : {}),
    ...(activatedWorkspace ? { activatedWorkspace } : {}),
    ...(firstValue ? { firstValue } : {}),
    ...(retainedUse ? { retainedUse } : {}),
    ...(acquisitionAttribution ? { acquisitionAttribution } : {}),
    updatedByPrincipalId: text(input.updatedByPrincipalId, 'updatedByPrincipalId', 240),
    updatedAt: at(input.updatedAt, 'updatedAt'),
    authorityConsequences: authority(input.authorityConsequences)
  };
  const expected = educationCommunityJourneyFingerprintSha256V1(parsed);
  if (sha(input.journeyFingerprintSha256, 'journeyFingerprintSha256') !== expected)
    throw new EducationCommunityValidationError(
      'Education/community journey fingerprint mismatch.'
    );
  return { ...parsed, journeyFingerprintSha256: expected };
}
