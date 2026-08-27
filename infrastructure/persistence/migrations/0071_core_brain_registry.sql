CREATE TABLE IF NOT EXISTS brain_asset_versions (
  brain_asset_version_id text PRIMARY KEY,
  brain_asset_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  asset_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','CANDIDATE','VALIDATED','ACTIVE','DEGRADED','RETIRED')),
  domain text NOT NULL,
  jurisdiction text,
  concept text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  asset_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  admitted_build_run_id text,
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (brain_asset_id, version),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS brain_asset_versions_scope_active_idx
  ON brain_asset_versions(domain, jurisdiction, concept, effective_from, effective_to)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS brain_build_admissions (
  brain_build_run_id text PRIMARY KEY,
  brain_asset_id text NOT NULL,
  produced_brain_asset_version_id text NOT NULL,
  admitted_brain_asset_version_id text NOT NULL UNIQUE
    REFERENCES brain_asset_versions(brain_asset_version_id) ON DELETE RESTRICT,
  admitted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS brain_build_admissions_asset_idx
  ON brain_build_admissions(brain_asset_id, admitted_at);
