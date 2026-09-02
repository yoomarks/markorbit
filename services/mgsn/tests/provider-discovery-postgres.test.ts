import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProviderDiscoveryRequestReferenceV1 } from '@markorbit/contracts/provider-discovery';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresProviderDiscoverySourceRepository } from '../src/provider-discovery-postgres.js';
import { ProviderDiscoveryService } from '../src/provider-discovery.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_PROVIDER_DISCOVERY_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_PROVIDER_DISCOVERY_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const requesterWorkspaceId = '11111111-1111-4111-8111-111111111111';
const at = '2026-09-02T03:00:00.000Z';

suite('MGSN P0 #544 durable Provider Discovery source projection', () => {
  const namespace = 'mgsn_provider_discovery_544_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 8,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });
  const repository = () => new PostgresProviderDiscoverySourceRepository(database.getPool());
  const request = (): ProviderDiscoveryRequestReferenceV1 => ({
    schemaVersion: 1,
    providerDiscoveryRequestId: 'provider-discovery-request_postgres-544',
    requesterWorkspaceId,
    need: {
      reference: 'need:postgres-544',
      version: 1,
      fingerprintSha256: '1'.repeat(64),
      jurisdiction: 'US',
      serviceType: 'TRADEMARK_APPLICATION'
    },
    purpose: 'PROVIDER_DISCOVERY',
    audience: { kind: 'BOUNDED_NETWORK' },
    contextReference: 'context:postgres-544',
    requestedDataClasses: [
      'PROVIDER_REFERENCE',
      'SUPPLY_PROFILE',
      'SERVICE_JURISDICTIONS',
      'PROVIDER_EVIDENCE_REFERENCE'
    ],
    requestedFields: [
      'providerId',
      'displayName',
      'serviceTypes',
      'jurisdictions',
      'evidenceReferences'
    ],
    requestedAt: at,
    requestFingerprintSha256: '2'.repeat(64),
    correlationId: 'correlation_provider_discovery_postgres_544'
  });
  const workspace = (sequence: number) =>
    `22222222-2222-4222-8222-${String(sequence).padStart(12, '0')}`;
  const providerId = (sequence: number) => `provider_discovery_postgres_544_${sequence}`;
  const supplyId = (sequence: number) =>
    `provider-supply-capability_discovery_postgres_544_${sequence}`;

  async function insertProvider(sequence: number, status = 'ACTIVE') {
    await database.getPool().query(
      `INSERT INTO mgsn_providers(
         provider_id,provider_workspace_id,display_name,operational_status,version,
         provider_record,created_by,updated_by,created_at,updated_at
       ) VALUES($1,$2,$3,$4,1,$5::jsonb,'actor-544','actor-544',$6,$6)`,
      [
        providerId(sequence),
        workspace(sequence),
        `Provider ${sequence}`,
        status,
        JSON.stringify({
          privateCustomerEmail: `customer-${sequence}@private.test`,
          privateMargin: `margin-${sequence}`
        }),
        at
      ]
    );
  }

  async function insertSupply(
    sequence: number,
    input: {
      version?: number;
      current?: boolean;
      status?: string;
      serviceType?: string;
      jurisdiction?: string;
      evidenceReferences?: unknown;
      fingerprint?: string;
    } = {}
  ) {
    const version = input.version ?? 1;
    const fingerprint = input.fingerprint ?? String((sequence % 9) + 1).repeat(64);
    await database.getPool().query(
      `INSERT INTO mgsn_provider_supply_capabilities(
         provider_supply_capability_id,version,provider_id,provider_workspace_id,status,
         jurisdictions,service_types,effective_from,effective_until,capacity_units,
         availability_units,verification_state,evidence_references,source_fingerprint_sha256,
         capability_record,is_current,created_by,updated_by,created_at,updated_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,'2026-01-01T00:00:00.000Z','2027-01-01T00:00:00.000Z',
         9,3,'VERIFIED_FOR_SUPPLY',$8::jsonb,$9,$10::jsonb,$11,'actor-544','actor-544',$12,$12)`,
      [
        supplyId(sequence),
        version,
        providerId(sequence),
        workspace(sequence),
        input.status ?? 'ACTIVE',
        [input.jurisdiction ?? 'US'],
        [input.serviceType ?? 'TRADEMARK_APPLICATION'],
        JSON.stringify(input.evidenceReferences ?? [`provider-evidence:postgres-544-${sequence}`]),
        fingerprint,
        JSON.stringify({ privateQuote: `quote-${sequence}`, rawCustomerSegmentation: 'private' }),
        input.current ?? true,
        at
      ]
    );
  }

  async function insertVisibility(
    sequence: number,
    scope: 'PRIVATE' | 'BOUNDED_PUBLIC' = 'BOUNDED_PUBLIC'
  ) {
    const participationId = `network-participation_discovery_postgres_544_${sequence}`;
    await database.getPool().query(
      `INSERT INTO mgsn_network_participations(
         network_participation_id,version,is_current,workspace_id,provider_id,state,
         authorization_reference,reason,actor_id,correlation_id,occurred_at,created_at
       ) VALUES($1,1,true,$2,$3,'ACTIVE','authority:participation','Explicit participation.',
         'actor-544','correlation-participation-544',$4,$4)`,
      [participationId, workspace(sequence), providerId(sequence), at]
    );
    const visibilityGrants =
      scope === 'PRIVATE'
        ? []
        : [
            {
              dataClass: 'PROVIDER_REFERENCE',
              fields: ['providerId', 'displayName'],
              scope: 'BOUNDED_PUBLIC',
              audience: { kind: 'BOUNDED_NETWORK' },
              purpose: 'PROVIDER_DISCOVERY',
              authorityReferences: ['authority:provider-reference']
            },
            {
              dataClass: 'SUPPLY_PROFILE',
              fields: ['serviceTypes'],
              scope: 'BOUNDED_PUBLIC',
              audience: { kind: 'BOUNDED_NETWORK' },
              purpose: 'PROVIDER_DISCOVERY',
              authorityReferences: ['authority:supply-profile']
            },
            {
              dataClass: 'SERVICE_JURISDICTIONS',
              fields: ['jurisdictions'],
              scope: 'BOUNDED_PUBLIC',
              audience: { kind: 'BOUNDED_NETWORK' },
              purpose: 'PROVIDER_DISCOVERY',
              authorityReferences: ['authority:jurisdictions']
            },
            {
              dataClass: 'PROVIDER_EVIDENCE_REFERENCE',
              fields: ['evidenceReferences'],
              scope: 'BOUNDED_PUBLIC',
              audience: { kind: 'BOUNDED_NETWORK' },
              purpose: 'PROVIDER_DISCOVERY',
              authorityReferences: ['authority:evidence-reference']
            }
          ];
    await database.getPool().query(
      `INSERT INTO mgsn_network_visibility_policies(
         network_participation_id,version,participation_version,is_current,scope,grants,
         authorization_reference,reason,actor_id,correlation_id,updated_at,created_at
       ) VALUES($1,1,1,true,$2,$3::jsonb,'authority:visibility','Explicit current policy.',
         'actor-544','correlation-visibility-544',$4,$4)`,
      [participationId, scope, JSON.stringify(visibilityGrants), at]
    );
  }

  async function insertVisibleSource(sequence: number) {
    await insertProvider(sequence);
    await insertSupply(sequence);
    await insertVisibility(sequence);
  }

  beforeAll(() => database.start());

  beforeEach(async () => {
    await resetAndMigrateMgsnTestDatabase({
      pool: database.getPool(),
      namespace,
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });

  afterAll(() => database.close());

  it('projects multiple Provider Workspaces in deterministic neutral order from current normalized rows', async () => {
    await insertVisibleSource(2);
    await insertVisibleSource(1);
    const batch = await repository().queryCurrentSources({
      serviceType: 'TRADEMARK_APPLICATION',
      jurisdiction: 'US',
      effectiveAt: at,
      limit: 10
    });
    expect(batch.complete).toBe(true);
    expect(batch.sources.map((source) => source.provider.providerId)).toEqual([
      providerId(1),
      providerId(2)
    ]);
    expect(batch.sources.every((source) => source.participation.state === 'ACTIVE')).toBe(true);
  });

  it('uses only current Supply rows and narrows service, jurisdiction, period, and operational truth', async () => {
    await insertProvider(1);
    await insertSupply(1, { version: 1, current: false, serviceType: 'OFFICE_ACTION' });
    await insertSupply(1, { version: 2, current: true });
    await insertVisibility(1);
    await insertProvider(2);
    await insertSupply(2, { serviceType: 'OFFICE_ACTION' });
    await insertVisibility(2);
    await insertProvider(3);
    await insertSupply(3, { jurisdiction: 'CA' });
    await insertVisibility(3);
    await insertProvider(4, 'SUSPENDED');
    await insertSupply(4);
    await insertVisibility(4);

    const batch = await repository().queryCurrentSources({
      serviceType: 'TRADEMARK_APPLICATION',
      jurisdiction: 'US',
      effectiveAt: at,
      limit: 10
    });
    expect(batch.sources).toHaveLength(1);
    expect(batch.sources[0]!.supply.version).toBe(2);
    expect(batch.sources[0]!.supply.serviceTypes).toEqual(['TRADEMARK_APPLICATION']);
    expect(batch.sources[0]!.supply.jurisdictions).toEqual(['US']);
  });

  it('uses the current Visibility Policy rather than historical public provenance', async () => {
    await insertVisibleSource(1);
    const participationId = 'network-participation_discovery_postgres_544_1';
    await database
      .getPool()
      .query(
        'UPDATE mgsn_network_visibility_policies SET is_current=false WHERE network_participation_id=$1',
        [participationId]
      );
    await database.getPool().query(
      `INSERT INTO mgsn_network_visibility_policies(
         network_participation_id,version,participation_version,is_current,scope,grants,
         authorization_reference,reason,actor_id,correlation_id,updated_at,created_at
       ) VALUES($1,2,1,true,'PRIVATE','[]'::jsonb,'authority:private','Contracted to private.',
         'actor-544','correlation-private-544',$2,$2)`,
      [participationId, at]
    );
    const result = await new ProviderDiscoveryService(repository()).evaluate(
      { workspaceId: requesterWorkspaceId, actorId: 'user-544' },
      request()
    );
    expect(result).toMatchObject({ status: 'NO_AUTHORIZED_CANDIDATES', candidates: [] });
  });

  it('marks the source incomplete when the neutral scan bound is exhausted', async () => {
    await insertVisibleSource(1);
    await insertVisibleSource(2);
    const batch = await repository().queryCurrentSources({
      serviceType: 'TRADEMARK_APPLICATION',
      jurisdiction: 'US',
      effectiveAt: at,
      limit: 1
    });
    expect(batch).toEqual({ sources: [], complete: false });
    const result = await new ProviderDiscoveryService(repository(), undefined, 1).evaluate(
      { workspaceId: requesterWorkspaceId, actorId: 'user-544' },
      request()
    );
    expect(result).toMatchObject({ status: 'AUTHORITY_UNAVAILABLE', candidates: [] });
  });

  it('fails closed when a required normalized owner record is malformed', async () => {
    await insertVisibleSource(1);
    await database.getPool().query(
      `UPDATE mgsn_provider_supply_capabilities
          SET evidence_references='{"malformed":true}'::jsonb
        WHERE provider_supply_capability_id=$1 AND is_current`,
      [supplyId(1)]
    );
    await expect(
      repository().queryCurrentSources({
        serviceType: 'TRADEMARK_APPLICATION',
        jurisdiction: 'US',
        effectiveAt: at,
        limit: 10
      })
    ).rejects.toThrow(/evidence references is malformed/i);
    const result = await new ProviderDiscoveryService(repository()).evaluate(
      { workspaceId: requesterWorkspaceId, actorId: 'user-544' },
      request()
    );
    expect(result.status).toBe('AUTHORITY_UNAVAILABLE');
  });

  it('is restart deterministic and never reads private Provider/Supply JSON or customer context', async () => {
    await insertVisibleSource(1);
    const first = await new ProviderDiscoveryService(repository()).evaluate(
      { workspaceId: requesterWorkspaceId, actorId: 'user-544' },
      request()
    );
    const second = await new ProviderDiscoveryService(repository()).evaluate(
      { workspaceId: requesterWorkspaceId, actorId: 'user-544' },
      request()
    );
    expect(second).toEqual(first);
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain('customer-1@private.test');
    expect(serialized).not.toContain('margin-1');
    expect(serialized).not.toContain('quote-1');
    expect(serialized).not.toContain('rawCustomerSegmentation');
    expect(serialized).not.toContain('capacityUnits');
    expect(serialized).not.toContain('availabilityUnits');
  });
});
