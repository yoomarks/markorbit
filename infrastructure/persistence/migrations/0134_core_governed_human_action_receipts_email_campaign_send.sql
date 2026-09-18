ALTER TABLE core_governed_human_action_receipts
  DROP CONSTRAINT core_governed_human_action_receipts_action_kind_check;

ALTER TABLE core_governed_human_action_receipts
  ADD CONSTRAINT core_governed_human_action_receipts_action_kind_check
  CHECK (
    action_kind IN (
      'PROVIDER_SELECTION',
      'CONTROLLED_HANDOFF',
      'TRADING_LISTING_PUBLISH',
      'EMAIL_CAMPAIGN_SEND'
    )
  );

COMMENT ON TABLE core_governed_human_action_receipts IS
  'Core-owned immutable attestations that an exact reviewed authenticated HUMAN_USER governed action was affirmed. Raw action payloads, recipient emails, provider credentials and execution authority are intentionally not stored.';
