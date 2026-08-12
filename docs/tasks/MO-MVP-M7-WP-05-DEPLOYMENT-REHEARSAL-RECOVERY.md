# MO MVP M7-WP-05 — Deployment rehearsal, migration and rollback/recovery evidence

- **Work package:** M7-WP-05
- **Baseline:** M7-WP-04 merge `347495d8028ef7c25a06ea16240c77120c2c9847` / PR #98.
- **Status:** `IMPLEMENTING`.
- **Milestone direction:** `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`.
- **Objective:** prove that one exact repository head can be rehearsed reproducibly in a bounded non-production candidate topology through owner migrations, service startup, restart and recovery without creating production deployment or release authority.

## Scope lock

This work package closes the operational rehearsal gap identified by TASK 032A and the M7 delivery plan. It does not add a deployment platform and does not change business-domain semantics.

The candidate topology is explicitly:

```text
NON_PRODUCTION_REHEARSAL
productionTrafficAllowed = false
releaseAuthorized = false
```

The configuration manifest contains topology and environment-variable names only. Secret values and database credentials are supplied by the isolated hosted rehearsal environment and are not stored in the manifest.

## Candidate owner topology

The rehearsal uses one PostgreSQL 16 database per durable owner:

1. Core — `@markorbit/core-service`;
2. Lite — `@markorbit/lite-service`;
3. MarkReg — `@markorbit/markreg-service`;
4. Execution — `@markorbit/execution-service`;
5. MGSN — `@markorbit/mgsn-service`;
6. Capability Engine — `@markorbit/capability-engine`.

Migration selection remains owner-scoped through `infrastructure/persistence/migration-owners.json` and `loadMigrationsForOwner`. The rehearsal does not issue cross-service SQL.

## Migration and recovery model

The repository migration model is forward-only with immutable migration-file checksums and recorded migration history. It does not provide reverse/down migrations.

Therefore the bounded recovery rehearsal is intentionally:

```text
stop candidate services
-> restore each owner database from its own logical pre-forward snapshot
-> verify immutable migration history and expected pre-forward pending state
-> verify durable pre-forward evidence survived restore
-> reapply the exact candidate's forward owner migrations
-> verify all owner migrations and checksums
-> start the candidate again and pass health checks
```

This is recovery evidence appropriate to the existing migration model. It does not claim that application code is backwards-compatible with arbitrary older schemas and it is not a production rollback mechanism or traffic-cutover procedure.

## Required acceptance evidence

The exact-head hosted gate must prove:

- the checked-out SHA equals the declared rehearsal candidate SHA;
- the candidate manifest is non-production, secret-free and non-authorizing;
- every declared migration has exactly one recognized durable owner;
- each owner can reach its pre-forward state and then migrate forward to the exact candidate state;
- immutable migration verification succeeds before and after recovery;
- a durable owner-local probe survives forward migration, restart and logical snapshot restore;
- a service whose own database is unavailable fails closed and never reports itself listening;
- candidate services start on their real durable main entrypoints and `/health` becomes healthy without business-route interception;
- services survive a full stop/restart cycle with durable database state preserved;
- owner-local logical snapshots restore the pre-forward state and forward migration can be replayed cleanly;
- the recovered candidate starts healthy again;
- machine-readable evidence keeps `releaseAuthorized: false` and records no production traffic, Filing Submission or Official Truth mutation.

## Evidence artifact

The gate emits:

` .artifacts/m7-wp-05-deployment-rehearsal-evidence.json `

The artifact records the exact head SHA, candidate-manifest fingerprint, owner migration order, migration counts/latest migration identifiers, startup/restart/recovery outcomes and the permanent authority locks. Database snapshot files are temporary rehearsal mechanics and are not retained as release artifacts.

## Permanent authority locks

```text
Deployment Rehearsal != Production Deployment
Beta Release Candidate != Released Beta
Green CI != Owner Release Authorization
Migration recovery evidence != production traffic cutover authority
Service health != business success
```

All prior locks remain permanent, including:

`PublishPackage != Published`; `Candidate != Formal Opportunity`; `Formal Opportunity != Intake`; `Intake != Order != Matter != Filing`; `Evidence Review Decision != Official Truth`; `Provider Return != Official Truth`; `Reflection Candidate != canonical truth`; accepted private reflection is not verified Capability.

M7-WP-05 introduces no Payment/Invoice, legal appointment, Filing Submission, Official Truth, production secret, production traffic mutation, release/tag publication, autonomous Twin authority, generic deployment platform or cross-service SQL.

## Exit gate

M7-WP-05 is complete only when the exact PR head passes the dedicated deployment-rehearsal workflow and the normal workspace validation gates. A green result advances the repository to M7-WP-06 engineering work only; it does not authorize a Beta release.
