-- Controlled Privacy Handoff V1 persistence integrity hardening.
-- This migration adds only fail-closed append/CAS guards over 0087. It creates no Handoff rows,
-- does not change privacy projection semantics, and grants no current disclosure or downstream authority.

CREATE OR REPLACE FUNCTION validate_mgsn_controlled_handoff_version_append()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  identity_record mgsn_controlled_handoff_identities%ROWTYPE;
  previous_record mgsn_controlled_handoff_versions%ROWTYPE;
BEGIN
  SELECT *
    INTO identity_record
    FROM mgsn_controlled_handoff_identities
   WHERE controlled_handoff_id = NEW.controlled_handoff_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Controlled Handoff version requires an exact immutable identity'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.originating_workspace_id IS DISTINCT FROM identity_record.originating_workspace_id
     OR NEW.slot_key IS DISTINCT FROM identity_record.slot_key
     OR NEW.recipient_provider_id IS DISTINCT FROM identity_record.recipient_provider_id
     OR NEW.recipient_provider_workspace_id IS DISTINCT FROM identity_record.recipient_provider_workspace_id
     OR NEW.purpose_context_reference IS DISTINCT FROM identity_record.purpose_context_reference THEN
    RAISE EXCEPTION 'Controlled Handoff version conflicts with immutable identity binding'
      USING ERRCODE = '55000';
  END IF;

  SELECT *
    INTO previous_record
    FROM mgsn_controlled_handoff_versions
   WHERE controlled_handoff_id = NEW.controlled_handoff_id
   ORDER BY version DESC
   LIMIT 1;

  IF NOT FOUND THEN
    IF NEW.version <> 1 OR NEW.status <> 'AUTHORIZED' THEN
      RAISE EXCEPTION 'new Controlled Handoff identity must begin at AUTHORIZED version 1'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF previous_record.status <> 'AUTHORIZED' THEN
    RAISE EXCEPTION 'REVOKED Controlled Handoff identity is terminal; fresh authorization requires a fresh identity'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.version <> previous_record.version + 1 THEN
    RAISE EXCEPTION 'Controlled Handoff history must advance exactly one version'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.status NOT IN ('AUTHORIZED', 'REVOKED') THEN
    RAISE EXCEPTION 'Controlled Handoff lifecycle append must remain AUTHORIZED or become REVOKED'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.originating_workspace_id IS DISTINCT FROM previous_record.originating_workspace_id
     OR NEW.slot_key IS DISTINCT FROM previous_record.slot_key
     OR NEW.recipient_provider_id IS DISTINCT FROM previous_record.recipient_provider_id
     OR NEW.recipient_provider_workspace_id IS DISTINCT FROM previous_record.recipient_provider_workspace_id
     OR NEW.recipient_role IS DISTINCT FROM previous_record.recipient_role
     OR NEW.purpose_context_reference IS DISTINCT FROM previous_record.purpose_context_reference THEN
    RAISE EXCEPTION 'Controlled Handoff identity, slot, recipient and purpose-context binding are immutable'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_controlled_handoff_versions_validate_append
BEFORE INSERT ON mgsn_controlled_handoff_versions
FOR EACH ROW EXECUTE FUNCTION validate_mgsn_controlled_handoff_version_append();

CREATE OR REPLACE FUNCTION guard_mgsn_controlled_handoff_slot_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Controlled Handoff slot state cannot be deleted; revoke by advancing exact history'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.slot_revision <> 1 THEN
      RAISE EXCEPTION 'first Controlled Handoff slot revision must be 1'
        USING ERRCODE = '55000';
    END IF;
  ELSE
    IF NEW.slot_key IS DISTINCT FROM OLD.slot_key
       OR NEW.originating_workspace_id IS DISTINCT FROM OLD.originating_workspace_id THEN
      RAISE EXCEPTION 'Controlled Handoff slot identity binding is immutable'
        USING ERRCODE = '55000';
    END IF;

    IF NEW.slot_revision <> OLD.slot_revision + 1 THEN
      RAISE EXCEPTION 'Controlled Handoff slot CAS must advance exactly one revision'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_controlled_handoff_slot_revision_guard
BEFORE INSERT OR UPDATE OR DELETE ON mgsn_controlled_handoff_slot_state
FOR EACH ROW EXECUTE FUNCTION guard_mgsn_controlled_handoff_slot_revision();
