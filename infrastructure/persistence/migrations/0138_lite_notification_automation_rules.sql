CREATE TABLE lite_notification_automation_rule_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  notification_rule_id text NOT NULL
    CHECK (notification_rule_id ~ '^channel-notification-rule_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','REVOKED')),
  feature_key text NOT NULL CHECK (feature_key = 'EMAIL_NOTIFICATION'),
  trigger_owner text NOT NULL CHECK (btrim(trigger_owner) <> '' AND char_length(trigger_owner) <= 120),
  trigger_event_type text NOT NULL CHECK (btrim(trigger_event_type) <> '' AND char_length(trigger_event_type) <= 160),
  trigger_subject_kind text NOT NULL CHECK (btrim(trigger_subject_kind) <> '' AND char_length(trigger_subject_kind) <= 120),
  publish_package_id text NOT NULL CHECK (publish_package_id ~ '^publish-package_[A-Za-z0-9_-]+$'),
  publish_package_version integer NOT NULL CHECK (publish_package_version > 0),
  publish_package_fingerprint_sha256 text NOT NULL
    CHECK (publish_package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  sender_profile_id text NOT NULL CHECK (sender_profile_id ~ '^email-sender-profile_[A-Za-z0-9_-]+$'),
  sender_profile_version integer NOT NULL CHECK (sender_profile_version > 0),
  sender_profile_fingerprint_sha256 text NOT NULL
    CHECK (sender_profile_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  rate_policy_ref text NOT NULL CHECK (btrim(rate_policy_ref) <> '' AND char_length(rate_policy_ref) <= 300),
  rule_intent_fingerprint_sha256 text NOT NULL CHECK (rule_intent_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  rule_fingerprint_sha256 text NOT NULL CHECK (rule_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  suspended_at timestamptz,
  revoked_at timestamptz,
  PRIMARY KEY (workspace_id, notification_rule_id, version),
  CHECK (updated_at >= created_at),
  CHECK (
    (status IN ('DRAFT','ACTIVE') AND suspended_at IS NULL AND revoked_at IS NULL) OR
    (status='SUSPENDED' AND suspended_at IS NOT NULL AND revoked_at IS NULL) OR
    (status='REVOKED' AND suspended_at IS NULL AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX lite_notification_automation_rule_versions_history
  ON lite_notification_automation_rule_versions(workspace_id, notification_rule_id, version DESC);

CREATE TABLE lite_notification_automation_rule_heads (
  workspace_id uuid NOT NULL,
  notification_rule_id text NOT NULL,
  latest_version integer NOT NULL CHECK (latest_version > 0),
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','REVOKED')),
  feature_key text NOT NULL CHECK (feature_key = 'EMAIL_NOTIFICATION'),
  trigger_owner text NOT NULL,
  trigger_event_type text NOT NULL,
  trigger_subject_kind text NOT NULL,
  publish_package_id text NOT NULL,
  publish_package_version integer NOT NULL CHECK (publish_package_version > 0),
  publish_package_fingerprint_sha256 text NOT NULL
    CHECK (publish_package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  sender_profile_id text NOT NULL,
  sender_profile_version integer NOT NULL CHECK (sender_profile_version > 0),
  sender_profile_fingerprint_sha256 text NOT NULL
    CHECK (sender_profile_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  rate_policy_ref text NOT NULL,
  rule_intent_fingerprint_sha256 text NOT NULL CHECK (rule_intent_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  rule_fingerprint_sha256 text NOT NULL CHECK (rule_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, notification_rule_id),
  FOREIGN KEY (workspace_id, notification_rule_id, latest_version)
    REFERENCES lite_notification_automation_rule_versions(workspace_id, notification_rule_id, version)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX lite_notification_automation_one_active_intent
  ON lite_notification_automation_rule_heads(workspace_id, rule_intent_fingerprint_sha256)
  WHERE status='ACTIVE';

CREATE INDEX lite_notification_automation_latest_list
  ON lite_notification_automation_rule_heads(
    workspace_id, status, feature_key, updated_at DESC, notification_rule_id
  );

CREATE TABLE lite_notification_automation_rule_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500),
  command_type text NOT NULL CHECK (command_type IN ('CREATE_DRAFT','ACTIVATE','SUSPEND','REVOKE')),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
