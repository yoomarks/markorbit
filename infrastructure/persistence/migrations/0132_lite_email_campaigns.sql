CREATE TABLE lite_campaign_audience_snapshot_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  audience_snapshot_id text NOT NULL CHECK (audience_snapshot_id ~ '^campaign-audience_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  reviewed_send_fingerprint_sha256 text NOT NULL CHECK (reviewed_send_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  audience_fingerprint_sha256 text NOT NULL CHECK (audience_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  recipient_count integer NOT NULL CHECK (recipient_count BETWEEN 1 AND 10000),
  captured_at timestamptz NOT NULL,
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, audience_snapshot_id, version)
);

CREATE TABLE lite_campaign_content_projection_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  content_projection_id text NOT NULL CHECK (content_projection_id ~ '^campaign-content_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  publish_package_id text NOT NULL CHECK (btrim(publish_package_id) <> ''),
  publish_package_version integer NOT NULL CHECK (publish_package_version > 0),
  publish_package_fingerprint_sha256 text NOT NULL CHECK (publish_package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  reviewed_send_fingerprint_sha256 text NOT NULL CHECK (reviewed_send_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  projection_fingerprint_sha256 text NOT NULL CHECK (projection_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, content_projection_id, version)
);

CREATE TABLE lite_campaign_brand_projection_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  brand_projection_id text NOT NULL CHECK (brand_projection_id ~ '^campaign-brand_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  source_kind text NOT NULL CHECK (source_kind IN ('SITE_CONFIGURATION','CAMPAIGN_LOCAL_PRESENTATION')),
  source_ref text NOT NULL CHECK (btrim(source_ref) <> ''),
  brand_projection_fingerprint_sha256 text NOT NULL CHECK (brand_projection_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  captured_at timestamptz NOT NULL,
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, brand_projection_id, version)
);

CREATE TABLE lite_email_campaign_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  campaign_id text NOT NULL CHECK (campaign_id ~ '^email-campaign_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  purpose text NOT NULL CHECK (btrim(purpose) <> ''),
  status text NOT NULL CHECK (status IN (
    'DRAFT','READY_FOR_HUMAN_REVIEW','REVIEWED_READY_FOR_DELIVERY_PREPARATION',
    'CHANGES_REQUIRED','REJECTED','SUPERSEDED'
  )),
  audience_snapshot_id text NOT NULL,
  audience_snapshot_version integer NOT NULL CHECK (audience_snapshot_version > 0),
  content_projection_id text NOT NULL,
  content_projection_version integer NOT NULL CHECK (content_projection_version > 0),
  brand_projection_id text NOT NULL,
  brand_projection_version integer NOT NULL CHECK (brand_projection_version > 0),
  campaign_fingerprint_sha256 text NOT NULL CHECK (campaign_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, campaign_id, version),
  CHECK (updated_at >= created_at),
  FOREIGN KEY (workspace_id, audience_snapshot_id, audience_snapshot_version)
    REFERENCES lite_campaign_audience_snapshot_versions(workspace_id, audience_snapshot_id, version),
  FOREIGN KEY (workspace_id, content_projection_id, content_projection_version)
    REFERENCES lite_campaign_content_projection_versions(workspace_id, content_projection_id, version),
  FOREIGN KEY (workspace_id, brand_projection_id, brand_projection_version)
    REFERENCES lite_campaign_brand_projection_versions(workspace_id, brand_projection_id, version)
);

CREATE INDEX lite_email_campaign_latest
  ON lite_email_campaign_versions(workspace_id, campaign_id, version DESC);

CREATE INDEX lite_email_campaign_status_read
  ON lite_email_campaign_versions(workspace_id, status, updated_at DESC, campaign_id, version DESC);

CREATE TABLE lite_campaign_review_decision_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  campaign_review_decision_id text NOT NULL CHECK (campaign_review_decision_id ~ '^campaign-review_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  campaign_id text NOT NULL,
  campaign_version integer NOT NULL CHECK (campaign_version > 0),
  expected_campaign_fingerprint_sha256 text NOT NULL CHECK (expected_campaign_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('APPROVED_FOR_DELIVERY_PREPARATION','CHANGES_REQUIRED','REJECTED')),
  reviewer_principal_id text NOT NULL CHECK (btrim(reviewer_principal_id) <> ''),
  reviewed_at timestamptz NOT NULL,
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, campaign_review_decision_id, version),
  FOREIGN KEY (workspace_id, campaign_id, campaign_version)
    REFERENCES lite_email_campaign_versions(workspace_id, campaign_id, version)
);

CREATE TABLE lite_campaign_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> '' AND char_length(idempotency_key) <= 500),
  command_type text NOT NULL CHECK (command_type IN (
    'SAVE_AUDIENCE','SAVE_CONTENT','SAVE_BRAND','SAVE_CAMPAIGN','SAVE_REVIEW'
  )),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);
