CREATE TABLE lite_partner_referral_programs (
  partner_referral_program_id text PRIMARY KEY
    CHECK (partner_referral_program_id ~ '^partner-referral-program_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  referral_code text NOT NULL CHECK (referral_code ~ '^[A-Za-z0-9][A-Za-z0-9._~-]{0,79}$'),
  partner_directory_entry_id text NOT NULL,
  partner_directory_entry_version integer NOT NULL CHECK (partner_directory_entry_version > 0),
  partner_directory_entry_fingerprint_sha256 text NOT NULL
    CHECK (partner_directory_entry_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  policy_id text NOT NULL CHECK (policy_id ~ '^partner-referral-policy_[A-Za-z0-9_-]+$'),
  policy_version integer NOT NULL DEFAULT 1 CHECK (policy_version = 1),
  policy_fingerprint_sha256 text NOT NULL CHECK (policy_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status = 'ACTIVE'),
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (workspace_id, referral_code)
);

CREATE INDEX lite_partner_referral_programs_workspace_created_idx
  ON lite_partner_referral_programs (workspace_id, created_at DESC, partner_referral_program_id);

CREATE TABLE lite_partner_referral_program_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  partner_referral_program_id text NOT NULL
    REFERENCES lite_partner_referral_programs(partner_referral_program_id),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE TABLE lite_partner_commission_eligibility_candidates (
  partner_commission_eligibility_candidate_id text PRIMARY KEY
    CHECK (
      partner_commission_eligibility_candidate_id
        ~ '^partner-commission-eligibility_[A-Za-z0-9_-]+$'
    ),
  workspace_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  partner_referral_program_id text NOT NULL
    REFERENCES lite_partner_referral_programs(partner_referral_program_id),
  site_inbound_attribution_link_id text NOT NULL,
  downstream_formal_matter_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome = 'ELIGIBLE_FOR_COMMISSION_REVIEW'),
  document_json jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL,
  UNIQUE (workspace_id, site_inbound_attribution_link_id)
);

CREATE INDEX lite_partner_commission_eligibility_workspace_evaluated_idx
  ON lite_partner_commission_eligibility_candidates (
    workspace_id,
    evaluated_at DESC,
    partner_commission_eligibility_candidate_id
  );

CREATE TABLE lite_partner_commission_eligibility_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  partner_commission_eligibility_candidate_id text NOT NULL
    REFERENCES lite_partner_commission_eligibility_candidates(
      partner_commission_eligibility_candidate_id
    ),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
