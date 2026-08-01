CREATE TABLE document_packages (
 document_package_id text PRIMARY KEY CHECK (document_package_id ~ '^document-package_[A-Za-z0-9_-]+$'),
 workspace_id uuid NOT NULL,
 formal_matter_id text NOT NULL,
 source_formal_matter_version integer NOT NULL CHECK (source_formal_matter_version > 0),
 source_formal_matter_sha256 text NOT NULL CHECK (source_formal_matter_sha256 ~ '^[0-9a-f]{64}$'),
 professional_review_case_id text NOT NULL,
 source_review_version integer NOT NULL CHECK (source_review_version > 0),
 source_completed_decision_id text NOT NULL,
 source_completed_decision_sha256 text NOT NULL CHECK (source_completed_decision_sha256 ~ '^[0-9a-f]{64}$'),
 status text NOT NULL CHECK (status IN ('DRAFT','READY_FOR_PREPARATION_LOCK')),
 version integer NOT NULL CHECK (version > 0),
 schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
 package_data jsonb NOT NULL,
 canonical_evidence_sha256 text CHECK (canonical_evidence_sha256 ~ '^[0-9a-f]{64}$'),
 created_by text NOT NULL, updated_by text NOT NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 ready_at timestamptz, ready_by text,
 UNIQUE (workspace_id, professional_review_case_id, source_completed_decision_sha256),
 CHECK ((status = 'DRAFT' AND ready_at IS NULL AND ready_by IS NULL AND canonical_evidence_sha256 IS NULL)
     OR (status = 'READY_FOR_PREPARATION_LOCK' AND ready_at IS NOT NULL AND ready_by IS NOT NULL AND canonical_evidence_sha256 IS NOT NULL))
);
CREATE INDEX document_packages_workspace_updated_idx ON document_packages(workspace_id, updated_at DESC);

CREATE TABLE document_package_items (
 document_item_id text PRIMARY KEY CHECK (document_item_id ~ '^document-item_[A-Za-z0-9_-]+$'),
 document_package_id text NOT NULL REFERENCES document_packages(document_package_id),
 workspace_id uuid NOT NULL,
 requirement_key text NOT NULL, document_type text NOT NULL, display_name text NOT NULL,
 evidence_type text NOT NULL, original_file_name text, media_type text, size_bytes bigint CHECK (size_bytes >= 0),
 evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'), storage_reference text,
 verification_status text NOT NULL, structured_note jsonb NOT NULL DEFAULT '{}'::jsonb,
 item_data jsonb NOT NULL,
 created_by text NOT NULL, updated_by text NOT NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 UNIQUE (document_package_id, requirement_key)
);
CREATE INDEX document_package_items_package_idx ON document_package_items(workspace_id, document_package_id);

CREATE TABLE document_instruction_entries (
 instruction_entry_id text PRIMARY KEY CHECK (instruction_entry_id ~ '^instruction-entry_[A-Za-z0-9_-]+$'),
 document_package_id text NOT NULL REFERENCES document_packages(document_package_id),
 workspace_id uuid NOT NULL, sequence integer NOT NULL CHECK (sequence > 0),
 instruction_type text NOT NULL, target_jurisdiction text, target_class text, target_document_item_id text,
 structured_payload jsonb NOT NULL, source_review_finding_id text,
 actor_id text NOT NULL, created_at timestamptz NOT NULL,
 supersedes_entry_id text REFERENCES document_instruction_entries(instruction_entry_id),
 canonical_fingerprint text NOT NULL CHECK (canonical_fingerprint ~ '^[0-9a-f]{64}$'),
 UNIQUE (document_package_id, sequence), UNIQUE (document_package_id, canonical_fingerprint)
);
CREATE INDEX document_instruction_entries_package_idx ON document_instruction_entries(workspace_id, document_package_id, sequence);

CREATE TABLE document_package_commands (
 workspace_id uuid NOT NULL, idempotency_key text NOT NULL, request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
 document_package_id text NOT NULL REFERENCES document_packages(document_package_id),
 command_type text NOT NULL CHECK (command_type IN ('CREATE_OR_OPEN','UPDATE_DRAFT','UPSERT_DOCUMENT_EVIDENCE','APPEND_INSTRUCTION','SUPERSEDE_INSTRUCTION','MARK_READY')),
 response_version integer NOT NULL CHECK (response_version > 0), response_data jsonb NOT NULL, created_at timestamptz NOT NULL,
 PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE TABLE document_package_audit (
 audit_id bigserial PRIMARY KEY, workspace_id uuid NOT NULL,
 document_package_id text NOT NULL REFERENCES document_packages(document_package_id),
 action text NOT NULL CHECK (action IN ('PACKAGE_OPENED','PACKAGE_DRAFT_UPDATED','DOCUMENT_EVIDENCE_UPSERTED','INSTRUCTION_APPENDED','INSTRUCTION_SUPERSEDED','PACKAGE_MARKED_READY')),
 package_version integer NOT NULL CHECK (package_version > 0), actor_id text NOT NULL,
 correlation_id text, evidence_fingerprint text NOT NULL CHECK (evidence_fingerprint ~ '^[0-9a-f]{64}$'), created_at timestamptz NOT NULL
);
CREATE INDEX document_package_audit_package_idx ON document_package_audit(workspace_id, document_package_id, audit_id);
