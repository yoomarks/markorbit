CREATE TABLE account_profiles (
 user_id uuid PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
 account_type text NOT NULL CHECK (account_type IN ('CUSTOMER','PROFESSIONAL','PROVIDER','INTERNAL')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE password_credentials (
 user_id uuid PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
 password_hash text NOT NULL CHECK (btrim(password_hash) <> ''),
 password_changed_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
