CREATE TABLE IF NOT EXISTS site_installation_versions (
  site_id text NOT NULL CHECK (site_id LIKE 'site_%'),
  workspace_id text NOT NULL CHECK (length(btrim(workspace_id)) BETWEEN 1 AND 256),
  version integer NOT NULL CHECK (version >= 1),
  lifecycle text NOT NULL CHECK (lifecycle IN ('DRAFT','ACTIVE','SUSPENDED','DECOMMISSIONED')),
  record_json jsonb NOT NULL CHECK (
    jsonb_typeof(record_json) = 'object' AND record_json ->> 'schemaVersion' = '1'
  ),
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (site_id, version)
);

CREATE TABLE IF NOT EXISTS site_installation_heads (
  site_id text PRIMARY KEY CHECK (site_id LIKE 'site_%'),
  workspace_id text NOT NULL CHECK (length(btrim(workspace_id)) BETWEEN 1 AND 256),
  version integer NOT NULL CHECK (version >= 1),
  lifecycle text NOT NULL CHECK (lifecycle IN ('DRAFT','ACTIVE','SUSPENDED','DECOMMISSIONED')),
  record_json jsonb NOT NULL CHECK (
    jsonb_typeof(record_json) = 'object' AND record_json ->> 'schemaVersion' = '1'
  )
);

CREATE INDEX IF NOT EXISTS site_installation_heads_workspace_idx
  ON site_installation_heads(workspace_id, site_id);

CREATE TABLE IF NOT EXISTS site_configuration_versions (
  site_id text NOT NULL CHECK (site_id LIKE 'site_%'),
  workspace_id text NOT NULL CHECK (length(btrim(workspace_id)) BETWEEN 1 AND 256),
  version integer NOT NULL CHECK (version >= 1),
  record_json jsonb NOT NULL CHECK (
    jsonb_typeof(record_json) = 'object' AND record_json ->> 'schemaVersion' = '1'
  ),
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (site_id, version)
);

CREATE TABLE IF NOT EXISTS site_host_binding_versions (
  binding_id text NOT NULL CHECK (binding_id LIKE 'site_host_%'),
  site_id text NOT NULL CHECK (site_id LIKE 'site_%'),
  workspace_id text NOT NULL CHECK (length(btrim(workspace_id)) BETWEEN 1 AND 256),
  normalized_hostname text NOT NULL CHECK (
    normalized_hostname = lower(normalized_hostname)
    AND length(normalized_hostname) BETWEEN 1 AND 253
  ),
  binding_type text NOT NULL CHECK (binding_type IN ('PRIMARY','ALIAS','TEST')),
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL CHECK (
    status IN ('PENDING_VERIFICATION','VERIFIED','ACTIVE','SUSPENDED','REVOKED')
  ),
  record_json jsonb NOT NULL CHECK (
    jsonb_typeof(record_json) = 'object' AND record_json ->> 'schemaVersion' = '1'
  ),
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (binding_id, version)
);

CREATE TABLE IF NOT EXISTS site_host_binding_heads (
  binding_id text PRIMARY KEY CHECK (binding_id LIKE 'site_host_%'),
  site_id text NOT NULL CHECK (site_id LIKE 'site_%'),
  workspace_id text NOT NULL CHECK (length(btrim(workspace_id)) BETWEEN 1 AND 256),
  normalized_hostname text NOT NULL CHECK (
    normalized_hostname = lower(normalized_hostname)
    AND length(normalized_hostname) BETWEEN 1 AND 253
  ),
  binding_type text NOT NULL CHECK (binding_type IN ('PRIMARY','ALIAS','TEST')),
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL CHECK (
    status IN ('PENDING_VERIFICATION','VERIFIED','ACTIVE','SUSPENDED','REVOKED')
  ),
  record_json jsonb NOT NULL CHECK (
    jsonb_typeof(record_json) = 'object' AND record_json ->> 'schemaVersion' = '1'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS site_host_binding_heads_active_hostname_uidx
  ON site_host_binding_heads(normalized_hostname) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS site_host_binding_heads_site_idx
  ON site_host_binding_heads(site_id, status);

CREATE TABLE IF NOT EXISTS site_commands (
  workspace_id text NOT NULL CHECK (length(btrim(workspace_id)) BETWEEN 1 AND 256),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 300),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_json jsonb NOT NULL CHECK (jsonb_typeof(response_json) = 'object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION reject_site_version_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Site versions and commands are append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS site_installation_versions_append_only ON site_installation_versions;
CREATE TRIGGER site_installation_versions_append_only
  BEFORE UPDATE OR DELETE ON site_installation_versions
  FOR EACH ROW EXECUTE FUNCTION reject_site_version_mutation();
DROP TRIGGER IF EXISTS site_configuration_versions_append_only ON site_configuration_versions;
CREATE TRIGGER site_configuration_versions_append_only
  BEFORE UPDATE OR DELETE ON site_configuration_versions
  FOR EACH ROW EXECUTE FUNCTION reject_site_version_mutation();
DROP TRIGGER IF EXISTS site_host_binding_versions_append_only ON site_host_binding_versions;
CREATE TRIGGER site_host_binding_versions_append_only
  BEFORE UPDATE OR DELETE ON site_host_binding_versions
  FOR EACH ROW EXECUTE FUNCTION reject_site_version_mutation();
DROP TRIGGER IF EXISTS site_commands_append_only ON site_commands;
CREATE TRIGGER site_commands_append_only
  BEFORE UPDATE OR DELETE ON site_commands
  FOR EACH ROW EXECUTE FUNCTION reject_site_version_mutation();

COMMENT ON TABLE site_installation_versions IS
  'Site-owned immutable Workspace Site lifecycle versions. Site configuration is not customer, quote, payment, provider or execution authority.';
COMMENT ON TABLE site_host_binding_heads IS
  'Site-owned current exact host bindings. A host binding never grants Workspace membership or authority.';
