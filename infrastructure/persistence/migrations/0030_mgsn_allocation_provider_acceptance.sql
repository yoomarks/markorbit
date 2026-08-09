CREATE TABLE mgsn_allocations (
  allocation_id text NOT NULL CHECK (allocation_id ~ '^allocation_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  is_current boolean NOT NULL,
  workspace_id uuid NOT NULL,
  service_package_id text NOT NULL REFERENCES mgsn_service_packages(service_package_id),
  service_package_version integer NOT NULL CHECK (service_package_version > 0),
  service_package_fingerprint_sha256 text NOT NULL CHECK (service_package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  eligibility_evaluation_id text NOT NULL REFERENCES mgsn_eligibility_evaluations(eligibility_evaluation_id),
  eligibility_evaluation_version integer NOT NULL CHECK (eligibility_evaluation_version > 0),
  eligibility_fingerprint_sha256 text NOT NULL CHECK (eligibility_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  provider_id text NOT NULL REFERENCES mgsn_providers(provider_id),
  provider_version integer NOT NULL CHECK (provider_version > 0),
  provider_supply_capability_id text NOT NULL,
  provider_supply_capability_version integer NOT NULL CHECK (provider_supply_capability_version > 0),
  provider_supply_capability_fingerprint_sha256 text NOT NULL CHECK (provider_supply_capability_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  allocated_by text NOT NULL CHECK (length(btrim(allocated_by)) > 0),
  rationale text NOT NULL CHECK (length(btrim(rationale)) > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','CANCELLED','SUPERSEDED')),
  allocation_record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (allocation_id, version),
  FOREIGN KEY (provider_supply_capability_id, provider_supply_capability_version)
    REFERENCES mgsn_provider_supply_capabilities(provider_supply_capability_id, version)
);
CREATE UNIQUE INDEX mgsn_allocations_current_id_idx
  ON mgsn_allocations(allocation_id) WHERE is_current;
CREATE UNIQUE INDEX mgsn_allocations_one_active_package_idx
  ON mgsn_allocations(service_package_id) WHERE is_current AND status='ACTIVE';
CREATE INDEX mgsn_allocations_workspace_created_idx
  ON mgsn_allocations(workspace_id, created_at DESC, allocation_id);
CREATE INDEX mgsn_allocations_provider_created_idx
  ON mgsn_allocations(provider_id, created_at DESC, allocation_id);

CREATE TABLE mgsn_provider_acceptances (
  provider_acceptance_id text PRIMARY KEY CHECK (provider_acceptance_id ~ '^provider-acceptance_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  allocation_id text NOT NULL,
  allocation_version integer NOT NULL CHECK (allocation_version > 0),
  service_package_id text NOT NULL REFERENCES mgsn_service_packages(service_package_id),
  service_package_version integer NOT NULL CHECK (service_package_version > 0),
  provider_id text NOT NULL REFERENCES mgsn_providers(provider_id),
  provider_workspace_id uuid NOT NULL,
  provider_actor_id text NOT NULL CHECK (length(btrim(provider_actor_id)) > 0),
  decision text NOT NULL CHECK (decision IN ('ACCEPTED','DECLINED')),
  acknowledgement text NOT NULL CHECK (length(btrim(acknowledgement)) > 0),
  response_fingerprint_sha256 text NOT NULL CHECK (response_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  acceptance_record jsonb NOT NULL,
  responded_at timestamptz NOT NULL,
  UNIQUE (allocation_id),
  FOREIGN KEY (allocation_id, allocation_version)
    REFERENCES mgsn_allocations(allocation_id, version)
);
CREATE INDEX mgsn_provider_acceptances_workspace_responded_idx
  ON mgsn_provider_acceptances(workspace_id, responded_at DESC, provider_acceptance_id);
CREATE INDEX mgsn_provider_acceptances_provider_responded_idx
  ON mgsn_provider_acceptances(provider_id, responded_at DESC, provider_acceptance_id);

CREATE TABLE mgsn_allocation_commands (
  scope_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  target_type text NOT NULL CHECK (target_type IN ('ALLOCATION','PROVIDER_ACCEPTANCE')),
  target_id text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('ALLOCATE_PROVIDER','RESPOND_TO_ALLOCATION')),
  response_version integer NOT NULL CHECK (response_version > 0),
  response_record jsonb NOT NULL,
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope_key, idempotency_key)
);

CREATE TABLE mgsn_allocation_audit (
  audit_id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('ALLOCATION','PROVIDER_ACCEPTANCE')),
  target_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('PROVIDER_ALLOCATED','PROVIDER_ACCEPTED','PROVIDER_DECLINED','ALLOCATION_SUPERSEDED')),
  record_version integer NOT NULL CHECK (record_version > 0),
  actor_id text NOT NULL,
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL
);
CREATE INDEX mgsn_allocation_audit_workspace_created_idx
  ON mgsn_allocation_audit(workspace_id, created_at DESC, audit_id DESC);

CREATE OR REPLACE FUNCTION reject_mgsn_allocation_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_allocation_audit is append-only';
END;
$$;

CREATE TRIGGER mgsn_allocation_audit_append_only
BEFORE UPDATE OR DELETE ON mgsn_allocation_audit
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_allocation_audit_mutation();
