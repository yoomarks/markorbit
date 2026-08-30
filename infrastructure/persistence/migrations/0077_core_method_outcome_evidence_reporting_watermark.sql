ALTER TABLE core_method_outcome_evidence
  ADD COLUMN IF NOT EXISTS admission_sequence bigint GENERATED ALWAYS AS IDENTITY;

CREATE UNIQUE INDEX IF NOT EXISTS core_method_outcome_evidence_admission_sequence_idx
  ON core_method_outcome_evidence (admission_sequence);
