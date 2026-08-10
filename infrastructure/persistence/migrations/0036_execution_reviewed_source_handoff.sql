CREATE TABLE execution_reviewed_source_admissions (
  reviewed_source_admission_id text PRIMARY KEY CHECK (reviewed_source_admission_id ~ '^reviewed-source-admission_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  evidence_review_decision_id text NOT NULL UNIQUE REFERENCES execution_evidence_review_decisions(evidence_review_decision_id),
  evidence_review_decision_version integer NOT NULL CHECK (evidence_review_decision_version > 0),
  evidence_review_decision_fingerprint_sha256 text NOT NULL CHECK (evidence_review_decision_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  formal_matter_id text NOT NULL CHECK (formal_matter_id ~ '^formal-matter_[A-Za-z0-9_-]+$'),
  formal_matter_version text NOT NULL CHECK (length(btrim(formal_matter_version)) > 0),
  admitted_evidence_references jsonb NOT NULL CHECK (jsonb_typeof(admitted_evidence_references) = 'array'),
  admission_fingerprint_sha256 text NOT NULL CHECK (admission_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  admission_record jsonb NOT NULL,
  admitted_by text NOT NULL CHECK (length(btrim(admitted_by)) > 0),
  admitted_at timestamptz NOT NULL,
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  UNIQUE (workspace_id, reviewed_source_admission_id)
);
CREATE INDEX execution_reviewed_source_admissions_workspace_admitted_idx
  ON execution_reviewed_source_admissions(workspace_id, admitted_at DESC, reviewed_source_admission_id);

CREATE TABLE execution_reviewed_source_admission_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  reviewed_source_admission_id text NOT NULL REFERENCES execution_reviewed_source_admissions(reviewed_source_admission_id),
  response_record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE TABLE execution_reviewed_source_handoffs (
  reviewed_source_admission_id text PRIMARY KEY REFERENCES execution_reviewed_source_admissions(reviewed_source_admission_id),
  workspace_id uuid NOT NULL,
  delivery_idempotency_key text NOT NULL,
  delivery_request_fingerprint text NOT NULL CHECK (delivery_request_fingerprint ~ '^[0-9a-f]{64}$'),
  markreg_idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING','DELIVERED')),
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  last_error_code text,
  last_attempt_at timestamptz NOT NULL,
  delivered_at timestamptz,
  response_record jsonb,
  UNIQUE (workspace_id, delivery_idempotency_key),
  UNIQUE (workspace_id, reviewed_source_admission_id),
  CHECK ((status = 'DELIVERED' AND delivered_at IS NOT NULL AND response_record IS NOT NULL) OR status = 'PENDING')
);
CREATE INDEX execution_reviewed_source_handoffs_workspace_status_idx
  ON execution_reviewed_source_handoffs(workspace_id, status, last_attempt_at DESC);

CREATE TABLE execution_reviewed_source_handoff_audit (
  audit_id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL,
  reviewed_source_admission_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('REVIEWED_SOURCE_ADMITTED','HANDOFF_ATTEMPTED','HANDOFF_RETRY_RECORDED','HANDOFF_DELIVERED')),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);
CREATE INDEX execution_reviewed_source_handoff_audit_workspace_created_idx
  ON execution_reviewed_source_handoff_audit(workspace_id, created_at DESC, audit_id DESC);

CREATE OR REPLACE FUNCTION reject_execution_reviewed_source_handoff_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'execution_reviewed_source_handoff_audit is append-only';
END;
$$;

CREATE TRIGGER execution_reviewed_source_handoff_audit_append_only
BEFORE UPDATE OR DELETE ON execution_reviewed_source_handoff_audit
FOR EACH ROW EXECUTE FUNCTION reject_execution_reviewed_source_handoff_audit_mutation();
