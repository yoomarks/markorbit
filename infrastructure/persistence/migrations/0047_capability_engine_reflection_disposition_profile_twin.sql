CREATE TABLE capability_reflection_dispositions (
 reflection_disposition_id text PRIMARY KEY CHECK (reflection_disposition_id ~ '^reflection-disposition_[0-9a-f]{32}$'),
 reflection_candidate_id text NOT NULL REFERENCES capability_reflection_candidates(reflection_candidate_id),
 candidate_version integer NOT NULL CHECK (candidate_version > 0),
 candidate_fingerprint_sha256 text NOT NULL CHECK (candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 workspace_id text NOT NULL CHECK (btrim(workspace_id) <> ''),
 subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
 outcome text NOT NULL CHECK (outcome IN ('ACCEPTED','REJECTED','DEFERRED')),
 rationale text,
 decided_by_subject_user_id text NOT NULL CHECK (btrim(decided_by_subject_user_id) <> ''),
 document_json jsonb NOT NULL,
 decided_at timestamptz NOT NULL,
 UNIQUE (reflection_candidate_id, candidate_version)
);

CREATE INDEX capability_reflection_dispositions_subject_capability
 ON capability_reflection_dispositions(workspace_id, subject_user_id, decided_at, reflection_disposition_id);

CREATE TABLE capability_reflection_disposition_commands (
 idempotency_key text PRIMARY KEY CHECK (btrim(idempotency_key) <> ''),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 reflection_disposition_id text NOT NULL REFERENCES capability_reflection_dispositions(reflection_disposition_id),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL
);

CREATE TABLE capability_reflection_disposition_audit (
 audit_id bigserial PRIMARY KEY,
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 reflection_disposition_id text NOT NULL,
 reflection_candidate_id text NOT NULL,
 candidate_version integer NOT NULL CHECK (candidate_version > 0),
 candidate_fingerprint_sha256 text NOT NULL CHECK (candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 workspace_id text NOT NULL CHECK (btrim(workspace_id) <> ''),
 subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
 outcome text NOT NULL CHECK (outcome IN ('ACCEPTED','REJECTED','DEFERRED')),
 decision text NOT NULL CHECK (decision = 'SUBJECT_DISPOSITION_RECORDED_OR_REUSED'),
 created_at timestamptz NOT NULL
);

CREATE INDEX capability_reflection_disposition_audit_request
 ON capability_reflection_disposition_audit(idempotency_key, created_at);

CREATE TABLE capability_profile_projections (
 capability_profile_projection_id text NOT NULL CHECK (capability_profile_projection_id ~ '^capability-profile_[0-9a-f]{32}$'),
 workspace_id text NOT NULL CHECK (btrim(workspace_id) <> ''),
 subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
 version integer NOT NULL CHECK (version > 0),
 runtime_capability_definition_id text NOT NULL,
 runtime_capability_version integer NOT NULL CHECK (runtime_capability_version > 0),
 state_fingerprint_sha256 text NOT NULL CHECK (state_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 generated_at timestamptz NOT NULL,
 PRIMARY KEY (capability_profile_projection_id, version),
 FOREIGN KEY (runtime_capability_definition_id, runtime_capability_version)
  REFERENCES capability_runtime_definitions(runtime_capability_definition_id, version),
 UNIQUE (workspace_id, subject_user_id, runtime_capability_definition_id, runtime_capability_version, version),
 UNIQUE (workspace_id, subject_user_id, runtime_capability_definition_id, runtime_capability_version, state_fingerprint_sha256)
);

CREATE INDEX capability_profile_projections_subject_current
 ON capability_profile_projections(
  workspace_id, subject_user_id, runtime_capability_definition_id, runtime_capability_version, version DESC
 );

CREATE TABLE capability_twin_projections (
 capability_twin_projection_id text NOT NULL CHECK (capability_twin_projection_id ~ '^capability-twin_[0-9a-f]{32}$'),
 workspace_id text NOT NULL CHECK (btrim(workspace_id) <> ''),
 subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
 version integer NOT NULL CHECK (version > 0),
 state_fingerprint_sha256 text NOT NULL CHECK (state_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 generated_at timestamptz NOT NULL,
 PRIMARY KEY (capability_twin_projection_id, version),
 UNIQUE (workspace_id, subject_user_id, version),
 UNIQUE (workspace_id, subject_user_id, state_fingerprint_sha256)
);

CREATE INDEX capability_twin_projections_subject_current
 ON capability_twin_projections(workspace_id, subject_user_id, version DESC);
