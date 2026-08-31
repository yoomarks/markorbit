CREATE TABLE IF NOT EXISTS core_method_improvement_triggers (
  trigger_id text PRIMARY KEY
    CHECK (trigger_id ~ '^method-improvement-trigger_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type = 'PERFORMANCE_GAP'),
  method_package_ref text NOT NULL CHECK (method_package_ref LIKE 'brain-method-package:%'),
  method_ref text NOT NULL CHECK (method_ref LIKE 'brain-method:%'),
  method_version_ref text NOT NULL CHECK (method_version_ref LIKE 'brain-method-version:%'),
  evaluation_ref text NOT NULL CHECK (evaluation_ref LIKE 'brain-method-evaluation:%'),
  package_fingerprint_sha256 char(64) NULL
    CHECK (package_fingerprint_sha256 IS NULL OR package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  report_watermark_sequence bigint NOT NULL CHECK (report_watermark_sequence >= 1),
  report_watermark_evidence_id text NOT NULL
    CHECK (report_watermark_evidence_id ~ '^method-outcome-evidence_[A-Za-z0-9_-]+$'),
  report_fingerprint_sha256 char(64) NOT NULL
    CHECK (report_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_identity_fingerprint_sha256 char(64) NOT NULL
    CHECK (source_identity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  request_fingerprint_sha256 char(64) NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  trigger_fingerprint_sha256 char(64) NOT NULL
    CHECK (trigger_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
  correlation_id text NOT NULL CHECK (char_length(correlation_id) BETWEEN 1 AND 300),
  trigger_json jsonb NOT NULL,
  admitted_at timestamptz NOT NULL,
  UNIQUE (trigger_id, workspace_id),
  UNIQUE (workspace_id, idempotency_key),
  UNIQUE (workspace_id, report_fingerprint_sha256),
  UNIQUE (workspace_id, source_identity_fingerprint_sha256)
);

CREATE INDEX IF NOT EXISTS core_method_improvement_trigger_predecessor_idx
  ON core_method_improvement_triggers (
    workspace_id,
    method_version_ref,
    admitted_at DESC,
    trigger_id ASC
  );

CREATE TABLE IF NOT EXISTS core_method_improvement_research_missions (
  research_mission_id text PRIMARY KEY
    CHECK (research_mission_id ~ '^method-improvement-research-mission_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  trigger_id text NOT NULL,
  trigger_fingerprint_sha256 char(64) NOT NULL
    CHECK (trigger_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  mission_fingerprint_sha256 char(64) NOT NULL
    CHECK (mission_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  mission_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT core_method_improvement_mission_trigger_fk
    FOREIGN KEY (trigger_id, workspace_id)
    REFERENCES core_method_improvement_triggers(trigger_id, workspace_id),
  UNIQUE (workspace_id, trigger_id),
  UNIQUE (workspace_id, mission_fingerprint_sha256)
);

CREATE OR REPLACE FUNCTION reject_core_method_improvement_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Core Method Improvement records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS core_method_improvement_trigger_append_only
  ON core_method_improvement_triggers;
CREATE TRIGGER core_method_improvement_trigger_append_only
  BEFORE UPDATE OR DELETE ON core_method_improvement_triggers
  FOR EACH ROW EXECUTE FUNCTION reject_core_method_improvement_mutation();

DROP TRIGGER IF EXISTS core_method_improvement_mission_append_only
  ON core_method_improvement_research_missions;
CREATE TRIGGER core_method_improvement_mission_append_only
  BEFORE UPDATE OR DELETE ON core_method_improvement_research_missions
  FOR EACH ROW EXECUTE FUNCTION reject_core_method_improvement_mutation();
