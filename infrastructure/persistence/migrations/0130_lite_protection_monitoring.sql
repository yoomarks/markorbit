CREATE TABLE lite_protection_monitoring_candidates (
  workspace_id uuid NOT NULL,
  candidate_id text NOT NULL,
  asset_id text NOT NULL,
  watch_target_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('OPEN','DISPOSITIONED')),
  candidate_json jsonb NOT NULL,
  decision_json jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id,candidate_id),
  FOREIGN KEY (workspace_id,asset_id)
    REFERENCES lite_trademark_assets(workspace_id,trademark_asset_id),
  FOREIGN KEY (workspace_id,watch_target_id)
    REFERENCES lite_workspace_watch_heads(workspace_id,workspace_watch_target_id)
);

CREATE INDEX lite_protection_monitoring_candidates_asset_recent
  ON lite_protection_monitoring_candidates(workspace_id,asset_id,updated_at DESC);

CREATE TABLE lite_protection_monitoring_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('ADMIT','DECIDE')),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id,idempotency_key)
);
