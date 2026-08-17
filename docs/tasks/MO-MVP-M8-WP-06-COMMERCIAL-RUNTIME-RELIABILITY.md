# MO MVP M8-WP-06 — Commercial Runtime Reliability

- **Work package:** `M8-WP-06`
- **Milestone:** `M8 — MVP Commercial Foundation`
- **Baseline:** stacked on the current `M8-WP-05` commercial-admin head until WP05 receives owner merge authorization.
- **Environment class:** `NON_PRODUCTION_REHEARSAL`
- **Status:** `IMPLEMENTING`

## Objective

Qualify the commercial runtime introduced across M8-WP-01 through M8-WP-05 for failure handling, auditability, security boundaries, owner migrations/recovery, and real-runtime browser use before the independent M8-WP-07 readiness audit.

The required commercial path remains:

`Register -> Login -> Account classification -> Workspace/Role -> Product/Price -> Quote -> Order -> Checkout -> Payment -> Matter -> Admin operations -> Customer status`

WP06 does not invent a new owner of commercial truth. It composes and hardens the existing Core, MarkReg, Payment, Execution, MGSN, Gateway and Operations Console boundaries.

## Required reliability coverage

1. **Failure handling**
   - owner database unavailability fails closed;
   - invalid, replayed, stale or regressive provider/payment events cannot overwrite authoritative terminal truth;
   - internal commercial-admin requests surface bounded failures without silently authoring replacement status.
2. **Audit and replay**
   - protected commercial mutations remain attributable to server-derived actor/session context;
   - idempotent commands remain replay-safe after restart;
   - Payment/refund/reconciliation evidence remains durable and owner-scoped.
3. **Security hardening**
   - public callers cannot self-register `INTERNAL` or `PROVIDER` account types;
   - browser identity, Workspace role, money, provider, payment status and internal-operator capabilities cannot be trusted from client claims;
   - canonical HttpOnly session, trusted-Origin and CSRF boundaries remain enforced;
   - commercial admin requires the server-derived `INTERNAL_OPERATOR` principal and explicit commercial-admin capabilities.
4. **Migration and recovery**
   - owner migration ownership stays explicit and immutable;
   - forward-only migration recovery limitations remain visible;
   - Core, MarkReg and Payment durable commercial state survives restart/recovery rehearsal without cross-service SQL.
5. **Real-runtime E2E**
   - desktop and 390px mobile browser evidence remains green for commercial/customer paths;
   - Operations Console builds against real owner-routed Gateway APIs;
   - no fixture identity, engineer-issued session or direct database mutation may be required for the M8 completion path.

## Stripe real-provider gate

The deterministic WP06 matrix must retain the separate real Stripe test-mode acceptance gate from M8-WP-04. A missing `STRIPE_TEST_SECRET_KEY`, skipped sandbox test, fake provider or mocked fetch is **not** equivalent to real-provider acceptance.

WP06 may remain engineering-green while the external credential gate is explicitly recorded as unresolved. M8 itself cannot be declared complete until the real Stripe acceptance succeeds with retained evidence.

## Candidate evidence

WP06 introduces a machine-readable non-production candidate manifest and known-limits file. The exact candidate configuration is fingerprinted from commercial owner boundaries, migration ownership, critical workflows and the Operations Console / Stripe provider implementations.

The evidence must keep:

```text
productionTrafficAllowed = false
releaseAuthorized = false
m8Complete = false
independentAuditComplete = false
```

## Permanent authority locks

- `Account Type != Workspace Role`.
- `Order != Payment`.
- `Payment succeeded != Filing submitted`.
- `Payment succeeded != Matter completed`.
- `Provider != Professional appointment`.
- `Professional Review != Official Truth`.
- `Knowledge evidence != Official structured truth`.
- `Commercial Admin != owner database`.
- `Commercial Admin view != authority to invent owner status`.
- `Green deterministic CI != real Stripe provider acceptance`.
- `Green WP06 != M8 complete`.
- `Green WP06 != production release authorization`.

## Exit gate

M8-WP-06 is complete only when the exact candidate head passes:

- normal workspace/affected CI;
- commercial owner persistence and integration lanes;
- browser/visual real-runtime gates;
- the dedicated `M8 WP-06 Commercial Runtime Reliability` evidence gate;
- exact-head candidate fingerprint and machine-readable known limits.

A passing WP06 candidate advances only to M8-WP-07 independent MVP Commercial Readiness Audit. It does not itself merge, release, deploy production traffic or declare M8 complete.
