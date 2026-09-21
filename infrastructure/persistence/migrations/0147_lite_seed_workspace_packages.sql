CREATE TABLE lite_seed_workspace_packages (
  seed_workspace_package_id text PRIMARY KEY
    CHECK (seed_workspace_package_id ~ '^seed-workspace-package_[A-Za-z0-9_-]+$'),
  prepared_by_workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version = 1),
  stage text NOT NULL CHECK (stage = 'PREPARED'),
  package_fingerprint_sha256 text NOT NULL
    CHECK (package_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  document_json jsonb NOT NULL,
  prepared_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > prepared_at)
);

CREATE INDEX lite_seed_workspace_packages_preparer_idx
  ON lite_seed_workspace_packages (
    prepared_by_workspace_id,
    prepared_at DESC,
    seed_workspace_package_id
  );

CREATE INDEX lite_seed_workspace_packages_expiry_idx
  ON lite_seed_workspace_packages (expires_at, seed_workspace_package_id);

CREATE TABLE lite_seed_workspace_claims (
  seed_workspace_package_id text PRIMARY KEY
    REFERENCES lite_seed_workspace_packages(seed_workspace_package_id) ON DELETE RESTRICT,
  education_community_journey_id text NOT NULL UNIQUE
    REFERENCES lite_education_community_journey_heads(education_community_journey_id)
    ON DELETE RESTRICT,
  activated_workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  claiming_principal_id text NOT NULL,
  journey_version integer NOT NULL CHECK (journey_version >= 3),
  journey_fingerprint_sha256 text NOT NULL
    CHECK (journey_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  workspace_activation_version integer NOT NULL CHECK (workspace_activation_version >= 1),
  workspace_activation_fingerprint_sha256 text NOT NULL
    CHECK (workspace_activation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  workspace_activation_observed_at timestamptz NOT NULL,
  claimed_at timestamptz NOT NULL
);

CREATE INDEX lite_seed_workspace_claims_workspace_idx
  ON lite_seed_workspace_claims (
    activated_workspace_id,
    claimed_at DESC,
    seed_workspace_package_id
  );
