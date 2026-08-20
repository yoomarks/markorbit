-- M12-WP02: Lite owns only the workspace-private service preparation work package.
-- This is not a second Matter lifecycle and does not own legal, Capability, Provider,
-- Payment or Execution truth.
CREATE TABLE lite_trademark_service_work_packages (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  work_package_id text NOT NULL CHECK (btrim(work_package_id) <> ''),
  version integer NOT NULL CHECK (version > 0),
  trademark_asset_id text,
  document_fingerprint_sha256 text NOT NULL CHECK (document_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, work_package_id),
  FOREIGN KEY (workspace_id, trademark_asset_id)
    REFERENCES lite_trademark_assets(workspace_id, trademark_asset_id)
    ON DELETE RESTRICT
);

CREATE INDEX lite_trademark_service_work_packages_recent
  ON lite_trademark_service_work_packages(workspace_id, updated_at DESC, work_package_id ASC);

CREATE INDEX lite_trademark_service_work_packages_asset
  ON lite_trademark_service_work_packages(workspace_id, trademark_asset_id)
  WHERE trademark_asset_id IS NOT NULL;

CREATE TABLE lite_trademark_service_work_package_versions (
  workspace_id uuid NOT NULL,
  work_package_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  document_fingerprint_sha256 text NOT NULL CHECK (document_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, work_package_id, version),
  FOREIGN KEY (workspace_id, work_package_id)
    REFERENCES lite_trademark_service_work_packages(workspace_id, work_package_id)
    ON DELETE CASCADE
);

CREATE TABLE lite_trademark_service_work_package_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  command_type text NOT NULL CHECK (command_type IN ('CREATE_WORK_PACKAGE','UPDATE_CONTEXT')),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
