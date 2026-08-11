CREATE TABLE lite_product_loop_use_feedback (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 product_loop_feedback_id text NOT NULL CHECK (btrim(product_loop_feedback_id) <> ''),
 version integer NOT NULL CHECK (version = 1),
 publish_package_id text NOT NULL,
 publish_package_version integer NOT NULL CHECK (publish_package_version = 1),
 expected_publish_package_fingerprint_sha256 text NOT NULL CHECK (expected_publish_package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 outcome text NOT NULL CHECK (outcome IN ('USER_REPORTED_PUBLISHED','USER_REPORTED_DELIVERED','USER_REPORTED_USED','NOT_USED')),
 external_reference text,
 recorded_by_principal_id text NOT NULL CHECK (btrim(recorded_by_principal_id) <> ''),
 document_json jsonb NOT NULL,
 recorded_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, product_loop_feedback_id, version),
 UNIQUE (workspace_id, publish_package_id, publish_package_version),
 FOREIGN KEY (workspace_id, publish_package_id, publish_package_version)
  REFERENCES lite_publish_packages(workspace_id, publish_package_id, version),
 CHECK (external_reference IS NULL OR btrim(external_reference) <> '')
);

CREATE INDEX lite_product_loop_use_feedback_recent
 ON lite_product_loop_use_feedback(workspace_id, recorded_at DESC, product_loop_feedback_id ASC);

CREATE TABLE lite_product_loop_feedback_commands (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 command_type text NOT NULL CHECK (command_type = 'RECORD_USE_FEEDBACK'),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);
