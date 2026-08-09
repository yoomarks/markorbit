CREATE TABLE mgsn_service_packages (
  service_package_id text PRIMARY KEY CHECK (service_package_id ~ '^service-package_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ADMITTED','STALE','CANCELLED')),
  execution_source_fingerprint_sha256 text NOT NULL CHECK (execution_source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  service_package_fingerprint_sha256 text NOT NULL CHECK (service_package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  jurisdiction text NOT NULL CHECK (length(btrim(jurisdiction)) > 0),
  service_type text NOT NULL CHECK (length(btrim(service_type)) > 0),
  source_record jsonb NOT NULL,
  service_package_record jsonb NOT NULL,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (workspace_id, execution_source_fingerprint_sha256)
);
CREATE INDEX mgsn_service_packages_workspace_created_idx
  ON mgsn_service_packages(workspace_id, created_at DESC, service_package_id);

CREATE TABLE mgsn_eligibility_evaluations (
  eligibility_evaluation_id text PRIMARY KEY CHECK (eligibility_evaluation_id ~ '^eligibility-evaluation_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  service_package_id text NOT NULL REFERENCES mgsn_service_packages(service_package_id),
  service_package_version integer NOT NULL CHECK (service_package_version > 0),
  service_package_fingerprint_sha256 text NOT NULL CHECK (service_package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  provider_id text NOT NULL REFERENCES mgsn_providers(provider_id),
  provider_version integer NOT NULL CHECK (provider_version > 0),
  provider_supply_capability_id text NOT NULL,
  provider_supply_capability_version integer NOT NULL CHECK (provider_supply_capability_version > 0),
  provider_supply_capability_fingerprint_sha256 text NOT NULL CHECK (provider_supply_capability_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  policy_version text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ELIGIBLE','INELIGIBLE')),
  checks jsonb NOT NULL,
  deterministic_fingerprint_sha256 text NOT NULL CHECK (deterministic_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  evaluation_record jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL,
  created_by text NOT NULL,
  FOREIGN KEY (provider_supply_capability_id, provider_supply_capability_version)
    REFERENCES mgsn_provider_supply_capabilities(provider_supply_capability_id, version)
);
CREATE INDEX mgsn_eligibility_evaluations_package_idx
  ON mgsn_eligibility_evaluations(service_package_id, evaluated_at DESC, eligibility_evaluation_id);
CREATE INDEX mgsn_eligibility_evaluations_provider_idx
  ON mgsn_eligibility_evaluations(provider_id, evaluated_at DESC);

CREATE TABLE mgsn_service_package_commands (
  scope_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  target_type text NOT NULL CHECK (target_type IN ('SERVICE_PACKAGE','ELIGIBILITY_EVALUATION')),
  target_id text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('SERVICE_PACKAGE_ADMIT','ELIGIBILITY_EVALUATE')),
  response_version integer NOT NULL CHECK (response_version > 0),
  response_record jsonb NOT NULL,
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope_key, idempotency_key)
);

CREATE TABLE mgsn_service_package_audit (
  audit_id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('SERVICE_PACKAGE','ELIGIBILITY_EVALUATION')),
  target_id text NOT NULL,
  action text NOT NULL,
  record_version integer NOT NULL CHECK (record_version > 0),
  actor_id text NOT NULL,
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL
);
CREATE INDEX mgsn_service_package_audit_workspace_created_idx
  ON mgsn_service_package_audit(workspace_id, created_at DESC, audit_id DESC);

CREATE OR REPLACE FUNCTION reject_mgsn_service_package_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mgsn_service_package_audit is append-only';
END;
$$;

CREATE TRIGGER mgsn_service_package_audit_append_only
BEFORE UPDATE OR DELETE ON mgsn_service_package_audit
FOR EACH ROW EXECUTE FUNCTION reject_mgsn_service_package_audit_mutation();
