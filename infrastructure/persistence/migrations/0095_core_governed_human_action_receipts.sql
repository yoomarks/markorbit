CREATE TABLE core_governed_human_action_receipts (
  receipt_id uuid PRIMARY KEY,
  receipt_version integer NOT NULL CHECK (receipt_version = 1),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  principal_reference text NOT NULL CHECK (length(principal_reference) BETWEEN 1 AND 512),
  action_kind text NOT NULL CHECK (action_kind IN ('PROVIDER_SELECTION', 'CONTROLLED_HANDOFF')),
  mutation_route text NOT NULL CHECK (length(mutation_route) BETWEEN 1 AND 512),
  reviewed_action_digest text NOT NULL CHECK (reviewed_action_digest ~ '^[0-9a-f]{64}$'),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 256),
  authenticated_at timestamptz NOT NULL,
  workspace_version integer NOT NULL CHECK (workspace_version >= 1),
  user_version integer NOT NULL CHECK (user_version >= 1),
  membership_version integer NOT NULL CHECK (membership_version >= 1),
  created_at timestamptz NOT NULL,
  CONSTRAINT core_governed_human_action_receipts_workspace_idempotency_key
    UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX core_governed_human_action_receipts_subject_idx
  ON core_governed_human_action_receipts(workspace_id, user_id, membership_id, created_at DESC);

COMMENT ON TABLE core_governed_human_action_receipts IS
  'Core-owned immutable attestations that an exact reviewed authenticated HUMAN_USER governed-network action was affirmed. Raw action payloads are intentionally not stored.';
