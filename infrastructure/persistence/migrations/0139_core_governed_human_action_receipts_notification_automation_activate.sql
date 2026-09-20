ALTER TABLE core_governed_human_action_receipts
  DROP CONSTRAINT core_governed_human_action_receipts_action_kind_check;

ALTER TABLE core_governed_human_action_receipts
  ADD CONSTRAINT core_governed_human_action_receipts_action_kind_check
  CHECK (
    action_kind IN (
      'PROVIDER_SELECTION',
      'CONTROLLED_HANDOFF',
      'TRADING_LISTING_PUBLISH',
      'EMAIL_CAMPAIGN_SEND',
      'NOTIFICATION_AUTOMATION_ACTIVATE'
    )
  );

COMMENT ON TABLE core_governed_human_action_receipts IS
  'Durable bounded HUMAN_USER authority receipts. Notification activation binds only an exact rule transition digest; rule documents, endpoints, message payloads, provider credentials, and send authority remain outside Core.';