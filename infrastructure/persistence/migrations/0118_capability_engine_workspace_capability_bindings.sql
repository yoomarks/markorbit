CREATE TABLE IF NOT EXISTS capability_workspace_capability_bindings (
  workspace_id uuid NOT NULL,
  binding_id text NOT NULL,
  intelligence_id text NOT NULL,
  source_projection_sha256 char(64) NOT NULL,
  runtime_capability_definition_id text NOT NULL,
  runtime_capability_version integer NOT NULL CHECK (runtime_capability_version > 0),
  capability_id text NOT NULL,
  capability_version text NOT NULL,
  binding_policy_id text NOT NULL,
  binding_policy_version text NOT NULL,
  binding_policy_rule_id text NOT NULL,
  identity_fingerprint_sha256 char(64) NOT NULL,
  document_fingerprint_sha256 char(64) NOT NULL,
  document_json jsonb NOT NULL,
  bound_at timestamptz NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (workspace_id, binding_id),
  UNIQUE (binding_id),
  CONSTRAINT capability_workspace_capability_bindings_identity_v1
    CHECK (identity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT capability_workspace_capability_bindings_document_v1
    CHECK (document_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT capability_workspace_capability_bindings_projection_v1
    CHECK (source_projection_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT capability_workspace_capability_bindings_json_v1
    CHECK (jsonb_typeof(document_json) = 'object')
);

CREATE INDEX IF NOT EXISTS capability_workspace_capability_bindings_source_idx
  ON capability_workspace_capability_bindings(workspace_id, intelligence_id, bound_at DESC);

COMMENT ON TABLE capability_workspace_capability_bindings IS
  'Immutable Workspace-local Brain-intelligence to accepted-Canon Runtime Capability bindings. A binding creates no implementation selection or invocation authority.';
