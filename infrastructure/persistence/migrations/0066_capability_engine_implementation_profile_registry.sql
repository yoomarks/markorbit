CREATE TABLE IF NOT EXISTS capability_implementation_profile_identities (
  implementation_profile_id text PRIMARY KEY,
  implementation_key text NOT NULL UNIQUE,
  capability_id text NOT NULL,
  capability_version text NOT NULL,
  kind text NOT NULL,
  input_schema_id text NOT NULL,
  output_schema_id text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT capability_implementation_profile_identities_id_v1
    CHECK (implementation_profile_id ~ '^implementation-profile_[A-Za-z0-9][A-Za-z0-9._:-]*$'),
  CONSTRAINT capability_implementation_profile_identities_kind_v1
    CHECK (
      kind IN (
        'DETERMINISTIC_SERVICE',
        'AI_ASSISTED_SERVICE',
        'WORKFLOW',
        'SKILL_AGENT',
        'HUMAN_REVIEWED',
        'EXTERNAL_PROVIDER',
        'COMPOSITE'
      )
    )
);

CREATE TABLE IF NOT EXISTS capability_implementation_profile_versions (
  implementation_profile_id text NOT NULL REFERENCES capability_implementation_profile_identities(implementation_profile_id),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('APPROVED','RETIRED')),
  document_fingerprint_sha256 char(64) NOT NULL,
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (implementation_profile_id, version),
  CONSTRAINT capability_implementation_profile_versions_fingerprint_v1
    CHECK (document_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT capability_implementation_profile_versions_document_v1
    CHECK (jsonb_typeof(document_json) = 'object')
);

CREATE INDEX IF NOT EXISTS capability_implementation_profile_identities_capability_idx
  ON capability_implementation_profile_identities (capability_id, implementation_profile_id);

COMMENT ON TABLE capability_implementation_profile_identities IS
  'Immutable Implementation Profile lineage identities and globally unique implementation keys for governed Capability binding.';

COMMENT ON TABLE capability_implementation_profile_versions IS
  'Immutable versioned governed Implementation Profile documents. Retirement is represented only by a newer RETIRED version; historical versions remain replay-addressable.';
