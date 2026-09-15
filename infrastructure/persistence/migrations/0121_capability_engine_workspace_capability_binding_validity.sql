CREATE TABLE IF NOT EXISTS capability_workspace_capability_binding_revocations (
  workspace_id uuid NOT NULL,
  revocation_id text NOT NULL,
  binding_id text NOT NULL,
  binding_fingerprint_sha256 char(64) NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  identity_fingerprint_sha256 char(64) NOT NULL,
  document_fingerprint_sha256 char(64) NOT NULL,
  document_json jsonb NOT NULL,
  revoked_at timestamptz NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (workspace_id, binding_id),
  UNIQUE (revocation_id),
  CONSTRAINT capability_workspace_binding_revocations_binding_v1
    CHECK (binding_id ~ '^workspace-capability-binding_[0-9a-f]{64}$'),
  CONSTRAINT capability_workspace_binding_revocations_id_v1
    CHECK (revocation_id ~ '^workspace-capability-binding-revocation_[0-9a-f]{64}$'),
  CONSTRAINT capability_workspace_binding_revocations_hashes_v1
    CHECK (binding_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
      AND identity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
      AND document_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT capability_workspace_binding_revocations_json_v1
    CHECK (jsonb_typeof(document_json) = 'object')
);

CREATE TABLE IF NOT EXISTS capability_workspace_capability_binding_validity_observations (
  workspace_id uuid NOT NULL,
  observation_id text NOT NULL,
  binding_id text NOT NULL,
  binding_fingerprint_sha256 char(64) NOT NULL,
  status text NOT NULL CHECK (status IN (
    'CURRENT','REVOKED','BLOCKED_BY_EVIDENCE_CURRENTNESS',
    'BINDING_POLICY_NO_LONGER_MATCHES','TARGET_CAPABILITY_SUPERSEDED',
    'TARGET_CAPABILITY_MISSING','CURRENTNESS_UNAVAILABLE','INTEGRITY_FAILURE'
  )),
  usable boolean NOT NULL,
  reason_code text NOT NULL,
  identity_fingerprint_sha256 char(64) NOT NULL,
  document_fingerprint_sha256 char(64) NOT NULL,
  document_json jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (observation_id),
  CONSTRAINT capability_workspace_binding_validity_binding_v1
    CHECK (binding_id ~ '^workspace-capability-binding_[0-9a-f]{64}$'),
  CONSTRAINT capability_workspace_binding_validity_id_v1
    CHECK (observation_id ~ '^workspace-capability-binding-validity_[0-9a-f]{64}$'),
  CONSTRAINT capability_workspace_binding_validity_hashes_v1
    CHECK (binding_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
      AND identity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
      AND document_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT capability_workspace_binding_validity_json_v1
    CHECK (jsonb_typeof(document_json) = 'object'),
  CONSTRAINT capability_workspace_binding_validity_usable_v1
    CHECK (usable = (status = 'CURRENT'))
);

CREATE INDEX IF NOT EXISTS capability_workspace_binding_validity_history_idx
  ON capability_workspace_capability_binding_validity_observations
  (workspace_id, binding_id, evaluated_at DESC, stored_at DESC);

CREATE OR REPLACE FUNCTION reject_workspace_capability_binding_validity_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Workspace Capability binding validity facts are append-only'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS capability_workspace_binding_revocations_append_only
  ON capability_workspace_capability_binding_revocations;
CREATE TRIGGER capability_workspace_binding_revocations_append_only
  BEFORE UPDATE OR DELETE ON capability_workspace_capability_binding_revocations
  FOR EACH ROW EXECUTE FUNCTION reject_workspace_capability_binding_validity_mutation();

DROP TRIGGER IF EXISTS capability_workspace_binding_validity_append_only
  ON capability_workspace_capability_binding_validity_observations;
CREATE TRIGGER capability_workspace_binding_validity_append_only
  BEFORE UPDATE OR DELETE ON capability_workspace_capability_binding_validity_observations
  FOR EACH ROW EXECUTE FUNCTION reject_workspace_capability_binding_validity_mutation();

COMMENT ON TABLE capability_workspace_capability_binding_revocations IS
  'Immutable explicit revocations of current usability for historical Workspace Capability bindings. Revocation does not mutate the binding or grant execution authority.';

COMMENT ON TABLE capability_workspace_capability_binding_validity_observations IS
  'Immutable revalidation observations for historical Workspace Capability bindings across Brain, Runtime, policy, Knowledge currentness, and explicit revocation truth.';
