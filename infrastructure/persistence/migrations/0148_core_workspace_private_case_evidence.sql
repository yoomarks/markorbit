CREATE TABLE core_workspace_private_case_evidence_bindings (
  binding_id uuid PRIMARY KEY,
  version integer NOT NULL CHECK (version >= 1),
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  knowledge_workspace_id text NOT NULL,
  ready_package_id text NOT NULL,
  ready_package_digest text NOT NULL CHECK (ready_package_digest ~ '^[0-9a-f]{64}$'),
  core_intake_id text NOT NULL,
  content_export_sha256 text NOT NULL CHECK (content_export_sha256 ~ '^[0-9a-f]{64}$'),
  staging_document_id text NOT NULL,
  staging_sha256 text NOT NULL CHECK (staging_sha256 ~ '^[0-9a-f]{64}$'),
  raw_artifact_id text NOT NULL,
  raw_artifact_sha256 text NOT NULL CHECK (raw_artifact_sha256 ~ '^[0-9a-f]{64}$'),
  formal_matter_id text NOT NULL,
  formal_matter_version integer NOT NULL CHECK (formal_matter_version >= 1),
  formal_matter_snapshot_sha256 text NOT NULL
    CHECK (formal_matter_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  source_locators_json jsonb NOT NULL CHECK (jsonb_typeof(source_locators_json) = 'array'),
  method_provenance_refs_json jsonb NOT NULL
    CHECK (jsonb_typeof(method_provenance_refs_json) = 'array'),
  status text NOT NULL CHECK (status IN ('SUGGESTED','ACCEPTED','REJECTED')),
  suggestion_idempotency_key text NOT NULL,
  suggestion_fingerprint_sha256 text NOT NULL
    CHECK (suggestion_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  suggested_by_user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  suggested_by_membership_id uuid NOT NULL
    REFERENCES workspace_memberships(membership_id) ON DELETE RESTRICT,
  suggested_authority_json jsonb NOT NULL,
  suggested_at timestamptz NOT NULL,
  decision_idempotency_key text,
  decision_fingerprint_sha256 text
    CHECK (decision_fingerprint_sha256 IS NULL OR decision_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  decided_by_user_id uuid REFERENCES users(user_id) ON DELETE RESTRICT,
  decided_by_membership_id uuid REFERENCES workspace_memberships(membership_id) ON DELETE RESTRICT,
  decided_authority_json jsonb,
  decided_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (workspace_id, suggestion_idempotency_key),
  CHECK (
    (status = 'SUGGESTED' AND version = 1 AND decision_idempotency_key IS NULL
      AND decision_fingerprint_sha256 IS NULL AND decided_by_user_id IS NULL
      AND decided_by_membership_id IS NULL AND decided_authority_json IS NULL
      AND decided_at IS NULL)
    OR
    (status IN ('ACCEPTED','REJECTED') AND version = 2 AND decision_idempotency_key IS NOT NULL
      AND decision_fingerprint_sha256 IS NOT NULL AND decided_by_user_id IS NOT NULL
      AND decided_by_membership_id IS NOT NULL AND decided_authority_json IS NOT NULL
      AND decided_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX core_workspace_private_case_evidence_decision_key_uq
  ON core_workspace_private_case_evidence_bindings (workspace_id, decision_idempotency_key)
  WHERE decision_idempotency_key IS NOT NULL;

CREATE INDEX core_workspace_private_case_evidence_case_idx
  ON core_workspace_private_case_evidence_bindings (
    workspace_id,
    formal_matter_id,
    status,
    updated_at DESC
  );
