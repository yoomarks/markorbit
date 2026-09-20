CREATE TABLE lite_notification_delivery_attempts (
  workspace_id uuid NOT NULL,
  notification_delivery_attempt_id text NOT NULL,
  execution_release_id text NOT NULL,
  effect_fingerprint_sha256 text NOT NULL CHECK (effect_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('PLANNED','SUBMITTING','ACCEPTED','FAILED','UNKNOWN')),
  provider_submission_ref text,
  attempt_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, notification_delivery_attempt_id),
  UNIQUE (workspace_id, execution_release_id),
  UNIQUE (workspace_id, effect_fingerprint_sha256)
);

CREATE TABLE lite_notification_delivery_observations (
  workspace_id uuid NOT NULL,
  notification_delivery_observation_id text NOT NULL,
  notification_delivery_attempt_id text NOT NULL,
  event_identity text NOT NULL,
  event text NOT NULL CHECK (event IN ('ACCEPTED','DELIVERED','HARD_BOUNCED','SOFT_BOUNCED','COMPLAINED','FAILED','UNKNOWN')),
  observation_json jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, notification_delivery_observation_id),
  UNIQUE (workspace_id, event_identity),
  FOREIGN KEY (workspace_id, notification_delivery_attempt_id)
    REFERENCES lite_notification_delivery_attempts(workspace_id, notification_delivery_attempt_id)
);

CREATE UNIQUE INDEX lite_notification_delivery_attempts_provider_ref_idx
  ON lite_notification_delivery_attempts(workspace_id, provider_submission_ref)
  WHERE provider_submission_ref IS NOT NULL;
