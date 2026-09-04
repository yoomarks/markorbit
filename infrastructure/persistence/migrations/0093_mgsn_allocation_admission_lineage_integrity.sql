-- Tighten exact Controlled Handoff lineage to fail closed on nullable validation descriptors.
-- Additive integrity only; no Allocation/Handoff/Selection state is created, rewritten or backfilled.

ALTER TABLE mgsn_allocation_admission_lineages
  ADD CONSTRAINT mgsn_allocation_admission_lineages_exact_handoff_policy_required
  CHECK (
    handoff_binding_state <> 'EXACT_CONTROLLED_HANDOFF'
    OR handoff_validation_policy_version IS NOT NULL
  ),
  ADD CONSTRAINT mgsn_allocation_admission_lineages_exact_handoff_authorities_required
  CHECK (
    handoff_binding_state <> 'EXACT_CONTROLLED_HANDOFF'
    OR handoff_validation_checked_authority_references IS NOT NULL
  );
