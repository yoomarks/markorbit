CREATE TABLE execution_provider_return_evidence_receipts (
  evidence_handoff_id text PRIMARY KEY CHECK (evidence_handoff_id ~ '^evidence-handoff_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  provider_return_id text NOT NULL CHECK (provider_return_id ~ '^provider-return_[A-Za-z0-9_-]+$'),
  provider_return_version integer NOT NULL CHECK (provider_return_version > 0),
  provider_return_fingerprint_sha256 text NOT NULL CHECK (provider_return_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  provider_id text NOT NULL CHECK (provider_id ~ '^provider_[A-Za-z0-9_-]+$'),
  provider_workspace_id uuid NOT NULL,
  provider_actor_id text NOT NULL CHECK (length(btrim(provider_actor_id)) > 0),
  execution_release_id text NOT NULL,
  execution_release_version integer NOT NULL CHECK (execution_release_version > 0),
  filing_execution_task_draft_id text NOT NULL,
  filing_execution_task_draft_version text NOT NULL CHECK (length(btrim(filing_execution_task_draft_version)) > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  review_status text NOT NULL CHECK (review_status IN ('PENDING_REVIEW')),
  receipt_record jsonb NOT NULL,
  received_at timestamptz NOT NULL,
  UNIQUE (provider_return_id, provider_return_version),
  FOREIGN KEY (workspace_id, execution_release_id)
    REFERENCES execution_releases(workspace_id, execution_release_id),
  FOREIGN KEY (workspace_id, filing_execution_task_draft_id)
    REFERENCES filing_execution_task_drafts(workspace_id, filing_execution_task_draft_id)
);
CREATE INDEX execution_provider_return_evidence_workspace_received_idx
  ON execution_provider_return_evidence_receipts(workspace_id, received_at DESC, evidence_handoff_id);
CREATE INDEX execution_provider_return_evidence_provider_received_idx
  ON execution_provider_return_evidence_receipts(provider_id, received_at DESC, evidence_handoff_id);

CREATE TABLE execution_provider_return_evidence_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  evidence_handoff_id text NOT NULL REFERENCES execution_provider_return_evidence_receipts(evidence_handoff_id),
  receipt_record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE TABLE execution_provider_return_evidence_audit (
  audit_id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL,
  evidence_handoff_id text NOT NULL,
  provider_return_id text NOT NULL,
  provider_return_version integer NOT NULL CHECK (provider_return_version > 0),
  action text NOT NULL CHECK (action IN ('PROVIDER_RETURN_EVIDENCE_RECEIVED')),
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL
);
CREATE INDEX execution_provider_return_evidence_audit_workspace_created_idx
  ON execution_provider_return_evidence_audit(workspace_id, created_at DESC, audit_id DESC);

CREATE OR REPLACE FUNCTION reject_execution_provider_return_evidence_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'execution_provider_return_evidence_audit is append-only';
END;
$$;

CREATE TRIGGER execution_provider_return_evidence_audit_append_only
BEFORE UPDATE OR DELETE ON execution_provider_return_evidence_audit
FOR EACH ROW EXECUTE FUNCTION reject_execution_provider_return_evidence_audit_mutation();
