-- MarkReg-owned explicit fee-driving application facts upstream of Production Quote.
-- Facts are supplied explicitly by a customer or established by a professional; no free-text/AI inference.
-- This migration creates no Quote, Filing Authorization/submission, professional approval, legal conclusion,
-- Order, Matter, Payment, provider action, or Official Truth consequence.

CREATE TABLE IF NOT EXISTS markreg_production_fee_facts (
  workspace_id uuid NOT NULL,
  fee_facts_id text NOT NULL CHECK (fee_facts_id ~ '^[A-Za-z0-9_-]+_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  initial_currentness text NOT NULL CHECK (initial_currentness = 'CURRENT'),
  intake_id text NOT NULL,
  intake_version integer NOT NULL CHECK (intake_version > 0),
  intake_fingerprint_sha256 text NOT NULL CHECK (intake_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  filing_basis text NOT NULL CHECK (filing_basis IN ('SECTION_1', 'SECTION_44')),
  nice_classes jsonb NOT NULL CHECK (jsonb_typeof(nice_classes) = 'array'),
  class_count integer NOT NULL CHECK (class_count BETWEEN 1 AND 100),
  filing_basis_provenance jsonb NOT NULL CHECK (jsonb_typeof(filing_basis_provenance) = 'object'),
  class_selection_provenance jsonb NOT NULL CHECK (jsonb_typeof(class_selection_provenance) = 'object'),
  fingerprint_sha256 text NOT NULL CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  fee_facts_record jsonb NOT NULL CHECK (jsonb_typeof(fee_facts_record) = 'object'),
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, fee_facts_id, version),
  FOREIGN KEY (workspace_id, intake_id, intake_version)
    REFERENCES markreg_early_funnel_intakes(workspace_id, intake_id, version)
    ON DELETE RESTRICT,
  CHECK (class_count = jsonb_array_length(nice_classes))
);

CREATE INDEX IF NOT EXISTS markreg_production_fee_facts_intake_idx
  ON markreg_production_fee_facts(workspace_id, intake_id, intake_version, recorded_at DESC, fee_facts_id);

CREATE TABLE IF NOT EXISTS markreg_production_fee_fact_state_events (
  state_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  fee_facts_id text NOT NULL,
  fee_facts_version integer NOT NULL CHECK (fee_facts_version > 0),
  intake_id text NOT NULL,
  intake_version integer NOT NULL CHECK (intake_version > 0),
  state text NOT NULL CHECK (state IN ('CURRENT', 'SUPERSEDED')),
  superseding_fee_facts_id text,
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  correlation_id text,
  occurred_at timestamptz NOT NULL,
  FOREIGN KEY (workspace_id, fee_facts_id, fee_facts_version)
    REFERENCES markreg_production_fee_facts(workspace_id, fee_facts_id, version)
    ON DELETE RESTRICT,
  CHECK (
    (state = 'CURRENT' AND superseding_fee_facts_id IS NULL)
    OR (state = 'SUPERSEDED' AND superseding_fee_facts_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS markreg_production_fee_fact_state_latest_idx
  ON markreg_production_fee_fact_state_events(workspace_id, fee_facts_id, fee_facts_version, state_event_id DESC);
CREATE INDEX IF NOT EXISTS markreg_production_fee_fact_current_by_intake_idx
  ON markreg_production_fee_fact_state_events(workspace_id, intake_id, intake_version, state, state_event_id DESC);

CREATE TABLE IF NOT EXISTS markreg_production_fee_fact_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  response_fee_facts_id text NOT NULL,
  response_fee_facts_version integer NOT NULL CHECK (response_fee_facts_version > 0),
  response_data jsonb NOT NULL CHECK (jsonb_typeof(response_data) = 'object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, response_fee_facts_id, response_fee_facts_version)
    REFERENCES markreg_production_fee_facts(workspace_id, fee_facts_id, version)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS markreg_production_fee_fact_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  fee_facts_id text NOT NULL,
  fee_facts_version integer NOT NULL CHECK (fee_facts_version > 0),
  action text NOT NULL CHECK (length(btrim(action)) > 0),
  source_lineage jsonb NOT NULL CHECK (jsonb_typeof(source_lineage) = 'object'),
  request_fingerprint_sha256 text CHECK (
    request_fingerprint_sha256 IS NULL OR request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
  ),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  correlation_id text,
  occurred_at timestamptz NOT NULL,
  FOREIGN KEY (workspace_id, fee_facts_id, fee_facts_version)
    REFERENCES markreg_production_fee_facts(workspace_id, fee_facts_id, version)
    ON DELETE RESTRICT
);

DROP TRIGGER IF EXISTS markreg_production_fee_facts_append_only ON markreg_production_fee_facts;
CREATE TRIGGER markreg_production_fee_facts_append_only
BEFORE UPDATE OR DELETE ON markreg_production_fee_facts
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();
DROP TRIGGER IF EXISTS markreg_production_fee_fact_state_events_append_only ON markreg_production_fee_fact_state_events;
CREATE TRIGGER markreg_production_fee_fact_state_events_append_only
BEFORE UPDATE OR DELETE ON markreg_production_fee_fact_state_events
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();
DROP TRIGGER IF EXISTS markreg_production_fee_fact_commands_append_only ON markreg_production_fee_fact_commands;
CREATE TRIGGER markreg_production_fee_fact_commands_append_only
BEFORE UPDATE OR DELETE ON markreg_production_fee_fact_commands
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();
DROP TRIGGER IF EXISTS markreg_production_fee_fact_audit_append_only ON markreg_production_fee_fact_audit;
CREATE TRIGGER markreg_production_fee_fact_audit_append_only
BEFORE UPDATE OR DELETE ON markreg_production_fee_fact_audit
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();

COMMENT ON TABLE markreg_production_fee_facts IS
  'Explicit immutable fee-driving application facts. Fee facts are not Quote, filing authority, professional approval, Payment, provider action or Official Truth.';
