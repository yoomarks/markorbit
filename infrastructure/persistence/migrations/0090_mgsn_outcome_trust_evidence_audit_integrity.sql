-- Outcome & Trust Evidence V1 semantic owner-audit integrity hardening.
-- Audit rows must point to the exact immutable evidence/projection/explanation record they describe.
-- This adds no serving, scoring, artifact retrieval or downstream authority.

CREATE OR REPLACE FUNCTION validate_mgsn_trust_evidence_owner_audit_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.object_type = 'EVIDENCE_ITEM' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM mgsn_trust_evidence_items i
      WHERE i.trust_evidence_item_id = NEW.target_id
        AND i.version = NEW.target_version
        AND i.trust_evidence_item_fingerprint_sha256 = NEW.target_fingerprint_sha256
        AND i.provider_id = NEW.provider_id
    ) THEN
      RAISE EXCEPTION 'Trust Evidence owner audit must reference the exact persisted evidence item'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.object_type = 'VISIBILITY_PROJECTION' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM mgsn_trust_evidence_visibility_projections p
      WHERE p.trust_evidence_visibility_projection_id = NEW.target_id
        AND p.projection_fingerprint_sha256 = NEW.target_fingerprint_sha256
        AND p.provider_id = NEW.provider_id
    ) THEN
      RAISE EXCEPTION 'Trust Evidence owner audit must reference the exact persisted visibility projection'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.object_type = 'TRUST_EXPLANATION' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM mgsn_trust_explanations e
      WHERE e.trust_explanation_id = NEW.target_id
        AND e.trust_explanation_fingerprint_sha256 = NEW.target_fingerprint_sha256
        AND e.provider_id = NEW.provider_id
    ) THEN
      RAISE EXCEPTION 'Trust Evidence owner audit must reference the exact persisted trust explanation'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported Trust Evidence owner audit object type'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_trust_evidence_owner_audit_target_guard
BEFORE INSERT ON mgsn_trust_evidence_owner_audit_events
FOR EACH ROW EXECUTE FUNCTION validate_mgsn_trust_evidence_owner_audit_target();
