CREATE TABLE lite_trading_marketplace_target_binding_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  target_binding_id text NOT NULL CHECK (target_binding_id ~ '^trading-marketplace-target-binding_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, target_binding_id, version),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX lite_trading_marketplace_target_bindings_latest
  ON lite_trading_marketplace_target_binding_versions(workspace_id, target_binding_id, version DESC);
