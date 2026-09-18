import { createHash, randomUUID } from 'node:crypto';
import {
  assertEmailCampaignSendIntentV1,
  assertTradingListingPublicationIntentV1,
  type CoreHumanActionReceiptBindingV1,
  type EmailCampaignSendCurrentnessV1,
  type EmailCampaignSendIntentV1,
  type ProtectedExternalActionAuthorizationId,
  type ProtectedExternalActionAuthorizationStatusV1,
  type ProtectedExternalActionAuthorizationV1,
  type ProtectedExternalActionReleaseV1,
  type TradingListingPublicationCurrentnessV1,
  type TradingListingPublicationIntentV1
} from '@markorbit/contracts';

export type ProtectedExternalActionErrorCode =
  | 'INVALID_REQUEST'
  | 'WORKSPACE_MISMATCH'
  | 'HUMAN_RECEIPT_STALE'
  | 'HUMAN_RECEIPT_UNAVAILABLE'
  | 'TRADING_INTENT_STALE'
  | 'TRADING_INTENT_REVOKED'
  | 'TRADING_INTENT_UNKNOWN'
  | 'TRADING_INTENT_UNAVAILABLE'
  | 'EMAIL_CAMPAIGN_INTENT_STALE'
  | 'EMAIL_CAMPAIGN_INTENT_REVOKED'
  | 'EMAIL_CAMPAIGN_INTENT_SUPPRESSED'
  | 'EMAIL_CAMPAIGN_INTENT_UNKNOWN'
  | 'EMAIL_CAMPAIGN_INTENT_UNAVAILABLE'
  | 'AUTHORIZATION_NOT_FOUND'
  | 'AUTHORIZATION_STALE'
  | 'AUTHORIZATION_REVOKED'
  | 'AUTHORIZATION_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RELEASE_ALREADY_EXISTS'
  | 'PERSISTENCE_UNAVAILABLE';

export class ProtectedExternalActionError extends Error {
  constructor(
    readonly code: ProtectedExternalActionErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProtectedExternalActionError';
  }
}

export interface ProtectedActionCommandEntry<T> {
  requestFingerprint: string;
  result: T;
}

export interface ProtectedExternalActionRepository {
  findAuthorizationByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<ProtectedActionCommandEntry<ProtectedExternalActionAuthorizationV1> | undefined>;
  createAuthorization(
    authorization: Readonly<ProtectedExternalActionAuthorizationV1>,
    requestFingerprint: string
  ): Promise<ProtectedExternalActionAuthorizationV1>;
  findAuthorization(
    workspaceId: string,
    authorizationId: ProtectedExternalActionAuthorizationId
  ): Promise<ProtectedExternalActionAuthorizationV1 | undefined>;
  updateAuthorizationStatus(
    workspaceId: string,
    authorizationId: ProtectedExternalActionAuthorizationId,
    status: ProtectedExternalActionAuthorizationStatusV1
  ): Promise<void>;
  findReleaseByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<ProtectedActionCommandEntry<ProtectedExternalActionReleaseV1> | undefined>;
  createRelease(
    release: Readonly<ProtectedExternalActionReleaseV1>,
    requestFingerprint: string
  ): Promise<ProtectedExternalActionReleaseV1>;
}

export interface CoreHumanReceiptCurrentnessClient {
  validateCurrent(receipt: Readonly<CoreHumanActionReceiptBindingV1>): Promise<void>;
}

export interface TradingPublicationCurrentnessClient {
  validateCurrent(
    intent: Readonly<TradingListingPublicationIntentV1>
  ): Promise<TradingListingPublicationCurrentnessV1>;
}

export interface EmailCampaignSendCurrentnessClient {
  validateCurrent(
    intent: Readonly<EmailCampaignSendIntentV1>
  ): Promise<EmailCampaignSendCurrentnessV1>;
}

export interface AuthorizeTradingListingPublishCommand {
  workspaceId: string;
  actorUserId: string;
  intent: Readonly<TradingListingPublicationIntentV1>;
  humanReceipt: Readonly<CoreHumanActionReceiptBindingV1>;
  idempotencyKey: string;
}

export interface ReleaseTradingListingPublishCommand {
  workspaceId: string;
  actorUserId: string;
  authorizationId: ProtectedExternalActionAuthorizationId;
  authorizationVersion: number;
  idempotencyKey: string;
}

export interface AuthorizeEmailCampaignSendCommand {
  workspaceId: string;
  actorUserId: string;
  intent: Readonly<EmailCampaignSendIntentV1>;
  humanReceipt: Readonly<CoreHumanActionReceiptBindingV1>;
  idempotencyKey: string;
}

export interface ReleaseEmailCampaignSendCommand extends ReleaseTradingListingPublishCommand {}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const bounded = (value: string, maximum = 300) =>
  value.trim().length > 0 && value.length <= maximum;

function mapTradingCurrentness(value: Readonly<TradingListingPublicationCurrentnessV1>): void {
  if (value.state === 'CURRENT') return;
  if (value.state === 'REVOKED')
    throw new ProtectedExternalActionError(
      'TRADING_INTENT_REVOKED',
      'Trading publication intent contains a revoked owner binding.'
    );
  if (value.state === 'UNKNOWN')
    throw new ProtectedExternalActionError(
      'TRADING_INTENT_UNKNOWN',
      'Trading publication intent currentness is unknown.'
    );
  if (value.state === 'UNAVAILABLE')
    throw new ProtectedExternalActionError(
      'TRADING_INTENT_UNAVAILABLE',
      'Trading publication currentness source is unavailable.',
      503,
      true
    );
  throw new ProtectedExternalActionError(
    'TRADING_INTENT_STALE',
    'Trading publication intent is stale.'
  );
}

function mapEmailCampaignCurrentness(value: Readonly<EmailCampaignSendCurrentnessV1>): void {
  if (value.state === 'CURRENT') return;
  if (value.state === 'REVOKED')
    throw new ProtectedExternalActionError(
      'EMAIL_CAMPAIGN_INTENT_REVOKED',
      'Email Campaign send intent contains revoked owner state.'
    );
  if (value.state === 'SUPPRESSED')
    throw new ProtectedExternalActionError(
      'EMAIL_CAMPAIGN_INTENT_SUPPRESSED',
      'Email Campaign send intent is currently suppressed.'
    );
  if (value.state === 'UNKNOWN')
    throw new ProtectedExternalActionError(
      'EMAIL_CAMPAIGN_INTENT_UNKNOWN',
      'Email Campaign send currentness is unknown.'
    );
  if (value.state === 'UNAVAILABLE')
    throw new ProtectedExternalActionError(
      'EMAIL_CAMPAIGN_INTENT_UNAVAILABLE',
      'Email Campaign send currentness source is unavailable.',
      503,
      true
    );
  throw new ProtectedExternalActionError(
    'EMAIL_CAMPAIGN_INTENT_STALE',
    'Email Campaign send intent is stale.'
  );
}

function assertReceipt(
  receipt: Readonly<CoreHumanActionReceiptBindingV1>,
  command: Readonly<{
    workspaceId: string;
    actorUserId: string;
    idempotencyKey: string;
  }>,
  expected: Readonly<{
    kind: CoreHumanActionReceiptBindingV1['kind'];
    mutationRoute: CoreHumanActionReceiptBindingV1['mutationRoute'];
    reviewedActionDigest?: string;
  }>
): void {
  if (
    receipt.schemaVersion !== 1 ||
    receipt.receiptVersion !== 1 ||
    receipt.source !== 'CORE' ||
    receipt.actorKind !== 'HUMAN_USER' ||
    receipt.kind !== expected.kind ||
    receipt.mutationRoute !== expected.mutationRoute ||
    receipt.workspaceId !== command.workspaceId ||
    receipt.userId !== command.actorUserId ||
    receipt.idempotencyKey !== command.idempotencyKey ||
    !bounded(receipt.receiptId) ||
    !bounded(receipt.membershipId) ||
    !/^[0-9a-f]{64}$/u.test(receipt.reviewedActionDigest) ||
    (expected.reviewedActionDigest !== undefined &&
      receipt.reviewedActionDigest !== expected.reviewedActionDigest)
  )
    throw new ProtectedExternalActionError(
      'HUMAN_RECEIPT_STALE',
      'Core HUMAN_USER receipt does not match the exact protected action.'
    );
}

export class InMemoryProtectedExternalActionRepository implements ProtectedExternalActionRepository {
  private readonly authorizations = new Map<string, ProtectedExternalActionAuthorizationV1>();
  private readonly authorizationCommands = new Map<
    string,
    ProtectedActionCommandEntry<ProtectedExternalActionAuthorizationV1>
  >();
  private readonly releases = new Map<string, ProtectedExternalActionReleaseV1>();
  private readonly releaseCommands = new Map<
    string,
    ProtectedActionCommandEntry<ProtectedExternalActionReleaseV1>
  >();

  private key(workspaceId: string, value: string) {
    return `${workspaceId}:${value}`;
  }
  findAuthorizationByIdempotencyKey(workspaceId: string, idempotencyKey: string) {
    return Promise.resolve(
      structuredClone(this.authorizationCommands.get(this.key(workspaceId, idempotencyKey)))
    );
  }
  createAuthorization(
    authorization: Readonly<ProtectedExternalActionAuthorizationV1>,
    requestFingerprint: string
  ) {
    const record = structuredClone(authorization);
    this.authorizations.set(this.key(record.workspaceId, record.authorizationId), record);
    this.authorizationCommands.set(this.key(record.workspaceId, record.idempotencyKey), {
      requestFingerprint,
      result: record
    });
    return Promise.resolve(structuredClone(record));
  }
  findAuthorization(workspaceId: string, authorizationId: ProtectedExternalActionAuthorizationId) {
    return Promise.resolve(
      structuredClone(this.authorizations.get(this.key(workspaceId, authorizationId)))
    );
  }
  updateAuthorizationStatus(
    workspaceId: string,
    authorizationId: ProtectedExternalActionAuthorizationId,
    status: ProtectedExternalActionAuthorizationStatusV1
  ) {
    const key = this.key(workspaceId, authorizationId);
    const value = this.authorizations.get(key);
    if (value) this.authorizations.set(key, { ...value, authorizationStatus: status });
    return Promise.resolve();
  }
  findReleaseByIdempotencyKey(workspaceId: string, idempotencyKey: string) {
    return Promise.resolve(
      structuredClone(this.releaseCommands.get(this.key(workspaceId, idempotencyKey)))
    );
  }
  createRelease(release: Readonly<ProtectedExternalActionReleaseV1>, requestFingerprint: string) {
    const record = structuredClone(release);
    const existing = [...this.releases.values()].find(
      (value) =>
        value.workspaceId === record.workspaceId &&
        value.authorization.id === record.authorization.id &&
        value.authorization.version === record.authorization.version
    );
    if (existing)
      throw new ProtectedExternalActionError(
        'RELEASE_ALREADY_EXISTS',
        'This exact authorization already has an immutable release.'
      );
    this.releases.set(this.key(record.workspaceId, record.releaseId), record);
    this.releaseCommands.set(this.key(record.workspaceId, record.idempotencyKey), {
      requestFingerprint,
      result: record
    });
    return Promise.resolve(structuredClone(record));
  }
}

export class ProtectedExternalActionService {
  constructor(
    private readonly repository: ProtectedExternalActionRepository,
    private readonly core: CoreHumanReceiptCurrentnessClient,
    private readonly trading: TradingPublicationCurrentnessClient,
    private readonly clock: () => Date = () => new Date(),
    private readonly authorizationTtlMs = 15 * 60_000,
    private readonly emailCampaign?: EmailCampaignSendCurrentnessClient
  ) {}

  async authorize(
    command: Readonly<AuthorizeTradingListingPublishCommand>
  ): Promise<ProtectedExternalActionAuthorizationV1> {
    if (!bounded(command.idempotencyKey, 256))
      throw new ProtectedExternalActionError(
        'INVALID_REQUEST',
        'Idempotency key is required.',
        400
      );
    try {
      assertTradingListingPublicationIntentV1(command.intent);
    } catch (cause) {
      throw new ProtectedExternalActionError(
        'INVALID_REQUEST',
        'Trading intent is invalid.',
        400,
        false,
        {
          cause: cause instanceof Error ? cause : undefined
        }
      );
    }
    if (command.intent.workspaceId !== command.workspaceId)
      throw new ProtectedExternalActionError(
        'WORKSPACE_MISMATCH',
        'Trading intent Workspace does not match the trusted Workspace.',
        403
      );
    assertReceipt(command.humanReceipt, command, {
      kind: 'TRADING_LISTING_PUBLISH',
      mutationRoute:
        '/api/execution/protected-external-actions/trading-listing-publish/authorizations'
    });
    const requestFingerprint = digest({
      workspaceId: command.workspaceId,
      actorUserId: command.actorUserId,
      intent: command.intent,
      humanReceipt: command.humanReceipt
    });
    const replay = await this.repository.findAuthorizationByIdempotencyKey(
      command.workspaceId,
      command.idempotencyKey
    );
    if (replay) {
      if (replay.requestFingerprint !== requestFingerprint)
        throw new ProtectedExternalActionError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was used with a different protected action intent.'
        );
      return replay.result;
    }
    await this.core.validateCurrent(command.humanReceipt);
    mapTradingCurrentness(await this.trading.validateCurrent(command.intent));
    const authorizedAt = this.clock().toISOString();
    const authorization: ProtectedExternalActionAuthorizationV1 = {
      schemaVersion: 1,
      authorizationId: `protected-action-authorization_${randomUUID()}`,
      version: 1,
      workspaceId: command.workspaceId,
      actionKind: 'TRADING_LISTING_PUBLISH',
      intent: structuredClone(command.intent),
      effectFingerprintSha256: command.intent.effectFingerprintSha256,
      humanReceipt: structuredClone(command.humanReceipt),
      authorizationStatus: 'AUTHORIZED',
      authorizedByUserId: command.actorUserId,
      authorizedAt,
      expiresAt: new Date(Date.parse(authorizedAt) + this.authorizationTtlMs).toISOString(),
      lastValidatedAt: authorizedAt,
      idempotencyKey: command.idempotencyKey
    };
    return this.repository.createAuthorization(authorization, requestFingerprint);
  }

  async release(
    command: Readonly<ReleaseTradingListingPublishCommand>
  ): Promise<ProtectedExternalActionReleaseV1> {
    if (!bounded(command.idempotencyKey, 256) || command.authorizationVersion !== 1)
      throw new ProtectedExternalActionError(
        'INVALID_REQUEST',
        'Exact release binding is required.',
        400
      );
    const requestFingerprint = digest(command);
    const replay = await this.repository.findReleaseByIdempotencyKey(
      command.workspaceId,
      command.idempotencyKey
    );
    if (replay) {
      if (replay.requestFingerprint !== requestFingerprint)
        throw new ProtectedExternalActionError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was used with a different release intent.'
        );
      return replay.result;
    }
    const authorization = await this.repository.findAuthorization(
      command.workspaceId,
      command.authorizationId
    );
    if (!authorization)
      throw new ProtectedExternalActionError(
        'AUTHORIZATION_NOT_FOUND',
        'Protected action authorization was not found.',
        404
      );
    if (authorization.workspaceId !== command.workspaceId)
      throw new ProtectedExternalActionError(
        'WORKSPACE_MISMATCH',
        'Authorization Workspace mismatch.',
        403
      );
    if (authorization.actionKind !== 'TRADING_LISTING_PUBLISH')
      throw new ProtectedExternalActionError(
        'AUTHORIZATION_STALE',
        'Authorization action kind does not match Trading publish.'
      );
    if (authorization.version !== command.authorizationVersion)
      throw new ProtectedExternalActionError(
        'AUTHORIZATION_STALE',
        'Authorization version is not exact and current.'
      );
    if (authorization.authorizationStatus === 'REVOKED')
      throw new ProtectedExternalActionError('AUTHORIZATION_REVOKED', 'Authorization is revoked.');
    if (
      authorization.authorizationStatus === 'EXPIRED' ||
      Date.parse(authorization.expiresAt) <= this.clock().getTime()
    ) {
      await this.repository.updateAuthorizationStatus(
        command.workspaceId,
        command.authorizationId,
        'EXPIRED'
      );
      throw new ProtectedExternalActionError('AUTHORIZATION_EXPIRED', 'Authorization is expired.');
    }
    await this.core.validateCurrent(authorization.humanReceipt);
    mapTradingCurrentness(await this.trading.validateCurrent(authorization.intent));
    const release: ProtectedExternalActionReleaseV1 = {
      schemaVersion: 1,
      releaseId: `protected-action-release_${randomUUID()}`,
      version: 1,
      workspaceId: command.workspaceId,
      actionKind: 'TRADING_LISTING_PUBLISH',
      authorization: { id: authorization.authorizationId, version: authorization.version },
      effectFingerprintSha256: authorization.effectFingerprintSha256,
      status: 'RELEASED_FOR_EXECUTION',
      releasedByUserId: command.actorUserId,
      releasedAt: this.clock().toISOString(),
      idempotencyKey: command.idempotencyKey
    };
    return this.repository.createRelease(release, requestFingerprint);
  }

  async authorizeEmailCampaignSend(
    command: Readonly<AuthorizeEmailCampaignSendCommand>
  ): Promise<ProtectedExternalActionAuthorizationV1> {
    if (!bounded(command.idempotencyKey, 256))
      throw new ProtectedExternalActionError(
        'INVALID_REQUEST',
        'Idempotency key is required.',
        400
      );
    try {
      assertEmailCampaignSendIntentV1(command.intent);
    } catch (cause) {
      throw new ProtectedExternalActionError(
        'INVALID_REQUEST',
        'Email Campaign send intent is invalid.',
        400,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (command.intent.workspaceId !== command.workspaceId)
      throw new ProtectedExternalActionError(
        'WORKSPACE_MISMATCH',
        'Email Campaign send intent Workspace does not match the trusted Workspace.',
        403
      );
    const reviewedActionDigest = digest(command.intent);
    assertReceipt(command.humanReceipt, command, {
      kind: 'EMAIL_CAMPAIGN_SEND',
      mutationRoute:
        '/api/execution/protected-external-actions/email-campaign-send/authorizations',
      reviewedActionDigest
    });
    const requestFingerprint = digest({
      workspaceId: command.workspaceId,
      actorUserId: command.actorUserId,
      intent: command.intent,
      humanReceipt: command.humanReceipt
    });
    const replay = await this.repository.findAuthorizationByIdempotencyKey(
      command.workspaceId,
      command.idempotencyKey
    );
    if (replay) {
      if (replay.requestFingerprint !== requestFingerprint)
        throw new ProtectedExternalActionError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was used with a different protected action intent.'
        );
      if (replay.result.actionKind !== 'EMAIL_CAMPAIGN_SEND')
        throw new ProtectedExternalActionError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was already used by another protected action kind.'
        );
      return replay.result;
    }
    if (!this.emailCampaign)
      throw new ProtectedExternalActionError(
        'EMAIL_CAMPAIGN_INTENT_UNAVAILABLE',
        'Email Campaign send currentness client is unavailable.',
        503,
        true
      );
    await this.core.validateCurrent(command.humanReceipt);
    const currentness = await this.emailCampaign.validateCurrent(command.intent);
    if (
      currentness.workspaceId !== command.workspaceId ||
      currentness.actionKind !== 'EMAIL_CAMPAIGN_SEND' ||
      currentness.effectFingerprintSha256 !== command.intent.effectFingerprintSha256 ||
      currentness.deliveryPlanFingerprintSha256 !==
        command.intent.deliveryPlanFingerprintSha256
    )
      throw new ProtectedExternalActionError(
        'EMAIL_CAMPAIGN_INTENT_STALE',
        'Email Campaign currentness response does not bind the exact delivery intent.'
      );
    mapEmailCampaignCurrentness(currentness);
    const authorizedAt = this.clock().toISOString();
    const authorization: ProtectedExternalActionAuthorizationV1 = {
      schemaVersion: 1,
      authorizationId: `protected-action-authorization_${randomUUID()}`,
      version: 1,
      workspaceId: command.workspaceId,
      actionKind: 'EMAIL_CAMPAIGN_SEND',
      intent: structuredClone(command.intent),
      effectFingerprintSha256: command.intent.effectFingerprintSha256,
      humanReceipt: structuredClone(command.humanReceipt),
      authorizationStatus: 'AUTHORIZED',
      authorizedByUserId: command.actorUserId,
      authorizedAt,
      expiresAt: new Date(Date.parse(authorizedAt) + this.authorizationTtlMs).toISOString(),
      lastValidatedAt: authorizedAt,
      idempotencyKey: command.idempotencyKey
    };
    return this.repository.createAuthorization(authorization, requestFingerprint);
  }

  async releaseEmailCampaignSend(
    command: Readonly<ReleaseEmailCampaignSendCommand>
  ): Promise<ProtectedExternalActionReleaseV1> {
    if (!bounded(command.idempotencyKey, 256) || command.authorizationVersion !== 1)
      throw new ProtectedExternalActionError(
        'INVALID_REQUEST',
        'Exact release binding is required.',
        400
      );
    const requestFingerprint = digest(command);
    const replay = await this.repository.findReleaseByIdempotencyKey(
      command.workspaceId,
      command.idempotencyKey
    );
    if (replay) {
      if (replay.requestFingerprint !== requestFingerprint)
        throw new ProtectedExternalActionError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was used with a different release intent.'
        );
      if (replay.result.actionKind !== 'EMAIL_CAMPAIGN_SEND')
        throw new ProtectedExternalActionError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was already used by another protected action kind.'
        );
      return replay.result;
    }
    const authorization = await this.repository.findAuthorization(
      command.workspaceId,
      command.authorizationId
    );
    if (!authorization)
      throw new ProtectedExternalActionError(
        'AUTHORIZATION_NOT_FOUND',
        'Protected action authorization was not found.',
        404
      );
    if (authorization.actionKind !== 'EMAIL_CAMPAIGN_SEND')
      throw new ProtectedExternalActionError(
        'AUTHORIZATION_STALE',
        'Authorization action kind does not match Email Campaign send.'
      );
    if (authorization.version !== command.authorizationVersion)
      throw new ProtectedExternalActionError(
        'AUTHORIZATION_STALE',
        'Authorization version is not exact and current.'
      );
    if (authorization.authorizationStatus === 'REVOKED')
      throw new ProtectedExternalActionError(
        'AUTHORIZATION_REVOKED',
        'Authorization is revoked.'
      );
    if (
      authorization.authorizationStatus === 'EXPIRED' ||
      Date.parse(authorization.expiresAt) <= this.clock().getTime()
    ) {
      await this.repository.updateAuthorizationStatus(
        command.workspaceId,
        command.authorizationId,
        'EXPIRED'
      );
      throw new ProtectedExternalActionError(
        'AUTHORIZATION_EXPIRED',
        'Authorization is expired.'
      );
    }
    if (!this.emailCampaign)
      throw new ProtectedExternalActionError(
        'EMAIL_CAMPAIGN_INTENT_UNAVAILABLE',
        'Email Campaign send currentness client is unavailable.',
        503,
        true
      );
    await this.core.validateCurrent(authorization.humanReceipt);
    const currentness = await this.emailCampaign.validateCurrent(authorization.intent);
    if (
      currentness.workspaceId !== authorization.workspaceId ||
      currentness.effectFingerprintSha256 !== authorization.effectFingerprintSha256 ||
      currentness.deliveryPlanFingerprintSha256 !==
        authorization.intent.deliveryPlanFingerprintSha256
    )
      throw new ProtectedExternalActionError(
        'EMAIL_CAMPAIGN_INTENT_STALE',
        'Email Campaign currentness response does not bind the exact authorization.'
      );
    mapEmailCampaignCurrentness(currentness);
    const release: ProtectedExternalActionReleaseV1 = {
      schemaVersion: 1,
      releaseId: `protected-action-release_${randomUUID()}`,
      version: 1,
      workspaceId: command.workspaceId,
      actionKind: 'EMAIL_CAMPAIGN_SEND',
      authorization: {
        id: authorization.authorizationId,
        version: authorization.version
      },
      effectFingerprintSha256: authorization.effectFingerprintSha256,
      status: 'RELEASED_FOR_EXECUTION',
      releasedByUserId: command.actorUserId,
      releasedAt: this.clock().toISOString(),
      idempotencyKey: command.idempotencyKey
    };
    return this.repository.createRelease(release, requestFingerprint);
  }

}
