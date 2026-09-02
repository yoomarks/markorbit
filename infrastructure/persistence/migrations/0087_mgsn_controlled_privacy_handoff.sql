-- MGSN Controlled Privacy Handoff V1 persistence foundation.
-- DDL only: no Selection, Provider, work package, customer record, evidence artifact or prior disclosure
-- is backfilled into a Handoff. Historical AUTHORIZED state is not current disclosure permission.
-- Persistence grants no Provider contact/engagement, Allocation/Acceptance/appointment, M13 release,
-- Filing, Payment, artifact retrieval, Official Truth or other protected-action authority.

CREATE TABLE mgsn_controlled_handoff_identities (
  controlled_handoff_id text PRIMARY KEY
    CHECK (controlled_handoff_id ~ '^controlled-handoff_[A-Za-z0-9_-]+$'),
  originating_workspace_id uuid NOT NULL,
  slot_key text NOT NULL
    CHECK (slot_key LIKE 'controlled-handoff:%' AND length(btrim(slot_key)) > 0),
  recipient_provider_id text NOT NULL,
  recipient_provider_workspace_id uuid NOT NULL,
  purpose_context_reference text NOT NULL CHECK (length(btrim(purpose_context_reference)) > 0),
  created_at timestamptz NOT NULL,
  UNIQUE (controlled_handoff_id, originating_workspace_id, slot_key),
  FOREIGN KEY (recipient_provider_id, recipient_provider_workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id)
);

CREATE INDEX mgsn_controlled_handoff_identities_slot_idx
  ON mgsn_controlled_handoff_identities(
    originating_workspace_id,
    slot_key,
    created_at DESC,
    controlled_handoff_id
  );

CREATE TABLE mgsn_controlled_handoff_versions (
  controlled_handoff_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  originating_workspace_id uuid NOT NULL,
  slot_key text NOT NULL
    CHECK (slot_key LIKE 'controlled-handoff:%' AND length(btrim(slot_key)) > 0),

  recipient_provider_id text NOT NULL,
  recipient_provider_workspace_id uuid NOT NULL,
  recipient_role text NOT NULL CHECK (recipient_role = 'FINAL_EXECUTION_PROVIDER'),

  purpose_code text NOT NULL CHECK (
    purpose_code IN (
      'PROFESSIONAL_SERVICE_PREPARATION',
      'PROFESSIONAL_EVIDENCE_REVIEW',
      'JURISDICTIONAL_INSTRUCTION_REVIEW',
      'OTHER_CANONICAL_BOUNDED_PURPOSE'
    )
  ),
  purpose_context_reference text NOT NULL CHECK (length(btrim(purpose_context_reference)) > 0),
  purpose_instruction_reference text NOT NULL CHECK (length(btrim(purpose_instruction_reference)) > 0),
  purpose_fingerprint_sha256 text NOT NULL CHECK (purpose_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  unrestricted_purpose_allowed boolean NOT NULL CHECK (unrestricted_purpose_allowed IS FALSE),

  projection_fingerprint_sha256 text NOT NULL CHECK (projection_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_set_fingerprint_sha256 text NOT NULL CHECK (source_set_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),

  selection_provider_selection_id text NOT NULL,
  selection_version integer NOT NULL CHECK (selection_version > 0),
  selection_scope_version integer NOT NULL CHECK (selection_scope_version > 0),
  selection_scope_owner text NOT NULL CHECK (
    selection_scope_owner IN ('CORE','LITE','MARKREG','OPERATIONS','OTHER_CANONICAL_CONSUMER')
  ),
  selection_scope_reference text NOT NULL CHECK (length(btrim(selection_scope_reference)) > 0),
  selection_scope_reference_version jsonb NOT NULL CHECK (
    (jsonb_typeof(selection_scope_reference_version) = 'number'
      AND selection_scope_reference_version::text ~ '^[1-9][0-9]*$')
    OR (
      jsonb_typeof(selection_scope_reference_version) = 'string'
      AND length(btrim(selection_scope_reference_version #>> '{}')) > 0
    )
  ),
  selection_scope_fingerprint_sha256 text NOT NULL
    CHECK (selection_scope_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  selection_fingerprint_sha256 text NOT NULL CHECK (selection_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  selection_validation_purpose text NOT NULL CHECK (selection_validation_purpose = 'CONTROLLED_HANDOFF_REVIEW'),
  selection_validation_decision text NOT NULL
    CHECK (selection_validation_decision = 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW'),
  selection_currently_usable boolean NOT NULL CHECK (selection_currently_usable IS TRUE),
  selection_evaluated_at timestamptz NOT NULL,
  selection_validation_policy_version text NOT NULL
    CHECK (length(btrim(selection_validation_policy_version)) > 0),

  direct_executor_disclosure_state text NOT NULL
    CHECK (direct_executor_disclosure_state = 'INDEPENDENT_EVIDENCE_REFERENCED'),
  direct_executor_established boolean NOT NULL CHECK (direct_executor_established IS TRUE),
  final_execution_provider_id text NOT NULL,
  final_execution_provider_workspace_id uuid NOT NULL,
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
  direct_executor_evidence_references jsonb NOT NULL
    CHECK (jsonb_typeof(direct_executor_evidence_references) = 'array'),
  direct_executor_checked_at timestamptz NOT NULL,
  hidden_intermediary_allowed boolean NOT NULL CHECK (hidden_intermediary_allowed IS FALSE),
  onward_recipient_authorization text NOT NULL CHECK (onward_recipient_authorization = 'NONE'),

  current_authority_revalidation_required_before_authorize boolean NOT NULL
    CHECK (current_authority_revalidation_required_before_authorize IS TRUE),
  current_authority_revalidation_required_before_consumption boolean NOT NULL
    CHECK (current_authority_revalidation_required_before_consumption IS TRUE),
  evidence_reference_visibility_does_not_grant_artifact_retrieval boolean NOT NULL
    CHECK (evidence_reference_visibility_does_not_grant_artifact_retrieval IS TRUE),

  trusted_authority_source text NOT NULL CHECK (trusted_authority_source = 'CORE_WORKSPACE_PRINCIPAL'),
  authorizing_actor_id text NOT NULL CHECK (length(btrim(authorizing_actor_id)) > 0),
  principal_reference text NOT NULL CHECK (length(btrim(principal_reference)) > 0),
  workspace_membership_reference text NOT NULL CHECK (length(btrim(workspace_membership_reference)) > 0),
  handoff_authority_reference text NOT NULL CHECK (length(btrim(handoff_authority_reference)) > 0),
  handoff_authority_version jsonb NOT NULL CHECK (
    (jsonb_typeof(handoff_authority_version) = 'number'
      AND handoff_authority_version::text ~ '^[1-9][0-9]*$')
    OR (
      jsonb_typeof(handoff_authority_version) = 'string'
      AND length(btrim(handoff_authority_version #>> '{}')) > 0
    )
  ),
  authenticated_at timestamptz NOT NULL,
  affirmative_human_action_evidence_reference text NOT NULL
    CHECK (length(btrim(affirmative_human_action_evidence_reference)) > 0),
  payload_identity_authoritative boolean NOT NULL CHECK (payload_identity_authoritative IS FALSE),

  preview_affirmative_human_action boolean NOT NULL CHECK (preview_affirmative_human_action IS TRUE),
  preview_acknowledgement_code text NOT NULL CHECK (preview_acknowledgement_code = 'CONTROLLED_PRIVACY_HANDOFF_V1'),
  preview_acknowledgement_text_version text NOT NULL
    CHECK (length(btrim(preview_acknowledgement_text_version)) > 0),
  preview_fingerprint_sha256 text NOT NULL CHECK (preview_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  preview_reviewed_at timestamptz NOT NULL,

  authorized_at timestamptz NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('AUTHORIZED','REVOKED')),
  revoked_at timestamptz,
  revocation_reason_code text CHECK (
    revocation_reason_code IS NULL
    OR revocation_reason_code IN (
      'HUMAN_WITHDRAWAL',
      'PURPOSE_CANCELLED',
      'SCOPE_CANCELLED',
      'OTHER_BOUNDED_REASON'
    )
  ),
  envelope_fingerprint_sha256 text NOT NULL CHECK (envelope_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  envelope_record jsonb NOT NULL CHECK (jsonb_typeof(envelope_record) = 'object'),
  created_at timestamptz NOT NULL,

  PRIMARY KEY (controlled_handoff_id, version),
  UNIQUE (controlled_handoff_id, version, originating_workspace_id, slot_key),
  FOREIGN KEY (controlled_handoff_id, originating_workspace_id, slot_key)
    REFERENCES mgsn_controlled_handoff_identities(
      controlled_handoff_id,
      originating_workspace_id,
      slot_key
    ),
  FOREIGN KEY (recipient_provider_id, recipient_provider_workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id),
  FOREIGN KEY (
    selection_provider_selection_id,
    selection_version,
    originating_workspace_id,
    selection_scope_owner,
    selection_scope_reference,
    selection_scope_version
  ) REFERENCES mgsn_provider_selection_versions(
    provider_selection_id,
    version,
    requester_workspace_id,
    scope_owner,
    scope_reference,
    scope_version
  ),

  CHECK (final_execution_provider_id = recipient_provider_id),
  CHECK (final_execution_provider_workspace_id = recipient_provider_workspace_id),
  CHECK (valid_from < valid_until),
  CHECK (
    (status = 'AUTHORIZED' AND revoked_at IS NULL AND revocation_reason_code IS NULL)
    OR
    (status = 'REVOKED' AND revoked_at IS NOT NULL AND revocation_reason_code IS NOT NULL)
  ),

  -- The canonical record is descriptors/references only. It cannot embed field values or widen
  -- the minimum-necessary intersection under the shared V1 contract.
  CHECK (COALESCE(envelope_record #>> '{authorizedProjection,wildcardAllowed}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorizedProjection,wholeRecordAllowed}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorizedProjection,implicitFieldExpansionAllowed}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorizedProjection,fieldValuesEmbeddedInEnvelope}', '') = 'false'),
  CHECK (
    COALESCE(
      envelope_record #>> '{authorizedProjection,requestedAuthorizedMinimumNecessaryIntersectionRequired}',
      ''
    ) = 'true'
  ),
  CHECK (COALESCE(jsonb_typeof(envelope_record #> '{authorizedProjection,items}'), '') = 'array'),
  CHECK (jsonb_array_length(envelope_record #> '{authorizedProjection,items}') > 0),
  CHECK (
    NOT jsonb_path_exists(
      envelope_record,
      '$.authorizedProjection.items[*] ? (@.fieldValueEmbeddedInEnvelope != false || @.requested != true || @.authorizedBySourceOwner != true || @.minimumNecessary != true)'
    )
  ),
  CHECK (
    COALESCE(jsonb_typeof(envelope_record #> '{authorizedProjection,forbiddenGenericDataClasses}'), '') = 'array'
  ),
  CHECK (jsonb_array_length(envelope_record #> '{authorizedProjection,forbiddenGenericDataClasses}') = 5),
  CHECK (
    (envelope_record #> '{authorizedProjection,forbiddenGenericDataClasses}') @>
      '["END_CLIENT_RELATIONSHIP_INFORMATION","ORIGINATING_WORKSPACE_PRICING_MARGIN_PROFIT","PRIVATE_CRM_CONTEXT","UNRELATED_COMMUNICATIONS","UNRELATED_ASSETS_OR_MATTERS"]'::jsonb
  ),
  CHECK (
    COALESCE(
      envelope_record #>> '{sourceLineage,evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval}',
      ''
    ) = 'true'
  ),

  -- Handoff authorization is the only positive consequence. Every downstream authority stays false.
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,controlledPrivacyHandoffAuthorized}', '') = 'true'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,providerEngaged}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,providerAllocated}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,providerAccepted}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,professionalAppointmentCreated}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,externalContactAuthorized}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,protectedActionReleased}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,filingAuthorized}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,filingSubmitted}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,paymentAuthorized}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,paymentCreated}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,officialTruthCreated}', '') = 'false'),
  CHECK (COALESCE(envelope_record #>> '{authorityConsequences,matterCompleted}', '') = 'false')
);

CREATE INDEX mgsn_controlled_handoff_versions_slot_history_idx
  ON mgsn_controlled_handoff_versions(
    originating_workspace_id,
    slot_key,
    created_at DESC,
    controlled_handoff_id,
    version DESC
  );

CREATE INDEX mgsn_controlled_handoff_versions_selection_idx
  ON mgsn_controlled_handoff_versions(
    selection_provider_selection_id,
    selection_version,
    selection_scope_version,
    created_at DESC
  );

CREATE INDEX mgsn_controlled_handoff_versions_recipient_idx
  ON mgsn_controlled_handoff_versions(
    recipient_provider_workspace_id,
    recipient_provider_id,
    created_at DESC,
    controlled_handoff_id,
    version DESC
  );

CREATE TABLE mgsn_controlled_handoff_slot_state (
  slot_key text PRIMARY KEY
    CHECK (slot_key LIKE 'controlled-handoff:%' AND length(btrim(slot_key)) > 0),
  originating_workspace_id uuid NOT NULL,
  slot_revision integer NOT NULL CHECK (slot_revision > 0),
  head_controlled_handoff_id text NOT NULL,
  head_version integer NOT NULL CHECK (head_version > 0),
  current_controlled_handoff_id text,
  current_version integer CHECK (current_version IS NULL OR current_version > 0),
  set_by_principal_reference text NOT NULL CHECK (length(btrim(set_by_principal_reference)) > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  updated_at timestamptz NOT NULL,
  FOREIGN KEY (
    head_controlled_handoff_id,
    head_version,
    originating_workspace_id,
    slot_key
  ) REFERENCES mgsn_controlled_handoff_versions(
    controlled_handoff_id,
    version,
    originating_workspace_id,
    slot_key
  ) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (
    current_controlled_handoff_id,
    current_version,
    originating_workspace_id,
    slot_key
  ) REFERENCES mgsn_controlled_handoff_versions(
    controlled_handoff_id,
    version,
    originating_workspace_id,
    slot_key
  ) DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    (current_controlled_handoff_id IS NULL AND current_version IS NULL)
    OR
    (current_controlled_handoff_id IS NOT NULL AND current_version IS NOT NULL)
  )
);

CREATE UNIQUE INDEX mgsn_controlled_handoff_slot_state_current_idx
  ON mgsn_controlled_handoff_slot_state(current_controlled_handoff_id)
  WHERE current_controlled_handoff_id IS NOT NULL;

CREATE INDEX mgsn_controlled_handoff_slot_state_workspace_idx
  ON mgsn_controlled_handoff_slot_state(originating_workspace_id, updated_at DESC, slot_key);

CREATE OR REPLACE FUNCTION validate_mgsn_controlled_handoff_slot_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  head_status text;
  current_status text;
BEGIN
  SELECT status INTO head_status
    FROM mgsn_controlled_handoff_versions
   WHERE controlled_handoff_id = NEW.head_controlled_handoff_id
     AND version = NEW.head_version
     AND originating_workspace_id = NEW.originating_workspace_id
     AND slot_key = NEW.slot_key;

  IF head_status IS NULL THEN
    RAISE EXCEPTION 'Controlled Handoff slot head must reference exact persisted history'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.current_controlled_handoff_id IS NULL THEN
    IF head_status <> 'REVOKED' THEN
      RAISE EXCEPTION 'Controlled Handoff slot without current authority must have a REVOKED head'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.current_controlled_handoff_id <> NEW.head_controlled_handoff_id
       OR NEW.current_version <> NEW.head_version THEN
      RAISE EXCEPTION 'Controlled Handoff current pointer must equal the exact slot head'
        USING ERRCODE = '23514';
    END IF;

    SELECT status INTO current_status
      FROM mgsn_controlled_handoff_versions
     WHERE controlled_handoff_id = NEW.current_controlled_handoff_id
       AND version = NEW.current_version
       AND originating_workspace_id = NEW.originating_workspace_id
       AND slot_key = NEW.slot_key;

    IF current_status <> 'AUTHORIZED' THEN
      RAISE EXCEPTION 'Controlled Handoff current pointer may reference only AUTHORIZED history'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_controlled_handoff_slot_state_consistency
BEFORE INSERT OR UPDATE ON mgsn_controlled_handoff_slot_state
FOR EACH ROW EXECUTE FUNCTION validate_mgsn_controlled_handoff_slot_state();

CREATE TABLE mgsn_controlled_handoff_command_replays (
  slot_key text NOT NULL CHECK (slot_key LIKE 'controlled-handoff:%'),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  command_fingerprint_sha256 text NOT NULL CHECK (command_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  mutation text NOT NULL CHECK (mutation IN ('AUTHORIZED','REPLACED','REVOKED')),
  originating_workspace_id uuid NOT NULL,
  authorizing_actor_id text NOT NULL CHECK (length(btrim(authorizing_actor_id)) > 0),
  principal_reference text NOT NULL CHECK (length(btrim(principal_reference)) > 0),
  workspace_membership_reference text NOT NULL CHECK (length(btrim(workspace_membership_reference)) > 0),
  handoff_authority_reference text NOT NULL CHECK (length(btrim(handoff_authority_reference)) > 0),
  handoff_authority_version jsonb NOT NULL CHECK (
    (jsonb_typeof(handoff_authority_version) = 'number'
      AND handoff_authority_version::text ~ '^[1-9][0-9]*$')
    OR (
      jsonb_typeof(handoff_authority_version) = 'string'
      AND length(btrim(handoff_authority_version #>> '{}')) > 0
    )
  ),
  affirmative_human_action_evidence_reference text NOT NULL
    CHECK (length(btrim(affirmative_human_action_evidence_reference)) > 0),
  response_controlled_handoff_id text NOT NULL,
  response_version integer NOT NULL CHECK (response_version > 0),
  response_envelope_fingerprint_sha256 text NOT NULL
    CHECK (response_envelope_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  response_result jsonb NOT NULL CHECK (jsonb_typeof(response_result) = 'object'),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (slot_key, idempotency_key),
  FOREIGN KEY (
    response_controlled_handoff_id,
    response_version,
    originating_workspace_id,
    slot_key
  ) REFERENCES mgsn_controlled_handoff_versions(
    controlled_handoff_id,
    version,
    originating_workspace_id,
    slot_key
  )
);

CREATE INDEX mgsn_controlled_handoff_command_replays_response_idx
  ON mgsn_controlled_handoff_command_replays(
    originating_workspace_id,
    response_controlled_handoff_id,
    response_version,
    created_at DESC
  );

CREATE TABLE mgsn_controlled_handoff_owner_audit_events (
  audit_id bigserial PRIMARY KEY,
  controlled_handoff_id text NOT NULL,
  originating_workspace_id uuid NOT NULL,
  slot_key text NOT NULL CHECK (slot_key LIKE 'controlled-handoff:%'),
  previous_version integer CHECK (previous_version IS NULL OR previous_version > 0),
  new_version integer NOT NULL CHECK (new_version > 0),
  action text NOT NULL CHECK (action IN ('AUTHORIZED','REPLACED','REVOKED')),
  authorizing_actor_id text NOT NULL CHECK (length(btrim(authorizing_actor_id)) > 0),
  principal_reference text NOT NULL CHECK (length(btrim(principal_reference)) > 0),
  command_fingerprint_sha256 text NOT NULL CHECK (command_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  occurred_at timestamptz NOT NULL,
  FOREIGN KEY (
    controlled_handoff_id,
    new_version,
    originating_workspace_id,
    slot_key
  ) REFERENCES mgsn_controlled_handoff_versions(
    controlled_handoff_id,
    version,
    originating_workspace_id,
    slot_key
  ),
  FOREIGN KEY (controlled_handoff_id, previous_version)
    REFERENCES mgsn_controlled_handoff_versions(controlled_handoff_id, version),
  CHECK (
    (action = 'AUTHORIZED' AND previous_version IS NULL AND new_version = 1)
    OR
    (action IN ('REPLACED','REVOKED')
      AND previous_version IS NOT NULL
      AND new_version = previous_version + 1)
  )
);

CREATE INDEX mgsn_controlled_handoff_owner_audit_history_idx
  ON mgsn_controlled_handoff_owner_audit_events(
    controlled_handoff_id,
    occurred_at ASC,
    audit_id ASC
  );

CREATE INDEX mgsn_controlled_handoff_owner_audit_slot_idx
  ON mgsn_controlled_handoff_owner_audit_events(
    originating_workspace_id,
    slot_key,
    occurred_at DESC,
    audit_id DESC
  );

CREATE OR REPLACE FUNCTION reject_mgsn_controlled_handoff_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_controlled_handoff_identities_append_only
BEFORE UPDATE OR DELETE ON mgsn_controlled_handoff_identities
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_controlled_handoff_append_only_mutation();

CREATE TRIGGER mgsn_controlled_handoff_versions_append_only
BEFORE UPDATE OR DELETE ON mgsn_controlled_handoff_versions
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_controlled_handoff_append_only_mutation();

CREATE TRIGGER mgsn_controlled_handoff_command_replays_append_only
BEFORE UPDATE OR DELETE ON mgsn_controlled_handoff_command_replays
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_controlled_handoff_append_only_mutation();

CREATE TRIGGER mgsn_controlled_handoff_owner_audit_append_only
BEFORE UPDATE OR DELETE ON mgsn_controlled_handoff_owner_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_controlled_handoff_append_only_mutation();
