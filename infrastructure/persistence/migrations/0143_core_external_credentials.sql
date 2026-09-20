CREATE TABLE core_external_credential_bindings (
  credential_binding_id text PRIMARY KEY
    CHECK (credential_binding_id ~ '^external-credential-binding_[A-Za-z0-9._:-]+$'),
  version integer NOT NULL CHECK (version > 0),
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (btrim(provider) <> '' AND char_length(provider) <= 120),
  external_account_ref text NOT NULL
    CHECK (btrim(external_account_ref) <> '' AND char_length(external_account_ref) <= 500),
  secret_kind text NOT NULL CHECK (secret_kind IN ('API_KEY','STATIC_BEARER','BASIC')),
  allowed_capability_ids jsonb NOT NULL
    CHECK (jsonb_typeof(allowed_capability_ids) = 'array' AND jsonb_array_length(allowed_capability_ids) > 0),
  grantor_user_id uuid NOT NULL REFERENCES users(user_id),
  grantor_membership_id uuid NOT NULL REFERENCES workspace_memberships(membership_id),
  grantor_membership_version integer NOT NULL CHECK (grantor_membership_version > 0),
  lifecycle text NOT NULL CHECK (lifecycle IN ('ACTIVE','EXPIRED','REAUTH_REQUIRED','REVOKED')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expired_at timestamptz,
  reauth_required_at timestamptz,
  revoked_at timestamptz,
  CHECK (updated_at >= created_at),
  CHECK (
    (lifecycle='ACTIVE' AND expired_at IS NULL AND reauth_required_at IS NULL AND revoked_at IS NULL) OR
    (lifecycle='EXPIRED' AND expired_at IS NOT NULL AND reauth_required_at IS NULL AND revoked_at IS NULL) OR
    (lifecycle='REAUTH_REQUIRED' AND expired_at IS NULL AND reauth_required_at IS NOT NULL AND revoked_at IS NULL) OR
    (lifecycle='REVOKED' AND expired_at IS NULL AND reauth_required_at IS NULL AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX core_external_credential_bindings_workspace
  ON core_external_credential_bindings(workspace_id,provider,lifecycle,updated_at DESC);

CREATE TABLE core_external_credential_secrets (
  credential_binding_id text PRIMARY KEY
    REFERENCES core_external_credential_bindings(credential_binding_id) ON DELETE CASCADE,
  secret_generation integer NOT NULL CHECK (secret_generation > 0),
  key_id text NOT NULL CHECK (btrim(key_id) <> '' AND char_length(key_id) <= 120),
  nonce_base64 text NOT NULL CHECK (btrim(nonce_base64) <> ''),
  ciphertext_base64 text NOT NULL CHECK (btrim(ciphertext_base64) <> ''),
  auth_tag_base64 text NOT NULL CHECK (btrim(auth_tag_base64) <> ''),
  updated_at timestamptz NOT NULL
);

CREATE TABLE core_external_credential_audit_events (
  event_id text PRIMARY KEY
    CHECK (event_id ~ '^external-credential-audit_[A-Za-z0-9._:-]+$'),
  credential_binding_id text NOT NULL
    REFERENCES core_external_credential_bindings(credential_binding_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (btrim(provider) <> '' AND char_length(provider) <= 120),
  external_account_ref text NOT NULL
    CHECK (btrim(external_account_ref) <> '' AND char_length(external_account_ref) <= 500),
  secret_kind text NOT NULL CHECK (secret_kind IN ('API_KEY','STATIC_BEARER','BASIC')),
  action text NOT NULL
    CHECK (action IN ('CREATED','ROTATED','EXPIRED','REAUTH_REQUIRED','REVOKED','KEY_REWRAPPED')),
  from_version integer CHECK (from_version IS NULL OR from_version > 0),
  to_version integer NOT NULL CHECK (to_version > 0),
  actor_user_id uuid REFERENCES users(user_id),
  actor_membership_id uuid REFERENCES workspace_memberships(membership_id),
  occurred_at timestamptz NOT NULL,
  CHECK ((actor_user_id IS NULL) = (actor_membership_id IS NULL))
);

CREATE INDEX core_external_credential_audit_events_binding
  ON core_external_credential_audit_events(credential_binding_id,occurred_at,event_id);

CREATE OR REPLACE FUNCTION reject_core_external_credential_audit_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'core_external_credential_audit_events is immutable';
END;
$$;

CREATE TRIGGER core_external_credential_audit_events_immutable
BEFORE UPDATE OR DELETE ON core_external_credential_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_core_external_credential_audit_event_mutation();
