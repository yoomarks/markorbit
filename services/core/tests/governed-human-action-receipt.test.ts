/* eslint-disable @typescript-eslint/require-await -- in-memory store implements the async persistence contract. */
import { describe, expect, it, vi } from 'vitest';
import {
  CurrentWorkspaceAuthorityError,
  type CurrentWorkspaceAuthorityRequest,
  type CurrentWorkspaceAuthorityResult
} from '../src/current-workspace-authority.js';
import {
  GovernedHumanActionReceiptError,
  GovernedHumanActionReceiptService,
  type GovernedHumanActionReceipt,
  type GovernedHumanActionReceiptStore,
  type MaterializeGovernedHumanActionReceiptRequest
} from '../src/governed-human-action-receipt.js';

const ids = {
  workspace: '018f0000-0000-7000-8000-000000000001',
  user: '018f0000-0000-7000-8000-000000000002',
  membership: '018f0000-0000-7000-8000-000000000003'
};

const command = (): MaterializeGovernedHumanActionReceiptRequest => ({
  workspaceId: ids.workspace,
  userId: ids.user,
  membershipId: ids.membership,
  principalReference: 'core-workspace-principal:trusted-lineage',
  kind: 'PROVIDER_SELECTION',
  mutationRoute: '/api/mgsn/governed-network/selections',
  reviewedActionDigest: 'a'.repeat(64),
  idempotencyKey: 'selection-action-1',
  authenticatedAt: '2026-09-05T09:00:00.000Z'
});

const authority: CurrentWorkspaceAuthorityResult = {
  schemaVersion: 1,
  authorityAvailable: true,
  workspaceCurrent: true,
  userCurrent: true,
  membershipCurrent: true,
  bindingMatches: true,
  permissionCurrent: true,
  workspace: { workspaceId: ids.workspace, version: 4 },
  user: { userId: ids.user, version: 2 },
  membership: {
    membershipId: ids.membership,
    workspaceId: ids.workspace,
    userId: ids.user,
    role: 'WORKSPACE_ADMIN',
    version: 3
  },
  requiredPermission: 'workspace:manage'
};

class MemoryStore implements GovernedHumanActionReceiptStore {
  private byId = new Map<string, Readonly<GovernedHumanActionReceipt>>();
  private byKey = new Map<string, Readonly<GovernedHumanActionReceipt>>();

  async materializeOrResolve(receipt: Readonly<GovernedHumanActionReceipt>) {
    const key = `${receipt.workspaceId}:${receipt.idempotencyKey}`;
    const existing = this.byKey.get(key);
    if (existing) {
      if (
        existing.userId !== receipt.userId ||
        existing.membershipId !== receipt.membershipId ||
        existing.principalReference !== receipt.principalReference ||
        existing.kind !== receipt.kind ||
        existing.mutationRoute !== receipt.mutationRoute ||
        existing.reviewedActionDigest !== receipt.reviewedActionDigest ||
        existing.authenticatedAt !== receipt.authenticatedAt
      )
        throw new GovernedHumanActionReceiptError(
          'GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT',
          'conflict',
          409
        );
      return existing;
    }
    this.byKey.set(key, receipt);
    this.byId.set(receipt.receiptId, receipt);
    return receipt;
  }

  async findById(receiptId: string) {
    return this.byId.get(receiptId);
  }
}

function service(options?: {
  store?: GovernedHumanActionReceiptStore;
  validate?: (
    request: Readonly<CurrentWorkspaceAuthorityRequest>
  ) => Promise<Readonly<CurrentWorkspaceAuthorityResult>>;
}) {
  const validate = options?.validate ?? vi.fn(() => Promise.resolve(authority));
  return {
    validate,
    service: new GovernedHumanActionReceiptService({
      store: options?.store ?? new MemoryStore(),
      currentWorkspaceAuthority: { validate },
      clock: () => new Date('2026-09-05T09:01:00.000Z')
    })
  };
}

describe('governed human-action receipt authority', () => {
  it('materializes a durable Core-owned receipt only after current Workspace authority succeeds', async () => {
    const f = service();
    const receipt = await f.service.materializeOrResolve(command());

    expect(receipt).toMatchObject({
      schemaVersion: 1,
      receiptVersion: 1,
      source: 'CORE',
      actorKind: 'HUMAN_USER',
      kind: 'PROVIDER_SELECTION',
      workspaceVersion: 4,
      userVersion: 2,
      membershipVersion: 3,
      createdAt: '2026-09-05T09:01:00.000Z'
    });
    expect(receipt.authorityReference).toBe(
      `core-governed-human-action-receipt:${receipt.receiptId}`
    );
    expect(receipt.affirmativeHumanActionEvidenceReference).toBe(
      `core-governed-human-action-evidence:${receipt.receiptId}`
    );
    expect(f.validate).toHaveBeenCalledWith({
      workspaceId: ids.workspace,
      userId: ids.user,
      membershipId: ids.membership,
      requiredPermission: 'workspace:manage'
    });
  });

  it('resolves exact idempotent replay to the same receipt and rejects changed action identity', async () => {
    const store = new MemoryStore();
    const f = service({ store });
    const first = await f.service.materializeOrResolve(command());
    const replay = await f.service.materializeOrResolve(command());
    expect(replay.receiptId).toBe(first.receiptId);

    await expect(
      f.service.materializeOrResolve({ ...command(), reviewedActionDigest: 'b'.repeat(64) })
    ).rejects.toMatchObject({
      code: 'GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT',
      status: 409
    });
  });

  it('keeps Selection and Handoff authority domains distinct', async () => {
    const f = service();
    await expect(
      f.service.materializeOrResolve({
        ...command(),
        kind: 'CONTROLLED_HANDOFF',
        mutationRoute: '/api/mgsn/governed-network/selections'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_GOVERNED_HUMAN_ACTION_REQUEST',
      status: 400
    });
  });

  it('revalidates the exact stored authority versions before a receipt remains current', async () => {
    const store = new MemoryStore();
    const validate = vi.fn<
      (request: Readonly<CurrentWorkspaceAuthorityRequest>) =>
        Promise<Readonly<CurrentWorkspaceAuthorityResult>>
    >();
    validate.mockResolvedValueOnce(authority).mockResolvedValueOnce(authority);
    const f = service({ store, validate });
    const receipt = await f.service.materializeOrResolve(command());
    await expect(
      f.service.validateCurrent({ ...command(), receiptId: receipt.receiptId })
    ).resolves.toEqual(receipt);
    expect(validate).toHaveBeenLastCalledWith({
      workspaceId: ids.workspace,
      userId: ids.user,
      membershipId: ids.membership,
      expectedWorkspaceVersion: 4,
      expectedUserVersion: 2,
      expectedMembershipVersion: 3,
      requiredPermission: 'workspace:manage'
    });
  });

  it('fails closed as stale for known authority loss and as retryable only for source outage', async () => {
    const known = service({
      validate: () =>
        Promise.reject(
          new CurrentWorkspaceAuthorityError(
            'CURRENT_AUTHORITY_PERMISSION_DENIED',
            'permission gone',
            403
          )
        )
    });
    await expect(known.service.materializeOrResolve(command())).rejects.toMatchObject({
      code: 'GOVERNED_HUMAN_ACTION_RECEIPT_STALE',
      status: 403,
      retryable: false
    });

    const unavailable = service({
      validate: () =>
        Promise.reject(
          new CurrentWorkspaceAuthorityError(
            'CURRENT_AUTHORITY_SOURCE_UNAVAILABLE',
            'database unavailable',
            503,
            true
          )
        )
    });
    await expect(unavailable.service.materializeOrResolve(command())).rejects.toMatchObject({
      code: 'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });

  it('does not accept a different reviewed binding when validating an existing receipt', async () => {
    const store = new MemoryStore();
    const f = service({ store });
    const receipt = await f.service.materializeOrResolve(command());
    await expect(
      f.service.validateCurrent({
        ...command(),
        receiptId: receipt.receiptId,
        reviewedActionDigest: 'c'.repeat(64)
      })
    ).rejects.toMatchObject({
      code: 'GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT',
      status: 409
    });
  });
});
