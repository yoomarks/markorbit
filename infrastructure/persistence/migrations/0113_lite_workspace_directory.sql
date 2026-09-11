CREATE TABLE lite_workspace_directory_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  workspace_directory_entry_id text NOT NULL CHECK (workspace_directory_entry_id ~ '^workspace-directory-entry_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','ARCHIVED')),
  entry_kind text NOT NULL CHECK (entry_kind IN ('ORGANIZATION','PERSON')),
  normalized_display_name text NOT NULL CHECK (btrim(normalized_display_name) <> ''),
  normalized_names text[] NOT NULL CHECK (cardinality(normalized_names) > 0),
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz,
  PRIMARY KEY (workspace_id, workspace_directory_entry_id, version),
  CHECK (updated_at >= created_at),
  CHECK ((status='ACTIVE' AND archived_at IS NULL) OR (status='ARCHIVED' AND archived_at IS NOT NULL))
);

CREATE INDEX lite_workspace_directory_versions_history
  ON lite_workspace_directory_versions(workspace_id, workspace_directory_entry_id, version DESC);

CREATE TABLE lite_workspace_directory_heads (
  workspace_id uuid NOT NULL,
  workspace_directory_entry_id text NOT NULL,
  latest_version integer NOT NULL CHECK (latest_version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','ARCHIVED')),
  entry_kind text NOT NULL CHECK (entry_kind IN ('ORGANIZATION','PERSON')),
  normalized_display_name text NOT NULL CHECK (btrim(normalized_display_name) <> ''),
  normalized_names text[] NOT NULL CHECK (cardinality(normalized_names) > 0),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, workspace_directory_entry_id),
  FOREIGN KEY (workspace_id, workspace_directory_entry_id, latest_version)
    REFERENCES lite_workspace_directory_versions(workspace_id, workspace_directory_entry_id, version)
    ON DELETE CASCADE
);

CREATE INDEX lite_workspace_directory_latest_list
  ON lite_workspace_directory_heads(
    workspace_id, status, entry_kind, normalized_display_name, workspace_directory_entry_id
  );

CREATE INDEX lite_workspace_directory_normalized_names
  ON lite_workspace_directory_heads USING gin(normalized_names);

CREATE TABLE lite_workspace_directory_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500),
  command_type text NOT NULL CHECK (command_type IN ('CREATE','UPDATE','ARCHIVE')),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
