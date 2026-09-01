-- Durable MarkReg Preparation Lock truth over READY_FOR_PREPARATION_LOCK
-- document_packages. This is intentionally persistence-only: it does not upgrade
-- the legacy fixture PreparationLock contract and grants no Filing Authorization,
-- Execution Release, external filing, payment, provider-contact, or Official Truth
-- authority.

CREATE TABLE IF NOT EXISTS markreg_preparation_locks (
  preparation_lock_id text PRIMARY KEY
    CHECK (preparation_lock_id ~ '^preparation-lock_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),

  source_document_package_id text NOT NULL
    REFERENCES document_packages(document_package_id) ON DELETE RESTRICT,
  source_document_package_version integer NOT NULL
    CHECK (source_document_package_version > 0),
  source_document_package_canonical_evidence_sha256 text NOT NULL
    CHECK (source_document_package_canonical_evidence_sha256 ~ '^[0-9a-f]{64}$'),

  source_formal_matter_id text NOT NULL,
  source_formal_matter_version integer NOT NULL CHECK (source_formal_matter_version > 0),
  source_formal_matter_sha256 text NOT NULL
    CHECK (source_formal_matter_sha256 ~ '^[0-9a-f]{64}$'),

  source_professional_review_case_id text NOT NULL,
  source_review_version integer NOT NULL CHECK (source_review_version > 0),
  source_completed_decision_id text NOT NULL,
  source_completed_decision_sha256 text NOT NULL
    CHECK (source_completed_decision_sha256 ~ '^[0-9a-f]{64}$'),

  source_instruction_entry_count integer NOT NULL CHECK (source_instruction_entry_count >= 0),
  source_instruction_entries jsonb NOT NULL,
  source_instruction_set_sha256 text NOT NULL
    CHECK (source_instruction_set_sha256 ~ '^[0-9a-f]{64}$'),

  lock_payload_sha256 text NOT NULL CHECK (lock_payload_sha256 ~ '^[0-9a-f]{64}$'),
  lock_record jsonb NOT NULL,
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  created_at timestamptz NOT NULL,

  CHECK (jsonb_typeof(source_instruction_entries) = 'array'),
  CHECK (jsonb_array_length(source_instruction_entries) = source_instruction_entry_count),
  UNIQUE (
    workspace_id,
    source_document_package_id,
    source_document_package_version,
    source_document_package_canonical_evidence_sha256
  ),
  UNIQUE (workspace_id, preparation_lock_id)
);

CREATE INDEX IF NOT EXISTS markreg_preparation_locks_workspace_created_idx
  ON markreg_preparation_locks(workspace_id, created_at DESC, preparation_lock_id);

CREATE INDEX IF NOT EXISTS markreg_preparation_locks_source_package_idx
  ON markreg_preparation_locks(
    workspace_id,
    source_document_package_id,
    source_document_package_version
  );

-- Exact command receipts make replay restart-safe. The owner adapter must return
-- the stored response for an exact fingerprint and reject materially different
-- payload reuse under the same Workspace/idempotency key.
CREATE TABLE IF NOT EXISTS markreg_preparation_lock_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  request_fingerprint_sha256 text NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  preparation_lock_id text NOT NULL,
  response_version integer NOT NULL CHECK (response_version = 1),
  response_data jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, preparation_lock_id)
    REFERENCES markreg_preparation_locks(workspace_id, preparation_lock_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS markreg_preparation_lock_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  preparation_lock_id text NOT NULL,
  action text NOT NULL CHECK (action = 'PREPARATION_LOCK_CREATED'),
  source_document_package_id text NOT NULL,
  source_document_package_version integer NOT NULL CHECK (source_document_package_version > 0),
  source_fingerprint_sha256 text NOT NULL
    CHECK (source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  correlation_id text,
  created_at timestamptz NOT NULL,
  FOREIGN KEY (workspace_id, preparation_lock_id)
    REFERENCES markreg_preparation_locks(workspace_id, preparation_lock_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS markreg_preparation_lock_audit_history_idx
  ON markreg_preparation_lock_audit(workspace_id, preparation_lock_id, audit_id);

-- Fail closed at the persistence boundary if a lock is inserted from anything
-- other than the exact current durable READY package and exact current instruction
-- set. The stored lock remains an immutable snapshot even if owner state evolves
-- later; later source truth requires a new lock rather than rewriting history.
CREATE OR REPLACE FUNCTION validate_markreg_preparation_lock_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_package document_packages%ROWTYPE;
  actual_instruction_count integer;
BEGIN
  SELECT *
    INTO source_package
    FROM document_packages
   WHERE document_package_id = NEW.source_document_package_id
     AND workspace_id = NEW.workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Preparation Lock source package is unavailable in this Workspace'
      USING ERRCODE = '23503';
  END IF;

  IF source_package.status <> 'READY_FOR_PREPARATION_LOCK' THEN
    RAISE EXCEPTION 'Preparation Lock source package is not READY_FOR_PREPARATION_LOCK'
      USING ERRCODE = '23514';
  END IF;

  IF source_package.version <> NEW.source_document_package_version
     OR source_package.canonical_evidence_sha256 IS DISTINCT FROM NEW.source_document_package_canonical_evidence_sha256
     OR source_package.formal_matter_id <> NEW.source_formal_matter_id
     OR source_package.source_formal_matter_version <> NEW.source_formal_matter_version
     OR source_package.source_formal_matter_sha256 <> NEW.source_formal_matter_sha256
     OR source_package.professional_review_case_id <> NEW.source_professional_review_case_id
     OR source_package.source_review_version <> NEW.source_review_version
     OR source_package.source_completed_decision_id <> NEW.source_completed_decision_id
     OR source_package.source_completed_decision_sha256 <> NEW.source_completed_decision_sha256 THEN
    RAISE EXCEPTION 'Preparation Lock source identity is stale or does not match durable package truth'
      USING ERRCODE = '23514';
  END IF;

  -- Every snapshot member must be a bounded object carrying the exact immutable
  -- entry identity, sequence and canonical fingerprint.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(NEW.source_instruction_entries) AS snapshot_entry
     WHERE jsonb_typeof(snapshot_entry) <> 'object'
        OR COALESCE(snapshot_entry->>'instructionEntryId', '') = ''
        OR COALESCE(snapshot_entry->>'canonicalFingerprint', '') !~ '^[0-9a-f]{64}$'
        OR COALESCE(snapshot_entry->>'sequence', '') !~ '^[1-9][0-9]*$'
  ) THEN
    RAISE EXCEPTION 'Preparation Lock instruction snapshot is malformed'
      USING ERRCODE = '23514';
  END IF;

  IF (
    SELECT count(*)
      FROM (
        SELECT DISTINCT
          snapshot_entry->>'instructionEntryId' AS instruction_entry_id,
          snapshot_entry->>'sequence' AS sequence,
          snapshot_entry->>'canonicalFingerprint' AS canonical_fingerprint
        FROM jsonb_array_elements(NEW.source_instruction_entries) AS snapshot_entry
      ) deduplicated
  ) <> NEW.source_instruction_entry_count THEN
    RAISE EXCEPTION 'Preparation Lock instruction snapshot contains duplicate members'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)
    INTO actual_instruction_count
    FROM document_instruction_entries
   WHERE document_package_id = NEW.source_document_package_id
     AND workspace_id = NEW.workspace_id;

  IF actual_instruction_count <> NEW.source_instruction_entry_count THEN
    RAISE EXCEPTION 'Preparation Lock instruction snapshot is stale'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM document_instruction_entries entry
     WHERE entry.document_package_id = NEW.source_document_package_id
       AND entry.workspace_id = NEW.workspace_id
       AND NOT EXISTS (
         SELECT 1
           FROM jsonb_array_elements(NEW.source_instruction_entries) AS snapshot_entry
          WHERE snapshot_entry->>'instructionEntryId' = entry.instruction_entry_id
            AND (snapshot_entry->>'sequence')::integer = entry.sequence
            AND snapshot_entry->>'canonicalFingerprint' = entry.canonical_fingerprint
       )
  ) THEN
    RAISE EXCEPTION 'Preparation Lock instruction snapshot does not match durable instruction truth'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS markreg_preparation_lock_source_guard ON markreg_preparation_locks;
CREATE TRIGGER markreg_preparation_lock_source_guard
BEFORE INSERT ON markreg_preparation_locks
FOR EACH ROW EXECUTE FUNCTION validate_markreg_preparation_lock_source();

CREATE OR REPLACE FUNCTION reject_markreg_preparation_lock_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS markreg_preparation_locks_append_only ON markreg_preparation_locks;
CREATE TRIGGER markreg_preparation_locks_append_only
BEFORE UPDATE OR DELETE ON markreg_preparation_locks
FOR EACH ROW EXECUTE FUNCTION reject_markreg_preparation_lock_history_mutation();

DROP TRIGGER IF EXISTS markreg_preparation_lock_commands_append_only ON markreg_preparation_lock_commands;
CREATE TRIGGER markreg_preparation_lock_commands_append_only
BEFORE UPDATE OR DELETE ON markreg_preparation_lock_commands
FOR EACH ROW EXECUTE FUNCTION reject_markreg_preparation_lock_history_mutation();

DROP TRIGGER IF EXISTS markreg_preparation_lock_audit_append_only ON markreg_preparation_lock_audit;
CREATE TRIGGER markreg_preparation_lock_audit_append_only
BEFORE UPDATE OR DELETE ON markreg_preparation_lock_audit
FOR EACH ROW EXECUTE FUNCTION reject_markreg_preparation_lock_history_mutation();
