-- Durable persistence foundation for the existing governed BrainGap registry.
-- This migration is intentionally storage-only: it creates no BrainGap rows,
-- performs no backfill, and grants no trigger, research, remediation, activation,
-- Product, filing, payment, provider, or Official Truth authority.

CREATE TABLE IF NOT EXISTS brain_gap_audit_admissions (
  audit_admission_id text PRIMARY KEY,
  audit_payload_sha256 text NOT NULL CHECK (audit_payload_sha256 ~ '^[a-f0-9]{64}$'),
  schema_version integer NOT NULL CHECK (schema_version = 1),
  audited_at timestamptz NOT NULL,
  audit_json jsonb NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (audit_admission_id, audit_payload_sha256)
);

CREATE TABLE IF NOT EXISTS brain_gap_occurrences (
  occurrence_sha256 text PRIMARY KEY CHECK (occurrence_sha256 ~ '^[a-f0-9]{64}$'),
  audit_admission_id text NOT NULL
    REFERENCES brain_gap_audit_admissions(audit_admission_id) ON DELETE RESTRICT,
  audit_payload_sha256 text NOT NULL CHECK (audit_payload_sha256 ~ '^[a-f0-9]{64}$'),
  audit_gap_ordinal integer NOT NULL CHECK (audit_gap_ordinal >= 0),
  brain_gap_id text NOT NULL,
  brain_gap_registry_key text NOT NULL,
  identity_fingerprint_sha256 text NOT NULL
    CHECK (identity_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  gap_type text NOT NULL CHECK (gap_type IN (
    'MISSING_EVIDENCE','STALE_EVIDENCE','CONFLICTING_EVIDENCE','INSUFFICIENT_SAMPLE',
    'LOW_CONFIDENCE','MISSING_METHOD','MISSING_PATTERN','LOW_MODEL_QUALITY','NOVEL_CASE',
    'MISSING_JURISDICTION','MISSING_CAPABILITY'
  )),
  severity text NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  business_impact text NOT NULL CHECK (business_impact IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  detection_source text NOT NULL CHECK (detection_source IN ('BUILD_RUN','ASSET_AUDIT','CASE_RUN','EVALUATION')),
  target_module text NOT NULL CHECK (target_module IN ('KNOWLEDGE','DATA_ENGINE','MARKREG','EXPERT','BRAIN_BUILD','CAPABILITY')),
  domain text NOT NULL,
  jurisdiction text,
  concept text NOT NULL,
  reason_code text NOT NULL,
  related_brain_build_run_id text,
  related_brain_asset_version_id text,
  detected_at timestamptz NOT NULL,
  gap_json jsonb NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (audit_admission_id, audit_gap_ordinal),
  FOREIGN KEY (audit_admission_id, audit_payload_sha256)
    REFERENCES brain_gap_audit_admissions(audit_admission_id, audit_payload_sha256)
    ON DELETE RESTRICT,
  CHECK (brain_gap_id = 'brain-gap_' || identity_fingerprint_sha256),
  CHECK (brain_gap_registry_key = 'brain-gap-key_' || identity_fingerprint_sha256)
);

CREATE INDEX IF NOT EXISTS brain_gap_occurrences_registry_history_idx
  ON brain_gap_occurrences(brain_gap_registry_key, detected_at, occurrence_sha256);

CREATE INDEX IF NOT EXISTS brain_gap_occurrences_scope_idx
  ON brain_gap_occurrences(domain, jurisdiction, concept, detected_at);

CREATE INDEX IF NOT EXISTS brain_gap_occurrences_build_run_idx
  ON brain_gap_occurrences(related_brain_build_run_id)
  WHERE related_brain_build_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS brain_gap_dispositions (
  disposition_id text PRIMARY KEY,
  brain_gap_registry_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVING','RESOLVED','DISMISSED')),
  occurred_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  source text NOT NULL CHECK (source IN ('MANUAL','RECURRENCE')),
  disposition_json jsonb NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS brain_gap_dispositions_registry_history_idx
  ON brain_gap_dispositions(brain_gap_registry_key, occurred_at, disposition_id);

-- Historical audit admissions, gap occurrences, and dispositions are evidence.
-- They are append-only; later registry state is reconstructed from history rather
-- than mutating prior evidence.
CREATE OR REPLACE FUNCTION reject_brain_gap_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS brain_gap_audit_admissions_append_only ON brain_gap_audit_admissions;
CREATE TRIGGER brain_gap_audit_admissions_append_only
BEFORE UPDATE OR DELETE ON brain_gap_audit_admissions
FOR EACH ROW EXECUTE FUNCTION reject_brain_gap_history_mutation();

DROP TRIGGER IF EXISTS brain_gap_occurrences_append_only ON brain_gap_occurrences;
CREATE TRIGGER brain_gap_occurrences_append_only
BEFORE UPDATE OR DELETE ON brain_gap_occurrences
FOR EACH ROW EXECUTE FUNCTION reject_brain_gap_history_mutation();

DROP TRIGGER IF EXISTS brain_gap_dispositions_append_only ON brain_gap_dispositions;
CREATE TRIGGER brain_gap_dispositions_append_only
BEFORE UPDATE OR DELETE ON brain_gap_dispositions
FOR EACH ROW EXECUTE FUNCTION reject_brain_gap_history_mutation();
