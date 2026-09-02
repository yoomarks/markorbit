-- Establish forward-only stable ContentOpportunity lineage for Visual Briefs.
-- Legacy rows intentionally remain NULL when historical lineage cannot be proven.
-- This migration performs no backfill and does not infer lineage from current Daily Orbit state.
-- Lineage is discoverability metadata only; it grants no generation, provider, QC, publish,
-- payment, filing, customer-contact, or Official Truth authority.

ALTER TABLE lite_visual_briefs
  ADD COLUMN content_opportunity_id text NULL,
  ADD COLUMN content_opportunity_version integer NULL;

ALTER TABLE lite_visual_briefs
  ADD CONSTRAINT lite_visual_briefs_content_opportunity_lineage_pair
  CHECK (
    (content_opportunity_id IS NULL AND content_opportunity_version IS NULL)
    OR (
      content_opportunity_id IS NOT NULL
      AND btrim(content_opportunity_id) <> ''
      AND content_opportunity_version IS NOT NULL
      AND content_opportunity_version >= 1
    )
  ),
  ADD CONSTRAINT lite_visual_briefs_content_opportunity_lineage_fk
  FOREIGN KEY (workspace_id, content_opportunity_id, content_opportunity_version)
    REFERENCES lite_content_opportunities(workspace_id, content_opportunity_id, version);

CREATE INDEX lite_visual_briefs_content_opportunity
  ON lite_visual_briefs(
    workspace_id,
    content_opportunity_id,
    content_opportunity_version,
    created_at DESC,
    visual_brief_id,
    version
  )
  WHERE content_opportunity_id IS NOT NULL;
