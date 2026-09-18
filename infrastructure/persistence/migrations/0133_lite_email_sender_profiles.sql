CREATE TABLE lite_email_sender_profile_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  sender_profile_id text NOT NULL CHECK (sender_profile_id ~ '^email-sender-profile_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','REVOKED')),
  from_domain text NOT NULL CHECK (btrim(from_domain) <> ''),
  from_address text NOT NULL CHECK (btrim(from_address) <> ''),
  verification_status text NOT NULL CHECK (verification_status IN ('PENDING','VERIFIED','FAILED','UNKNOWN','UNAVAILABLE')),
  verification_observed_at timestamptz NOT NULL,
  reputation_isolation_key text NOT NULL CHECK (btrim(reputation_isolation_key) <> ''),
  document_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, sender_profile_id, version)
);

CREATE INDEX lite_email_sender_profile_latest
  ON lite_email_sender_profile_versions(workspace_id, sender_profile_id, version DESC);

CREATE INDEX lite_email_sender_profile_status_read
  ON lite_email_sender_profile_versions(workspace_id, status, updated_at DESC, sender_profile_id, version DESC);

CREATE TABLE lite_email_sender_profile_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500),
  command_type text NOT NULL CHECK (command_type IN ('CREATE','UPDATE','VERIFY','SUSPEND','REVOKE')),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
