CREATE TABLE capability_reflection_candidates (
 reflection_candidate_id text NOT NULL CHECK (reflection_candidate_id ~ '^reflection-candidate_[0-9a-f]{32}$'),
 workspace_id text NOT NULL CHECK (btrim(workspace_id) <> ''),
 subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
 version integer NOT NULL CHECK (version > 0),
 runtime_capability_definition_id text NOT NULL,
 runtime_capability_version integer NOT NULL CHECK (runtime_capability_version > 0),
 generation_policy_version text NOT NULL CHECK (btrim(generation_policy_version) <> ''),
 input_fingerprint_sha256 text NOT NULL CHECK (input_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 ledger_snapshot_fingerprint_sha256 text NOT NULL CHECK (ledger_snapshot_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 candidate_fingerprint_sha256 text NOT NULL UNIQUE CHECK (candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (reflection_candidate_id, version),
 FOREIGN KEY (runtime_capability_definition_id, runtime_capability_version)
  REFERENCES capability_runtime_definitions(runtime_capability_definition_id, version),
 UNIQUE (workspace_id, subject_user_id, runtime_capability_definition_id, runtime_capability_version, version),
 UNIQUE (workspace_id, subject_user_id, runtime_capability_definition_id, runtime_capability_version, input_fingerprint_sha256)
);

CREATE INDEX capability_reflection_candidates_subject_capability
 ON capability_reflection_candidates(
  workspace_id, subject_user_id, runtime_capability_definition_id, runtime_capability_version, version DESC
 );

CREATE TABLE capability_reflection_candidate_ledger_entries (
 reflection_candidate_id text NOT NULL,
 candidate_version integer NOT NULL CHECK (candidate_version > 0),
 ledger_entry_id text NOT NULL REFERENCES capability_ledger_entries(capability_ledger_entry_id),
 position integer NOT NULL CHECK (position >= 0),
 source_fingerprint_sha256 text NOT NULL CHECK (source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 PRIMARY KEY (reflection_candidate_id, candidate_version, ledger_entry_id),
 UNIQUE (reflection_candidate_id, candidate_version, position),
 FOREIGN KEY (reflection_candidate_id, candidate_version)
  REFERENCES capability_reflection_candidates(reflection_candidate_id, version)
);

CREATE TABLE capability_reflection_generation_commands (
 idempotency_key text PRIMARY KEY CHECK (btrim(idempotency_key) <> ''),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 reflection_candidate_id text NOT NULL,
 candidate_version integer NOT NULL CHECK (candidate_version > 0),
 candidate_fingerprint_sha256 text NOT NULL CHECK (candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 FOREIGN KEY (reflection_candidate_id, candidate_version)
  REFERENCES capability_reflection_candidates(reflection_candidate_id, version)
);

CREATE TABLE capability_reflection_generation_audit (
 audit_id bigserial PRIMARY KEY,
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 reflection_candidate_id text NOT NULL,
 candidate_version integer NOT NULL CHECK (candidate_version > 0),
 candidate_fingerprint_sha256 text NOT NULL CHECK (candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 workspace_id text NOT NULL CHECK (btrim(workspace_id) <> ''),
 subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
 runtime_capability_definition_id text NOT NULL,
 runtime_capability_version integer NOT NULL CHECK (runtime_capability_version > 0),
 generation_policy_version text NOT NULL CHECK (btrim(generation_policy_version) <> ''),
 decision text NOT NULL CHECK (decision = 'GENERATED_OR_REUSED'),
 created_at timestamptz NOT NULL
);

CREATE INDEX capability_reflection_generation_audit_request
 ON capability_reflection_generation_audit(idempotency_key, created_at);
