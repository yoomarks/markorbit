-- M11 WP02: Lite owns refresh history and detected change metadata only.
-- Source-domain facts remain owned by their original systems; this ledger stores exact references.
CREATE TABLE lite_trademark_asset_refresh_runs (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  refresh_run_id text NOT NULL CHECK (btrim(refresh_run_id) <> ''),
  trademark_asset_id text NOT NULL,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_owner_scope jsonb NOT NULL,
  observation_count integer NOT NULL CHECK (observation_count >= 0),
  change_count integer NOT NULL CHECK (change_count >= 0),
  result_json jsonb NOT NULL,
  refreshed_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, refresh_run_id),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, trademark_asset_id)
    REFERENCES lite_trademark_assets(workspace_id, trademark_asset_id)
    ON DELETE CASCADE
);

CREATE INDEX lite_trademark_asset_refresh_runs_asset_recent
  ON lite_trademark_asset_refresh_runs(workspace_id, trademark_asset_id, refreshed_at DESC, refresh_run_id DESC);

CREATE TABLE lite_trademark_asset_refresh_observations (
  workspace_id uuid NOT NULL,
  refresh_run_id text NOT NULL,
  trademark_asset_id text NOT NULL,
  source_key text NOT NULL CHECK (btrim(source_key) <> ''),
  source_owner text NOT NULL CHECK (btrim(source_owner) <> ''),
  source_kind text NOT NULL CHECK (btrim(source_kind) <> ''),
  source_id text NOT NULL CHECK (btrim(source_id) <> ''),
  source_version text NOT NULL CHECK (btrim(source_version) <> ''),
  source_fingerprint_sha256 text,
  freshness text NOT NULL CHECK (freshness IN ('CURRENT','STALE','UNKNOWN','CONFLICTING')),
  observed_at timestamptz NOT NULL,
  observation_fingerprint_sha256 text NOT NULL CHECK (observation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_reference_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, refresh_run_id, source_key),
  FOREIGN KEY (workspace_id, refresh_run_id)
    REFERENCES lite_trademark_asset_refresh_runs(workspace_id, refresh_run_id)
    ON DELETE CASCADE
);

CREATE INDEX lite_trademark_asset_refresh_observations_latest
  ON lite_trademark_asset_refresh_observations(workspace_id, trademark_asset_id, source_key, recorded_at DESC, refresh_run_id DESC);

CREATE TABLE lite_trademark_asset_refresh_changes (
  workspace_id uuid NOT NULL,
  refresh_run_id text NOT NULL,
  trademark_asset_id text NOT NULL,
  change_id text NOT NULL CHECK (btrim(change_id) <> ''),
  change_kind text NOT NULL CHECK (
    change_kind IN (
      'OBSERVATION_ADDED',
      'OBSERVATION_REMOVED',
      'OBSERVATION_CHANGED',
      'FRESHNESS_CHANGED'
    )
  ),
  source_key text NOT NULL CHECK (btrim(source_key) <> ''),
  change_json jsonb NOT NULL,
  detected_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, change_id),
  FOREIGN KEY (workspace_id, refresh_run_id)
    REFERENCES lite_trademark_asset_refresh_runs(workspace_id, refresh_run_id)
    ON DELETE CASCADE
);

CREATE INDEX lite_trademark_asset_refresh_changes_asset_recent
  ON lite_trademark_asset_refresh_changes(workspace_id, trademark_asset_id, detected_at DESC, change_id DESC);
