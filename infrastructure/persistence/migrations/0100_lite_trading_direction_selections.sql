CREATE TABLE lite_trading_direction_selection_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  direction_selection_id text NOT NULL CHECK (direction_selection_id ~ '^trading-direction-selection_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  direction_set_id text NOT NULL,
  direction_set_version integer NOT NULL CHECK (direction_set_version > 0),
  selected_direction_id text NOT NULL,
  selected_direction_version integer NOT NULL CHECK (selected_direction_version > 0),
  status text NOT NULL CHECK (status IN ('CURRENT','SUPERSEDED')),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, direction_selection_id, version),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, direction_set_id, direction_set_version)
    REFERENCES lite_trading_direction_set_versions(workspace_id, direction_set_id, version)
    ON DELETE CASCADE
);

CREATE INDEX lite_trading_direction_selections_latest
  ON lite_trading_direction_selection_versions(workspace_id, direction_selection_id, version DESC);
