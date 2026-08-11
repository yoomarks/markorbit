CREATE TABLE lite_opportunity_candidates (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 opportunity_candidate_id text NOT NULL CHECK (btrim(opportunity_candidate_id) <> ''),
 version integer NOT NULL CHECK (version >= 1),
 customer_id text,
 status text NOT NULL CHECK (status IN ('OPEN','UNDER_REVIEW','DISPOSITIONED')),
 opportunity_candidate_fingerprint_sha256 text NOT NULL CHECK (opportunity_candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, opportunity_candidate_id, version)
);

CREATE INDEX lite_opportunity_candidate_latest
 ON lite_opportunity_candidates(workspace_id, opportunity_candidate_id, version DESC);

CREATE INDEX lite_opportunity_candidate_customer
 ON lite_opportunity_candidates(workspace_id, customer_id, updated_at DESC)
 WHERE customer_id IS NOT NULL;

CREATE TABLE lite_opportunity_qualification_decisions (
 workspace_id uuid NOT NULL,
 opportunity_qualification_decision_id text NOT NULL CHECK (btrim(opportunity_qualification_decision_id) <> ''),
 version integer NOT NULL CHECK (version >= 1),
 opportunity_candidate_id text NOT NULL,
 opportunity_candidate_version integer NOT NULL CHECK (opportunity_candidate_version >= 1),
 outcome text NOT NULL CHECK (outcome IN ('QUALIFIED_FOR_MARKREG','REJECTED','DEFERRED')),
 decided_by_principal_id text NOT NULL CHECK (btrim(decided_by_principal_id) <> ''),
 expected_candidate_fingerprint_sha256 text NOT NULL CHECK (expected_candidate_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 decided_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, opportunity_qualification_decision_id, version),
 UNIQUE (workspace_id, opportunity_candidate_id),
 FOREIGN KEY (workspace_id, opportunity_candidate_id, opportunity_candidate_version)
  REFERENCES lite_opportunity_candidates(workspace_id, opportunity_candidate_id, version)
);

CREATE TABLE lite_candidate_qualification_commands (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 command_type text NOT NULL CHECK (command_type IN ('CREATE_OPPORTUNITY_CANDIDATE','RECORD_OPPORTUNITY_QUALIFICATION')),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);
