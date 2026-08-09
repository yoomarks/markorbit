CREATE TABLE mgsn_provider_returns (
  provider_return_id text NOT NULL CHECK (provider_return_id ~ '^provider-return_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  is_current boolean NOT NULL,
  workspace_id uuid NOT NULL,
  service_package_id text NOT NULL REFERENCES mgsn_service_packages(service_package_id),
  service_package_version integer NOT NULL CHECK (service_package_version > 0),
  allocation_id text NOT NULL,
  allocation_version integer NOT NULL CHECK (allocation_version > 0),
  provider_acceptance_id text NOT NULL REFERENCES mgsn_provider_acceptances(provider_acceptance_id),
  provider_acceptance_version integer NOT NULL CHECK (provider_acceptance_version > 0),
  provider_id text NOT NULL REFERENCES mgsn_providers(provider_id),
  provider_workspace_id uuid NOT NULL,
  provider_actor_id text NOT NULL CHECK (length(btrim(provider_actor_id)) > 0),
  work_status_claim text NOT NULL CHECK (length(btrim(work_status_claim)) > 0),
  return_fingerprint_sha256 text NOT NULL CHECK (return_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('CURRENT','SUPERSEDED')),
  supersedes_provider_return_id text,
  supersedes_version integer CHECK (supersedes_version IS NULL OR supersedes_version > 0),
  return_record jsonb NOT NULL,
  submitted_at timestamptz NOT NULL,
  PRIMARY KEY (provider_return_id, version),
  FOREIGN KEY (allocation_id, allocation_version)
    REFERENCES mgsn_allocations(allocation_id, version),
  CHECK (
    (supersedes_provider_return_id IS NULL AND supersedes_version IS NULL)
    OR (supersedes_provider_return_id IS NOT NULL AND supersedes_version IS NOT NULL)
  )
);
ALTER TABLE mgsn_provider_returns
  ADD CONSTRAINT mgsn_provider_returns_supersedes_fk
  FOREIGN KEY (supersedes_provider_return_id, supersedes_version)
  REFERENCES mgsn_provider_returns(provider_return_id, version);
CREATE UNIQUE INDEX mgsn_provider_returns_current_id_idx
  ON mgsn_provider_returns(provider_return_id) WHERE is_current;
CREATE UNIQUE INDEX mgsn_provider_returns_current_allocation_idx
  ON mgsn_provider_returns(allocation_id) WHERE is_current AND status='CURRENT';
CREATE INDEX mgsn_provider_returns_workspace_submitted_idx
  ON mgsn_provider_returns(workspace_id, submitted_at DESC, provider_return_id);
CREATE INDEX mgsn_provider_returns_provider_submitted_idx
  ON mgsn_provider_returns(provider_id, submitted_at DESC, provider_return_id);

CREATE TABLE mgsn_provider_return_commands (
  scope_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  provider_return_id text NOT NULL,
  response_version integer NOT NULL CHECK (response_version > 0),
  response_record jsonb NOT NULL,
  provider_actor_id text NOT NULL CHECK (length(btrim(provider_actor_id)) > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope_key, idempotency_key)
);

CREATE TABLE mgsn_provider_return_audit (
  audit_id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL,
  provider_return_id text NOT NULL,
  record_version integer NOT NULL CHECK (record_version > 0),
  action text NOT NULL CHECK (action IN ('PROVIDER_RETURN_CREATED','PROVIDER_RETURN_CORRECTED')),
  provider_actor_id text NOT NULL CHECK (length(btrim(provider_actor_id)) > 0),
  return_fingerprint_sha256 text NOT NULL CHECK (return_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL
);
CREATE INDEX mgsn_provider_return_audit_workspace_created_idx
  ON mgsn_provider_return_audit(workspace_id, created_at DESC, audit_id DESC);

CREATE OR REPLACE FUNCTION reject_mgsn_provider_return_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_return_audit is append-only';
END;
$$;

CREATE TRIGGER mgsn_provider_return_audit_append_only
BEFORE UPDATE OR DELETE ON mgsn_provider_return_audit
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_return_audit_mutation();
