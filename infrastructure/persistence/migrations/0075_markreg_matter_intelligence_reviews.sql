CREATE TABLE markreg_matter_intelligence_reviews (
  matter_intelligence_review_id text PRIMARY KEY
    CHECK (matter_intelligence_review_id ~ '^matter-intelligence-review_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  formal_matter_id text NOT NULL,
  matter_intelligence_observation_id text NOT NULL,
  observation_fingerprint_sha256 char(64) NOT NULL
    CHECK (observation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  review_version integer NOT NULL CHECK (review_version >= 1),
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
  rationale text NULL CHECK (rationale IS NULL OR char_length(rationale) BETWEEN 1 AND 2000),
  reviewed_by_principal_id text NOT NULL CHECK (char_length(reviewed_by_principal_id) BETWEEN 1 AND 300),
  reviewed_at timestamptz NOT NULL,
  supersedes_review_id text NULL,
  supersedes_review_version integer NULL CHECK (supersedes_review_version IS NULL OR supersedes_review_version >= 1),
  review_payload_fingerprint_sha256 char(64) NOT NULL
    CHECK (review_payload_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  review_fingerprint_sha256 char(64) NOT NULL
    CHECK (review_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  product_source_fingerprint_sha256 char(64) NOT NULL
    CHECK (product_source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  correlation_id text NOT NULL CHECK (char_length(correlation_id) BETWEEN 1 AND 300),
  CHECK (
    (outcome = 'CONFIRMED' AND reason IS NULL)
    OR (outcome = 'INCONCLUSIVE' AND reason = 'INCONCLUSIVE_EVIDENCE')
    OR (
      outcome = 'OVERRIDDEN'
      AND reason IN ('METHOD_ERROR', 'INPUT_DATA_ERROR', 'APPLICABILITY_ERROR', 'PRODUCT_USER_PREFERENCE')
    )
  ),
  CHECK (
    (supersedes_review_id IS NULL AND supersedes_review_version IS NULL)
    OR (supersedes_review_id IS NOT NULL AND supersedes_review_version IS NOT NULL)
  ),
  UNIQUE (workspace_id, matter_intelligence_review_id),
  UNIQUE (workspace_id, matter_intelligence_observation_id, review_version),
  FOREIGN KEY (workspace_id, formal_matter_id)
    REFERENCES formal_matters(workspace_id, formal_matter_id),
  FOREIGN KEY (workspace_id, matter_intelligence_observation_id)
    REFERENCES markreg_matter_intelligence_observations(workspace_id, matter_intelligence_observation_id),
  FOREIGN KEY (workspace_id, supersedes_review_id)
    REFERENCES markreg_matter_intelligence_reviews(workspace_id, matter_intelligence_review_id)
);

CREATE INDEX markreg_matter_intelligence_reviews_observation_idx
  ON markreg_matter_intelligence_reviews (
    workspace_id,
    matter_intelligence_observation_id,
    review_version DESC,
    matter_intelligence_review_id ASC
  );

CREATE TABLE markreg_matter_intelligence_review_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
  request_fingerprint_sha256 char(64) NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  matter_intelligence_review_id text NOT NULL,
  result_snapshot jsonb NOT NULL,
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
