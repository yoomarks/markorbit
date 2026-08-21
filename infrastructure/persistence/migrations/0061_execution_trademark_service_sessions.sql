CREATE TABLE execution_trademark_service_sessions (
  workspace_id text NOT NULL,
  execution_authorization_id text NOT NULL,
  work_package_id text NOT NULL,
  work_package_version integer NOT NULL CHECK (work_package_version > 0),
  execution_readiness_id text NOT NULL,
  authorization_record jsonb NOT NULL,
  plan_record jsonb,
  recovery_record jsonb,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, execution_authorization_id)
);

CREATE INDEX execution_trademark_service_sessions_work_package_idx
  ON execution_trademark_service_sessions (workspace_id, work_package_id, work_package_version);

CREATE TABLE execution_trademark_service_protected_action_replays (
  workspace_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint_sha256 text NOT NULL,
  execution_authorization_id text NOT NULL,
  protected_action_release_id text NOT NULL,
  release_record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key),
  UNIQUE (workspace_id, protected_action_release_id),
  FOREIGN KEY (workspace_id, execution_authorization_id)
    REFERENCES execution_trademark_service_sessions (workspace_id, execution_authorization_id)
    ON DELETE RESTRICT
);

CREATE TABLE execution_trademark_service_artifacts (
  workspace_id text NOT NULL,
  artifact_id text NOT NULL,
  execution_authorization_id text NOT NULL,
  artifact_kind text NOT NULL CHECK (artifact_kind IN ('PROVIDER_HANDOFF','LIFECYCLE_HANDOFF','EVIDENCE','RECOVERY')),
  artifact_record jsonb NOT NULL,
  official_truth_created boolean NOT NULL DEFAULT false CHECK (official_truth_created = false),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, artifact_id),
  FOREIGN KEY (workspace_id, execution_authorization_id)
    REFERENCES execution_trademark_service_sessions (workspace_id, execution_authorization_id)
    ON DELETE RESTRICT
);

CREATE INDEX execution_trademark_service_artifacts_session_idx
  ON execution_trademark_service_artifacts (workspace_id, execution_authorization_id, created_at);
