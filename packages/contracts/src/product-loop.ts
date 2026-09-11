import { createHash } from 'node:crypto';

import {
  parseCommunicationLinkTargetReferenceV1,
  type CommunicationLinkTargetReferenceV1
} from './communication-link.js';
import type { CustomerIntent, MarkOrbitId, RelationshipModel } from './index.js';
import {
  parseManagedCommunicationAttachmentRefV1,
  parseManagedCommunicationParticipantV1,
  type ManagedCommunicationAttachmentRefV1,
  type ManagedCommunicationParticipantV1
} from './managed-communication.js';
import {
  parseWorkspaceDirectoryContactPointV1,
  type WorkspaceDirectoryContactPointV1,
  type WorkspaceDirectoryEntryId
} from './workspace-directory.js';

/**
 * PLC-WP-01 freezes the minimum Product-loop vocabulary needed to prove Lite's
 * Today -> Recommendation -> Prepared Action -> Confirmation -> Handoff path.
 *
 * These contracts describe candidate/preparation state and one bounded MarkReg
 * formal Opportunity boundary. They do not create runtime persistence, publish
 * externally, contact a customer, create an Order/Matter, appoint a provider or
 * submit a filing.
 */

export type TodayRecommendationId = `today-recommendation_${string}`;
export type PreparedActionId = `prepared-action_${string}`;
export type ContentOpportunityId = `content-opportunity_${string}`;
export type ContentDraftId = `content-draft_${string}`;
export type ContentReviewDecisionId = `content-review-decision_${string}`;
export type PublishPackageId = `publish-package_${string}`;
export type ProductLoopFeedbackId = `product-loop-feedback_${string}`;
export type OpportunityCandidateId = `opportunity-candidate_${string}`;
export type OpportunityQualificationDecisionId = `opportunity-qualification_${string}`;
export type FormalTrademarkServiceOpportunityId = `trademark-service-opportunity_${string}`;

export interface ProductLoopExactReference<TId extends string = string> {
  id: TId;
  version: number | string;
}

export const productLoopSourceOwners = [
  'CORE',
  'KNOWLEDGE',
  'LITE',
  'MARKREG',
  'EXECUTION',
  'MGSN'
] as const;
export type ProductLoopSourceOwner = (typeof productLoopSourceOwners)[number];

export const productLoopSourceKinds = [
  'KNOWLEDGE_READY_PACKAGE',
  'TRADEMARK_CONTEXT',
  'CUSTOMER_CONTEXT',
  'MARKREG_RECOMMENDED_ACTION',
  'MANUAL_WORK_SIGNAL',
  'CONTENT_USE_FEEDBACK'
] as const;
export type ProductLoopSourceKind = (typeof productLoopSourceKinds)[number];

/** Exact or equivalently stable provenance supplied by the owning boundary. */
export interface ProductLoopSourceReference {
  schemaVersion: 1;
  owner: ProductLoopSourceOwner;
  kind: ProductLoopSourceKind;
  sourceId: string;
  sourceVersion: number | string;
  sourceFingerprintSha256: string;
  observedAt: string;
  correlationId?: MarkOrbitId;
}

export const todayRecommendationKinds = [
  'CONTENT_PREPARATION',
  'OPPORTUNITY_REVIEW',
  'MARKREG_HANDOFF',
  'WORK_FOLLOW_UP'
] as const;
export type TodayRecommendationKind = (typeof todayRecommendationKinds)[number];

export const todayRecommendationStatuses = [
  'OPEN',
  'ACKNOWLEDGED',
  'DISMISSED',
  'SUPERSEDED'
] as const;
export type TodayRecommendationStatus = (typeof todayRecommendationStatuses)[number];

/**
 * Lite-owned Product recommendation. It is intentionally broader than the
 * lifecycle-specific MarkReg RecommendedAction contract, which requires a
 * Formal Matter/Lifecycle View and therefore cannot represent every Today item.
 */
export interface TodayRecommendation {
  schemaVersion: 1;
  todayRecommendationId: TodayRecommendationId;
  workspaceId: string;
  version: number;
  kind: TodayRecommendationKind;
  title: string;
  explanation: string;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  status: TodayRecommendationStatus;
  recommendationFingerprintSha256: string;
  executionAuthorized: false;
  createdAt: string;
  updatedAt: string;
}

export const preparedActionKinds = [
  'PREPARE_CONTENT',
  'REVIEW_OPPORTUNITY',
  'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
  'START_MARKREG_INTAKE',
  'PREPARE_CLIENT_NOTIFICATION'
] as const;
export type PreparedActionKind = (typeof preparedActionKinds)[number];

export const productLoopHandoffTargets = [
  'LITE_CONTENT_PREPARATION',
  'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
  'MARKREG_INTAKE',
  'MANAGED_COMMUNICATION_CLIENT_NOTIFICATION'
] as const;
export type ProductLoopHandoffTarget = (typeof productLoopHandoffTargets)[number];

export type ClientNotificationAttachmentSnapshotV1 = Readonly<
  Omit<ManagedCommunicationAttachmentRefV1, 'sha256'> & { sha256: string }
>;

export interface ClientNotificationSourceDraftReferenceV1 {
  owner: 'LITE';
  kind: 'TRADEMARK_SERVICE_COMMUNICATION_DRAFT';
  workPackage: Readonly<ProductLoopExactReference>;
  preparationId: string;
  draftKind: 'CLIENT_INFORMATION_REQUEST';
  draftFingerprintSha256: string;
}

export interface ClientNotificationWorkReferenceV1 {
  owner: 'LITE';
  kind: 'WORK_ITEM';
  workspaceId: string;
  workItemId: string;
  version: number;
}

export interface ClientNotificationDirectoryRecipientSourceV1 {
  kind: 'WORKSPACE_DIRECTORY_CONTACT';
  directoryEntry: Readonly<{
    owner: 'LITE';
    kind: 'WORKSPACE_DIRECTORY_ENTRY';
    workspaceId: string;
    workspaceDirectoryEntryId: WorkspaceDirectoryEntryId;
    version: number;
  }>;
  contactPoint: Readonly<WorkspaceDirectoryContactPointV1>;
}

export type ClientNotificationRecipientSourceV1 =
  Readonly<{ kind: 'MANUAL_ENTRY' }> | Readonly<ClientNotificationDirectoryRecipientSourceV1>;

export interface ClientNotificationRecipientSnapshotV1 {
  participant: Readonly<ManagedCommunicationParticipantV1>;
  source: Readonly<ClientNotificationRecipientSourceV1>;
}

export interface ClientNotificationPreparationAuthorityConsequencesV1 {
  externalMessageSent: false;
  externalActionAuthorized: false;
  customerContactAuthorized: false;
  customerReceived: false;
  customerRead: false;
  customerResponded: false;
  legalNoticeEffective: false;
  relatedBusinessStateMutated: false;
  productLoop: Readonly<ProductLoopAuthorityConsequences>;
}

export interface ClientNotificationHandoffPlanV1 {
  schemaVersion: 1;
  kind: 'CLIENT_NOTIFICATION_HANDOFF';
  workspaceId: string;
  sourceDraft: Readonly<ClientNotificationSourceDraftReferenceV1>;
  accountRef: string;
  channel: 'EMAIL';
  sender: Readonly<ManagedCommunicationParticipantV1>;
  recipients: ReadonlyArray<Readonly<ClientNotificationRecipientSnapshotV1>>;
  subject: string;
  body: string;
  attachments: ReadonlyArray<Readonly<ClientNotificationAttachmentSnapshotV1>>;
  reviewedContentFingerprintSha256: string;
  relatedWorkItem?: Readonly<ClientNotificationWorkReferenceV1>;
  relatedBusinessRefs: ReadonlyArray<Readonly<CommunicationLinkTargetReferenceV1>>;
  confirmationFingerprintSha256: string;
  authorityConsequences: Readonly<ClientNotificationPreparationAuthorityConsequencesV1>;
}

/** Reviewable Product intent before any owner mutation or protected action. */
export interface PreparedAction {
  schemaVersion: 1;
  preparedActionId: PreparedActionId;
  workspaceId: string;
  version: number;
  recommendation: Readonly<ProductLoopExactReference<TodayRecommendationId>>;
  recommendationFingerprintSha256: string;
  kind: PreparedActionKind;
  summary: string;
  confirmationEffect: string;
  handoffTarget: ProductLoopHandoffTarget;
  clientNotificationPlan?: Readonly<ClientNotificationHandoffPlanV1>;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  preparedActionFingerprintSha256: string;
  confirmationRequired: true;
  executionAuthorized: false;
  createdAt: string;
  updatedAt: string;
}

export interface PreparedActionConfirmation {
  schemaVersion: 1;
  preparedAction: Readonly<ProductLoopExactReference<PreparedActionId>>;
  expectedPreparedActionFingerprintSha256: string;
  /** Authoritative Core WorkspacePrincipal.userId; no second identity namespace is created. */
  confirmedByPrincipalId: string;
  confirmedAt: string;
  acknowledgedEffect: string;
  /** Required only for PREPARE_CLIENT_NOTIFICATION; binds the exact frozen send plan. */
  expectedClientNotificationPlanFingerprintSha256?: string;
  protectedActionAuthorized: false;
}

export class ClientNotificationHandoffContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ClientNotificationHandoffContractError';
  }
}

type ClientNotificationRecord = Record<string, unknown>;
const clientNotificationSha256Pattern = /^[0-9a-f]{64}$/u;

function clientNotificationRecord(value: unknown, field: string): ClientNotificationRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ClientNotificationHandoffContractError(`${field} must be an object.`);
  }
  return value as ClientNotificationRecord;
}

function clientNotificationExactKeys(
  record: ClientNotificationRecord,
  allowed: readonly string[],
  field: string
): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(record).filter((key) => !allowedSet.has(key));
  if (unsupported.length > 0) {
    throw new ClientNotificationHandoffContractError(
      `${field} contains unsupported key(s): ${unsupported.join(', ')}.`
    );
  }
}

function clientNotificationText(value: unknown, field: string, maximum = 10_000): string {
  if (typeof value !== 'string') {
    throw new ClientNotificationHandoffContractError(`${field} must be a string.`);
  }
  const result = value.trim();
  if (!result || result.length > maximum) {
    throw new ClientNotificationHandoffContractError(`${field} is invalid.`);
  }
  return result;
}

function clientNotificationSha256(value: unknown, field: string): string {
  const result = clientNotificationText(value, field, 64);
  if (!clientNotificationSha256Pattern.test(result)) {
    throw new ClientNotificationHandoffContractError(`${field} must be lowercase SHA-256 hex.`);
  }
  return result;
}

function clientNotificationPositiveInt(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new ClientNotificationHandoffContractError(`${field} must be a positive safe integer.`);
  }
  return value as number;
}

function clientNotificationCanonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => clientNotificationCanonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, clientNotificationCanonicalize(item)])
    );
  }
  return value;
}

function clientNotificationFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(clientNotificationCanonicalize(value)))
    .digest('hex');
}

export function clientNotificationReviewedContentFingerprintSha256V1(
  value: Readonly<{
    subject: string;
    body: string;
    attachments: ReadonlyArray<Readonly<ClientNotificationAttachmentSnapshotV1>>;
  }>
): string {
  return clientNotificationFingerprint(value);
}

export function clientNotificationConfirmationFingerprintSha256V1(
  value: Omit<
    ClientNotificationHandoffPlanV1,
    'confirmationFingerprintSha256' | 'authorityConsequences'
  >
): string {
  return clientNotificationFingerprint(value);
}

function parseClientNotificationRecipientSource(
  value: unknown,
  participantAddress: string,
  workspaceId: string,
  field: string
): ClientNotificationRecipientSourceV1 {
  const source = clientNotificationRecord(value, field);
  const kind = clientNotificationText(source.kind, `${field}.kind`, 80);
  if (kind === 'MANUAL_ENTRY') {
    clientNotificationExactKeys(source, ['kind'], field);
    return { kind };
  }
  if (kind !== 'WORKSPACE_DIRECTORY_CONTACT') {
    throw new ClientNotificationHandoffContractError(`${field}.kind is unsupported.`);
  }
  clientNotificationExactKeys(source, ['kind', 'directoryEntry', 'contactPoint'], field);

  const entry = clientNotificationRecord(source.directoryEntry, `${field}.directoryEntry`);
  clientNotificationExactKeys(
    entry,
    ['owner', 'kind', 'workspaceId', 'workspaceDirectoryEntryId', 'version'],
    `${field}.directoryEntry`
  );
  if (
    entry.owner !== 'LITE' ||
    entry.kind !== 'WORKSPACE_DIRECTORY_ENTRY' ||
    entry.workspaceId !== workspaceId
  ) {
    throw new ClientNotificationHandoffContractError(`${field}.directoryEntry is invalid.`);
  }

  const contactPoint = parseWorkspaceDirectoryContactPointV1(
    source.contactPoint,
    `${field}.contactPoint`
  );
  if (contactPoint.kind !== 'EMAIL') {
    throw new ClientNotificationHandoffContractError(`${field}.contactPoint.kind must be EMAIL.`);
  }
  if (contactPoint.value.toLowerCase() !== participantAddress.toLowerCase()) {
    throw new ClientNotificationHandoffContractError(
      `${field}.contactPoint.value must match the frozen recipient address.`
    );
  }

  return {
    kind,
    directoryEntry: {
      owner: 'LITE',
      kind: 'WORKSPACE_DIRECTORY_ENTRY',
      workspaceId,
      workspaceDirectoryEntryId: clientNotificationText(
        entry.workspaceDirectoryEntryId,
        `${field}.directoryEntry.workspaceDirectoryEntryId`,
        300
      ) as WorkspaceDirectoryEntryId,
      version: clientNotificationPositiveInt(entry.version, `${field}.directoryEntry.version`)
    },
    contactPoint
  };
}

export function parseClientNotificationHandoffPlanV1(
  value: unknown
): ClientNotificationHandoffPlanV1 {
  const plan = clientNotificationRecord(value, 'clientNotificationPlan');
  clientNotificationExactKeys(
    plan,
    [
      'schemaVersion',
      'kind',
      'workspaceId',
      'sourceDraft',
      'accountRef',
      'channel',
      'sender',
      'recipients',
      'subject',
      'body',
      'attachments',
      'reviewedContentFingerprintSha256',
      'relatedWorkItem',
      'relatedBusinessRefs',
      'confirmationFingerprintSha256',
      'authorityConsequences'
    ],
    'clientNotificationPlan'
  );
  if (
    plan.schemaVersion !== 1 ||
    plan.kind !== 'CLIENT_NOTIFICATION_HANDOFF' ||
    plan.channel !== 'EMAIL'
  ) {
    throw new ClientNotificationHandoffContractError(
      'clientNotificationPlan schema/kind/channel is invalid.'
    );
  }

  const workspaceId = clientNotificationText(
    plan.workspaceId,
    'clientNotificationPlan.workspaceId',
    300
  );
  const sourceDraft = clientNotificationRecord(
    plan.sourceDraft,
    'clientNotificationPlan.sourceDraft'
  );
  clientNotificationExactKeys(
    sourceDraft,
    ['owner', 'kind', 'workPackage', 'preparationId', 'draftKind', 'draftFingerprintSha256'],
    'clientNotificationPlan.sourceDraft'
  );
  if (
    sourceDraft.owner !== 'LITE' ||
    sourceDraft.kind !== 'TRADEMARK_SERVICE_COMMUNICATION_DRAFT' ||
    sourceDraft.draftKind !== 'CLIENT_INFORMATION_REQUEST'
  ) {
    throw new ClientNotificationHandoffContractError(
      'clientNotificationPlan.sourceDraft is invalid.'
    );
  }
  const workPackage = clientNotificationRecord(
    sourceDraft.workPackage,
    'clientNotificationPlan.sourceDraft.workPackage'
  );
  clientNotificationExactKeys(
    workPackage,
    ['id', 'version'],
    'clientNotificationPlan.sourceDraft.workPackage'
  );

  const sender = parseManagedCommunicationParticipantV1(
    plan.sender,
    'clientNotificationPlan.sender'
  );
  if (sender.role !== 'SENDER' || sender.address.includes('*')) {
    throw new ClientNotificationHandoffContractError(
      'clientNotificationPlan.sender must be one concrete SENDER.'
    );
  }

  if (!Array.isArray(plan.recipients) || plan.recipients.length === 0) {
    throw new ClientNotificationHandoffContractError(
      'clientNotificationPlan.recipients must be non-empty.'
    );
  }
  const recipients = plan.recipients.map((value, index) => {
    const field = `clientNotificationPlan.recipients[${index}]`;
    const recipient = clientNotificationRecord(value, field);
    clientNotificationExactKeys(recipient, ['participant', 'source'], field);
    const participant = parseManagedCommunicationParticipantV1(
      recipient.participant,
      `${field}.participant`
    );
    if (!['TO', 'CC', 'BCC'].includes(participant.role) || participant.address.includes('*')) {
      throw new ClientNotificationHandoffContractError(
        `${field}.participant must be one concrete TO/CC/BCC recipient.`
      );
    }
    return {
      participant,
      source: parseClientNotificationRecipientSource(
        recipient.source,
        participant.address,
        workspaceId,
        `${field}.source`
      )
    } satisfies ClientNotificationRecipientSnapshotV1;
  });
  if (!recipients.some(({ participant }) => participant.role === 'TO')) {
    throw new ClientNotificationHandoffContractError(
      'clientNotificationPlan requires at least one TO recipient.'
    );
  }

  if (!Array.isArray(plan.attachments)) {
    throw new ClientNotificationHandoffContractError(
      'clientNotificationPlan.attachments must be an array.'
    );
  }
  const attachments = plan.attachments.map((value, index) => {
    const attachment = parseManagedCommunicationAttachmentRefV1(
      value,
      `clientNotificationPlan.attachments[${index}]`
    );
    if (attachment.sha256 === undefined) {
      throw new ClientNotificationHandoffContractError(
        `clientNotificationPlan.attachments[${index}].sha256 is required.`
      );
    }
    return attachment as ClientNotificationAttachmentSnapshotV1;
  });

  const relatedWorkItem =
    plan.relatedWorkItem === undefined
      ? undefined
      : (() => {
          const work = clientNotificationRecord(
            plan.relatedWorkItem,
            'clientNotificationPlan.relatedWorkItem'
          );
          clientNotificationExactKeys(
            work,
            ['owner', 'kind', 'workspaceId', 'workItemId', 'version'],
            'clientNotificationPlan.relatedWorkItem'
          );
          if (
            work.owner !== 'LITE' ||
            work.kind !== 'WORK_ITEM' ||
            work.workspaceId !== workspaceId
          ) {
            throw new ClientNotificationHandoffContractError(
              'clientNotificationPlan.relatedWorkItem is invalid.'
            );
          }
          return {
            owner: 'LITE' as const,
            kind: 'WORK_ITEM' as const,
            workspaceId,
            workItemId: clientNotificationText(
              work.workItemId,
              'clientNotificationPlan.relatedWorkItem.workItemId',
              300
            ),
            version: clientNotificationPositiveInt(
              work.version,
              'clientNotificationPlan.relatedWorkItem.version'
            )
          };
        })();

  if (!Array.isArray(plan.relatedBusinessRefs) || plan.relatedBusinessRefs.length === 0) {
    throw new ClientNotificationHandoffContractError(
      'clientNotificationPlan.relatedBusinessRefs must be non-empty.'
    );
  }
  const relatedBusinessRefs = plan.relatedBusinessRefs.map((value) =>
    parseCommunicationLinkTargetReferenceV1(value, workspaceId)
  );

  const subject = clientNotificationText(plan.subject, 'clientNotificationPlan.subject', 2_000);
  const body = clientNotificationText(plan.body, 'clientNotificationPlan.body', 100_000);
  const reviewedContentFingerprintSha256 = clientNotificationSha256(
    plan.reviewedContentFingerprintSha256,
    'clientNotificationPlan.reviewedContentFingerprintSha256'
  );
  if (
    reviewedContentFingerprintSha256 !==
    clientNotificationReviewedContentFingerprintSha256V1({ subject, body, attachments })
  ) {
    throw new ClientNotificationHandoffContractError(
      'clientNotificationPlan reviewed content fingerprint mismatch.'
    );
  }

  const parsedWithoutConfirmationFingerprint = {
    schemaVersion: 1 as const,
    kind: 'CLIENT_NOTIFICATION_HANDOFF' as const,
    workspaceId,
    sourceDraft: {
      owner: 'LITE' as const,
      kind: 'TRADEMARK_SERVICE_COMMUNICATION_DRAFT' as const,
      workPackage: {
        id: clientNotificationText(
          workPackage.id,
          'clientNotificationPlan.sourceDraft.workPackage.id',
          300
        ),
        version:
          typeof workPackage.version === 'number'
            ? clientNotificationPositiveInt(
                workPackage.version,
                'clientNotificationPlan.sourceDraft.workPackage.version'
              )
            : clientNotificationText(
                workPackage.version,
                'clientNotificationPlan.sourceDraft.workPackage.version',
                300
              )
      },
      preparationId: clientNotificationText(
        sourceDraft.preparationId,
        'clientNotificationPlan.sourceDraft.preparationId',
        300
      ),
      draftKind: 'CLIENT_INFORMATION_REQUEST' as const,
      draftFingerprintSha256: clientNotificationSha256(
        sourceDraft.draftFingerprintSha256,
        'clientNotificationPlan.sourceDraft.draftFingerprintSha256'
      )
    },
    accountRef: clientNotificationText(plan.accountRef, 'clientNotificationPlan.accountRef', 500),
    channel: 'EMAIL' as const,
    sender,
    recipients,
    subject,
    body,
    attachments,
    reviewedContentFingerprintSha256,
    ...(relatedWorkItem === undefined ? {} : { relatedWorkItem }),
    relatedBusinessRefs
  };

  const confirmationFingerprintSha256 = clientNotificationSha256(
    plan.confirmationFingerprintSha256,
    'clientNotificationPlan.confirmationFingerprintSha256'
  );
  if (
    confirmationFingerprintSha256 !==
    clientNotificationConfirmationFingerprintSha256V1(parsedWithoutConfirmationFingerprint)
  ) {
    throw new ClientNotificationHandoffContractError(
      'clientNotificationPlan confirmation fingerprint mismatch.'
    );
  }
  if (
    clientNotificationFingerprint(plan.authorityConsequences) !==
    clientNotificationFingerprint(noClientNotificationPreparationAuthorityConsequencesV1)
  ) {
    throw new ClientNotificationHandoffContractError(
      'clientNotificationPlan authority consequences must remain false.'
    );
  }

  return {
    ...parsedWithoutConfirmationFingerprint,
    confirmationFingerprintSha256,
    authorityConsequences: noClientNotificationPreparationAuthorityConsequencesV1
  };
}

export function assertClientNotificationPreparedActionConfirmationV1(
  action: Readonly<PreparedAction>,
  confirmation: Readonly<PreparedActionConfirmation>
): Readonly<ClientNotificationHandoffPlanV1> {
  if (
    action.kind !== 'PREPARE_CLIENT_NOTIFICATION' ||
    action.handoffTarget !== 'MANAGED_COMMUNICATION_CLIENT_NOTIFICATION' ||
    action.clientNotificationPlan === undefined
  ) {
    throw new ClientNotificationHandoffContractError(
      'Prepared Action is not a client-notification handoff.'
    );
  }
  const plan = parseClientNotificationHandoffPlanV1(action.clientNotificationPlan);
  if (action.workspaceId !== plan.workspaceId) {
    throw new ClientNotificationHandoffContractError(
      'Prepared Action Workspace does not match the client-notification plan.'
    );
  }
  if (
    confirmation.preparedAction.id !== action.preparedActionId ||
    String(confirmation.preparedAction.version) !== String(action.version) ||
    confirmation.expectedPreparedActionFingerprintSha256 !== action.preparedActionFingerprintSha256
  ) {
    throw new ClientNotificationHandoffContractError(
      'Confirmation does not match the exact Prepared Action.'
    );
  }
  if (
    confirmation.expectedClientNotificationPlanFingerprintSha256 !==
    plan.confirmationFingerprintSha256
  ) {
    throw new ClientNotificationHandoffContractError(
      'Confirmation does not match the exact client-notification plan.'
    );
  }
  if (confirmation.protectedActionAuthorized !== false) {
    throw new ClientNotificationHandoffContractError(
      'Prepared Action confirmation cannot authorize a protected action.'
    );
  }
  return plan;
}

export const preparedActionHandoffStates = [
  'AWAITING_CONFIRMATION',
  'HANDOFF_PENDING',
  'HANDOFF_COMPLETED'
] as const;
export type PreparedActionHandoffState = (typeof preparedActionHandoffStates)[number];

export const preparedActionHandoffOwners = ['LITE', 'MARKREG', 'MANAGED_COMMUNICATION'] as const;
export type PreparedActionHandoffOwner = (typeof preparedActionHandoffOwners)[number];

export interface PreparedActionHandoffResult {
  schemaVersion: 1;
  preparedAction: Readonly<ProductLoopExactReference<PreparedActionId>>;
  target: ProductLoopHandoffTarget;
  owner: PreparedActionHandoffOwner;
  ownerRecord: Readonly<ProductLoopExactReference>;
  completedAt: string;
  consequences: Readonly<ProductLoopAuthorityConsequences>;
}

/** Browser/API read model for the real Today -> Prepared Action journey. */
export interface PreparedActionJourney {
  schemaVersion: 1;
  preparedAction: Readonly<PreparedAction>;
  confirmation?: Readonly<PreparedActionConfirmation>;
  handoffState: PreparedActionHandoffState;
  handoffResult?: Readonly<PreparedActionHandoffResult>;
}

export interface LiteTodaySnapshot {
  schemaVersion: 1;
  workspaceId: string;
  generatedAt: string;
  items: ReadonlyArray<
    Readonly<{
      recommendation: Readonly<TodayRecommendation>;
      preparedActions: ReadonlyArray<Readonly<PreparedActionJourney>>;
    }>
  >;
  partial: boolean;
  warnings: readonly string[];
}

export const contentOpportunityStatuses = [
  'CANDIDATE',
  'ACCEPTED_FOR_PREPARATION',
  'REJECTED',
  'DEFERRED'
] as const;
export type ContentOpportunityStatus = (typeof contentOpportunityStatuses)[number];

/** Lite-owned candidate reason to prepare useful professional content. */
export interface ContentOpportunity {
  schemaVersion: 1;
  contentOpportunityId: ContentOpportunityId;
  workspaceId: string;
  version: number;
  sourceRecommendation: Readonly<ProductLoopExactReference<TodayRecommendationId>>;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  title: string;
  rationale: string;
  status: ContentOpportunityStatus;
  contentOpportunityFingerprintSha256: string;
  publishAuthorized: false;
  formalBusinessOpportunityCreated: false;
  createdAt: string;
  updatedAt: string;
}

export const contentDraftStatuses = [
  'DRAFT',
  'READY_FOR_HUMAN_REVIEW',
  'REVIEWED_READY_FOR_PACKAGE',
  'CHANGES_REQUIRED',
  'REJECTED',
  'SUPERSEDED'
] as const;
export type ContentDraftStatus = (typeof contentDraftStatuses)[number];

/** Bounded Lite Product draft; this is not a universal Artifact model. */
export interface ContentDraft {
  schemaVersion: 1;
  contentDraftId: ContentDraftId;
  workspaceId: string;
  version: number;
  contentOpportunity: Readonly<ProductLoopExactReference<ContentOpportunityId>>;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  title: string;
  body: string;
  status: ContentDraftStatus;
  contentDraftFingerprintSha256: string;
  humanReviewRequired: true;
  published: false;
  createdAt: string;
  updatedAt: string;
}

export const contentReviewOutcomes = [
  'APPROVED_FOR_PUBLISH_PACKAGE',
  'CHANGES_REQUIRED',
  'REJECTED'
] as const;
export type ContentReviewOutcome = (typeof contentReviewOutcomes)[number];

/** Human review permits package preparation only; it does not perform publication. */
export interface ContentReviewDecision {
  schemaVersion: 1;
  contentReviewDecisionId: ContentReviewDecisionId;
  workspaceId: string;
  version: number;
  contentDraft: Readonly<ProductLoopExactReference<ContentDraftId>>;
  expectedContentDraftFingerprintSha256: string;
  outcome: ContentReviewOutcome;
  /** Authoritative Core WorkspacePrincipal.userId. */
  reviewerPrincipalId: string;
  rationale: string;
  reviewedAt: string;
  publishesExternally: false;
}

export interface PublishPackage {
  schemaVersion: 1;
  publishPackageId: PublishPackageId;
  workspaceId: string;
  version: number;
  contentDraft: Readonly<ProductLoopExactReference<ContentDraftId>>;
  contentDraftFingerprintSha256: string;
  reviewDecision: Readonly<ProductLoopExactReference<ContentReviewDecisionId>>;
  title: string;
  body: string;
  publishPackageFingerprintSha256: string;
  status: 'PREPARED';
  externalPublishExecuted: false;
  createdAt: string;
}

export const productLoopFeedbackOutcomes = [
  'USER_REPORTED_PUBLISHED',
  'USER_REPORTED_DELIVERED',
  'USER_REPORTED_USED',
  'NOT_USED'
] as const;
export type ProductLoopFeedbackOutcome = (typeof productLoopFeedbackOutcomes)[number];

/**
 * Manual after-the-fact feedback. MarkOrbit records the user's report; creating
 * this record never claims that MarkOrbit performed or independently verified
 * the external action.
 */
export interface ProductLoopUseFeedback {
  schemaVersion: 1;
  productLoopFeedbackId: ProductLoopFeedbackId;
  workspaceId: string;
  version: number;
  publishPackage: Readonly<ProductLoopExactReference<PublishPackageId>>;
  outcome: ProductLoopFeedbackOutcome;
  externalReference?: string;
  /** Authoritative Core WorkspacePrincipal.userId. */
  recordedByPrincipalId: string;
  recordedAt: string;
  externalActionExecutedByMarkOrbit: false;
  externalOutcomeVerifiedByMarkOrbit: false;
}

export const opportunityCandidateStatuses = ['OPEN', 'UNDER_REVIEW', 'DISPOSITIONED'] as const;
export type OpportunityCandidateStatus = (typeof opportunityCandidateStatuses)[number];

/** Lite-owned pre-qualification state; never a formal business Opportunity. */
export interface OpportunityCandidate {
  schemaVersion: 1;
  opportunityCandidateId: OpportunityCandidateId;
  workspaceId: string;
  version: number;
  kind: 'TRADEMARK_SERVICE';
  customerId?: MarkOrbitId;
  title: string;
  serviceNeedSummary: string;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  status: OpportunityCandidateStatus;
  opportunityCandidateFingerprintSha256: string;
  formalOpportunityCreated: false;
  customerContacted: false;
  createdAt: string;
  updatedAt: string;
}

export const opportunityQualificationOutcomes = [
  'QUALIFIED_FOR_MARKREG',
  'REJECTED',
  'DEFERRED'
] as const;
export type OpportunityQualificationOutcome = (typeof opportunityQualificationOutcomes)[number];

/** Explicit human qualification; owner mutation is a separate step. */
export interface OpportunityQualificationDecision {
  schemaVersion: 1;
  opportunityQualificationDecisionId: OpportunityQualificationDecisionId;
  workspaceId: string;
  version: number;
  candidate: Readonly<ProductLoopExactReference<OpportunityCandidateId>>;
  expectedCandidateFingerprintSha256: string;
  outcome: OpportunityQualificationOutcome;
  /** Authoritative Core WorkspacePrincipal.userId. */
  decidedByPrincipalId: string;
  rationale: string;
  decidedAt: string;
  formalOpportunityCreated: false;
  customerContacted: false;
}

/**
 * MarkReg-owned formal business record for the bounded trademark-service loop.
 * This does not establish a universal cross-Product Opportunity service.
 */
export interface FormalTrademarkServiceOpportunity {
  schemaVersion: 1;
  formalTrademarkServiceOpportunityId: FormalTrademarkServiceOpportunityId;
  workspaceId: string;
  version: number;
  owningService: 'MARKREG';
  sourceCandidate: Readonly<ProductLoopExactReference<OpportunityCandidateId>>;
  sourceQualificationDecision: Readonly<
    ProductLoopExactReference<OpportunityQualificationDecisionId>
  >;
  customerId?: MarkOrbitId;
  serviceNeedSummary: string;
  proposedCustomerIntent?: Readonly<CustomerIntent>;
  relationshipModel: RelationshipModel;
  status: 'QUALIFIED' | 'HANDED_OFF_TO_INTAKE' | 'CLOSED';
  intakeId?: MarkOrbitId;
  formalOpportunityFingerprintSha256: string;
  orderCreated: false;
  matterCreated: false;
  paymentCreated: false;
  filingSubmitted: false;
  customerContactedByCreation: false;
  createdAt: string;
  updatedAt: string;
}

/** Prepared handoff envelope; the existing MarkReg intake owner still creates Intake. */
export interface MarkRegIntakeHandoff {
  schemaVersion: 1;
  workspaceId: string;
  formalOpportunity: Readonly<ProductLoopExactReference<FormalTrademarkServiceOpportunityId>>;
  expectedFormalOpportunityFingerprintSha256: string;
  target: 'MARKREG_INTAKE';
  channel: 'LITE_PROFESSIONAL';
  relationshipModel: RelationshipModel;
  customerIntent: Readonly<CustomerIntent>;
  /** Authoritative Core WorkspacePrincipal.userId. */
  confirmedByPrincipalId: string;
  confirmedAt: string;
  intakeCreated: false;
  orderCreated: false;
  matterCreated: false;
}

export interface ProductLoopAuthorityConsequences {
  externalPublishExecuted: false;
  customerContactedAutomatically: false;
  formalOpportunityCreatedAutomatically: false;
  orderCreatedAutomatically: false;
  matterCreatedAutomatically: false;
  paymentCreated: false;
  providerAppointed: false;
  filingSubmitted: false;
  officialTruthCreated: false;
}

export const noAutomaticProductLoopConsequences: ProductLoopAuthorityConsequences = Object.freeze({
  externalPublishExecuted: false,
  customerContactedAutomatically: false,
  formalOpportunityCreatedAutomatically: false,
  orderCreatedAutomatically: false,
  matterCreatedAutomatically: false,
  paymentCreated: false,
  providerAppointed: false,
  filingSubmitted: false,
  officialTruthCreated: false
});

export const noClientNotificationPreparationAuthorityConsequencesV1 = Object.freeze({
  externalMessageSent: false,
  externalActionAuthorized: false,
  customerContactAuthorized: false,
  customerReceived: false,
  customerRead: false,
  customerResponded: false,
  legalNoticeEffective: false,
  relatedBusinessStateMutated: false,
  productLoop: noAutomaticProductLoopConsequences
}) satisfies Readonly<ClientNotificationPreparationAuthorityConsequencesV1>;

export const productLoopAiAuthority = Object.freeze({
  mayExplain: true,
  mayRecommend: true,
  mayDraftContent: true,
  mayPrepareCandidate: true,
  mayConfirmForUser: false,
  mayApproveContent: false,
  mayPublishExternally: false,
  mayContactCustomer: false,
  mayQualifyOpportunity: false,
  mayCreateFormalOpportunity: false,
  mayCreateOrderOrMatter: false,
  mayExecuteProtectedAction: false
} as const);

export const productLoopErrorCodes = [
  'STALE_SOURCE',
  'SOURCE_VERSION_MISMATCH',
  'SOURCE_FINGERPRINT_MISMATCH',
  'PERMISSION_DENIED',
  'POLICY_DENIED',
  'CONFIRMATION_REQUIRED',
  'HUMAN_REVIEW_REQUIRED',
  'CANDIDATE_NOT_QUALIFIED',
  'IDEMPOTENCY_CONFLICT',
  'VERSION_CONFLICT',
  'PERSISTENCE_UNAVAILABLE',
  'DEPENDENCY_UNAVAILABLE'
] as const;
export type ProductLoopErrorCode = (typeof productLoopErrorCodes)[number];
