CREATE TABLE lite_partner_candidates (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  partner_candidate_id text NOT NULL CHECK (partner_candidate_id ~ '^partner-candidate_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version = 1),
  status text NOT NULL CHECK (status = 'OPEN_FOR_HUMAN_QUALIFICATION'),
  fingerprint_sha256 text NOT NULL CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  admitted_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, partner_candidate_id, version)
);

CREATE TABLE lite_partner_qualification_decisions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  partner_qualification_decision_id text NOT NULL CHECK (partner_qualification_decision_id ~ '^partner-qualification_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version = 1),
  partner_candidate_id text NOT NULL,
  partner_candidate_version integer NOT NULL CHECK (partner_candidate_version = 1),
  outcome text NOT NULL CHECK (outcome IN ('QUALIFIED','REJECTED','DEFERRED')),
  fingerprint_sha256 text NOT NULL CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  decided_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, partner_qualification_decision_id, version),
  UNIQUE (workspace_id, partner_candidate_id),
  FOREIGN KEY (workspace_id, partner_candidate_id, partner_candidate_version)
    REFERENCES lite_partner_candidates(workspace_id, partner_candidate_id, version)
);

CREATE TABLE lite_partner_intelligence_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  command_type text NOT NULL CHECK (command_type IN ('CREATE_PARTNER_CANDIDATE','QUALIFY_PARTNER_CANDIDATE')),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
