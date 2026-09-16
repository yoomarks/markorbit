import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CreateOrderCommand } from '@markorbit/contracts/order';
import { describe, expect, it, vi } from 'vitest';
import { ProductionOrderCommercialSourceProvider } from '../src/production-order-commercial-source.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_order_source',
  userId: '22222222-2222-4222-8222-222222222222',
  workspaceId,
  membershipId: 'membership_order_source',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'order:create'],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
const at = '2026-09-17T00:00:00.000Z';
const command = {
  workspaceId,
  orderType: 'TrademarkFiling' as const,
  quoteId: 'quote_production_1',
  expectedQuoteVersion: '2',
  customerConfirmationId: 'confirmation_production_1' as const,
  expectedCustomerConfirmationVersion: 1,
  channel: 'MARKREG_WHITE_LABEL' as const,
  relationshipModel: 'WHITE_LABEL' as const,
  idempotencyKey: 'order-production-1'
} satisfies CreateOrderCommand;

function provider() {
  return new ProductionOrderCommercialSourceProvider(
    {
      create: vi.fn() as never,
      withdraw: vi.fn() as never,
      findBySource: vi.fn() as never,
      findById: vi.fn(() =>
        Promise.resolve({
          confirmationId: command.customerConfirmationId,
          workspaceId,
          sourceQuoteId: command.quoteId,
          sourceQuoteVersion: command.expectedQuoteVersion,
          status: 'CONFIRMED' as const,
          version: 1,
          snapshotSchemaVersion: 1 as const,
          sourceSnapshot: {} as never,
          sourceSnapshotHash: 'a'.repeat(64),
          acceptedAt: at,
          updatedAt: at,
          withdrawnAt: null
        })
      )
    },
    {
      get: vi.fn(() =>
        Promise.resolve({
          quoteId: command.quoteId,
          workspaceId,
          version: 2,
          currency: 'USD',
          total: { amountMinor: 64900, currency: 'USD' },
          intake: { id: 'production-intake_1', version: 1, fingerprintSha256: 'b'.repeat(64) },
          selection: { id: 'production-selection_1', version: 1, fingerprintSha256: 'c'.repeat(64) }
        } as never)
      )
    },
    {
      get: vi.fn(() =>
        Promise.resolve({
          intakeId: 'production-intake_1',
          version: 1,
          fingerprintSha256: 'b'.repeat(64),
          channel: 'MARKREG_WHITE_LABEL',
          relationshipModel: 'WHITE_LABEL',
          input: {
            applicant: { name: 'Pilot Applicant' },
            trademark: { representationText: 'PILOT' },
            targetJurisdictions: ['US'],
            goodsServices: { sourceText: 'Software services' }
          },
          siteSource: { siteId: 'site_pilot', configurationVersion: 3 }
        } as never)
      )
    },
    {
      get: vi.fn(() =>
        Promise.resolve({
          selectionId: 'production-selection_1',
          version: 1,
          fingerprintSha256: 'c'.repeat(64)
        } as never)
      )
    },
    {
      getCurrent: vi.fn(() => Promise.resolve({ niceClasses: [9, 42] } as never))
    }
  );
}

describe('Production Order commercial source', () => {
  it('reuses exact white-label Intake/Quote/Confirmation/Fee Facts without MarkReg host assumptions', async () => {
    const source = await provider().resolve(principal, command);
    expect(source).toMatchObject({
      channel: 'MARKREG_WHITE_LABEL',
      relationshipModel: 'WHITE_LABEL',
      customerId: `user_${principal.userId}`,
      commercialScope: {
        applicantReference: 'production-intake_1#applicant',
        trademarkReference: 'production-intake_1#trademark',
        classNumbers: [9, 42],
        goodsServices: ['Software services']
      },
      relationshipReferences: {
        customerFacingBrand: { referenceId: 'site:site_pilot@3' }
      }
    });
    await expect(provider().isCurrent(principal, workspaceId, source!)).resolves.toBe(true);
  });

  it('rejects channel drift instead of forking Site-specific Order semantics', async () => {
    await expect(
      provider().resolve(principal, { ...command, channel: 'MARKREG_DIRECT' })
    ).resolves.toBeNull();
  });
});
