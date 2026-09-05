CREATE TABLE governed_human_action_receipts (
  receipt_id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('PROVIDER_SELECTION', 'CONTROLLED_HANDOFF')),
  workspace_id text NOT NULL,
  user_id text NOT NULL,
  membership_id text NOT NULL,
  principal_reference text NOT NULL,
  authority_reference text NOT NULL,
  idempotency_key_sha256 text NOT NULL CHECK (idempotency_key_sha256 ~ '^[0-9a-f]{64}$'),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  authenticated_at timestamptz NOT NULL,
  receipt_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT governed_human_action_receipts_replay_key
    UNIQUE (kind, workspace_id, user_id, membership_id, idempotency_key_sha256)
);

CREATE INDEX governed_human_action_receipts_workspace_kind_created_idx
  ON governed_human_action_receipts(workspace_id, kind, created_at DESC);
