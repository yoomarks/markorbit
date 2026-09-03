-- Close cross-record substitution paths for Allocation admission lineage replay/audit.
-- Additive integrity only: no Allocation, Selection, Handoff or lineage row is created/backfilled.

ALTER TABLE mgsn_allocation_admission_lineages
  ADD CONSTRAINT mgsn_allocation_admission_lineages_exact_binding_key
  UNIQUE (
    allocation_admission_lineage_id,
    version,
    allocation_id,
    allocation_version,
    lineage_fingerprint_sha256
  );

ALTER TABLE mgsn_allocation_admission_lineage_replays
  ADD CONSTRAINT mgsn_allocation_admission_lineage_replays_exact_binding_fk
  FOREIGN KEY (
    allocation_admission_lineage_id,
    lineage_version,
    allocation_id,
    allocation_version,
    lineage_fingerprint_sha256
  ) REFERENCES mgsn_allocation_admission_lineages(
    allocation_admission_lineage_id,
    version,
    allocation_id,
    allocation_version,
    lineage_fingerprint_sha256
  );

CREATE OR REPLACE FUNCTION validate_mgsn_allocation_admission_lineage_audit_binding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  lineage_record mgsn_allocation_admission_lineages%ROWTYPE;
BEGIN
  SELECT * INTO lineage_record
    FROM mgsn_allocation_admission_lineages
   WHERE allocation_admission_lineage_id = NEW.allocation_admission_lineage_id
     AND version = NEW.lineage_version;

  IF NOT FOUND
     OR lineage_record.originating_workspace_id IS DISTINCT FROM NEW.originating_workspace_id
     OR lineage_record.allocation_id IS DISTINCT FROM NEW.allocation_id
     OR lineage_record.allocation_version IS DISTINCT FROM NEW.allocation_version
     OR lineage_record.selection_validation_fingerprint_sha256 IS DISTINCT FROM NEW.selection_validation_fingerprint_sha256
     OR lineage_record.handoff_binding_state IS DISTINCT FROM NEW.handoff_binding_state
     OR lineage_record.handoff_validation_fingerprint_sha256 IS DISTINCT FROM NEW.handoff_validation_fingerprint_sha256
     OR lineage_record.lineage_fingerprint_sha256 IS DISTINCT FROM NEW.lineage_fingerprint_sha256 THEN
    RAISE EXCEPTION 'allocation admission lineage audit does not match its exact lineage binding'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_allocation_admission_lineage_audit_validate_insert
BEFORE INSERT ON mgsn_allocation_admission_lineage_audit
FOR EACH ROW EXECUTE FUNCTION validate_mgsn_allocation_admission_lineage_audit_binding();
