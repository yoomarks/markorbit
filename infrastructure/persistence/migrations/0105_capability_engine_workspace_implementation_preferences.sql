CREATE TABLE IF NOT EXISTS capability_workspace_implementation_preferences (
  workspace_id text NOT NULL,
  capability_id text NOT NULL,
  capability_version text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','CLEARED')),
  document_fingerprint_sha256 char(64) NOT NULL,
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, capability_id, capability_version, version),
  CONSTRAINT capability_workspace_implementation_preferences_fingerprint_v1
    CHECK (document_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT capability_workspace_implementation_preferences_document_v1
    CHECK (jsonb_typeof(document_json) = 'object')
);

CREATE INDEX IF NOT EXISTS capability_workspace_implementation_preferences_current_idx
  ON capability_workspace_implementation_preferences (
    workspace_id,
    capability_id,
    capability_version,
    version DESC
  );

COMMENT ON TABLE capability_workspace_implementation_preferences IS
  'Append-only Workspace-local governed Implementation Profile preferences owned by Capability Engine. Records carry no provider credentials and cannot themselves approve an implementation.';
