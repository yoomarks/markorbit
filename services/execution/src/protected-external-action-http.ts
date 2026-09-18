import {
  parseInternalWorkspacePrincipal,
  type CoreHumanActionReceiptBindingV1,
  type EmailCampaignSendCurrentnessV1,
  type EmailCampaignSendIntentV1,
  type ProtectedExternalActionAuthorizationId,
  type TradingListingPublicationCurrentnessV1,
  type TradingListingPublicationIntentV1,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ProtectedExternalActionError,
  type CoreHumanReceiptCurrentnessClient,
  type EmailCampaignSendCurrentnessClient,
  type ProtectedExternalActionService,
  type TradingPublicationCurrentnessClient
} from './protected-external-action.js';

function principalOf(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }
  if (!principal.permissions.includes('execution:manage'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'execution:manage permission is required.');
  const workspaceHeader = request.headers['x-markorbit-workspace-id'];
  if (workspaceHeader && workspaceHeader !== principal.workspaceId)
    throw new HttpError(403, 'WORKSPACE_MISMATCH', 'Trusted Workspace contexts do not match.');
  return principal;
}

function bodyOf(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function keyOf(request: JsonRequest): string {
  const key = request.headers['idempotency-key']?.trim();
  if (!key) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return key;
}

function mapError(error: unknown): never {
  if (error instanceof ProtectedExternalActionError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createProtectedExternalActionRoutes(options: {
  internalServiceSecret: string;
  service: Pick<
    ProtectedExternalActionService,
    'authorize' | 'release' | 'authorizeEmailCampaignSend' | 'releaseEmailCampaignSend'
  >;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/protected-external-actions/trading-listing-publish/authorizations',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const body = bodyOf(request);
        if (
          Object.keys(body).some((field) => !['intent', 'humanReceipt'].includes(field)) ||
          !body.intent ||
          !body.humanReceipt
        )
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Only trusted intent and receipt bindings are accepted.'
          );
        try {
          return json(
            201,
            await options.service.authorize({
              workspaceId: principal.workspaceId,
              actorUserId: principal.userId,
              intent: body.intent as TradingListingPublicationIntentV1,
              humanReceipt: body.humanReceipt as CoreHumanActionReceiptBindingV1,
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/protected-external-actions/email-campaign-send/authorizations',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const body = bodyOf(request);
        if (
          Object.keys(body).some((field) => !['intent', 'humanReceipt'].includes(field)) ||
          !body.intent ||
          !body.humanReceipt
        )
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Only trusted intent and receipt bindings are accepted.'
          );
        try {
          return json(
            201,
            await options.service.authorizeEmailCampaignSend({
              workspaceId: principal.workspaceId,
              actorUserId: principal.userId,
              intent: body.intent as EmailCampaignSendIntentV1,
              humanReceipt: body.humanReceipt as CoreHumanActionReceiptBindingV1,
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/protected-external-actions/email-campaign-send/authorizations/:authorizationId/releases',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const body = bodyOf(request);
        if (
          Object.keys(body).some((field) => field !== 'authorizationVersion') ||
          !Number.isSafeInteger(body.authorizationVersion)
        )
          throw new HttpError(400, 'INVALID_REQUEST', 'Exact authorizationVersion is required.');
        try {
          return json(
            201,
            await options.service.releaseEmailCampaignSend({
              workspaceId: principal.workspaceId,
              actorUserId: principal.userId,
              authorizationId: request.params
                .authorizationId as ProtectedExternalActionAuthorizationId,
              authorizationVersion: body.authorizationVersion as number,
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/protected-external-actions/trading-listing-publish/authorizations/:authorizationId/releases',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const body = bodyOf(request);
        if (
          Object.keys(body).some((field) => field !== 'authorizationVersion') ||
          !Number.isSafeInteger(body.authorizationVersion)
        )
          throw new HttpError(400, 'INVALID_REQUEST', 'Exact authorizationVersion is required.');
        try {
          return json(
            201,
            await options.service.release({
              workspaceId: principal.workspaceId,
              actorUserId: principal.userId,
              authorizationId: request.params
                .authorizationId as ProtectedExternalActionAuthorizationId,
              authorizationVersion: body.authorizationVersion as number,
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}

export class HttpCoreHumanReceiptCurrentnessClient implements CoreHumanReceiptCurrentnessClient {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly timeoutMs = 3_000
  ) {}

  async validateCurrent(receipt: Readonly<CoreHumanActionReceiptBindingV1>): Promise<void> {
    let response: Response;
    try {
      response = await fetch(
        `${this.coreUrl}/internal/auth/governed-human-actions/receipts/validate-current`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify({
            receiptId: receipt.receiptId,
            workspaceId: receipt.workspaceId,
            userId: receipt.userId,
            membershipId: receipt.membershipId,
            principalReference: receipt.principalReference,
            kind: receipt.kind,
            mutationRoute: receipt.mutationRoute,
            reviewedActionDigest: receipt.reviewedActionDigest,
            idempotencyKey: receipt.idempotencyKey,
            authenticatedAt: receipt.authenticatedAt
          }),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch (cause) {
      throw new ProtectedExternalActionError(
        'HUMAN_RECEIPT_UNAVAILABLE',
        'Core HUMAN_USER receipt currentness is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (response.ok) return;
    if (response.status >= 500)
      throw new ProtectedExternalActionError(
        'HUMAN_RECEIPT_UNAVAILABLE',
        'Core HUMAN_USER receipt currentness is unavailable.',
        503,
        true
      );
    throw new ProtectedExternalActionError(
      'HUMAN_RECEIPT_STALE',
      'Core HUMAN_USER receipt is expired, revoked, stale, or does not match.'
    );
  }
}

export class HttpTradingPublicationCurrentnessClient implements TradingPublicationCurrentnessClient {
  constructor(
    private readonly liteUrl: string,
    private readonly internalServiceSecret: string,
    private readonly timeoutMs = 3_000
  ) {}

  async validateCurrent(intent: Readonly<TradingListingPublicationIntentV1>) {
    let response: Response;
    try {
      response = await fetch(
        `${this.liteUrl}/internal/trading/listing-publication-intents/validate-current`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-workspace-id': intent.workspaceId
          },
          body: JSON.stringify({ intent, humanReceipt }),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      return {
        schemaVersion: 1,
        workspaceId: intent.workspaceId,
        actionKind: 'TRADING_LISTING_PUBLISH',
        effectFingerprintSha256: intent.effectFingerprintSha256,
        state: 'UNAVAILABLE',
        reason: 'OWNER_UNAVAILABLE'
      } satisfies TradingListingPublicationCurrentnessV1;
    }
    if (!response.ok)
      return {
        schemaVersion: 1,
        workspaceId: intent.workspaceId,
        actionKind: 'TRADING_LISTING_PUBLISH',
        effectFingerprintSha256: intent.effectFingerprintSha256,
        state: 'UNAVAILABLE',
        reason: 'OWNER_UNAVAILABLE'
      } satisfies TradingListingPublicationCurrentnessV1;
    return response.json() as Promise<TradingListingPublicationCurrentnessV1>;
  }
}


export class HttpEmailCampaignSendCurrentnessClient
  implements EmailCampaignSendCurrentnessClient
{
  constructor(
    private readonly liteUrl: string,
    private readonly internalServiceSecret: string,
    private readonly timeoutMs = 3_000
  ) {}

  async validateCurrent(
    intent: Readonly<EmailCampaignSendIntentV1>,
    humanReceipt: Readonly<CoreHumanActionReceiptBindingV1>
  ) {
    let response: Response;
    try {
      response = await fetch(
        `${this.liteUrl}/internal/email-campaigns/send-intents/validate-current`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-workspace-id': intent.workspaceId
          },
          body: JSON.stringify(intent),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      return {
        schemaVersion: 1,
        workspaceId: intent.workspaceId,
        actionKind: 'EMAIL_CAMPAIGN_SEND',
        effectFingerprintSha256: intent.effectFingerprintSha256,
        deliveryPlanFingerprintSha256: intent.deliveryPlanFingerprintSha256,
        state: 'UNAVAILABLE',
        reason: 'OWNER_UNAVAILABLE'
      } satisfies EmailCampaignSendCurrentnessV1;
    }
    if (!response.ok)
      return {
        schemaVersion: 1,
        workspaceId: intent.workspaceId,
        actionKind: 'EMAIL_CAMPAIGN_SEND',
        effectFingerprintSha256: intent.effectFingerprintSha256,
        deliveryPlanFingerprintSha256: intent.deliveryPlanFingerprintSha256,
        state: 'UNAVAILABLE',
        reason: 'OWNER_UNAVAILABLE'
      } satisfies EmailCampaignSendCurrentnessV1;
    return response.json() as Promise<EmailCampaignSendCurrentnessV1>;
  }
}
