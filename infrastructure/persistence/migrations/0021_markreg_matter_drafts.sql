CREATE TABLE matter_drafts (
  matter_draft_id text PRIMARY KEY CHECK (matter_draft_id ~ '^matter-draft_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  customer_confirmation_id text NOT NULL REFERENCES customer_confirmations(confirmation_id),
  customer_confirmation_version integer NOT NULL CHECK (customer_confirmation_version > 0),
  source_quote_id text NOT NULL,
  source_quote_version text NOT NULL,
  preparation jsonb NOT NULL,
  instruction_completeness text NOT NULL CHECK (instruction_completeness IN ('INCOMPLETE','COMPLETE')),
  document_readiness text NOT NULL CHECK (document_readiness IN ('MISSING','READY')),
  readiness jsonb NOT NULL,
  missing_information jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','NEEDS_INFORMATION','READY_FOR_PROFESSIONAL_REVIEW','WITHDRAWN')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (workspace_id, customer_confirmation_id)
);
CREATE INDEX matter_drafts_workspace_updated_idx ON matter_drafts (workspace_id, updated_at DESC);
