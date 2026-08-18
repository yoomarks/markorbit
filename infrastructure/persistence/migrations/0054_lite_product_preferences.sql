CREATE TABLE lite_product_preference_events (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  product_preference_event_id text NOT NULL CHECK (btrim(product_preference_event_id) <> ''),
  subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
  kind text NOT NULL CHECK (kind IN (
    'SHOWN','OPENED','DISMISSED','SAVED','CONTENT_STARTED','ANGLE_SELECTED',
    'PLATFORM_VARIANT_GENERATED','DRAFT_EDITED','VISUAL_REQUESTED','VISUAL_GENERATED','VISUAL_SELECTED',
    'COPIED','EXPORTED','USER_REPORTED_PUBLISHED','USER_REPORTED_USED','NOT_USED'
  )),
  target_type text NOT NULL CHECK (target_type IN (
    'DAILY_ORBIT_ITEM','CONTENT_PICK','CONTENT_KIT','PLATFORM_VARIANT','VISUAL_OUTPUT'
  )),
  target_id text NOT NULL CHECK (btrim(target_id) <> ''),
  target_version text NOT NULL CHECK (btrim(target_version) <> ''),
  context_json jsonb NOT NULL,
  document_json jsonb NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, product_preference_event_id)
);

CREATE INDEX lite_product_preference_events_subject_recent
  ON lite_product_preference_events(workspace_id, subject_user_id, recorded_at DESC, product_preference_event_id);

CREATE INDEX lite_product_preference_events_target
  ON lite_product_preference_events(workspace_id, subject_user_id, target_type, target_id, target_version);

CREATE TABLE lite_creator_preferences (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
  creator_preference_id text NOT NULL CHECK (btrim(creator_preference_id) <> ''),
  version integer NOT NULL CHECK (version >= 1),
  source text NOT NULL CHECK (source = 'PRODUCT_FEEDBACK'),
  document_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, subject_user_id)
);

CREATE UNIQUE INDEX lite_creator_preferences_identity
  ON lite_creator_preferences(workspace_id, creator_preference_id);

CREATE TABLE lite_product_preference_commands (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  subject_user_id text NOT NULL CHECK (btrim(subject_user_id) <> ''),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  command_type text NOT NULL CHECK (command_type = 'RECORD_PRODUCT_PREFERENCE_EVENT'),
  request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, subject_user_id, idempotency_key)
);
