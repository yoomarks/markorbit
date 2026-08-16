CREATE TABLE payment_payments (
  payment_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  checkout_session_id text NOT NULL,
  order_id text NOT NULL,
  initiated_by_user_id text NOT NULL,
  product_id text NOT NULL,
  product_version integer NOT NULL CHECK (product_version > 0),
  price_id text NOT NULL,
  price_version integer NOT NULL CHECK (price_version > 0),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0 AND amount_minor <= 9007199254740991),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider text NOT NULL CHECK (provider ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  status text NOT NULL CHECK (status IN ('PENDING','REQUIRES_ACTION','PROCESSING','SUCCEEDED','FAILED','CANCELLED')),
  version integer NOT NULL CHECK (version > 0),
  refunded_minor bigint NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0 AND refunded_minor <= amount_minor),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  succeeded_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE (workspace_id, checkout_session_id)
);

CREATE INDEX payment_payments_workspace_created_idx
  ON payment_payments(workspace_id, created_at DESC, payment_id);

CREATE TABLE payment_attempts (
  payment_attempt_id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payment_payments(payment_id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  provider_payment_reference text NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (payment_id, attempt_number),
  UNIQUE (provider, provider_payment_reference)
);

CREATE TABLE payment_commands (
  workspace_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  payment_id text NOT NULL REFERENCES payment_payments(payment_id) ON DELETE RESTRICT,
  payment_attempt_id text NOT NULL REFERENCES payment_attempts(payment_attempt_id) ON DELETE RESTRICT,
  payment_snapshot jsonb NOT NULL,
  attempt_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE TABLE payment_provider_event_receipts (
  receipt_id text PRIMARY KEY,
  provider text NOT NULL CHECK (provider ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  provider_event_id text NOT NULL,
  provider_payment_reference text NOT NULL,
  raw_sha256 text NOT NULL CHECK (raw_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_type text NOT NULL CHECK (canonical_type IN (
    'PAYMENT_REQUIRES_ACTION','PAYMENT_PROCESSING','PAYMENT_SUCCEEDED','PAYMENT_FAILED','PAYMENT_CANCELLED',
    'REFUND_PENDING','REFUND_SUCCEEDED','REFUND_FAILED'
  )),
  payment_id text REFERENCES payment_payments(payment_id) ON DELETE RESTRICT,
  refund_id text,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL,
  applied boolean NOT NULL,
  ignored_reason text,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE payment_refunds (
  refund_id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payment_payments(payment_id) ON DELETE RESTRICT,
  workspace_id text NOT NULL,
  requested_by_user_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('PENDING','SUCCEEDED','FAILED')),
  version integer NOT NULL CHECK (version > 0),
  provider_refund_reference text,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  succeeded_at timestamptz,
  failed_at timestamptz
);

ALTER TABLE payment_provider_event_receipts
  ADD CONSTRAINT payment_provider_event_refund_fk
  FOREIGN KEY (refund_id) REFERENCES payment_refunds(refund_id) ON DELETE RESTRICT;

CREATE INDEX payment_refunds_payment_idx
  ON payment_refunds(payment_id, created_at, refund_id);

CREATE TABLE payment_refund_commands (
  workspace_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  refund_id text NOT NULL REFERENCES payment_refunds(refund_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE TABLE payment_reconciliations (
  reconciliation_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  payment_id text NOT NULL REFERENCES payment_payments(payment_id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  provider_payment_reference text NOT NULL,
  local_status text NOT NULL CHECK (local_status IN ('PENDING','REQUIRES_ACTION','PROCESSING','SUCCEEDED','FAILED','CANCELLED')),
  observed_provider_status text NOT NULL,
  local_amount_minor bigint NOT NULL CHECK (local_amount_minor >= 0 AND local_amount_minor <= 9007199254740991),
  observed_amount_minor bigint NOT NULL CHECK (observed_amount_minor >= 0 AND observed_amount_minor <= 9007199254740991),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  observed_currency text NOT NULL CHECK (observed_currency ~ '^[A-Z]{3}$'),
  classification text NOT NULL CHECK (classification IN ('MATCH','MISMATCH')),
  disposition text NOT NULL CHECK (disposition IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  operator_note text,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX payment_reconciliations_payment_idx
  ON payment_reconciliations(payment_id, observed_at DESC, reconciliation_id);
