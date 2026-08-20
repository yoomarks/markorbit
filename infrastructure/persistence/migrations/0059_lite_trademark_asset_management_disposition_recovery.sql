-- M11 WP07: durable private management disposition/watch state and internal recovery only.
-- These records never create official truth, certified legal deadlines, legal conclusions, or execution authority.
CREATE TABLE lite_trademark_asset_management_dispositions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  disposition_id text NOT NULL CHECK (btrim(disposition_id) <> ''),
  version integer NOT NULL CHECK (version = 1),
  trademark_asset_id text NOT NULL,
  management_signal_id text NOT NULL CHECK (btrim(management_signal_id) <> ''),
  recommendation_id text,
  disposition_kind text NOT NULL CHECK (
    disposition_kind IN ('WATCHED','DEFERRED','DISMISSED','CONTINUED','RESOLVED_BY_WORKFLOW_REFERENCE')
  ),
  subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, disposition_id),
  FOREIGN KEY (workspace_id, trademark_asset_id)
    REFERENCES lite_trademark_assets(workspace_id, trademark_asset_id)
    ON DELETE CASCADE
);

CREATE INDEX lite_trademark_asset_management_dispositions_signal_recent
  ON lite_trademark_asset_management_dispositions(
    workspace_id, management_signal_id, recorded_at DESC, disposition_id DESC
  );

CREATE INDEX lite_trademark_asset_management_dispositions_watch_recent
  ON lite_trademark_asset_management_dispositions(
    workspace_id, disposition_kind, recorded_at DESC, disposition_id DESC
  );

CREATE TABLE lite_trademark_asset_management_disposition_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE TABLE lite_trademark_asset_management_recovery_jobs (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  recovery_job_id text NOT NULL CHECK (btrim(recovery_job_id) <> ''),
  trademark_asset_id text NOT NULL,
  disposition_id text NOT NULL,
  recovery_kind text NOT NULL CHECK (
    recovery_kind IN ('REFRESH_PORTFOLIO_PROJECTION','REBUILD_MANAGEMENT_SIGNAL')
  ),
  status text NOT NULL CHECK (status IN ('PENDING','LEASED','SUCCEEDED','DEAD_LETTER')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  available_at timestamptz NOT NULL,
  lease_until timestamptz,
  last_failure text,
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, recovery_job_id),
  UNIQUE (workspace_id, disposition_id, recovery_kind),
  FOREIGN KEY (workspace_id, trademark_asset_id)
    REFERENCES lite_trademark_assets(workspace_id, trademark_asset_id)
    ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, disposition_id)
    REFERENCES lite_trademark_asset_management_dispositions(workspace_id, disposition_id)
    ON DELETE CASCADE
);

CREATE INDEX lite_trademark_asset_management_recovery_ready
  ON lite_trademark_asset_management_recovery_jobs(
    status, available_at, workspace_id, recovery_job_id
  ) WHERE status = 'PENDING';

CREATE INDEX lite_trademark_asset_management_recovery_dead_letter
  ON lite_trademark_asset_management_recovery_jobs(
    workspace_id, updated_at DESC, recovery_job_id DESC
  ) WHERE status = 'DEAD_LETTER';
