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

CREATE OR REPLACE FUNCTION enforce_execution_trademark_service_sandbox_binding()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  session_policy_id text;
  session_environment text;
  session_mode text;
  session_connector_class text;
  session_endpoint_class text;
  session_credential_class text;
BEGIN
  SELECT environment_policy_id, execution_environment, execution_mode, sandbox_connector_class,
         sandbox_endpoint_class, sandbox_credential_class
    INTO session_policy_id, session_environment, session_mode, session_connector_class,
         session_endpoint_class, session_credential_class
    FROM execution_trademark_service_sessions
   WHERE workspace_id = NEW.workspace_id
     AND execution_authorization_id = NEW.execution_authorization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution authorization does not exist for protected action replay'
      USING ERRCODE = '23503';
  END IF;

  IF session_policy_id IS NULL THEN
    IF NEW.environment_policy_id IS NOT NULL OR NEW.environment_binding_record IS NOT NULL THEN
      RAISE EXCEPTION 'Protected action cannot introduce an environment policy that is absent from its session'
        USING ERRCODE = '23514',
              CONSTRAINT = 'execution_trademark_service_sandbox_binding_guard';
    END IF;
  ELSE
    IF NEW.environment_binding_record IS NULL
       OR NEW.environment_policy_id IS DISTINCT FROM session_policy_id
       OR NEW.execution_environment IS DISTINCT FROM session_environment
       OR NEW.execution_mode IS DISTINCT FROM session_mode
       OR NEW.sandbox_connector_class IS DISTINCT FROM session_connector_class
       OR NEW.sandbox_endpoint_class IS DISTINCT FROM session_endpoint_class
       OR NEW.sandbox_credential_class IS DISTINCT FROM session_credential_class THEN
      RAISE EXCEPTION 'Protected action sandbox binding must exactly match the durable execution environment policy'
        USING ERRCODE = '23514',
              CONSTRAINT = 'execution_trademark_service_sandbox_binding_guard';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER execution_trademark_service_sandbox_binding_guard
  BEFORE INSERT OR UPDATE ON execution_trademark_service_protected_action_replays
  FOR EACH ROW EXECUTE FUNCTION enforce_execution_trademark_service_sandbox_binding();
