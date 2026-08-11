CREATE TABLE knowledge_content_exports (
 intake_id uuid PRIMARY KEY REFERENCES knowledge_intakes(intake_id) ON DELETE RESTRICT,
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 ready_package_id text NOT NULL CHECK (btrim(ready_package_id) <> ''),
 ready_package_digest text NOT NULL CHECK (ready_package_digest ~ '^[0-9a-f]{64}$'),
 contract_version text NOT NULL CHECK (contract_version = '1.0'),
 knowledge_workspace_id text NOT NULL CHECK (btrim(knowledge_workspace_id) <> ''),
 source_id text NOT NULL CHECK (btrim(source_id) <> ''),
 raw_artifact_id text NOT NULL CHECK (btrim(raw_artifact_id) <> ''),
 raw_artifact_sha256 text NOT NULL CHECK (raw_artifact_sha256 ~ '^[0-9a-f]{64}$'),
 staging_document_id text NOT NULL CHECK (btrim(staging_document_id) <> ''),
 staging_sha256 text NOT NULL CHECK (staging_sha256 ~ '^[0-9a-f]{64}$'),
 export_sha256 text NOT NULL CHECK (export_sha256 ~ '^[0-9a-f]{64}$'),
 export_json jsonb NOT NULL,
 received_at timestamptz NOT NULL
);
