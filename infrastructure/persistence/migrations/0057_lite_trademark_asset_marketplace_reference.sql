-- Lite owns only workspace-private overlay state for Marketplace-added Trademark Assets.
-- Marketplace source listing, price, ownership and official trademark facts remain source-owned and read-only.
CREATE TABLE lite_trademark_asset_marketplace_overlays (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 trademark_asset_id text NOT NULL,
 marketplace_overlay_id text NOT NULL CHECK (btrim(marketplace_overlay_id) <> ''),
 version integer NOT NULL CHECK (version > 0),
 source_asset_id text NOT NULL CHECK (btrim(source_asset_id) <> ''),
 source_listing_id text NOT NULL CHECK (btrim(source_listing_id) <> ''),
 source_listing_version text NOT NULL CHECK (btrim(source_listing_version) <> ''),
 source_listing_fingerprint_sha256 text,
 document_fingerprint_sha256 text NOT NULL CHECK (document_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, trademark_asset_id),
 UNIQUE (workspace_id, marketplace_overlay_id),
 FOREIGN KEY (workspace_id, trademark_asset_id)
   REFERENCES lite_trademark_assets(workspace_id, trademark_asset_id)
   ON DELETE CASCADE,
 CHECK (source_listing_fingerprint_sha256 IS NULL OR source_listing_fingerprint_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX lite_trademark_asset_marketplace_overlays_source
 ON lite_trademark_asset_marketplace_overlays(workspace_id, source_listing_id, source_asset_id);

CREATE TABLE lite_trademark_asset_marketplace_commands (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 command_type text NOT NULL CHECK (command_type IN ('UPSERT_MARKETPLACE_OVERLAY')),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);
