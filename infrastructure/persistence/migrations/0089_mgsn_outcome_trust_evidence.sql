-- MGSN Outcome & Trust Evidence V1 persistence foundation.
-- Canonical contextual evidence only: no raw evidence artifacts, client/relationship data, private
-- communications, commercial margin/profit, payment credentials or source-owner payload copies are
-- required here. Persisted evidence/projections/explanations grant no selection, allocation,
-- engagement/contact, appointment, protected-action, Filing, Payment or Official Truth authority.

CREATE TABLE mgsn_trust_evidence_items (
  trust_evidence_item_id text NOT NULL
    CHECK (trust_evidence_item_id ~ '^trust-evidence-item_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  provider_id text NOT NULL,
  lifecycle_state text NOT NULL CHECK (
    lifecycle_state IN ('CURRENT','CORRECTED','SUPERSEDED','REVOKED','DISPUTED')
  ),
  context_fingerprint_sha256 text NOT NULL CHECK (context_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_kind text NOT NULL CHECK (
    source_kind IN ('CANONICAL_OWNER_FACT','PROVIDER_CLAIM','AUTHORIZED_OUTCOME_OBSERVATION')
  ),
  source_authority_state text NOT NULL CHECK (
    source_authority_state IN ('CURRENT','STALE','AMBIGUOUS','UNAVAILABLE')
  ),
  freshness_state text NOT NULL CHECK (
    freshness_state IN ('CURRENT_FOR_CONTEXT','STALE','UNKNOWN','SOURCE_UNAVAILABLE')
  ),
  trust_evidence_item_fingerprint_sha256 text NOT NULL
    CHECK (trust_evidence_item_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  item_record jsonb NOT NULL CHECK (jsonb_typeof(item_record) = 'object'),
  created_at timestamptz NOT NULL,

  PRIMARY KEY (trust_evidence_item_id, version),
  UNIQUE (trust_evidence_item_id, version, trust_evidence_item_fingerprint_sha256),
  FOREIGN KEY (provider_id) REFERENCES mgsn_providers(provider_id),

  CHECK (COALESCE(item_record #>> '{schemaVersion}', '') = '1'),
  CHECK (COALESCE(item_record #>> '{trustEvidenceItemId}', '') = trust_evidence_item_id),
  CHECK (
    COALESCE(item_record #>> '{version}', '') ~ '^[1-9][0-9]*$'
    AND (item_record #>> '{version}')::integer = version
  ),
  CHECK (COALESCE(item_record #>> '{providerId}', '') = provider_id),
  CHECK (COALESCE(item_record #>> '{lifecycleState}', '') = lifecycle_state),
  CHECK (COALESCE(item_record #>> '{context,contextFingerprintSha256}', '') = context_fingerprint_sha256),
  CHECK (COALESCE(item_record #>> '{source,kind}', '') = source_kind),
  CHECK (COALESCE(item_record #>> '{sourceAuthority,authorityState}', '') = source_authority_state),
  CHECK (COALESCE(item_record #>> '{freshness,state}', '') = freshness_state),
  CHECK (
    COALESCE(item_record #>> '{trustEvidenceItemFingerprintSha256}', '') =
      trust_evidence_item_fingerprint_sha256
  ),
  CHECK (
    COALESCE(item_record #>> '{createdAt}', '') <> ''
    AND (item_record #>> '{createdAt}')::timestamptz = created_at
  ),
  CHECK (COALESCE(item_record #>> '{currentExposureAuthorizationRequired}', '') = 'true'),

  -- Context stays service/work scoped and carries no client, relationship or commercial identity.
  CHECK (COALESCE(item_record #>> '{context,clientIdentityEmbedded}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{context,relationshipIdentityEmbedded}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{context,commercialDataEmbedded}', '') = 'false'),

  -- Historical source evidence never establishes present suitability or universal performance truth.
  CHECK (
    COALESCE(item_record #>> '{sourceAuthority,currentSourceRevalidationRequiredBeforeUse}', '') = 'true'
  ),
  CHECK (
    COALESCE(item_record #>> '{sourceAuthority,historicalSourceDoesNotEstablishCurrentSuitability}', '') = 'true'
  ),
  CHECK (
    COALESCE(item_record #>> '{sourceAuthority,universalPerformanceInferenceAuthorized}', '') = 'false'
  ),
  CHECK (COALESCE(item_record #>> '{freshness,currentSuitabilityEstablished}', '') = 'false'),
  CHECK (
    NOT jsonb_path_exists(
      item_record,
      '$.evidenceReferences[*] ? (@.artifactAccessAuthorized != false || @.currentArtifactAuthorizationRequired != true)'
    )
  ),
  CHECK (
    (source_kind <> 'CANONICAL_OWNER_FACT')
    OR (
      COALESCE(item_record #>> '{source,performanceTruthEstablished}', '') = 'false'
      AND COALESCE(item_record #>> '{source,officialTruthEstablished}', '') = 'false'
    )
  ),
  CHECK (
    (source_kind <> 'PROVIDER_CLAIM')
    OR (
      COALESCE(item_record #>> '{source,verifiedOutcomeEstablished}', '') = 'false'
      AND COALESCE(item_record #>> '{source,officialTruthEstablished}', '') = 'false'
    )
  ),
  CHECK (
    (source_kind <> 'AUTHORIZED_OUTCOME_OBSERVATION')
    OR (
      COALESCE(item_record #>> '{source,universalPerformanceTruthEstablished}', '') = 'false'
      AND COALESCE(item_record #>> '{source,officialTruthEstablished}', '') = 'false'
      AND COALESCE(item_record #>> '{source,observation,publicReviewCreated}', '') = 'false'
      AND COALESCE(item_record #>> '{source,observation,officialTruthCreated}', '') = 'false'
    )
  ),

  -- Frozen no-authority consequences from the shared contract.
  CHECK (COALESCE(item_record #>> '{authorityConsequences,providerSelected}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,providerAllocated}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,providerAccepted}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,providerEngaged}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,professionalAppointmentCreated}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,externalContactAuthorized}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,protectedActionReleased}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,filingAuthorized}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,filingSubmitted}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,paymentAuthorizedByTrustEvidence}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,officialTruthCreated}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,matterCompleted}', '') = 'false'),
  CHECK (COALESCE(item_record #>> '{authorityConsequences,userCapabilityVerifiedAutomatically}', '') = 'false')
);

CREATE INDEX mgsn_trust_evidence_items_provider_context_idx
  ON mgsn_trust_evidence_items(provider_id, context_fingerprint_sha256, created_at DESC, version DESC);
CREATE INDEX mgsn_trust_evidence_items_lifecycle_idx
  ON mgsn_trust_evidence_items(lifecycle_state, source_authority_state, freshness_state, created_at DESC);

CREATE TABLE mgsn_trust_evidence_visibility_projections (
  trust_evidence_visibility_projection_id text PRIMARY KEY
    CHECK (trust_evidence_visibility_projection_id ~ '^trust-evidence-projection_[A-Za-z0-9_-]+$'),
  provider_id text NOT NULL,
  purpose text NOT NULL CHECK (
    purpose IN (
      'PROVIDER_DISCOVERY_TRUST_EXPLANATION',
      'PROVIDER_WORKSPACE_EVIDENCE',
      'WORKPLACE_EVIDENCE_REVIEW'
    )
  ),
  audience_kind text NOT NULL CHECK (
    audience_kind IN ('BOUNDED_NETWORK','TRUSTED_RELATIONSHIP','OWNER_WORKSPACE')
  ),
  context_fingerprint_sha256 text NOT NULL CHECK (context_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  projection_fingerprint_sha256 text NOT NULL CHECK (projection_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  projection_record jsonb NOT NULL CHECK (jsonb_typeof(projection_record) = 'object'),
  created_at timestamptz NOT NULL,

  UNIQUE (trust_evidence_visibility_projection_id, projection_fingerprint_sha256),
  FOREIGN KEY (provider_id) REFERENCES mgsn_providers(provider_id),

  CHECK (COALESCE(projection_record #>> '{schemaVersion}', '') = '1'),
  CHECK (
    COALESCE(projection_record #>> '{trustEvidenceVisibilityProjectionId}', '') =
      trust_evidence_visibility_projection_id
  ),
  CHECK (COALESCE(projection_record #>> '{providerId}', '') = provider_id),
  CHECK (COALESCE(projection_record #>> '{purpose}', '') = purpose),
  CHECK (COALESCE(projection_record #>> '{audience,kind}', '') = audience_kind),
  CHECK (
    COALESCE(projection_record #>> '{contextFingerprintSha256}', '') = context_fingerprint_sha256
  ),
  CHECK (
    COALESCE(projection_record #>> '{projectionFingerprintSha256}', '') = projection_fingerprint_sha256
  ),
  CHECK (
    COALESCE(projection_record #>> '{createdAt}', '') <> ''
    AND (projection_record #>> '{createdAt}')::timestamptz = created_at
  ),
  CHECK (COALESCE(jsonb_typeof(projection_record #> '{evidenceItems}'), '') = 'array'),
  CHECK (COALESCE(projection_record #>> '{artifactAccessAuthorized}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{rawEvidenceDisclosureAuthorized}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{relationshipGraphDisclosureAuthorized}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{clientDataDisclosureAuthorized}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{commercialDataDisclosureAuthorized}', '') = 'false'),
  CHECK (
    COALESCE(
      projection_record #>> '{historicalAuthorization,currentAuthorityRevalidationRequiredBeforeServe}',
      ''
    ) = 'true'
  ),
  CHECK (
    COALESCE(projection_record #>> '{currentAuthorityRevalidationRequiredBeforeServe}', '') = 'true'
  ),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,providerSelected}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,providerAllocated}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,providerAccepted}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,providerEngaged}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,professionalAppointmentCreated}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,externalContactAuthorized}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,protectedActionReleased}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,filingAuthorized}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,filingSubmitted}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,paymentAuthorizedByTrustEvidence}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,officialTruthCreated}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,matterCompleted}', '') = 'false'),
  CHECK (COALESCE(projection_record #>> '{authorityConsequences,userCapabilityVerifiedAutomatically}', '') = 'false')
);

CREATE INDEX mgsn_trust_evidence_visibility_projections_context_idx
  ON mgsn_trust_evidence_visibility_projections(provider_id, purpose, context_fingerprint_sha256, created_at DESC);

CREATE TABLE mgsn_trust_explanations (
  trust_explanation_id text PRIMARY KEY
    CHECK (trust_explanation_id ~ '^trust-explanation_[A-Za-z0-9_-]+$'),
  provider_id text NOT NULL,
  context_fingerprint_sha256 text NOT NULL CHECK (context_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result text NOT NULL CHECK (
    result IN (
      'EVIDENCE_AVAILABLE',
      'INSUFFICIENT_EVIDENCE',
      'CONTRADICTORY_EVIDENCE',
      'STALE_OR_UNAVAILABLE',
      'DISPUTED_EVIDENCE'
    )
  ),
  trust_evidence_visibility_projection_id text NOT NULL,
  projection_fingerprint_sha256 text NOT NULL CHECK (projection_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  trust_explanation_fingerprint_sha256 text NOT NULL CHECK (trust_explanation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  explanation_record jsonb NOT NULL CHECK (jsonb_typeof(explanation_record) = 'object'),
  created_at timestamptz NOT NULL,

  UNIQUE (trust_explanation_id, trust_explanation_fingerprint_sha256),
  FOREIGN KEY (provider_id) REFERENCES mgsn_providers(provider_id),
  FOREIGN KEY (trust_evidence_visibility_projection_id, projection_fingerprint_sha256)
    REFERENCES mgsn_trust_evidence_visibility_projections(
      trust_evidence_visibility_projection_id,
      projection_fingerprint_sha256
    ),

  CHECK (COALESCE(explanation_record #>> '{schemaVersion}', '') = '1'),
  CHECK (COALESCE(explanation_record #>> '{trustExplanationId}', '') = trust_explanation_id),
  CHECK (COALESCE(explanation_record #>> '{providerId}', '') = provider_id),
  CHECK (
    COALESCE(explanation_record #>> '{contextFingerprintSha256}', '') = context_fingerprint_sha256
  ),
  CHECK (COALESCE(explanation_record #>> '{result}', '') = result),
  CHECK (
    COALESCE(explanation_record #>> '{visibilityProjection,trustEvidenceVisibilityProjectionId}', '') =
      trust_evidence_visibility_projection_id
  ),
  CHECK (
    COALESCE(explanation_record #>> '{visibilityProjection,projectionFingerprintSha256}', '') =
      projection_fingerprint_sha256
  ),
  CHECK (
    COALESCE(explanation_record #>> '{trustExplanationFingerprintSha256}', '') =
      trust_explanation_fingerprint_sha256
  ),
  CHECK (
    COALESCE(explanation_record #>> '{createdAt}', '') <> ''
    AND (explanation_record #>> '{createdAt}')::timestamptz = created_at
  ),
  CHECK (COALESCE(jsonb_typeof(explanation_record #> '{evidenceItems}'), '') = 'array'),
  CHECK (COALESCE(jsonb_typeof(explanation_record #> '{contradictions}'), '') = 'array'),
  CHECK (COALESCE(jsonb_typeof(explanation_record #> '{limitations}'), '') = 'array'),
  CHECK (
    COALESCE(explanation_record #>> '{currentExposureValidationRequiredBeforeServe}', '') = 'true'
  ),
  CHECK (COALESCE(explanation_record #>> '{universalScoreCreated}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{rankCreated}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{winnerCreated}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,providerSelected}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,providerAllocated}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,providerAccepted}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,providerEngaged}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,professionalAppointmentCreated}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,externalContactAuthorized}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,protectedActionReleased}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,filingAuthorized}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,filingSubmitted}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,paymentAuthorizedByTrustEvidence}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,officialTruthCreated}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,matterCompleted}', '') = 'false'),
  CHECK (COALESCE(explanation_record #>> '{authorityConsequences,userCapabilityVerifiedAutomatically}', '') = 'false')
);

CREATE INDEX mgsn_trust_explanations_context_idx
  ON mgsn_trust_explanations(provider_id, context_fingerprint_sha256, created_at DESC);
CREATE INDEX mgsn_trust_explanations_projection_idx
  ON mgsn_trust_explanations(trust_evidence_visibility_projection_id, created_at DESC);

-- Exact local lineage/reference guards. These verify that canonical references point to already-persisted
-- immutable Trust Evidence items with the exact version and fingerprint; they never retrieve source artifacts.
CREATE OR REPLACE FUNCTION validate_mgsn_trust_evidence_item_local_references()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ref jsonb;
BEGIN
  FOR ref IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.item_record #> '{lineage}', '[]'::jsonb))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM mgsn_trust_evidence_items i
       WHERE i.trust_evidence_item_id = ref #>> '{trustEvidenceItemId}'
         AND i.version = (ref #>> '{version}')::integer
         AND i.trust_evidence_item_fingerprint_sha256 = ref #>> '{trustEvidenceItemFingerprintSha256}'
    ) THEN
      RAISE EXCEPTION 'Trust Evidence lineage must reference exact persisted evidence history'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  FOR ref IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.item_record #> '{contradictions}', '[]'::jsonb))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM mgsn_trust_evidence_items i
       WHERE i.trust_evidence_item_id = ref #>> '{trustEvidenceItemId}'
         AND i.version = (ref #>> '{version}')::integer
         AND i.trust_evidence_item_fingerprint_sha256 = ref #>> '{trustEvidenceItemFingerprintSha256}'
    ) THEN
      RAISE EXCEPTION 'Trust Evidence contradiction must reference exact persisted evidence history'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_trust_evidence_items_reference_guard
BEFORE INSERT ON mgsn_trust_evidence_items
FOR EACH ROW EXECUTE FUNCTION validate_mgsn_trust_evidence_item_local_references();

CREATE OR REPLACE FUNCTION validate_mgsn_trust_evidence_projection_references()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ref jsonb;
BEGIN
  FOR ref IN SELECT value FROM jsonb_array_elements(NEW.projection_record #> '{evidenceItems}')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM mgsn_trust_evidence_items i
       WHERE i.trust_evidence_item_id = ref #>> '{trustEvidenceItemId}'
         AND i.version = (ref #>> '{version}')::integer
         AND i.trust_evidence_item_fingerprint_sha256 = ref #>> '{trustEvidenceItemFingerprintSha256}'
         AND i.provider_id = NEW.provider_id
         AND i.context_fingerprint_sha256 = NEW.context_fingerprint_sha256
    ) THEN
      RAISE EXCEPTION 'Trust Evidence projection must reference exact same-provider/context evidence history'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_trust_evidence_visibility_projections_reference_guard
BEFORE INSERT ON mgsn_trust_evidence_visibility_projections
FOR EACH ROW EXECUTE FUNCTION validate_mgsn_trust_evidence_projection_references();

CREATE OR REPLACE FUNCTION validate_mgsn_trust_explanation_references()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ref jsonb;
  contradiction jsonb;
  side_ref jsonb;
BEGIN
  FOR ref IN SELECT value FROM jsonb_array_elements(NEW.explanation_record #> '{evidenceItems}')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM mgsn_trust_evidence_items i
       WHERE i.trust_evidence_item_id = ref #>> '{trustEvidenceItemId}'
         AND i.version = (ref #>> '{version}')::integer
         AND i.trust_evidence_item_fingerprint_sha256 = ref #>> '{trustEvidenceItemFingerprintSha256}'
         AND i.provider_id = NEW.provider_id
         AND i.context_fingerprint_sha256 = NEW.context_fingerprint_sha256
    ) THEN
      RAISE EXCEPTION 'Trust Explanation must reference exact same-provider/context evidence history'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  FOR contradiction IN SELECT value FROM jsonb_array_elements(NEW.explanation_record #> '{contradictions}')
  LOOP
    FOREACH side_ref IN ARRAY ARRAY[contradiction #> '{left}', contradiction #> '{right}']
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM mgsn_trust_evidence_items i
         WHERE i.trust_evidence_item_id = side_ref #>> '{trustEvidenceItemId}'
           AND i.version = (side_ref #>> '{version}')::integer
           AND i.trust_evidence_item_fingerprint_sha256 = side_ref #>> '{trustEvidenceItemFingerprintSha256}'
           AND i.provider_id = NEW.provider_id
           AND i.context_fingerprint_sha256 = NEW.context_fingerprint_sha256
      ) THEN
        RAISE EXCEPTION 'Trust Explanation contradiction must reference exact same-provider/context evidence history'
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_trust_explanations_reference_guard
BEFORE INSERT ON mgsn_trust_explanations
FOR EACH ROW EXECUTE FUNCTION validate_mgsn_trust_explanation_references();

CREATE TABLE mgsn_trust_evidence_owner_audit_events (
  audit_id bigserial PRIMARY KEY,
  object_type text NOT NULL CHECK (
    object_type IN ('EVIDENCE_ITEM','VISIBILITY_PROJECTION','TRUST_EXPLANATION')
  ),
  target_id text NOT NULL CHECK (length(btrim(target_id)) > 0),
  target_version integer CHECK (target_version IS NULL OR target_version > 0),
  target_fingerprint_sha256 text NOT NULL CHECK (target_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  provider_id text NOT NULL,
  action text NOT NULL CHECK (
    action IN ('EVIDENCE_ITEM_RECORDED','VISIBILITY_PROJECTION_RECORDED','TRUST_EXPLANATION_RECORDED')
  ),
  occurred_at timestamptz NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES mgsn_providers(provider_id),
  CHECK (
    (object_type = 'EVIDENCE_ITEM' AND action = 'EVIDENCE_ITEM_RECORDED' AND target_version IS NOT NULL)
    OR
    (object_type = 'VISIBILITY_PROJECTION' AND action = 'VISIBILITY_PROJECTION_RECORDED' AND target_version IS NULL)
    OR
    (object_type = 'TRUST_EXPLANATION' AND action = 'TRUST_EXPLANATION_RECORDED' AND target_version IS NULL)
  )
);

CREATE INDEX mgsn_trust_evidence_owner_audit_provider_idx
  ON mgsn_trust_evidence_owner_audit_events(provider_id, occurred_at DESC, audit_id DESC);
CREATE INDEX mgsn_trust_evidence_owner_audit_target_idx
  ON mgsn_trust_evidence_owner_audit_events(object_type, target_id, occurred_at ASC, audit_id ASC);

CREATE OR REPLACE FUNCTION reject_mgsn_trust_evidence_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_trust_evidence_items_append_only
BEFORE UPDATE OR DELETE ON mgsn_trust_evidence_items
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_trust_evidence_append_only_mutation();

CREATE TRIGGER mgsn_trust_evidence_visibility_projections_append_only
BEFORE UPDATE OR DELETE ON mgsn_trust_evidence_visibility_projections
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_trust_evidence_append_only_mutation();

CREATE TRIGGER mgsn_trust_explanations_append_only
BEFORE UPDATE OR DELETE ON mgsn_trust_explanations
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_trust_evidence_append_only_mutation();

CREATE TRIGGER mgsn_trust_evidence_owner_audit_append_only
BEFORE UPDATE OR DELETE ON mgsn_trust_evidence_owner_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_trust_evidence_append_only_mutation();
