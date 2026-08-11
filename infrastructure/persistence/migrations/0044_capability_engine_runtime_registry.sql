CREATE TABLE capability_runtime_identities (
 runtime_capability_definition_id text PRIMARY KEY CHECK (runtime_capability_definition_id ~ '^runtime-capability_[0-9a-f]{32}$'),
 capability_id text NOT NULL UNIQUE CHECK (btrim(capability_id) <> ''),
 created_at timestamptz NOT NULL
);

CREATE TABLE capability_runtime_definitions (
 runtime_capability_definition_id text NOT NULL,
 version integer NOT NULL CHECK (version > 0),
 capability_id text NOT NULL CHECK (btrim(capability_id) <> ''),
 capability_version text NOT NULL CHECK (btrim(capability_version) <> ''),
 title text NOT NULL CHECK (btrim(title) <> ''),
 description text NOT NULL CHECK (btrim(description) <> ''),
 domain_id text,
 skill_id text,
 action_id text,
 invocation_id text,
 canon_id text NOT NULL CHECK (btrim(canon_id) <> ''),
 canon_version text NOT NULL CHECK (btrim(canon_version) <> ''),
 source_fingerprint_sha256 text NOT NULL CHECK (source_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 definition_fingerprint_sha256 text NOT NULL CHECK (definition_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 accepted_canon_projection boolean NOT NULL CHECK (accepted_canon_projection = true),
 created_from_work_evidence boolean NOT NULL CHECK (created_from_work_evidence = false),
 created_from_ai_output boolean NOT NULL CHECK (created_from_ai_output = false),
 document_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY (runtime_capability_definition_id, version),
 UNIQUE (capability_id, capability_version),
 UNIQUE (capability_id, canon_id, canon_version),
 FOREIGN KEY (runtime_capability_definition_id)
  REFERENCES capability_runtime_identities(runtime_capability_definition_id),
 CHECK (domain_id IS NULL OR btrim(domain_id) <> ''),
 CHECK (skill_id IS NULL OR btrim(skill_id) <> ''),
 CHECK (action_id IS NULL OR btrim(action_id) <> ''),
 CHECK (invocation_id IS NULL OR btrim(invocation_id) <> '')
);

CREATE INDEX capability_runtime_definitions_current
 ON capability_runtime_definitions(capability_id, version DESC);

CREATE TABLE capability_runtime_definition_imports (
 idempotency_key text PRIMARY KEY CHECK (btrim(idempotency_key) <> ''),
 request_fingerprint_sha256 text NOT NULL CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 runtime_capability_definition_id text NOT NULL,
 runtime_capability_version integer NOT NULL CHECK (runtime_capability_version > 0),
 result_json jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 FOREIGN KEY (runtime_capability_definition_id, runtime_capability_version)
  REFERENCES capability_runtime_definitions(runtime_capability_definition_id, version)
);
