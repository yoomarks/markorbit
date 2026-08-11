CREATE TABLE lite_prepared_actions (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 prepared_action_id text NOT NULL CHECK (btrim(prepared_action_id) <> ''),
 version integer NOT NULL CHECK (version = 1),
 recommendation_id text NOT NULL,
 recommendation_version integer NOT NULL CHECK (recommendation_version >= 1),
 recommendation_fingerprint_sha256 text NOT NULL CHECK (recommendation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 kind text NOT NULL CHECK (kind IN ('PREPARE_CONTENT','CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY','START_MARKREG_INTAKE')),
 handoff_target text NOT NULL CHECK (handoff_target IN ('LITE_CONTENT_PREPARATION','MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY','MARKREG_INTAKE')),
 prepared_action_fingerprint_sha256 text NOT NULL CHECK (prepared_action_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 plan_json jsonb NOT NULL,
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, prepared_action_id, version),
 UNIQUE (workspace_id, recommendation_id, recommendation_version),
 FOREIGN KEY (workspace_id, recommendation_id, recommendation_version)
  REFERENCES lite_today_recommendations(workspace_id, today_recommendation_id, version)
);

CREATE INDEX lite_prepared_actions_recommendation
 ON lite_prepared_actions(workspace_id, recommendation_id, recommendation_version);

CREATE TABLE lite_prepared_action_confirmations (
 workspace_id uuid NOT NULL,
 prepared_action_id text NOT NULL,
 prepared_action_version integer NOT NULL CHECK (prepared_action_version = 1),
 expected_prepared_action_fingerprint_sha256 text NOT NULL CHECK (expected_prepared_action_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 confirmed_by_principal_id text NOT NULL CHECK (btrim(confirmed_by_principal_id) <> ''),
 acknowledged_effect text NOT NULL CHECK (btrim(acknowledged_effect) <> ''),
 document_json jsonb NOT NULL,
 confirmed_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, prepared_action_id, prepared_action_version),
 FOREIGN KEY (workspace_id, prepared_action_id, prepared_action_version)
  REFERENCES lite_prepared_actions(workspace_id, prepared_action_id, version)
);

CREATE TABLE lite_prepared_action_handoff_results (
 workspace_id uuid NOT NULL,
 prepared_action_id text NOT NULL,
 prepared_action_version integer NOT NULL CHECK (prepared_action_version = 1),
 handoff_target text NOT NULL CHECK (handoff_target IN ('LITE_CONTENT_PREPARATION','MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY','MARKREG_INTAKE')),
 owner text NOT NULL CHECK (owner IN ('LITE','MARKREG')),
 owner_record_id text NOT NULL CHECK (btrim(owner_record_id) <> ''),
 owner_record_version text NOT NULL CHECK (btrim(owner_record_version) <> ''),
 document_json jsonb NOT NULL,
 completed_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, prepared_action_id, prepared_action_version),
 FOREIGN KEY (workspace_id, prepared_action_id, prepared_action_version)
  REFERENCES lite_prepared_actions(workspace_id, prepared_action_id, version)
);

CREATE TABLE lite_prepared_action_commands (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 command_type text NOT NULL CHECK (command_type IN ('PREPARE_ACTION','CONFIRM_ACTION','RECORD_HANDOFF_RESULT')),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);
