CREATE TABLE users (
 user_id uuid PRIMARY KEY, email text NOT NULL, normalized_email text NOT NULL,
 display_name text NOT NULL CHECK (btrim(display_name) <> ''),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT users_normalized_email_key UNIQUE(normalized_email)
);
CREATE TABLE workspaces (
 workspace_id uuid PRIMARY KEY, name text NOT NULL CHECK (btrim(name) <> ''), slug text NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT workspaces_slug_key UNIQUE(slug)
);
CREATE TABLE workspace_memberships (
 membership_id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(workspace_id), user_id uuid NOT NULL REFERENCES users(user_id),
 role text NOT NULL CHECK (role IN ('WORKSPACE_ADMIN','MATTER_MANAGER','REVIEWER','READ_ONLY')),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED')),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT workspace_memberships_workspace_user_key UNIQUE(workspace_id,user_id)
);
