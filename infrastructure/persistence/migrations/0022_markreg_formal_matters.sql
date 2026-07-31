CREATE TABLE formal_matters (
 formal_matter_id text PRIMARY KEY CHECK (formal_matter_id ~ '^formal-matter_[A-Za-z0-9_-]+$'), workspace_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind='TRADEMARK_REGISTRATION'), status text NOT NULL CHECK (status='OPEN'), version integer NOT NULL CHECK(version=1),
 source_customer_confirmation_id text NOT NULL, source_customer_confirmation_version integer NOT NULL,
 source_matter_draft_id text NOT NULL, source_matter_draft_version integer NOT NULL, source_quote_id text NOT NULL, source_quote_version text NOT NULL,
 source_snapshot jsonb NOT NULL, snapshot_schema_version integer NOT NULL CHECK(snapshot_schema_version=1), snapshot_sha256 text NOT NULL CHECK(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 created_by_user_id text NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 UNIQUE(workspace_id, source_matter_draft_id, source_matter_draft_version)
);
CREATE INDEX formal_matters_workspace_created_idx ON formal_matters(workspace_id, created_at DESC);
CREATE TABLE formal_matter_commands (workspace_id uuid NOT NULL, idempotency_key text NOT NULL, request_fingerprint text NOT NULL, formal_matter_id text NOT NULL REFERENCES formal_matters(formal_matter_id), created_at timestamptz NOT NULL, PRIMARY KEY(workspace_id,idempotency_key));
CREATE TABLE formal_matter_audit (audit_id bigserial PRIMARY KEY, workspace_id uuid NOT NULL, formal_matter_id text NOT NULL REFERENCES formal_matters(formal_matter_id), action text NOT NULL CHECK(action='FORMAL_MATTER_CREATED'), actor_id text NOT NULL, correlation_id text, created_at timestamptz NOT NULL);
