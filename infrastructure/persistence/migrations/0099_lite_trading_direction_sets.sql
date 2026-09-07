CREATE TABLE lite_trading_direction_set_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  direction_set_id text NOT NULL CHECK (direction_set_id ~ '^commercial-direction-set_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  studio_run_id text NOT NULL,
  studio_run_version integer NOT NULL CHECK (studio_run_version > 0),
  trademark_asset_id text NOT NULL,
  trademark_asset_version integer NOT NULL CHECK (trademark_asset_version > 0),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, direction_set_id, version),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, studio_run_id, studio_run_version)
    REFERENCES lite_trading_studio_run_versions(workspace_id, studio_run_id, version)
    ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, trademark_asset_id)
    REFERENCES lite_trademark_assets(workspace_id, trademark_asset_id)
    ON DELETE CASCADE
);

CREATE INDEX lite_trading_direction_sets_latest
  ON lite_trading_direction_set_versions(workspace_id, direction_set_id, version DESC);
