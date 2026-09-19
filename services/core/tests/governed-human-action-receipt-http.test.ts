import { describe, expect, it, vi } from 'vitest';
import type { JsonRequest } from '@markorbit/service-kit';
import { createGovernedHumanActionReceiptRoutes } from '../src/governed-human-action-receipt-http.js';
import {
  GovernedHumanActionReceiptError,
  type GovernedHumanActionReceipt,
  type MaterializeGovernedHumanActionReceiptRequest,
  type ValidateGovernedHumanActionReceiptRequest
} from '../src/governed-human-action-receipt.js';

const secret = 'core-governed-human-action-secret-32-bytes';
const ids = {
  workspace: '018f0000-0000-7000-8000-000000000001',
  user: '018f0000-0000-7000-8000-000000000002',
  membership: '018f0000-0000-7000-8000-000000000003',
  receipt: '018f0000-0000-7000-8000-000000000004'
};

const command: MaterializeGovernedHumanActionReceiptRequest = {
  workspaceId: ids.workspace,
  userId: ids.user,
  membershipId: ids.membership,
  principalReference: 'core-workspace-principal:trusted-lineage',
  kind: 'PROVIDER_SELECTION',
  mutationRoute: '/api/mgsn/governed-network/selections',
  reviewedActionDigest: 'a'.repeat(64),
  idempotencyKey: 'selection-action-1',
  authenticatedAt: '2026-09-05T09:00:00.000Z'
};

const receipt: GovernedHumanActionReceipt = {
  schemaVersion: 1,
  receiptId: ids.receipt,
  receiptVersion: 1,
  authorityReference: `core-governed-human-action-receipt:${ids.receipt}`,
  authorityVersion: 1,
  affirmativeHumanActionEvidenceReference: `core-governed-human-action-evidence:${ids.receipt}`,
  source: 'CORE',
  actorKind: 'HUMAN_USER',
  ...command,
  workspaceVersion: 1,
  userVersion: 1,
  membershipVersion: 1,
  createdAt: '2026-09-05T09:01:00.000Z'
};

function request(
  path: string,
  body: unknown,
  authorization: string | undefined = secret
): JsonRequest {
  return {
    method: 'POST',
    path,
    params: {},
    query: {},
    headers: { 'x-markorbit-internal-authorization': authorization },
    body
  };
}

function routes(overrides?: {
  materialize?: (
    input: Readonly<MaterializeGovernedHumanActionReceiptRequest>
  ) => Promise<Readonly<GovernedHumanActionReceipt>>;
  validate?: (
    input: Readonly<ValidateGovernedHumanActionReceiptRequest>
  ) => Promise<Readonly<GovernedHumanActionReceipt>>;
}) {
  const materializeOrResolve = overrides?.materialize ?? vi.fn(() => Promise.resolve(receipt));
  const validateCurrent = overrides?.validate ?? vi.fn(() => Promise.resolve(receipt));
  const result = createGovernedHumanActionReceiptRoutes({
    internalServiceSecret: secret,
    service: { materializeOrResolve, validateCurrent }
  });
  return { result, materializeOrResolve, validateCurrent };
}

describe('governed human-action receipt internal HTTP boundary', () => {
  it('authenticates the internal caller and forwards only the bounded receipt binding', async () => {
    const f = routes();
    const response = await f.result[0]!.handle(
      request('/internal/auth/governed-human-actions/receipts', command)
    );
    expect(response).toEqual({ status: 200, body: receipt });
    expect(f.materializeOrResolve).toHaveBeenCalledWith(command);
  });

  it('rejects browser-style authority, actor and raw payload expansion before owner service calls', async () => {
    const f = routes();
    for (const extra of [
      { authorityReference: 'browser-made-authority' },
      { actorKind: 'HUMAN_USER' },
      { rawPayload: { contact: 'private' } },
      { principal: { kind: 'WORKSPACE' } }
    ])
      await expect(
        f.result[0]!.handle(
          request('/internal/auth/governed-human-actions/receipts', { ...command, ...extra })
        )
      ).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_GOVERNED_HUMAN_ACTION_REQUEST'
      });
    expect(f.materializeOrResolve).not.toHaveBeenCalled();
  });

  it('rejects an invalid internal caller before consulting receipt authority', async () => {
    const f = routes();
    await expect(
      f.result[0]!.handle(
        request(
          '/internal/auth/governed-human-actions/receipts',
          command,
          'wrong-secret-value-xxxxxxxxxxxxxxxx'
        )
      )
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(f.materializeOrResolve).not.toHaveBeenCalled();
  });

  it('requires the exact receipt id plus exact reviewed binding for current validation', async () => {
    const f = routes();
    const validateCommand: ValidateGovernedHumanActionReceiptRequest = {
      ...command,
      receiptId: ids.receipt
    };
    const response = await f.result[1]!.handle(
      request('/internal/auth/governed-human-actions/receipts/validate-current', validateCommand)
    );
    expect(response).toEqual({ status: 200, body: receipt });
    expect(f.validateCurrent).toHaveBeenCalledWith(validateCommand);
  });

  it.each([
    ['GOVERNED_HUMAN_ACTION_RECEIPT_STALE', 409, false],
    ['GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT', 409, false],
    ['GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE', 503, true]
  ] as const)('preserves %s as fail-closed HTTP state', async (code, status, retryable) => {
    const f = routes({
      materialize: () =>
        Promise.reject(
          new GovernedHumanActionReceiptError(code, `forced ${code}`, status, retryable)
        )
    });
    await expect(
      f.result[0]!.handle(request('/internal/auth/governed-human-actions/receipts', command))
    ).rejects.toMatchObject({ code, status, retryable });
  });
});

describe('Trading Listing Publish receipt internal HTTP admission', () => {
  it('admits the exact TRADING_LISTING_PUBLISH kind without broadening request fields', async () => {
    const trading: MaterializeGovernedHumanActionReceiptRequest = {
      ...command,
      kind: 'TRADING_LISTING_PUBLISH',
      mutationRoute:
        '/api/execution/protected-external-actions/trading-listing-publish/authorizations',
      reviewedActionDigest: 'd'.repeat(64),
      idempotencyKey: 'trading-listing-publish-1'
    };
    const materialize = vi.fn((input: Readonly<MaterializeGovernedHumanActionReceiptRequest>) =>
      Promise.resolve({ ...receipt, ...input })
    );
    const f = routes({ materialize });
    const response = await f.result[0]!.handle(
      request('/internal/auth/governed-human-actions/receipts', trading)
    );
    expect(response.status).toBe(200);
    expect(materialize).toHaveBeenCalledWith(trading);
  });

  it('continues to reject unowned generic or Social publish action kinds', async () => {
    const f = routes();
    for (const kind of ['EXTERNAL_ACTION', 'SOCIAL_PUBLISH']) {
      await expect(
        f.result[0]!.handle(
          request('/internal/auth/governed-human-actions/receipts', {
            ...command,
            kind
          })
        )
      ).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_GOVERNED_HUMAN_ACTION_REQUEST'
      });
    }
    expect(f.materializeOrResolve).not.toHaveBeenCalled();
  });
});

describe('Email Campaign Send receipt internal HTTP admission', () => {
  it('admits the exact EMAIL_CAMPAIGN_SEND kind and bounded authorization route', async () => {
    const emailCampaign: MaterializeGovernedHumanActionReceiptRequest = {
      ...command,
      kind: 'EMAIL_CAMPAIGN_SEND',
      mutationRoute: '/api/execution/protected-external-actions/email-campaign-send/authorizations',
      reviewedActionDigest: 'e'.repeat(64),
      idempotencyKey: 'email-campaign-send-1'
    };
    const materialize = vi.fn((input: Readonly<MaterializeGovernedHumanActionReceiptRequest>) =>
      Promise.resolve({ ...receipt, ...input })
    );
    const f = routes({ materialize });
    const response = await f.result[0]!.handle(
      request('/internal/auth/governed-human-actions/receipts', emailCampaign)
    );
    expect(response.status).toBe(200);
    expect(materialize).toHaveBeenCalledWith(emailCampaign);
  });

  it('still rejects generic marketing/provider authority expansion', async () => {
    const f = routes();
    for (const kind of ['EMAIL_SEND', 'MARKETING_SEND', 'PROVIDER_EMAIL_SEND']) {
      await expect(
        f.result[0]!.handle(
          request('/internal/auth/governed-human-actions/receipts', {
            ...command,
            kind
          })
        )
      ).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_GOVERNED_HUMAN_ACTION_REQUEST'
      });
    }
    expect(f.materializeOrResolve).not.toHaveBeenCalled();
  });
});

describe('Notification Automation activation receipt internal HTTP admission', () => {
  it('admits only the exact NOTIFICATION_AUTOMATION_ACTIVATE route', async () => {
    const activation: MaterializeGovernedHumanActionReceiptRequest = {
      ...command,
      kind: 'NOTIFICATION_AUTOMATION_ACTIVATE',
      mutationRoute:
        '/api/lite/notification-automation-rules/channel-notification-rule_primary/activate',
      reviewedActionDigest: '9'.repeat(64),
      idempotencyKey: 'notification-automation-activate-1'
    };
    const materialize = vi.fn((input: Readonly<MaterializeGovernedHumanActionReceiptRequest>) =>
      Promise.resolve({ ...receipt, ...input })
    );
    const f = routes({ materialize });
    const response = await f.result[0]!.handle(
      request('/internal/auth/governed-human-actions/receipts', activation)
    );
    expect(response.status).toBe(200);
    expect(materialize).toHaveBeenCalledWith(activation);
  });

  it('rejects generic notification-send authority as a human action kind', async () => {
    const f = routes();
    for (const kind of ['EMAIL_NOTIFICATION_SEND', 'NOTIFICATION_SEND', 'AUTOMATED_SEND']) {
      await expect(
        f.result[0]!.handle(
          request('/internal/auth/governed-human-actions/receipts', {
            ...command,
            kind
          })
        )
      ).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_GOVERNED_HUMAN_ACTION_REQUEST'
      });
    }
    expect(f.materializeOrResolve).not.toHaveBeenCalled();
  });
});

