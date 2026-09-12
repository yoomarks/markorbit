-- LITE-AGENCY P7-B2: align the existing PreparedAction PostgreSQL owner with
-- the already-merged governed client-notification contract vocabulary.
ALTER TABLE lite_prepared_actions
  DROP CONSTRAINT lite_prepared_actions_kind_check,
  DROP CONSTRAINT lite_prepared_actions_handoff_target_check;

ALTER TABLE lite_prepared_actions
  ADD CONSTRAINT lite_prepared_actions_kind_check
    CHECK (kind IN (
      'PREPARE_CONTENT',
      'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      'START_MARKREG_INTAKE',
      'PREPARE_CLIENT_NOTIFICATION'
    )),
  ADD CONSTRAINT lite_prepared_actions_handoff_target_check
    CHECK (handoff_target IN (
      'LITE_CONTENT_PREPARATION',
      'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      'MARKREG_INTAKE',
      'MANAGED_COMMUNICATION_CLIENT_NOTIFICATION'
    ));

ALTER TABLE lite_prepared_action_handoff_results
  DROP CONSTRAINT lite_prepared_action_handoff_results_handoff_target_check,
  DROP CONSTRAINT lite_prepared_action_handoff_results_owner_check;

ALTER TABLE lite_prepared_action_handoff_results
  ADD CONSTRAINT lite_prepared_action_handoff_results_handoff_target_check
    CHECK (handoff_target IN (
      'LITE_CONTENT_PREPARATION',
      'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      'MARKREG_INTAKE',
      'MANAGED_COMMUNICATION_CLIENT_NOTIFICATION'
    )),
  ADD CONSTRAINT lite_prepared_action_handoff_results_owner_check
    CHECK (owner IN ('LITE', 'MARKREG', 'MANAGED_COMMUNICATION'));
