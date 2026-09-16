CREATE TABLE execution_protected_action_authorizations (
  workspace_id uuid NOT NULL,
  authorization_id text NOT NULL
    CHECK (authorization_id ~ '^protected-action-authorization_[A-Za-z0-9-]+$'),
  version integer NOT NULL CHECK (version = 1),
  action_kind text NOT NULL CHECK (action_kind = 'TRADING_LISTING_PUBLISH'),
  effect_fingerprint_sha256 text NOT NULL
    CHECK (effect_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  receipt_id uuid NOT NULL,
  receipt_version integer NOT NULL CHECK (receipt_version = 1),
  status text NOT NULL CHECK (status IN ('AUTHORIZED','REVOKED','EXPIRED')),
  authorization_record jsonb NOT NULL,
  authorized_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > authorized_at),
  last_validated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, authorization_id),
  UNIQUE (workspace_id, authorization_id, version)
);

CREATE INDEX execution_protected_action_authorizations_workspace_status_idx
  ON execution_protected_action_authorizations (workspace_id, status, expires_at);

CREATE TABLE execution_protected_action_releases (
  workspace_id uuid NOT NULL,
  release_id text NOT NULL
    CHECK (release_id ~ '^protected-action-release_[A-Za-z0-9-]+$'),
  version integer NOT NULL CHECK (version = 1),
  authorization_id text NOT NULL,
  authorization_version integer NOT NULL CHECK (authorization_version = 1),
  action_kind text NOT NULL CHECK (action_kind = 'TRADING_LISTING_PUBLISH'),
  effect_fingerprint_sha256 text NOT NULL
    CHECK (effect_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status = 'RELEASED_FOR_EXECUTION'),
  release_record jsonb NOT NULL,
  released_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, release_id),
  UNIQUE (workspace_id, authorization_id, authorization_version),
  FOREIGN KEY (workspace_id, authorization_id, authorization_version)
    REFERENCES execution_protected_action_authorizations (workspace_id, authorization_id, version)
    ON DELETE RESTRICT
);

CREATE TABLE execution_protected_action_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL
    CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 256),
  command_kind text NOT NULL CHECK (command_kind IN ('AUTHORIZE','RELEASE')),
  request_fingerprint_sha256 text NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION reject_execution_protected_action_release_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'execution_protected_action_releases is immutable';
END;
$$;

CREATE TRIGGER execution_protected_action_releases_immutable
BEFORE UPDATE OR DELETE ON execution_protected_action_releases
FOR EACH ROW EXECUTE FUNCTION reject_execution_protected_action_release_mutation();
