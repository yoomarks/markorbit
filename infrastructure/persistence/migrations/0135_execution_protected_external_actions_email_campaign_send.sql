ALTER TABLE execution_protected_action_authorizations
  DROP CONSTRAINT execution_protected_action_authorizations_action_kind_check;

ALTER TABLE execution_protected_action_authorizations
  ADD CONSTRAINT execution_protected_action_authorizations_action_kind_check
  CHECK (action_kind IN ('TRADING_LISTING_PUBLISH','EMAIL_CAMPAIGN_SEND'));

ALTER TABLE execution_protected_action_releases
  DROP CONSTRAINT execution_protected_action_releases_action_kind_check;

ALTER TABLE execution_protected_action_releases
  ADD CONSTRAINT execution_protected_action_releases_action_kind_check
  CHECK (action_kind IN ('TRADING_LISTING_PUBLISH','EMAIL_CAMPAIGN_SEND'));
