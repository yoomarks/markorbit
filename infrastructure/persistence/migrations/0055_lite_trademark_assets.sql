CREATE TABLE lite_trademark_assets (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 trademark_asset_id text NOT NULL CHECK (btrim(trademark_asset_id) <> ''),
 version integer NOT NULL CHECK (version > 0),
 identity_fingerprint_sha256 text NOT NULL CHECK (identity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_fingerprint_sha256 text NOT NULL CHECK (document_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, trademark_asset_id),
 UNIQUE (workspace_id, identity_fingerprint_sha256)
);

CREATE INDEX lite_trademark_assets_recent
 ON lite_trademark_assets(workspace_id, updated_at DESC, trademark_asset_id ASC);

CREATE TABLE lite_trademark_asset_commands (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 command_type text NOT NULL CHECK (command_type IN ('ADMIT_ASSET','UPDATE_WORKSPACE_METADATA')),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);
