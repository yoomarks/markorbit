CREATE TABLE lite_today_recommendations (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 today_recommendation_id text NOT NULL CHECK (btrim(today_recommendation_id) <> ''),
 version integer NOT NULL CHECK (version >= 1),
 recommendation_fingerprint_sha256 text NOT NULL CHECK (recommendation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, today_recommendation_id, version)
);

CREATE TABLE lite_content_opportunities (
 workspace_id uuid NOT NULL,
 content_opportunity_id text NOT NULL CHECK (btrim(content_opportunity_id) <> ''),
 version integer NOT NULL CHECK (version >= 1),
 source_recommendation_id text NOT NULL,
 source_recommendation_version integer NOT NULL CHECK (source_recommendation_version >= 1),
 content_opportunity_fingerprint_sha256 text NOT NULL CHECK (content_opportunity_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, content_opportunity_id, version),
 UNIQUE (workspace_id, source_recommendation_id, source_recommendation_version),
 FOREIGN KEY (workspace_id, source_recommendation_id, source_recommendation_version)
  REFERENCES lite_today_recommendations(workspace_id, today_recommendation_id, version)
);

CREATE TABLE lite_content_drafts (
 workspace_id uuid NOT NULL,
 content_draft_id text NOT NULL CHECK (btrim(content_draft_id) <> ''),
 version integer NOT NULL CHECK (version >= 1 AND version <= 25),
 content_opportunity_id text NOT NULL,
 content_opportunity_version integer NOT NULL CHECK (content_opportunity_version >= 1),
 status text NOT NULL CHECK (status IN ('DRAFT','READY_FOR_HUMAN_REVIEW','REVIEWED_READY_FOR_PACKAGE','CHANGES_REQUIRED','REJECTED','SUPERSEDED')),
 content_draft_fingerprint_sha256 text NOT NULL CHECK (content_draft_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, content_draft_id, version),
 FOREIGN KEY (workspace_id, content_opportunity_id, content_opportunity_version)
  REFERENCES lite_content_opportunities(workspace_id, content_opportunity_id, version)
);

CREATE UNIQUE INDEX lite_content_draft_root_per_opportunity
 ON lite_content_drafts(workspace_id, content_opportunity_id, content_opportunity_version)
 WHERE version = 1;

CREATE INDEX lite_content_draft_latest
 ON lite_content_drafts(workspace_id, content_draft_id, version DESC);

CREATE TABLE lite_content_review_decisions (
 workspace_id uuid NOT NULL,
 content_review_decision_id text NOT NULL CHECK (btrim(content_review_decision_id) <> ''),
 version integer NOT NULL CHECK (version >= 1),
 content_draft_id text NOT NULL,
 content_draft_version integer NOT NULL CHECK (content_draft_version >= 1),
 outcome text NOT NULL CHECK (outcome IN ('APPROVED_FOR_PUBLISH_PACKAGE','CHANGES_REQUIRED','REJECTED')),
 document_json jsonb NOT NULL,
 reviewed_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, content_review_decision_id, version),
 UNIQUE (workspace_id, content_draft_id, content_draft_version),
 FOREIGN KEY (workspace_id, content_draft_id, content_draft_version)
  REFERENCES lite_content_drafts(workspace_id, content_draft_id, version)
);

CREATE TABLE lite_publish_packages (
 workspace_id uuid NOT NULL,
 publish_package_id text NOT NULL CHECK (btrim(publish_package_id) <> ''),
 version integer NOT NULL CHECK (version >= 1),
 content_draft_id text NOT NULL,
 content_draft_version integer NOT NULL CHECK (content_draft_version >= 1),
 content_review_decision_id text NOT NULL,
 content_review_decision_version integer NOT NULL CHECK (content_review_decision_version >= 1),
 publish_package_fingerprint_sha256 text NOT NULL CHECK (publish_package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, publish_package_id, version),
 UNIQUE (workspace_id, content_review_decision_id, content_review_decision_version),
 FOREIGN KEY (workspace_id, content_draft_id, content_draft_version)
  REFERENCES lite_content_drafts(workspace_id, content_draft_id, version),
 FOREIGN KEY (workspace_id, content_review_decision_id, content_review_decision_version)
  REFERENCES lite_content_review_decisions(workspace_id, content_review_decision_id, version)
);

CREATE TABLE lite_content_preparation_commands (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 command_type text NOT NULL CHECK (command_type IN ('CREATE_RECOMMENDATION','ACCEPT_CONTENT_OPPORTUNITY','CREATE_CONTENT_DRAFT','REVISE_CONTENT_DRAFT','MARK_CONTENT_DRAFT_READY_FOR_REVIEW','RECORD_CONTENT_REVIEW','PREPARE_PUBLISH_PACKAGE')),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);
