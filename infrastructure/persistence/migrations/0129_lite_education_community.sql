ALTER TABLE lite_outbound_contact_basis_versions
  DROP CONSTRAINT lite_outbound_contact_basis_versions_purpose_check,
  ADD CONSTRAINT lite_outbound_contact_basis_versions_purpose_check
    CHECK (purpose IN ('PROSPECT_OUTREACH','PARTNER_OUTREACH','EDUCATION_INVITATION'));

ALTER TABLE lite_outbound_contact_suppression_versions
  DROP CONSTRAINT lite_outbound_contact_suppression_versions_scope_check,
  ADD CONSTRAINT lite_outbound_contact_suppression_versions_scope_check
    CHECK (scope IN (
      'ALL_OUTBOUND','PROSPECT_OUTREACH','PARTNER_OUTREACH','EDUCATION_INVITATION'
    ));

ALTER TABLE lite_business_attribution_links
  DROP CONSTRAINT lite_business_attribution_links_motion_kind_check,
  ADD CONSTRAINT lite_business_attribution_links_motion_kind_check
    CHECK (motion_kind IN (
      'DATA_PROSPECTING','PORTFOLIO_GROWTH','PARTNER_DEVELOPMENT',
      'SITE_INBOUND','CONTENT_LED_DEMAND','EDUCATION_COMMUNITY'
    ));

CREATE TABLE lite_education_community_cohorts (
  education_community_cohort_id text PRIMARY KEY
    CHECK (education_community_cohort_id ~ '^education-cohort_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  status text NOT NULL CHECK (status = 'ACTIVE'),
  cohort_fingerprint_sha256 text NOT NULL CHECK (cohort_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX lite_education_community_cohorts_workspace_created_idx
  ON lite_education_community_cohorts (workspace_id, created_at DESC, education_community_cohort_id);

CREATE TABLE lite_education_community_journey_versions (
  education_community_journey_id text NOT NULL
    CHECK (education_community_journey_id ~ '^education-journey_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version BETWEEN 1 AND 5),
  stage text NOT NULL CHECK (stage IN (
    'REGISTERED','INVITATION_PREPARED','WORKSPACE_ACTIVATED','FIRST_VALUE_RECORDED','RETAINED'
  )),
  document_json jsonb NOT NULL,
  journey_fingerprint_sha256 text NOT NULL CHECK (journey_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (education_community_journey_id, version)
);

CREATE TABLE lite_education_community_journey_heads (
  education_community_journey_id text PRIMARY KEY,
  education_community_cohort_id text NOT NULL
    REFERENCES lite_education_community_cohorts(education_community_cohort_id),
  campaign_workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  activated_workspace_id uuid REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  latest_version integer NOT NULL CHECK (latest_version BETWEEN 1 AND 5),
  stage text NOT NULL CHECK (stage IN (
    'REGISTERED','INVITATION_PREPARED','WORKSPACE_ACTIVATED','FIRST_VALUE_RECORDED','RETAINED'
  )),
  claim_fingerprint_sha256 text UNIQUE CHECK (
    claim_fingerprint_sha256 IS NULL OR claim_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
  ),
  updated_at timestamptz NOT NULL,
  FOREIGN KEY (education_community_journey_id, latest_version)
    REFERENCES lite_education_community_journey_versions(education_community_journey_id, version)
);

CREATE INDEX lite_education_community_journey_cohort_idx
  ON lite_education_community_journey_heads (
    campaign_workspace_id, education_community_cohort_id, education_community_journey_id
  );

CREATE INDEX lite_education_community_journey_activation_idx
  ON lite_education_community_journey_heads (activated_workspace_id, updated_at DESC)
  WHERE activated_workspace_id IS NOT NULL;

CREATE TABLE lite_education_community_commands (
  command_workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 300),
  command_type text NOT NULL CHECK (command_type IN (
    'CREATE_COHORT','REGISTER_PARTICIPANT','PREPARE_INVITATION',
    'ACTIVATE_WORKSPACE','RECORD_FIRST_VALUE','RECORD_RETAINED_USE'
  )),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (command_workspace_id, idempotency_key)
);
