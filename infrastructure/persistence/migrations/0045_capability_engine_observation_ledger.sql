CREATE TABLE capability_observations (
 capability_observation_id text PRIMARY KEY CHECK (capability_observation_id ~ '^capability-observation_[0-9a-f]{32}$'),
 workspace_id text NOT NULL CHECK (btrim(workspace_id) <> ''),
 subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
 runtime_capability_definition_id text NOT NULL,
 runtime_capability_version integer NOT NULL CHECK (runtime_capability_version > 0),
 source_owner text NOT NULL CHECK (source_owner IN ('EXECUTION','MARKREG')),
 source_kind text NOT NULL CHECK (source_kind IN ('EXECUTION_PROFESSIONAL_REVIEW_DECISION','EXECUTION_EVIDENCE_REVIEW_DECISION','MARKREG_REVIEWED_LIFECYCLE_SOURCE')),
 source_id text NOT NULL CHECK (btrim(source_id) <> ''),
 source_version text NOT NULL CHECK (btrim(source_version) <> ''),
 source_fingerprint_sha256 text NOT NULL CHECK (source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 source_observed_at timestamptz NOT NULL,
 source_correlation_id text,
 subject_attribution_authority text NOT NULL CHECK (subject_attribution_authority IN ('OWNER_SOURCE','CORE_PRINCIPAL_RELATIONSHIP')),
 document_json jsonb NOT NULL,
 admitted_at timestamptz NOT NULL,
 FOREIGN KEY (runtime_capability_definition_id, runtime_capability_version)
  REFERENCES capability_runtime_definitions(runtime_capability_definition_id, version),
 UNIQUE (runtime_capability_definition_id, runtime_capability_version, source_owner, source_kind, source_id, source_version, source_fingerprint_sha256)
);

CREATE INDEX capability_observations_subject_capability
 ON capability_observations(workspace_id, subject_user_id, runtime_capability_definition_id, runtime_capability_version, admitted_at);

CREATE TABLE capability_ledger_entries (
 capability_ledger_entry_id text PRIMARY KEY CHECK (capability_ledger_entry_id ~ '^capability-ledger_[0-9a-f]{32}$'),
 capability_observation_id text NOT NULL UNIQUE REFERENCES capability_observations(capability_observation_id),
 workspace_id text NOT NULL CHECK (btrim(workspace_id) <> ''),
 subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
 runtime_capability_definition_id text NOT NULL,
 runtime_capability_version integer NOT NULL CHECK (runtime_capability_version > 0),
 document_json jsonb NOT NULL,
 recorded_at timestamptz NOT NULL,
 FOREIGN KEY (runtime_capability_definition_id, runtime_capability_version)
  REFERENCES capability_runtime_definitions(runtime_capability_definition_id, version)
);

CREATE INDEX capability_ledger_entries_subject_capability
 ON capability_ledger_entries(workspace_id, subject_user_id, runtime_capability_definition_id, runtime_capability_version, recorded_at);

CREATE TABLE capability_observation_admission_commands (
 idempotency_key text PRIMARY KEY CHECK (btrim(idempotency_key) <> ''),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 capability_observation_id text NOT NULL REFERENCES capability_observations(capability_observation_id),
 capability_ledger_entry_id text NOT NULL REFERENCES capability_ledger_entries(capability_ledger_entry_id),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL
);

CREATE TABLE capability_observation_admission_audit (
 audit_id bigserial PRIMARY KEY,
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 runtime_capability_definition_id text,
 runtime_capability_version integer,
 source_owner text,
 source_kind text,
 source_id text,
 source_version text,
 source_fingerprint_sha256 text,
 decision text NOT NULL CHECK (decision IN ('ACCEPTED','DENIED')),
 denial_code text,
 capability_observation_id text,
 capability_ledger_entry_id text,
 created_at timestamptz NOT NULL,
 CHECK (
  (decision='ACCEPTED' AND denial_code IS NULL AND capability_observation_id IS NOT NULL AND capability_ledger_entry_id IS NOT NULL)
  OR
  (decision='DENIED' AND denial_code IS NOT NULL AND capability_observation_id IS NULL AND capability_ledger_entry_id IS NULL)
 )
);

CREATE INDEX capability_observation_admission_audit_request
 ON capability_observation_admission_audit(idempotency_key, created_at);
