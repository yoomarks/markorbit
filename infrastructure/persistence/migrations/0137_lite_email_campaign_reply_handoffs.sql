CREATE TABLE lite_email_campaign_reply_handoffs (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  reply_handoff_id text NOT NULL CHECK (reply_handoff_id ~ '^email-campaign-reply-handoff_[A-Za-z0-9_-]+$'),
  campaign_id text NOT NULL CHECK (campaign_id ~ '^email-campaign_[A-Za-z0-9_-]+$'),
  campaign_version integer NOT NULL CHECK (campaign_version > 0),
  delivery_attempt_id text NOT NULL CHECK (delivery_attempt_id ~ '^email-delivery-attempt_[A-Za-z0-9_-]+$'),
  sender_profile_id text NOT NULL CHECK (sender_profile_id ~ '^email-sender-profile_[A-Za-z0-9_-]+$'),
  sender_profile_version integer NOT NULL CHECK (sender_profile_version > 0),
  managed_account_ref text NOT NULL CHECK (btrim(managed_account_ref) <> ''),
  managed_message_id text NOT NULL CHECK (btrim(managed_message_id) <> ''),
  managed_thread_ref text NOT NULL CHECK (btrim(managed_thread_ref) <> ''),
  managed_provider text NOT NULL CHECK (btrim(managed_provider) <> ''),
  managed_provider_message_id text NOT NULL CHECK (btrim(managed_provider_message_id) <> ''),
  inbound_evidence_ref text NOT NULL CHECK (btrim(inbound_evidence_ref) <> ''),
  inbound_evidence_sha256 text NOT NULL CHECK (inbound_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  outbound_provider_submission_ref text NOT NULL CHECK (btrim(outbound_provider_submission_ref) <> ''),
  correlation_method text NOT NULL CHECK (correlation_method = 'PROVIDER_MESSAGE_REFERENCE'),
  correlation_evidence_fingerprint_sha256 text NOT NULL CHECK (correlation_evidence_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status = 'CORRELATED'),
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, reply_handoff_id),
  UNIQUE (workspace_id, managed_account_ref, managed_message_id, delivery_attempt_id),
  FOREIGN KEY (workspace_id, delivery_attempt_id)
    REFERENCES lite_email_delivery_attempts(workspace_id, delivery_attempt_id)
    ON DELETE CASCADE
);

CREATE INDEX lite_email_campaign_reply_handoff_campaign_read
  ON lite_email_campaign_reply_handoffs(workspace_id, campaign_id, campaign_version, created_at DESC);

CREATE INDEX lite_email_campaign_reply_handoff_attempt_read
  ON lite_email_campaign_reply_handoffs(workspace_id, delivery_attempt_id, created_at DESC);

CREATE TABLE lite_email_campaign_reply_handoff_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500),
  command_type text NOT NULL CHECK (command_type = 'RECORD_CORRELATED_REPLY'),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
