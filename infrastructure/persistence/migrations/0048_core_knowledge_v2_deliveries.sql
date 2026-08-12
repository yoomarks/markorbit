CREATE TABLE knowledge_v2_deliveries (
  delivery_id text PRIMARY KEY CHECK (delivery_id LIKE 'rvd\_%' ESCAPE '\'),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  target_workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  knowledge_workspace_id text NOT NULL CHECK (knowledge_workspace_id LIKE 'wsp\_%' ESCAPE '\'),
  ready_package_id text NOT NULL CHECK (ready_package_id LIKE 'rdp\_%' ESCAPE '\'),
  ready_package_digest text NOT NULL CHECK (ready_package_digest ~ '^[0-9a-f]{64}$'),
  content_export_sha256 text NOT NULL CHECK (content_export_sha256 ~ '^[0-9a-f]{64}$'),
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  request_json jsonb NOT NULL,
  submitted_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('RECEIVED','ACCEPTED','REJECTED')),
  CONSTRAINT knowledge_v2_deliveries_idempotency_key_key UNIQUE(idempotency_key)
);

CREATE INDEX knowledge_v2_deliveries_target_received_idx
  ON knowledge_v2_deliveries(target_workspace_id, received_at DESC, delivery_id);
