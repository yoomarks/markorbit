# MO MVP M9-WP-04 — Content Kit / Studio

- **Milestone:** M9 — MO Lite Daily Workspace & Content Production
- **Status:** IN_IMPLEMENTATION
- **Owner:** Lite Product
- **Depends on:** M9-WP-03 Personal Daily Orbit; existing Product Loop Content Opportunity / Draft / Human Review / PublishPackage lifecycle

## Goal

Turn an exact current `ContentPick` into a useful Content Kit / Studio projection without creating a second content lifecycle.

## Authority lock

```text
ContentPick
  != ContentOpportunity
  != ContentDraft
  != Human Review
  != PublishPackage
  != external publication
```

A Content Kit exists only after the existing `ContentOpportunity` has been explicitly accepted. The Kit references the existing Draft and PublishPackage records; it never owns or duplicates their transitions.

## Runtime shape

```text
current Daily Orbit ContentPick
+ exact existing ContentOpportunity
+ existing latest Draft refs
+ existing prepared PublishPackage refs
+ explicit Creator Preference when available
-> ContentKit read projection / Content Studio
```

## Product rules

- exact Workspace isolation;
- exact Recommendation -> ContentOpportunity linkage;
- stable Kit identity from ContentPick + ContentOpportunity;
- Kit projection version advances with existing Draft / PublishPackage progress;
- audience comes from explicit preference only; otherwise the UI projection states that audience is not explicitly configured;
- platform variants use existing Draft content when present;
- before a Draft exists, variant starter text is composed only from the current Content Pick's existing suggested angles;
- every platform variant remains `humanReviewRequired=true`;
- no platform variant or PublishPackage means an external publish occurred;
- Visual Brief references remain empty until M9-WP-05.

## Acceptance

- authenticated `workspace:read` Content Kit route;
- no Kit before existing ContentOpportunity acceptance;
- deterministic Content Kit / angle / platform variant IDs;
- exact source provenance retained;
- existing Draft and PublishPackage references survive a fresh persistence reader;
- real PostgreSQL Recommendation -> Opportunity -> Draft -> Human Review -> PublishPackage -> ContentKit evidence;
- Workspace isolation;
- all external-publication flags remain false;
- existing Product Loop, Daily Signal and Daily Orbit regressions remain green.
