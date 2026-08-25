CREATE TABLE IF NOT EXISTS capability_managed_ai_exact_outputs (
  output_ref text PRIMARY KEY,
  execution_id text NOT NULL UNIQUE,
  media_type text NOT NULL,
  sha256 char(64) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  exact_bytes bytea NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT capability_managed_ai_exact_outputs_ref_v1
    CHECK (output_ref = 'managed-ai-output:v1:' || execution_id),
  CONSTRAINT capability_managed_ai_exact_outputs_execution_id_v1
    CHECK (execution_id ~ '^maiexec_[a-f0-9]{32}$'),
  CONSTRAINT capability_managed_ai_exact_outputs_sha256_v1
    CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT capability_managed_ai_exact_outputs_size_v1
    CHECK (octet_length(exact_bytes) = size_bytes)
);

COMMENT ON TABLE capability_managed_ai_exact_outputs IS
  'Immutable exact provider bytes for governed Managed AI executions. Rows are execution-addressed and resolved only through authenticated internal routes.';
