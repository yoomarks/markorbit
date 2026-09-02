-- Durable MarkReg early-funnel owner truth for production Intake, Recommendation,
-- User Selection and Quote artifacts. Artifacts are immutable; effective Selection
-- and Quote lifecycle state is reconstructed from append-only state events so
-- supersede/expiry never rewrites historical evidence.
--
-- This persistence foundation creates no Customer Confirmation, Order, Matter,
-- professional approval, legal conclusion, Filing Authorization, protected-action
-- authority, Payment, invoice, filing, or Official Truth.

CREATE TABLE IF NOT EXISTS markreg_early_funnel_intakes (
  workspace_id uuid NOT NULL,
  intake_id text NOT NULL CHECK (intake_id ~ '^[A-Za-z0-9_-]+_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('RECEIVED', 'RECOMMENDATION_READY')),
  channel text NOT NULL CHECK (
    channel IN (
      'LITE_PROFESSIONAL',
      'MARKREG_DIRECT',
      'MARKREG_PARTNER_REFERRAL',
      'MARKREG_WHITE_LABEL',
      'INTERNAL_OPERATIONS'
    )
  ),
  relationship_model text NOT NULL CHECK (
    relationship_model IN ('DIRECT', 'CO_DELIVERY', 'WHITE_LABEL', 'REFERRAL', 'PLATFORM_ASSISTED')
  ),
  source_class text NOT NULL CHECK (source_class = 'CUSTOMER_SUPPLIED'),
  input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
  fingerprint_sha256 text NOT NULL CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  intake_record jsonb NOT NULL CHECK (jsonb_typeof(intake_record) = 'object'),
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, intake_id, version),
  CHECK (updated_at >= created_at)
);

CREATE INDEX IF NOT EXISTS markreg_early_funnel_intakes_history_idx
  ON markreg_early_funnel_intakes(workspace_id, intake_id, version DESC);

CREATE INDEX IF NOT EXISTS markreg_early_funnel_intakes_created_idx
  ON markreg_early_funnel_intakes(workspace_id, created_at DESC, intake_id, version DESC);

CREATE TABLE IF NOT EXISTS markreg_early_funnel_recommendations (
  workspace_id uuid NOT NULL,
  recommendation_id text NOT NULL
    CHECK (recommendation_id ~ '^[A-Za-z0-9_-]+_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  intake_id text NOT NULL,
  intake_version integer NOT NULL CHECK (intake_version > 0),
  intake_fingerprint_sha256 text NOT NULL CHECK (intake_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  admission_class text NOT NULL
    CHECK (admission_class IN ('PRODUCTION_ADMISSIBLE', 'FIXTURE_TEST', 'UNSUPPORTED_UNTRUSTED')),
  currentness text NOT NULL CHECK (currentness IN ('CURRENT', 'STALE', 'SUPERSEDED')),
  source_id text NOT NULL CHECK (length(btrim(source_id)) > 0),
  source_version text NOT NULL CHECK (length(btrim(source_version)) > 0),
  source_fingerprint_sha256 text NOT NULL CHECK (source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  source_admission_class text NOT NULL
    CHECK (source_admission_class IN ('PRODUCTION_ADMISSIBLE', 'FIXTURE_TEST', 'UNSUPPORTED_UNTRUSTED')),
  source_currentness text NOT NULL CHECK (source_currentness IN ('CURRENT', 'STALE', 'SUPERSEDED')),
  source_currentness_checked_at timestamptz NOT NULL,
  source_provenance jsonb NOT NULL CHECK (jsonb_typeof(source_provenance) = 'object'),
  recommendation_record jsonb NOT NULL CHECK (jsonb_typeof(recommendation_record) = 'object'),
  fingerprint_sha256 text NOT NULL CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  generated_at timestamptz NOT NULL,
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  PRIMARY KEY (workspace_id, recommendation_id, version),
  FOREIGN KEY (workspace_id, intake_id, intake_version)
    REFERENCES markreg_early_funnel_intakes(workspace_id, intake_id, version)
    ON DELETE RESTRICT,
  CHECK (
    admission_class <> 'PRODUCTION_ADMISSIBLE'
    OR source_admission_class = 'PRODUCTION_ADMISSIBLE'
  )
);

CREATE INDEX IF NOT EXISTS markreg_early_funnel_recommendations_intake_idx
  ON markreg_early_funnel_recommendations(
    workspace_id,
    intake_id,
    intake_version,
    generated_at DESC,
    recommendation_id,
    version DESC
  );

CREATE INDEX IF NOT EXISTS markreg_early_funnel_recommendations_currentness_idx
  ON markreg_early_funnel_recommendations(
    workspace_id,
    currentness,
    admission_class,
    generated_at DESC,
    recommendation_id
  );

CREATE TABLE IF NOT EXISTS markreg_early_funnel_selections (
  workspace_id uuid NOT NULL,
  selection_id text NOT NULL CHECK (selection_id ~ '^[A-Za-z0-9_-]+_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  initial_status text NOT NULL CHECK (initial_status IN ('CURRENT', 'SUPERSEDED')),
  recommendation_id text NOT NULL,
  recommendation_version integer NOT NULL CHECK (recommendation_version > 0),
  recommendation_fingerprint_sha256 text NOT NULL
    CHECK (recommendation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  selected_option_code text NOT NULL CHECK (selected_option_code IN ('A', 'B', 'C')),
  selected_at timestamptz NOT NULL,
  fingerprint_sha256 text NOT NULL CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  selection_record jsonb NOT NULL CHECK (jsonb_typeof(selection_record) = 'object'),
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  PRIMARY KEY (workspace_id, selection_id, version),
  FOREIGN KEY (workspace_id, recommendation_id, recommendation_version)
    REFERENCES markreg_early_funnel_recommendations(workspace_id, recommendation_id, version)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS markreg_early_funnel_selections_recommendation_idx
  ON markreg_early_funnel_selections(
    workspace_id,
    recommendation_id,
    recommendation_version,
    selected_at DESC,
    selection_id,
    version DESC
  );

CREATE TABLE IF NOT EXISTS markreg_early_funnel_selection_state_events (
  state_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  selection_id text NOT NULL,
  selection_version integer NOT NULL CHECK (selection_version > 0),
  recommendation_id text NOT NULL,
  recommendation_version integer NOT NULL CHECK (recommendation_version > 0),
  state text NOT NULL CHECK (state IN ('CURRENT', 'SUPERSEDED')),
  superseding_selection_id text,
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  correlation_id text,
  occurred_at timestamptz NOT NULL,
  FOREIGN KEY (workspace_id, selection_id, selection_version)
    REFERENCES markreg_early_funnel_selections(workspace_id, selection_id, version)
    ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, recommendation_id, recommendation_version)
    REFERENCES markreg_early_funnel_recommendations(workspace_id, recommendation_id, version)
    ON DELETE RESTRICT,
  CHECK (
    (state = 'CURRENT' AND superseding_selection_id IS NULL)
    OR (state = 'SUPERSEDED' AND superseding_selection_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS markreg_early_funnel_selection_state_latest_idx
  ON markreg_early_funnel_selection_state_events(
    workspace_id,
    selection_id,
    selection_version,
    state_event_id DESC
  );

CREATE INDEX IF NOT EXISTS markreg_early_funnel_selection_current_by_recommendation_idx
  ON markreg_early_funnel_selection_state_events(
    workspace_id,
    recommendation_id,
    recommendation_version,
    state,
    state_event_id DESC
  );

CREATE TABLE IF NOT EXISTS markreg_early_funnel_quotes (
  workspace_id uuid NOT NULL,
  quote_id text NOT NULL CHECK (quote_id ~ '^[A-Za-z0-9_-]+_[A-Za-z0-9_-]+$'),
  version integer NOT NULL CHECK (version > 0),
  admission_class text NOT NULL
    CHECK (admission_class IN ('PRODUCTION_ADMISSIBLE', 'FIXTURE_TEST', 'UNSUPPORTED_UNTRUSTED')),
  initial_status text NOT NULL
    CHECK (initial_status IN ('DRAFT', 'READY', 'CONFIRMED', 'EXPIRED', 'SUPERSEDED')),

  intake_id text NOT NULL,
  intake_version integer NOT NULL CHECK (intake_version > 0),
  intake_fingerprint_sha256 text NOT NULL CHECK (intake_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),

  recommendation_id text NOT NULL,
  recommendation_version integer NOT NULL CHECK (recommendation_version > 0),
  recommendation_fingerprint_sha256 text NOT NULL
    CHECK (recommendation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  recommendation_admission_class text NOT NULL
    CHECK (
      recommendation_admission_class IN (
        'PRODUCTION_ADMISSIBLE',
        'FIXTURE_TEST',
        'UNSUPPORTED_UNTRUSTED'
      )
    ),
  recommendation_currentness text NOT NULL
    CHECK (recommendation_currentness IN ('CURRENT', 'STALE', 'SUPERSEDED')),

  selection_id text NOT NULL,
  selection_version integer NOT NULL CHECK (selection_version > 0),
  selection_fingerprint_sha256 text NOT NULL CHECK (selection_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  selection_currentness text NOT NULL CHECK (selection_currentness IN ('CURRENT', 'STALE', 'SUPERSEDED')),

  pricing_source_id text NOT NULL CHECK (length(btrim(pricing_source_id)) > 0),
  pricing_source_version text NOT NULL CHECK (length(btrim(pricing_source_version)) > 0),
  pricing_source_fingerprint_sha256 text NOT NULL
    CHECK (pricing_source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  pricing_source_admission_class text NOT NULL
    CHECK (
      pricing_source_admission_class IN (
        'PRODUCTION_ADMISSIBLE',
        'FIXTURE_TEST',
        'UNSUPPORTED_UNTRUSTED'
      )
    ),
  pricing_source_currentness text NOT NULL
    CHECK (pricing_source_currentness IN ('CURRENT', 'STALE', 'SUPERSEDED')),
  pricing_source_currentness_checked_at timestamptz NOT NULL,
  pricing_source_provenance jsonb NOT NULL CHECK (jsonb_typeof(pricing_source_provenance) = 'object'),

  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  valid_until timestamptz NOT NULL,
  supersedes_quote_id text,
  fingerprint_sha256 text NOT NULL CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  quote_record jsonb NOT NULL CHECK (jsonb_typeof(quote_record) = 'object'),
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, quote_id, version),
  FOREIGN KEY (workspace_id, intake_id, intake_version)
    REFERENCES markreg_early_funnel_intakes(workspace_id, intake_id, version)
    ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, recommendation_id, recommendation_version)
    REFERENCES markreg_early_funnel_recommendations(workspace_id, recommendation_id, version)
    ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, selection_id, selection_version)
    REFERENCES markreg_early_funnel_selections(workspace_id, selection_id, version)
    ON DELETE RESTRICT,
  CHECK (
    admission_class <> 'PRODUCTION_ADMISSIBLE'
    OR (
      recommendation_admission_class = 'PRODUCTION_ADMISSIBLE'
      AND pricing_source_admission_class = 'PRODUCTION_ADMISSIBLE'
    )
  )
);

CREATE INDEX IF NOT EXISTS markreg_early_funnel_quotes_lineage_idx
  ON markreg_early_funnel_quotes(
    workspace_id,
    intake_id,
    recommendation_id,
    selection_id,
    created_at DESC,
    quote_id,
    version DESC
  );

CREATE INDEX IF NOT EXISTS markreg_early_funnel_quotes_validity_idx
  ON markreg_early_funnel_quotes(workspace_id, valid_until, quote_id, version DESC);

CREATE INDEX IF NOT EXISTS markreg_early_funnel_quotes_supersedes_idx
  ON markreg_early_funnel_quotes(workspace_id, supersedes_quote_id)
  WHERE supersedes_quote_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS markreg_early_funnel_quote_state_events (
  state_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  quote_id text NOT NULL,
  quote_version integer NOT NULL CHECK (quote_version > 0),
  state text NOT NULL CHECK (state IN ('DRAFT', 'READY', 'CONFIRMED', 'EXPIRED', 'SUPERSEDED')),
  superseding_quote_id text,
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  correlation_id text,
  occurred_at timestamptz NOT NULL,
  FOREIGN KEY (workspace_id, quote_id, quote_version)
    REFERENCES markreg_early_funnel_quotes(workspace_id, quote_id, version)
    ON DELETE RESTRICT,
  CHECK (
    (state = 'SUPERSEDED' AND superseding_quote_id IS NOT NULL)
    OR (state <> 'SUPERSEDED' AND superseding_quote_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS markreg_early_funnel_quote_state_latest_idx
  ON markreg_early_funnel_quote_state_events(
    workspace_id,
    quote_id,
    quote_version,
    state_event_id DESC
  );

CREATE INDEX IF NOT EXISTS markreg_early_funnel_quote_state_lookup_idx
  ON markreg_early_funnel_quote_state_events(
    workspace_id,
    state,
    occurred_at DESC,
    quote_id,
    quote_version
  );

-- Restart-safe exact command receipts. A future MarkReg owner adapter must return
-- response_data for the exact same request fingerprint and fail closed on reuse of
-- the same Workspace/command/idempotency key with a materially different request.
CREATE TABLE IF NOT EXISTS markreg_early_funnel_commands (
  workspace_id uuid NOT NULL,
  command_type text NOT NULL CHECK (
    command_type IN (
      'CREATE_INTAKE',
      'REVISE_INTAKE',
      'CREATE_RECOMMENDATION',
      'CREATE_SELECTION',
      'TRANSITION_SELECTION',
      'CREATE_QUOTE',
      'TRANSITION_QUOTE'
    )
  ),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  response_entity_type text NOT NULL CHECK (
    response_entity_type IN ('INTAKE', 'RECOMMENDATION', 'SELECTION', 'QUOTE')
  ),
  response_entity_id text NOT NULL CHECK (length(btrim(response_entity_id)) > 0),
  response_entity_version integer NOT NULL CHECK (response_entity_version > 0),
  response_data jsonb NOT NULL CHECK (jsonb_typeof(response_data) = 'object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, command_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS markreg_early_funnel_commands_response_idx
  ON markreg_early_funnel_commands(
    workspace_id,
    response_entity_type,
    response_entity_id,
    response_entity_version
  );

CREATE TABLE IF NOT EXISTS markreg_early_funnel_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('INTAKE', 'RECOMMENDATION', 'SELECTION', 'QUOTE')),
  entity_id text NOT NULL CHECK (length(btrim(entity_id)) > 0),
  entity_version integer NOT NULL CHECK (entity_version > 0),
  action text NOT NULL CHECK (length(btrim(action)) > 0),
  source_lineage jsonb NOT NULL CHECK (jsonb_typeof(source_lineage) = 'object'),
  request_fingerprint_sha256 text CHECK (
    request_fingerprint_sha256 IS NULL
    OR request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'
  ),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  correlation_id text,
  occurred_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS markreg_early_funnel_audit_entity_history_idx
  ON markreg_early_funnel_audit(
    workspace_id,
    entity_type,
    entity_id,
    entity_version,
    audit_id
  );

CREATE OR REPLACE FUNCTION reject_markreg_early_funnel_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS markreg_early_funnel_intakes_append_only ON markreg_early_funnel_intakes;
CREATE TRIGGER markreg_early_funnel_intakes_append_only
BEFORE UPDATE OR DELETE ON markreg_early_funnel_intakes
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();

DROP TRIGGER IF EXISTS markreg_early_funnel_recommendations_append_only ON markreg_early_funnel_recommendations;
CREATE TRIGGER markreg_early_funnel_recommendations_append_only
BEFORE UPDATE OR DELETE ON markreg_early_funnel_recommendations
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();

DROP TRIGGER IF EXISTS markreg_early_funnel_selections_append_only ON markreg_early_funnel_selections;
CREATE TRIGGER markreg_early_funnel_selections_append_only
BEFORE UPDATE OR DELETE ON markreg_early_funnel_selections
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();

DROP TRIGGER IF EXISTS markreg_early_funnel_selection_state_events_append_only
  ON markreg_early_funnel_selection_state_events;
CREATE TRIGGER markreg_early_funnel_selection_state_events_append_only
BEFORE UPDATE OR DELETE ON markreg_early_funnel_selection_state_events
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();

DROP TRIGGER IF EXISTS markreg_early_funnel_quotes_append_only ON markreg_early_funnel_quotes;
CREATE TRIGGER markreg_early_funnel_quotes_append_only
BEFORE UPDATE OR DELETE ON markreg_early_funnel_quotes
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();

DROP TRIGGER IF EXISTS markreg_early_funnel_quote_state_events_append_only
  ON markreg_early_funnel_quote_state_events;
CREATE TRIGGER markreg_early_funnel_quote_state_events_append_only
BEFORE UPDATE OR DELETE ON markreg_early_funnel_quote_state_events
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();

DROP TRIGGER IF EXISTS markreg_early_funnel_commands_append_only ON markreg_early_funnel_commands;
CREATE TRIGGER markreg_early_funnel_commands_append_only
BEFORE UPDATE OR DELETE ON markreg_early_funnel_commands
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();

DROP TRIGGER IF EXISTS markreg_early_funnel_audit_append_only ON markreg_early_funnel_audit;
CREATE TRIGGER markreg_early_funnel_audit_append_only
BEFORE UPDATE OR DELETE ON markreg_early_funnel_audit
FOR EACH ROW EXECUTE FUNCTION reject_markreg_early_funnel_history_mutation();

COMMENT ON TABLE markreg_early_funnel_intakes IS
  'MarkReg-owned immutable early-funnel Intake versions. No Confirmation, Order, Matter, Filing, Payment, professional approval or Official Truth authority.';
COMMENT ON TABLE markreg_early_funnel_recommendations IS
  'MarkReg-owned immutable Recommendation versions with exact Intake and capability-source lineage. Recommendation is not customer selection or legal/professional approval.';
COMMENT ON TABLE markreg_early_funnel_selections IS
  'MarkReg-owned immutable User Selection artifacts. Selection is not Confirmation, Order, Filing Authorization, Payment or Official Truth.';
COMMENT ON TABLE markreg_early_funnel_quotes IS
  'MarkReg-owned immutable Quote versions with exact Intake/Recommendation/Selection/pricing-source lineage. Quote is not Confirmation, Order, Payment, filing or Official Truth.';
