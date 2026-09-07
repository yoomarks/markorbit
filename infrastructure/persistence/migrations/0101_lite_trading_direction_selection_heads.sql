CREATE TABLE lite_trading_direction_selection_heads (
  workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id),
  direction_set_id text NOT NULL,
  direction_selection_id text NOT NULL,
  direction_selection_version integer NOT NULL CHECK (direction_selection_version > 0),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, direction_set_id),
  FOREIGN KEY (workspace_id, direction_selection_id, direction_selection_version)
    REFERENCES lite_trading_direction_selection_versions(workspace_id, direction_selection_id, version)
    ON DELETE CASCADE
);

INSERT INTO lite_trading_direction_selection_heads(
  workspace_id,direction_set_id,direction_selection_id,direction_selection_version,updated_at
)
SELECT workspace_id,direction_set_id,direction_selection_id,version,recorded_at
FROM (
  SELECT DISTINCT ON (workspace_id,direction_set_id) *
  FROM lite_trading_direction_selection_versions
  ORDER BY workspace_id,direction_set_id,recorded_at DESC,version DESC
) latest
WHERE status='CURRENT';
