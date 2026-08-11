CREATE TABLE knowledge_intake_contents (
 intake_id uuid PRIMARY KEY REFERENCES knowledge_intakes(intake_id),
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 ready_package_id text NOT NULL CHECK (btrim(ready_package_id) <> ''),
 knowledge_workspace_id text NOT NULL CHECK (btrim(knowledge_workspace_id) <> ''),
 ready_package_digest text NOT NULL CHECK (ready_package_digest ~ '^[0-9a-f]{64}$'),
 raw_artifact_id text NOT NULL CHECK (btrim(raw_artifact_id) <> ''),
 raw_artifact_sha256 text NOT NULL CHECK (raw_artifact_sha256 ~ '^[0-9a-f]{64}$'),
 staging_document_id text NOT NULL CHECK (btrim(staging_document_id) <> ''),
 staging_sha256 text NOT NULL CHECK (staging_sha256 ~ '^[0-9a-f]{64}$'),
 staging_markdown text NOT NULL,
 export_sha256 text NOT NULL CHECK (export_sha256 ~ '^[0-9a-f]{64}$'),
 export_json jsonb NOT NULL,
 consumed_at timestamptz NOT NULL
);
