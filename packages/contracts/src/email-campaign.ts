import type {
  OutboundContactBasisAssertionIdV1,
  OutboundContactPolicyReferenceV1,
  OutboundContactPurposeV1,
  OutboundContactReadinessV1,
  OutboundContactSuppressionIdV1,
  OutboundContactSuppressionScopeV1,
  OutboundContactTargetReferenceV1
} from './outbound-contact-policy.js';
import type { PublishPackage, PublishPackageId } from './product-loop.js';
import type { SiteIdV1 } from './site.js';

export type EmailCampaignIdV1 = `email-campaign_${string}`;
export type CampaignAudienceSnapshotIdV1 = `campaign-audience_${string}`;
export type CampaignContentProjectionIdV1 = `campaign-content_${string}`;
export type CampaignBrandProjectionIdV1 = `campaign-brand_${string}`;
export type CampaignReviewDecisionIdV1 = `campaign-review_${string}`;

export const emailCampaignStatusesV1 = [
  'DRAFT',
  'READY_FOR_HUMAN_REVIEW',
  'REVIEWED_READY_FOR_DELIVERY_PREPARATION',
  'CHANGES_REQUIRED',
  'REJECTED',
  'SUPERSEDED'
] as const;
export type EmailCampaignStatusV1 = (typeof emailCampaignStatusesV1)[number];

export const campaignReviewOutcomesV1 = [
  'APPROVED_FOR_DELIVERY_PREPARATION',
  'CHANGES_REQUIRED',
  'REJECTED'
] as const;
export type CampaignReviewOutcomeV1 = (typeof campaignReviewOutcomesV1)[number];

export const campaignBrandSourceKindsV1 = [
  'SITE_CONFIGURATION',
  'CAMPAIGN_LOCAL_PRESENTATION'
] as const;
export type CampaignBrandSourceKindV1 = (typeof campaignBrandSourceKindsV1)[number];

export const noEmailCampaignAuthorityConsequencesV1 = Object.freeze({
  legalConsentVerifiedByMarkOrbit: false,
  providerSelectionAuthorityGranted: false,
  protectedActionAuthorized: false,
  externalSendAuthorized: false,
  externalMessageSent: false,
  managedCommunicationCreated: false,
  customerTruthCreated: false,
  orderCreated: false,
  matterCreated: false,
  trademarkTruthCreated: false,
  publicationCreated: false
});
export type EmailCampaignAuthorityConsequencesV1 =
  typeof noEmailCampaignAuthorityConsequencesV1;

export interface CampaignAudienceEntryV1 {
  targetRef: Readonly<OutboundContactTargetReferenceV1>;
  endpointFingerprintSha256: string;
  purpose: OutboundContactPurposeV1;
  policyRef: Readonly<OutboundContactPolicyReferenceV1>;
  readiness: Readonly<{
    evaluatedAt: string;
    readinessFingerprintSha256: string;
    reviewedSendFingerprintSha256: string;
    outcome: 'READY_FOR_HUMAN_SEND';
    reason: 'CURRENT_ALLOWED_ASSERTION';
    basisAssertionRef: Readonly<{
      assertionId: OutboundContactBasisAssertionIdV1;
      version: number;
    }>;
    suppressionRefs: readonly Readonly<{
      suppressionId: OutboundContactSuppressionIdV1;
      version: number;
      scope: OutboundContactSuppressionScopeV1;
      status: 'ACTIVE' | 'CLEARED';
    }>[];
  }>;
}

export interface CampaignAudienceSnapshotV1 {
  schemaVersion: 1;
  audienceSnapshotId: CampaignAudienceSnapshotIdV1;
  workspaceId: string;
  version: number;
  channel: 'EMAIL';
  reviewedSendFingerprintSha256: string;
  entries: readonly Readonly<CampaignAudienceEntryV1>[];
  audienceFingerprintSha256: string;
  capturedAt: string;
  legalConsentVerifiedByMarkOrbit: false;
  externalSendAuthorized: false;
}

export interface CampaignContentProjectionV1 {
  schemaVersion: 1;
  contentProjectionId: CampaignContentProjectionIdV1;
  workspaceId: string;
  version: number;
  publishPackageRef: Readonly<{
    publishPackageId: PublishPackageId;
    version: number;
    fingerprintSha256: string;
  }>;
  subject: string;
  preheader?: string;
  reviewedSendFingerprintSha256: string;
  bodyOwnedByPublishPackage: true;
  projectionFingerprintSha256: string;
  createdAt: string;
  externalSendAuthorized: false;
}

export interface CampaignBrandPresentationV1 {
  displayName: string;
  logoAssetRef?: string;
  primaryColor?: string;
  accentColor?: string;
  colorMode?: 'LIGHT' | 'DARK' | 'SYSTEM';
}

export type CampaignBrandSourceV1 =
  | Readonly<{
      kind: 'SITE_CONFIGURATION';
      siteId: SiteIdV1;
      configurationVersion: number;
      sourceRef: string;
    }>
  | Readonly<{
      kind: 'CAMPAIGN_LOCAL_PRESENTATION';
      sourceRef: string;
    }>;

export interface CampaignBrandProjectionV1 {
  schemaVersion: 1;
  brandProjectionId: CampaignBrandProjectionIdV1;
  workspaceId: string;
  version: number;
  source: CampaignBrandSourceV1;
  presentation: Readonly<CampaignBrandPresentationV1>;
  brandProjectionFingerprintSha256: string;
  capturedAt: string;
  canonicalWorkspaceBrandCreated: false;
}

export interface EmailCampaignV1 {
  schemaVersion: 1;
  campaignId: EmailCampaignIdV1;
  workspaceId: string;
  version: number;
  featureKey: 'EMAIL_CAMPAIGN';
  purpose: OutboundContactPurposeV1;
  audience: Readonly<{
    audienceSnapshotId: CampaignAudienceSnapshotIdV1;
    version: number;
    fingerprintSha256: string;
  }>;
  content: Readonly<{
    contentProjectionId: CampaignContentProjectionIdV1;
    version: number;
    fingerprintSha256: string;
  }>;
  brand: Readonly<{
    brandProjectionId: CampaignBrandProjectionIdV1;
    version: number;
    fingerprintSha256: string;
  }>;
  status: EmailCampaignStatusV1;
  humanReviewRequired: true;
  createdAt: string;
  updatedAt: string;
  authority: Readonly<EmailCampaignAuthorityConsequencesV1>;
}

export interface CampaignReviewDecisionV1 {
  schemaVersion: 1;
  campaignReviewDecisionId: CampaignReviewDecisionIdV1;
  workspaceId: string;
  version: number;
  campaign: Readonly<{ campaignId: EmailCampaignIdV1; version: number }>;
  expectedCampaignFingerprintSha256: string;
  outcome: CampaignReviewOutcomeV1;
  reviewerPrincipalId: string;
  rationale: string;
  reviewedAt: string;
  deliveryPreparationOnly: true;
  authority: Readonly<EmailCampaignAuthorityConsequencesV1>;
}

export class EmailCampaignContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'EmailCampaignContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const SHA256 = /^[a-f0-9]{64}$/u;
const ID_PATTERNS = {
  campaignId: /^email-campaign_[A-Za-z0-9_-]+$/u,
  audienceSnapshotId: /^campaign-audience_[A-Za-z0-9_-]+$/u,
  contentProjectionId: /^campaign-content_[A-Za-z0-9_-]+$/u,
  brandProjectionId: /^campaign-brand_[A-Za-z0-9_-]+$/u,
  campaignReviewDecisionId: /^campaign-review_[A-Za-z0-9_-]+$/u
} as const;

function object(value: unknown, field: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new EmailCampaignContractError(`${field} must be an object.`);
  return value as JsonRecord;
}
function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !(key in value));
  if (extra.length || missing.length)
    throw new EmailCampaignContractError(`${field} must contain exactly the bounded V1 fields.`);
}
function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new EmailCampaignContractError(`${field} is invalid.`);
  return value.trim();
}
function opaque(value: unknown, field: string, maximum = 500): string {
  const result = text(value, field, maximum);
  if (result.includes('@'))
    throw new EmailCampaignContractError(`${field} must be opaque and cannot contain raw email.`);
  return result;
}
function positive(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new EmailCampaignContractError(`${field} must be a positive integer.`);
  return Number(value);
}
function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 80);
  if (!Number.isFinite(Date.parse(result)))
    throw new EmailCampaignContractError(`${field} must be a timestamp.`);
  return result;
}
function sha256(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!SHA256.test(result))
    throw new EmailCampaignContractError(`${field} must be lowercase SHA-256 hex.`);
  return result;
}
function one<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const result = typeof value === 'string' ? allowed.find((item) => item === value) : undefined;
  if (!result) throw new EmailCampaignContractError(`${field} is invalid.`);
  return result;
}
function id<T extends string>(
  value: unknown,
  field: keyof typeof ID_PATTERNS,
  pattern: RegExp
): T {
  const result = text(value, field, 240);
  if (!pattern.test(result)) throw new EmailCampaignContractError(`${field} is invalid.`);
  return result as T;
}
function assertFalseAuthority(value: unknown): void {
  const authority = object(value, 'authority');
  exactKeys(authority, Object.keys(noEmailCampaignAuthorityConsequencesV1), 'authority');
  if (Object.values(authority).some((entry) => entry !== false))
    throw new EmailCampaignContractError('Campaign authority locks must remain false.');
}
function targetRef(value: unknown): OutboundContactTargetReferenceV1 {
  const item = object(value, 'targetRef');
  exactKeys(item, ['owner', 'kind', 'id', 'version'], 'targetRef');
  return {
    owner: text(item.owner, 'targetRef.owner', 120),
    kind: text(item.kind, 'targetRef.kind', 120),
    id: opaque(item.id, 'targetRef.id'),
    version: positive(item.version, 'targetRef.version')
  };
}
function policyRef(value: unknown): OutboundContactPolicyReferenceV1 {
  const item = object(value, 'policyRef');
  exactKeys(item, ['policyId', 'version'], 'policyRef');
  return {
    policyId: opaque(item.policyId, 'policyRef.policyId', 240),
    version: positive(item.version, 'policyRef.version')
  };
}

export function parseCampaignAudienceSnapshotV1(value: unknown): CampaignAudienceSnapshotV1 {
  const input = object(value, 'audienceSnapshot');
  exactKeys(
    input,
    [
      'schemaVersion',
      'audienceSnapshotId',
      'workspaceId',
      'version',
      'channel',
      'reviewedSendFingerprintSha256',
      'entries',
      'audienceFingerprintSha256',
      'capturedAt',
      'legalConsentVerifiedByMarkOrbit',
      'externalSendAuthorized'
    ],
    'audienceSnapshot'
  );
  if (input.schemaVersion !== 1 || input.channel !== 'EMAIL')
    throw new EmailCampaignContractError('Audience snapshot schema/channel is invalid.');
  if (input.legalConsentVerifiedByMarkOrbit !== false || input.externalSendAuthorized !== false)
    throw new EmailCampaignContractError('Audience snapshot authority locks must remain false.');
  if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 10000)
    throw new EmailCampaignContractError('entries must contain 1 to 10000 bounded recipients.');
  const reviewedSend = sha256(
    input.reviewedSendFingerprintSha256,
    'reviewedSendFingerprintSha256'
  );
  const entries = input.entries.map((raw, index): CampaignAudienceEntryV1 => {
    const item = object(raw, `entries[${index}]`);
    exactKeys(
      item,
      ['targetRef', 'endpointFingerprintSha256', 'purpose', 'policyRef', 'readiness'],
      `entries[${index}]`
    );
    const readiness = object(item.readiness, `entries[${index}].readiness`);
    exactKeys(
      readiness,
      [
        'evaluatedAt',
        'readinessFingerprintSha256',
        'reviewedSendFingerprintSha256',
        'outcome',
        'reason',
        'basisAssertionRef',
        'suppressionRefs'
      ],
      `entries[${index}].readiness`
    );
    const basis = object(readiness.basisAssertionRef, `entries[${index}].readiness.basisAssertionRef`);
    exactKeys(basis, ['assertionId', 'version'], `entries[${index}].readiness.basisAssertionRef`);
    if (!Array.isArray(readiness.suppressionRefs) || readiness.suppressionRefs.length > 20)
      throw new EmailCampaignContractError('suppressionRefs must be a bounded array.');
    const entryReviewedSend = sha256(
      readiness.reviewedSendFingerprintSha256,
      `entries[${index}].readiness.reviewedSendFingerprintSha256`
    );
    if (entryReviewedSend !== reviewedSend)
      throw new EmailCampaignContractError('Audience readiness must bind the exact reviewed send.');
    return {
      targetRef: targetRef(item.targetRef),
      endpointFingerprintSha256: sha256(
        item.endpointFingerprintSha256,
        `entries[${index}].endpointFingerprintSha256`
      ),
      purpose: one(
        item.purpose,
        ['PROSPECT_OUTREACH', 'PARTNER_OUTREACH', 'EDUCATION_INVITATION'] as const,
        `entries[${index}].purpose`
      ),
      policyRef: policyRef(item.policyRef),
      readiness: {
        evaluatedAt: timestamp(readiness.evaluatedAt, `entries[${index}].readiness.evaluatedAt`),
        readinessFingerprintSha256: sha256(
          readiness.readinessFingerprintSha256,
          `entries[${index}].readiness.readinessFingerprintSha256`
        ),
        reviewedSendFingerprintSha256: entryReviewedSend,
        outcome: one(
          readiness.outcome,
          ['READY_FOR_HUMAN_SEND'] as const,
          `entries[${index}].readiness.outcome`
        ),
        reason: one(
          readiness.reason,
          ['CURRENT_ALLOWED_ASSERTION'] as const,
          `entries[${index}].readiness.reason`
        ),
        basisAssertionRef: {
          assertionId: opaque(
            basis.assertionId,
            `entries[${index}].readiness.basisAssertionRef.assertionId`,
            240
          ) as OutboundContactBasisAssertionIdV1,
          version: positive(
            basis.version,
            `entries[${index}].readiness.basisAssertionRef.version`
          )
        },
        suppressionRefs: readiness.suppressionRefs.map((rawSuppression, suppressionIndex) => {
          const suppression = object(
            rawSuppression,
            `entries[${index}].readiness.suppressionRefs[${suppressionIndex}]`
          );
          exactKeys(
            suppression,
            ['suppressionId', 'version', 'scope', 'status'],
            `entries[${index}].readiness.suppressionRefs[${suppressionIndex}]`
          );
          return {
            suppressionId: opaque(
              suppression.suppressionId,
              `entries[${index}].readiness.suppressionRefs[${suppressionIndex}].suppressionId`,
              240
            ) as OutboundContactSuppressionIdV1,
            version: positive(
              suppression.version,
              `entries[${index}].readiness.suppressionRefs[${suppressionIndex}].version`
            ),
            scope: one(
              suppression.scope,
              [
                'ALL_OUTBOUND',
                'PROSPECT_OUTREACH',
                'PARTNER_OUTREACH',
                'EDUCATION_INVITATION'
              ] as const,
              `entries[${index}].readiness.suppressionRefs[${suppressionIndex}].scope`
            ),
            status: one(
              suppression.status,
              ['ACTIVE', 'CLEARED'] as const,
              `entries[${index}].readiness.suppressionRefs[${suppressionIndex}].status`
            )
          };
        })
      }
    };
  });
  return {
    schemaVersion: 1,
    audienceSnapshotId: id<CampaignAudienceSnapshotIdV1>(
      input.audienceSnapshotId,
      'audienceSnapshotId',
      ID_PATTERNS.audienceSnapshotId
    ),
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: positive(input.version, 'version'),
    channel: 'EMAIL',
    reviewedSendFingerprintSha256: reviewedSend,
    entries,
    audienceFingerprintSha256: sha256(input.audienceFingerprintSha256, 'audienceFingerprintSha256'),
    capturedAt: timestamp(input.capturedAt, 'capturedAt'),
    legalConsentVerifiedByMarkOrbit: false,
    externalSendAuthorized: false
  };
}

export function parseCampaignContentProjectionV1(value: unknown): CampaignContentProjectionV1 {
  const input = object(value, 'contentProjection');
  const allowed = [
    'schemaVersion',
    'contentProjectionId',
    'workspaceId',
    'version',
    'publishPackageRef',
    'subject',
    'preheader',
    'reviewedSendFingerprintSha256',
    'bodyOwnedByPublishPackage',
    'projectionFingerprintSha256',
    'createdAt',
    'externalSendAuthorized'
  ].filter((key) => key !== 'preheader' || input.preheader !== undefined);
  exactKeys(input, allowed, 'contentProjection');
  if (
    input.schemaVersion !== 1 ||
    input.bodyOwnedByPublishPackage !== true ||
    input.externalSendAuthorized !== false
  )
    throw new EmailCampaignContractError('Content projection authority/ownership locks are invalid.');
  const ref = object(input.publishPackageRef, 'publishPackageRef');
  exactKeys(ref, ['publishPackageId', 'version', 'fingerprintSha256'], 'publishPackageRef');
  return {
    schemaVersion: 1,
    contentProjectionId: id<CampaignContentProjectionIdV1>(
      input.contentProjectionId,
      'contentProjectionId',
      ID_PATTERNS.contentProjectionId
    ),
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: positive(input.version, 'version'),
    publishPackageRef: {
      publishPackageId: opaque(
        ref.publishPackageId,
        'publishPackageRef.publishPackageId',
        240
      ) as PublishPackageId,
      version: positive(ref.version, 'publishPackageRef.version'),
      fingerprintSha256: sha256(ref.fingerprintSha256, 'publishPackageRef.fingerprintSha256')
    },
    subject: text(input.subject, 'subject', 240),
    ...(input.preheader === undefined
      ? {}
      : { preheader: text(input.preheader, 'preheader', 300) }),
    reviewedSendFingerprintSha256: sha256(
      input.reviewedSendFingerprintSha256,
      'reviewedSendFingerprintSha256'
    ),
    bodyOwnedByPublishPackage: true,
    projectionFingerprintSha256: sha256(
      input.projectionFingerprintSha256,
      'projectionFingerprintSha256'
    ),
    createdAt: timestamp(input.createdAt, 'createdAt'),
    externalSendAuthorized: false
  };
}

export function parseCampaignBrandProjectionV1(value: unknown): CampaignBrandProjectionV1 {
  const input = object(value, 'brandProjection');
  exactKeys(
    input,
    [
      'schemaVersion',
      'brandProjectionId',
      'workspaceId',
      'version',
      'source',
      'presentation',
      'brandProjectionFingerprintSha256',
      'capturedAt',
      'canonicalWorkspaceBrandCreated'
    ],
    'brandProjection'
  );
  if (input.schemaVersion !== 1 || input.canonicalWorkspaceBrandCreated !== false)
    throw new EmailCampaignContractError('Brand projection ownership lock is invalid.');
  const source = object(input.source, 'source');
  const kind = one(source.kind, campaignBrandSourceKindsV1, 'source.kind');
  exactKeys(
    source,
    kind === 'SITE_CONFIGURATION'
      ? ['kind', 'siteId', 'configurationVersion', 'sourceRef']
      : ['kind', 'sourceRef'],
    'source'
  );
  const presentation = object(input.presentation, 'presentation');
  const presentationAllowed = [
    'displayName',
    'logoAssetRef',
    'primaryColor',
    'accentColor',
    'colorMode'
  ].filter((key) => presentation[key] !== undefined || key === 'displayName');
  exactKeys(presentation, presentationAllowed, 'presentation');
  return {
    schemaVersion: 1,
    brandProjectionId: id<CampaignBrandProjectionIdV1>(
      input.brandProjectionId,
      'brandProjectionId',
      ID_PATTERNS.brandProjectionId
    ),
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: positive(input.version, 'version'),
    source:
      kind === 'SITE_CONFIGURATION'
        ? {
            kind,
            siteId: opaque(source.siteId, 'source.siteId', 240) as SiteIdV1,
            configurationVersion: positive(source.configurationVersion, 'source.configurationVersion'),
            sourceRef: opaque(source.sourceRef, 'source.sourceRef')
          }
        : {
            kind,
            sourceRef: opaque(source.sourceRef, 'source.sourceRef')
          },
    presentation: {
      displayName: text(presentation.displayName, 'presentation.displayName', 160),
      ...(presentation.logoAssetRef === undefined
        ? {}
        : { logoAssetRef: opaque(presentation.logoAssetRef, 'presentation.logoAssetRef') }),
      ...(presentation.primaryColor === undefined
        ? {}
        : { primaryColor: text(presentation.primaryColor, 'presentation.primaryColor', 32) }),
      ...(presentation.accentColor === undefined
        ? {}
        : { accentColor: text(presentation.accentColor, 'presentation.accentColor', 32) }),
      ...(presentation.colorMode === undefined
        ? {}
        : {
            colorMode: one(
              presentation.colorMode,
              ['LIGHT', 'DARK', 'SYSTEM'] as const,
              'presentation.colorMode'
            )
          })
    },
    brandProjectionFingerprintSha256: sha256(
      input.brandProjectionFingerprintSha256,
      'brandProjectionFingerprintSha256'
    ),
    capturedAt: timestamp(input.capturedAt, 'capturedAt'),
    canonicalWorkspaceBrandCreated: false
  };
}

export function parseEmailCampaignV1(value: unknown): EmailCampaignV1 {
  const input = object(value, 'campaign');
  exactKeys(
    input,
    [
      'schemaVersion',
      'campaignId',
      'workspaceId',
      'version',
      'featureKey',
      'purpose',
      'audience',
      'content',
      'brand',
      'status',
      'humanReviewRequired',
      'createdAt',
      'updatedAt',
      'authority'
    ],
    'campaign'
  );
  if (input.schemaVersion !== 1 || input.featureKey !== 'EMAIL_CAMPAIGN')
    throw new EmailCampaignContractError('Campaign schema/feature is invalid.');
  if (input.humanReviewRequired !== true)
    throw new EmailCampaignContractError('Campaign requires human review.');
  assertFalseAuthority(input.authority);
  const ref = <TId extends string>(
    raw: unknown,
    field: string,
    idField: string
  ): { id: TId; version: number; fingerprintSha256: string } => {
    const item = object(raw, field);
    exactKeys(item, [idField, 'version', 'fingerprintSha256'], field);
    return {
      id: opaque(item[idField], `${field}.${idField}`, 240) as TId,
      version: positive(item.version, `${field}.version`),
      fingerprintSha256: sha256(item.fingerprintSha256, `${field}.fingerprintSha256`)
    };
  };
  const audience = ref<CampaignAudienceSnapshotIdV1>(
    input.audience,
    'audience',
    'audienceSnapshotId'
  );
  const content = ref<CampaignContentProjectionIdV1>(
    input.content,
    'content',
    'contentProjectionId'
  );
  const brand = ref<CampaignBrandProjectionIdV1>(
    input.brand,
    'brand',
    'brandProjectionId'
  );
  return {
    schemaVersion: 1,
    campaignId: id<EmailCampaignIdV1>(input.campaignId, 'campaignId', ID_PATTERNS.campaignId),
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: positive(input.version, 'version'),
    featureKey: 'EMAIL_CAMPAIGN',
    purpose: one(
      input.purpose,
      ['PROSPECT_OUTREACH', 'PARTNER_OUTREACH', 'EDUCATION_INVITATION'] as const,
      'purpose'
    ),
    audience: {
      audienceSnapshotId: audience.id,
      version: audience.version,
      fingerprintSha256: audience.fingerprintSha256
    },
    content: {
      contentProjectionId: content.id,
      version: content.version,
      fingerprintSha256: content.fingerprintSha256
    },
    brand: {
      brandProjectionId: brand.id,
      version: brand.version,
      fingerprintSha256: brand.fingerprintSha256
    },
    status: one(input.status, emailCampaignStatusesV1, 'status'),
    humanReviewRequired: true,
    createdAt: timestamp(input.createdAt, 'createdAt'),
    updatedAt: timestamp(input.updatedAt, 'updatedAt'),
    authority: noEmailCampaignAuthorityConsequencesV1
  };
}

export function parseCampaignReviewDecisionV1(value: unknown): CampaignReviewDecisionV1 {
  const input = object(value, 'campaignReviewDecision');
  exactKeys(
    input,
    [
      'schemaVersion',
      'campaignReviewDecisionId',
      'workspaceId',
      'version',
      'campaign',
      'expectedCampaignFingerprintSha256',
      'outcome',
      'reviewerPrincipalId',
      'rationale',
      'reviewedAt',
      'deliveryPreparationOnly',
      'authority'
    ],
    'campaignReviewDecision'
  );
  if (input.schemaVersion !== 1 || input.deliveryPreparationOnly !== true)
    throw new EmailCampaignContractError('Review decision boundary is invalid.');
  assertFalseAuthority(input.authority);
  const campaign = object(input.campaign, 'campaign');
  exactKeys(campaign, ['campaignId', 'version'], 'campaign');
  return {
    schemaVersion: 1,
    campaignReviewDecisionId: id<CampaignReviewDecisionIdV1>(
      input.campaignReviewDecisionId,
      'campaignReviewDecisionId',
      ID_PATTERNS.campaignReviewDecisionId
    ),
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: positive(input.version, 'version'),
    campaign: {
      campaignId: opaque(campaign.campaignId, 'campaign.campaignId', 240) as EmailCampaignIdV1,
      version: positive(campaign.version, 'campaign.version')
    },
    expectedCampaignFingerprintSha256: sha256(
      input.expectedCampaignFingerprintSha256,
      'expectedCampaignFingerprintSha256'
    ),
    outcome: one(input.outcome, campaignReviewOutcomesV1, 'outcome'),
    reviewerPrincipalId: opaque(input.reviewerPrincipalId, 'reviewerPrincipalId', 240),
    rationale: text(input.rationale, 'rationale', 1000),
    reviewedAt: timestamp(input.reviewedAt, 'reviewedAt'),
    deliveryPreparationOnly: true,
    authority: noEmailCampaignAuthorityConsequencesV1
  };
}

export function assessCampaignPublishPackageV1(
  projection: Readonly<CampaignContentProjectionV1>,
  publishPackage: Readonly<PublishPackage>
): Readonly<{
  matches: boolean;
  reason:
    | 'MATCH'
    | 'WORKSPACE_MISMATCH'
    | 'PUBLISH_PACKAGE_ID_MISMATCH'
    | 'PUBLISH_PACKAGE_VERSION_MISMATCH'
    | 'PUBLISH_PACKAGE_FINGERPRINT_MISMATCH';
  createsSendAuthority: false;
}> {
  let reason:
    | 'MATCH'
    | 'WORKSPACE_MISMATCH'
    | 'PUBLISH_PACKAGE_ID_MISMATCH'
    | 'PUBLISH_PACKAGE_VERSION_MISMATCH'
    | 'PUBLISH_PACKAGE_FINGERPRINT_MISMATCH' = 'MATCH';
  if (projection.workspaceId !== publishPackage.workspaceId) reason = 'WORKSPACE_MISMATCH';
  else if (projection.publishPackageRef.publishPackageId !== publishPackage.publishPackageId)
    reason = 'PUBLISH_PACKAGE_ID_MISMATCH';
  else if (projection.publishPackageRef.version !== publishPackage.version)
    reason = 'PUBLISH_PACKAGE_VERSION_MISMATCH';
  else if (
    projection.publishPackageRef.fingerprintSha256 !== publishPackage.publishPackageFingerprintSha256
  )
    reason = 'PUBLISH_PACKAGE_FINGERPRINT_MISMATCH';
  return { matches: reason === 'MATCH', reason, createsSendAuthority: false };
}

export function assessCampaignAudienceReadinessV1(
  entry: Readonly<CampaignAudienceEntryV1>,
  readiness: Readonly<OutboundContactReadinessV1>
): Readonly<{
  matches: boolean;
  reason:
    | 'MATCH'
    | 'TARGET_MISMATCH'
    | 'ENDPOINT_FINGERPRINT_MISMATCH'
    | 'PURPOSE_MISMATCH'
    | 'POLICY_MISMATCH'
    | 'READINESS_FINGERPRINT_MISMATCH'
    | 'REVIEWED_SEND_FINGERPRINT_MISMATCH'
    | 'READINESS_NOT_READY';
  createsSendAuthority: false;
}> {
  let reason:
    | 'MATCH'
    | 'TARGET_MISMATCH'
    | 'ENDPOINT_FINGERPRINT_MISMATCH'
    | 'PURPOSE_MISMATCH'
    | 'POLICY_MISMATCH'
    | 'READINESS_FINGERPRINT_MISMATCH'
    | 'REVIEWED_SEND_FINGERPRINT_MISMATCH'
    | 'READINESS_NOT_READY' = 'MATCH';
  const a = entry.targetRef;
  const b = readiness.targetRef;
  if (a.owner !== b.owner || a.kind !== b.kind || a.id !== b.id || a.version !== b.version)
    reason = 'TARGET_MISMATCH';
  else if (entry.endpointFingerprintSha256 !== readiness.endpointFingerprintSha256)
    reason = 'ENDPOINT_FINGERPRINT_MISMATCH';
  else if (entry.purpose !== readiness.purpose) reason = 'PURPOSE_MISMATCH';
  else if (
    entry.policyRef.policyId !== readiness.policyRef.policyId ||
    entry.policyRef.version !== readiness.policyRef.version
  )
    reason = 'POLICY_MISMATCH';
  else if (entry.readiness.readinessFingerprintSha256 !== readiness.readinessFingerprintSha256)
    reason = 'READINESS_FINGERPRINT_MISMATCH';
  else if (entry.readiness.reviewedSendFingerprintSha256 !== readiness.reviewedSendFingerprintSha256)
    reason = 'REVIEWED_SEND_FINGERPRINT_MISMATCH';
  else if (readiness.outcome !== 'READY_FOR_HUMAN_SEND' || readiness.reason !== 'CURRENT_ALLOWED_ASSERTION')
    reason = 'READINESS_NOT_READY';
  return { matches: reason === 'MATCH', reason, createsSendAuthority: false };
}
