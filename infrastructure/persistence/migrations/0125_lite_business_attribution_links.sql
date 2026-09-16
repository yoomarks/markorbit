CREATE TABLE lite_business_attribution_links (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  business_attribution_link_id text NOT NULL CHECK (btrim(business_attribution_link_id) <> ''),
  version integer NOT NULL CHECK (version = 1),
  motion_kind text NOT NULL CHECK (motion_kind IN ('DATA_PROSPECTING','PORTFOLIO_GROWTH','PARTNER_DEVELOPMENT','SITE_INBOUND')),
  attribution_state text NOT NULL CHECK (attribution_state IN ('ATTRIBUTED','DIRECT','UNATTRIBUTED','UNKNOWN')),
  evidence_basis text NOT NULL CHECK (evidence_basis IN ('EXACT_LINEAGE','HUMAN_CONFIRMED','OWNER_REPORTED')),
  downstream_owner text,
  downstream_kind text,
  downstream_id text,
  downstream_version text,
  downstream_fingerprint_sha256 text CHECK (downstream_fingerprint_sha256 IS NULL OR downstream_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  business_attribution_fingerprint_sha256 text NOT NULL CHECK (business_attribution_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL,
  recorded_by_principal_id text NOT NULL CHECK (btrim(recorded_by_principal_id) <> ''),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, business_attribution_link_id, version)
);

CREATE INDEX lite_business_attribution_downstream
  ON lite_business_attribution_links(workspace_id, downstream_owner, downstream_kind, downstream_id)
  WHERE downstream_id IS NOT NULL;

CREATE TABLE lite_business_attribution_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  command_type text NOT NULL CHECK (command_type = 'CREATE_BUSINESS_ATTRIBUTION_LINK'),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
