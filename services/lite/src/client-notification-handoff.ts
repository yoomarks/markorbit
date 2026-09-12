import { createHash } from 'node:crypto';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CommunicationLinkTargetReferenceV1 } from '@markorbit/contracts/communication-link';
import type { LiteWorkItemId, LiteWorkItemV1 } from '@markorbit/contracts/lite-work-item';
import type {
  ManagedCommunicationAttachmentRefV1,
  ManagedCommunicationParticipantV1
} from '@markorbit/contracts/managed-communication';
import {
  assertClientNotificationPreparedActionConfirmationV1,
  type ClientNotificationHandoffPlanV1,
  type PreparedAction,
  type PreparedActionConfirmation,
  type PreparedActionHandoffResult
} from '@markorbit/contracts/product-loop';
import type { TrademarkAssetId } from '@markorbit/contracts/trademark-asset-workspace';
import type { WorkspaceDirectoryEntryV1 } from '@markorbit/contracts/workspace-directory';
import type { ReviewedTrademarkServiceCommunicationDraftSnapshot } from './trademark-service-work-package.js';
import {
  handoffResult,
  PreparedActionJourneyError,
  type PreparedActionPlan
} from './prepared-action.js';
export interface ClientNotificationDraftReader {
  getCurrentReviewedCommunicationDraft(
    workspaceId: string,
    workPackageId: string,
    preparationId: string
  ): Promise<ReviewedTrademarkServiceCommunicationDraftSnapshot>;
  getReviewedCommunicationDraftVersion(
    workspaceId: string,
    workPackageId: string,
    version: number,
    preparationId: string
  ): Promise<ReviewedTrademarkServiceCommunicationDraftSnapshot>;
}

export interface ClientNotificationDirectoryReader {
  getExact(
    workspaceId: string,
    entryId: `workspace-directory-entry_${string}`,
    version: number
  ): Promise<WorkspaceDirectoryEntryV1 | undefined>;
  getLatest(
    workspaceId: string,
    entryId: `workspace-directory-entry_${string}`
  ): Promise<WorkspaceDirectoryEntryV1 | undefined>;
}
export interface ClientNotificationWorkItemReader {
  get(workspaceId: string, workItemId: LiteWorkItemId): Promise<LiteWorkItemV1 | undefined>;
}

export interface ClientNotificationBusinessReferenceValidator {
  validate(
    principal: Readonly<WorkspacePrincipal>,
    target: Readonly<CommunicationLinkTargetReferenceV1>
  ): Promise<void>;
}

export interface ManagedCommunicationClientNotificationSendRequestV1 {
  schemaVersion: 1;
  accountRef: string;
  channel: 'EMAIL';
  participants: readonly Readonly<ManagedCommunicationParticipantV1>[];
  subject: string;
  textBody: string;
  attachments: readonly Readonly<ManagedCommunicationAttachmentRefV1>[];
}

export interface ManagedCommunicationClientNotificationSendReceiptV1 {
  schemaVersion: 1;
  sendId: string;
  workspaceId: string;
  accountRef: string;
  idempotencyKeySha256: string;
  requestFingerprintSha256: string;
  state: 'SENT';
  messageId: string;
  threadRef: string;
  provider: string;
  providerMessageId: string;
  providerThreadId?: string;
  providerReceiptRef: string;
  acceptedAt: string;
  authority: Readonly<{
    externalMessageSent: true;
    customerTruthMutated: false;
    matterTruthMutated: false;
    legalTruthCreated: false;
    knowledgeApproved: false;
    professionalDecisionCreated: false;
  }>;
}

export interface ManagedCommunicationClientNotificationSendCommandV1 {
  workspaceId: string;
  idempotencyKey: string;
  correlationId: string;
  request: Readonly<ManagedCommunicationClientNotificationSendRequestV1>;
}

export interface ManagedCommunicationClientNotificationSender {
  send(
    input: Readonly<ManagedCommunicationClientNotificationSendCommandV1>
  ): Promise<Readonly<ManagedCommunicationClientNotificationSendReceiptV1>>;
}
interface Fetcher {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, stable(item)])
        )
      : value;

function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

export function clientNotificationManagedCommunicationSendCommandV1(
  action: Readonly<PreparedAction>,
  plan: Readonly<ClientNotificationHandoffPlanV1>,
  handoffIdempotencyKey: string
): Readonly<ManagedCommunicationClientNotificationSendCommandV1> {
  const sendIdentitySha256 = digest({
    workspaceId: plan.workspaceId,
    preparedActionId: action.preparedActionId,
    preparedActionVersion: action.version,
    confirmationFingerprintSha256: plan.confirmationFingerprintSha256,
    handoffIdempotencyKey
  });
  return Object.freeze({
    workspaceId: plan.workspaceId,
    idempotencyKey: `client-notification:${action.preparedActionId}:${sendIdentitySha256}`,
    correlationId: `client-notification:${sendIdentitySha256}`,
    request: Object.freeze({
      schemaVersion: 1 as const,
      accountRef: plan.accountRef,
      channel: 'EMAIL' as const,
      participants: [plan.sender, ...plan.recipients.map(({ participant }) => participant)],
      subject: plan.subject,
      textBody: plan.body,
      attachments: plan.attachments
    })
  });
}

function same(left: unknown, right: unknown): boolean {
  return digest(left) === digest(right);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function stale(message: string): never {
  throw new PreparedActionJourneyError('STALE_SOURCE', message, 409);
}

function policy(message: string): never {
  throw new PreparedActionJourneyError('POLICY_DENIED', message, 422);
}

function dependency(
  message: string,
  details?: Readonly<Record<string, unknown>>,
  cause?: Error
): never {
  throw new PreparedActionJourneyError(
    'DEPENDENCY_UNAVAILABLE',
    message,
    503,
    details,
    cause ? { cause } : undefined
  );
}

function reconciliation(message: string, ownerCode: string): never {
  throw new PreparedActionJourneyError('RECONCILIATION_REQUIRED', message, 409, {
    confirmationPersisted: true,
    handoffPending: true,
    reconciliationRequired: true,
    ownerCode
  });
}

function exactWorkPackageVersion(plan: Readonly<ClientNotificationHandoffPlanV1>): number {
  const version = plan.sourceDraft.workPackage.version;
  if (!Number.isSafeInteger(version) || Number(version) < 1)
    return policy('Client-notification source Work Package must use an exact numeric version.');
  return Number(version);
}
function sentReceipt(value: unknown): ManagedCommunicationClientNotificationSendReceiptV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return dependency('Managed Communication send owner returned an invalid receipt.');
  const receipt = value as Record<string, unknown>;
  const authority = receipt.authority as Record<string, unknown> | undefined;
  if (
    receipt.schemaVersion !== 1 ||
    receipt.state !== 'SENT' ||
    !nonEmpty(receipt.sendId) ||
    !nonEmpty(receipt.workspaceId) ||
    !nonEmpty(receipt.accountRef) ||
    !nonEmpty(receipt.messageId) ||
    !nonEmpty(receipt.threadRef) ||
    !nonEmpty(receipt.provider) ||
    !nonEmpty(receipt.providerMessageId) ||
    !nonEmpty(receipt.providerReceiptRef) ||
    !nonEmpty(receipt.acceptedAt) ||
    typeof receipt.idempotencyKeySha256 !== 'string' ||
    !SHA256.test(receipt.idempotencyKeySha256) ||
    typeof receipt.requestFingerprintSha256 !== 'string' ||
    !SHA256.test(receipt.requestFingerprintSha256) ||
    Number.isNaN(new Date(String(receipt.acceptedAt)).getTime()) ||
    !authority
  )
    return dependency('Managed Communication send owner returned an invalid receipt.');
  if (
    authority.externalMessageSent !== true ||
    authority.customerTruthMutated !== false ||
    authority.matterTruthMutated !== false ||
    authority.legalTruthCreated !== false ||
    authority.knowledgeApproved !== false ||
    authority.professionalDecisionCreated !== false
  )
    return dependency('Managed Communication send owner returned invalid authority evidence.');
  return value as ManagedCommunicationClientNotificationSendReceiptV1;
}

function errorPayload(value: unknown): { code?: string; message?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    ...(typeof record.code === 'string' ? { code: record.code } : {}),
    ...(typeof record.message === 'string' ? { message: record.message } : {})
  };
}

export class HttpManagedCommunicationClientNotificationSender implements ManagedCommunicationClientNotificationSender {
  constructor(
    private readonly capabilityEngineUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: Fetcher = fetch
  ) {}
  async send(
    input: Readonly<{
      workspaceId: string;
      idempotencyKey: string;
      correlationId: string;
      request: Readonly<ManagedCommunicationClientNotificationSendRequestV1>;
    }>
  ): Promise<Readonly<ManagedCommunicationClientNotificationSendReceiptV1>> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.capabilityEngineUrl.replace(/\/$/u, '')}/internal/v1/managed-communication/sends`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-workspace-id': input.workspaceId,
            'idempotency-key': input.idempotencyKey,
            'x-correlation-id': input.correlationId
          },
          body: JSON.stringify(input.request)
        }
      );
    } catch (cause) {
      return dependency(
        'Managed Communication send owner is unavailable.',
        { confirmationPersisted: true, handoffPending: true },
        cause instanceof Error ? cause : undefined
      );
    }
    if (!response.ok) {
      const payload = errorPayload(await response.json().catch(() => undefined));
      if (payload.code === 'RECONCILIATION_REQUIRED' || payload.code === 'SEND_IN_PROGRESS')
        return reconciliation(
          'Managed Communication send may already have been dispatched and requires reconciliation.',
          payload.code
        );
      if (payload.code === 'IDEMPOTENCY_CONFLICT')
        throw new PreparedActionJourneyError(
          'IDEMPOTENCY_CONFLICT',
          'Managed Communication rejected the stable client-notification send identity.',
          409
        );
      if (response.status === 404)
        return stale('The configured Managed Communication account is no longer current.');
      if (response.status >= 500)
        return dependency('Managed Communication send owner is unavailable.', {
          confirmationPersisted: true,
          handoffPending: true
        });
      return policy('Managed Communication rejected the frozen client-notification send request.');
    }
    return sentReceipt(await response.json().catch(() => undefined));
  }
}
export interface ClientNotificationTrademarkAssetReader {
  get(
    workspaceId: string,
    trademarkAssetId: TrademarkAssetId
  ): Promise<Readonly<{ version: number | string }>>;
}

export interface ClientNotificationMarkRegTargetReader {
  validate(
    principal: Readonly<WorkspacePrincipal>,
    target: Readonly<CommunicationLinkTargetReferenceV1>
  ): Promise<void>;
}

export class ProductionClientNotificationBusinessReferenceValidator implements ClientNotificationBusinessReferenceValidator {
  constructor(
    private readonly directory: ClientNotificationDirectoryReader,
    private readonly trademarkAssets: ClientNotificationTrademarkAssetReader,
    private readonly markRegTargets: ClientNotificationMarkRegTargetReader
  ) {}

  async validate(
    principal: Readonly<WorkspacePrincipal>,
    target: Readonly<CommunicationLinkTargetReferenceV1>
  ): Promise<void> {
    if (target.workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
      return stale('Client-notification business reference is outside the current Workspace.');
    if (target.targetKind === 'WORKSPACE_DIRECTORY_ENTRY') {
      const current = await this.directory.getLatest(
        principal.workspaceId,
        target.workspaceDirectoryEntryId
      );
      if (!current || current.version !== target.version || current.status !== 'ACTIVE')
        return stale(
          'Client-notification Workspace Directory business reference is no longer current.'
        );
      return;
    }
    if (target.targetKind === 'TRADEMARK_ASSET') {
      try {
        const asset = await this.trademarkAssets.get(
          principal.workspaceId,
          target.trademarkAssetId
        );
        if (Number(asset.version) !== target.version)
          return stale(
            'Client-notification Trademark Asset business reference is no longer current.'
          );
        return;
      } catch (cause) {
        const code =
          cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : undefined;
        if (code === 'NOT_FOUND')
          return stale('Client-notification Trademark Asset business reference was not found.');
        return dependency(
          'Trademark Asset owner read is unavailable for client-notification validation.',
          undefined,
          cause instanceof Error ? cause : undefined
        );
      }
    }
    await this.markRegTargets.validate(principal, target);
  }
}
export class ClientNotificationPreparedActionHandoff {
  constructor(
    private readonly drafts: ClientNotificationDraftReader,
    private readonly directory: ClientNotificationDirectoryReader,
    private readonly workItems: ClientNotificationWorkItemReader,
    private readonly businessRefs: ClientNotificationBusinessReferenceValidator,
    private readonly sender: ManagedCommunicationClientNotificationSender
  ) {}

  async perform(
    action: Readonly<PreparedAction>,
    localPlan: Readonly<PreparedActionPlan>,
    confirmation: Readonly<PreparedActionConfirmation>,
    handoffIdempotencyKey: string,
    principal?: Readonly<WorkspacePrincipal>
  ): Promise<Readonly<PreparedActionHandoffResult>> {
    let plan: Readonly<ClientNotificationHandoffPlanV1>;
    try {
      plan = assertClientNotificationPreparedActionConfirmationV1(action, confirmation);
    } catch (cause) {
      throw new PreparedActionJourneyError(
        'CONFIRMATION_REQUIRED',
        'Client-notification send requires the exact reviewed Prepared Action confirmation.',
        422,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    this.assertLocalPlan(localPlan, plan);
    await this.assertDraftCurrent(plan);
    await this.assertRecipientsCurrent(plan);
    await this.assertWorkCurrent(plan);
    if (!principal)
      return policy('Client-notification handoff requires the current Workspace principal.');
    if (principal.workspaceId.toLowerCase() !== plan.workspaceId.toLowerCase())
      return stale('Client-notification principal Workspace no longer matches the frozen plan.');
    for (const target of plan.relatedBusinessRefs)
      await this.businessRefs.validate(principal, target);

    const sendCommand = clientNotificationManagedCommunicationSendCommandV1(
      action,
      plan,
      handoffIdempotencyKey
    );
    const receipt = await this.sender.send(sendCommand);
    if (
      receipt.workspaceId.toLowerCase() !== plan.workspaceId.toLowerCase() ||
      receipt.accountRef !== plan.accountRef
    )
      return dependency('Managed Communication receipt does not match the frozen send scope.');
    if (
      receipt.idempotencyKeySha256 !==
      createHash('sha256').update(sendCommand.idempotencyKey).digest('hex')
    )
      return dependency('Managed Communication receipt does not match the stable send identity.');

    return handoffResult({
      preparedAction: action,
      owner: 'MANAGED_COMMUNICATION',
      ownerRecord: { id: receipt.sendId, version: receipt.requestFingerprintSha256 },
      completedAt: receipt.acceptedAt
    });
  }

  private assertLocalPlan(
    localPlan: Readonly<PreparedActionPlan>,
    confirmedPlan: Readonly<ClientNotificationHandoffPlanV1>
  ): void {
    if (
      localPlan.kind !== 'PREPARE_CLIENT_NOTIFICATION' ||
      !same(localPlan.clientNotificationPlan, confirmedPlan)
    )
      return policy(
        'Persisted Prepared Action plan does not match the confirmed client-notification plan.'
      );
  }
  private async assertDraftCurrent(plan: Readonly<ClientNotificationHandoffPlanV1>): Promise<void> {
    const workPackageId = plan.sourceDraft.workPackage.id;
    const version = exactWorkPackageVersion(plan);
    let exact: ReviewedTrademarkServiceCommunicationDraftSnapshot;
    let current: ReviewedTrademarkServiceCommunicationDraftSnapshot;
    try {
      [exact, current] = await Promise.all([
        this.drafts.getReviewedCommunicationDraftVersion(
          plan.workspaceId,
          workPackageId,
          version,
          plan.sourceDraft.preparationId
        ),
        this.drafts.getCurrentReviewedCommunicationDraft(
          plan.workspaceId,
          workPackageId,
          plan.sourceDraft.preparationId
        )
      ]);
    } catch (cause) {
      const code =
        cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : undefined;
      if (code === 'NOT_FOUND')
        return stale('Reviewed client-notification source draft is no longer current.');
      return dependency(
        'Reviewed client-notification source draft owner read is unavailable.',
        undefined,
        cause instanceof Error ? cause : undefined
      );
    }
    if (
      exact.workPackage.version !== version ||
      exact.draftFingerprintSha256 !== plan.sourceDraft.draftFingerprintSha256 ||
      exact.draft.kind !== plan.sourceDraft.draftKind ||
      exact.draft.subject !== plan.subject ||
      exact.draft.body !== plan.body
    )
      return stale('Reviewed client-notification source draft no longer matches the frozen plan.');
    if (
      current.workPackage.version !== version ||
      current.draftFingerprintSha256 !== exact.draftFingerprintSha256 ||
      !same(current.draft, exact.draft)
    )
      return stale('Reviewed client-notification source draft has changed since confirmation.');
  }

  private async assertRecipientsCurrent(
    plan: Readonly<ClientNotificationHandoffPlanV1>
  ): Promise<void> {
    for (const recipient of plan.recipients) {
      if (recipient.source.kind === 'MANUAL_ENTRY') continue;
      const frozen = recipient.source.directoryEntry;
      const [exact, latest] = await Promise.all([
        this.directory.getExact(plan.workspaceId, frozen.workspaceDirectoryEntryId, frozen.version),
        this.directory.getLatest(plan.workspaceId, frozen.workspaceDirectoryEntryId)
      ]);
      if (!exact || !latest)
        return stale('Client-notification Workspace Directory recipient is no longer available.');
      if (
        exact.version !== frozen.version ||
        latest.version !== frozen.version ||
        latest.status !== 'ACTIVE'
      )
        return stale(
          'Client-notification Workspace Directory recipient has changed since confirmation.'
        );
      const frozenContact = recipient.source.contactPoint;
      const exactContact = exact.contactPoints.find((contact) => same(contact, frozenContact));
      const currentContact = latest.contactPoints.find((contact) => same(contact, frozenContact));
      if (!exactContact || !currentContact)
        return stale('Client-notification recipient contact point has changed since confirmation.');
      if (currentContact.value.toLowerCase() !== recipient.participant.address.toLowerCase())
        return stale('Client-notification recipient address no longer matches Directory truth.');
    }
  }

  private async assertWorkCurrent(plan: Readonly<ClientNotificationHandoffPlanV1>): Promise<void> {
    if (!plan.relatedWorkItem) return;
    const current = await this.workItems.get(
      plan.workspaceId,
      plan.relatedWorkItem.workItemId as LiteWorkItemId
    );
    if (!current || current.version !== plan.relatedWorkItem.version)
      return stale('Client-notification related Work Item is no longer current.');
  }
}
