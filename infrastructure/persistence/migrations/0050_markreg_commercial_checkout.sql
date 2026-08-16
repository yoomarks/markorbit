CREATE TABLE commercial_products (
 product_id text PRIMARY KEY CHECK (product_id ~ '^product_[A-Za-z0-9_-]+$'),
 code text NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 1 AND 120),
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 240),
 service_type text NOT NULL CHECK (service_type = 'TrademarkFiling'),
 status text NOT NULL CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
 version integer NOT NULL CHECK (version >= 1),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);

CREATE INDEX commercial_products_status_code_idx
 ON commercial_products(status,code);

CREATE TABLE commercial_prices (
 price_id text PRIMARY KEY CHECK (price_id ~ '^price_[A-Za-z0-9_-]+$'),
 product_id text NOT NULL REFERENCES commercial_products(product_id),
 price_version integer NOT NULL CHECK (price_version >= 1),
 channel text NOT NULL CHECK (channel IN ('LITE_PROFESSIONAL','MARKREG_DIRECT','MARKREG_PARTNER_REFERRAL','MARKREG_WHITE_LABEL','INTERNAL_OPERATIONS')),
 relationship_model text NOT NULL CHECK (relationship_model IN ('DIRECT','CO_DELIVERY','WHITE_LABEL','REFERRAL','PLATFORM_ASSISTED')),
 amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
 currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
 status text NOT NULL CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz,
 created_at timestamptz NOT NULL,
 CHECK (valid_until IS NULL OR valid_until > valid_from),
 UNIQUE(product_id,channel,relationship_model,price_version)
);

CREATE INDEX commercial_prices_catalog_idx
 ON commercial_prices(channel,relationship_model,status,valid_from,valid_until,product_id);

CREATE TABLE checkout_sessions (
 checkout_session_id text PRIMARY KEY CHECK (checkout_session_id ~ '^checkout_[A-Za-z0-9_-]+$'),
 workspace_id uuid NOT NULL,
 order_id text NOT NULL REFERENCES orders(order_id),
 initiated_by_user_id text NOT NULL CHECK (char_length(initiated_by_user_id) BETWEEN 1 AND 200),
 product_id text NOT NULL REFERENCES commercial_products(product_id),
 product_version integer NOT NULL CHECK (product_version >= 1),
 price_id text NOT NULL REFERENCES commercial_prices(price_id),
 price_version integer NOT NULL CHECK (price_version >= 1),
 amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
 currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
 status text NOT NULL CHECK (status IN ('INITIATED','EXPIRED','CANCELLED')),
 version integer NOT NULL CHECK (version >= 1),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 cancelled_reason text,
 CHECK (expires_at > created_at),
 CHECK (status <> 'CANCELLED' OR cancelled_reason IS NOT NULL)
);

CREATE UNIQUE INDEX checkout_sessions_active_order_idx
 ON checkout_sessions(workspace_id,order_id)
 WHERE status='INITIATED';
CREATE INDEX checkout_sessions_workspace_created_idx
 ON checkout_sessions(workspace_id,created_at DESC,checkout_session_id ASC);

CREATE TABLE checkout_commands (
 workspace_id uuid NOT NULL,
 idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
 request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
 checkout_session_id text NOT NULL REFERENCES checkout_sessions(checkout_session_id),
 result_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,idempotency_key)
);

CREATE INDEX checkout_commands_checkout_idx
 ON checkout_commands(workspace_id,checkout_session_id,created_at DESC);
