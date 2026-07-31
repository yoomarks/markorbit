import { describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  CustomerConfirmationError,
  CustomerConfirmationService,
  canonicalJson,
  hashSnapshot,
  InMemoryCustomerConfirmationRepository,
  type AcceptedQuoteSnapshot
} from '../src/customer-confirmation.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const principal = (
  permissions: WorkspacePrincipal['permissions'] = ['matter:read', 'matter:create', 'matter:manage']
): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session-1',
  userId: 'user-1',
  workspaceId,
  membershipId: 'membership-1',
  role: 'WORKSPACE_ADMIN',
  permissions,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});
const snapshot: AcceptedQuoteSnapshot = {
  schemaVersion: 1,
  quoteId: 'quote_1',
  quoteVersion: 'quote-v1',
  planId: 'plan_1',
  planVersion: 'plan-v1',
  currency: 'USD',
  totalMinor: 12500,
  lineItems: [
    { code: 'SERVICE', description: 'Service fee', category: 'SERVICE_FEE', amountMinor: 12500 }
  ],
  termsVersion: 'terms-v1',
  acknowledgementCodes: ['NO_FILING'],
  selectedOptionCode: 'A',
  recommendationId: 'recommendation_1',
  assumptions: [],
  limitations: []
};
const quote = {
  quoteId: snapshot.quoteId,
  pricingRuleVersion: snapshot.quoteVersion,
  status: 'READY',
  validUntil: '2030-01-01T00:00:00.000Z',
  currency: snapshot.currency,
  total: { amountMinor: snapshot.totalMinor, currency: snapshot.currency },
  lines: snapshot.lineItems.map((x) => ({
    code: x.code,
    description: x.description,
    category: x.category,
    amount: { amountMinor: x.amountMinor, currency: snapshot.currency }
  })),
  selectedOptionCode: 'A',
  recommendationId: snapshot.recommendationId,
  assumptions: [],
  limitations: []
} as never;
const input = {
  workspaceId,
  quoteId: 'quote_1',
  quoteVersion: 'quote-v1',
  planId: 'plan_1',
  planVersion: 'plan-v1',
  termsVersion: 'terms-v1',
  acknowledgementCodes: ['NO_FILING']
};
const setup = () => {
  const repository = new InMemoryCustomerConfirmationRepository();
  return {
    repository,
    service: new CustomerConfirmationService(
      repository,
      (id) => Promise.resolve(id === snapshot.quoteId ? structuredClone(quote) : null),
      () => '2026-07-31T12:00:00.000Z'
    )
  };
};
describe('durable Customer Confirmation contract (in memory)', () => {
  it('creates and exactly reloads a workspace-scoped immutable snapshot', async () => {
    const { service } = setup();
    const created = await service.create(principal(), input);
    expect(created.version).toBe(1);
    expect(created.status).toBe('CONFIRMED');
    expect(created.sourceSnapshotHash).toBe(hashSnapshot(snapshot));
    (created.sourceSnapshot.lineItems as unknown as { code: string }[])[0]!.code = 'MUTATED';
    expect(
      (await service.get(principal(), workspaceId, created.confirmationId)).sourceSnapshot
        .lineItems[0]!.code
    ).toBe('SERVICE');
  });
  it('fails closed across workspaces', async () => {
    const { service } = setup();
    const created = await service.create(principal(), input);
    const other = { ...principal(), workspaceId: '22222222-2222-4222-8222-222222222222' };
    await expect(
      service.get(other, other.workspaceId, created.confirmationId)
    ).rejects.toMatchObject({ code: 'CUSTOMER_CONFIRMATION_NOT_FOUND' });
  });
  it('rejects duplicate source identity and version', async () => {
    const { service } = setup();
    await service.create(principal(), input);
    await expect(service.create(principal(), input)).rejects.toMatchObject({
      code: 'CUSTOMER_CONFIRMATION_DUPLICATE'
    });
  });
  it('withdraws once with optimistic concurrency and retains acceptance', async () => {
    const { service } = setup();
    const accepted = await service.create(principal(), input);
    const withdrawn = await service.withdraw(principal(), workspaceId, accepted.confirmationId, 1);
    expect(withdrawn).toMatchObject({
      status: 'WITHDRAWN',
      version: 2,
      acceptedAt: accepted.acceptedAt
    });
    await expect(
      service.withdraw(principal(), workspaceId, accepted.confirmationId, 1)
    ).rejects.toMatchObject({ code: 'CUSTOMER_CONFIRMATION_WITHDRAWN' });
  });
  it('rejects stale source versions and missing sources', async () => {
    const { service } = setup();
    await expect(
      service.create(principal(), { ...input, quoteVersion: 'old' })
    ).rejects.toMatchObject({
      code: 'CUSTOMER_CONFIRMATION_SOURCE_VERSION_MISMATCH'
    });
    await expect(
      service.create(principal(), { ...input, quoteId: 'quote_missing', quoteVersion: 'v1' })
    ).rejects.toMatchObject({ code: 'CUSTOMER_CONFIRMATION_SOURCE_NOT_FOUND' });
  });
  it('enforces permissions and exact Workspace Principal scope', async () => {
    const { service } = setup();
    await expect(service.create(principal(['matter:read']), input)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED'
    });
    await expect(
      service.create({ ...principal(), workspaceId: '22222222-2222-4222-8222-222222222222' }, input)
    ).rejects.toMatchObject({ code: 'CUSTOMER_CONFIRMATION_WORKSPACE_MISMATCH' });
  });
  it('canonicalizes property order and changes hash for meaningful values', () => {
    const reordered = { ...snapshot, currency: snapshot.currency };
    expect(hashSnapshot(reordered)).toBe(hashSnapshot(snapshot));
    expect(hashSnapshot({ ...snapshot, totalMinor: 12501 })).not.toBe(hashSnapshot(snapshot));
  });
  it('preserves semantic array order and canonicalizes nested keys', () => {
    expect(canonicalJson({ nested: { b: 2, a: 1 } })).toBe(
      canonicalJson({ nested: { a: 1, b: 2 } })
    );
    expect(hashSnapshot({ ...snapshot, acknowledgementCodes: ['A', 'B'] })).not.toBe(
      hashSnapshot({ ...snapshot, acknowledgementCodes: ['B', 'A'] })
    );
    expect(canonicalJson(null)).toBe('null');
  });
  it.each([NaN, Infinity, -Infinity, 1n, Symbol('x'), () => undefined, new Date()])(
    'rejects unsupported canonical values',
    (value) => {
      expect(() => canonicalJson(value)).toThrow(CustomerConfirmationError);
    }
  );
  it('rejects prohibited prototype-like keys, excessive depth, size and forged hashes', async () => {
    const polluted = JSON.parse('{"__proto__":{"admin":true}}') as unknown;
    expect(() => canonicalJson(polluted)).toThrow(CustomerConfirmationError);
    let deep: unknown = {};
    for (let i = 0; i < 14; i++) deep = { deep };
    expect(() => canonicalJson(deep)).toThrow(CustomerConfirmationError);
    expect(() => hashSnapshot({ ...snapshot, limitations: ['x'.repeat(70_000)] })).toThrow(
      CustomerConfirmationError
    );
    const { repository } = setup();
    const valid = {
      confirmationId: 'confirmation_forged',
      workspaceId,
      sourceQuoteId: 'quote_forged',
      sourceQuoteVersion: 'v1',
      status: 'CONFIRMED' as const,
      version: 1,
      snapshotSchemaVersion: 1 as const,
      sourceSnapshot: snapshot,
      sourceSnapshotHash: '0'.repeat(64),
      acceptedAt: '2026-07-31T12:00:00.000Z',
      updatedAt: '2026-07-31T12:00:00.000Z',
      withdrawnAt: null
    };
    await expect(repository.create(valid)).rejects.toMatchObject({
      code: 'CUSTOMER_CONFIRMATION_INVALID_SNAPSHOT'
    });
  });
  it('rejects undefined rather than silently dropping it', () => {
    expect(() =>
      hashSnapshot({ ...snapshot, termsVersion: undefined } as unknown as AcceptedQuoteSnapshot)
    ).toThrow(CustomerConfirmationError);
  });
});
