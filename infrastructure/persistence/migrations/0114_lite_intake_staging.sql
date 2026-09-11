CREATE TABLE lite_intake_staging_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  staging_id text NOT NULL CHECK (staging_id ~ '^lite-intake-staging_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  lifecycle text NOT NULL CHECK (lifecycle IN ('ACTIVE','ARCHIVED')),
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz,
  PRIMARY KEY (workspace_id, staging_id, version),
  CHECK (updated_at >= created_at),
  CHECK (
    (lifecycle='ACTIVE' AND archived_at IS NULL)
    OR (lifecycle='ARCHIVED' AND archived_at IS NOT NULL)
  )
);

CREATE INDEX lite_intake_staging_versions_history
  ON lite_intake_staging_versions(workspace_id, staging_id, version DESC);

CREATE TABLE lite_intake_staging_heads (
  workspace_id uuid NOT NULL,
  staging_id text NOT NULL,
  latest_version integer NOT NULL CHECK (latest_version > 0),
  lifecycle text NOT NULL CHECK (lifecycle IN ('ACTIVE','ARCHIVED')),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, staging_id),
  FOREIGN KEY (workspace_id, staging_id, latest_version)
    REFERENCES lite_intake_staging_versions(workspace_id, staging_id, version)
    ON DELETE CASCADE
);
CREATE INDEX lite_intake_staging_latest_list
  ON lite_intake_staging_heads(workspace_id, lifecycle, updated_at DESC, staging_id);

CREATE TABLE lite_intake_staging_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (
    btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500
  ),
  command_type text NOT NULL CHECK (
    command_type IN ('CREATE','REVISE_CASE','REVIEW_CASE','COMMIT_CASE')
  ),
  request_fingerprint_sha256 text NOT NULL CHECK (
    request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
  ),
  result_json jsonb,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (workspace_id, idempotency_key),
  CHECK (
    (result_json IS NULL AND completed_at IS NULL)
    OR (result_json IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX lite_intake_staging_commands_pending
  ON lite_intake_staging_commands(workspace_id, created_at)
  WHERE completed_at IS NULL;