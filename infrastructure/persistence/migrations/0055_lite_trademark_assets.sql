CREATE TABLE lite_trademark_assets (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 trademark_asset_id text NOT NULL CHECK (btrim(trademark_asset_id) <> ''),
 version integer NOT NULL CHECK (version > 0),
 document_fingerprint_sha256 text NOT NULL CHECK (document_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, trademark_asset_id)
);

CREATE INDEX lite_trademark_assets_recent
 ON lite_trademark_assets(workspace_id, updated_at DESC, trademark_asset_id ASC);

CREATE TABLE lite_trademark_asset_identifiers (
 workspace_id uuid NOT NULL,
 trademark_asset_id text NOT NULL,
 jurisdiction text NOT NULL CHECK (btrim(jurisdiction) <> ''),
 identifier_kind text NOT NULL CHECK (
   identifier_kind IN ('APPLICATION_NUMBER','REGISTRATION_NUMBER','MADRID_IR_NUMBER','INTERNAL_REFERENCE')
 ),
 normalized_value text NOT NULL CHECK (btrim(normalized_value) <> ''),
 source_reference_json jsonb,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, trademark_asset_id, jurisdiction, identifier_kind, normalized_value),
 UNIQUE (workspace_id, jurisdiction, identifier_kind, normalized_value),
 FOREIGN KEY (workspace_id, trademark_asset_id)
   REFERENCES lite_trademark_assets(workspace_id, trademark_asset_id)
   ON DELETE CASCADE
);

CREATE INDEX lite_trademark_asset_identifiers_asset
 ON lite_trademark_asset_identifiers(workspace_id, trademark_asset_id);

CREATE TABLE lite_trademark_asset_commands (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 command_type text NOT NULL CHECK (
   command_type IN ('ADMIT_ASSET','ADD_EXTERNAL_IDENTIFIER','UPDATE_WORKSPACE_METADATA')
 ),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);
