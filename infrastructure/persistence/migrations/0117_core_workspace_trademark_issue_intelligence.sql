CREATE TABLE IF NOT EXISTS core_workspace_trademark_issue_intelligence (
  workspace_id uuid NOT NULL,
  intelligence_id text NOT NULL,
  schema_version smallint NOT NULL CHECK (schema_version = 1),
  task text NOT NULL CHECK (task = 'TRADEMARK_ISSUE_EXTRACTION'),
  status text NOT NULL CHECK (
    status IN ('INTERPRETED', 'INSUFFICIENT_EVIDENCE', 'CONFLICTED')
  ),
  snapshot_sha256 char(64) NOT NULL CHECK (
    snapshot_sha256 ~ '^[0-9a-f]{64}$'
  ),
  intelligence_json jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (workspace_id, intelligence_id)
);

CREATE INDEX IF NOT EXISTS core_workspace_trademark_issue_intelligence_workspace_time_idx
  ON core_workspace_trademark_issue_intelligence(workspace_id, generated_at DESC);
