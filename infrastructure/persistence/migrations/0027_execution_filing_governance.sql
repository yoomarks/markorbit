CREATE TABLE filing_authorizations (
  filing_authorization_id text PRIMARY KEY CHECK (filing_authorization_id ~ '^filing-authorization_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  preparation_lock_id text NOT NULL,
  preparation_lock_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','PENDING_CONFIRMATION','AUTHORIZED','WITHDRAWN','STALE','EXPIRED')),
  version integer NOT NULL CHECK (version > 0),
  authorization jsonb NOT NULL,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (workspace_id, filing_authorization_id)
);
CREATE INDEX filing_authorizations_workspace_updated_idx
  ON filing_authorizations(workspace_id, updated_at DESC);
CREATE UNIQUE INDEX filing_authorizations_active_source_idx
  ON filing_authorizations(workspace_id, preparation_lock_id, preparation_lock_version)
  WHERE status NOT IN ('WITHDRAWN','STALE','EXPIRED');

CREATE TABLE execution_releases (
  execution_release_id text PRIMARY KEY CHECK (execution_release_id ~ '^execution-release_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  filing_authorization_id text NOT NULL,
  filing_authorization_version integer NOT NULL CHECK (filing_authorization_version > 0),
  status text NOT NULL CHECK (status IN ('DRAFT','BLOCKED','READY_FOR_RELEASE','RELEASED_FOR_EXECUTION','STALE','WITHDRAWN')),
  version integer NOT NULL CHECK (version > 0),
  release_record jsonb NOT NULL,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (workspace_id, execution_release_id),
  FOREIGN KEY (workspace_id, filing_authorization_id)
    REFERENCES filing_authorizations(workspace_id, filing_authorization_id)
);
CREATE INDEX execution_releases_workspace_updated_idx
  ON execution_releases(workspace_id, updated_at DESC);
CREATE UNIQUE INDEX execution_releases_active_authorization_idx
  ON execution_releases(workspace_id, filing_authorization_id, filing_authorization_version)
  WHERE status NOT IN ('WITHDRAWN','STALE','RELEASED_FOR_EXECUTION');

CREATE TABLE filing_execution_task_drafts (
  filing_execution_task_draft_id text PRIMARY KEY CHECK (filing_execution_task_draft_id ~ '^filing-task-draft_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  execution_release_id text NOT NULL,
  filing_authorization_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('PREPARED','CANCELLED','STALE')),
  task_record jsonb NOT NULL,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (workspace_id, execution_release_id),
  UNIQUE (workspace_id, filing_execution_task_draft_id),
  FOREIGN KEY (workspace_id, execution_release_id)
    REFERENCES execution_releases(workspace_id, execution_release_id),
  FOREIGN KEY (workspace_id, filing_authorization_id)
    REFERENCES filing_authorizations(workspace_id, filing_authorization_id)
);
CREATE INDEX filing_execution_task_drafts_workspace_updated_idx
  ON filing_execution_task_drafts(workspace_id, updated_at DESC);

CREATE TABLE filing_governance_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  target_type text NOT NULL CHECK (target_type IN ('FILING_AUTHORIZATION','EXECUTION_RELEASE')),
  target_id text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('AUTHORIZATION_CREATE','AUTHORIZATION_CONFIRM','RELEASE_CREATE','RELEASE_DECISION')),
  response_version integer NOT NULL CHECK (response_version > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE TABLE filing_governance_audit (
  audit_id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('FILING_AUTHORIZATION','EXECUTION_RELEASE','FILING_EXECUTION_TASK_DRAFT')),
  target_id text NOT NULL,
  action text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS','DENIED')),
  record_version integer,
  actor_id text NOT NULL,
  reason_code text,
  correlation_id text,
  source_fingerprint text CHECK (source_fingerprint IS NULL OR source_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL
);
CREATE INDEX filing_governance_audit_workspace_created_idx
  ON filing_governance_audit(workspace_id, created_at DESC, audit_id DESC);

CREATE OR REPLACE FUNCTION reject_filing_governance_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'filing_governance_audit is append-only';
END;
$$;

CREATE TRIGGER filing_governance_audit_append_only
BEFORE UPDATE OR DELETE ON filing_governance_audit
FOR EACH ROW EXECUTE FUNCTION reject_filing_governance_audit_mutation();
