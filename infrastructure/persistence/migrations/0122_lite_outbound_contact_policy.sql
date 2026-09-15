CREATE TABLE lite_outbound_contact_basis_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  assertion_id text NOT NULL CHECK (assertion_id ~ '^outbound-contact-basis_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0), target_fingerprint_sha256 text NOT NULL CHECK (target_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  endpoint_fingerprint_sha256 text NOT NULL CHECK (endpoint_fingerprint_sha256 ~ '^[0-9a-f]{64}$'), purpose text NOT NULL CHECK (purpose IN ('PROSPECT_OUTREACH','PARTNER_OUTREACH')),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')), document_json jsonb NOT NULL, recorded_at timestamptz NOT NULL,
  PRIMARY KEY(workspace_id,assertion_id,version)
);
CREATE TABLE lite_outbound_contact_basis_heads (
  workspace_id uuid NOT NULL, target_fingerprint_sha256 text NOT NULL, endpoint_fingerprint_sha256 text NOT NULL,
  purpose text NOT NULL, assertion_id text NOT NULL, latest_version integer NOT NULL, status text NOT NULL, updated_at timestamptz NOT NULL,
  PRIMARY KEY(workspace_id,target_fingerprint_sha256,endpoint_fingerprint_sha256,purpose),
  FOREIGN KEY(workspace_id,assertion_id,latest_version) REFERENCES lite_outbound_contact_basis_versions(workspace_id,assertion_id,version) ON DELETE CASCADE
);
CREATE TABLE lite_outbound_contact_suppression_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  suppression_id text NOT NULL CHECK (suppression_id ~ '^outbound-contact-suppression_[A-Za-z0-9_-]+$'), version integer NOT NULL CHECK(version>0),
  endpoint_fingerprint_sha256 text NOT NULL CHECK(endpoint_fingerprint_sha256 ~ '^[0-9a-f]{64}$'), scope text NOT NULL CHECK(scope IN ('ALL_OUTBOUND','PROSPECT_OUTREACH','PARTNER_OUTREACH')),
  status text NOT NULL CHECK(status IN ('ACTIVE','CLEARED')), document_json jsonb NOT NULL, recorded_at timestamptz NOT NULL,
  PRIMARY KEY(workspace_id,suppression_id,version)
);
CREATE TABLE lite_outbound_contact_suppression_heads (
  workspace_id uuid NOT NULL, endpoint_fingerprint_sha256 text NOT NULL, scope text NOT NULL,
  suppression_id text NOT NULL, latest_version integer NOT NULL, status text NOT NULL, updated_at timestamptz NOT NULL,
  PRIMARY KEY(workspace_id,endpoint_fingerprint_sha256,scope),
  FOREIGN KEY(workspace_id,suppression_id,latest_version) REFERENCES lite_outbound_contact_suppression_versions(workspace_id,suppression_id,version) ON DELETE CASCADE
);
CREATE TABLE lite_outbound_contact_policy_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key)<>'' AND char_length(idempotency_key)<=500),
  command_type text NOT NULL CHECK(command_type IN ('ASSERT_BASIS','REVOKE_BASIS','SUPERSEDE_BASIS','SET_SUPPRESSION','CLEAR_SUPPRESSION')),
  request_fingerprint_sha256 text NOT NULL CHECK(request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'), result_json jsonb NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY(workspace_id,idempotency_key)
);
CREATE INDEX lite_outbound_basis_endpoint ON lite_outbound_contact_basis_heads(workspace_id,endpoint_fingerprint_sha256,purpose);
CREATE INDEX lite_outbound_suppression_endpoint ON lite_outbound_contact_suppression_heads(workspace_id,endpoint_fingerprint_sha256,scope);