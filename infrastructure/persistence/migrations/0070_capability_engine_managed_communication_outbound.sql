CREATE TABLE IF NOT EXISTS capability_communication_send_claims (
  workspace_id text NOT NULL,
  account_ref text NOT NULL,
  idempotency_key_sha256 char(64) NOT NULL,
  request_fingerprint_sha256 char(64) NOT NULL,
  send_id text NOT NULL,
  state text NOT NULL CHECK (
    state IN ('CLAIMED','DISPATCHING','SENT','RECONCILIATION_REQUIRED')
  ),
  owner_token text NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  receipt_json jsonb,
  reconciliation_reason text,
  dispatched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, account_ref, idempotency_key_sha256),
  UNIQUE (workspace_id, send_id),
  FOREIGN KEY (workspace_id, account_ref)
    REFERENCES capability_communication_accounts (workspace_id, account_ref)
    ON DELETE RESTRICT,
  CONSTRAINT capability_communication_send_claims_idempotency_sha_v1
    CHECK (idempotency_key_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT capability_communication_send_claims_request_sha_v1
    CHECK (request_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT capability_communication_send_claims_receipt_state_v1
    CHECK ((state = 'SENT' AND receipt_json IS NOT NULL) OR state <> 'SENT'),
  CONSTRAINT capability_communication_send_claims_receipt_json_v1
    CHECK (receipt_json IS NULL OR jsonb_typeof(receipt_json) = 'object'),
  CONSTRAINT capability_communication_send_claims_reconciliation_v1
    CHECK (
      (state = 'RECONCILIATION_REQUIRED' AND reconciliation_reason IS NOT NULL)
      OR state <> 'RECONCILIATION_REQUIRED'
    )
);

CREATE INDEX IF NOT EXISTS capability_communication_send_claims_state_idx
  ON capability_communication_send_claims (workspace_id, account_ref, state, updated_at DESC);

COMMENT ON TABLE capability_communication_send_claims IS
  'Workspace-scoped exactly-once logical outbound Communication claims. Provider credentials are never persisted; uncertain delivery is reconciliation-required and cannot auto-resend.';
