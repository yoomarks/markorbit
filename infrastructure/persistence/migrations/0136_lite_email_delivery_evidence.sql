CREATE TABLE lite_email_delivery_attempts (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  delivery_attempt_id text NOT NULL CHECK (delivery_attempt_id ~ '^email-delivery-attempt_[A-Za-z0-9_-]+$'),
  execution_release_id text NOT NULL CHECK (execution_release_id ~ '^protected-action-release_[A-Za-z0-9_-]+$'),
  campaign_id text NOT NULL CHECK (campaign_id ~ '^email-campaign_[A-Za-z0-9_-]+$'),
  campaign_version integer NOT NULL CHECK (campaign_version > 0),
  sender_profile_id text NOT NULL CHECK (sender_profile_id ~ '^email-sender-profile_[A-Za-z0-9_-]+$'),
  sender_profile_version integer NOT NULL CHECK (sender_profile_version > 0),
  shard_index integer NOT NULL CHECK (shard_index >= 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status text NOT NULL CHECK (status IN ('PLANNED','SUBMITTING','ACCEPTED','UNKNOWN','FAILED','RECONCILING','RECONCILED')),
  recipient_count integer NOT NULL CHECK (recipient_count > 0),
  recipient_manifest_fingerprint_sha256 text NOT NULL CHECK (recipient_manifest_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  delivery_plan_fingerprint_sha256 text NOT NULL CHECK (delivery_plan_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  correlation_id text NOT NULL CHECK (btrim(correlation_id) <> ''),
  provider_submission_ref text,
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, delivery_attempt_id),
  UNIQUE (workspace_id, execution_release_id, shard_index, attempt_number)
);

CREATE INDEX lite_email_delivery_attempt_read
  ON lite_email_delivery_attempts(workspace_id, campaign_id, campaign_version, updated_at DESC);

CREATE TABLE lite_email_delivery_observations (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  observation_id text NOT NULL CHECK (observation_id ~ '^email-delivery-observation_[A-Za-z0-9_-]+$'),
  delivery_attempt_id text NOT NULL,
  event_identity text NOT NULL CHECK (btrim(event_identity) <> ''),
  event text NOT NULL CHECK (event IN ('SUBMITTED','ACCEPTED','DELIVERED','DEFERRED','HARD_BOUNCED','SOFT_BOUNCED','COMPLAINED','UNSUBSCRIBED','FAILED','UNKNOWN')),
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('ADAPTER_TRANSPORT','PROVIDER_EVENT','PROVIDER_RECONCILIATION')),
  provider_message_ref text,
  endpoint_fingerprint_sha256 text CHECK (endpoint_fingerprint_sha256 IS NULL OR endpoint_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  authenticated_evidence boolean NOT NULL CHECK (authenticated_evidence = true),
  reason_code text NOT NULL CHECK (btrim(reason_code) <> ''),
  event_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL,
  document_json jsonb NOT NULL,
  PRIMARY KEY (workspace_id, observation_id),
  UNIQUE (workspace_id, event_identity),
  FOREIGN KEY (workspace_id, delivery_attempt_id)
    REFERENCES lite_email_delivery_attempts(workspace_id, delivery_attempt_id)
    ON DELETE CASCADE
);

CREATE INDEX lite_email_delivery_observation_read
  ON lite_email_delivery_observations(workspace_id, delivery_attempt_id, event_at, observed_at);

CREATE TABLE lite_email_delivery_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500),
  command_type text NOT NULL CHECK (command_type IN ('CREATE_ATTEMPT','UPDATE_ATTEMPT','RECORD_OBSERVATION')),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
