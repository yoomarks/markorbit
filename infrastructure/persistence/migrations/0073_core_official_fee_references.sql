CREATE TABLE IF NOT EXISTS official_fee_references (
  reference_id text PRIMARY KEY,
  operation text NOT NULL,
  jurisdiction text NOT NULL,
  authority text NOT NULL,
  status text NOT NULL CHECK (status IN ('CURRENT','STALE')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  package_id text NOT NULL,
  method_id text NOT NULL,
  method_version_id text NOT NULL,
  source_identity_fingerprint_sha256 text NOT NULL CHECK (length(source_identity_fingerprint_sha256) = 64),
  replay_identity_fingerprint_sha256 text NOT NULL UNIQUE CHECK (length(replay_identity_fingerprint_sha256) = 64),
  materialization_fingerprint_sha256 text NOT NULL UNIQUE CHECK (length(materialization_fingerprint_sha256) = 64),
  reference_json jsonb NOT NULL,
  materialized_at timestamptz NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS official_fee_references_current_scope_idx
  ON official_fee_references(operation, jurisdiction, authority, effective_from, effective_to)
  WHERE status = 'CURRENT';
