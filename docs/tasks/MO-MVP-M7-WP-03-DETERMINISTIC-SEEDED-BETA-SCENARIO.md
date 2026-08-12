# M7-WP-03 — Deterministic non-production seeded Beta scenario

- **Milestone:** `MO-MVP-MILESTONE-007`
- **Direction:** `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`
- **Base:** `a199da11a725a08072c32a18c8304997f4f0ea2e` (M7-WP-02 / PR #96 merged)
- **Status:** `IMPLEMENTED_IN_PR_97`
- **Scope:** one deterministic owner-separated TEST/REHEARSAL reset-and-reseed dataset for later Beta acceptance and deployment rehearsal

## Objective

Close the deterministic seeded-Beta gap without creating a generic demo-data platform or a production mutation surface. The seed harness reuses existing owner repositories and services, resets only explicitly supplied non-production databases, applies each owner's existing migrations, seeds the smallest useful cross-loop state, and emits a stable machine-readable manifest.

## Explicit enablement and fail-closed rules

The harness refuses to run unless all of the following are true:

- `MARKORBIT_BETA_SEED_ENABLED=1` is explicitly present;
- `MARKORBIT_BETA_SEED_ENVIRONMENT` is exactly `TEST` or `REHEARSAL`;
- `NODE_ENV` is not `production`;
- five PostgreSQL URLs are supplied, one each for Core, Lite, MarkReg, Execution and Capability Engine;
- every database name is visibly non-production by containing `test`, `rehearsal`, `seed` or `wp03`;
- all five owner database identities are distinct.

The script has no production route, startup hook, automatic scheduler or external credential requirement.

## Owner-separated reset and seed graph

```text
Core database
  deterministic demo User + Workspace + Membership
  + accepted traceable Knowledge intake

Lite database
  accepted Core Knowledge source
  -> Today Recommendation
  -> Content Opportunity
  -> bounded Content Draft
  -> Human Review Decision
  -> prepared PublishPackage
  -> user-reported, unverified use feedback
  -> Opportunity Candidate
  -> explicit QUALIFIED_FOR_MARKREG decision

MarkReg database
  exact qualified Lite evidence
  -> Formal Trademark Service Opportunity
  -> confirmed Intake handoff envelope
  -> stops before actual Intake / Order / Matter / Filing creation

Execution database
  deterministic rehearsal-only governed execution prerequisites
  -> provider-return evidence receipt
  -> explicit Evidence Review Decision admitted for internal use

Capability Engine database
  accepted Canon projection
  -> exact Execution Evidence Review Decision observation
  -> private Capability Ledger entry
  -> pending private Reflection Candidate
  -> stops before subject-user disposition or Capability verification
```

The harness orchestrates these owner APIs but does not run SQL from one service against another service's database. Owner-local `workspaces` test projections are created only inside the corresponding isolated non-Core databases before owner migrations so existing foreign-key topology can be reproduced without cross-service reads. The only other direct setup SQL is confined to the Execution owner's own isolated database and mirrors the existing M6 real-runtime seed pattern for the prerequisites needed to create a governed Evidence Review Decision.

## Determinism

The scenario freezes:

- scenario identity and fixed seed clock;
- demo User, Workspace and Membership identifiers;
- Product-loop record identifiers;
- MarkReg Formal Opportunity identity;
- Execution evidence lineage identifiers;
- Runtime Capability, Observation, Ledger and Reflection Candidate identities;
- idempotency keys and deterministic content;
- one scenario fingerprint over the bounded manifest.

A second invocation always resets the same five explicitly supplied owner databases before reseeding. CI proves that two complete reset/reseed runs produce an identical manifest and identical scenario fingerprint.

## Authority locks

```text
Seeded demo record != customer truth
Seeded demo record != provider truth
Seeded demo record != official truth
Seeded provider claim != verified external action
Prepared PublishPackage != Published
user-reported use != independently verified external outcome
Qualification Decision != automatic Formal Opportunity authority
Intake handoff envelope != Intake / Order / Matter / Filing
Evidence Review Decision != Official Truth
Reflection Candidate != canonical truth
pending private reflection != verified Capability
seed success != deployment or Beta release authority
```

Every emitted manifest carries the existing `SeededDemoRecordBoundary` and `BetaReadinessAuthorityConsequences`. All protected authority consequences remain `false`.

## Verification

The permanent `M7 WP-03 Seeded Beta Scenario` workflow provisions PostgreSQL 16 and five databases, then verifies:

- Workspace and persistence ownership boundaries;
- repository formatting;
- the exact Core/Lite/MarkReg/Execution/Capability Engine build closure;
- owner lint and typecheck gates;
- the M7 Beta-readiness authority contract;
- fail-closed behavior when enablement/environment/database safeguards are absent;
- database-per-owner isolation;
- two complete real PostgreSQL reset/reseed runs with exact manifest equality;
- a machine-readable seeded manifest after the replay test using an explicit ESM entrypoint.

The dedicated gate has passed on the implementation branch. Full repository regressions remain required on the final exact PR head before merge readiness.

## Non-goals

- generic demo-data or fixture platform;
- production seed or production traffic mutation;
- production deployment, release tag or Beta release;
- cross-service SQL;
- real customer/provider credentials;
- customer outreach or external publication;
- Payment/Invoice;
- provider or legal appointment;
- actual Intake, Order or Matter creation from the seeded MarkReg handoff;
- Filing Submission or Official Truth;
- automatic Reflection disposition;
- Capability verification, public rating/certification or Capability Canon mutation;
- M7-WP-04 three-loop browser/API acceptance;
- M7-WP-05 deployment or rollback rehearsal.

## Next

After explicit Owner merge only:

`M7-WP-04 — Three-loop full-journey Beta real-runtime acceptance`.
