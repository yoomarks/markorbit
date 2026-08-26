CREATE TABLE markreg_knowledge_case_promotions (
 producer_promotion_ref text PRIMARY KEY CHECK (producer_promotion_ref ~ '^markreg:case-promotion:v1:[0-9a-f]{64}$'),
 workspace_id uuid NOT NULL,
 source_identity_sha256 text NOT NULL CHECK (source_identity_sha256 ~ '^[0-9a-f]{64}$'),
 source_matter_id text NOT NULL REFERENCES formal_matters(formal_matter_id),
 source_matter_version integer NOT NULL CHECK (source_matter_version >= 1),
 source_snapshot_sha256 text NOT NULL CHECK (source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 candidate_id text NOT NULL UNIQUE CHECK (candidate_id ~ '^case-candidate_[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$'),
 candidate_json jsonb NOT NULL,
 state text NOT NULL CHECK (state IN ('CLAIMED','DISPATCHING','COMPLETED','RECONCILIATION_REQUIRED')),
 receipt_json jsonb,
 reconciliation_reason text,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 dispatched_at timestamptz,
 completed_at timestamptz,
 UNIQUE(workspace_id, source_identity_sha256),
 CHECK (updated_at >= created_at),
 CHECK ((state = 'COMPLETED') = (receipt_json IS NOT NULL)),
 CHECK ((state = 'COMPLETED') = (completed_at IS NOT NULL)),
 CHECK (state <> 'CLAIMED' OR dispatched_at IS NULL),
 CHECK (state NOT IN ('DISPATCHING','COMPLETED','RECONCILIATION_REQUIRED') OR dispatched_at IS NOT NULL),
 CHECK ((state = 'RECONCILIATION_REQUIRED') = (reconciliation_reason IS NOT NULL)),
 CHECK (reconciliation_reason IS NULL OR btrim(reconciliation_reason) <> '')
);

CREATE INDEX markreg_knowledge_case_promotions_workspace_state_idx
 ON markreg_knowledge_case_promotions(workspace_id, state, updated_at);

CREATE TABLE markreg_knowledge_case_promotion_commands (
 workspace_id uuid NOT NULL,
 idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 producer_promotion_ref text NOT NULL REFERENCES markreg_knowledge_case_promotions(producer_promotion_ref),
 created_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id, idempotency_key)
);

CREATE INDEX markreg_knowledge_case_promotion_commands_ref_idx
 ON markreg_knowledge_case_promotion_commands(producer_promotion_ref);
