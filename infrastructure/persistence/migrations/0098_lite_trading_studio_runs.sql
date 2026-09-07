CREATE TABLE lite_trading_studio_run_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  studio_run_id text NOT NULL CHECK (studio_run_id ~ '^standard-studio-run_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  trademark_asset_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('QUEUED','RUNNING','COMPLETED','FAILED')),
  currentness text NOT NULL CHECK (currentness IN ('CURRENT','STALE')),
  checkpoint text NOT NULL CHECK (checkpoint IN ('NONE','AI_PROFILE','BRAND_DNA','COMMERCIAL_DIRECTIONS')),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, studio_run_id, version),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, trademark_asset_id)
    REFERENCES lite_trademark_assets(workspace_id, trademark_asset_id)
    ON DELETE CASCADE
);

CREATE INDEX lite_trading_studio_runs_latest
  ON lite_trading_studio_run_versions(workspace_id, studio_run_id, version DESC);
