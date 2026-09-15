CREATE TABLE IF NOT EXISTS core_workspace_commercial_records (
  record_type text NOT NULL CHECK (record_type IN (
    'PRODUCT_INSTALLATION','OFFER','AGREEMENT','ENTITLEMENT_GRANT',
    'ASSIGNABLE_GRANT','GRANT_ASSIGNMENT','RATE_POLICY'
  )),
  aggregate_id text NOT NULL CHECK (length(btrim(aggregate_id)) BETWEEN 1 AND 256),
  version integer NOT NULL CHECK (version >= 1),
  workspace_id uuid REFERENCES workspaces(workspace_id),
  user_id uuid REFERENCES users(user_id),
  commercial_kind text,
  effective_from timestamptz,
  record_json jsonb NOT NULL CHECK (
    jsonb_typeof(record_json) = 'object' AND record_json ->> 'schemaVersion' = '1'
  ),
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (record_type, aggregate_id, version)
);

CREATE INDEX IF NOT EXISTS core_workspace_commercial_workspace_idx
  ON core_workspace_commercial_records(record_type, workspace_id, commercial_kind, version DESC)
  WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS core_workspace_commercial_user_idx
  ON core_workspace_commercial_records(record_type, user_id, commercial_kind, version DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS core_workspace_commercial_rate_idx
  ON core_workspace_commercial_records(record_type, commercial_kind, effective_from DESC)
  WHERE record_type = 'RATE_POLICY';

COMMENT ON TABLE core_workspace_commercial_records IS
  'Core-owned append-only versions for Workspace product installation and bounded commercial policy. Entitlement is not permission; agreement state is not Payment truth.';

CREATE OR REPLACE FUNCTION reject_core_workspace_commercial_record_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Core Workspace commercial versions are append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS core_workspace_commercial_records_append_only
  ON core_workspace_commercial_records;
CREATE TRIGGER core_workspace_commercial_records_append_only
  BEFORE UPDATE OR DELETE ON core_workspace_commercial_records
  FOR EACH ROW EXECUTE FUNCTION reject_core_workspace_commercial_record_mutation();
