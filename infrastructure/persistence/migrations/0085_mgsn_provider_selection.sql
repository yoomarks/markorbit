-- MGSN Human Provider Selection V1 persistence foundation.
-- Intentionally DDL-only: no Provider, Discovery, Allocation, Acceptance or prior work is backfilled
-- into a Human Provider Selection. No persisted lifecycle status grants current usability or any
-- downstream allocation, engagement, contact, filing, payment, protected-action or Official Truth
-- authority; current authority must be revalidated by the MGSN owner runtime before bounded use.

CREATE TABLE mgsn_provider_selection_identities (
  provider_selection_id text PRIMARY KEY
    CHECK (provider_selection_id ~ '^provider-selection_[A-Za-z0-9_-]+$'),
  requester_workspace_id uuid NOT NULL,
  scope_owner text NOT NULL CHECK (
    scope_owner IN ('CORE','LITE','MARKREG','OPERATIONS','OTHER_CANONICAL_CONSUMER')
  ),
  scope_reference text NOT NULL CHECK (length(btrim(scope_reference)) > 0),
  created_at timestamptz NOT NULL,
  UNIQUE (
    provider_selection_id,
    requester_workspace_id,
    scope_owner,
    scope_reference
  )
);
CREATE INDEX mgsn_provider_selection_identities_scope_idx
  ON mgsn_provider_selection_identities(
    requester_workspace_id,
    scope_owner,
    scope_reference,
    created_at DESC
  );

CREATE TABLE mgsn_provider_selection_versions (
  provider_selection_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  requester_workspace_id uuid NOT NULL,
  scope_owner text NOT NULL CHECK (
    scope_owner IN ('CORE','LITE','MARKREG','OPERATIONS','OTHER_CANONICAL_CONSUMER')
  ),
  scope_reference text NOT NULL CHECK (length(btrim(scope_reference)) > 0),
  scope_reference_version jsonb NOT NULL CHECK (
    (jsonb_typeof(scope_reference_version) = 'number' AND scope_reference_version::text ~ '^[1-9][0-9]*$')
    OR (
      jsonb_typeof(scope_reference_version) = 'string'
      AND length(btrim(scope_reference_version #>> '{}')) > 0
    )
  ),
  scope_fingerprint_sha256 text NOT NULL CHECK (scope_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  scope_version integer NOT NULL CHECK (scope_version > 0),
  status text NOT NULL CHECK (status IN ('CURRENT','SUPERSEDED','REVOKED')),

  discovery_request_id text NOT NULL
    CHECK (discovery_request_id ~ '^provider-discovery-request_[A-Za-z0-9_-]+$'),
  discovery_request_fingerprint_sha256 text NOT NULL
    CHECK (discovery_request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  discovery_need_reference text NOT NULL CHECK (length(btrim(discovery_need_reference)) > 0),
  discovery_need_version jsonb NOT NULL CHECK (
    (jsonb_typeof(discovery_need_version) = 'number' AND discovery_need_version::text ~ '^[1-9][0-9]*$')
    OR (
      jsonb_typeof(discovery_need_version) = 'string'
      AND length(btrim(discovery_need_version #>> '{}')) > 0
    )
  ),
  discovery_need_fingerprint_sha256 text NOT NULL
    CHECK (discovery_need_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  discovery_purpose text NOT NULL CHECK (discovery_purpose = 'PROVIDER_DISCOVERY'),
  discovery_context_reference text NOT NULL CHECK (length(btrim(discovery_context_reference)) > 0),
  discovery_result_fingerprint_sha256 text NOT NULL
    CHECK (discovery_result_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  discovery_result_evaluated_at timestamptz NOT NULL,
  discovery_candidate_id text NOT NULL
    CHECK (discovery_candidate_id ~ '^provider-discovery-candidate_[A-Za-z0-9_-]+$'),
  discovery_candidate_fingerprint_sha256 text NOT NULL
    CHECK (discovery_candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  discovery_candidate_generated_at timestamptz NOT NULL,
  discovery_evaluation_policy_version text NOT NULL
    CHECK (length(btrim(discovery_evaluation_policy_version)) > 0),

  provider_id text NOT NULL,
  provider_workspace_id uuid NOT NULL,
  provider_supply_capability_id text NOT NULL,
  provider_supply_capability_version integer NOT NULL CHECK (provider_supply_capability_version > 0),
  provider_supply_capability_fingerprint_sha256 text NOT NULL
    CHECK (provider_supply_capability_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),

  visibility_network_participation_id text NOT NULL,
  visibility_participation_version integer NOT NULL CHECK (visibility_participation_version > 0),
  visibility_policy_version integer NOT NULL CHECK (visibility_policy_version > 0),
  visibility_evaluated_at timestamptz NOT NULL,
  visibility_current_authority_revalidation_required_before_serve boolean NOT NULL
    CHECK (visibility_current_authority_revalidation_required_before_serve IS TRUE),
  historical_source_versions jsonb NOT NULL CHECK (jsonb_typeof(historical_source_versions) = 'array'),
  direct_executor_disclosure_state text NOT NULL CHECK (
    direct_executor_disclosure_state IN ('UNKNOWN','UNPROVEN','INDEPENDENT_EVIDENCE_REFERENCED')
  ),
  direct_executor_evidence_references jsonb NOT NULL
    CHECK (jsonb_typeof(direct_executor_evidence_references) = 'array'),
  current_authority_revalidation_required_before_selection_commit boolean NOT NULL
    CHECK (current_authority_revalidation_required_before_selection_commit IS TRUE),
  current_authority_revalidation_required_before_downstream_use boolean NOT NULL
    CHECK (current_authority_revalidation_required_before_downstream_use IS TRUE),

  trusted_authority_source text NOT NULL CHECK (trusted_authority_source = 'CORE_WORKSPACE_PRINCIPAL'),
  selecting_actor_id text NOT NULL CHECK (length(btrim(selecting_actor_id)) > 0),
  principal_reference text NOT NULL CHECK (length(btrim(principal_reference)) > 0),
  workspace_membership_reference text NOT NULL CHECK (length(btrim(workspace_membership_reference)) > 0),
  selection_authority_reference text NOT NULL CHECK (length(btrim(selection_authority_reference)) > 0),
  selection_authority_version jsonb NOT NULL CHECK (
    (jsonb_typeof(selection_authority_version) = 'number' AND selection_authority_version::text ~ '^[1-9][0-9]*$')
    OR (
      jsonb_typeof(selection_authority_version) = 'string'
      AND length(btrim(selection_authority_version #>> '{}')) > 0
    )
  ),
  authenticated_at timestamptz NOT NULL,
  affirmative_human_action_evidence_reference text NOT NULL
    CHECK (length(btrim(affirmative_human_action_evidence_reference)) > 0),
  payload_identity_authoritative boolean NOT NULL CHECK (payload_identity_authoritative IS FALSE),

  acknowledgement_affirmative_human_action boolean NOT NULL
    CHECK (acknowledgement_affirmative_human_action IS TRUE),
  acknowledgement_code text NOT NULL CHECK (acknowledgement_code = 'HUMAN_PROVIDER_SELECTION_V1'),
  acknowledgement_text_version text NOT NULL CHECK (length(btrim(acknowledgement_text_version)) > 0),
  acknowledgement_reviewed_candidate_id text NOT NULL,
  acknowledgement_reviewed_candidate_fingerprint_sha256 text NOT NULL
    CHECK (acknowledgement_reviewed_candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  acknowledgement_reviewed_scope_fingerprint_sha256 text NOT NULL
    CHECK (acknowledgement_reviewed_scope_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  acknowledgement_reviewed_at timestamptz NOT NULL,
  acknowledgement_reason_code text NOT NULL CHECK (
    acknowledgement_reason_code IN (
      'FIT_FOR_REVIEWED_NEED',
      'JURISDICTION_AND_SERVICE_MATCH',
      'EVIDENCE_AND_LIMITATIONS_REVIEWED',
      'OTHER_BOUNDED_REASON'
    )
  ),
  acknowledgement_rationale text CHECK (
    acknowledgement_rationale IS NULL
    OR (
      length(btrim(acknowledgement_rationale)) > 0
      AND char_length(btrim(acknowledgement_rationale)) <= 500
    )
  ),
  acknowledgement_contains_customer_documents boolean NOT NULL
    CHECK (acknowledgement_contains_customer_documents IS FALSE),
  acknowledgement_contains_raw_evidence_artifacts boolean NOT NULL
    CHECK (acknowledgement_contains_raw_evidence_artifacts IS FALSE),
  acknowledgement_contains_end_client_relationship_information boolean NOT NULL
    CHECK (acknowledgement_contains_end_client_relationship_information IS FALSE),
  acknowledgement_contains_applicant_owner_official_data boolean NOT NULL
    CHECK (acknowledgement_contains_applicant_owner_official_data IS FALSE),
  acknowledgement_contains_commercial_margin_or_profit boolean NOT NULL
    CHECK (acknowledgement_contains_commercial_margin_or_profit IS FALSE),

  selected_at timestamptz NOT NULL,
  superseded_by_provider_selection_id text,
  superseded_by_version integer CHECK (superseded_by_version IS NULL OR superseded_by_version > 0),
  superseded_by_scope_version integer CHECK (
    superseded_by_scope_version IS NULL OR superseded_by_scope_version > 0
  ),
  revoked_at timestamptz,
  revocation_reason_code text CHECK (
    revocation_reason_code IS NULL
    OR revocation_reason_code IN ('HUMAN_WITHDRAWAL','SCOPE_CANCELLED','OTHER_BOUNDED_REASON')
  ),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  selection_record jsonb NOT NULL CHECK (jsonb_typeof(selection_record) = 'object'),
  created_at timestamptz NOT NULL,

  PRIMARY KEY (provider_selection_id, version),
  UNIQUE (provider_selection_id, version, scope_version),
  UNIQUE (
    provider_selection_id,
    version,
    requester_workspace_id,
    scope_owner,
    scope_reference,
    scope_version
  ),
  FOREIGN KEY (
    provider_selection_id,
    requester_workspace_id,
    scope_owner,
    scope_reference
  ) REFERENCES mgsn_provider_selection_identities(
    provider_selection_id,
    requester_workspace_id,
    scope_owner,
    scope_reference
  ),
  FOREIGN KEY (provider_id, provider_workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id),
  FOREIGN KEY (provider_supply_capability_id, provider_supply_capability_version)
    REFERENCES mgsn_provider_supply_capabilities(provider_supply_capability_id, version),
  FOREIGN KEY (visibility_network_participation_id, visibility_participation_version)
    REFERENCES mgsn_network_participations(network_participation_id, version),
  FOREIGN KEY (visibility_network_participation_id, visibility_policy_version)
    REFERENCES mgsn_network_visibility_policies(network_participation_id, version),
  FOREIGN KEY (
    superseded_by_provider_selection_id,
    superseded_by_version,
    superseded_by_scope_version
  ) REFERENCES mgsn_provider_selection_versions(
    provider_selection_id,
    version,
    scope_version
  ) DEFERRABLE INITIALLY DEFERRED,

  CHECK (discovery_need_reference = scope_reference),
  CHECK (discovery_need_version = scope_reference_version),
  CHECK (discovery_need_fingerprint_sha256 = scope_fingerprint_sha256),
  CHECK (acknowledgement_reviewed_candidate_id = discovery_candidate_id),
  CHECK (
    acknowledgement_reviewed_candidate_fingerprint_sha256 = discovery_candidate_fingerprint_sha256
  ),
  CHECK (acknowledgement_reviewed_scope_fingerprint_sha256 = scope_fingerprint_sha256),
  CHECK (
    (status = 'CURRENT'
      AND superseded_by_provider_selection_id IS NULL
      AND superseded_by_version IS NULL
      AND superseded_by_scope_version IS NULL
      AND revoked_at IS NULL
      AND revocation_reason_code IS NULL)
    OR
    (status = 'SUPERSEDED'
      AND superseded_by_provider_selection_id IS NOT NULL
      AND superseded_by_version IS NOT NULL
      AND superseded_by_scope_version = scope_version
      AND revoked_at IS NULL
      AND revocation_reason_code IS NULL)
    OR
    (status = 'REVOKED'
      AND superseded_by_provider_selection_id IS NULL
      AND superseded_by_version IS NULL
      AND superseded_by_scope_version IS NULL
      AND revoked_at IS NOT NULL
      AND revocation_reason_code IS NOT NULL)
  )
);
CREATE INDEX mgsn_provider_selection_versions_scope_history_idx
  ON mgsn_provider_selection_versions(
    requester_workspace_id,
    scope_owner,
    scope_reference,
    scope_version DESC,
    created_at DESC
  );
CREATE INDEX mgsn_provider_selection_versions_provider_history_idx
  ON mgsn_provider_selection_versions(
    provider_workspace_id,
    provider_id,
    created_at DESC,
    provider_selection_id,
    version DESC
  );
CREATE INDEX mgsn_provider_selection_versions_discovery_candidate_idx
  ON mgsn_provider_selection_versions(
    discovery_candidate_id,
    discovery_candidate_fingerprint_sha256
  );

CREATE TABLE mgsn_provider_selection_scope_state (
  scope_key text PRIMARY KEY
    CHECK (scope_key LIKE 'provider-selection:%' AND length(btrim(scope_key)) > 0),
  requester_workspace_id uuid NOT NULL,
  scope_owner text NOT NULL CHECK (
    scope_owner IN ('CORE','LITE','MARKREG','OPERATIONS','OTHER_CANONICAL_CONSUMER')
  ),
  scope_reference text NOT NULL CHECK (length(btrim(scope_reference)) > 0),
  scope_version integer NOT NULL CHECK (scope_version > 0),
  head_provider_selection_id text NOT NULL,
  head_selection_version integer NOT NULL CHECK (head_selection_version > 0),
  head_selection_scope_version integer NOT NULL CHECK (head_selection_scope_version > 0),
  current_provider_selection_id text,
  current_selection_version integer CHECK (current_selection_version IS NULL OR current_selection_version > 0),
  current_selection_scope_version integer CHECK (
    current_selection_scope_version IS NULL OR current_selection_scope_version > 0
  ),
  set_by text NOT NULL CHECK (length(btrim(set_by)) > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  updated_at timestamptz NOT NULL,
  UNIQUE (requester_workspace_id, scope_owner, scope_reference),
  FOREIGN KEY (
    head_provider_selection_id,
    head_selection_version,
    requester_workspace_id,
    scope_owner,
    scope_reference,
    head_selection_scope_version
  ) REFERENCES mgsn_provider_selection_versions(
    provider_selection_id,
    version,
    requester_workspace_id,
    scope_owner,
    scope_reference,
    scope_version
  ) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (
    current_provider_selection_id,
    current_selection_version,
    requester_workspace_id,
    scope_owner,
    scope_reference,
    current_selection_scope_version
  ) REFERENCES mgsn_provider_selection_versions(
    provider_selection_id,
    version,
    requester_workspace_id,
    scope_owner,
    scope_reference,
    scope_version
  ) DEFERRABLE INITIALLY DEFERRED,
  CHECK (head_selection_scope_version = scope_version),
  CHECK (
    (
      current_provider_selection_id IS NULL
      AND current_selection_version IS NULL
      AND current_selection_scope_version IS NULL
    )
    OR (
      current_provider_selection_id IS NOT NULL
      AND current_selection_version IS NOT NULL
      AND current_selection_scope_version = scope_version
    )
  )
);
CREATE UNIQUE INDEX mgsn_provider_selection_scope_state_current_selection_idx
  ON mgsn_provider_selection_scope_state(current_provider_selection_id)
  WHERE current_provider_selection_id IS NOT NULL;
CREATE INDEX mgsn_provider_selection_scope_state_workspace_idx
  ON mgsn_provider_selection_scope_state(
    requester_workspace_id,
    scope_owner,
    scope_reference,
    scope_version DESC
  );

CREATE TABLE mgsn_provider_selection_command_replays (
  scope_key text NOT NULL CHECK (scope_key LIKE 'provider-selection:%'),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  effective_command_fingerprint_sha256 text NOT NULL
    CHECK (effective_command_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  mutation text NOT NULL CHECK (mutation IN ('CREATED','REPLACED','REVOKED')),
  requester_workspace_id uuid NOT NULL,
  selecting_actor_id text NOT NULL CHECK (length(btrim(selecting_actor_id)) > 0),
  principal_reference text NOT NULL CHECK (length(btrim(principal_reference)) > 0),
  workspace_membership_reference text NOT NULL CHECK (length(btrim(workspace_membership_reference)) > 0),
  selection_authority_reference text NOT NULL CHECK (length(btrim(selection_authority_reference)) > 0),
  selection_authority_version jsonb NOT NULL CHECK (
    (jsonb_typeof(selection_authority_version) = 'number' AND selection_authority_version::text ~ '^[1-9][0-9]*$')
    OR (
      jsonb_typeof(selection_authority_version) = 'string'
      AND length(btrim(selection_authority_version #>> '{}')) > 0
    )
  ),
  affirmative_human_action_evidence_reference text NOT NULL
    CHECK (length(btrim(affirmative_human_action_evidence_reference)) > 0),
  response_provider_selection_id text NOT NULL,
  response_selection_version integer NOT NULL CHECK (response_selection_version > 0),
  response_scope_version integer NOT NULL CHECK (response_scope_version > 0),
  response_record jsonb NOT NULL CHECK (jsonb_typeof(response_record) = 'object'),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope_key, idempotency_key),
  FOREIGN KEY (
    response_provider_selection_id,
    response_selection_version,
    response_scope_version
  ) REFERENCES mgsn_provider_selection_versions(
    provider_selection_id,
    version,
    scope_version
  )
);
CREATE INDEX mgsn_provider_selection_command_replays_response_idx
  ON mgsn_provider_selection_command_replays(
    requester_workspace_id,
    response_provider_selection_id,
    response_selection_version,
    response_scope_version
  );
CREATE INDEX mgsn_provider_selection_command_replays_created_idx
  ON mgsn_provider_selection_command_replays(created_at DESC);

CREATE TABLE mgsn_provider_selection_owner_audit_events (
  audit_id bigserial PRIMARY KEY,
  scope_key text NOT NULL CHECK (scope_key LIKE 'provider-selection:%'),
  requester_workspace_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('CREATED','REPLACED','REVOKED')),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  principal_reference text NOT NULL CHECK (length(btrim(principal_reference)) > 0),
  workspace_membership_reference text NOT NULL CHECK (length(btrim(workspace_membership_reference)) > 0),
  selection_authority_reference text NOT NULL CHECK (length(btrim(selection_authority_reference)) > 0),
  selection_authority_version jsonb NOT NULL CHECK (
    (jsonb_typeof(selection_authority_version) = 'number' AND selection_authority_version::text ~ '^[1-9][0-9]*$')
    OR (
      jsonb_typeof(selection_authority_version) = 'string'
      AND length(btrim(selection_authority_version #>> '{}')) > 0
    )
  ),
  affirmative_human_action_evidence_reference text NOT NULL
    CHECK (length(btrim(affirmative_human_action_evidence_reference)) > 0),
  command_fingerprint_sha256 text NOT NULL CHECK (command_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  previous_provider_selection_id text,
  previous_selection_version integer CHECK (
    previous_selection_version IS NULL OR previous_selection_version > 0
  ),
  previous_scope_version integer CHECK (previous_scope_version IS NULL OR previous_scope_version > 0),
  provider_selection_id text NOT NULL,
  selection_version integer NOT NULL CHECK (selection_version > 0),
  selection_scope_version integer NOT NULL CHECK (selection_scope_version > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  FOREIGN KEY (
    previous_provider_selection_id,
    previous_selection_version,
    previous_scope_version
  ) REFERENCES mgsn_provider_selection_versions(
    provider_selection_id,
    version,
    scope_version
  ),
  FOREIGN KEY (
    provider_selection_id,
    selection_version,
    selection_scope_version
  ) REFERENCES mgsn_provider_selection_versions(
    provider_selection_id,
    version,
    scope_version
  ),
  CHECK (
    (action = 'CREATED'
      AND previous_provider_selection_id IS NULL
      AND previous_selection_version IS NULL
      AND previous_scope_version IS NULL)
    OR
    (action IN ('REPLACED','REVOKED')
      AND previous_provider_selection_id IS NOT NULL
      AND previous_selection_version IS NOT NULL
      AND previous_scope_version IS NOT NULL)
  )
);
CREATE INDEX mgsn_provider_selection_owner_audit_scope_idx
  ON mgsn_provider_selection_owner_audit_events(scope_key, occurred_at ASC, audit_id ASC);
CREATE INDEX mgsn_provider_selection_owner_audit_workspace_idx
  ON mgsn_provider_selection_owner_audit_events(
    requester_workspace_id,
    occurred_at DESC,
    audit_id DESC
  );

CREATE OR REPLACE FUNCTION reject_mgsn_provider_selection_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_selection_identities is immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_selection_identities_immutable
BEFORE UPDATE OR DELETE ON mgsn_provider_selection_identities
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_selection_identity_mutation();

CREATE OR REPLACE FUNCTION validate_mgsn_provider_selection_version_append()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  previous_record mgsn_provider_selection_versions%ROWTYPE;
BEGIN
  SELECT *
  INTO previous_record
  FROM mgsn_provider_selection_versions
  WHERE provider_selection_id = NEW.provider_selection_id
  ORDER BY version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    IF NEW.version <> 1 OR NEW.status <> 'CURRENT' THEN
      RAISE EXCEPTION 'new Human Provider Selection identity must begin at CURRENT version 1'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF previous_record.status <> 'CURRENT' THEN
    RAISE EXCEPTION 'SUPERSEDED or REVOKED Human Provider Selection identity is terminal'
      USING ERRCODE = '55000';
  END IF;
  IF NEW.version <> previous_record.version + 1
     OR NEW.scope_version <> previous_record.scope_version + 1 THEN
    RAISE EXCEPTION 'Human Provider Selection history must advance exact identity and scope versions'
      USING ERRCODE = '55000';
  END IF;
  IF NEW.status NOT IN ('SUPERSEDED','REVOKED') THEN
    RAISE EXCEPTION 'existing Human Provider Selection identity may only become SUPERSEDED or REVOKED'
      USING ERRCODE = '55000';
  END IF;
  IF NEW.requester_workspace_id IS DISTINCT FROM previous_record.requester_workspace_id
     OR NEW.scope_owner IS DISTINCT FROM previous_record.scope_owner
     OR NEW.scope_reference IS DISTINCT FROM previous_record.scope_reference
     OR NEW.scope_reference_version IS DISTINCT FROM previous_record.scope_reference_version
     OR NEW.scope_fingerprint_sha256 IS DISTINCT FROM previous_record.scope_fingerprint_sha256
     OR NEW.discovery_request_id IS DISTINCT FROM previous_record.discovery_request_id
     OR NEW.discovery_request_fingerprint_sha256 IS DISTINCT FROM previous_record.discovery_request_fingerprint_sha256
     OR NEW.discovery_candidate_id IS DISTINCT FROM previous_record.discovery_candidate_id
     OR NEW.discovery_candidate_fingerprint_sha256 IS DISTINCT FROM previous_record.discovery_candidate_fingerprint_sha256
     OR NEW.provider_id IS DISTINCT FROM previous_record.provider_id
     OR NEW.provider_workspace_id IS DISTINCT FROM previous_record.provider_workspace_id
     OR NEW.provider_supply_capability_id IS DISTINCT FROM previous_record.provider_supply_capability_id
     OR NEW.provider_supply_capability_version IS DISTINCT FROM previous_record.provider_supply_capability_version
     OR NEW.provider_supply_capability_fingerprint_sha256 IS DISTINCT FROM previous_record.provider_supply_capability_fingerprint_sha256
     OR NEW.selecting_actor_id IS DISTINCT FROM previous_record.selecting_actor_id
     OR NEW.principal_reference IS DISTINCT FROM previous_record.principal_reference
     OR NEW.workspace_membership_reference IS DISTINCT FROM previous_record.workspace_membership_reference
     OR NEW.selection_authority_reference IS DISTINCT FROM previous_record.selection_authority_reference
     OR NEW.selection_authority_version IS DISTINCT FROM previous_record.selection_authority_version
     OR NEW.affirmative_human_action_evidence_reference IS DISTINCT FROM previous_record.affirmative_human_action_evidence_reference
     OR NEW.selected_at IS DISTINCT FROM previous_record.selected_at
     OR NEW.correlation_id IS DISTINCT FROM previous_record.correlation_id THEN
    RAISE EXCEPTION 'Human Provider Selection identity binding and reviewed lineage are immutable'
      USING ERRCODE = '55000';
  END IF;
  IF (
    previous_record.selection_record
      - 'version' - 'scopeVersion' - 'status' - 'supersededBy' - 'revokedAt' - 'revocationReasonCode'
  ) IS DISTINCT FROM (
    NEW.selection_record
      - 'version' - 'scopeVersion' - 'status' - 'supersededBy' - 'revokedAt' - 'revocationReasonCode'
  ) THEN
    RAISE EXCEPTION 'Human Provider Selection canonical payload is immutable across lifecycle versions'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_provider_selection_versions_validate_append
BEFORE INSERT ON mgsn_provider_selection_versions
FOR EACH ROW EXECUTE FUNCTION validate_mgsn_provider_selection_version_append();

CREATE OR REPLACE FUNCTION reject_mgsn_provider_selection_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_selection_versions history is immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_selection_versions_immutable
BEFORE UPDATE OR DELETE ON mgsn_provider_selection_versions
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_selection_version_mutation();

CREATE OR REPLACE FUNCTION guard_mgsn_provider_selection_scope_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  head_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Human Provider Selection scope state cannot be deleted; revoke by advancing the exact scope version'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.scope_version <> 1 THEN
      RAISE EXCEPTION 'first Human Provider Selection scope state must begin at scope version 1'
        USING ERRCODE = '55000';
    END IF;
  ELSE
    IF NEW.scope_key IS DISTINCT FROM OLD.scope_key
       OR NEW.requester_workspace_id IS DISTINCT FROM OLD.requester_workspace_id
       OR NEW.scope_owner IS DISTINCT FROM OLD.scope_owner
       OR NEW.scope_reference IS DISTINCT FROM OLD.scope_reference THEN
      RAISE EXCEPTION 'Human Provider Selection scope slot binding is immutable'
        USING ERRCODE = '55000';
    END IF;
    IF NEW.scope_version <> OLD.scope_version + 1 THEN
      RAISE EXCEPTION 'Human Provider Selection scope CAS must advance exactly one version'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  SELECT status
  INTO head_status
  FROM mgsn_provider_selection_versions
  WHERE provider_selection_id = NEW.head_provider_selection_id
    AND version = NEW.head_selection_version
    AND requester_workspace_id = NEW.requester_workspace_id
    AND scope_owner = NEW.scope_owner
    AND scope_reference = NEW.scope_reference
    AND scope_version = NEW.scope_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Human Provider Selection scope head must reference the exact committed scope version'
      USING ERRCODE = '55000';
  END IF;

  IF head_status = 'CURRENT' THEN
    IF NEW.current_provider_selection_id IS DISTINCT FROM NEW.head_provider_selection_id
       OR NEW.current_selection_version IS DISTINCT FROM NEW.head_selection_version
       OR NEW.current_selection_scope_version IS DISTINCT FROM NEW.scope_version THEN
      RAISE EXCEPTION 'CURRENT Human Provider Selection scope head must be the exact current pointer'
        USING ERRCODE = '55000';
    END IF;
  ELSIF head_status = 'REVOKED' THEN
    IF NEW.current_provider_selection_id IS NOT NULL
       OR NEW.current_selection_version IS NOT NULL
       OR NEW.current_selection_scope_version IS NOT NULL THEN
      RAISE EXCEPTION 'REVOKED Human Provider Selection scope head cannot retain a current pointer'
        USING ERRCODE = '55000';
    END IF;
  ELSE
    RAISE EXCEPTION 'SUPERSEDED Human Provider Selection cannot be the scope head'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_provider_selection_scope_state_guard
BEFORE INSERT OR UPDATE OR DELETE ON mgsn_provider_selection_scope_state
FOR EACH ROW EXECUTE FUNCTION guard_mgsn_provider_selection_scope_state();

CREATE OR REPLACE FUNCTION reject_mgsn_provider_selection_replay_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_selection_command_replays is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_selection_command_replays_append_only
BEFORE UPDATE OR DELETE ON mgsn_provider_selection_command_replays
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_selection_replay_mutation();

CREATE OR REPLACE FUNCTION reject_mgsn_provider_selection_owner_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_selection_owner_audit_events is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_selection_owner_audit_events_append_only
BEFORE UPDATE OR DELETE ON mgsn_provider_selection_owner_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_selection_owner_audit_mutation();
