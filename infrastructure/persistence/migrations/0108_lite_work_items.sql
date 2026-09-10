CREATE TABLE lite_work_items (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  lite_work_item_id text NOT NULL CHECK (lite_work_item_id ~ '^lite-work-item_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  task_type text NOT NULL CHECK (task_type IN (
    'REPLY_PROVIDER','NOTIFY_CLIENT','PAYMENT_FOLLOW_UP','WAIT_FOR_PROVIDER','WAIT_FOR_CLIENT',
    'CHECK_DEADLINE','DOCUMENT_FOLLOW_UP','GENERAL_FOLLOW_UP','OTHER'
  )),
  status text NOT NULL CHECK (status IN (
    'OPEN','WAITING_FOR_CLIENT','WAITING_FOR_PROVIDER','COMPLETED','CANCELLED','ARCHIVED'
  )),
  priority text NOT NULL CHECK (priority IN ('INFO','NOTICE','IMPORTANT','URGENT')),
  assignee_principal_id text,
  source_class text NOT NULL CHECK (source_class IN ('MANUAL','SYSTEM_PREPARED')),
  internal_due_at timestamptz,
  remind_at timestamptz,
  follow_up_at timestamptz,
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, lite_work_item_id),
  CHECK (updated_at >= created_at)
);

CREATE INDEX lite_work_items_workspace_status
  ON lite_work_items(workspace_id, status, lite_work_item_id);

CREATE INDEX lite_work_items_workspace_assignee
  ON lite_work_items(workspace_id, assignee_principal_id, status, lite_work_item_id);

CREATE INDEX lite_work_items_workspace_operational_time
  ON lite_work_items(
    workspace_id,
    (COALESCE(LEAST(internal_due_at, follow_up_at, remind_at), 'infinity'::timestamptz)),
    created_at,
    lite_work_item_id
  );

CREATE TABLE lite_work_item_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500),
  command_type text NOT NULL CHECK (command_type IN (
    'CREATE_MANUAL','CREATE_SYSTEM_PREPARED','UPDATE_INTERNAL_FIELDS','TRANSITION_STATUS'
  )),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
