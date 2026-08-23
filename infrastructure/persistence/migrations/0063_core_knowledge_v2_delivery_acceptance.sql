ALTER TABLE knowledge_v2_deliveries
  ADD COLUMN accepted_at timestamptz,
  ADD COLUMN acceptance_evidence jsonb;

CREATE UNIQUE INDEX knowledge_v2_deliveries_idempotency_key_uidx
  ON knowledge_v2_deliveries(idempotency_key);

ALTER TABLE knowledge_v2_deliveries
  ADD CONSTRAINT knowledge_v2_deliveries_acceptance_evidence_check
  CHECK (
    (status = 'ACCEPTED' AND accepted_at IS NOT NULL AND acceptance_evidence IS NOT NULL)
    OR
    (status <> 'ACCEPTED' AND accepted_at IS NULL AND acceptance_evidence IS NULL)
  );

CREATE FUNCTION protect_knowledge_v2_delivery_immutable_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.delivery_id IS DISTINCT FROM OLD.delivery_id
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.target_workspace_id IS DISTINCT FROM OLD.target_workspace_id
    OR NEW.knowledge_workspace_id IS DISTINCT FROM OLD.knowledge_workspace_id
    OR NEW.ready_package_id IS DISTINCT FROM OLD.ready_package_id
    OR NEW.ready_package_digest IS DISTINCT FROM OLD.ready_package_digest
    OR NEW.content_export_sha256 IS DISTINCT FROM OLD.content_export_sha256
    OR NEW.request_sha256 IS DISTINCT FROM OLD.request_sha256
    OR NEW.request_json IS DISTINCT FROM OLD.request_json
    OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
    OR NEW.received_at IS DISTINCT FROM OLD.received_at
  THEN
    RAISE EXCEPTION 'knowledge_v2_deliveries frozen input is immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status IN ('ACCEPTED', 'REJECTED') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'knowledge_v2_deliveries terminal status is immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
    RAISE EXCEPTION 'knowledge_v2_deliveries accepted_at is immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.acceptance_evidence IS NOT NULL
    AND NEW.acceptance_evidence IS DISTINCT FROM OLD.acceptance_evidence
  THEN
    RAISE EXCEPTION 'knowledge_v2_deliveries acceptance evidence is immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER knowledge_v2_deliveries_immutable_evidence
BEFORE UPDATE ON knowledge_v2_deliveries
FOR EACH ROW
EXECUTE FUNCTION protect_knowledge_v2_delivery_immutable_evidence();
