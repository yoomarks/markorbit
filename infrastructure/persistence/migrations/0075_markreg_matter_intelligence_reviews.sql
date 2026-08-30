CREATE TABLE markreg_matter_intelligence_reviews (
  matter_intelligence_review_id text PRIMARY KEY
    CHECK (matter_intelligence_review_id ~ '^matter-intelligence-review_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  review_version integer NOT NULL DEFAULT 1 CHECK (review_version = 1),
  formal_matter_id text NOT NULL,
  formal_matter_version integer NOT NULL CHECK (formal_matter_version >= 1),
  matter_intelligence_observation_id text NOT NULL,
  observation_fingerprint_sha256 char(64) NOT NULL
    CHECK (observation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  output_fingerprint_sha256 char(64) NOT NULL
    CHECK (output_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (
    outcome IN ('CONFIRMED_AS_PRESENTED', 'OVERRIDDEN', 'INCONCLUSIVE')
  ),
  reason_code text NOT NULL CHECK (
    reason_code IN (
      'INDEPENDENT_REVIEW_CONFIRMED',
      'METHOD_OUTPUT_INCORRECT',
      'APPLICABILITY_MISMATCH',
      'INPUT_FACT_INCORRECT',
      'SOURCE_DATA_OR_REFERENCE_STALE',
      'PRODUCT_OR_WORKFLOW_PREFERENCE',
      'INSUFFICIENT_EVIDENCE'
    )
  ),
  rationale text CHECK (rationale IS NULL OR char_length(rationale) BETWEEN 1 AND 2000),
  reviewer_principal_id text NOT NULL CHECK (char_length(reviewer_principal_id) BETWEEN 1 AND 300),
  reviewer_membership_id text NOT NULL CHECK (char_length(reviewer_membership_id) BETWEEN 1 AND 300),
  reviewed_at timestamptz NOT NULL,
  review_fingerprint_sha256 char(64) NOT NULL
    CHECK (review_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  UNIQUE (workspace_id, matter_intelligence_review_id),
  UNIQUE (workspace_id, matter_intelligence_observation_id),
  FOREIGN KEY (workspace_id, matter_intelligence_observation_id)
    REFERENCES markreg_matter_intelligence_observations(
      workspace_id,
      matter_intelligence_observation_id
    ),
  CHECK (
    (outcome = 'CONFIRMED_AS_PRESENTED' AND reason_code = 'INDEPENDENT_REVIEW_CONFIRMED') OR
    (outcome = 'INCONCLUSIVE' AND reason_code = 'INSUFFICIENT_EVIDENCE') OR
    (
      outcome = 'OVERRIDDEN' AND reason_code IN (
        'METHOD_OUTPUT_INCORRECT',
        'APPLICABILITY_MISMATCH',
        'INPUT_FACT_INCORRECT',
        'SOURCE_DATA_OR_REFERENCE_STALE',
        'PRODUCT_OR_WORKFLOW_PREFERENCE'
      )
    )
  )
);

CREATE INDEX markreg_matter_intelligence_reviews_matter_idx
  ON markreg_matter_intelligence_reviews (
    workspace_id,
    formal_matter_id,
    reviewed_at DESC,
    matter_intelligence_review_id ASC
  );

CREATE TABLE markreg_matter_intelligence_review_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
  request_fingerprint_sha256 char(64) NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  matter_intelligence_review_id text NOT NULL,
  result_snapshot jsonb NOT NULL CHECK (jsonb_typeof(result_snapshot) = 'object'),
  correlation_id text NOT NULL CHECK (char_length(correlation_id) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, matter_intelligence_review_id)
    REFERENCES markreg_matter_intelligence_reviews(workspace_id, matter_intelligence_review_id)
);

CREATE INDEX markreg_matter_intelligence_review_commands_review_idx
  ON markreg_matter_intelligence_review_commands (
    workspace_id,
    matter_intelligence_review_id,
    created_at DESC
  );

CREATE TRIGGER markreg_matter_intelligence_review_append_only
  BEFORE UPDATE OR DELETE ON markreg_matter_intelligence_reviews
  FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();

CREATE TRIGGER markreg_matter_intelligence_review_command_append_only
  BEFORE UPDATE OR DELETE ON markreg_matter_intelligence_review_commands
  FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();
