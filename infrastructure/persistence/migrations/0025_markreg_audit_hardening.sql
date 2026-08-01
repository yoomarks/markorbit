CREATE TABLE markreg_denial_audit (
 audit_id bigserial PRIMARY KEY,
 workspace_id uuid NOT NULL,
 actor_id text NOT NULL CHECK (char_length(actor_id) BETWEEN 1 AND 200),
 actor_membership_id text CHECK (actor_membership_id IS NULL OR char_length(actor_membership_id) BETWEEN 1 AND 200),
 operation text NOT NULL CHECK (operation IN ('FORMAL_MATTER_CREATE','DOCUMENT_PACKAGE_CREATE','DOCUMENT_PACKAGE_UPDATE_DRAFT','DOCUMENT_EVIDENCE_UPSERT','INSTRUCTION_APPEND','INSTRUCTION_SUPERSEDE','DOCUMENT_PACKAGE_MARK_READY')),
 target_type text NOT NULL CHECK (target_type IN ('FORMAL_MATTER','DOCUMENT_PACKAGE','DOCUMENT_EVIDENCE','INSTRUCTION_LEDGER')),
 target_id text CHECK (target_id IS NULL OR char_length(target_id) BETWEEN 1 AND 200),
 decision text NOT NULL DEFAULT 'DENIED' CHECK (decision = 'DENIED'),
 reason_code text NOT NULL CHECK (reason_code IN ('PERMISSION_DENIED','CROSS_WORKSPACE_ACCESS','ORIGIN_REJECTED','CSRF_REJECTED','IDEMPOTENCY_KEY_REUSE','STALE_VERSION','TERMINAL_STATE_MUTATION','SOURCE_LINEAGE_CONFLICT')),
 correlation_id text CHECK (correlation_id IS NULL OR char_length(correlation_id) BETWEEN 1 AND 200),
 idempotency_key_sha256 text CHECK (idempotency_key_sha256 IS NULL OR idempotency_key_sha256 ~ '^[0-9a-f]{64}$'),
 source_command_fingerprint text CHECK (source_command_fingerprint IS NULL OR source_command_fingerprint ~ '^[0-9a-f]{64}$'),
 occurred_at timestamptz NOT NULL,
 owner_service text NOT NULL DEFAULT 'MARKREG' CHECK (owner_service = 'MARKREG')
);

CREATE INDEX markreg_denial_audit_workspace_chronology_idx
 ON markreg_denial_audit(workspace_id, occurred_at DESC, audit_id DESC);
CREATE INDEX markreg_denial_audit_workspace_reason_idx
 ON markreg_denial_audit(workspace_id, reason_code, occurred_at DESC, audit_id DESC);

CREATE FUNCTION reject_markreg_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'MarkReg audit evidence is append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER formal_matter_audit_append_only
 BEFORE UPDATE OR DELETE ON formal_matter_audit
 FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();
CREATE TRIGGER document_package_audit_append_only
 BEFORE UPDATE OR DELETE ON document_package_audit
 FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();
CREATE TRIGGER markreg_denial_audit_append_only
 BEFORE UPDATE OR DELETE ON markreg_denial_audit
 FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();
