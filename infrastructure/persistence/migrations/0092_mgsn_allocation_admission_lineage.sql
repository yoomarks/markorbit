-- MGSN exact Allocation admission lineage foundation for new explicit-human-choice flows.
-- DDL only: no historical/current Allocation is inferred to have a Human Selection or Controlled
-- Handoff, and no positive backfill is performed. This record is admission/audit lineage only; it
-- grants no Provider Acceptance, contact/engagement, appointment, protected-action release, Filing,
-- Payment, artifact retrieval, Official Truth or completion authority.

CREATE TABLE mgsn_allocation_admission_lineages (
  allocation_admission_lineage_id text PRIMARY KEY
    CHECK (allocation_admission_lineage_id ~ '^allocation-admission-lineage_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version = 1),

  allocation_id text NOT NULL,
  allocation_version integer NOT NULL CHECK (allocation_version > 0),
  originating_workspace_id uuid NOT NULL,

  service_package_id text NOT NULL REFERENCES mgsn_service_packages(service_package_id),
  service_package_version integer NOT NULL CHECK (service_package_version > 0),
  service_package_fingerprint_sha256 text NOT NULL
    CHECK (service_package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),

  provider_id text NOT NULL,
  provider_workspace_id uuid NOT NULL,
  provider_supply_capability_id text NOT NULL,
  provider_supply_capability_version integer NOT NULL CHECK (provider_supply_capability_version > 0),
  provider_supply_capability_fingerprint_sha256 text NOT NULL
    CHECK (provider_supply_capability_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),

  provider_selection_id text NOT NULL,
  selection_version integer NOT NULL CHECK (selection_version > 0),
  selection_scope_version integer NOT NULL CHECK (selection_scope_version > 0),
  selection_scope_fingerprint_sha256 text NOT NULL
    CHECK (selection_scope_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  selection_validation_purpose text NOT NULL
    CHECK (selection_validation_purpose = 'ALLOCATION_PREREQUISITE_REVIEW'),
  selection_validation_decision text NOT NULL
    CHECK (selection_validation_decision = 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW'),
  selection_validation_currently_usable boolean NOT NULL
    CHECK (selection_validation_currently_usable IS TRUE),
  selection_validation_evaluated_at timestamptz NOT NULL,
  selection_validation_policy_version text NOT NULL
    CHECK (length(btrim(selection_validation_policy_version)) > 0),
  selection_validation_checked_authority_references jsonb NOT NULL
    CHECK (jsonb_typeof(selection_validation_checked_authority_references) = 'array'),
  selection_validation_fingerprint_sha256 text NOT NULL
    CHECK (selection_validation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  selection_validation_does_not_authorize_downstream_action boolean NOT NULL
    CHECK (selection_validation_does_not_authorize_downstream_action IS TRUE),

  direct_executor_established boolean NOT NULL CHECK (direct_executor_established IS TRUE),
  direct_executor_provider_id text NOT NULL,
  direct_executor_provider_workspace_id uuid NOT NULL,
  direct_executor_authority_reference text NOT NULL
    CHECK (length(btrim(direct_executor_authority_reference)) > 0),
  direct_executor_authority_version jsonb NOT NULL CHECK (
    (jsonb_typeof(direct_executor_authority_version) = 'number'
      AND direct_executor_authority_version::text ~ '^[1-9][0-9]*$')
    OR (
      jsonb_typeof(direct_executor_authority_version) = 'string'
      AND length(btrim(direct_executor_authority_version #>> '{}')) > 0
    )
  ),
  direct_executor_checked_at timestamptz NOT NULL,
  direct_executor_validation_fingerprint_sha256 text NOT NULL
    CHECK (direct_executor_validation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  current_authority_revalidation_required_before_owner_commit boolean NOT NULL
    CHECK (current_authority_revalidation_required_before_owner_commit IS TRUE),

  handoff_binding_state text NOT NULL CHECK (
    handoff_binding_state IN ('NO_CONTROLLED_HANDOFF_BY_DESIGN','EXACT_CONTROLLED_HANDOFF')
  ),
  controlled_handoff_id text,
  controlled_handoff_version integer CHECK (
    controlled_handoff_version IS NULL OR controlled_handoff_version > 0
  ),
  controlled_handoff_envelope_fingerprint_sha256 text CHECK (
    controlled_handoff_envelope_fingerprint_sha256 IS NULL
    OR controlled_handoff_envelope_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
  ),
  handoff_purpose_fingerprint_sha256 text CHECK (
    handoff_purpose_fingerprint_sha256 IS NULL
    OR handoff_purpose_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
  ),
  handoff_projection_fingerprint_sha256 text CHECK (
    handoff_projection_fingerprint_sha256 IS NULL
    OR handoff_projection_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
  ),
  handoff_source_set_fingerprint_sha256 text CHECK (
    handoff_source_set_fingerprint_sha256 IS NULL
    OR handoff_source_set_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
  ),
  handoff_validation_purpose text CHECK (
    handoff_validation_purpose IS NULL OR handoff_validation_purpose = 'HANDOFF_CONSUMPTION'
  ),
  handoff_validation_decision text CHECK (
    handoff_validation_decision IS NULL
    OR handoff_validation_decision = 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION'
  ),
  handoff_validation_currently_usable boolean,
  handoff_validation_current_exact_disclosure_permitted boolean,
  handoff_validation_evaluated_at timestamptz,
  handoff_validation_policy_version text,
  handoff_validation_checked_authority_references jsonb,
  handoff_validation_fingerprint_sha256 text CHECK (
    handoff_validation_fingerprint_sha256 IS NULL
    OR handoff_validation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
  ),
  handoff_validation_is_not_bearer_capability boolean,
  handoff_validation_does_not_authorize_downstream_action boolean,

  lineage_fingerprint_sha256 text NOT NULL CHECK (lineage_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  created_at timestamptz NOT NULL,

  contains_incoming_field_values boolean NOT NULL CHECK (contains_incoming_field_values IS FALSE),
  contains_bearer_secrets boolean NOT NULL CHECK (contains_bearer_secrets IS FALSE),
  contains_raw_customer_data boolean NOT NULL CHECK (contains_raw_customer_data IS FALSE),
  contains_raw_evidence_artifacts boolean NOT NULL CHECK (contains_raw_evidence_artifacts IS FALSE),
  contains_end_client_relationship_information boolean NOT NULL
    CHECK (contains_end_client_relationship_information IS FALSE),
  contains_pricing_margin_or_profit boolean NOT NULL CHECK (contains_pricing_margin_or_profit IS FALSE),

  provider_acceptance_authorized boolean NOT NULL CHECK (provider_acceptance_authorized IS FALSE),
  provider_contact_authorized boolean NOT NULL CHECK (provider_contact_authorized IS FALSE),
  professional_appointment_created boolean NOT NULL CHECK (professional_appointment_created IS FALSE),
  protected_action_released boolean NOT NULL CHECK (protected_action_released IS FALSE),
  filing_authorized boolean NOT NULL CHECK (filing_authorized IS FALSE),
  filing_submitted boolean NOT NULL CHECK (filing_submitted IS FALSE),
  payment_authorized boolean NOT NULL CHECK (payment_authorized IS FALSE),
  payment_created boolean NOT NULL CHECK (payment_created IS FALSE),
  official_truth_created boolean NOT NULL CHECK (official_truth_created IS FALSE),
  matter_completed boolean NOT NULL CHECK (matter_completed IS FALSE),

  UNIQUE (allocation_admission_lineage_id, version),
  UNIQUE (allocation_id, allocation_version),
  FOREIGN KEY (allocation_id, allocation_version)
    REFERENCES mgsn_allocations(allocation_id, version),
  FOREIGN KEY (provider_id, provider_workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id),
  FOREIGN KEY (provider_supply_capability_id, provider_supply_capability_version)
    REFERENCES mgsn_provider_supply_capabilities(provider_supply_capability_id, version),
  FOREIGN KEY (provider_selection_id, selection_version, selection_scope_version)
    REFERENCES mgsn_provider_selection_versions(provider_selection_id, version, scope_version),
  FOREIGN KEY (controlled_handoff_id, controlled_handoff_version)
    REFERENCES mgsn_controlled_handoff_versions(controlled_handoff_id, version),

  CHECK (direct_executor_provider_id = provider_id),
  CHECK (direct_executor_provider_workspace_id = provider_workspace_id),
  CHECK (
    (handoff_binding_state = 'NO_CONTROLLED_HANDOFF_BY_DESIGN'
      AND controlled_handoff_id IS NULL
      AND controlled_handoff_version IS NULL
      AND controlled_handoff_envelope_fingerprint_sha256 IS NULL
      AND handoff_purpose_fingerprint_sha256 IS NULL
      AND handoff_projection_fingerprint_sha256 IS NULL
      AND handoff_source_set_fingerprint_sha256 IS NULL
      AND handoff_validation_purpose IS NULL
      AND handoff_validation_decision IS NULL
      AND handoff_validation_currently_usable IS NULL
      AND handoff_validation_current_exact_disclosure_permitted IS NULL
      AND handoff_validation_evaluated_at IS NULL
      AND handoff_validation_policy_version IS NULL
      AND handoff_validation_checked_authority_references IS NULL
      AND handoff_validation_fingerprint_sha256 IS NULL
      AND handoff_validation_is_not_bearer_capability IS NULL
      AND handoff_validation_does_not_authorize_downstream_action IS NULL)
    OR
    (handoff_binding_state = 'EXACT_CONTROLLED_HANDOFF'
      AND controlled_handoff_id IS NOT NULL
      AND controlled_handoff_version IS NOT NULL
      AND controlled_handoff_envelope_fingerprint_sha256 IS NOT NULL
      AND handoff_purpose_fingerprint_sha256 IS NOT NULL
      AND handoff_projection_fingerprint_sha256 IS NOT NULL
      AND handoff_source_set_fingerprint_sha256 IS NOT NULL
      AND handoff_validation_purpose = 'HANDOFF_CONSUMPTION'
      AND handoff_validation_decision = 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION'
      AND handoff_validation_currently_usable IS TRUE
      AND handoff_validation_current_exact_disclosure_permitted IS TRUE
      AND handoff_validation_evaluated_at IS NOT NULL
      AND length(btrim(handoff_validation_policy_version)) > 0
      AND jsonb_typeof(handoff_validation_checked_authority_references) = 'array'
      AND handoff_validation_fingerprint_sha256 IS NOT NULL
      AND handoff_validation_is_not_bearer_capability IS TRUE
      AND handoff_validation_does_not_authorize_downstream_action IS TRUE)
  )
);

CREATE INDEX mgsn_allocation_admission_lineages_workspace_created_idx
  ON mgsn_allocation_admission_lineages(originating_workspace_id, created_at DESC, allocation_id);
CREATE INDEX mgsn_allocation_admission_lineages_selection_idx
  ON mgsn_allocation_admission_lineages(
    provider_selection_id, selection_version, selection_scope_version, created_at DESC
  );
CREATE INDEX mgsn_allocation_admission_lineages_handoff_idx
  ON mgsn_allocation_admission_lineages(controlled_handoff_id, controlled_handoff_version)
  WHERE controlled_handoff_id IS NOT NULL;

CREATE OR REPLACE FUNCTION validate_mgsn_allocation_admission_lineage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allocation_record mgsn_allocations%ROWTYPE;
  package_record mgsn_service_packages%ROWTYPE;
  provider_record mgsn_providers%ROWTYPE;
  supply_record mgsn_provider_supply_capabilities%ROWTYPE;
  selection_record mgsn_provider_selection_versions%ROWTYPE;
  handoff_record mgsn_controlled_handoff_versions%ROWTYPE;
BEGIN
  SELECT * INTO allocation_record
    FROM mgsn_allocations
   WHERE allocation_id = NEW.allocation_id AND version = NEW.allocation_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'allocation admission lineage requires the exact M4 Allocation'
      USING ERRCODE = '23503';
  END IF;
  IF allocation_record.workspace_id IS DISTINCT FROM NEW.originating_workspace_id
     OR allocation_record.service_package_id IS DISTINCT FROM NEW.service_package_id
     OR allocation_record.service_package_version IS DISTINCT FROM NEW.service_package_version
     OR allocation_record.service_package_fingerprint_sha256 IS DISTINCT FROM NEW.service_package_fingerprint_sha256
     OR allocation_record.provider_id IS DISTINCT FROM NEW.provider_id
     OR allocation_record.provider_supply_capability_id IS DISTINCT FROM NEW.provider_supply_capability_id
     OR allocation_record.provider_supply_capability_version IS DISTINCT FROM NEW.provider_supply_capability_version
     OR allocation_record.provider_supply_capability_fingerprint_sha256 IS DISTINCT FROM NEW.provider_supply_capability_fingerprint_sha256
     OR allocation_record.is_current IS DISTINCT FROM TRUE
     OR allocation_record.status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'allocation admission lineage does not match the exact current Allocation source set'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO package_record
    FROM mgsn_service_packages WHERE service_package_id = NEW.service_package_id;
  IF NOT FOUND
     OR package_record.workspace_id IS DISTINCT FROM NEW.originating_workspace_id
     OR package_record.version IS DISTINCT FROM NEW.service_package_version
     OR package_record.service_package_fingerprint_sha256 IS DISTINCT FROM NEW.service_package_fingerprint_sha256
     OR package_record.status IS DISTINCT FROM 'ADMITTED' THEN
    RAISE EXCEPTION 'allocation admission lineage Service Package is stale or mismatched'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO provider_record
    FROM mgsn_providers
   WHERE provider_id = NEW.provider_id AND provider_workspace_id = NEW.provider_workspace_id;
  IF NOT FOUND OR provider_record.operational_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'allocation admission lineage Provider is not the exact active Provider'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO supply_record
    FROM mgsn_provider_supply_capabilities
   WHERE provider_supply_capability_id = NEW.provider_supply_capability_id
     AND version = NEW.provider_supply_capability_version;
  IF NOT FOUND
     OR supply_record.provider_id IS DISTINCT FROM NEW.provider_id
     OR supply_record.provider_workspace_id IS DISTINCT FROM NEW.provider_workspace_id
     OR supply_record.source_fingerprint_sha256 IS DISTINCT FROM NEW.provider_supply_capability_fingerprint_sha256
     OR supply_record.status IS DISTINCT FROM 'ACTIVE'
     OR supply_record.is_current IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'allocation admission lineage Supply Capability is stale or mismatched'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO selection_record
    FROM mgsn_provider_selection_versions
   WHERE provider_selection_id = NEW.provider_selection_id
     AND version = NEW.selection_version
     AND scope_version = NEW.selection_scope_version;
  IF NOT FOUND
     OR selection_record.requester_workspace_id IS DISTINCT FROM NEW.originating_workspace_id
     OR selection_record.scope_fingerprint_sha256 IS DISTINCT FROM NEW.selection_scope_fingerprint_sha256
     OR selection_record.provider_id IS DISTINCT FROM NEW.provider_id
     OR selection_record.provider_workspace_id IS DISTINCT FROM NEW.provider_workspace_id
     OR selection_record.provider_supply_capability_id IS DISTINCT FROM NEW.provider_supply_capability_id
     OR selection_record.provider_supply_capability_version IS DISTINCT FROM NEW.provider_supply_capability_version
     OR selection_record.provider_supply_capability_fingerprint_sha256 IS DISTINCT FROM NEW.provider_supply_capability_fingerprint_sha256
     OR selection_record.status IS DISTINCT FROM 'CURRENT' THEN
    RAISE EXCEPTION 'allocation admission lineage Human Selection is stale or mismatched'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.handoff_binding_state = 'EXACT_CONTROLLED_HANDOFF' THEN
    SELECT * INTO handoff_record
      FROM mgsn_controlled_handoff_versions
     WHERE controlled_handoff_id = NEW.controlled_handoff_id
       AND version = NEW.controlled_handoff_version;
    IF NOT FOUND
       OR handoff_record.originating_workspace_id IS DISTINCT FROM NEW.originating_workspace_id
       OR handoff_record.recipient_provider_id IS DISTINCT FROM NEW.provider_id
       OR handoff_record.recipient_provider_workspace_id IS DISTINCT FROM NEW.provider_workspace_id
       OR handoff_record.selection_provider_selection_id IS DISTINCT FROM NEW.provider_selection_id
       OR handoff_record.selection_version IS DISTINCT FROM NEW.selection_version
       OR handoff_record.selection_scope_version IS DISTINCT FROM NEW.selection_scope_version
       OR handoff_record.purpose_fingerprint_sha256 IS DISTINCT FROM NEW.handoff_purpose_fingerprint_sha256
       OR handoff_record.projection_fingerprint_sha256 IS DISTINCT FROM NEW.handoff_projection_fingerprint_sha256
       OR handoff_record.source_set_fingerprint_sha256 IS DISTINCT FROM NEW.handoff_source_set_fingerprint_sha256
       OR handoff_record.envelope_fingerprint_sha256 IS DISTINCT FROM NEW.controlled_handoff_envelope_fingerprint_sha256
       OR handoff_record.status IS DISTINCT FROM 'AUTHORIZED'
       OR handoff_record.revoked_at IS NOT NULL
       OR handoff_record.valid_from > NEW.created_at
       OR handoff_record.valid_until <= NEW.created_at
       OR handoff_record.direct_executor_established IS DISTINCT FROM TRUE
       OR handoff_record.final_execution_provider_id IS DISTINCT FROM NEW.provider_id
       OR handoff_record.final_execution_provider_workspace_id IS DISTINCT FROM NEW.provider_workspace_id THEN
      RAISE EXCEPTION 'allocation admission lineage Controlled Handoff is stale or mismatched'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_allocation_admission_lineages_validate_insert
BEFORE INSERT ON mgsn_allocation_admission_lineages
FOR EACH ROW EXECUTE FUNCTION validate_mgsn_allocation_admission_lineage();

CREATE OR REPLACE FUNCTION reject_mgsn_allocation_admission_lineage_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only and immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_allocation_admission_lineages_immutable
BEFORE UPDATE OR DELETE ON mgsn_allocation_admission_lineages
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_allocation_admission_lineage_mutation();

CREATE TABLE mgsn_allocation_admission_lineage_replays (
  scope_key text NOT NULL CHECK (
    scope_key LIKE 'allocation-admission-lineage:%' AND length(btrim(scope_key)) > 0
  ),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  allocation_id text NOT NULL,
  allocation_version integer NOT NULL CHECK (allocation_version > 0),
  allocation_admission_lineage_id text NOT NULL,
  lineage_version integer NOT NULL CHECK (lineage_version = 1),
  lineage_fingerprint_sha256 text NOT NULL CHECK (lineage_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope_key, idempotency_key),
  UNIQUE (allocation_id, allocation_version),
  UNIQUE (allocation_admission_lineage_id, lineage_version),
  FOREIGN KEY (allocation_id, allocation_version)
    REFERENCES mgsn_allocations(allocation_id, version),
  FOREIGN KEY (allocation_admission_lineage_id, lineage_version)
    REFERENCES mgsn_allocation_admission_lineages(allocation_admission_lineage_id, version)
);

CREATE TRIGGER mgsn_allocation_admission_lineage_replays_immutable
BEFORE UPDATE OR DELETE ON mgsn_allocation_admission_lineage_replays
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_allocation_admission_lineage_mutation();

CREATE TABLE mgsn_allocation_admission_lineage_audit (
  audit_id bigserial PRIMARY KEY,
  originating_workspace_id uuid NOT NULL,
  allocation_id text NOT NULL,
  allocation_version integer NOT NULL CHECK (allocation_version > 0),
  allocation_admission_lineage_id text NOT NULL,
  lineage_version integer NOT NULL CHECK (lineage_version = 1),
  action text NOT NULL CHECK (action = 'GOVERNED_ALLOCATION_LINEAGE_BOUND'),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  selection_validation_fingerprint_sha256 text NOT NULL
    CHECK (selection_validation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  handoff_binding_state text NOT NULL CHECK (
    handoff_binding_state IN ('NO_CONTROLLED_HANDOFF_BY_DESIGN','EXACT_CONTROLLED_HANDOFF')
  ),
  handoff_validation_fingerprint_sha256 text CHECK (
    handoff_validation_fingerprint_sha256 IS NULL
    OR handoff_validation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
  ),
  lineage_fingerprint_sha256 text NOT NULL CHECK (lineage_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  created_at timestamptz NOT NULL,
  FOREIGN KEY (allocation_id, allocation_version)
    REFERENCES mgsn_allocations(allocation_id, version),
  FOREIGN KEY (allocation_admission_lineage_id, lineage_version)
    REFERENCES mgsn_allocation_admission_lineages(allocation_admission_lineage_id, version),
  CHECK (
    (handoff_binding_state = 'NO_CONTROLLED_HANDOFF_BY_DESIGN'
      AND handoff_validation_fingerprint_sha256 IS NULL)
    OR
    (handoff_binding_state = 'EXACT_CONTROLLED_HANDOFF'
      AND handoff_validation_fingerprint_sha256 IS NOT NULL)
  )
);
CREATE INDEX mgsn_allocation_admission_lineage_audit_workspace_created_idx
  ON mgsn_allocation_admission_lineage_audit(
    originating_workspace_id, created_at DESC, audit_id DESC
  );

CREATE TRIGGER mgsn_allocation_admission_lineage_audit_append_only
BEFORE UPDATE OR DELETE ON mgsn_allocation_admission_lineage_audit
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_allocation_admission_lineage_mutation();
