CREATE TABLE IF NOT EXISTS core_method_outcome_evidence (
  method_outcome_evidence_id text PRIMARY KEY
    CHECK (method_outcome_evidence_id ~ '^method-outcome-evidence_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  source_owner text NOT NULL CHECK (source_owner = 'MARKREG'),
  source_kind text NOT NULL CHECK (source_kind = 'MATTER_INTELLIGENCE_REVIEW'),
  source_id text NOT NULL
    CHECK (source_id ~ '^matter-intelligence-review_[A-Za-z0-9_-]+$'),
  source_version integer NOT NULL CHECK (source_version >= 1),
  source_fingerprint_sha256 char(64) NOT NULL
    CHECK (source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  formal_matter_id text NOT NULL CHECK (formal_matter_id ~ '^formal-matter_[A-Za-z0-9_-]+$'),
  formal_matter_version integer NOT NULL CHECK (formal_matter_version >= 1),
  observation_id text NOT NULL
    CHECK (observation_id ~ '^matter-intelligence-observation_[A-Za-z0-9_-]+$'),
  observation_fingerprint_sha256 char(64) NOT NULL
    CHECK (observation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  observation_output_fingerprint_sha256 char(64) NOT NULL
    CHECK (observation_output_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  review_id text NOT NULL
    CHECK (review_id ~ '^matter-intelligence-review_[A-Za-z0-9_-]+$'),
  review_version integer NOT NULL CHECK (review_version >= 1),
  review_fingerprint_sha256 char(64) NOT NULL
    CHECK (review_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('CONFIRMED', 'OVERRIDDEN', 'INCONCLUSIVE')),
  reason text NULL CHECK (
    reason IS NULL OR reason IN (
      'METHOD_ERROR',
      'INPUT_DATA_ERROR',
      'APPLICABILITY_ERROR',
      'PRODUCT_USER_PREFERENCE',
      'INCONCLUSIVE_EVIDENCE'
    )
  ),
  reviewed_by_principal_id text NOT NULL CHECK (char_length(reviewed_by_principal_id) BETWEEN 1 AND 300),
  reviewed_at timestamptz NOT NULL,
  capability_id text NOT NULL CHECK (char_length(capability_id) BETWEEN 1 AND 300),
  capability_version text NOT NULL CHECK (char_length(capability_version) BETWEEN 1 AND 120),
  capability_request_id text NOT NULL CHECK (capability_request_id ~ '^capreq_[A-Za-z0-9_-]+$'),
  capability_return_id text NOT NULL CHECK (capability_return_id ~ '^capability-return_[A-Za-z0-9_-]+$'),
  capability_outcome_id text NOT NULL CHECK (capability_outcome_id ~ '^capability-outcome_[A-Za-z0-9_-]+$'),
  capability_invocation_id text NOT NULL
    CHECK (capability_invocation_id ~ '^capability-invocation_[A-Za-z0-9_-]+$'),
  session_receipt_id text NOT NULL CHECK (session_receipt_id ~ '^session-receipt_[A-Za-z0-9_-]+$'),
  implementation_id text NOT NULL
    CHECK (implementation_id ~ '^implementation-profile_[A-Za-z0-9._-]+$'),
  implementation_version integer NOT NULL CHECK (implementation_version >= 1),
  implementation_key text NOT NULL CHECK (char_length(implementation_key) BETWEEN 1 AND 300),
  method_package_ref text NOT NULL CHECK (method_package_ref LIKE 'brain-method-package:%'),
  method_ref text NOT NULL CHECK (method_ref LIKE 'brain-method:%'),
  method_version_ref text NOT NULL CHECK (method_version_ref LIKE 'brain-method-version:%'),
  evaluation_ref text NOT NULL CHECK (evaluation_ref LIKE 'brain-method-evaluation:%'),
  research_dataset_ref text NOT NULL CHECK (research_dataset_ref LIKE 'research-dataset:%'),
  evidence_fingerprint_sha256 char(64) NOT NULL
    CHECK (evidence_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  input_fingerprint_sha256 char(64) NOT NULL
    CHECK (input_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  output_fingerprint_sha256 char(64) NOT NULL
    CHECK (output_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_identity_fingerprint_sha256 char(64) NOT NULL
    CHECK (source_identity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  admission_fingerprint_sha256 char(64) NOT NULL
    CHECK (admission_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_json jsonb NOT NULL,
  admitted_at timestamptz NOT NULL,
  CHECK (source_id = review_id AND source_version = review_version),
  CHECK (observation_output_fingerprint_sha256 = output_fingerprint_sha256),
  CHECK (
    (outcome = 'CONFIRMED' AND reason IS NULL)
    OR (outcome = 'INCONCLUSIVE' AND reason = 'INCONCLUSIVE_EVIDENCE')
    OR (
      outcome = 'OVERRIDDEN'
      AND reason IN ('METHOD_ERROR', 'INPUT_DATA_ERROR', 'APPLICABILITY_ERROR', 'PRODUCT_USER_PREFERENCE')
    )
  ),
  UNIQUE (workspace_id, source_id, source_version),
  UNIQUE (workspace_id, review_id, review_version),
  UNIQUE (workspace_id, source_identity_fingerprint_sha256)
);

CREATE INDEX IF NOT EXISTS core_method_outcome_evidence_method_version_idx
  ON core_method_outcome_evidence (
    workspace_id,
    method_version_ref,
    admitted_at DESC,
    method_outcome_evidence_id ASC
  );

CREATE OR REPLACE FUNCTION reject_core_method_outcome_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'core_method_outcome_evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS core_method_outcome_evidence_append_only
  ON core_method_outcome_evidence;

CREATE TRIGGER core_method_outcome_evidence_append_only
  BEFORE UPDATE OR DELETE ON core_method_outcome_evidence
  FOR EACH ROW EXECUTE FUNCTION reject_core_method_outcome_evidence_mutation();
