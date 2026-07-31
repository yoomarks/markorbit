CREATE TABLE sessions (
 session_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(user_id),
 token_hash text NOT NULL CONSTRAINT sessions_token_hash_key UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CONSTRAINT sessions_expiry_after_creation CHECK (expires_at > created_at),
 CONSTRAINT sessions_revocation_consistent CHECK ((status='ACTIVE' AND revoked_at IS NULL) OR (status='REVOKED' AND revoked_at IS NOT NULL))
);
CREATE INDEX sessions_user_status_idx ON sessions(user_id,status);
CREATE INDEX sessions_status_expiry_idx ON sessions(status,expires_at);
