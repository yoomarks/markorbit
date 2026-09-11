CREATE TABLE lite_communication_link_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  communication_link_id text NOT NULL CHECK (communication_link_id ~ '^communication-link_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  source_scope text NOT NULL CHECK (source_scope IN ('MESSAGE','THREAD')),
  account_ref text NOT NULL CHECK (btrim(account_ref) <> ''),
  message_id text NOT NULL CHECK (btrim(message_id) <> ''),
  thread_ref text NOT NULL CHECK (btrim(thread_ref) <> ''),
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  provider_message_id text NOT NULL CHECK (btrim(provider_message_id) <> ''),
  observed_at timestamptz NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN (
    'CUSTOMER_RELATIONSHIP','WORKSPACE_DIRECTORY_ENTRY','TRADEMARK_ASSET','FORMAL_MATTER','PRODUCTION_INTAKE'
  )),
  target_identity_key text NOT NULL CHECK (btrim(target_identity_key) <> ''),
  target_version integer NOT NULL CHECK (target_version > 0),
  lifecycle text NOT NULL CHECK (lifecycle IN ('ACTIVE','ARCHIVED')),
  decision_status text NOT NULL CHECK (decision_status IN ('CONFIRMED','REJECTED')),
  decision_basis text NOT NULL CHECK (decision_basis IN ('MANUAL','EXACT_IDENTIFIER','CONFIRMED_THREAD_INHERITANCE')),
  subject_fingerprint_sha256 text NOT NULL CHECK (subject_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  decision_fingerprint_sha256 text NOT NULL CHECK (decision_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz,
  PRIMARY KEY (workspace_id, communication_link_id, version),
  CHECK (updated_at >= created_at),
  CHECK ((lifecycle='ACTIVE' AND archived_at IS NULL) OR (lifecycle='ARCHIVED' AND archived_at IS NOT NULL))
);

CREATE INDEX lite_communication_link_versions_history
  ON lite_communication_link_versions(workspace_id, communication_link_id, version DESC);

CREATE TABLE lite_communication_link_heads (
  workspace_id uuid NOT NULL,
  communication_link_id text NOT NULL,
  latest_version integer NOT NULL CHECK (latest_version > 0),
  source_scope text NOT NULL CHECK (source_scope IN ('MESSAGE','THREAD')),
  account_ref text NOT NULL CHECK (btrim(account_ref) <> ''),
  message_id text NOT NULL CHECK (btrim(message_id) <> ''),
  thread_ref text NOT NULL CHECK (btrim(thread_ref) <> ''),
  target_kind text NOT NULL CHECK (target_kind IN (
    'CUSTOMER_RELATIONSHIP','WORKSPACE_DIRECTORY_ENTRY','TRADEMARK_ASSET','FORMAL_MATTER','PRODUCTION_INTAKE'
  )),
  target_identity_key text NOT NULL CHECK (btrim(target_identity_key) <> ''),
  target_version integer NOT NULL CHECK (target_version > 0),
  lifecycle text NOT NULL CHECK (lifecycle IN ('ACTIVE','ARCHIVED')),
  decision_status text NOT NULL CHECK (decision_status IN ('CONFIRMED','REJECTED')),
  decision_basis text NOT NULL CHECK (decision_basis IN ('MANUAL','EXACT_IDENTIFIER','CONFIRMED_THREAD_INHERITANCE')),
  subject_fingerprint_sha256 text NOT NULL CHECK (subject_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  decision_fingerprint_sha256 text NOT NULL CHECK (decision_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, communication_link_id),
  FOREIGN KEY (workspace_id, communication_link_id, latest_version)
    REFERENCES lite_communication_link_versions(workspace_id, communication_link_id, version)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX lite_communication_link_one_active_subject
  ON lite_communication_link_heads(workspace_id, subject_fingerprint_sha256)
  WHERE lifecycle='ACTIVE';

CREATE INDEX lite_communication_link_thread_lookup
  ON lite_communication_link_heads(
    workspace_id, source_scope, account_ref, thread_ref, lifecycle, decision_status, target_kind, updated_at DESC
  );

CREATE INDEX lite_communication_link_latest_list
  ON lite_communication_link_heads(workspace_id, lifecycle, target_kind, updated_at DESC, communication_link_id);

CREATE TABLE lite_communication_link_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500),
  command_type text NOT NULL CHECK (command_type IN ('CREATE','ARCHIVE')),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
