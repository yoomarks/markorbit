CREATE TABLE markreg_recommended_actions (
 recommended_action_id text PRIMARY KEY CHECK (recommended_action_id ~ '^recommended-action_[A-Za-z0-9_-]+$'),
 workspace_id uuid NOT NULL,
 formal_matter_id text NOT NULL REFERENCES formal_matters(formal_matter_id),
 formal_matter_version text NOT NULL CHECK (char_length(formal_matter_version) BETWEEN 1 AND 100),
 version integer NOT NULL CHECK (version >= 1),
 source_lifecycle_view_id text NOT NULL REFERENCES markreg_lifecycle_views(lifecycle_view_id),
 source_lifecycle_view_version integer NOT NULL CHECK (source_lifecycle_view_version >= 1),
 source_lifecycle_view_fingerprint_sha256 text NOT NULL CHECK (source_lifecycle_view_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 policy_version text NOT NULL CHECK (char_length(policy_version) BETWEEN 1 AND 100),
 action_code text NOT NULL CHECK (char_length(action_code) BETWEEN 1 AND 200),
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
 explanation text NOT NULL CHECK (char_length(explanation) BETWEEN 1 AND 2000),
 due_at timestamptz,
 timing_basis text CHECK (timing_basis IS NULL OR char_length(timing_basis) BETWEEN 1 AND 1000),
 status text NOT NULL CHECK (status IN ('OPEN','ACKNOWLEDGED','DISMISSED','SUPPRESSED')),
 recommended_action_fingerprint_sha256 text NOT NULL CHECK (recommended_action_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 execution_authorized boolean NOT NULL DEFAULT false CHECK (execution_authorized = false),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 UNIQUE(workspace_id,formal_matter_id)
);

CREATE INDEX markreg_recommended_actions_workspace_status_idx
 ON markreg_recommended_actions(workspace_id,status,updated_at DESC,formal_matter_id ASC);

CREATE TABLE markreg_recommended_action_commands (
 workspace_id uuid NOT NULL,
 idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
 command_type text NOT NULL CHECK (command_type IN ('REGENERATE','TRANSITION')),
 formal_matter_id text NOT NULL REFERENCES formal_matters(formal_matter_id),
 recommended_action_id text REFERENCES markreg_recommended_actions(recommended_action_id),
 source_lifecycle_view_id text NOT NULL REFERENCES markreg_lifecycle_views(lifecycle_view_id),
 source_lifecycle_view_version integer NOT NULL CHECK (source_lifecycle_view_version >= 1),
 source_lifecycle_view_fingerprint_sha256 text NOT NULL CHECK (source_lifecycle_view_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 policy_version text NOT NULL CHECK (char_length(policy_version) BETWEEN 1 AND 100),
 request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
 result_snapshot jsonb NOT NULL,
 correlation_id text NOT NULL CHECK (char_length(correlation_id) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,idempotency_key)
);

CREATE INDEX markreg_recommended_action_commands_evaluation_idx
 ON markreg_recommended_action_commands(
  workspace_id,
  formal_matter_id,
  source_lifecycle_view_id,
  source_lifecycle_view_version,
  source_lifecycle_view_fingerprint_sha256,
  policy_version,
  created_at DESC
 );

CREATE TABLE markreg_recommended_action_audit (
 audit_id bigserial PRIMARY KEY,
 workspace_id uuid NOT NULL,
 recommended_action_id text NOT NULL REFERENCES markreg_recommended_actions(recommended_action_id),
 formal_matter_id text NOT NULL REFERENCES formal_matters(formal_matter_id),
 event_type text NOT NULL CHECK (event_type IN ('GENERATED','REGENERATED','ACKNOWLEDGED','DISMISSED','SUPPRESSED')),
 action_version integer NOT NULL CHECK (action_version >= 1),
 action_snapshot jsonb NOT NULL,
 context jsonb NOT NULL,
 correlation_id text NOT NULL CHECK (char_length(correlation_id) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL
);

CREATE INDEX markreg_recommended_action_audit_workspace_matter_idx
 ON markreg_recommended_action_audit(workspace_id,formal_matter_id,created_at ASC,audit_id ASC);

CREATE TRIGGER markreg_recommended_action_audit_append_only
 BEFORE UPDATE OR DELETE ON markreg_recommended_action_audit
 FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();
