import type { BusinessAttributionLinkV1 } from '@markorbit/contracts/business-attribution';
import { describe, expect, it } from 'vitest';
import {
  PostgresBusinessAttributionStore,
  type CreateBusinessAttributionLinkCommand
} from '../src/business-attribution.js';

const workspace = '11111111-1111-4111-8111-111111111111';
const otherWorkspace = '22222222-2222-4222-8222-222222222222';
const at = '2026-09-16T08:00:00.000Z';
const exactRef = (owner: string, kind: string, id: string, sha: string) => ({
  owner,
  kind,
  id,
  version: 1,
  fingerprintSha256: sha.repeat(64),
  observedAt: at
});
function command(): CreateBusinessAttributionLinkCommand {
  return {
    workspaceId: workspace,
    actorPrincipalId: 'user_professional',
    idempotencyKey: 'portfolio-growth-accepted-1',
    motionKind: 'PORTFOLIO_GROWTH',
    sourceRefs: [
      exactRef('LITE', 'TRADEMARK_ASSET', 'asset_1', 'a'),
      exactRef('LITE', 'TRADEMARK_ASSET_MANAGEMENT_SIGNAL', 'signal_1', 'b'),
      exactRef('MARKREG', 'CUSTOMER_RELATIONSHIP', 'relationship_1', 'c')
    ],
    touchpointRefs: [
      exactRef('LITE', 'OPPORTUNITY_QUALIFICATION_DECISION', 'qualification_1', 'd'),
      exactRef('CAPABILITY_ENGINE', 'MANAGED_COMMUNICATION_MESSAGE', 'message_1', 'e')
    ],
    downstreamRef: exactRef(
      'MARKREG',
      'FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      'opportunity_1',
      'f'
    ),
    attributionState: 'ATTRIBUTED',
    evidenceBasis: 'EXACT_LINEAGE',
    evaluatedAt: at
  };
}

class MemoryDatabase {
  readonly commands = new Map<string, { fingerprint: string; result: BusinessAttributionLinkV1 }>();
  readonly links = new Map<string, BusinessAttributionLinkV1>();
  readonly client = {
    query: (sql: string, params: readonly unknown[] = []) => {
      if (sql.startsWith('SELECT pg_advisory')) return Promise.resolve({ rows: [], rowCount: 1 });
      if (sql.startsWith('SELECT request_fingerprint')) {
        const prior = this.commands.get(`${String(params[0])}:${String(params[1])}`);
        return Promise.resolve({
          rows: prior
            ? [{ request_fingerprint_sha256: prior.fingerprint, result_json: prior.result }]
            : [],
          rowCount: prior ? 1 : 0
        });
      }
      if (sql.startsWith('INSERT INTO lite_business_attribution_links')) {
        const value = JSON.parse(String(params[12])) as BusinessAttributionLinkV1;
        this.links.set(`${String(params[0])}:${String(params[1])}`, value);
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      if (sql.startsWith('INSERT INTO lite_business_attribution_commands')) {
        this.commands.set(`${String(params[0])}:${String(params[1])}`, {
          fingerprint: String(params[2]),
          result: JSON.parse(String(params[3])) as BusinessAttributionLinkV1
        });
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      if (sql.startsWith('SELECT document_json')) {
        if (sql.includes("motion_kind='SITE_INBOUND'")) {
          const values = [...this.links.entries()]
            .filter(
              ([key, value]) =>
                key.startsWith(`${String(params[0])}:`) && value.motionKind === 'SITE_INBOUND'
            )
            .map(([, value]) => ({ document_json: value }));
          return Promise.resolve({ rows: values, rowCount: values.length });
        }
        const value = this.links.get(`${String(params[0])}:${String(params[1])}`);
        return Promise.resolve({
          rows: value ? [{ document_json: value }] : [],
          rowCount: value ? 1 : 0
        });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  transact<T>(work: (client: typeof this.client) => Promise<T>): Promise<T> {
    return work(this.client);
  }
}

describe('PostgresBusinessAttributionStore', () => {
  it('is replay-safe across a store restart and isolated by Workspace', async () => {
    const database = new MemoryDatabase();
    const firstStore = new PostgresBusinessAttributionStore(
      database as never,
      database.client as never,
      () => at,
      () => 'stable'
    );
    const first = await firstStore.create(command());
    const restarted = new PostgresBusinessAttributionStore(
      database as never,
      database.client as never,
      () => at,
      () => 'different'
    );
    await expect(restarted.create(command())).resolves.toEqual(first);
    await expect(restarted.find(workspace, first.businessAttributionLinkId)).resolves.toEqual(
      first
    );
    await expect(
      restarted.find(otherWorkspace, first.businessAttributionLinkId)
    ).resolves.toBeUndefined();
    expect(first.authorityConsequences.conversionCreated).toBe(false);
  });

  it('rejects reuse of an idempotency key for changed owner evidence', async () => {
    const database = new MemoryDatabase();
    const store = new PostgresBusinessAttributionStore(
      database as never,
      database.client as never,
      () => at,
      () => 'stable'
    );
    await store.create(command());
    const { downstreamRef: _downstreamRef, ...withoutDownstream } = command();
    expect(_downstreamRef).toBeDefined();
    await expect(
      store.create({ ...withoutDownstream, attributionState: 'UNKNOWN' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('counts Site/source Intakes separately from exact downstream conversions', async () => {
    const database = new MemoryDatabase();
    let sequence = 0;
    const store = new PostgresBusinessAttributionStore(
      database as never,
      database.client as never,
      () => at,
      () => `site${++sequence}`
    );
    const siteRefs = [
      exactRef('SITE', 'SITE_REQUEST_CONTEXT', 'site_reference', 'a'),
      exactRef('SITE', 'SITE_INBOUND_ACQUISITION', 'site_reference|ai-answer', 'b')
    ];
    await store.create({
      ...command(),
      idempotencyKey: 'site-intake-1',
      motionKind: 'SITE_INBOUND',
      sourceRefs: siteRefs,
      touchpointRefs: [],
      downstreamRef: exactRef('MARKREG', 'PRODUCTION_INTAKE', 'production-intake_1', 'c'),
      attributionState: 'ATTRIBUTED'
    });
    await store.create({
      ...command(),
      idempotencyKey: 'site-matter-1',
      motionKind: 'SITE_INBOUND',
      sourceRefs: siteRefs,
      touchpointRefs: [
        exactRef('MARKREG', 'PRODUCTION_INTAKE', 'production-intake_1', 'c'),
        exactRef('MARKREG', 'PRODUCTION_QUOTE', 'quote_1', 'd'),
        exactRef('MARKREG', 'ORDER', 'order_1', 'e'),
        exactRef('MARKREG', 'CUSTOMER_CONFIRMATION', 'confirmation_1', 'f')
      ],
      downstreamRef: exactRef('MARKREG', 'FORMAL_MATTER', 'formal-matter_1', '1'),
      attributionState: 'ATTRIBUTED'
    });
    await expect(store.summarizeSiteInbound(workspace)).resolves.toMatchObject({
      intakeCount: 1,
      quotePreparedCount: 1,
      orderCount: 1,
      confirmationCount: 1,
      matterCount: 1,
      bySiteSource: [
        {
          siteId: 'site_reference',
          source: 'ai-answer',
          attributionState: 'ATTRIBUTED',
          intakeCount: 1
        }
      ],
      byAttributionState: { ATTRIBUTED: 1, DIRECT: 0, UNATTRIBUTED: 0, UNKNOWN: 0 }
    });
  });
});
