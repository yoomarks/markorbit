import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ManagedDatabase } from '@markorbit/persistence';
import {
  PostgresCustomerConfirmationRepository,
  hashSnapshot,
  type AcceptedQuoteSnapshot
} from '../src/customer-confirmation.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) throw new Error('MARKREG_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;
suite('Customer Confirmation PostgreSQL repository', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-customer-confirmation-test',
    poolMaximum: 4,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable'
  });
  let repository: PostgresCustomerConfirmationRepository;
  const snapshot: AcceptedQuoteSnapshot = {
    schemaVersion: 1,
    quoteId: 'quote_pg',
    quoteVersion: 'v1',
    planId: 'plan_pg',
    planVersion: 'v1',
    currency: 'USD',
    totalMinor: 1,
    lineItems: [],
    termsVersion: 'v1',
    acknowledgementCodes: []
  };
  beforeAll(async () => {
    await database.start();
    await database.getPool().query('TRUNCATE customer_confirmations');
    repository = new PostgresCustomerConfirmationRepository(database.getPool());
  });
  afterAll(async () => database.close());
  it('persists, reloads, isolates and atomically withdraws', async () => {
    const record = {
      confirmationId: 'confirmation_11111111-1111-4111-8111-111111111111',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      sourceQuoteId: snapshot.quoteId,
      sourceQuoteVersion: snapshot.quoteVersion,
      status: 'CONFIRMED' as const,
      version: 1,
      snapshotSchemaVersion: 1 as const,
      sourceSnapshot: snapshot,
      sourceSnapshotHash: hashSnapshot(snapshot),
      acceptedAt: '2026-07-31T12:00:00.000Z',
      updatedAt: '2026-07-31T12:00:00.000Z',
      withdrawnAt: null
    };
    await repository.create(record);
    expect(await repository.findById(record.workspaceId, record.confirmationId)).toEqual(record);
    expect(
      await repository.findById('22222222-2222-4222-8222-222222222222', record.confirmationId)
    ).toBeNull();
    expect(
      (
        await repository.withdraw(
          record.workspaceId,
          record.confirmationId,
          1,
          '2026-07-31T13:00:00.000Z'
        )
      ).version
    ).toBe(2);
  });
});
