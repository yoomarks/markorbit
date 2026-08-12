# M7-WP-02 — Bounded Content/Opportunity conversion analytics

- **Milestone:** `MO-MVP-MILESTONE-007`
- **Direction:** `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`
- **Base:** `88032709d1252392ce57dfe1823eaf238810011f` (M7-WP-01 / PR #95 merged)
- **Status:** `IMPLEMENTING_IN_PR_96`
- **Scope:** Lite-owned read-only Product conversion projection, authenticated Gateway read and real PostgreSQL verification

## Objective

Close the Week 4 Content/Opportunity conversion-analytics gap with the smallest Product-owned read model over already-durable Product-loop facts. No event warehouse, second analytics store or cross-service SQL is introduced.

## Runtime surface

```text
GET /api/lite/analytics/product-loop-conversions
-> authenticated Core Workspace Principal
-> Gateway workspace:read policy
-> Lite GET /v1/analytics/product-loop-conversions
-> Workspace-scoped SELECT over Lite-owned durable Product-loop state
-> observational conversion snapshot
```

The snapshot is `WORKSPACE_ALL_TIME` and contains two bounded funnels.

### Content funnel

```text
Content Opportunity
-> any bounded draft preparation
-> Human Review Decision
-> prepared PublishPackage
-> user-reported use feedback
```

Counts are distinct Content Opportunity roots at each stage, so multiple bounded draft versions do not inflate conversion.

### Opportunity funnel

```text
Opportunity Candidate
-> Qualification Decision
-> QUALIFIED_FOR_MARKREG
-> durable Formal Opportunity handoff result
```

The final stage is derived from Lite's own durable Prepared Action handoff evidence. The handoff record names `MARKREG` as downstream owner and is joined back to the exact qualified Candidate/Qualification Decision encoded in the Lite Prepared Action plan. The analytics query does not read the MarkReg database.

## Authority locks

```text
Product metric != business authority
user-reported use != independently verified external outcome
Qualification Decision != Formal Opportunity
Formal Opportunity handoff metric != Intake / Order / Matter / Filing
Green metric != protected action authorization
no cross-service SQL
```

Every snapshot freezes:

- `observationalOnly = true`;
- `mutatesBusinessState = false`;
- `userReportedExternalUseVerified = false`;
- all `BetaReadinessAuthorityConsequences` fields to `false`;
- `directMarkRegQueryPerformed = false`.

Metrics cannot publish content, contact customers, qualify candidates, create Formal Opportunities, create Intake/Order/Matter state, submit filings, verify Capability, mutate Capability Canon, deploy or release Beta.

## Source ownership

All eight metric source families are Lite-owned durable facts:

- Content Opportunity;
- Content Draft;
- Content Review Decision;
- PublishPackage;
- Product-loop use feedback;
- Opportunity Candidate;
- Opportunity Qualification Decision;
- Prepared Action handoff result.

The final source family carries `downstreamOwner: MARKREG`, but the evidence owner remains Lite. This preserves service ownership and avoids direct cross-service database access.

## Persistence decision

M7-WP-02 adds **no migration and no analytics persistence**. The snapshot is calculated read-only from existing durable tables created by migrations `0039`, `0040`, `0042` and `0043`.

This is intentional: the Week 4 requirement needs a bounded Product acceptance projection, not a generic analytics subsystem.

## Verification

The dedicated `M7 WP-02 Conversion Analytics` workflow provisions PostgreSQL 16 and proves:

- contract authority semantics;
- Lite/Gateway build and type boundaries;
- authenticated `workspace:read` transport;
- Workspace isolation;
- distinct-root stage counts;
- stable conversion-rate calculation;
- null rate for zero denominator;
- qualified Candidate to durable MarkReg handoff evidence linkage;
- no MarkReg SQL dependency.

Full repository regressions remain required on the final exact PR head.

## Non-goals

- analytics/event warehouse;
- new analytics database or migration;
- cross-service SQL;
- dashboard/UI redesign;
- external publication or verification;
- customer outreach;
- Formal Opportunity/Intake/Order/Matter mutation;
- Payment/Invoice;
- legal appointment;
- Filing Submission or Official Truth;
- Capability verification/Canon mutation;
- M7-WP-03 seeded Beta scenario;
- deployment/release action.

## Next

After explicit Owner merge only:

`M7-WP-03 — Deterministic non-production seeded Beta scenario`.
