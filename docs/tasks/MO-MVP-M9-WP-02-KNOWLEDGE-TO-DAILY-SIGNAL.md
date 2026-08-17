# M9-WP-02 — Knowledge to Daily Signal

## Objective

Connect already-accepted Core Knowledge ReadyPackage content to a durable Lite-owned Daily Signal without cross-service SQL, fixture-only bridges, user-specific judgment inside Knowledge, or automatic recommendation/publication.

## Runtime path

```text
markorbit-knowledge
-> governed ReadyPackage content export
-> Core intake + immutable content acceptance
-> Core Workspace-scoped Daily source projection
-> Lite internal source authority
-> deterministic bounded source classification
-> durable DailySignal
```

## Ownership

- Knowledge owns acquisition and provenance.
- Core owns accepted ReadyPackage intake/content integrity and the internal read projection.
- Lite owns DailySignal derivation and persistence.
- WP02 does not rank the signal for a user; ranking remains WP03.

## Source projection

Core returns only accepted Workspace-scoped content with:

- exact ReadyPackage identity;
- Core source owner/kind;
- immutable content-export fingerprint;
- observed/consumed timestamp;
- exact Markdown bytes and SHA-256;
- original source filename;
- captured timestamp;
- `legalTruthVerified = false`.

No pending intake may enter the Daily source boundary.

## Initial Lite classification

WP02 derives a small explainable candidate envelope from exact Markdown:

- title;
- summary;
- source-derived key facts/excerpts;
- known jurisdiction/office markers when explicit;
- bounded professional topic tags;
- change type;
- time sensitivity.

Missing evidence stays missing. Unknown jurisdictions/institutions are not invented.

## Authority locks

- DailySignal != Today Recommendation.
- DailySignal != legal/official truth.
- import != user relevance ranking.
- import != Content Pick.
- import != publication.
- no automatic protected action.
- no cross-service database access.
- no AI/Brain service is introduced.

## Persistence

`0052_lite_daily_signals.sql` provides:

- Workspace-isolated durable Daily Signals;
- exact source owner/kind/id/version/fingerprint evidence;
- source-version uniqueness;
- idempotent import command evidence;
- restart-safe replay.

## Acceptance

WP02 is complete when tests prove:

1. Core exposes content only after accepted intake state;
2. Core boundary is Workspace-isolated and internal-auth protected;
3. Lite verifies Markdown digest evidence before derivation;
4. explicit source markers produce bounded jurisdiction/institution/topic/change metadata;
5. missing markers do not fabricate location/institution;
6. DailySignal persistence survives restart;
7. same exact source deduplicates across import retries/keys;
8. changed immutable evidence for the same source version fails closed;
9. Workspace isolation holds in PostgreSQL;
10. no Recommendation, Content Pick, publication, Capability verification or official truth is created.

## Next

After WP02 merge, M9-WP-03 consumes durable Daily Signals to create explainable Workspace-specific Daily Orbit ranking and Content Picks.
