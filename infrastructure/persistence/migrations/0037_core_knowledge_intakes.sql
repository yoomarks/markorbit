CREATE TABLE knowledge_intakes (
 intake_id uuid PRIMARY KEY,
 idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
 ready_package_id text NOT NULL CHECK (btrim(ready_package_id) <> ''),
 workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
 ready_package_digest text NOT NULL CHECK (btrim(ready_package_digest) <> ''),
 staging_document_id text NOT NULL CHECK (btrim(staging_document_id) <> ''),
 artifact_ids text[] NOT NULL,
 submitted_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL,
 request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
 request_json jsonb NOT NULL,
 status text NOT NULL CHECK (status IN ('RECEIVED','ACCEPTED','REJECTED')),
 CONSTRAINT knowledge_intakes_idempotency_key_key UNIQUE(idempotency_key)
);
