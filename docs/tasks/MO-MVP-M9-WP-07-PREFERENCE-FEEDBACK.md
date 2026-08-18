# MO MVP M9-WP07 — Preference and Feedback Loop

- **Milestone:** M9 — MO Lite Daily Workspace & Content Production
- **Work package:** WP07 — Preference and Feedback Loop
- **Status:** IN_IMPLEMENTATION
- **Baseline:** `31ce27276dedaa3b95c2bc8029f22c5d24bedda9`
- **Depends on:** M9-WP06 merged to `main`

## Goal

Persist bounded MO Lite Product interaction/usage evidence and make it available to future Daily relevance without creating a second analytics/profile/capability system.

## Reuse before invention

WP07 reuses the M9 contracts already frozen in `@markorbit/contracts/daily-workspace`:

- `CreatorPreference`;
- `ProductPreferenceEvent`;
- `ProductPreferenceEventKind`;
- `DailyOrbitPreferenceProvider`;
- existing `ProductLoopUseFeedback` for user-reported PublishPackage outcomes.

It also reuses the existing Lite Daily Orbit, Content Kit, Visual Bridge and Product Loop feedback runtime.

## Bounded implementation

1. Add Lite-owned durable persistence for Product preference events and the derived Creator Preference projection.
2. Require authenticated Workspace Principal context and idempotent mutation boundaries.
3. Accept target identity from the Product surface, but derive personalization context only from Lite-owned/current canonical Product objects; the browser may not assert capability, publication truth, jurisdiction/topic truth, or paid execution truth.
4. Project bounded `PRODUCT_FEEDBACK` Creator Preference values from durable Product evidence and expose them through `DailyOrbitPreferenceProvider`.
5. Wire that provider into Daily Orbit/Content Kit so later snapshots can consume the preference projection.
6. Record the approved M9 event vocabulary where the corresponding Product action exists, including Daily Orbit / Content Pick / Content Kit / platform variant / visual interaction and user-reported use outcomes.
7. Preserve existing `ProductLoopUseFeedback`; do not replace it with Product preference events.
8. Add PostgreSQL, HTTP boundary, Workspace isolation, idempotency and ranking-effect tests.

## Authority locks

Product preference/usage evidence:

- is not professional Capability evidence;
- does not independently verify an external publication or outcome;
- does not authorize publication, outreach, provider execution, payment, filing, Order or Matter creation;
- does not create Official Truth;
- may influence future Lite relevance only through bounded, explainable Product preference projection.

Every persisted `ProductPreferenceEvent` keeps:

- `externalActionExecutedByMarkOrbit: false`;
- `externalOutcomeVerifiedByMarkOrbit: false`;
- `capabilityVerified: false`.

Every derived feedback preference keeps `source: PRODUCT_FEEDBACK` and `capabilityVerified: false`.

## Non-goals

- universal CRM/profile warehouse;
- Capability Engine evidence ingestion;
- cross-service SQL;
- automatic social publication;
- inferred customer intent or professional qualification;
- opaque ML ranking;
- provider/model/payment/QC controls;
- production deployment or GA.

## Acceptance

WP07 is acceptable only when:

- events are durable, Workspace/user isolated and replay safe;
- invalid/foreign targets fail closed;
- semantic preference context is server-derived from canonical Lite Product state;
- a persisted Product-feedback preference can measurably and explainably affect a later Daily Orbit relevance score;
- existing PublishPackage use feedback remains distinct and truthful;
- no preference event is admitted as Capability verification or external publication truth;
- affected M9 and M1-M8 regression workflows are green.
