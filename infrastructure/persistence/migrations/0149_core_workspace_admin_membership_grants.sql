ALTER TABLE core_workspace_admin_actions
  DROP CONSTRAINT core_workspace_admin_actions_action_check,
  ALTER COLUMN expected_workspace_version DROP NOT NULL,
  ALTER COLUMN resulting_workspace_version DROP NOT NULL,
  ALTER COLUMN result_workspace_json DROP NOT NULL,
  ADD COLUMN target_user_id uuid REFERENCES users(user_id),
  ADD COLUMN granted_role text CHECK (
    granted_role IS NULL OR granted_role IN ('WORKSPACE_ADMIN','MATTER_MANAGER','REVIEWER','READ_ONLY')
  ),
  ADD COLUMN result_membership_json jsonb CHECK (
    result_membership_json IS NULL OR jsonb_typeof(result_membership_json) = 'object'
  ),
  ADD CONSTRAINT core_workspace_admin_actions_action_check CHECK (
    action IN ('UPDATE_DISPLAY_NAME','GRANT_CURRENT_OPERATOR_MEMBERSHIP')
  ),
  ADD CONSTRAINT core_workspace_admin_actions_shape_check CHECK (
    (
      action = 'UPDATE_DISPLAY_NAME'
      AND expected_workspace_version IS NOT NULL
      AND resulting_workspace_version IS NOT NULL
      AND target_user_id IS NULL
      AND granted_role IS NULL
      AND result_workspace_json IS NOT NULL
      AND result_membership_json IS NULL
    ) OR (
      action = 'GRANT_CURRENT_OPERATOR_MEMBERSHIP'
      AND expected_workspace_version IS NULL
      AND resulting_workspace_version IS NULL
      AND target_user_id IS NOT NULL
      AND granted_role IS NOT NULL
      AND result_workspace_json IS NULL
      AND result_membership_json IS NOT NULL
    )
  );

CREATE INDEX core_workspace_admin_actions_target_user_created_idx
  ON core_workspace_admin_actions(target_user_id, created_at DESC)
  WHERE target_user_id IS NOT NULL;
