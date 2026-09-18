# Campaign Persistence / Read-Model Audit

Issue: #1342  
Baseline: `main@15918954619618d500644cce5d8e942a9218ac94`

## Decision

Verdict: **READY_FOR_C2B_CODE, migration required.**

C2B should add one Lite-owned, Workspace-scoped PostgreSQL aggregate for Campaign preparation truth. It must persist exact versions of Campaign, Audience Snapshot, Content Projection, Brand Projection and human review decisions without becoming a communication, contact, content, brand, entitlement or execution owner.

The implementation should follow existing Lite persistence conventions from `PostgresTradingListingStore` and `PostgresLiteWorkItemStore`: Workspace isolation, explicit versioning, idempotent command replay, advisory-lock or compare-and-swap protection, validated `document_json`, queryable owner columns and restart-safe PostgreSQL tests.

No Provider, credential, webhook, external send or ManagedCommunication fan-out belongs in C2B.

## Owner matrix

| Durable object | Owner | C2B rule |
| --- | --- | --- |
| Email Campaign preparation/version state | Lite Campaign owner | Persist exact immutable versions and one current head |
| Audience Snapshot | Lite Campaign owner | Persist exact snapshot; no raw email; no CRM/contact ownership |
| Outbound basis/suppression/readiness truth | Existing Outbound Contact Policy owner | Store exact lineage/fingerprints only; never copy owner truth |
| Content Projection | Lite Campaign owner | Store exact projection only |
| PublishPackage body/review truth | Product Loop / Content Studio | Reference exact id/version/fingerprint; never copy body truth |
| Brand Projection | Lite Campaign owner | Store exact projection/snapshot only |
| Canonical Site configuration | Site owner | Store exact lineage only |
| Canonical Workspace brand | None created by C2B | `canonicalWorkspaceBrandCreated=false` remains authoritative |
| Campaign Review Decision | Lite Campaign owner | Persist exact decision bound to exact Campaign version/fingerprint |
| Entitlement | Workspace Commercial / Capability runtime | Not duplicated in Campaign persistence |
| Provider selection / send | Future C3 | Must remain absent |
| One-to-one reply mail | Managed Communication | Not created by C2B |

## Why persistence is justified

The Campaign contract now has state that must survive restart before delivery preparation can safely exist:

1. an operator can prepare a Campaign and return later;
2. human review must bind an exact Campaign version/fingerprint;
3. newer Campaign preparation can supersede an earlier version;
4. C3 must consume a stable reviewed Campaign object rather than reconstructing from mutable latest owners;
5. Workspace isolation and exact historical review evidence must survive process restart.

Those requirements justify a dedicated Lite-owned persistence slice. They do not justify provider delivery state.

## Recommended aggregate shape

Use five exact-version tables plus one command receipt table.

### 1. `lite_email_campaign_versions`

Primary key:
- `(workspace_id, campaign_id, version)`

Queryable columns:
- workspace_id
- campaign_id
- version
- purpose
- status
- audience_snapshot_id / audience_snapshot_version
- content_projection_id / content_projection_version
- brand_projection_id / brand_projection_version
- campaign_fingerprint_sha256
- created_at
- updated_at
- document_json

Indexes:
- latest by workspace/campaign/version desc
- workspace/status/updated_at for bounded read model

### 2. `lite_campaign_audience_snapshot_versions`

Primary key:
- `(workspace_id, audience_snapshot_id, version)`

Queryable columns should stay aggregate-level only:
- reviewed_send_fingerprint_sha256
- audience_fingerprint_sha256
- recipient_count
- captured_at
- document_json

Do **not** create a recipient table in C2B. Recipient-level rows would invite a second contact/behavior store and are not required for current preparation/read needs.

### 3. `lite_campaign_content_projection_versions`

Primary key:
- `(workspace_id, content_projection_id, version)`

Queryable columns:
- publish_package_id
- publish_package_version
- publish_package_fingerprint_sha256
- reviewed_send_fingerprint_sha256
- projection_fingerprint_sha256
- created_at
- document_json

No body column.

### 4. `lite_campaign_brand_projection_versions`

Primary key:
- `(workspace_id, brand_projection_id, version)`

Queryable columns:
- source_kind
- source_ref
- brand_projection_fingerprint_sha256
- captured_at
- document_json

No canonical WorkspaceBrand table is introduced.

### 5. `lite_campaign_review_decision_versions`

Primary key:
- `(workspace_id, campaign_review_decision_id, version)`

Queryable columns:
- campaign_id
- campaign_version
- expected_campaign_fingerprint_sha256
- outcome
- reviewer_principal_id
- reviewed_at
- document_json

Foreign-key exact Campaign version where practical.

### 6. `lite_campaign_commands`

Primary key:
- `(workspace_id, idempotency_key)`

Columns:
- command_type
- request_fingerprint_sha256
- result_json
- created_at

This follows the Work Item command-receipt pattern and prevents replay ambiguity across restart.

## Aggregate boundaries

C2B should not denormalize all five contracts into one mutable row.

Reasons:
- Audience/Content/Brand projections are immutable exact-version artifacts and may be reused by a later Campaign version;
- Review Decision is an evidence object with its own identity/version;
- exact foreign references make drift detectable;
- C3 can load a reviewed Campaign aggregate without re-resolving latest mutable external owners.

However, C2B also does not need separate recipient-level persistence.

## Commands

Minimum owner-local command surface:

- `saveAudienceSnapshot(command)`
- `saveContentProjection(command)`
- `saveBrandProjection(command)`
- `saveCampaign(command)`
- `saveReviewDecision(command)`

Each command should require:
- trusted Workspace context;
- exact next version;
- caller idempotency key;
- request fingerprint;
- expected prior version where versioned mutation applies.

A successful replay with the same key/fingerprint returns the same exact result. Same key with different normalized input fails `IDEMPOTENCY_CONFLICT`.

## Reads

Minimum read surface:

- get exact version for each durable object;
- get latest Campaign by `(workspace, campaignId)`;
- list bounded Campaign heads for one Workspace by status and deterministic updated ordering;
- get exact Review Decision;
- load reviewed Campaign aggregate by exact Campaign + Review refs.

List/read must never cross Workspace.

## Current-head semantics

Use append-only exact Campaign versions. Do not update an old Campaign version in place.

A new preparation mutation creates version `N+1`. Status evolution that changes the durable Campaign contract also creates a new Campaign version.

Latest-head is a query over the highest version for one `campaign_id`; a dedicated mutable head table is not required for C2B unless performance evidence later proves necessary.

`SUPERSEDED` is a Campaign semantic status, not permission to delete prior versions.

## Review semantics

A persisted Review Decision is valid only when:
- Workspace matches;
- Campaign id/version matches;
- expected Campaign fingerprint matches;
- outcome and authority locks pass contract validation.

`APPROVED_FOR_DELIVERY_PREPARATION` remains preparation-only.

Persistence must never turn review approval into:
- provider selection;
- protected action authorization;
- external send;
- ManagedCommunication creation.

## Historical exactness vs JIT currentness

C2B must preserve historical exact refs exactly as reviewed.

It must **not** silently replace:
- PublishPackage version with latest;
- Site configuration with latest;
- Outbound Contact readiness with latest;
- Audience Snapshot with a rebuilt audience.

C3 will perform JIT currentness/revalidation before any send preparation. Historical persistence proves what was reviewed; JIT checks prove whether it is still usable.

## Integrity rules

On every read, validate:
- contract parser/guard succeeds;
- Workspace in document matches row Workspace;
- object id/version match row identity;
- queryable fingerprints/status/purpose/ref columns match `document_json`;
- exact FK lineage is present;
- authority locks remain false;
- Audience document still contains no raw email.

Column/document drift is `INTEGRITY_FAILURE`, not a fallback to row columns.

Persistence unavailability is explicit and retryable; no silent in-memory production fallback.

## Concurrency

Use one transaction per command.

Recommended locking:
- advisory transaction lock on `workspace + object-kind + object-id`;
- separate advisory lock on `workspace + idempotency-key` when command receipt is shared;
- verify actual latest version equals `expectedVersion`;
- insert only `expectedVersion + 1`.

This mirrors existing Lite store behavior and avoids last-write-wins ambiguity.

## Workspace isolation

Every table primary key begins with `workspace_id`. Every read and mutation predicate includes Workspace.

Required negative tests:
- Workspace B cannot read Workspace A exact objects;
- Workspace B cannot replay Workspace A idempotency key;
- foreign refs cannot bind across Workspace;
- list queries return only the requested Workspace.

## Restart proof

PostgreSQL acceptance should prove:

1. Store A persists Audience, Content and Brand projections.
2. Store A persists Campaign v1.
3. Store A persists approval bound to Campaign v1.
4. Reconstruct Store B against the same database.
5. B loads the exact reviewed aggregate and all fingerprints/refs are unchanged.
6. B replays an identical command idempotently.
7. B rejects the same idempotency key with changed input.
8. B creates Campaign v2 using expectedVersion=1.
9. v1 and its review remain readable exactly; v2 becomes latest.
10. Workspace B cannot read either version.

## Read-model scope

C2B read model is operational preparation state only.

Recommended list fields:
- campaignId
- version
- purpose
- status
- subject may be exposed only by resolving the exact persisted Content Projection, not copied into Campaign row as a second content owner;
- reviewed outcome summary
- createdAt / updatedAt

No delivery metrics, opens, clicks, recipient profile or provider state.

## Migration

A migration is required.

At baseline, `migration-owners.json` ends at `0131_execution_protected_external_actions` and no open issue was found reserving `0132`.

C2B code may therefore request the next verified free migration, expected:
- `0132_lite_email_campaigns.sql`

Before branch activation, fresh-main and open-PR migration claims must be checked again. If `0132` is occupied, renumber; never collide.

Recommended namespace:
- `lite_email_campaigns -> @markorbit/lite-service`

Because the audit itself is docs-only, #1342 does **not** reserve `0132`.

## Minimum implementation files for follow-on C2B code

Expected owned surfaces only:

- `services/lite/src/email-campaign.ts`
- `services/lite/tests/email-campaign-postgres.test.ts`
- `services/lite/package.json` only for export/build/test wiring
- `infrastructure/persistence/migrations/<next>_lite_email_campaigns.sql`
- `infrastructure/persistence/migration-owners.json`

Consume `@markorbit/contracts/email-campaign` unchanged unless implementation proves a real contract defect.

No Gateway/API/UI is required to prove C2B durability.

## C2B code acceptance

- exact-version persistence for all five Campaign preparation objects;
- append-only Campaign versioning;
- deterministic idempotent command replay/conflict;
- Workspace isolation;
- persisted column/document integrity checks;
- exact reviewed aggregate restart proof;
- old reviewed versions remain exact after newer versions exist;
- no raw email persisted;
- no recipient behavior/profile table;
- no provider/execution/ManagedCommunication consequence;
- Lite lint/typecheck/test/build + migration-owner validation + exact-head hosted CI green.

## Permanent locks carried forward

- Campaign != Managed Communication.
- Notification != Business Truth.
- Provider != Product.
- Channel Binding != Execution Authority.
- Contact Presence != Outreach Authority.
- AI Draft != External Send.
- Marketing Campaign stores aggregate outcomes, not per-recipient communication truth.
- Capabilities are Lite plan entitlements, not separately purchased plugins.
- MO-managed marketing-email provider pool may be shared only at provider infrastructure level; Workspace sender identity/reputation remains isolated.
- Identity-bound channels require Workspace-owned accounts.
