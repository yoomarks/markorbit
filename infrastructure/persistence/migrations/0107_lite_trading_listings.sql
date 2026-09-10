CREATE TABLE lite_trading_listing_draft_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  listing_draft_id text NOT NULL CHECK (listing_draft_id ~ '^trading-listing-draft_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, listing_draft_id, version),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX lite_trading_listing_drafts_latest
  ON lite_trading_listing_draft_versions(workspace_id, listing_draft_id, version DESC);

CREATE TABLE lite_trading_listing_review_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  listing_review_id text NOT NULL CHECK (listing_review_id ~ '^trading-listing-review_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  listing_draft_id text NOT NULL,
  listing_draft_version integer NOT NULL CHECK (listing_draft_version > 0),
  review_state text NOT NULL CHECK (review_state IN ('CURRENT','STALE','CONFLICT')),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, listing_review_id, version),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, listing_draft_id, listing_draft_version)
    REFERENCES lite_trading_listing_draft_versions(workspace_id, listing_draft_id, version)
);

CREATE INDEX lite_trading_listing_reviews_latest
  ON lite_trading_listing_review_versions(workspace_id, listing_review_id, version DESC);

CREATE TABLE lite_trading_published_listing_versions (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  listing_id text NOT NULL CHECK (listing_id ~ '^trading-listing_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  listing_draft_id text NOT NULL,
  listing_draft_version integer NOT NULL CHECK (listing_draft_version > 0),
  listing_review_id text NOT NULL,
  listing_review_version integer NOT NULL CHECK (listing_review_version > 0),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, listing_id, version),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, listing_draft_id, listing_draft_version)
    REFERENCES lite_trading_listing_draft_versions(workspace_id, listing_draft_id, version),
  FOREIGN KEY (workspace_id, listing_review_id, listing_review_version)
    REFERENCES lite_trading_listing_review_versions(workspace_id, listing_review_id, version)
);

CREATE INDEX lite_trading_published_listings_latest
  ON lite_trading_published_listing_versions(workspace_id, listing_id, version DESC);
