CREATE TABLE customer_confirmations (
  confirmation_id text PRIMARY KEY CHECK (confirmation_id ~ '^confirmation_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  source_quote_id text NOT NULL,
  source_quote_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('CONFIRMED', 'WITHDRAWN')),
  version integer NOT NULL CHECK (version > 0),
  snapshot_schema_version integer NOT NULL CHECK (snapshot_schema_version = 1),
  source_snapshot jsonb NOT NULL,
  source_snapshot_hash char(64) NOT NULL CHECK (source_snapshot_hash ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  CONSTRAINT customer_confirmations_source_version_unique UNIQUE (workspace_id, source_quote_id, source_quote_version),
  CONSTRAINT customer_confirmations_withdrawal_consistent CHECK ((status = 'CONFIRMED' AND withdrawn_at IS NULL) OR (status = 'WITHDRAWN' AND withdrawn_at IS NOT NULL))
);
