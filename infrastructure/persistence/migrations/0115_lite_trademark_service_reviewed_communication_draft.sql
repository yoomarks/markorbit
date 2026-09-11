-- LITE-AGENCY P7-B1: keep reviewed communication drafts inside the existing
-- versioned Trademark Service Work Package owner. This migration only gives the
-- existing command ledger an honest command type for that bounded mutation.
ALTER TABLE lite_trademark_service_work_package_commands
  DROP CONSTRAINT lite_trademark_service_work_package_commands_command_type_check;

ALTER TABLE lite_trademark_service_work_package_commands
  ADD CONSTRAINT lite_trademark_service_work_package_commands_command_type_check
  CHECK (
    command_type IN (
      'CREATE_WORK_PACKAGE',
      'UPDATE_CONTEXT',
      'SAVE_REVIEWED_COMMUNICATION_DRAFT'
    )
  );
