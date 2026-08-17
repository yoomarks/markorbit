# MO MVP M9-WP-03 — Personal Daily Orbit

- **Milestone:** M9 — MO Lite Daily Workspace & Content Production
- **Status:** IN_IMPLEMENTATION
- **Owner:** Lite Product
- **Depends on:** M9-WP-01 Daily Workspace contracts; M9-WP-02 durable Daily Signals

## Goal

Turn durable, governed Daily Signals into a real authenticated Workspace-specific Daily Orbit without creating a new service, lifecycle, identity system, or speculative user profile.

## Runtime shape

```text
Lite durable DailySignal
+ existing Lite TodayRecommendation (exact provenance match only)
+ explicit CreatorPreference when available
-> explainable four-dimensional ranking
-> DailyOrbitItem read projection
-> bounded ContentPick projection only when a real CONTENT_PREPARATION Recommendation exists
```

## Ranking dimensions

- importance;
- personal relevance;
- time sensitivity;
- content potential.

Every component carries a numeric score and human-readable reason. Total ranking is deterministic and bounded. No opaque model score is accepted in this work package.

## Personalization rule

- Workspace scope is always mandatory.
- Explicit Creator Preference may increase/decrease personal relevance.
- If no explicit preference is available, the service reports a Workspace relevance baseline rather than inventing a profile.
- A preference returned for a different Workspace/user fails closed.
- Preference-provider unavailability degrades the read model to partial with an explicit warning; it does not fabricate preference evidence.

## Recommendation / Content Pick rule

A Daily Orbit item may link a Today Recommendation only when the Recommendation carries the exact source owner/kind/id/version/fingerprint of the Daily Signal.

A Content Pick may be projected only when:

1. that exact Recommendation exists;
2. the Recommendation kind is `CONTENT_PREPARATION`;
3. content-potential meets the bounded threshold.

No Recommendation, Content Opportunity, Content Draft, PublishPackage, Order, Matter, provider execution, or external publication is created by ranking.

## Section rule

Supported read sections remain the shared contract values:

- `TODAYS_ORBIT`;
- `FOR_YOU`;
- `RISK` only on explicit risk evidence;
- `OPPORTUNITY` only on explicit opportunity evidence;
- `WORTH_REVISITING` for older low-time-sensitivity material.

## Acceptance

- authenticated `workspace:read` HTTP route;
- exact Workspace isolation;
- deterministic four-dimensional ranking and stable item identity;
- explicit explanation for every score component;
- exact source provenance retained;
- explicit preference matching test and no-preference baseline test;
- no false risk/opportunity classification without evidence;
- Content Pick only from exact real Recommendation linkage;
- durable PostgreSQL DailySignal -> Orbit read acceptance;
- existing Product Loop / M1-M8 authority regressions remain green;
- `executionAuthorized=false`, `legalTruthVerified=false`, and no external consequences.
