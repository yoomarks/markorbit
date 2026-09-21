ALTER TABLE lite_outbound_contact_basis_versions
  ADD COLUMN channel text;
UPDATE lite_outbound_contact_basis_versions SET channel='EMAIL' WHERE channel IS NULL;
ALTER TABLE lite_outbound_contact_basis_versions
  ALTER COLUMN channel SET NOT NULL,
  ADD CONSTRAINT lite_outbound_contact_basis_versions_channel_check
    CHECK (channel IN ('EMAIL','SMS')),
  DROP CONSTRAINT lite_outbound_contact_basis_versions_purpose_check,
  ADD CONSTRAINT lite_outbound_contact_basis_versions_purpose_check
    CHECK (purpose IN (
      'PROSPECT_OUTREACH','PARTNER_OUTREACH','EDUCATION_INVITATION','WORKSPACE_NOTIFICATION'
    )),
  ADD CONSTRAINT lite_outbound_contact_basis_versions_channel_purpose_check
    CHECK (
      (channel='EMAIL' AND purpose IN ('PROSPECT_OUTREACH','PARTNER_OUTREACH','EDUCATION_INVITATION'))
      OR (channel='SMS' AND purpose='WORKSPACE_NOTIFICATION')
    );

ALTER TABLE lite_outbound_contact_basis_heads
  ADD COLUMN channel text NOT NULL DEFAULT 'EMAIL';
ALTER TABLE lite_outbound_contact_basis_heads
  ALTER COLUMN channel DROP DEFAULT,
  DROP CONSTRAINT lite_outbound_contact_basis_heads_pkey,
  ADD CONSTRAINT lite_outbound_contact_basis_heads_pkey
    PRIMARY KEY(workspace_id,channel,target_fingerprint_sha256,endpoint_fingerprint_sha256,purpose),
  ADD CONSTRAINT lite_outbound_contact_basis_heads_channel_check
    CHECK (channel IN ('EMAIL','SMS')),
  ADD CONSTRAINT lite_outbound_contact_basis_heads_channel_purpose_check
    CHECK (
      (channel='EMAIL' AND purpose IN ('PROSPECT_OUTREACH','PARTNER_OUTREACH','EDUCATION_INVITATION'))
      OR (channel='SMS' AND purpose='WORKSPACE_NOTIFICATION')
    );

DROP INDEX lite_outbound_basis_endpoint;
CREATE INDEX lite_outbound_basis_endpoint
  ON lite_outbound_contact_basis_heads(workspace_id,channel,endpoint_fingerprint_sha256,purpose);

ALTER TABLE lite_outbound_contact_suppression_versions
  ADD COLUMN channel text;
UPDATE lite_outbound_contact_suppression_versions SET channel='EMAIL' WHERE channel IS NULL;
ALTER TABLE lite_outbound_contact_suppression_versions
  ALTER COLUMN channel SET NOT NULL,
  ADD CONSTRAINT lite_outbound_contact_suppression_versions_channel_check
    CHECK (channel IN ('EMAIL','SMS')),
  DROP CONSTRAINT lite_outbound_contact_suppression_versions_scope_check,
  ADD CONSTRAINT lite_outbound_contact_suppression_versions_scope_check
    CHECK (scope IN (
      'ALL_OUTBOUND','PROSPECT_OUTREACH','PARTNER_OUTREACH','EDUCATION_INVITATION',
      'WORKSPACE_NOTIFICATION'
    )),
  ADD CONSTRAINT lite_outbound_contact_suppression_versions_channel_scope_check
    CHECK (
      scope='ALL_OUTBOUND'
      OR (channel='EMAIL' AND scope IN ('PROSPECT_OUTREACH','PARTNER_OUTREACH','EDUCATION_INVITATION'))
      OR (channel='SMS' AND scope='WORKSPACE_NOTIFICATION')
    );

ALTER TABLE lite_outbound_contact_suppression_heads
  ADD COLUMN channel text NOT NULL DEFAULT 'EMAIL';
ALTER TABLE lite_outbound_contact_suppression_heads
  ALTER COLUMN channel DROP DEFAULT,
  DROP CONSTRAINT lite_outbound_contact_suppression_heads_pkey,
  ADD CONSTRAINT lite_outbound_contact_suppression_heads_pkey
    PRIMARY KEY(workspace_id,channel,endpoint_fingerprint_sha256,scope),
  ADD CONSTRAINT lite_outbound_contact_suppression_heads_channel_check
    CHECK (channel IN ('EMAIL','SMS')),
  ADD CONSTRAINT lite_outbound_contact_suppression_heads_channel_scope_check
    CHECK (
      scope='ALL_OUTBOUND'
      OR (channel='EMAIL' AND scope IN ('PROSPECT_OUTREACH','PARTNER_OUTREACH','EDUCATION_INVITATION'))
      OR (channel='SMS' AND scope='WORKSPACE_NOTIFICATION')
    );

DROP INDEX lite_outbound_suppression_endpoint;
CREATE INDEX lite_outbound_suppression_endpoint
  ON lite_outbound_contact_suppression_heads(workspace_id,channel,endpoint_fingerprint_sha256,scope);
