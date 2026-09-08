CREATE TABLE core_workspace_admin_actions (
  audit_id uuid PRIMARY KEY,
  action text NOT NULL CHECK (action = 'UPDATE_DISPLAY_NAME'),
  actor_user_id uuid NOT NULL REFERENCES users(user_id),
  actor_session_id text NOT NULL CHECK (length(actor_session_id) BETWEEN 1 AND 256),
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  expected_workspace_version integer NOT NULL CHECK (expected_workspace_version >= 1),
  resulting_workspace_version integer NOT NULL CHECK (resulting_workspace_version >= 2),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 256),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  correlation_id text CHECK (correlation_id IS NULL OR length(correlation_id) BETWEEN 1 AND 256),
  result text NOT NULL CHECK (result = 'SUCCEEDED'),
  result_workspace_json jsonb NOT NULL CHECK (jsonb_typeof(result_workspace_json) = 'object'),
  created_at timestamptz NOT NULL,
  CONSTRAINT core_workspace_admin_actions_actor_idempotency_key
    UNIQUE (actor_user_id, idempotency_key)
);

CREATE INDEX core_workspace_admin_actions_workspace_created_idx
  ON core_workspace_admin_actions(workspace_id, created_at DESC);

COMMENT ON TABLE core_workspace_admin_actions IS
  'Core-owned append-only audit and replay records for narrow Super Admin Workspace commands.';

CREATE FUNCTION reject_core_workspace_admin_action_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Core Workspace Admin audit evidence is append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER core_workspace_admin_actions_append_only
  BEFORE UPDATE OR DELETE ON core_workspace_admin_actions
  FOR EACH ROW EXECUTE FUNCTION reject_core_workspace_admin_action_mutation();
