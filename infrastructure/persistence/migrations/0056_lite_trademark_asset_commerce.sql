-- Lite owns only workspace-private commerce configuration for a Trademark Asset.
-- This table does not create or mutate Marketplace listings and never stores official trademark truth.
CREATE TABLE lite_trademark_asset_commerce_profiles (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 trademark_asset_id text NOT NULL,
 commerce_profile_id text NOT NULL CHECK (btrim(commerce_profile_id) <> ''),
 version integer NOT NULL CHECK (version > 0),
 document_fingerprint_sha256 text NOT NULL CHECK (document_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, trademark_asset_id),
 UNIQUE (workspace_id, commerce_profile_id),
 FOREIGN KEY (workspace_id, trademark_asset_id)
   REFERENCES lite_trademark_assets(workspace_id, trademark_asset_id)
   ON DELETE CASCADE
);

CREATE INDEX lite_trademark_asset_commerce_profiles_recent
 ON lite_trademark_asset_commerce_profiles(workspace_id, updated_at DESC, trademark_asset_id ASC);

CREATE TABLE lite_trademark_asset_commerce_commands (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 command_type text NOT NULL CHECK (command_type IN ('UPSERT_COMMERCE_PROFILE')),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);
