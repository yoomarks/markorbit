CREATE TABLE orders (
 order_id text PRIMARY KEY CHECK (order_id ~ '^order_[A-Za-z0-9_-]+$'),
 workspace_id uuid NOT NULL,
 order_type text NOT NULL CHECK (order_type = 'TrademarkFiling'),
 status text NOT NULL CHECK (status IN ('Draft','PendingConfirmation','Confirmed','ReadyForMatter','MatterCreated','InProgress','WaitingForCustomer','Completed','Cancelled','Archived','DeletedReferenceOnly')),
 version integer NOT NULL CHECK (version >= 1),
 customer_id text NOT NULL,
 channel text NOT NULL,
 relationship_model text NOT NULL,
 source_quote_id text NOT NULL,
 source_quote_version text NOT NULL,
 source_customer_confirmation_id text NOT NULL,
 source_customer_confirmation_version integer NOT NULL CHECK (source_customer_confirmation_version >= 1),
 commercial_source_snapshot jsonb NOT NULL,
 commercial_source_snapshot_sha256 text NOT NULL CHECK (commercial_source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 matter_reference jsonb,
 created_by_user_id text NOT NULL,
 updated_by_user_id text NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 CHECK (status <> 'MatterCreated' OR matter_reference IS NOT NULL),
 UNIQUE(workspace_id,source_quote_id,source_quote_version,source_customer_confirmation_id,source_customer_confirmation_version)
);

CREATE INDEX orders_workspace_updated_idx ON orders(workspace_id,updated_at DESC,order_id ASC);
CREATE INDEX orders_workspace_customer_idx ON orders(workspace_id,customer_id,updated_at DESC);

CREATE TABLE order_commands (
 workspace_id uuid NOT NULL,
 idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
 request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
 order_id text NOT NULL REFERENCES orders(order_id),
 command_type text NOT NULL CHECK (command_type IN ('CREATE','UPDATE')),
 result_version integer NOT NULL CHECK (result_version >= 1),
 result_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,idempotency_key)
);
CREATE INDEX order_commands_order_idx ON order_commands(workspace_id,order_id,created_at DESC);

CREATE TABLE order_audit (
 audit_id bigserial PRIMARY KEY,
 workspace_id uuid NOT NULL,
 order_id text NOT NULL REFERENCES orders(order_id),
 action text NOT NULL CHECK (action IN ('ORDER_CREATED','ORDER_STATUS_CHANGED','ORDER_MATTER_LINKED','ORDER_CANCELLED')),
 actor_id text NOT NULL CHECK (char_length(actor_id) BETWEEN 1 AND 200),
 from_status text CHECK (from_status IS NULL OR from_status IN ('Draft','PendingConfirmation','Confirmed','ReadyForMatter','MatterCreated','InProgress','WaitingForCustomer','Completed','Cancelled','Archived','DeletedReferenceOnly')),
 to_status text NOT NULL CHECK (to_status IN ('Draft','PendingConfirmation','Confirmed','ReadyForMatter','MatterCreated','InProgress','WaitingForCustomer','Completed','Cancelled','Archived','DeletedReferenceOnly')),
 version integer NOT NULL CHECK (version >= 1),
 correlation_id text CHECK (correlation_id IS NULL OR char_length(correlation_id) BETWEEN 1 AND 200),
 occurred_at timestamptz NOT NULL,
 owner_service text NOT NULL DEFAULT 'MARKREG' CHECK (owner_service='MARKREG')
);
CREATE INDEX order_audit_workspace_order_idx ON order_audit(workspace_id,order_id,audit_id ASC);
CREATE INDEX order_audit_workspace_chronology_idx ON order_audit(workspace_id,occurred_at DESC,audit_id DESC);

CREATE TRIGGER order_audit_append_only
 BEFORE UPDATE OR DELETE ON order_audit
 FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();
