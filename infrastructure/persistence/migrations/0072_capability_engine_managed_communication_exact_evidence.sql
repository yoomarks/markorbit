CREATE TABLE IF NOT EXISTS capability_communication_exact_evidence (
  workspace_id text NOT NULL,
  account_ref text NOT NULL,
  message_id text NOT NULL,
  evidence_ref text NOT NULL,
  provider text NOT NULL,
  provider_message_id text NOT NULL,
  media_type text NOT NULL,
  payload_sha256 char(64) NOT NULL,
  payload_size_bytes bigint NOT NULL CHECK (payload_size_bytes >= 0),
  raw_payload bytea NOT NULL,
  provenance_json jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, account_ref, message_id),
  UNIQUE (workspace_id, evidence_ref),
  FOREIGN KEY (workspace_id, account_ref, message_id)
    REFERENCES capability_communication_messages (workspace_id, account_ref, message_id)
    ON DELETE RESTRICT,
  CONSTRAINT capability_communication_exact_evidence_payload_sha_v1
    CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT capability_communication_exact_evidence_provenance_v1
    CHECK (jsonb_typeof(provenance_json) = 'object'),
  CONSTRAINT capability_communication_exact_evidence_payload_size_v1
    CHECK (octet_length(raw_payload) = payload_size_bytes)
);

COMMENT ON TABLE capability_communication_exact_evidence IS
  'Immutable exact provider message evidence for Managed Communication. Raw provider bytes stay in Core; consumers receive stable evidence refs, integrity digests, and provenance metadata without credentials.';
