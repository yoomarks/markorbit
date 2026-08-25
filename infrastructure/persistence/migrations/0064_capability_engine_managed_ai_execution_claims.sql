CREATE TABLE capability_managed_ai_execution_claims (
 idempotency_key text PRIMARY KEY CHECK (btrim(idempotency_key) <> ''),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 execution_id text NOT NULL UNIQUE CHECK (execution_id ~ '^maiexec_[0-9a-f]{32}$'),
 correlation_id text NOT NULL CHECK (btrim(correlation_id) <> ''),
 state text NOT NULL CHECK (state IN ('CLAIMED','DISPATCHING','COMPLETED','RECONCILIATION_REQUIRED')),
 owner_token text NOT NULL CHECK (btrim(owner_token) <> ''),
 lease_expires_at timestamptz NOT NULL,
 outcome_json jsonb,
 reconciliation_reason text,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 dispatched_at timestamptz,
 completed_at timestamptz,
 CHECK (updated_at >= created_at),
 CHECK ((state = 'COMPLETED') = (outcome_json IS NOT NULL)),
 CHECK ((state = 'COMPLETED') = (completed_at IS NOT NULL)),
 CHECK (state <> 'CLAIMED' OR dispatched_at IS NULL),
 CHECK (state NOT IN ('DISPATCHING','RECONCILIATION_REQUIRED','COMPLETED') OR dispatched_at IS NOT NULL),
 CHECK ((state = 'RECONCILIATION_REQUIRED') = (reconciliation_reason IS NOT NULL)),
 CHECK (reconciliation_reason IS NULL OR btrim(reconciliation_reason) <> '')
);

CREATE INDEX capability_managed_ai_execution_claims_state_lease
 ON capability_managed_ai_execution_claims(state, lease_expires_at);
