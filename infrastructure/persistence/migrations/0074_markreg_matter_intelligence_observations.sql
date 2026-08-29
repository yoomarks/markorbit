CREATE TABLE markreg_matter_intelligence_observations (
  matter_intelligence_observation_id text PRIMARY KEY
    CHECK (matter_intelligence_observation_id ~ '^matter-intelligence-observation_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  formal_matter_id text NOT NULL REFERENCES formal_matters(formal_matter_id),
  formal_matter_version integer NOT NULL CHECK (formal_matter_version >= 1),
  formal_matter_snapshot_sha256 char(64) NOT NULL
    CHECK (formal_matter_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  observation_kind text NOT NULL
    CHECK (observation_kind = 'CN_COMPLETED_DURATION_HISTORICAL_BAND'),
  observed_completed_duration_days integer NOT NULL CHECK (observed_completed_duration_days >= 0),
  historical_band text NOT NULL CHECK (
    historical_band IN (
      'LOWER_QUARTILE_OR_BELOW',
      'LOWER_INTERQUARTILE',
      'UPPER_INTERQUARTILE',
      'UPPER_QUARTILE'
    )
  ),
  dataset_ref_id text NOT NULL CHECK (char_length(dataset_ref_id) BETWEEN 1 AND 500),
  capability_id text NOT NULL
    CHECK (capability_id = 'interpretation.cn-completed-duration-historical-band'),
  capability_version text NOT NULL CHECK (capability_version = '1.0.0'),
  input_schema_id text NOT NULL
    CHECK (input_schema_id = 'brain-input.cn-completed-duration-historical-band.v1'),
  output_schema_id text NOT NULL
    CHECK (output_schema_id = 'brain.cn-completed-duration-historical-band.v1'),
  capability_request_id text NOT NULL CHECK (char_length(capability_request_id) BETWEEN 1 AND 300),
  capability_invocation_id text NOT NULL CHECK (char_length(capability_invocation_id) BETWEEN 1 AND 300),
  capability_outcome_id text NOT NULL CHECK (char_length(capability_outcome_id) BETWEEN 1 AND 300),
  capability_return_id text NOT NULL CHECK (char_length(capability_return_id) BETWEEN 1 AND 300),
  session_receipt_id text NOT NULL CHECK (char_length(session_receipt_id) BETWEEN 1 AND 300),
  implementation_profile_id text NOT NULL CHECK (char_length(implementation_profile_id) BETWEEN 1 AND 300),
  implementation_version integer NOT NULL CHECK (implementation_version >= 1),
  implementation_key text NOT NULL CHECK (char_length(implementation_key) BETWEEN 1 AND 500),
  correlation_id text NOT NULL CHECK (char_length(correlation_id) BETWEEN 1 AND 300),
  method_package_ref text NOT NULL CHECK (method_package_ref LIKE 'brain-method-package:%'),
  method_ref text NOT NULL CHECK (method_ref LIKE 'brain-method:%'),
  method_version_ref text NOT NULL CHECK (method_version_ref LIKE 'brain-method-version:%'),
  evaluation_ref text NOT NULL CHECK (evaluation_ref LIKE 'brain-method-evaluation:%'),
  research_dataset_ref text NOT NULL CHECK (research_dataset_ref LIKE 'research-dataset:%'),
  evidence_refs jsonb NOT NULL CHECK (jsonb_typeof(evidence_refs) = 'array'),
  evidence_fingerprint_sha256 char(64) NOT NULL CHECK (evidence_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  input_fingerprint_sha256 char(64) NOT NULL CHECK (input_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  output_fingerprint_sha256 char(64) NOT NULL CHECK (output_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_by_principal_id text NOT NULL CHECK (char_length(recorded_by_principal_id) BETWEEN 1 AND 300),
  recorded_at timestamptz NOT NULL,
  UNIQUE (workspace_id, capability_return_id),
  UNIQUE (workspace_id, session_receipt_id)
);

CREATE INDEX markreg_matter_intelligence_observations_matter_idx
  ON markreg_matter_intelligence_observations (
    workspace_id,
    formal_matter_id,
    recorded_at DESC,
    matter_intelligence_observation_id ASC
  );

CREATE TABLE markreg_matter_intelligence_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
  request_fingerprint_sha256 char(64) NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  matter_intelligence_observation_id text NOT NULL
    REFERENCES markreg_matter_intelligence_observations(matter_intelligence_observation_id),
  result_snapshot jsonb NOT NULL,
  correlation_id text NOT NULL CHECK (char_length(correlation_id) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE INDEX markreg_matter_intelligence_commands_observation_idx
  ON markreg_matter_intelligence_commands (
    workspace_id,
    matter_intelligence_observation_id,
    created_at DESC
  );

CREATE TRIGGER markreg_matter_intelligence_observation_append_only
  BEFORE UPDATE OR DELETE ON markreg_matter_intelligence_observations
  FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();

CREATE TRIGGER markreg_matter_intelligence_command_append_only
  BEFORE UPDATE OR DELETE ON markreg_matter_intelligence_commands
  FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();
