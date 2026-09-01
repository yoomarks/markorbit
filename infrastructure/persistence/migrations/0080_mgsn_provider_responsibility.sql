-- MGSN Provider Responsibility / Direct-to-Executor persistence foundation.
-- Intentionally DDL-only: existing Providers are not enrolled, classified, verified or authorized.
-- No profile/current-pointer row means Provider Responsibility is UNKNOWN / not established.

CREATE TABLE mgsn_provider_responsibility_profile_identities (
  provider_responsibility_profile_id text PRIMARY KEY
    CHECK (provider_responsibility_profile_id ~ '^provider-responsibility_[A-Za-z0-9_-]+$'),
  provider_id text NOT NULL,
  provider_workspace_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (provider_responsibility_profile_id, provider_id, provider_workspace_id),
  FOREIGN KEY (provider_id, provider_workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id)
);
CREATE INDEX mgsn_provider_responsibility_profile_identities_provider_idx
  ON mgsn_provider_responsibility_profile_identities(
    provider_workspace_id,
    provider_id,
    created_at DESC
  );

CREATE TABLE mgsn_provider_responsibility_profiles (
  provider_responsibility_profile_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  provider_id text NOT NULL,
  provider_workspace_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('CURRENT','SUSPENDED','REVOKED')),
  final_executor_status text NOT NULL CHECK (
    final_executor_status IN ('UNKNOWN','PROVIDER_IS_FINAL_EXECUTOR','PROVIDER_IS_NOT_FINAL_EXECUTOR')
  ),
  direct_responsibility_status text NOT NULL CHECK (
    direct_responsibility_status IN ('UNKNOWN','ATTESTED','VERIFIED','DENIED','DISPUTED')
  ),
  no_rebrokering_commitment_state text NOT NULL CHECK (
    no_rebrokering_commitment_state IN ('UNKNOWN','COMMITTED','SUSPENDED','REVOKED','VIOLATION_RECORDED')
  ),
  intermediary_disclosure_state text NOT NULL CHECK (
    intermediary_disclosure_state IN (
      'UNKNOWN',
      'NO_INTERMEDIARY_DISCLOSED',
      'LEGALLY_REQUIRED_SIGNER_ONLY',
      'REBROKERING_OR_SUBAGENT_DISCLOSED'
    )
  ),
  signer_kind text NOT NULL CHECK (signer_kind IN ('NONE','REQUIRED')),
  signer_reference text,
  signer_identity_authority_reference text,
  signer_legal_basis_reference text,
  signer_jurisdiction text,
  signer_function text,
  signer_transparently_disclosed boolean,
  signer_receives_handoff_data_by_default boolean,
  signer_does_not_replace_final_execution_provider boolean,
  authority_state text NOT NULL CHECK (authority_state IN ('CURRENT','STALE','AMBIGUOUS','UNAVAILABLE')),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  checked_at timestamptz NOT NULL,
  profile_fingerprint_sha256 text NOT NULL CHECK (profile_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  profile_record jsonb NOT NULL CHECK (jsonb_typeof(profile_record) = 'object'),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (provider_responsibility_profile_id, version),
  UNIQUE (
    provider_responsibility_profile_id,
    version,
    provider_id,
    provider_workspace_id
  ),
  FOREIGN KEY (
    provider_responsibility_profile_id,
    provider_id,
    provider_workspace_id
  ) REFERENCES mgsn_provider_responsibility_profile_identities(
    provider_responsibility_profile_id,
    provider_id,
    provider_workspace_id
  ),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK (
    (
      signer_kind = 'NONE'
      AND signer_reference IS NULL
      AND signer_identity_authority_reference IS NULL
      AND signer_legal_basis_reference IS NULL
      AND signer_jurisdiction IS NULL
      AND signer_function IS NULL
      AND signer_transparently_disclosed IS NULL
      AND signer_receives_handoff_data_by_default IS NULL
      AND signer_does_not_replace_final_execution_provider IS NULL
    )
    OR (
      signer_kind = 'REQUIRED'
      AND signer_reference IS NOT NULL
      AND length(btrim(signer_reference)) > 0
      AND signer_identity_authority_reference IS NOT NULL
      AND length(btrim(signer_identity_authority_reference)) > 0
      AND signer_legal_basis_reference IS NOT NULL
      AND length(btrim(signer_legal_basis_reference)) > 0
      AND signer_jurisdiction IS NOT NULL
      AND length(btrim(signer_jurisdiction)) > 0
      AND signer_function = 'SIGNING_OR_FILING_ONLY'
      AND signer_transparently_disclosed IS TRUE
      AND signer_receives_handoff_data_by_default IS FALSE
      AND signer_does_not_replace_final_execution_provider IS TRUE
    )
  ),
  CHECK (
    intermediary_disclosure_state <> 'LEGALLY_REQUIRED_SIGNER_ONLY'
    OR signer_kind = 'REQUIRED'
  )
);
CREATE INDEX mgsn_provider_responsibility_profiles_provider_history_idx
  ON mgsn_provider_responsibility_profiles(
    provider_workspace_id,
    provider_id,
    created_at DESC,
    version DESC
  );
CREATE INDEX mgsn_provider_responsibility_profiles_status_authority_idx
  ON mgsn_provider_responsibility_profiles(status, authority_state, checked_at DESC);

CREATE TABLE mgsn_provider_responsibility_execution_team_references (
  provider_responsibility_profile_id text NOT NULL,
  profile_version integer NOT NULL CHECK (profile_version > 0),
  team_ordinal integer NOT NULL CHECK (team_ordinal >= 0),
  team_reference text NOT NULL CHECK (length(btrim(team_reference)) > 0),
  role_reference text NOT NULL CHECK (length(btrim(role_reference)) > 0),
  identity_authority_reference text NOT NULL CHECK (length(btrim(identity_authority_reference)) > 0),
  contact_data_embedded boolean NOT NULL CHECK (contact_data_embedded IS FALSE),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (
    provider_responsibility_profile_id,
    profile_version,
    team_ordinal
  ),
  FOREIGN KEY (provider_responsibility_profile_id, profile_version)
    REFERENCES mgsn_provider_responsibility_profiles(provider_responsibility_profile_id, version)
);
CREATE INDEX mgsn_provider_responsibility_execution_team_profile_idx
  ON mgsn_provider_responsibility_execution_team_references(
    provider_responsibility_profile_id,
    profile_version,
    team_ordinal
  );

CREATE TABLE mgsn_provider_responsibility_evidence_references (
  provider_responsibility_profile_id text NOT NULL,
  profile_version integer NOT NULL CHECK (profile_version > 0),
  evidence_ordinal integer NOT NULL CHECK (evidence_ordinal >= 0),
  evidence_reference text NOT NULL CHECK (length(btrim(evidence_reference)) > 0),
  source_owner text NOT NULL CHECK (
    source_owner IN ('CORE','MGSN','EXECUTION','KNOWLEDGE','CAPABILITY_ENGINE','OTHER_CANONICAL_OWNER')
  ),
  source_type text NOT NULL CHECK (length(btrim(source_type)) > 0),
  source_id text NOT NULL CHECK (length(btrim(source_id)) > 0),
  source_version jsonb NOT NULL CHECK (
    (jsonb_typeof(source_version) = 'number' AND source_version::text ~ '^[1-9][0-9]*$')
    OR (
      jsonb_typeof(source_version) = 'string'
      AND length(btrim(source_version #>> '{}')) > 0
    )
  ),
  source_fingerprint_sha256 text NOT NULL CHECK (source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  authority_class text NOT NULL CHECK (
    authority_class IN (
      'PROVIDER_ATTESTATION',
      'ORGANIZATION_ATTESTATION',
      'MGSN_VERIFIED_REFERENCE',
      'CANONICAL_OWNER_REFERENCE',
      'LEGAL_REQUIREMENT_REFERENCE'
    )
  ),
  verification_state text NOT NULL CHECK (
    verification_state IN ('CLAIM_ONLY','INDEPENDENTLY_VERIFIED','DISPUTED','REVOKED')
  ),
  observed_at timestamptz NOT NULL,
  effective_from timestamptz,
  effective_until timestamptz,
  artifact_access_authorized boolean NOT NULL CHECK (artifact_access_authorized IS FALSE),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (
    provider_responsibility_profile_id,
    profile_version,
    evidence_ordinal
  ),
  UNIQUE (
    provider_responsibility_profile_id,
    profile_version,
    evidence_reference
  ),
  FOREIGN KEY (provider_responsibility_profile_id, profile_version)
    REFERENCES mgsn_provider_responsibility_profiles(provider_responsibility_profile_id, version),
  CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until > effective_from)
);
CREATE INDEX mgsn_provider_responsibility_evidence_source_idx
  ON mgsn_provider_responsibility_evidence_references(
    source_owner,
    source_type,
    source_id,
    source_fingerprint_sha256
  );

CREATE TABLE mgsn_provider_responsibility_current (
  provider_id text NOT NULL,
  provider_workspace_id uuid NOT NULL,
  provider_responsibility_profile_id text NOT NULL,
  profile_version integer NOT NULL CHECK (profile_version > 0),
  set_by text NOT NULL CHECK (length(btrim(set_by)) > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  set_at timestamptz NOT NULL,
  PRIMARY KEY (provider_id, provider_workspace_id),
  UNIQUE (provider_responsibility_profile_id),
  FOREIGN KEY (provider_id, provider_workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id),
  FOREIGN KEY (
    provider_responsibility_profile_id,
    profile_version,
    provider_id,
    provider_workspace_id
  ) REFERENCES mgsn_provider_responsibility_profiles(
    provider_responsibility_profile_id,
    version,
    provider_id,
    provider_workspace_id
  )
);
CREATE INDEX mgsn_provider_responsibility_current_profile_idx
  ON mgsn_provider_responsibility_current(provider_responsibility_profile_id, profile_version);

CREATE TABLE mgsn_provider_responsibility_pointer_audit (
  audit_id bigserial PRIMARY KEY,
  provider_id text NOT NULL,
  provider_workspace_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('SET','REPLACE')),
  previous_profile_id text,
  previous_profile_version integer CHECK (previous_profile_version IS NULL OR previous_profile_version > 0),
  new_profile_id text NOT NULL,
  new_profile_version integer NOT NULL CHECK (new_profile_version > 0),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  occurred_at timestamptz NOT NULL,
  FOREIGN KEY (provider_id, provider_workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id),
  CHECK (
    (action = 'SET' AND previous_profile_id IS NULL AND previous_profile_version IS NULL)
    OR (action = 'REPLACE' AND previous_profile_id IS NOT NULL AND previous_profile_version IS NOT NULL)
  )
);
CREATE INDEX mgsn_provider_responsibility_pointer_audit_provider_idx
  ON mgsn_provider_responsibility_pointer_audit(
    provider_workspace_id,
    provider_id,
    occurred_at DESC,
    audit_id DESC
  );

CREATE OR REPLACE FUNCTION reject_mgsn_provider_responsibility_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_responsibility_profile_identities is immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_responsibility_identity_immutable
BEFORE UPDATE OR DELETE ON mgsn_provider_responsibility_profile_identities
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_responsibility_identity_mutation();

CREATE OR REPLACE FUNCTION reject_mgsn_provider_responsibility_profile_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_responsibility_profiles version history is immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_responsibility_profile_immutable
BEFORE UPDATE OR DELETE ON mgsn_provider_responsibility_profiles
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_responsibility_profile_mutation();

CREATE OR REPLACE FUNCTION reject_mgsn_provider_responsibility_team_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_responsibility_execution_team_references is immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_responsibility_team_immutable
BEFORE UPDATE OR DELETE ON mgsn_provider_responsibility_execution_team_references
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_responsibility_team_mutation();

CREATE OR REPLACE FUNCTION reject_mgsn_provider_responsibility_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_responsibility_evidence_references is immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_responsibility_evidence_immutable
BEFORE UPDATE OR DELETE ON mgsn_provider_responsibility_evidence_references
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_responsibility_evidence_mutation();

CREATE OR REPLACE FUNCTION reject_mgsn_provider_responsibility_revival()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM mgsn_provider_responsibility_profiles
    WHERE provider_responsibility_profile_id = NEW.provider_responsibility_profile_id
      AND status = 'REVOKED'
  ) THEN
    RAISE EXCEPTION 'revoked Provider Responsibility profile cannot be revived; create a fresh profile id'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_provider_responsibility_no_revival
BEFORE INSERT ON mgsn_provider_responsibility_profiles
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_responsibility_revival();

CREATE OR REPLACE FUNCTION guard_mgsn_provider_responsibility_current_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Provider Responsibility current pointer cannot be silently deleted; point to an explicit terminal profile state instead'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.provider_id <> OLD.provider_id
    OR NEW.provider_workspace_id <> OLD.provider_workspace_id
  ) THEN
    RAISE EXCEPTION 'Provider Responsibility current pointer binding is immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_provider_responsibility_current_guard
BEFORE UPDATE OR DELETE ON mgsn_provider_responsibility_current
FOR EACH ROW EXECUTE FUNCTION guard_mgsn_provider_responsibility_current_mutation();

CREATE OR REPLACE FUNCTION audit_mgsn_provider_responsibility_pointer_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO mgsn_provider_responsibility_pointer_audit (
    provider_id,
    provider_workspace_id,
    action,
    previous_profile_id,
    previous_profile_version,
    new_profile_id,
    new_profile_version,
    actor_id,
    correlation_id,
    occurred_at
  ) VALUES (
    NEW.provider_id,
    NEW.provider_workspace_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'SET' ELSE 'REPLACE' END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.provider_responsibility_profile_id END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.profile_version END,
    NEW.provider_responsibility_profile_id,
    NEW.profile_version,
    NEW.set_by,
    NEW.correlation_id,
    NEW.set_at
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_provider_responsibility_pointer_audit_trigger
AFTER INSERT OR UPDATE ON mgsn_provider_responsibility_current
FOR EACH ROW EXECUTE FUNCTION audit_mgsn_provider_responsibility_pointer_mutation();

CREATE OR REPLACE FUNCTION reject_mgsn_provider_responsibility_pointer_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_responsibility_pointer_audit is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_responsibility_pointer_audit_append_only
BEFORE UPDATE OR DELETE ON mgsn_provider_responsibility_pointer_audit
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_responsibility_pointer_audit_mutation();