CREATE TABLE IF NOT EXISTS capability_communication_accounts (
  workspace_id text NOT NULL,
  account_ref text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('EMAIL')),
  provider text NOT NULL,
  provider_account_ref text NOT NULL,
  binding_fingerprint_sha256 char(64) NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, account_ref),
  UNIQUE (workspace_id, provider, provider_account_ref),
  CONSTRAINT capability_communication_accounts_binding_sha_v1
    CHECK (binding_fingerprint_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE TABLE IF NOT EXISTS capability_communication_messages (
  workspace_id text NOT NULL,
  account_ref text NOT NULL,
  provider text NOT NULL,
  provider_message_id text NOT NULL,
  provider_thread_id text,
  message_id text NOT NULL,
  thread_ref text NOT NULL,
  idempotency_key_sha256 char(64) NOT NULL,
  observation_fingerprint_sha256 char(64) NOT NULL,
  message_json jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, account_ref, provider, provider_message_id),
  UNIQUE (workspace_id, account_ref, idempotency_key_sha256),
  UNIQUE (workspace_id, message_id),
  FOREIGN KEY (workspace_id, account_ref)
    REFERENCES capability_communication_accounts (workspace_id, account_ref)
    ON DELETE RESTRICT,
  CONSTRAINT capability_communication_messages_idempotency_sha_v1
    CHECK (idempotency_key_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT capability_communication_messages_observation_sha_v1
    CHECK (observation_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT capability_communication_messages_json_v1
    CHECK (jsonb_typeof(message_json) = 'object')
);

CREATE INDEX IF NOT EXISTS capability_communication_messages_thread_idx
  ON capability_communication_messages (workspace_id, account_ref, thread_ref, occurred_at(message_json));

CREATE TABLE IF NOT EXISTS capability_communication_checkpoints (
  workspace_id text NOT NULL,
  account_ref text NOT NULL,
  checkpoint_ref text NOT NULL,
  provider_cursor text NOT NULL,
  cursor_sha256 char(64) NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, account_ref, checkpoint_ref),
  FOREIGN KEY (workspace_id, account_ref)
    REFERENCES capability_communication_accounts (workspace_id, account_ref)
    ON DELETE RESTRICT,
  CONSTRAINT capability_communication_checkpoints_cursor_sha_v1
    CHECK (cursor_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS capability_communication_checkpoints_latest_idx
  ON capability_communication_checkpoints (workspace_id, account_ref, observed_at DESC, created_at DESC);

COMMENT ON TABLE capability_communication_accounts IS
  'Workspace-scoped provider-neutral Communication account bindings. No provider credentials are stored.';
COMMENT ON TABLE capability_communication_messages IS
  'Immutable normalized Communication observations with hashed idempotency keys and integrity fingerprints.';
COMMENT ON TABLE capability_communication_checkpoints IS
  'Immutable provider cursor checkpoints for restart-safe Communication ingestion.';
