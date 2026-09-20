ALTER TABLE execution_protected_action_authorizations
  DROP CONSTRAINT execution_protected_action_authorizations_action_kind_check;

ALTER TABLE execution_protected_action_authorizations
  ADD CONSTRAINT execution_protected_action_authorizations_action_kind_check
  CHECK (action_kind IN ('TRADING_LISTING_PUBLISH','EMAIL_CAMPAIGN_SEND','NOTIFICATION_SEND'));

ALTER TABLE execution_protected_action_releases
  DROP CONSTRAINT execution_protected_action_releases_action_kind_check;

ALTER TABLE execution_protected_action_releases
  ADD CONSTRAINT execution_protected_action_releases_action_kind_check
  CHECK (action_kind IN ('TRADING_LISTING_PUBLISH','EMAIL_CAMPAIGN_SEND','NOTIFICATION_SEND'));

ALTER TABLE execution_protected_action_authorizations
  ALTER COLUMN receipt_id DROP NOT NULL,
  ALTER COLUMN receipt_version DROP NOT NULL;

ALTER TABLE execution_protected_action_authorizations
  ADD CONSTRAINT execution_protected_action_authorizations_receipt_semantics_check
  CHECK (
    (action_kind IN ('TRADING_LISTING_PUBLISH','EMAIL_CAMPAIGN_SEND')
      AND receipt_id IS NOT NULL AND receipt_version = 1)
    OR
    (action_kind = 'NOTIFICATION_SEND'
      AND receipt_id IS NULL AND receipt_version IS NULL)
  );

COMMENT ON TABLE execution_protected_action_authorizations IS
  'Execution-owned external-action authorizations. Automated NOTIFICATION_SEND binds verified rule activation evidence rather than fabricating a per-send HUMAN_USER receipt; no raw endpoint/message/provider credential is stored as scalar authority truth.';
CREATE UNIQUE INDEX execution_protected_notification_release_effect_unique
  ON execution_protected_action_releases (workspace_id, action_kind, effect_fingerprint_sha256)
  WHERE action_kind = 'NOTIFICATION_SEND';

COMMENT ON INDEX execution_protected_notification_release_effect_unique IS
  'Exactly one immutable NOTIFICATION_SEND release may exist per Workspace and deterministic effect fingerprint, even if callers race or obtain multiple short-lived authorizations.';
