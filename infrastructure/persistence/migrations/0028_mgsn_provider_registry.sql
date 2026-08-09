CREATE TABLE mgsn_providers (
  provider_id text PRIMARY KEY CHECK (provider_id ~ '^provider_[A-Za-z0-9_-]+$'),
  provider_workspace_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  operational_status text NOT NULL CHECK (operational_status IN ('ACTIVE','SUSPENDED','INACTIVE')),
  version integer NOT NULL CHECK (version > 0),
  provider_record jsonb NOT NULL,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (provider_id, provider_workspace_id)
);
CREATE INDEX mgsn_providers_status_updated_idx
  ON mgsn_providers(operational_status, updated_at DESC);

CREATE TABLE mgsn_provider_supply_capabilities (
  provider_supply_capability_id text NOT NULL CHECK (provider_supply_capability_id ~ '^provider-supply-capability_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  provider_id text NOT NULL,
  provider_workspace_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','RETIRED')),
  jurisdictions text[] NOT NULL CHECK (cardinality(jurisdictions) > 0),
  service_types text[] NOT NULL CHECK (cardinality(service_types) > 0),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  capacity_units integer NOT NULL CHECK (capacity_units >= 0),
  availability_units integer NOT NULL CHECK (availability_units >= 0 AND availability_units <= capacity_units),
  verification_state text NOT NULL CHECK (verification_state IN ('UNVERIFIED','EVIDENCE_RECORDED','VERIFIED_FOR_SUPPLY')),
  evidence_references jsonb NOT NULL,
  source_fingerprint_sha256 text NOT NULL CHECK (source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  capability_record jsonb NOT NULL,
  is_current boolean NOT NULL,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (provider_supply_capability_id, version),
  FOREIGN KEY (provider_id, provider_workspace_id)
    REFERENCES mgsn_providers(provider_id, provider_workspace_id),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE UNIQUE INDEX mgsn_provider_supply_capabilities_current_idx
  ON mgsn_provider_supply_capabilities(provider_supply_capability_id)
  WHERE is_current;
CREATE INDEX mgsn_provider_supply_capabilities_provider_idx
  ON mgsn_provider_supply_capabilities(provider_id, is_current, updated_at DESC);

CREATE TABLE mgsn_provider_registry_commands (
  scope_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  target_type text NOT NULL CHECK (target_type IN ('PROVIDER','SUPPLY_CAPABILITY')),
  target_id text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('PROVIDER_CREATE','PROVIDER_STATUS','SUPPLY_CREATE','SUPPLY_REVISE')),
  response_version integer NOT NULL CHECK (response_version > 0),
  response_record jsonb NOT NULL,
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope_key, idempotency_key)
);

CREATE TABLE mgsn_provider_registry_audit (
  audit_id bigserial PRIMARY KEY,
  provider_workspace_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('PROVIDER','SUPPLY_CAPABILITY')),
  target_id text NOT NULL,
  action text NOT NULL,
  record_version integer NOT NULL CHECK (record_version > 0),
  actor_id text NOT NULL,
  source_fingerprint text CHECK (source_fingerprint IS NULL OR source_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL
);
CREATE INDEX mgsn_provider_registry_audit_workspace_created_idx
  ON mgsn_provider_registry_audit(provider_workspace_id, created_at DESC, audit_id DESC);

CREATE OR REPLACE FUNCTION reject_mgsn_provider_registry_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_provider_registry_audit is append-only';
END;
$$;

CREATE TRIGGER mgsn_provider_registry_audit_append_only
BEFORE UPDATE OR DELETE ON mgsn_provider_registry_audit
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_provider_registry_audit_mutation();