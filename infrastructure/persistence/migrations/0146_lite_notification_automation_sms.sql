ALTER TABLE lite_notification_automation_rule_versions
  DROP CONSTRAINT IF EXISTS lite_notification_automation_rule_versions_feature_key_check,
  ALTER COLUMN sender_profile_id DROP NOT NULL,
  ALTER COLUMN sender_profile_version DROP NOT NULL,
  ALTER COLUMN sender_profile_fingerprint_sha256 DROP NOT NULL,
  ADD COLUMN channel_identity_binding_id text
    CHECK (channel_identity_binding_id ~ '^workspace-channel-identity-binding_[A-Za-z0-9_-]+$'),
  ADD COLUMN channel_identity_binding_version integer
    CHECK (channel_identity_binding_version > 0),
  ADD COLUMN channel_identity_binding_fingerprint_sha256 text
    CHECK (channel_identity_binding_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN contact_policy_id text
    CHECK (btrim(contact_policy_id) <> '' AND char_length(contact_policy_id) <= 240),
  ADD COLUMN contact_policy_version integer
    CHECK (contact_policy_version > 0),
  ADD CONSTRAINT lite_notification_automation_rule_versions_feature_key_check
    CHECK (feature_key IN ('EMAIL_NOTIFICATION','SMS_WORKSPACE_NOTIFICATION')),
  ADD CONSTRAINT lite_notification_automation_rule_versions_sender_provenance_check
    CHECK (
      (feature_key='EMAIL_NOTIFICATION'
        AND sender_profile_id IS NOT NULL
        AND sender_profile_version IS NOT NULL
        AND sender_profile_fingerprint_sha256 IS NOT NULL
        AND channel_identity_binding_id IS NULL
        AND channel_identity_binding_version IS NULL
        AND channel_identity_binding_fingerprint_sha256 IS NULL
        AND contact_policy_id IS NULL
        AND contact_policy_version IS NULL)
      OR
      (feature_key='SMS_WORKSPACE_NOTIFICATION'
        AND sender_profile_id IS NULL
        AND sender_profile_version IS NULL
        AND sender_profile_fingerprint_sha256 IS NULL
        AND channel_identity_binding_id IS NOT NULL
        AND channel_identity_binding_version IS NOT NULL
        AND channel_identity_binding_fingerprint_sha256 IS NOT NULL
        AND contact_policy_id IS NOT NULL
        AND contact_policy_version IS NOT NULL)
    );

ALTER TABLE lite_notification_automation_rule_heads
  DROP CONSTRAINT IF EXISTS lite_notification_automation_rule_heads_feature_key_check,
  ALTER COLUMN sender_profile_id DROP NOT NULL,
  ALTER COLUMN sender_profile_version DROP NOT NULL,
  ALTER COLUMN sender_profile_fingerprint_sha256 DROP NOT NULL,
  ADD COLUMN channel_identity_binding_id text
    CHECK (channel_identity_binding_id ~ '^workspace-channel-identity-binding_[A-Za-z0-9_-]+$'),
  ADD COLUMN channel_identity_binding_version integer
    CHECK (channel_identity_binding_version > 0),
  ADD COLUMN channel_identity_binding_fingerprint_sha256 text
    CHECK (channel_identity_binding_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN contact_policy_id text
    CHECK (btrim(contact_policy_id) <> '' AND char_length(contact_policy_id) <= 240),
  ADD COLUMN contact_policy_version integer
    CHECK (contact_policy_version > 0),
  ADD CONSTRAINT lite_notification_automation_rule_heads_feature_key_check
    CHECK (feature_key IN ('EMAIL_NOTIFICATION','SMS_WORKSPACE_NOTIFICATION')),
  ADD CONSTRAINT lite_notification_automation_rule_heads_sender_provenance_check
    CHECK (
      (feature_key='EMAIL_NOTIFICATION'
        AND sender_profile_id IS NOT NULL
        AND sender_profile_version IS NOT NULL
        AND sender_profile_fingerprint_sha256 IS NOT NULL
        AND channel_identity_binding_id IS NULL
        AND channel_identity_binding_version IS NULL
        AND channel_identity_binding_fingerprint_sha256 IS NULL
        AND contact_policy_id IS NULL
        AND contact_policy_version IS NULL)
      OR
      (feature_key='SMS_WORKSPACE_NOTIFICATION'
        AND sender_profile_id IS NULL
        AND sender_profile_version IS NULL
        AND sender_profile_fingerprint_sha256 IS NULL
        AND channel_identity_binding_id IS NOT NULL
        AND channel_identity_binding_version IS NOT NULL
        AND channel_identity_binding_fingerprint_sha256 IS NOT NULL
        AND contact_policy_id IS NOT NULL
        AND contact_policy_version IS NOT NULL)
    );
