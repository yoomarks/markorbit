-- MGSN Network Participation & Visibility V1 persistence foundation.
-- Intentionally DDL-only: existing Provider/Supply rows are not enrolled or granted visibility.

CREATE TABLE mgsn_network_participations (
  network_participation_id text NOT NULL CHECK (network_participation_id ~ '^network-participation_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  is_current boolean NOT NULL,
  workspace_id uuid NOT NULL,
  provider_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('ACTIVE','PAUSED','REVOKED')),
  authorization_reference text NOT NULL CHECK (length(btrim(authorization_reference)) > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (network_participation_id, version),
  FOREIGN KEY (provider_id, workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id)
);
CREATE UNIQUE INDEX mgsn_network_participations_current_id_idx
  ON mgsn_network_participations(network_participation_id)
  WHERE is_current;
CREATE UNIQUE INDEX mgsn_network_participations_current_provider_idx
  ON mgsn_network_participations(workspace_id, provider_id)
  WHERE is_current;
CREATE INDEX mgsn_network_participations_provider_history_idx
  ON mgsn_network_participations(workspace_id, provider_id, created_at DESC, version DESC);

CREATE OR REPLACE FUNCTION reject_mgsn_network_participation_revival()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM mgsn_network_participations
    WHERE network_participation_id = NEW.network_participation_id
      AND state = 'REVOKED'
  ) THEN
    RAISE EXCEPTION 'revoked network participation cannot be revived; create a fresh participation id'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mgsn_network_participations_no_revival
BEFORE INSERT ON mgsn_network_participations
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_network_participation_revival();

CREATE TABLE mgsn_network_visibility_policies (
  network_participation_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  participation_version integer NOT NULL CHECK (participation_version > 0),
  is_current boolean NOT NULL,
  scope text NOT NULL CHECK (scope IN ('PRIVATE','TRUSTED','BOUNDED_PUBLIC')),
  grants jsonb NOT NULL CHECK (jsonb_typeof(grants) = 'array'),
  authorization_reference text NOT NULL CHECK (length(btrim(authorization_reference)) > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (network_participation_id, version),
  FOREIGN KEY (network_participation_id, participation_version)
    REFERENCES mgsn_network_participations(network_participation_id, version),
  CHECK (
    (scope = 'PRIVATE' AND jsonb_array_length(grants) = 0)
    OR (scope IN ('TRUSTED','BOUNDED_PUBLIC') AND jsonb_array_length(grants) > 0)
  )
);
CREATE UNIQUE INDEX mgsn_network_visibility_policies_current_idx
  ON mgsn_network_visibility_policies(network_participation_id)
  WHERE is_current;
CREATE INDEX mgsn_network_visibility_policies_history_idx
  ON mgsn_network_visibility_policies(network_participation_id, created_at DESC, version DESC);

CREATE TABLE mgsn_network_participation_commands (
  scope_key text NOT NULL CHECK (length(btrim(scope_key)) > 0),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  command_type text NOT NULL CHECK (
    command_type IN ('OPT_IN','PAUSE','RESUME','REVOKE','REPLACE_VISIBILITY_POLICY')
  ),
  workspace_id uuid NOT NULL,
  provider_id text NOT NULL,
  network_participation_id text NOT NULL,
  response_participation_version integer NOT NULL CHECK (response_participation_version > 0),
  response_visibility_policy_version integer NOT NULL CHECK (response_visibility_policy_version > 0),
  response_record jsonb NOT NULL,
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  authorization_reference text NOT NULL CHECK (length(btrim(authorization_reference)) > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope_key, idempotency_key),
  FOREIGN KEY (provider_id, workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id),
  FOREIGN KEY (network_participation_id, response_participation_version)
    REFERENCES mgsn_network_participations(network_participation_id, version),
  FOREIGN KEY (network_participation_id, response_visibility_policy_version)
    REFERENCES mgsn_network_visibility_policies(network_participation_id, version)
);
CREATE INDEX mgsn_network_participation_commands_target_idx
  ON mgsn_network_participation_commands(workspace_id, provider_id, created_at DESC);

CREATE OR REPLACE FUNCTION reject_mgsn_network_participation_command_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_network_participation_commands is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_network_participation_commands_append_only
BEFORE UPDATE OR DELETE ON mgsn_network_participation_commands
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_network_participation_command_mutation();

CREATE TABLE mgsn_network_participation_audit (
  audit_id bigserial PRIMARY KEY,
  network_participation_id text NOT NULL,
  workspace_id uuid NOT NULL,
  provider_id text NOT NULL,
  action text NOT NULL CHECK (
    action IN (
      'PARTICIPATION_OPTED_IN',
      'PARTICIPATION_PAUSED',
      'PARTICIPATION_RESUMED',
      'PARTICIPATION_REVOKED',
      'VISIBILITY_POLICY_REPLACED'
    )
  ),
  previous_participation_state text CHECK (
    previous_participation_state IS NULL
    OR previous_participation_state IN ('ACTIVE','PAUSED','REVOKED')
  ),
  new_participation_state text NOT NULL CHECK (new_participation_state IN ('ACTIVE','PAUSED','REVOKED')),
  previous_participation_version integer CHECK (
    previous_participation_version IS NULL OR previous_participation_version > 0
  ),
  new_participation_version integer NOT NULL CHECK (new_participation_version > 0),
  previous_visibility_policy_version integer CHECK (
    previous_visibility_policy_version IS NULL OR previous_visibility_policy_version > 0
  ),
  new_visibility_policy_version integer NOT NULL CHECK (new_visibility_policy_version > 0),
  affected_data_classes text[] NOT NULL,
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  authority_reference text NOT NULL CHECK (length(btrim(authority_reference)) > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  FOREIGN KEY (provider_id, workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id),
  FOREIGN KEY (network_participation_id, new_participation_version)
    REFERENCES mgsn_network_participations(network_participation_id, version),
  FOREIGN KEY (network_participation_id, new_visibility_policy_version)
    REFERENCES mgsn_network_visibility_policies(network_participation_id, version)
);
CREATE INDEX mgsn_network_participation_audit_provider_idx
  ON mgsn_network_participation_audit(workspace_id, provider_id, created_at DESC, audit_id DESC);
CREATE INDEX mgsn_network_participation_audit_participation_idx
  ON mgsn_network_participation_audit(network_participation_id, created_at DESC, audit_id DESC);

CREATE OR REPLACE FUNCTION reject_mgsn_network_participation_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_network_participation_audit is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mgsn_network_participation_audit_append_only
BEFORE UPDATE OR DELETE ON mgsn_network_participation_audit
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_network_participation_audit_mutation();
