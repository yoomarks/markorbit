CREATE TABLE lite_visual_briefs (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 visual_brief_id text NOT NULL CHECK (visual_brief_id LIKE 'visual-brief_%'),
 version integer NOT NULL CHECK (version > 0),
 content_kit_id text NOT NULL CHECK (content_kit_id LIKE 'content-kit_%'),
 content_kit_version integer NOT NULL CHECK (content_kit_version > 0),
 visual_brief_fingerprint_sha256 text NOT NULL CHECK (visual_brief_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, visual_brief_id, version),
 UNIQUE (workspace_id, content_kit_id, content_kit_version, visual_brief_fingerprint_sha256)
);

CREATE INDEX lite_visual_briefs_content_kit
 ON lite_visual_briefs(workspace_id, content_kit_id, content_kit_version, updated_at DESC);

CREATE TABLE lite_visual_requests (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 visual_brief_id text NOT NULL,
 visual_brief_version integer NOT NULL,
 request_reference text NOT NULL CHECK (request_reference ~ '^illustration-request://[^[:space:]]+$'),
 request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
 request_json jsonb NOT NULL,
 consumer_status text NOT NULL CHECK (consumer_status IN ('ACCEPTED','PLANNING_ONLY','REUSE_SELECTION_REQUIRED','REUSE_SELECTED')),
 accepted_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, request_reference),
 UNIQUE (workspace_id, visual_brief_id, visual_brief_version),
 FOREIGN KEY (workspace_id, visual_brief_id, visual_brief_version)
   REFERENCES lite_visual_briefs(workspace_id, visual_brief_id, version)
);

CREATE TABLE lite_visual_outputs (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 visual_output_id text NOT NULL CHECK (visual_output_id LIKE 'visual-output_%'),
 version integer NOT NULL CHECK (version > 0),
 visual_brief_id text NOT NULL,
 visual_brief_version integer NOT NULL,
 output_fingerprint_sha256 text NOT NULL CHECK (output_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 document_json jsonb NOT NULL,
 generated_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, visual_output_id, version),
 UNIQUE (workspace_id, visual_brief_id, visual_brief_version, output_fingerprint_sha256),
 FOREIGN KEY (workspace_id, visual_brief_id, visual_brief_version)
   REFERENCES lite_visual_briefs(workspace_id, visual_brief_id, version)
);

CREATE INDEX lite_visual_outputs_brief
 ON lite_visual_outputs(workspace_id, visual_brief_id, visual_brief_version, generated_at DESC);

CREATE TABLE lite_visual_bridge_commands (
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 command_type text NOT NULL CHECK (command_type IN ('CREATE_VISUAL_BRIEF','START_VISUAL_REQUEST','RECORD_VISUAL_OUTPUT')),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);
