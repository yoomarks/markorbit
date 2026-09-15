import type {
  SiteConfigurationVersionV1,
  SiteHostBindingV1,
  SiteInstallationV1
} from '@markorbit/contracts/site';
import type { ManagedDatabase } from '@markorbit/persistence';
import { SiteServiceError, type SiteMutationV1, type SiteRepositoryV1 } from './site-service.js';

type JsonRow = { record_json: unknown };
type HeadRow = { workspace_id: string; version: number };

function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function stored<T>(value: unknown): T {
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { schemaVersion?: unknown }).schemaVersion !== 1
  )
    throw new SiteServiceError('CONFLICT', 'Stored Site record is invalid.');
  return structuredClone(value) as T;
}

function translate(error: unknown): never {
  if (error instanceof SiteServiceError) throw error;
  if (pgCode(error) === '23505')
    throw new SiteServiceError('CONFLICT', 'Site uniqueness or version boundary was violated.');
  throw new SiteServiceError('CONFLICT', 'Site persistence is unavailable.', true, {
    cause: error instanceof Error ? error : undefined
  });
}

export class PostgresSiteRepositoryV1 implements SiteRepositoryV1 {
  constructor(private readonly database: ManagedDatabase) {}

  async replayCommand<T>(
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<T | undefined> {
    try {
      const result = await this.database.getPool().query<{
        request_fingerprint: string;
        response_json: unknown;
      }>(
        `SELECT request_fingerprint,response_json FROM site_commands
         WHERE workspace_id=$1 AND idempotency_key=$2`,
        [workspaceId, idempotencyKey]
      );
      const row = result.rows[0];
      if (!row) return undefined;
      if (row.request_fingerprint !== requestFingerprint)
        throw new SiteServiceError(
          'IDEMPOTENCY_KEY_REUSE',
          'Idempotency key is already bound to another Site command.'
        );
      return structuredClone(row.response_json) as T;
    } catch (error) {
      return translate(error);
    }
  }

  async commitMutation<T>(mutation: Readonly<SiteMutationV1<T>>): Promise<T> {
    const client = await this.database.getPool().connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO site_commands(workspace_id,idempotency_key,request_fingerprint,response_json,created_at)
         VALUES($1,$2,$3,$4::jsonb,now()) ON CONFLICT DO NOTHING`,
        [
          mutation.workspaceId,
          mutation.idempotencyKey,
          mutation.requestFingerprint,
          JSON.stringify(mutation.response)
        ]
      );
      if (inserted.rowCount === 0) {
        const replay = await client.query<{ request_fingerprint: string; response_json: unknown }>(
          `SELECT request_fingerprint,response_json FROM site_commands
           WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE`,
          [mutation.workspaceId, mutation.idempotencyKey]
        );
        const row = replay.rows[0];
        if (!row || row.request_fingerprint !== mutation.requestFingerprint)
          throw new SiteServiceError(
            'IDEMPOTENCY_KEY_REUSE',
            'Idempotency key is already bound to another Site command.'
          );
        await client.query('COMMIT');
        return structuredClone(row.response_json) as T;
      }

      if (mutation.expectedSiteVersion !== undefined) {
        const siteId = mutation.installation?.siteId ?? mutation.binding?.siteId;
        if (!siteId) throw new SiteServiceError('INVALID_INPUT', 'Site identity is required.');
        const head = await client.query<HeadRow>(
          'SELECT workspace_id,version FROM site_installation_heads WHERE site_id=$1 FOR UPDATE',
          [siteId]
        );
        const current = head.rows[0];
        if ((current?.version ?? 0) !== mutation.expectedSiteVersion)
          throw new SiteServiceError('CONFLICT', 'Expected Site version is no longer current.');
        if (current && current.workspace_id !== mutation.workspaceId)
          throw new SiteServiceError('WORKSPACE_MISMATCH', 'Site belongs to another Workspace.');
      }
      if (mutation.expectedBindingVersion !== undefined) {
        const bindingId = mutation.binding?.bindingId;
        if (!bindingId)
          throw new SiteServiceError('INVALID_INPUT', 'Host binding identity is required.');
        const head = await client.query<HeadRow>(
          'SELECT workspace_id,version FROM site_host_binding_heads WHERE binding_id=$1 FOR UPDATE',
          [bindingId]
        );
        const current = head.rows[0];
        if ((current?.version ?? 0) !== mutation.expectedBindingVersion)
          throw new SiteServiceError(
            'CONFLICT',
            'Expected host binding version is no longer current.'
          );
        if (current && current.workspace_id !== mutation.workspaceId)
          throw new SiteServiceError(
            'WORKSPACE_MISMATCH',
            'Host binding belongs to another Workspace.'
          );
      }

      if (mutation.configuration)
        await client.query(
          `INSERT INTO site_configuration_versions(site_id,workspace_id,version,record_json,recorded_at)
           VALUES($1,$2,$3,$4::jsonb,$5)`,
          [
            mutation.configuration.siteId,
            mutation.configuration.workspaceId,
            mutation.configuration.version,
            JSON.stringify(mutation.configuration),
            mutation.configuration.recordedAt
          ]
        );

      if (mutation.installation) {
        const value = mutation.installation;
        await client.query(
          `INSERT INTO site_installation_versions(site_id,workspace_id,version,lifecycle,record_json,recorded_at)
           VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [
            value.siteId,
            value.workspaceId,
            value.version,
            value.lifecycle,
            JSON.stringify(value),
            value.recordedAt
          ]
        );
        if (mutation.expectedSiteVersion === 0)
          await client.query(
            `INSERT INTO site_installation_heads(site_id,workspace_id,version,lifecycle,record_json)
             VALUES($1,$2,$3,$4,$5::jsonb)`,
            [value.siteId, value.workspaceId, value.version, value.lifecycle, JSON.stringify(value)]
          );
        else {
          const updated = await client.query(
            `UPDATE site_installation_heads SET version=$3,lifecycle=$4,record_json=$5::jsonb
             WHERE site_id=$1 AND workspace_id=$2 AND version=$6`,
            [
              value.siteId,
              value.workspaceId,
              value.version,
              value.lifecycle,
              JSON.stringify(value),
              mutation.expectedSiteVersion
            ]
          );
          if (updated.rowCount !== 1)
            throw new SiteServiceError('CONFLICT', 'Expected Site version is no longer current.');
        }
      }

      if (mutation.binding) {
        const value = mutation.binding;
        await client.query(
          `INSERT INTO site_host_binding_versions(
             binding_id,site_id,workspace_id,normalized_hostname,binding_type,version,status,
             record_json,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
          [
            value.bindingId,
            value.siteId,
            value.workspaceId,
            value.normalizedHostname,
            value.bindingType,
            value.version,
            value.status,
            JSON.stringify(value),
            value.recordedAt
          ]
        );
        if (mutation.expectedBindingVersion === 0)
          await client.query(
            `INSERT INTO site_host_binding_heads(
               binding_id,site_id,workspace_id,normalized_hostname,binding_type,version,status,record_json
             ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
            [
              value.bindingId,
              value.siteId,
              value.workspaceId,
              value.normalizedHostname,
              value.bindingType,
              value.version,
              value.status,
              JSON.stringify(value)
            ]
          );
        else {
          const updated = await client.query(
            `UPDATE site_host_binding_heads
               SET normalized_hostname=$4,binding_type=$5,version=$6,status=$7,record_json=$8::jsonb
             WHERE binding_id=$1 AND site_id=$2 AND workspace_id=$3 AND version=$9`,
            [
              value.bindingId,
              value.siteId,
              value.workspaceId,
              value.normalizedHostname,
              value.bindingType,
              value.version,
              value.status,
              JSON.stringify(value),
              mutation.expectedBindingVersion
            ]
          );
          if (updated.rowCount !== 1)
            throw new SiteServiceError(
              'CONFLICT',
              'Expected host binding version is no longer current.'
            );
        }
      }

      await client.query('COMMIT');
      return structuredClone(mutation.response);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return translate(error);
    } finally {
      client.release();
    }
  }

  async listCurrentInstallations(workspaceId: string): Promise<readonly SiteInstallationV1[]> {
    try {
      const result = await this.database.getPool().query<JsonRow>(
        `SELECT record_json FROM site_installation_heads
         WHERE workspace_id=$1 ORDER BY site_id`,
        [workspaceId]
      );
      return result.rows.map((row) => stored<SiteInstallationV1>(row.record_json));
    } catch (error) {
      return translate(error);
    }
  }

  async getCurrentInstallation(siteId: string): Promise<SiteInstallationV1 | undefined> {
    try {
      const result = await this.database
        .getPool()
        .query<JsonRow>('SELECT record_json FROM site_installation_heads WHERE site_id=$1', [
          siteId
        ]);
      return result.rows[0] ? stored<SiteInstallationV1>(result.rows[0].record_json) : undefined;
    } catch (error) {
      return translate(error);
    }
  }

  async getConfiguration(
    siteId: string,
    version: number
  ): Promise<SiteConfigurationVersionV1 | undefined> {
    try {
      const result = await this.database
        .getPool()
        .query<JsonRow>(
          'SELECT record_json FROM site_configuration_versions WHERE site_id=$1 AND version=$2',
          [siteId, version]
        );
      return result.rows[0]
        ? stored<SiteConfigurationVersionV1>(result.rows[0].record_json)
        : undefined;
    } catch (error) {
      return translate(error);
    }
  }

  async getCurrentBinding(bindingId: string): Promise<SiteHostBindingV1 | undefined> {
    try {
      const result = await this.database
        .getPool()
        .query<JsonRow>('SELECT record_json FROM site_host_binding_heads WHERE binding_id=$1', [
          bindingId
        ]);
      return result.rows[0] ? stored<SiteHostBindingV1>(result.rows[0].record_json) : undefined;
    } catch (error) {
      return translate(error);
    }
  }

  async listCurrentBindings(siteId: string): Promise<readonly SiteHostBindingV1[]> {
    try {
      const result = await this.database.getPool().query<JsonRow>(
        `SELECT record_json FROM site_host_binding_heads
         WHERE site_id=$1 ORDER BY binding_id`,
        [siteId]
      );
      return result.rows.map((row) => stored<SiteHostBindingV1>(row.record_json));
    } catch (error) {
      return translate(error);
    }
  }

  async findActiveBindings(normalizedHostname: string): Promise<readonly SiteHostBindingV1[]> {
    try {
      const result = await this.database.getPool().query<JsonRow>(
        `SELECT record_json FROM site_host_binding_heads
         WHERE normalized_hostname=$1 AND status='ACTIVE'`,
        [normalizedHostname]
      );
      return result.rows.map((row) => stored<SiteHostBindingV1>(row.record_json));
    } catch (error) {
      return translate(error);
    }
  }
}
