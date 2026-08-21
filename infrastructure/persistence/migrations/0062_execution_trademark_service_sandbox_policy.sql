ALTER TABLE execution_trademark_service_sessions
  ADD COLUMN environment_policy_id text,
  ADD COLUMN execution_environment text CHECK (
    execution_environment IS NULL OR execution_environment IN ('LOCAL','CI','SANDBOX','PROVIDER_TEST')
  ),
  ADD COLUMN execution_mode text CHECK (
    execution_mode IS NULL OR execution_mode IN ('SIMULATED','TEST_CONNECTOR')
  ),
  ADD COLUMN sandbox_connector_class text CHECK (
    sandbox_connector_class IS NULL OR sandbox_connector_class IN ('SIMULATOR','PROVIDER_SANDBOX','AUTHORITY_TEST','PAYMENT_TEST')
  ),
  ADD COLUMN sandbox_endpoint_class text CHECK (
    sandbox_endpoint_class IS NULL OR sandbox_endpoint_class IN ('LOOPBACK','INTERNAL_TEST','ALLOWLISTED_SANDBOX')
  ),
  ADD COLUMN sandbox_credential_class text CHECK (
    sandbox_credential_class IS NULL OR sandbox_credential_class IN ('NONE','TEST_ONLY')
  ),
  ADD COLUMN environment_policy_record jsonb,
  ADD CONSTRAINT execution_trademark_service_environment_policy_complete CHECK (
    (environment_policy_record IS NULL AND environment_policy_id IS NULL AND execution_environment IS NULL
      AND execution_mode IS NULL AND sandbox_connector_class IS NULL AND sandbox_endpoint_class IS NULL
      AND sandbox_credential_class IS NULL)
    OR
    (environment_policy_record IS NOT NULL AND environment_policy_id IS NOT NULL AND execution_environment IS NOT NULL
      AND execution_mode IS NOT NULL AND sandbox_connector_class IS NOT NULL AND sandbox_endpoint_class IS NOT NULL
      AND sandbox_credential_class IS NOT NULL)
  ),
  ADD CONSTRAINT execution_trademark_service_environment_policy_unique
    UNIQUE (workspace_id, execution_authorization_id, environment_policy_id);

ALTER TABLE execution_trademark_service_protected_action_replays
  ADD COLUMN environment_policy_id text,
  ADD COLUMN execution_environment text CHECK (
    execution_environment IS NULL OR execution_environment IN ('LOCAL','CI','SANDBOX','PROVIDER_TEST')
  ),
  ADD COLUMN execution_mode text CHECK (
    execution_mode IS NULL OR execution_mode IN ('SIMULATED','TEST_CONNECTOR')
  ),
  ADD COLUMN sandbox_connector_class text CHECK (
    sandbox_connector_class IS NULL OR sandbox_connector_class IN ('SIMULATOR','PROVIDER_SANDBOX','AUTHORITY_TEST','PAYMENT_TEST')
  ),
  ADD COLUMN sandbox_endpoint_class text CHECK (
    sandbox_endpoint_class IS NULL OR sandbox_endpoint_class IN ('LOOPBACK','INTERNAL_TEST','ALLOWLISTED_SANDBOX')
  ),
  ADD COLUMN sandbox_credential_class text CHECK (
    sandbox_credential_class IS NULL OR sandbox_credential_class IN ('NONE','TEST_ONLY')
  ),
  ADD COLUMN environment_binding_record jsonb,
  ADD CONSTRAINT execution_trademark_service_environment_binding_complete CHECK (
    (environment_binding_record IS NULL AND environment_policy_id IS NULL AND execution_environment IS NULL
      AND execution_mode IS NULL AND sandbox_connector_class IS NULL AND sandbox_endpoint_class IS NULL
      AND sandbox_credential_class IS NULL)
    OR
    (environment_binding_record IS NOT NULL AND environment_policy_id IS NOT NULL AND execution_environment IS NOT NULL
      AND execution_mode IS NOT NULL AND sandbox_connector_class IS NOT NULL AND sandbox_endpoint_class IS NOT NULL
      AND sandbox_credential_class IS NOT NULL)
  ),
  ADD CONSTRAINT execution_trademark_service_environment_binding_policy_fk
    FOREIGN KEY (workspace_id, execution_authorization_id, environment_policy_id)
    REFERENCES execution_trademark_service_sessions
      (workspace_id, execution_authorization_id, environment_policy_id)
    ON DELETE RESTRICT;

CREATE INDEX execution_trademark_service_sessions_environment_idx
  ON execution_trademark_service_sessions (workspace_id, execution_environment, execution_mode)
  WHERE environment_policy_id IS NOT NULL;
