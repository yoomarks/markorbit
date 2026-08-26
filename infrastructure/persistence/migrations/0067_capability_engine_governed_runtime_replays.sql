CREATE TABLE IF NOT EXISTS capability_governed_runtime_replays (
  idempotency_key_sha256 char(64) PRIMARY KEY,
  request_fingerprint_sha256 char(64) NOT NULL,
  state text NOT NULL CHECK (state IN ('IN_PROGRESS','COMPLETED')),
  owner_token text NOT NULL,
  execution_fingerprint_sha256 char(64),
  execution_json jsonb,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  CONSTRAINT capability_governed_runtime_replays_idempotency_sha_v1
    CHECK (idempotency_key_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT capability_governed_runtime_replays_request_sha_v1
    CHECK (request_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT capability_governed_runtime_replays_execution_sha_v1
    CHECK (
      execution_fingerprint_sha256 IS NULL
      OR execution_fingerprint_sha256 ~ '^[a-f0-9]{64}$'
    ),
  CONSTRAINT capability_governed_runtime_replays_completion_v1
    CHECK (
      (state = 'IN_PROGRESS'
        AND execution_fingerprint_sha256 IS NULL
        AND execution_json IS NULL
        AND completed_at IS NULL)
      OR
      (state = 'COMPLETED'
        AND execution_fingerprint_sha256 IS NOT NULL
        AND execution_json IS NOT NULL
        AND jsonb_typeof(execution_json) = 'object'
        AND completed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS capability_governed_runtime_replays_state_idx
  ON capability_governed_runtime_replays (state, created_at);

COMMENT ON TABLE capability_governed_runtime_replays IS
  'Immutable governed Capability execution replay claims. Raw idempotency keys are not stored; completed execution envelopes are integrity-fingerprinted for restart-safe exact replay.';
