import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime,
  type GovernedHumanActionReceiptAuthorityV1,
  type GovernedHumanActionReceiptMaterializationV1,
  type GovernedHumanActionReceiptV1
} from '../src/index.js';

const secret = 'core-governed-human-action-receipt-secret-123456789';
const active: ServiceRuntime[] = [];

function materialization(): GovernedHumanActionReceiptMaterializationV1 {
  return {
    schemaVersion: 1,
    kind: 'PROVIDER_SELECTION',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    userId: 'user_governed',
    membershipId: 'membership-governed',
    principalReference: `core-workspace-principal:${'a'.repeat(64)}`,
    authorityReference: `gateway-governed-action:provider_selection:${'b'.repeat(64)}`,
    idempotencyKeySha256: 'c'.repeat(64),
    requestFingerprintSha256: 'd'.repeat(64),
    authenticatedAt: '2026-09-05T08:00:00.000Z'
  };
}

function authority(): GovernedHumanActionReceiptAuthorityV1 {
  const rows = new Map<string, GovernedHumanActionReceiptV1>();
  return {
    materialize(input) {
      const existing = [...rows.values()].find(
        (row) =>
          row.kind === input.kind &&
          row.workspaceId === input.workspaceId &&
          row.userId === input.userId &&
          row.membershipId === input.membershipId &&
          row.idempotencyKeySha256 === input.idempotencyKeySha256
      );
      if (existing) return Promise.resolve(existing);
      const receiptId = 'governed-human-action-receipt_01900000-0000-7000-8000-000000000001';
      const receipt: GovernedHumanActionReceiptV1 = {
        ...input,
        receiptId,
        receiptReference: `core-governed-human-action-receipt:${receiptId}`,
        createdAt: '2026-09-05T08:00:01.000Z'
      };
      rows.set(receiptId, receipt);
      return Promise.resolve(receipt);
    },
    get(receiptId) {
      return Promise.resolve(rows.get(receiptId));
    }
  };
}

async function runtime(receipts = authority()) {
  const service = createRuntime({
    port: 0,
    governedHumanActionReceipts: receipts,
    internalServiceSecret: secret
  });
  active.push(service);
  await service.start();
  return `http://127.0.0.1:${service.listeningPort}`;
}

afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((service) => service.stop())
  );
});

describe('Core governed human-action receipt internal API', () => {
  it('materializes an opaque durable reference and resolves it independently', async () => {
    const base = await runtime();
    const created = await fetch(`${base}/internal/v1/governed-human-action-receipts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-internal-authorization': secret
      },
      body: JSON.stringify(materialization())
    });
    expect(created.status).toBe(200);
    const receipt = (await created.json()) as GovernedHumanActionReceiptV1;
    expect(receipt.receiptReference).toBe(
      `core-governed-human-action-receipt:${receipt.receiptId}`
    );

    const resolved = await fetch(
      `${base}/internal/v1/governed-human-action-receipts/${encodeURIComponent(receipt.receiptId)}`,
      { headers: { 'x-markorbit-internal-authorization': secret } }
    );
    expect(resolved.status).toBe(200);
    await expect(resolved.json()).resolves.toEqual(receipt);
  });

  it('rejects unauthenticated internal receipt access', async () => {
    const base = await runtime();
    const response = await fetch(`${base}/internal/v1/governed-human-action-receipts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(materialization())
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
  });
});
