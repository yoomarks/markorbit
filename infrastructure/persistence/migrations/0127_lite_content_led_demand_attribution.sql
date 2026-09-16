ALTER TABLE lite_business_attribution_links
  DROP CONSTRAINT lite_business_attribution_links_motion_kind_check;

ALTER TABLE lite_business_attribution_links
  ADD CONSTRAINT lite_business_attribution_links_motion_kind_check
  CHECK (
    motion_kind IN (
      'DATA_PROSPECTING',
      'PORTFOLIO_GROWTH',
      'PARTNER_DEVELOPMENT',
      'SITE_INBOUND',
      'CONTENT_LED_DEMAND'
    )
  );
