CREATE TABLE professional_review_cases (
 professional_review_case_id text PRIMARY KEY CHECK (professional_review_case_id ~ '^professional-review_[A-Za-z0-9_-]+$'),
 workspace_id uuid NOT NULL,
 formal_matter_id text NOT NULL,
 source_formal_matter_version integer NOT NULL CHECK (source_formal_matter_version > 0),
 source_snapshot_sha256 text NOT NULL CHECK (source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 status text NOT NULL CHECK (status IN ('QUEUED','IN_REVIEW','NEEDS_INFORMATION','REVIEWED_READY_FOR_NEXT_STEP','STALE','WITHDRAWN')),
 version integer NOT NULL CHECK (version > 0),
 review_case jsonb NOT NULL,
 created_by text NOT NULL, updated_by text NOT NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 completed_at timestamptz, completed_by text,
 UNIQUE (workspace_id, formal_matter_id)
);
CREATE INDEX professional_review_cases_workspace_updated_idx ON professional_review_cases(workspace_id, updated_at DESC);

CREATE TABLE professional_review_commands (
 workspace_id uuid NOT NULL, idempotency_key text NOT NULL, request_fingerprint text NOT NULL,
 professional_review_case_id text NOT NULL REFERENCES professional_review_cases(professional_review_case_id),
 command_type text NOT NULL CHECK (command_type IN ('CREATE_OR_OPEN','COMPLETE')),
 response_version integer NOT NULL, created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE TABLE professional_review_audit (
 audit_id bigserial PRIMARY KEY, workspace_id uuid NOT NULL,
 professional_review_case_id text NOT NULL REFERENCES professional_review_cases(professional_review_case_id),
 action text NOT NULL CHECK (action IN ('REVIEW_OPENED','REVIEW_DRAFT_UPDATED','REVIEW_COMPLETED')),
 review_version integer NOT NULL, actor_id text NOT NULL, correlation_id text, created_at timestamptz NOT NULL
);
