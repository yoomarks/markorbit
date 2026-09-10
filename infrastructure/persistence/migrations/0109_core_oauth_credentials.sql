CREATE TABLE core_external_oauth_grant_attempts (
  grant_attempt_id text PRIMARY KEY CHECK (grant_attempt_id ~ '^oauth-grant-attempt_[A-Za-z0-9_-]+$'),
  state_hash_sha256 text NOT NULL UNIQUE CHECK (state_hash_sha256 ~ '^[0-9a-f]{64}$'),
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES workspace_memberships(membership_id) ON DELETE CASCADE,
  membership_version integer NOT NULL CHECK (membership_version > 0),
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  oauth_client_profile_id text NOT NULL CHECK (btrim(oauth_client_profile_id) <> ''),
  oauth_client_profile_version text NOT NULL CHECK (btrim(oauth_client_profile_version) <> ''),
  requested_scopes jsonb NOT NULL CHECK (jsonb_typeof(requested_scopes) = 'array'),
  pkce_key_id text,
  pkce_nonce_base64 text,
  pkce_ciphertext_base64 text,
  pkce_auth_tag_base64 text,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at),
  CHECK ((pkce_key_id IS NULL) = (pkce_nonce_base64 IS NULL)),
  CHECK ((pkce_key_id IS NULL) = (pkce_ciphertext_base64 IS NULL)),
  CHECK ((pkce_key_id IS NULL) = (pkce_auth_tag_base64 IS NULL))
);

CREATE INDEX core_external_oauth_grant_attempts_expiry_idx
  ON core_external_oauth_grant_attempts(expires_at, consumed_at);

CREATE TABLE core_external_oauth_credential_bindings (
  credential_binding_id text PRIMARY KEY CHECK (credential_binding_id ~ '^oauth-credential-binding_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  oauth_client_profile_id text NOT NULL CHECK (btrim(oauth_client_profile_id) <> ''),
  oauth_client_profile_version text NOT NULL CHECK (btrim(oauth_client_profile_version) <> ''),
  external_account_ref text NOT NULL CHECK (btrim(external_account_ref) <> ''),
  granted_scopes jsonb NOT NULL CHECK (jsonb_typeof(granted_scopes) = 'array'),
  grantor_user_id uuid NOT NULL REFERENCES users(user_id),
  grantor_membership_id uuid NOT NULL REFERENCES workspace_memberships(membership_id),
  grantor_membership_version integer NOT NULL CHECK (grantor_membership_version > 0),
  lifecycle text NOT NULL CHECK (lifecycle IN ('ACTIVE','EXPIRED','REAUTH_REQUIRED','REVOKED')),
  refresh_capability text NOT NULL CHECK (refresh_capability IN ('AVAILABLE','NOT_AVAILABLE','UNKNOWN')),
  access_expires_at timestamptz,
  granted_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  revoked_at timestamptz,
  reauth_required_at timestamptz,
  CHECK (updated_at >= granted_at),
  CHECK ((lifecycle = 'REVOKED') = (revoked_at IS NOT NULL)),
  CHECK ((lifecycle = 'REAUTH_REQUIRED') = (reauth_required_at IS NOT NULL))
);

CREATE INDEX core_external_oauth_credential_bindings_workspace_idx
  ON core_external_oauth_credential_bindings(workspace_id, provider, lifecycle, credential_binding_id);

CREATE TABLE core_external_oauth_credential_secrets (
  credential_binding_id text PRIMARY KEY REFERENCES core_external_oauth_credential_bindings(credential_binding_id) ON DELETE CASCADE,
  secret_generation integer NOT NULL CHECK (secret_generation > 0),
  key_id text NOT NULL CHECK (btrim(key_id) <> ''),
  nonce_base64 text NOT NULL CHECK (btrim(nonce_base64) <> ''),
  ciphertext_base64 text NOT NULL CHECK (btrim(ciphertext_base64) <> ''),
  auth_tag_base64 text NOT NULL CHECK (btrim(auth_tag_base64) <> ''),
  updated_at timestamptz NOT NULL
);

COMMENT ON TABLE core_external_oauth_credential_bindings IS
  'Core/Identity-owned safe Workspace OAuth credential binding metadata. No token or provider secret material.';
COMMENT ON TABLE core_external_oauth_credential_secrets IS
  'Core/Identity-owned encrypted dynamic OAuth token material. Never exposed as business contract or evidence.';
COMMENT ON TABLE core_external_oauth_grant_attempts IS
  'Core/Identity-owned one-time OAuth state hashes and encrypted PKCE verifier. Raw state/code are never persisted.';
