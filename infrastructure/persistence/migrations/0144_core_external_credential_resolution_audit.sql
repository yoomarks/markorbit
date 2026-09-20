CREATE TABLE core_external_credential_resolution_audit_events (
  event_id text PRIMARY KEY
    CHECK (event_id ~ '^external-credential-resolution-audit_[A-Za-z0-9._:-]+$'),
  credential_binding_id text NOT NULL
    CHECK (credential_binding_id ~ '^external-credential-binding_[A-Za-z0-9._:-]+$'),
  workspace_id uuid NOT NULL,
  provider text NOT NULL CHECK (btrim(provider) <> '' AND char_length(provider) <= 120),
  external_account_ref text NOT NULL
    CHECK (btrim(external_account_ref) <> '' AND char_length(external_account_ref) <= 500),
  secret_kind text NOT NULL CHECK (secret_kind IN ('API_KEY','STATIC_BEARER','BASIC')),
  caller_service text NOT NULL CHECK (caller_service = 'CAPABILITY_ENGINE'),
  capability_id text NOT NULL CHECK (btrim(capability_id) <> '' AND char_length(capability_id) <= 200),
  capability_version text NOT NULL
    CHECK (btrim(capability_version) <> '' AND char_length(capability_version) <= 120),
  implementation_profile_id text NOT NULL
    CHECK (btrim(implementation_profile_id) <> '' AND char_length(implementation_profile_id) <= 240),
  implementation_profile_version integer NOT NULL CHECK (implementation_profile_version > 0),
  approved_usage text NOT NULL
    CHECK (approved_usage = 'APPROVED_PROVIDER_ADAPTER_AUTHENTICATION'),
  correlation_id text NOT NULL
    CHECK (btrim(correlation_id) <> '' AND char_length(correlation_id) <= 240),
  outcome text NOT NULL CHECK (outcome IN ('ALLOW','DENY')),
  reason text NOT NULL CHECK (btrim(reason) <> '' AND char_length(reason) <= 120),
  occurred_at timestamptz NOT NULL
);

CREATE INDEX core_external_credential_resolution_audit_binding
  ON core_external_credential_resolution_audit_events(credential_binding_id,occurred_at,event_id);

CREATE INDEX core_external_credential_resolution_audit_correlation
  ON core_external_credential_resolution_audit_events(correlation_id,occurred_at,event_id);

CREATE TRIGGER core_external_credential_resolution_audit_events_immutable
BEFORE UPDATE OR DELETE ON core_external_credential_resolution_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_core_external_credential_audit_event_mutation();
