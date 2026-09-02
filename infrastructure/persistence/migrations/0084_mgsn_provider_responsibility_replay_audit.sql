-- Durable replay and semantic owner-audit persistence for Provider Responsibility.
-- Historical persistence only: these rows do not create current Provider usability,
-- downstream handoff/allocation authority, filing/payment authority, or Official Truth.

CREATE TABLE mgsn_provider_responsibility_command_replays (
  scope_key text NOT NULL CHECK (length(btrim(scope_key)) > 0),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  request_fingerprint_sha256 text NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  command_type text NOT NULL CHECK (
    command_type IN (
      'CREATE',
      'REVISE',
      'SUSPEND',
      'RESUME',
      'REVOKE',
      'VERIFY',
      'REVALIDATE_CURRENT_AUTHORITY'
    )
  ),
  provider_id text NOT NULL,
  provider_workspace_id uuid NOT NULL,
  response_provider_responsibility_profile_id text NOT NULL,
  response_profile_version integer NOT NULL CHECK (response_profile_version > 0),
  response_record jsonb NOT NULL CHECK (jsonb_typeof(response_record) = 'object'),
  actor_reference text NOT NULL CHECK (length(btrim(actor_reference)) > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope_key, idempotency_key),
  FOREIGN KEY (provider_id, provider_workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id),
  FOREIGN KEY (
    response_provider_responsibility_profile_id,
    response_profile_version,
    provider_id,
    provider_workspace_id
  ) REFERENCES mgsn_provider_responsibility_profiles(
    provider_responsibility_profile_id,
    version,
    provider_id,
    provider_workspace_id
  )
);

CREATE INDEX mgsn_provider_responsibility_command_replays_response_idx
  ON mgsn_provider_responsibility_command_replays(
    provider_workspace_id,
    provider_id,
    response_provider_responsibility_profile_id,
    response_profile_version
  );

CREATE INDEX mgsn_provider_responsibility_command_replays_created_idx
  ON mgsn_provider_responsibility_command_replays(created_at DESC);

CREATE TABLE mgsn_provider_responsibility_owner_audit_events (
  audit_id bigserial PRIMARY KEY,
  provider_responsibility_profile_id text NOT NULL,
  provider_id text NOT NULL,
  provider_workspace_id uuid NOT NULL,
  previous_version integer CHECK (previous_version IS NULL OR previous_version > 0),
  new_version integer NOT NULL CHECK (new_version > 0),
  action text NOT NULL CHECK (
    action IN (
      'CREATED',
      'REVISED',
      'SUSPENDED',
      'RESUMED',
      'REVOKED',
      'VERIFICATION_RECORDED',
      'VERIFICATION_CORRECTED',
      'CURRENT_AUTHORITY_REVALIDATED',
      'DISPUTE_RECORDED',
      'VIOLATION_RECORDED'
    )
  ),
  actor_reference text NOT NULL CHECK (length(btrim(actor_reference)) > 0),
  request_fingerprint_sha256 text NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  occurred_at timestamptz NOT NULL,
  FOREIGN KEY (provider_id, provider_workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id),
  FOREIGN KEY (
    provider_responsibility_profile_id,
    new_version,
    provider_id,
    provider_workspace_id
  ) REFERENCES mgsn_provider_responsibility_profiles(
    provider_responsibility_profile_id,
    version,
    provider_id,
    provider_workspace_id
  ),
  FOREIGN KEY (provider_responsibility_profile_id, previous_version)
    REFERENCES mgsn_provider_responsibility_profiles(
      provider_responsibility_profile_id,
      version
    ),
  CHECK (
    (action = 'CREATED' AND previous_version IS NULL AND new_version = 1)
    OR (action <> 'CREATED' AND previous_version IS NOT NULL AND new_version > previous_version)
  )
);

CREATE INDEX mgsn_provider_responsibility_owner_audit_profile_idx
  ON mgsn_provider_responsibility_owner_audit_events(
    provider_responsibility_profile_id,
    occurred_at ASC,
    audit_id ASC
  );

CREATE INDEX mgsn_provider_responsibility_owner_audit_provider_idx
  ON mgsn_provider_responsibility_owner_audit_events(
    provider_workspace_id,
    provider_id,
    occurred_at DESC,
    audit_id DESC
  );

CREATE OR REPLACE FUNCTION reject_mgsn_provider_responsibility_replay_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_responsibility_command_replays is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_responsibility_command_replays_append_only
BEFORE UPDATE OR DELETE ON mgsn_provider_responsibility_command_replays
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_responsibility_replay_mutation();

CREATE OR REPLACE FUNCTION reject_mgsn_provider_responsibility_owner_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_responsibility_owner_audit_events is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_provider_responsibility_owner_audit_events_append_only
BEFORE UPDATE OR DELETE ON mgsn_provider_responsibility_owner_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_responsibility_owner_audit_mutation();
