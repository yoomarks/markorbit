CREATE TABLE IF NOT EXISTS core_method_improvement_coverage_gap_triggers (
  trigger_id text PRIMARY KEY
    CHECK (trigger_id ~ '^method-improvement-trigger_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type = 'COVERAGE_GAP'),
  target_kind text NOT NULL
    CHECK (target_kind IN ('EXISTING_METHOD', 'NEW_CAPABILITY_METHOD_DEMAND')),
  predecessor_method_package_ref text NULL
    CHECK (
      predecessor_method_package_ref IS NULL
      OR predecessor_method_package_ref LIKE 'brain-method-package:%'
    ),
  predecessor_method_ref text NULL
    CHECK (
      predecessor_method_ref IS NULL
      OR predecessor_method_ref LIKE 'brain-method:%'
    ),
  predecessor_method_version_ref text NULL
    CHECK (
      predecessor_method_version_ref IS NULL
      OR predecessor_method_version_ref LIKE 'brain-method-version:%'
    ),
  predecessor_evaluation_ref text NULL
    CHECK (
      predecessor_evaluation_ref IS NULL
      OR predecessor_evaluation_ref LIKE 'brain-method-evaluation:%'
    ),
  predecessor_package_fingerprint_sha256 char(64) NULL
    CHECK (
      predecessor_package_fingerprint_sha256 IS NULL
      OR predecessor_package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
    ),
  target_demand_id text NULL
    CHECK (
      target_demand_id IS NULL
      OR target_demand_id ~ '^capability-demand_[0-9a-f]{64}$'
    ),
  target_demand_fingerprint_sha256 char(64) NULL
    CHECK (
      target_demand_fingerprint_sha256 IS NULL
      OR target_demand_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
    ),
  source_evidence_id text NOT NULL
    CHECK (source_evidence_id ~ '^capability-coverage-gap-evidence_[0-9a-f]{64}$'),
  source_evidence_fingerprint_sha256 char(64) NOT NULL
    CHECK (source_evidence_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_audit_fingerprint_sha256 char(64) NOT NULL
    CHECK (source_audit_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_candidate_id text NOT NULL
    CHECK (source_candidate_id ~ '^capability-coverage-gap-candidate_[0-9a-f]{64}$'),
  source_candidate_fingerprint_sha256 char(64) NOT NULL
    CHECK (source_candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_coverage_status text NOT NULL
    CHECK (
      source_coverage_status IN (
        'MISSING_RUNTIME_CAPABILITY',
        'NO_APPROVED_IMPLEMENTATION',
        'AMBIGUOUS_CURRENT_IMPLEMENTATION'
      )
    ),
  source_demand_id text NOT NULL
    CHECK (source_demand_id ~ '^capability-demand_[0-9a-f]{64}$'),
  source_demand_fingerprint_sha256 char(64) NOT NULL
    CHECK (source_demand_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_identity_fingerprint_sha256 char(64) NOT NULL
    CHECK (source_identity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  request_fingerprint_sha256 char(64) NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  replay_key_fingerprint_sha256 char(64) NOT NULL
    CHECK (replay_key_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  trigger_fingerprint_sha256 char(64) NOT NULL
    CHECK (trigger_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
  correlation_id text NOT NULL CHECK (char_length(correlation_id) BETWEEN 1 AND 300),
  created_by_principal_id text NOT NULL
    CHECK (char_length(created_by_principal_id) BETWEEN 1 AND 300),
  trigger_json jsonb NOT NULL,
  admitted_at timestamptz NOT NULL,
  CONSTRAINT core_method_improvement_coverage_gap_target_shape CHECK (
    (
      target_kind = 'EXISTING_METHOD'
      AND predecessor_method_package_ref IS NOT NULL
      AND predecessor_method_ref IS NOT NULL
      AND predecessor_method_version_ref IS NOT NULL
      AND predecessor_evaluation_ref IS NOT NULL
      AND target_demand_id IS NULL
      AND target_demand_fingerprint_sha256 IS NULL
    )
    OR
    (
      target_kind = 'NEW_CAPABILITY_METHOD_DEMAND'
      AND predecessor_method_package_ref IS NULL
      AND predecessor_method_ref IS NULL
      AND predecessor_method_version_ref IS NULL
      AND predecessor_evaluation_ref IS NULL
      AND predecessor_package_fingerprint_sha256 IS NULL
      AND target_demand_id IS NOT NULL
      AND target_demand_fingerprint_sha256 IS NOT NULL
      AND target_demand_id = 'capability-demand_' || target_demand_fingerprint_sha256
    )
  ),
  CONSTRAINT core_method_improvement_coverage_gap_source_evidence_binding CHECK (
    source_evidence_id =
      'capability-coverage-gap-evidence_' || source_evidence_fingerprint_sha256
  ),
  CONSTRAINT core_method_improvement_coverage_gap_source_candidate_binding CHECK (
    source_candidate_id =
      'capability-coverage-gap-candidate_' || source_candidate_fingerprint_sha256
  ),
  CONSTRAINT core_method_improvement_coverage_gap_source_demand_binding CHECK (
    source_demand_id = 'capability-demand_' || source_demand_fingerprint_sha256
  ),
  UNIQUE (trigger_id, workspace_id),
  UNIQUE (replay_key_fingerprint_sha256),
  UNIQUE (workspace_id, idempotency_key),
  UNIQUE (workspace_id, source_identity_fingerprint_sha256)
);

CREATE INDEX IF NOT EXISTS core_method_improvement_coverage_gap_target_idx
  ON core_method_improvement_coverage_gap_triggers (
    workspace_id,
    target_kind,
    admitted_at DESC,
    trigger_id ASC
  );

CREATE INDEX IF NOT EXISTS core_method_improvement_coverage_gap_source_idx
  ON core_method_improvement_coverage_gap_triggers (
    workspace_id,
    source_coverage_status,
    source_evidence_id,
    admitted_at DESC
  );

CREATE TABLE IF NOT EXISTS core_method_improvement_coverage_gap_research_missions (
  research_mission_id text PRIMARY KEY
    CHECK (research_mission_id ~ '^method-improvement-research-mission_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  trigger_id text NOT NULL,
  trigger_fingerprint_sha256 char(64) NOT NULL
    CHECK (trigger_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  mission_fingerprint_sha256 char(64) NOT NULL
    CHECK (mission_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  target_kind text NOT NULL
    CHECK (target_kind IN ('EXISTING_METHOD', 'NEW_CAPABILITY_METHOD_DEMAND')),
  source_evidence_id text NOT NULL
    CHECK (source_evidence_id ~ '^capability-coverage-gap-evidence_[0-9a-f]{64}$'),
  source_evidence_fingerprint_sha256 char(64) NOT NULL
    CHECK (source_evidence_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  created_by_principal_id text NOT NULL
    CHECK (char_length(created_by_principal_id) BETWEEN 1 AND 300),
  mission_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT core_method_improvement_coverage_gap_mission_trigger_fk
    FOREIGN KEY (trigger_id, workspace_id)
    REFERENCES core_method_improvement_coverage_gap_triggers(trigger_id, workspace_id),
  CONSTRAINT core_method_improvement_coverage_gap_mission_source_binding CHECK (
    source_evidence_id =
      'capability-coverage-gap-evidence_' || source_evidence_fingerprint_sha256
  ),
  UNIQUE (workspace_id, trigger_id),
  UNIQUE (workspace_id, mission_fingerprint_sha256)
);

CREATE OR REPLACE FUNCTION reject_core_method_improvement_coverage_gap_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Core Coverage Gap Method Improvement records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS core_method_improvement_coverage_gap_trigger_append_only
  ON core_method_improvement_coverage_gap_triggers;
CREATE TRIGGER core_method_improvement_coverage_gap_trigger_append_only
  BEFORE UPDATE OR DELETE ON core_method_improvement_coverage_gap_triggers
  FOR EACH ROW EXECUTE FUNCTION reject_core_method_improvement_coverage_gap_mutation();

DROP TRIGGER IF EXISTS core_method_improvement_coverage_gap_mission_append_only
  ON core_method_improvement_coverage_gap_research_missions;
CREATE TRIGGER core_method_improvement_coverage_gap_mission_append_only
  BEFORE UPDATE OR DELETE ON core_method_improvement_coverage_gap_research_missions
  FOR EACH ROW EXECUTE FUNCTION reject_core_method_improvement_coverage_gap_mutation();
