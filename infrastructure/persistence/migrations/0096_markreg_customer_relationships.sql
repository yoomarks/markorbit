-- MarkReg-owned canonical Workspace customer relationship identity.
-- V1 is deliberately not a CRM, legal-identity registry, consent store, or work-state aggregate.
CREATE TABLE markreg_customer_relationships (
  workspace_id uuid NOT NULL,
  customer_relationship_id text NOT NULL
    CHECK (customer_relationship_id ~ '^customer-relationship_[A-Za-z0-9_-]+$'),
  display_name text NOT NULL
    CHECK (length(btrim(display_name)) BETWEEN 1 AND 240),
  relationship_model text NOT NULL
    CHECK (relationship_model IN ('DIRECT','CO_DELIVERY','WHITE_LABEL','REFERRAL','PLATFORM_ASSISTED')),
  identity_status text NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (identity_status = 'UNVERIFIED'),
  origin text NOT NULL DEFAULT 'WORKSPACE_EXPLICIT'
    CHECK (origin = 'WORKSPACE_EXPLICIT'),
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','ARCHIVED')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_principal_id text NOT NULL
    CHECK (length(btrim(created_by_principal_id)) BETWEEN 1 AND 300),
  updated_by_principal_id text NOT NULL
    CHECK (length(btrim(updated_by_principal_id)) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz,
  PRIMARY KEY (workspace_id, customer_relationship_id),
  UNIQUE (customer_relationship_id),
  CHECK (updated_at >= created_at),
  CHECK ((status = 'ACTIVE' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL))
);
CREATE INDEX markreg_customer_relationships_workspace_updated_idx
  ON markreg_customer_relationships(workspace_id, updated_at DESC, customer_relationship_id);
CREATE INDEX markreg_customer_relationships_workspace_status_idx
  ON markreg_customer_relationships(workspace_id, status, updated_at DESC, customer_relationship_id);

CREATE TABLE markreg_customer_relationship_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL
    CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 300),
  request_fingerprint_sha256 char(64) NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  command_type text NOT NULL CHECK (command_type = 'CREATE'),
  customer_relationship_id text NOT NULL,
  result_version integer NOT NULL CHECK (result_version > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, customer_relationship_id)
    REFERENCES markreg_customer_relationships(workspace_id, customer_relationship_id)
    ON DELETE RESTRICT
);

CREATE INDEX markreg_customer_relationship_commands_relationship_idx
  ON markreg_customer_relationship_commands(
    workspace_id, customer_relationship_id, created_at DESC
  );