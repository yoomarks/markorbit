CREATE TABLE IF NOT EXISTS markreg_formal_trademark_service_opportunities (
  workspace_id uuid NOT NULL,
  formal_trademark_service_opportunity_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('QUALIFIED','HANDED_OFF_TO_INTAKE','CLOSED')),
  source_candidate_id text NOT NULL,
  source_candidate_version integer NOT NULL CHECK (source_candidate_version > 0),
  source_candidate_fingerprint_sha256 char(64) NOT NULL CHECK (source_candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_qualification_decision_id text NOT NULL,
  source_qualification_decision_version integer NOT NULL CHECK (source_qualification_decision_version > 0),
  customer_id text,
  relationship_model text NOT NULL CHECK (relationship_model IN ('DIRECT','CO_DELIVERY','WHITE_LABEL','REFERRAL','PLATFORM_ASSISTED')),
  formal_opportunity_fingerprint_sha256 char(64) NOT NULL CHECK (formal_opportunity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  created_by_principal_id text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, formal_trademark_service_opportunity_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS markreg_formal_opportunity_qualification_origin_uq
  ON markreg_formal_trademark_service_opportunities (
    workspace_id,
    source_qualification_decision_id,
    source_qualification_decision_version
  )
  WHERE version = 1;

CREATE INDEX IF NOT EXISTS markreg_formal_opportunity_latest_idx
  ON markreg_formal_trademark_service_opportunities (
    workspace_id,
    formal_trademark_service_opportunity_id,
    version DESC
  );

CREATE TABLE IF NOT EXISTS markreg_intake_handoffs (
  workspace_id uuid NOT NULL,
  formal_trademark_service_opportunity_id text NOT NULL,
  formal_opportunity_version integer NOT NULL CHECK (formal_opportunity_version > 0),
  expected_formal_opportunity_fingerprint_sha256 char(64) NOT NULL CHECK (expected_formal_opportunity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  confirmed_by_principal_id text NOT NULL,
  confirmed_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, formal_trademark_service_opportunity_id),
  FOREIGN KEY (
    workspace_id,
    formal_trademark_service_opportunity_id,
    formal_opportunity_version
  ) REFERENCES markreg_formal_trademark_service_opportunities (
    workspace_id,
    formal_trademark_service_opportunity_id,
    version
  )
);

CREATE TABLE IF NOT EXISTS markreg_formal_opportunity_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('CREATE_FORMAL_OPPORTUNITY','PREPARE_INTAKE_HANDOFF')),
  request_fingerprint_sha256 char(64) NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
