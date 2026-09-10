CREATE TABLE lite_trademark_asset_migration_runs (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  migration_key text NOT NULL CHECK (btrim(migration_key) <> '' AND char_length(migration_key) <= 260),
  fingerprint_sha256 text NOT NULL CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('PREVIEWED','COMMITTING','INTERRUPTED','COMPLETED')),
  total integer NOT NULL CHECK (total > 0 AND total <= 50000),
  chunk_count integer NOT NULL CHECK (chunk_count > 0),
  next_chunk_index integer NOT NULL CHECK (next_chunk_index >= 0 AND next_chunk_index <= chunk_count),
  created integer NOT NULL CHECK (created >= 0),
  duplicates integer NOT NULL CHECK (duplicates >= 0),
  rejected integer NOT NULL CHECK (rejected >= 0),
  document_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, migration_key),
  CHECK (created + duplicates + rejected <= total),
  CHECK ((status = 'COMPLETED') = (next_chunk_index = chunk_count))
);

CREATE INDEX lite_trademark_asset_migration_runs_updated
  ON lite_trademark_asset_migration_runs(workspace_id, updated_at DESC);