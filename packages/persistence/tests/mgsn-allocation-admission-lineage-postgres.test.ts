import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const url = process.env.PERSISTENCE_TEST_DATABASE_URL;
const required = process.env.PERSISTENCE_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error('PERSISTENCE_TEST_REQUIRED=1 requires PERSISTENCE_TEST_DATABASE_URL.');
}
const integration = url ? describe : describe.skip;

const workspaceId = '018f0000-0000-7000-8000-000000000712';
const providerWorkspaceId = '018f0000-0000-7000-8000-000000007120';
const providerId = 'provider_p712';
const supplyId = 'provider-supply-capability_p712';
const servicePackageId = 'service-package_p712';
const selectionId = 'provider-selection_p712';
const handoffId = 'controlled-handoff_p712';
const serviceFingerprint = 'a'.repeat(64);
const supplyFingerprint = 'b'.repeat(64);
const selectionScopeFingerprint = 'c'.repeat(64);
const handoffPurposeFingerprint = 'd'.repeat(64);
const handoffProjectionFingerprint = 'e'.repeat(64);
const handoffSourceSetFingerprint = 'f'.repeat(64);
const handoffEnvelopeFingerprint = '1'.repeat(64);
const selectionValidationFingerprint = '2'.repeat(64);
const directExecutorFingerprint = '3'.repeat(64);
const lineageFingerprint = '4'.repeat(64);
const handoffValidationFingerprint = '5'.repeat(64);
const createdAt = '2026-09-03T06:45:00.000Z';

type Row = Record<string, unknown>;

function quoted(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function insert(client: PoolClient, table: string, row: Row) {
  const entries = Object.entries(row);
  const columns = entries.map(([column]) => quoted(column)).join(',');
  const placeholders = entries.map((_, index) => `$${index + 1}`).join(',');
  await client.query(
    `INSERT INTO ${quoted(table)}(${columns}) VALUES(${placeholders})`,
    entries.map(([, value]) => value)
  );
}

async function expectDatabaseRejection(
  client: PoolClient,
  operation: () => Promise<unknown>,
  expected?: RegExp
) {
  await client.query('SAVEPOINT expected_database_rejection');
  let caught: unknown;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT expected_database_rejection');
  await client.query('RELEASE SAVEPOINT expected_database_rejection');
  expect(caught).toBeDefined();
  if (expected) {
    expect(caught instanceof Error ? caught.message : String(caught)).toMatch(expected);
  }
}

function baseLineage(allocationId: string, suffix: string): Row {
  return {
    allocation_admission_lineage_id: `allocation-admission-lineage_${suffix}`,
    version: 1,
    allocation_id: allocationId,
    allocation_version: 1,
    originating_workspace_id: workspaceId,
    service_package_id: servicePackageId,
    service_package_version: 4,
    service_package_fingerprint_sha256: serviceFingerprint,
    provider_id: providerId,
    provider_workspace_id: providerWorkspaceId,
    provider_supply_capability_id: supplyId,
    provider_supply_capability_version: 7,
    provider_supply_capability_fingerprint_sha256: supplyFingerprint,
    provider_selection_id: selectionId,
    selection_version: 2,
    selection_scope_version: 3,
    selection_scope_fingerprint_sha256: selectionScopeFingerprint,
    selection_validation_purpose: 'ALLOCATION_PREREQUISITE_REVIEW',
    selection_validation_decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
    selection_validation_currently_usable: true,
    selection_validation_evaluated_at: '2026-09-03T06:43:00.000Z',
    selection_validation_policy_version: 'mgsn-allocation-admission-v1',
    selection_validation_checked_authority_references: JSON.stringify(['authority:selection:p712']),
    selection_validation_fingerprint_sha256: selectionValidationFingerprint,
    selection_validation_does_not_authorize_downstream_action: true,
    direct_executor_established: true,
    direct_executor_provider_id: providerId,
    direct_executor_provider_workspace_id: providerWorkspaceId,
    direct_executor_authority_reference: 'authority:direct-executor:p712',
    direct_executor_authority_version: JSON.stringify(9),
    direct_executor_checked_at: '2026-09-03T06:44:00.000Z',
    direct_executor_validation_fingerprint_sha256: directExecutorFingerprint,
    current_authority_revalidation_required_before_owner_commit: true,
    handoff_binding_state: 'NO_CONTROLLED_HANDOFF_BY_DESIGN',
    controlled_handoff_id: null,
    controlled_handoff_version: null,
    controlled_handoff_envelope_fingerprint_sha256: null,
    handoff_purpose_fingerprint_sha256: null,
    handoff_projection_fingerprint_sha256: null,
    handoff_source_set_fingerprint_sha256: null,
    handoff_validation_purpose: null,
    handoff_validation_decision: null,
    handoff_validation_currently_usable: null,
    handoff_validation_current_exact_disclosure_permitted: null,
    handoff_validation_evaluated_at: null,
    handoff_validation_policy_version: null,
    handoff_validation_checked_authority_references: null,
    handoff_validation_fingerprint_sha256: null,
    handoff_validation_is_not_bearer_capability: null,
    handoff_validation_does_not_authorize_downstream_action: null,
    lineage_fingerprint_sha256: lineageFingerprint,
    correlation_id: `correlation_${suffix}`,
    created_at: createdAt,
    contains_incoming_field_values: false,
    contains_bearer_secrets: false,
    contains_raw_customer_data: false,
    contains_raw_evidence_artifacts: false,
    contains_end_client_relationship_information: false,
    contains_pricing_margin_or_profit: false,
    provider_acceptance_authorized: false,
    provider_contact_authorized: false,
    professional_appointment_created: false,
    protected_action_released: false,
    filing_authorized: false,
    filing_submitted: false,
    payment_authorized: false,
    payment_created: false,
    official_truth_created: false,
    matter_completed: false
  };
}

function exactHandoffLineage(allocationId: string, suffix: string): Row {
  return {
    ...baseLineage(allocationId, suffix),
    handoff_binding_state: 'EXACT_CONTROLLED_HANDOFF',
    controlled_handoff_id: handoffId,
    controlled_handoff_version: 5,
    controlled_handoff_envelope_fingerprint_sha256: handoffEnvelopeFingerprint,
    handoff_purpose_fingerprint_sha256: handoffPurposeFingerprint,
    handoff_projection_fingerprint_sha256: handoffProjectionFingerprint,
    handoff_source_set_fingerprint_sha256: handoffSourceSetFingerprint,
    handoff_validation_purpose: 'HANDOFF_CONSUMPTION',
    handoff_validation_decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
    handoff_validation_currently_usable: true,
    handoff_validation_current_exact_disclosure_permitted: true,
    handoff_validation_evaluated_at: '2026-09-03T06:44:30.000Z',
    handoff_validation_policy_version: 'mgsn-controlled-handoff-consumption-v1',
    handoff_validation_checked_authority_references: JSON.stringify(['authority:handoff:p712']),
    handoff_validation_fingerprint_sha256: handoffValidationFingerprint,
    handoff_validation_is_not_bearer_capability: true,
    handoff_validation_does_not_authorize_downstream_action: true
  };
}

integration('MGSN #712 exact Allocation admission lineage PostgreSQL constraints', () => {
  let pool: Pool;
  let client: PoolClient;
  let schema: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url! });
    client = await pool.connect();
    schema = `mgsn_p712_${process.pid}_${Date.now()}`;
    await client.query(`CREATE SCHEMA ${quoted(schema)}`);
    await client.query(`SET search_path TO ${quoted(schema)}`);
    await client.query(`
      CREATE TABLE mgsn_allocations(
        allocation_id text NOT NULL,
        version integer NOT NULL,
        is_current boolean NOT NULL,
        workspace_id uuid NOT NULL,
        service_package_id text NOT NULL,
        service_package_version integer NOT NULL,
        service_package_fingerprint_sha256 text NOT NULL,
        provider_id text NOT NULL,
        provider_supply_capability_id text NOT NULL,
        provider_supply_capability_version integer NOT NULL,
        provider_supply_capability_fingerprint_sha256 text NOT NULL,
        status text NOT NULL,
        PRIMARY KEY(allocation_id,version)
      );
      CREATE TABLE mgsn_service_packages(
        service_package_id text PRIMARY KEY,
        workspace_id uuid NOT NULL,
        version integer NOT NULL,
        service_package_fingerprint_sha256 text NOT NULL,
        status text NOT NULL
      );
      CREATE TABLE mgsn_providers(
        provider_id text PRIMARY KEY,
        provider_workspace_id uuid NOT NULL,
        operational_status text NOT NULL,
        UNIQUE(provider_id,provider_workspace_id)
      );
      CREATE TABLE mgsn_provider_supply_capabilities(
        provider_supply_capability_id text NOT NULL,
        version integer NOT NULL,
        provider_id text NOT NULL,
        provider_workspace_id uuid NOT NULL,
        source_fingerprint_sha256 text NOT NULL,
        status text NOT NULL,
        is_current boolean NOT NULL,
        PRIMARY KEY(provider_supply_capability_id,version)
      );
      CREATE TABLE mgsn_provider_selection_versions(
        provider_selection_id text NOT NULL,
        version integer NOT NULL,
        scope_version integer NOT NULL,
        requester_workspace_id uuid NOT NULL,
        scope_fingerprint_sha256 text NOT NULL,
        provider_id text NOT NULL,
        provider_workspace_id uuid NOT NULL,
        provider_supply_capability_id text NOT NULL,
        provider_supply_capability_version integer NOT NULL,
        provider_supply_capability_fingerprint_sha256 text NOT NULL,
        status text NOT NULL,
        PRIMARY KEY(provider_selection_id,version),
        UNIQUE(provider_selection_id,version,scope_version)
      );
      CREATE TABLE mgsn_controlled_handoff_versions(
        controlled_handoff_id text NOT NULL,
        version integer NOT NULL,
        originating_workspace_id uuid NOT NULL,
        recipient_provider_id text NOT NULL,
        recipient_provider_workspace_id uuid NOT NULL,
        selection_provider_selection_id text NOT NULL,
        selection_version integer NOT NULL,
        selection_scope_version integer NOT NULL,
        purpose_fingerprint_sha256 text NOT NULL,
        projection_fingerprint_sha256 text NOT NULL,
        source_set_fingerprint_sha256 text NOT NULL,
        envelope_fingerprint_sha256 text NOT NULL,
        status text NOT NULL,
        revoked_at timestamptz,
        valid_from timestamptz NOT NULL,
        valid_until timestamptz NOT NULL,
        direct_executor_established boolean NOT NULL,
        final_execution_provider_id text NOT NULL,
        final_execution_provider_workspace_id uuid NOT NULL,
        PRIMARY KEY(controlled_handoff_id,version)
      );
    `);
    for (const migrationName of [
      '0092_mgsn_allocation_admission_lineage.sql',
      '0093_mgsn_allocation_admission_lineage_integrity.sql',
      '0094_mgsn_allocation_admission_lineage_replay_audit_integrity.sql'
    ]) {
      const migration = await readFile(
        path.resolve('../../infrastructure/persistence/migrations', migrationName),
        'utf8'
      );
      await client.query(migration);
    }
  });

  beforeEach(async () => {
    await client.query('BEGIN');
    await insert(client, 'mgsn_providers', {
      provider_id: providerId,
      provider_workspace_id: providerWorkspaceId,
      operational_status: 'ACTIVE'
    });
    await insert(client, 'mgsn_provider_supply_capabilities', {
      provider_supply_capability_id: supplyId,
      version: 7,
      provider_id: providerId,
      provider_workspace_id: providerWorkspaceId,
      source_fingerprint_sha256: supplyFingerprint,
      status: 'ACTIVE',
      is_current: true
    });
    await insert(client, 'mgsn_service_packages', {
      service_package_id: servicePackageId,
      workspace_id: workspaceId,
      version: 4,
      service_package_fingerprint_sha256: serviceFingerprint,
      status: 'ADMITTED'
    });
    await insert(client, 'mgsn_provider_selection_versions', {
      provider_selection_id: selectionId,
      version: 2,
      scope_version: 3,
      requester_workspace_id: workspaceId,
      scope_fingerprint_sha256: selectionScopeFingerprint,
      provider_id: providerId,
      provider_workspace_id: providerWorkspaceId,
      provider_supply_capability_id: supplyId,
      provider_supply_capability_version: 7,
      provider_supply_capability_fingerprint_sha256: supplyFingerprint,
      status: 'CURRENT'
    });
    await insert(client, 'mgsn_controlled_handoff_versions', {
      controlled_handoff_id: handoffId,
      version: 5,
      originating_workspace_id: workspaceId,
      recipient_provider_id: providerId,
      recipient_provider_workspace_id: providerWorkspaceId,
      selection_provider_selection_id: selectionId,
      selection_version: 2,
      selection_scope_version: 3,
      purpose_fingerprint_sha256: handoffPurposeFingerprint,
      projection_fingerprint_sha256: handoffProjectionFingerprint,
      source_set_fingerprint_sha256: handoffSourceSetFingerprint,
      envelope_fingerprint_sha256: handoffEnvelopeFingerprint,
      status: 'AUTHORIZED',
      revoked_at: null,
      valid_from: '2026-09-03T06:00:00.000Z',
      valid_until: '2026-09-04T06:00:00.000Z',
      direct_executor_established: true,
      final_execution_provider_id: providerId,
      final_execution_provider_workspace_id: providerWorkspaceId
    });
    for (const allocationId of [
      'allocation_p712_legacy',
      'allocation_p712_no_handoff',
      'allocation_p712_handoff',
      'allocation_p712_mismatch'
    ]) {
      await insert(client, 'mgsn_allocations', {
        allocation_id: allocationId,
        version: 1,
        is_current: true,
        workspace_id: workspaceId,
        service_package_id: servicePackageId,
        service_package_version: 4,
        service_package_fingerprint_sha256: serviceFingerprint,
        provider_id: providerId,
        provider_supply_capability_id: supplyId,
        provider_supply_capability_version: 7,
        provider_supply_capability_fingerprint_sha256: supplyFingerprint,
        status: 'ACTIVE'
      });
    }
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  afterAll(async () => {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA ${quoted(schema)} CASCADE`);
    client.release();
    await pool.end();
  });

  it('does not infer or backfill lineage for a legacy Allocation', async () => {
    const result = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM mgsn_allocation_admission_lineages WHERE allocation_id='allocation_p712_legacy'"
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it('persists explicit no-Handoff-by-design lineage and makes it immutable', async () => {
    const row = baseLineage('allocation_p712_no_handoff', 'p712_no_handoff');
    await insert(client, 'mgsn_allocation_admission_lineages', row);
    const stored = await client.query(
      `SELECT handoff_binding_state,provider_acceptance_authorized,filing_authorized,payment_created
         FROM mgsn_allocation_admission_lineages WHERE allocation_admission_lineage_id=$1`,
      [row.allocation_admission_lineage_id]
    );
    expect(stored.rows[0]).toMatchObject({
      handoff_binding_state: 'NO_CONTROLLED_HANDOFF_BY_DESIGN',
      provider_acceptance_authorized: false,
      filing_authorized: false,
      payment_created: false
    });
    await expectDatabaseRejection(
      client,
      () =>
        client.query(
          'UPDATE mgsn_allocation_admission_lineages SET correlation_id=$1 WHERE allocation_admission_lineage_id=$2',
          ['correlation_changed', row.allocation_admission_lineage_id]
        ),
      /append-only and immutable/u
    );
  });

  it('rejects stale or substituted Service Package and Selection identity', async () => {
    await expectDatabaseRejection(
      client,
      () =>
        insert(client, 'mgsn_allocation_admission_lineages', {
          ...baseLineage('allocation_p712_mismatch', 'p712_bad_service'),
          service_package_fingerprint_sha256: '9'.repeat(64)
        }),
      /exact current Allocation source set|Service Package is stale or mismatched/u
    );
  });

  it('fails closed when exact Handoff validation descriptors are null', async () => {
    await expectDatabaseRejection(client, () =>
      insert(client, 'mgsn_allocation_admission_lineages', {
        ...exactHandoffLineage('allocation_p712_handoff', 'p712_null_handoff_policy'),
        handoff_validation_policy_version: null
      })
    );
  });

  it('binds the exact Controlled Handoff and rejects projection substitution', async () => {
    const exact = exactHandoffLineage('allocation_p712_handoff', 'p712_handoff');
    await insert(client, 'mgsn_allocation_admission_lineages', exact);
    const stored = await client.query(
      `SELECT controlled_handoff_id,controlled_handoff_version,handoff_projection_fingerprint_sha256
         FROM mgsn_allocation_admission_lineages WHERE allocation_admission_lineage_id=$1`,
      [exact.allocation_admission_lineage_id]
    );
    expect(stored.rows[0]).toMatchObject({
      controlled_handoff_id: handoffId,
      controlled_handoff_version: 5,
      handoff_projection_fingerprint_sha256: handoffProjectionFingerprint
    });
    await expectDatabaseRejection(
      client,
      () =>
        insert(client, 'mgsn_allocation_admission_lineages', {
          ...exactHandoffLineage('allocation_p712_handoff', 'p712_substituted_handoff'),
          handoff_projection_fingerprint_sha256: '8'.repeat(64)
        }),
      /Controlled Handoff is stale or mismatched/u
    );
  });

  it('pins one replay identity to one immutable Allocation lineage', async () => {
    const lineage = exactHandoffLineage('allocation_p712_handoff', 'p712_replay');
    const otherLineage = baseLineage('allocation_p712_no_handoff', 'p712_replay_other');
    await insert(client, 'mgsn_allocation_admission_lineages', lineage);
    await insert(client, 'mgsn_allocation_admission_lineages', otherLineage);
    const replay = {
      scope_key: 'allocation-admission-lineage:p712',
      idempotency_key: 'allocate:p712:1',
      request_fingerprint_sha256: '6'.repeat(64),
      allocation_id: 'allocation_p712_handoff',
      allocation_version: 1,
      allocation_admission_lineage_id: lineage.allocation_admission_lineage_id,
      lineage_version: 1,
      lineage_fingerprint_sha256: lineageFingerprint,
      correlation_id: 'correlation_p712_replay',
      created_at: createdAt
    };
    await insert(client, 'mgsn_allocation_admission_lineage_replays', replay);
    await expectDatabaseRejection(client, () =>
      insert(client, 'mgsn_allocation_admission_lineage_replays', {
        ...replay,
        request_fingerprint_sha256: '7'.repeat(64)
      })
    );
    await expectDatabaseRejection(
      client,
      () =>
        insert(client, 'mgsn_allocation_admission_lineage_replays', {
          ...replay,
          scope_key: 'allocation-admission-lineage:p712-cross-binding',
          idempotency_key: 'allocate:p712:cross-binding',
          allocation_id: 'allocation_p712_mismatch',
          allocation_admission_lineage_id: otherLineage.allocation_admission_lineage_id,
          lineage_fingerprint_sha256: otherLineage.lineage_fingerprint_sha256
        }),
      /mgsn_allocation_admission_lineage_replays_exact_binding_fk/u
    );
  });

  it('keeps the privacy-safe owner audit append-only', async () => {
    const lineage = baseLineage('allocation_p712_no_handoff', 'p712_audit');
    await insert(client, 'mgsn_allocation_admission_lineages', lineage);
    await insert(client, 'mgsn_allocation_admission_lineage_audit', {
      originating_workspace_id: workspaceId,
      allocation_id: 'allocation_p712_no_handoff',
      allocation_version: 1,
      allocation_admission_lineage_id: lineage.allocation_admission_lineage_id,
      lineage_version: 1,
      action: 'GOVERNED_ALLOCATION_LINEAGE_BOUND',
      actor_id: 'user_p712',
      selection_validation_fingerprint_sha256: selectionValidationFingerprint,
      handoff_binding_state: 'NO_CONTROLLED_HANDOFF_BY_DESIGN',
      handoff_validation_fingerprint_sha256: null,
      lineage_fingerprint_sha256: lineageFingerprint,
      correlation_id: 'correlation_p712_audit',
      created_at: createdAt
    });
    await expectDatabaseRejection(
      client,
      () =>
        insert(client, 'mgsn_allocation_admission_lineage_audit', {
          originating_workspace_id: workspaceId,
          allocation_id: 'allocation_p712_mismatch',
          allocation_version: 1,
          allocation_admission_lineage_id: lineage.allocation_admission_lineage_id,
          lineage_version: 1,
          action: 'GOVERNED_ALLOCATION_LINEAGE_BOUND',
          actor_id: 'user_p712_cross_binding',
          selection_validation_fingerprint_sha256: selectionValidationFingerprint,
          handoff_binding_state: 'NO_CONTROLLED_HANDOFF_BY_DESIGN',
          handoff_validation_fingerprint_sha256: null,
          lineage_fingerprint_sha256: lineageFingerprint,
          correlation_id: 'correlation_p712_cross_binding',
          created_at: createdAt
        }),
      /does not match its exact lineage binding/u
    );
    await expectDatabaseRejection(
      client,
      () =>
        client.query('DELETE FROM mgsn_allocation_admission_lineage_audit WHERE actor_id=$1', [
          'user_p712'
        ]),
      /append-only and immutable/u
    );
  });
});
