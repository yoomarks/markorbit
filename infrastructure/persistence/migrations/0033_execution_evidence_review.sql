CREATE TABLE execution_evidence_review_sources (
  evidence_receipt_id text PRIMARY KEY CHECK (evidence_receipt_id ~ '^evidence-receipt_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  evidence_handoff_id text NOT NULL UNIQUE REFERENCES execution_provider_return_evidence_receipts(evidence_handoff_id),
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  evidence_receipt_fingerprint_sha256 text NOT NULL CHECK (evidence_receipt_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  provider_return_id text NOT NULL CHECK (provider_return_id ~ '^provider-return_[A-Za-z0-9_-]+$'),
  provider_return_version integer NOT NULL CHECK (provider_return_version > 0),
  provider_return_fingerprint_sha256 text NOT NULL CHECK (provider_return_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  provider_id text NOT NULL CHECK (provider_id ~ '^provider_[A-Za-z0-9_-]+$'),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  source_record jsonb NOT NULL,
  captured_at timestamptz NOT NULL,
  UNIQUE (workspace_id, evidence_receipt_id),
  UNIQUE (provider_return_id, provider_return_version)
);
CREATE INDEX execution_evidence_review_sources_workspace_captured_idx
  ON execution_evidence_review_sources(workspace_id, captured_at DESC, evidence_receipt_id);
CREATE INDEX execution_evidence_review_sources_return_idx
  ON execution_evidence_review_sources(provider_return_id, provider_return_version DESC);

CREATE TABLE execution_evidence_review_decisions (
  evidence_review_decision_id text PRIMARY KEY CHECK (evidence_review_decision_id ~ '^evidence-review-decision_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  evidence_receipt_id text NOT NULL,
  evidence_receipt_version integer NOT NULL CHECK (evidence_receipt_version > 0),
  evidence_receipt_fingerprint_sha256 text NOT NULL CHECK (evidence_receipt_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  outcome text NOT NULL CHECK (outcome IN ('ADMITTED_FOR_INTERNAL_USE','CORRECTION_REQUIRED','REJECTED')),
  reviewer_principal_id text NOT NULL CHECK (length(btrim(reviewer_principal_id)) > 0),
  rationale text NOT NULL CHECK (length(btrim(rationale)) > 0),
  correction_reasons jsonb NOT NULL CHECK (jsonb_typeof(correction_reasons) = 'array'),
  decision_fingerprint_sha256 text NOT NULL CHECK (decision_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  decision_record jsonb NOT NULL,
  reviewed_at timestamptz NOT NULL,
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  UNIQUE (evidence_receipt_id),
  FOREIGN KEY (workspace_id, evidence_receipt_id)
    REFERENCES execution_evidence_review_sources(workspace_id, evidence_receipt_id)
);
CREATE INDEX execution_evidence_review_decisions_workspace_reviewed_idx
  ON execution_evidence_review_decisions(workspace_id, reviewed_at DESC, evidence_review_decision_id);

CREATE TABLE execution_evidence_correction_requests (
  correction_request_id text PRIMARY KEY CHECK (correction_request_id ~ '^evidence-correction-request_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  evidence_review_decision_id text NOT NULL UNIQUE REFERENCES execution_evidence_review_decisions(evidence_review_decision_id),
  evidence_receipt_id text NOT NULL,
  provider_return_id text NOT NULL CHECK (provider_return_id ~ '^provider-return_[A-Za-z0-9_-]+$'),
  provider_return_version integer NOT NULL CHECK (provider_return_version > 0),
  reasons jsonb NOT NULL CHECK (jsonb_typeof(reasons) = 'array'),
  requested_by text NOT NULL CHECK (length(btrim(requested_by)) > 0),
  status text NOT NULL CHECK (status IN ('OPEN')),
  request_record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  FOREIGN KEY (workspace_id, evidence_receipt_id)
    REFERENCES execution_evidence_review_sources(workspace_id, evidence_receipt_id)
);
CREATE INDEX execution_evidence_correction_requests_workspace_created_idx
  ON execution_evidence_correction_requests(workspace_id, created_at DESC, correction_request_id);

CREATE TABLE execution_evidence_review_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  evidence_review_decision_id text NOT NULL REFERENCES execution_evidence_review_decisions(evidence_review_decision_id),
  response_record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE TABLE execution_evidence_review_audit (
  audit_id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('EVIDENCE_RECEIPT','EVIDENCE_REVIEW_DECISION','CORRECTION_REQUEST')),
  target_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('EVIDENCE_RECEIPT_SOURCE_CAPTURED','EVIDENCE_REVIEW_DECISION_RECORDED','CORRECTION_REQUEST_CREATED')),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);
CREATE INDEX execution_evidence_review_audit_workspace_created_idx
  ON execution_evidence_review_audit(workspace_id, created_at DESC, audit_id DESC);

CREATE OR REPLACE FUNCTION reject_execution_evidence_review_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'execution_evidence_review_audit is append-only';
END;
$$;

CREATE TRIGGER execution_evidence_review_audit_append_only
BEFORE UPDATE OR DELETE ON execution_evidence_review_audit
FOR EACH ROW EXECUTE FUNCTION reject_execution_evidence_review_audit_mutation();
