CREATE TABLE lite_workspace_watch_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  workspace_watch_target_id text NOT NULL CHECK (workspace_watch_target_id ~ '^workspace-watch-target_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','ARCHIVED')),
  purpose text NOT NULL CHECK (purpose IN (
    'ENFORCEMENT','BUSINESS_DEVELOPMENT','COMPETITIVE','ACQUISITION','CLIENT_MONITORING','OTHER'
  )),
  target_kind text NOT NULL CHECK (target_kind IN ('APPLICANT','TRADEMARK')),
  active_intent_fingerprint_sha256 text NOT NULL CHECK (active_intent_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz,
  PRIMARY KEY (workspace_id, workspace_watch_target_id, version),
  CHECK (updated_at >= created_at),
  CHECK ((status='ACTIVE' AND archived_at IS NULL) OR (status='ARCHIVED' AND archived_at IS NOT NULL))
);

CREATE INDEX lite_workspace_watch_versions_history
  ON lite_workspace_watch_versions(workspace_id, workspace_watch_target_id, version DESC);

CREATE TABLE lite_workspace_watch_heads (
  workspace_id uuid NOT NULL,
  workspace_watch_target_id text NOT NULL,
  latest_version integer NOT NULL CHECK (latest_version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','ARCHIVED')),
  purpose text NOT NULL CHECK (purpose IN (
    'ENFORCEMENT','BUSINESS_DEVELOPMENT','COMPETITIVE','ACQUISITION','CLIENT_MONITORING','OTHER'
  )),
  target_kind text NOT NULL CHECK (target_kind IN ('APPLICANT','TRADEMARK')),
  active_intent_fingerprint_sha256 text NOT NULL CHECK (active_intent_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, workspace_watch_target_id),
  FOREIGN KEY (workspace_id, workspace_watch_target_id, latest_version)
    REFERENCES lite_workspace_watch_versions(workspace_id, workspace_watch_target_id, version)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX lite_workspace_watch_one_active_intent
  ON lite_workspace_watch_heads(workspace_id, active_intent_fingerprint_sha256)
  WHERE status='ACTIVE';

CREATE INDEX lite_workspace_watch_latest_list
  ON lite_workspace_watch_heads(workspace_id, status, target_kind, purpose, updated_at DESC, workspace_watch_target_id);

CREATE TABLE lite_workspace_watch_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500),
  command_type text NOT NULL CHECK (command_type IN ('CREATE','ARCHIVE')),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
