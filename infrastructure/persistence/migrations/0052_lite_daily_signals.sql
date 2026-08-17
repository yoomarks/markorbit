CREATE TABLE lite_daily_signals (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 daily_signal_id text NOT NULL CHECK (btrim(daily_signal_id) <> ''),
 version integer NOT NULL CHECK (version = 1),
 source_owner text NOT NULL CHECK (source_owner = 'CORE'),
 source_kind text NOT NULL CHECK (source_kind = 'KNOWLEDGE_READY_PACKAGE'),
 source_id text NOT NULL CHECK (btrim(source_id) <> ''),
 source_version text NOT NULL CHECK (btrim(source_version) <> ''),
 source_fingerprint_sha256 text NOT NULL CHECK (source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 daily_signal_fingerprint_sha256 text NOT NULL CHECK (daily_signal_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 observed_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, daily_signal_id, version),
 UNIQUE (workspace_id, source_owner, source_kind, source_id, source_version)
);

CREATE INDEX lite_daily_signals_recent
 ON lite_daily_signals(workspace_id, observed_at DESC, daily_signal_id ASC);

CREATE TABLE lite_daily_signal_commands (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 command_type text NOT NULL CHECK (command_type = 'IMPORT_KNOWLEDGE_SOURCE'),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);
