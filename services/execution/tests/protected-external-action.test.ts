import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  canonicalTradingListingPublicationIntentPayloadV1,
  type CoreHumanActionReceiptBindingV1,
  type EmailCampaignSendCurrentnessStateV1,
  type EmailCampaignSendIntentV1,
  type TradingListingPublicationCurrentnessStateV1,
  type TradingListingPublicationIntentV1
} from '@markorbit/contracts';
import {
  InMemoryProtectedExternalActionRepository,
  ProtectedExternalActionError,
  ProtectedExternalActionService
} from '../src/protected-external-action.js';

const workspaceId = '018f0000-0000-7000-8000-000000001176';
const otherWorkspaceId = '018f0000-0000-7000-8000-000000001177';
const userId = '018f0000-0000-7000-8000-000000001178';
const unsigned = {
  schemaVersion: 1,
  actionKind: 'TRADING_LISTING_PUBLISH',
  workspaceId,
  listingDraft: { id: 'trading-listing-draft_1176', version: 3 },
  listingReview: { id: 'trading-listing-review_1176', version: 2 },
  listingAssets: [{ id: 'listing-asset_1176', version: 4 }],
  marketplaceTargetBinding: { id: 'trading-marketplace-target-binding_1176', version: 5 },
  effectFingerprintSha256: '0'.repeat(64)
} as TradingListingPublicationIntentV1;
const intent: TradingListingPublicationIntentV1 = {
  ...unsigned,
  effectFingerprintSha256: createHash('sha256')
    .update(JSON.stringify(canonicalTradingListingPublicationIntentPayloadV1(unsigned)))
    .digest('hex')
};
const receipt: CoreHumanActionReceiptBindingV1 = {
  schemaVersion: 1,
  receiptId: '018f0000-0000-7000-8000-000000001179',
  receiptVersion: 1,
  workspaceId,
  userId,
  membershipId: '018f0000-0000-7000-8000-000000001180',
  principalReference: `core-workspace-principal:${'a'.repeat(64)}`,
  kind: 'TRADING_LISTING_PUBLISH',
  mutationRoute: '/api/execution/protected-external-actions/trading-listing-publish/authorizations',
  reviewedActionDigest: 'b'.repeat(64),
  idempotencyKey: 'authorize-1176',
  authenticatedAt: '2026-09-17T00:00:00.000Z',
  authorityReference: 'core-governed-human-action-receipt:1176',
  authorityVersion: 1,
  affirmativeHumanActionEvidenceReference: 'core-governed-human-action-evidence:1176',
  source: 'CORE',
  actorKind: 'HUMAN_USER',
  workspaceVersion: 1,
  userVersion: 1,
  membershipVersion: 1,
  createdAt: '2026-09-17T00:00:00.000Z'
};

function harness(state: TradingListingPublicationCurrentnessStateV1 = 'CURRENT') {
  const repository = new InMemoryProtectedExternalActionRepository();
  const core = { validateCurrent: vi.fn(() => Promise.resolve()) };
  const trading = {
    validateCurrent: vi.fn(() =>
      Promise.resolve({
        schemaVersion: 1 as const,
        workspaceId,
        actionKind: 'TRADING_LISTING_PUBLISH' as const,
        effectFingerprintSha256: intent.effectFingerprintSha256,
        state,
        reason:
          state === 'CURRENT'
            ? ('EXACT_INTENT_CURRENT' as const)
            : state === 'REVOKED'
              ? ('TARGET_BINDING_REVOKED' as const)
              : state === 'UNAVAILABLE'
                ? ('OWNER_UNAVAILABLE' as const)
                : state === 'UNKNOWN'
                  ? ('OWNER_DATA_UNKNOWN' as const)
                  : ('DRAFT_STALE' as const)
      })
    )
  };
  let now = new Date('2026-09-17T00:01:00.000Z');
  const service = new ProtectedExternalActionService(repository, core, trading, () => now, 60_000);
  return {
    repository,
    core,
    trading,
    service,
    advance: () => (now = new Date('2026-09-17T00:03:00.000Z'))
  };
}

const authorize = (service: ProtectedExternalActionService, overrides = {}) =>
  service.authorize({
    workspaceId,
    actorUserId: userId,
    intent,
    humanReceipt: receipt,
    idempotencyKey: 'authorize-1176',
    ...overrides
  });

describe('Execution protected Trading publish authorization and release', () => {
  it('authorizes once, performs JIT Core + Trading validation, and creates one immutable release', async () => {
    const { service, core, trading } = harness();
    const authorization = await authorize(service);
    const release = await service.release({
      workspaceId,
      actorUserId: userId,
      authorizationId: authorization.authorizationId,
      authorizationVersion: 1,
      idempotencyKey: 'release-1176'
    });
    expect(authorization.authorizationStatus).toBe('AUTHORIZED');
    expect(release.status).toBe('RELEASED_FOR_EXECUTION');
    expect(release.effectFingerprintSha256).toBe(intent.effectFingerprintSha256);
    expect(core.validateCurrent).toHaveBeenCalledTimes(2);
    expect(trading.validateCurrent).toHaveBeenCalledTimes(2);
  });

  it('replays duplicate commands and rejects the same idempotency key for a different intent', async () => {
    const { service } = harness();
    const first = await authorize(service);
    await expect(authorize(service)).resolves.toEqual(first);
    await expect(
      authorize(service, {
        intent: { ...intent, listingDraft: { ...intent.listingDraft, version: 2 } }
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const releaseCommand = {
      workspaceId,
      actorUserId: userId,
      authorizationId: first.authorizationId,
      authorizationVersion: 1,
      idempotencyKey: 'release-1176'
    } as const;
    const release = await service.release(releaseCommand);
    await expect(service.release(releaseCommand)).resolves.toEqual(release);
    await expect(
      service.release({ ...releaseCommand, authorizationVersion: 2 })
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('rejects trusted Workspace mismatch and stale receipt binding', async () => {
    const { service } = harness();
    await expect(authorize(service, { workspaceId: otherWorkspaceId })).rejects.toMatchObject({
      code: 'WORKSPACE_MISMATCH'
    });
    await expect(
      authorize(service, { humanReceipt: { ...receipt, idempotencyKey: 'different' } })
    ).rejects.toMatchObject({ code: 'HUMAN_RECEIPT_STALE' });
  });

  it.each([
    ['STALE', 'TRADING_INTENT_STALE'],
    ['REVOKED', 'TRADING_INTENT_REVOKED'],
    ['UNKNOWN', 'TRADING_INTENT_UNKNOWN'],
    ['UNAVAILABLE', 'TRADING_INTENT_UNAVAILABLE']
  ] as const)('fails closed for Trading %s without collapsing semantics', async (state, code) => {
    await expect(authorize(harness(state).service)).rejects.toMatchObject({ code });
  });

  it('fails closed for expired/revoked Core receipt and authorization', async () => {
    const staleCore = harness();
    staleCore.core.validateCurrent.mockRejectedValueOnce(
      new ProtectedExternalActionError('HUMAN_RECEIPT_STALE', 'expired or revoked')
    );
    await expect(authorize(staleCore.service)).rejects.toMatchObject({
      code: 'HUMAN_RECEIPT_STALE'
    });

    const expired = harness();
    const authorization = await authorize(expired.service);
    expired.advance();
    await expect(
      expired.service.release({
        workspaceId,
        actorUserId: userId,
        authorizationId: authorization.authorizationId,
        authorizationVersion: 1,
        idempotencyKey: 'release-expired'
      })
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_EXPIRED' });

    const revoked = harness();
    const revokedAuthorization = await authorize(revoked.service);
    await revoked.repository.updateAuthorizationStatus(
      workspaceId,
      revokedAuthorization.authorizationId,
      'REVOKED'
    );
    await expect(
      revoked.service.release({
        workspaceId,
        actorUserId: userId,
        authorizationId: revokedAuthorization.authorizationId,
        authorizationVersion: 1,
        idempotencyKey: 'release-revoked'
      })
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_REVOKED' });
  });

  it('does not expose an authorization across Workspaces', async () => {
    const { service } = harness();
    const authorization = await authorize(service);
    await expect(
      service.release({
        workspaceId: otherWorkspaceId,
        actorUserId: userId,
        authorizationId: authorization.authorizationId,
        authorizationVersion: 1,
        idempotencyKey: 'release-cross-workspace'
      })
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_NOT_FOUND' });
  });
});

const emailIntent: EmailCampaignSendIntentV1 = {
  schemaVersion: 1,
  actionKind: 'EMAIL_CAMPAIGN_SEND',
  workspaceId,
  campaign: { id: 'email-campaign_test', version: 1, fingerprintSha256: '1'.repeat(64) },
  campaignReview: { id: 'campaign-review_test', version: 1 },
  senderProfile: {
    id: 'email-sender-profile_primary',
    version: 1,
    fingerprintSha256: '2'.repeat(64)
  },
  audience: { id: 'campaign-audience_test', version: 1, fingerprintSha256: '3'.repeat(64) },
  content: { id: 'campaign-content_test', version: 1, fingerprintSha256: '4'.repeat(64) },
  brand: { id: 'campaign-brand_test', version: 1, fingerprintSha256: '5'.repeat(64) },
  recipientCount: 1,
  deliveryPlanFingerprintSha256: '6'.repeat(64),
  effectFingerprintSha256: '7'.repeat(64)
};

const emailReceipt: CoreHumanActionReceiptBindingV1 = {
  ...receipt,
  kind: 'EMAIL_CAMPAIGN_SEND',
  mutationRoute: '/api/execution/protected-external-actions/email-campaign-send/authorizations',
  reviewedActionDigest: createHash('sha256').update(JSON.stringify(emailIntent)).digest('hex'),
  idempotencyKey: 'authorize-email-1176'
};

function emailHarness(state: EmailCampaignSendCurrentnessStateV1 = 'CURRENT') {
  const repository = new InMemoryProtectedExternalActionRepository();
  const core = { validateCurrent: vi.fn(() => Promise.resolve()) };
  const trading = {
    validateCurrent: vi.fn(() =>
      Promise.resolve({
        schemaVersion: 1 as const,
        workspaceId,
        actionKind: 'TRADING_LISTING_PUBLISH' as const,
        effectFingerprintSha256: intent.effectFingerprintSha256,
        state: 'CURRENT' as const,
        reason: 'EXACT_INTENT_CURRENT' as const
      })
    )
  };
  const emailCampaign = {
    validateCurrent: vi.fn(() =>
      Promise.resolve({
        schemaVersion: 1 as const,
        workspaceId,
        actionKind: 'EMAIL_CAMPAIGN_SEND' as const,
        effectFingerprintSha256: emailIntent.effectFingerprintSha256,
        deliveryPlanFingerprintSha256: emailIntent.deliveryPlanFingerprintSha256,
        state,
        reason:
          state === 'CURRENT'
            ? ('EXACT_DELIVERY_PLAN_CURRENT' as const)
            : state === 'REVOKED'
              ? ('SENDER_PROFILE_REVOKED' as const)
              : state === 'SUPPRESSED'
                ? ('OUTBOUND_POLICY_SUPPRESSED' as const)
                : state === 'UNAVAILABLE'
                  ? ('OWNER_UNAVAILABLE' as const)
                  : state === 'UNKNOWN'
                    ? ('OWNER_DATA_UNKNOWN' as const)
                    : ('CAMPAIGN_STALE' as const)
      })
    )
  };
  let now = new Date('2026-09-17T00:01:00.000Z');
  const service = new ProtectedExternalActionService(
    repository,
    core,
    trading,
    () => now,
    60_000,
    emailCampaign
  );
  return {
    repository,
    core,
    emailCampaign,
    service,
    advance: () => (now = new Date('2026-09-17T00:03:00.000Z'))
  };
}

const authorizeEmail = (
  service: ProtectedExternalActionService,
  overrides: Partial<
    Parameters<ProtectedExternalActionService['authorizeEmailCampaignSend']>[0]
  > = {}
) =>
  service.authorizeEmailCampaignSend({
    workspaceId,
    actorUserId: userId,
    intent: emailIntent,
    humanReceipt: emailReceipt,
    idempotencyKey: 'authorize-email-1176',
    ...overrides
  });

describe('Execution protected Email Campaign send authorization and release', () => {
  it('authorizes and releases only after Core + JIT Email currentness validation', async () => {
    const { service, core, emailCampaign } = emailHarness();
    const authorization = await authorizeEmail(service);
    const release = await service.releaseEmailCampaignSend({
      workspaceId,
      actorUserId: userId,
      authorizationId: authorization.authorizationId,
      authorizationVersion: 1,
      idempotencyKey: 'release-email-1176'
    });
    expect(authorization.actionKind).toBe('EMAIL_CAMPAIGN_SEND');
    expect(release.actionKind).toBe('EMAIL_CAMPAIGN_SEND');
    expect(core.validateCurrent).toHaveBeenCalledTimes(2);
    expect(emailCampaign.validateCurrent).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['STALE', 'EMAIL_CAMPAIGN_INTENT_STALE'],
    ['REVOKED', 'EMAIL_CAMPAIGN_INTENT_REVOKED'],
    ['SUPPRESSED', 'EMAIL_CAMPAIGN_INTENT_SUPPRESSED'],
    ['UNKNOWN', 'EMAIL_CAMPAIGN_INTENT_UNKNOWN'],
    ['UNAVAILABLE', 'EMAIL_CAMPAIGN_INTENT_UNAVAILABLE']
  ] as const)('fails closed for Email Campaign %s', async (state, code) => {
    await expect(authorizeEmail(emailHarness(state).service)).rejects.toMatchObject({ code });
  });

  it('rejects receipt digest drift, wrong route and cross-kind release', async () => {
    const { service } = emailHarness();
    await expect(
      authorizeEmail(service, {
        humanReceipt: { ...emailReceipt, reviewedActionDigest: 'f'.repeat(64) }
      })
    ).rejects.toMatchObject({ code: 'HUMAN_RECEIPT_STALE' });
    await expect(
      authorizeEmail(service, {
        humanReceipt: {
          ...emailReceipt,
          mutationRoute:
            '/api/execution/protected-external-actions/trading-listing-publish/authorizations'
        }
      })
    ).rejects.toMatchObject({ code: 'HUMAN_RECEIPT_STALE' });

    const authorization = await authorizeEmail(service);
    await expect(
      service.release({
        workspaceId,
        actorUserId: userId,
        authorizationId: authorization.authorizationId,
        authorizationVersion: 1,
        idempotencyKey: 'release-email-as-trading'
      })
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_STALE' });
  });

  it('does not permit cross-kind idempotency reuse', async () => {
    const { service } = emailHarness();
    await authorizeEmail(service);
    await expect(
      service.authorize({
        workspaceId,
        actorUserId: userId,
        intent,
        humanReceipt: { ...receipt, idempotencyKey: 'authorize-email-1176' },
        idempotencyKey: 'authorize-email-1176'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('revalidates at release and fails after currentness changes', async () => {
    const h = emailHarness();
    const authorization = await authorizeEmail(h.service);
    h.emailCampaign.validateCurrent.mockResolvedValueOnce({
      schemaVersion: 1,
      workspaceId,
      actionKind: 'EMAIL_CAMPAIGN_SEND',
      effectFingerprintSha256: emailIntent.effectFingerprintSha256,
      deliveryPlanFingerprintSha256: emailIntent.deliveryPlanFingerprintSha256,
      state: 'SUPPRESSED',
      reason: 'OUTBOUND_POLICY_SUPPRESSED'
    });
    await expect(
      h.service.releaseEmailCampaignSend({
        workspaceId,
        actorUserId: userId,
        authorizationId: authorization.authorizationId,
        authorizationVersion: 1,
        idempotencyKey: 'release-email-suppressed'
      })
    ).rejects.toMatchObject({ code: 'EMAIL_CAMPAIGN_INTENT_SUPPRESSED' });
  });
});
