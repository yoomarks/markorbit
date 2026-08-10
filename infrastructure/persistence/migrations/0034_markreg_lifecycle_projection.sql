CREATE TABLE markreg_lifecycle_events (
 lifecycle_event_id text PRIMARY KEY CHECK (lifecycle_event_id ~ '^lifecycle-event_[A-Za-z0-9_-]+$'),
 workspace_id uuid NOT NULL,
 formal_matter_id text NOT NULL REFERENCES formal_matters(formal_matter_id),
 formal_matter_version text NOT NULL CHECK (char_length(formal_matter_version) BETWEEN 1 AND 100),
 version integer NOT NULL CHECK (version >= 1),
 reviewed_source_admission_id text NOT NULL CHECK (reviewed_source_admission_id ~ '^reviewed-source-admission_[A-Za-z0-9_-]+$'),
 reviewed_source_admission_version integer NOT NULL CHECK (reviewed_source_admission_version >= 1),
 admission_fingerprint_sha256 text NOT NULL CHECK (admission_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 source_provenance jsonb NOT NULL,
 state text NOT NULL CHECK (state IN ('INTERNAL_PROCESSING','REVIEWED_PROVIDER_EVIDENCE','CUSTOMER_ACTION_NEEDED','WAITING_NO_ACTION','CORRECTION_OR_REVIEW_ISSUE')),
 event_code text NOT NULL CHECK (char_length(event_code) BETWEEN 1 AND 200),
 customer_safe_label text NOT NULL CHECK (char_length(customer_safe_label) BETWEEN 1 AND 300),
 customer_safe_summary text NOT NULL CHECK (char_length(customer_safe_summary) BETWEEN 1 AND 2000),
 occurred_at timestamptz NOT NULL,
 projected_at timestamptz NOT NULL,
 lifecycle_event_fingerprint_sha256 text NOT NULL CHECK (lifecycle_event_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 official_status_verified boolean NOT NULL DEFAULT false CHECK (official_status_verified = false),
 correlation_id text NOT NULL CHECK (char_length(correlation_id) BETWEEN 1 AND 200),
 projection_request_fingerprint text NOT NULL CHECK (projection_request_fingerprint ~ '^[0-9a-f]{64}$'),
 UNIQUE(workspace_id,formal_matter_id,version),
 UNIQUE(workspace_id,reviewed_source_admission_id,reviewed_source_admission_version,admission_fingerprint_sha256)
);

CREATE INDEX markreg_lifecycle_events_workspace_matter_idx
 ON markreg_lifecycle_events(workspace_id,formal_matter_id,occurred_at ASC,lifecycle_event_id ASC);

CREATE TRIGGER markreg_lifecycle_events_append_only
 BEFORE UPDATE OR DELETE ON markreg_lifecycle_events
 FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();

CREATE TABLE markreg_lifecycle_views (
 lifecycle_view_id text PRIMARY KEY CHECK (lifecycle_view_id ~ '^lifecycle-view_[A-Za-z0-9_-]+$'),
 workspace_id uuid NOT NULL,
 formal_matter_id text NOT NULL REFERENCES formal_matters(formal_matter_id),
 formal_matter_version text NOT NULL CHECK (char_length(formal_matter_version) BETWEEN 1 AND 100),
 version integer NOT NULL CHECK (version >= 1),
 current_event_id text NOT NULL REFERENCES markreg_lifecycle_events(lifecycle_event_id),
 current_event_version integer NOT NULL CHECK (current_event_version >= 1),
 current_event_fingerprint_sha256 text NOT NULL CHECK (current_event_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK (state IN ('INTERNAL_PROCESSING','REVIEWED_PROVIDER_EVIDENCE','CUSTOMER_ACTION_NEEDED','WAITING_NO_ACTION','CORRECTION_OR_REVIEW_ISSUE')),
 customer_safe_label text NOT NULL CHECK (char_length(customer_safe_label) BETWEEN 1 AND 300),
 customer_safe_summary text NOT NULL CHECK (char_length(customer_safe_summary) BETWEEN 1 AND 2000),
 lifecycle_view_fingerprint_sha256 text NOT NULL CHECK (lifecycle_view_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 official_status_verified boolean NOT NULL DEFAULT false CHECK (official_status_verified = false),
 updated_at timestamptz NOT NULL,
 UNIQUE(workspace_id,formal_matter_id)
);

CREATE INDEX markreg_lifecycle_views_workspace_updated_idx
 ON markreg_lifecycle_views(workspace_id,updated_at DESC,formal_matter_id ASC);

CREATE TABLE markreg_lifecycle_commands (
 workspace_id uuid NOT NULL,
 idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
 request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
 lifecycle_event_id text NOT NULL REFERENCES markreg_lifecycle_events(lifecycle_event_id),
 result_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,idempotency_key)
);

CREATE INDEX markreg_lifecycle_commands_event_idx
 ON markreg_lifecycle_commands(workspace_id,lifecycle_event_id,created_at DESC);
