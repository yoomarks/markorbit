CREATE TABLE lite_workspace_channel_identity_binding_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  workspace_channel_identity_binding_id text NOT NULL
    CHECK (workspace_channel_identity_binding_id ~ '^workspace-channel-identity-binding_[A-Za-z0-9._:-]+$'),
  version integer NOT NULL CHECK (version > 0),
  feature_key text NOT NULL CHECK (feature_key IN (
    'EMAIL_CONVERSATION',
    'SMS_WORKSPACE_NOTIFICATION',
    'SMS_WORKSPACE_CAMPAIGN',
    'WHATSAPP_BUSINESS',
    'WECHAT_ECOSYSTEM'
  )),
  status text NOT NULL CHECK (status IN ('ACTIVE','STALE','REVOKED')),
  identity_fingerprint_sha256 text NOT NULL
    CHECK (identity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  external_account_ref text NOT NULL
    CHECK (btrim(external_account_ref) <> '' AND char_length(external_account_ref) <= 500),
  external_channel_ref text
    CHECK (external_channel_ref IS NULL OR (btrim(external_channel_ref) <> '' AND char_length(external_channel_ref) <= 500)),
  capability_id text NOT NULL
    CHECK (btrim(capability_id) <> '' AND char_length(capability_id) <= 160),
  capability_version text NOT NULL
    CHECK (btrim(capability_version) <> '' AND char_length(capability_version) <= 120),
  implementation_profile_id text NOT NULL
    CHECK (implementation_profile_id ~ '^implementation-profile_[A-Za-z0-9][A-Za-z0-9._:-]*$'),
  implementation_profile_version integer NOT NULL CHECK (implementation_profile_version > 0),
  oauth_credential_binding_id text,
  oauth_credential_binding_version integer,
  binding_fingerprint_sha256 text NOT NULL
    CHECK (binding_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  bound_at timestamptz NOT NULL,
  last_verified_at timestamptz NOT NULL,
  stale_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, workspace_channel_identity_binding_id, version),
  CHECK ((oauth_credential_binding_id IS NULL) = (oauth_credential_binding_version IS NULL)),
  CHECK (oauth_credential_binding_version IS NULL OR oauth_credential_binding_version > 0),
  CHECK (bound_at <= last_verified_at AND last_verified_at <= updated_at),
  CHECK (
    (status='ACTIVE' AND stale_at IS NULL AND revoked_at IS NULL) OR
    (status='STALE' AND stale_at IS NOT NULL AND revoked_at IS NULL) OR
    (status='REVOKED' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX lite_workspace_channel_identity_binding_versions_history
  ON lite_workspace_channel_identity_binding_versions(
    workspace_id, workspace_channel_identity_binding_id, version DESC
  );

CREATE TABLE lite_workspace_channel_identity_binding_heads (
  workspace_id uuid NOT NULL,
  workspace_channel_identity_binding_id text NOT NULL,
  latest_version integer NOT NULL CHECK (latest_version > 0),
  feature_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','STALE','REVOKED')),
  identity_fingerprint_sha256 text NOT NULL
    CHECK (identity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  binding_fingerprint_sha256 text NOT NULL
    CHECK (binding_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, workspace_channel_identity_binding_id),
  FOREIGN KEY (workspace_id, workspace_channel_identity_binding_id, latest_version)
    REFERENCES lite_workspace_channel_identity_binding_versions(
      workspace_id, workspace_channel_identity_binding_id, version
    ) ON DELETE CASCADE
);

CREATE UNIQUE INDEX lite_workspace_channel_identity_one_active_identity
  ON lite_workspace_channel_identity_binding_heads(
    workspace_id, feature_key, identity_fingerprint_sha256
  ) WHERE status='ACTIVE';

CREATE INDEX lite_workspace_channel_identity_binding_latest
  ON lite_workspace_channel_identity_binding_heads(
    workspace_id, feature_key, status, updated_at DESC, workspace_channel_identity_binding_id
  );

CREATE TABLE lite_workspace_channel_identity_binding_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL
    CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500),
  command_type text NOT NULL CHECK (command_type IN ('ADMIT_TRUSTED','MARK_STALE','REVOKE')),
  request_fingerprint_sha256 text NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_binding_id text NOT NULL,
  result_version integer NOT NULL CHECK (result_version > 0),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, result_binding_id, result_version)
    REFERENCES lite_workspace_channel_identity_binding_versions(
      workspace_id, workspace_channel_identity_binding_id, version
    )
);
