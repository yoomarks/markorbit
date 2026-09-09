# MO-SOCIAL-001 Current-Main Owner Audit

- Issue: #1083
- Lane: L3 — Social / Mo Publish
- Audit baseline: `28fe32577dfbbf79cc935426eae549d121d961be`
- Date: 2026-09-09
- Scope: audit only; no runtime, contract, migration, API, or UI changes

## Decision summary

Mo Publish should be an orchestration layer over existing MO owners plus a small set of bounded Social-owned facts.

Do **not** create a Social-specific Capability Runtime, Provider Registry, Execution Runtime,
Authorization stack, evidence ledger, generic analytics platform, cross-service SQL path, or universal
"social truth" database.

The permanent boundary is:

```text
Prepare != Authorize != Execute != Platform-confirmed
```

and specifically:

```text
PublishPackage != Published
Execution success != Platform Published
Account Binding != Credential
AI Draft != Send
Social Observation != Business Truth
Acquired Content != Owned Asset
```

## Current-main reuse inventory

| Existing owner               | Current-main contract / path                                                                                                              | Social reuse rule                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Product Loop                 | `packages/contracts/src/product-loop.ts`                                                                                                  | Consume exact reviewed `PublishPackage` lineage. Never reinterpret package readiness as publication.                                   |
| Trading                      | `trading-ai-profile.ts`, `trading-commercial-direction.ts`, `trading-brand-dna.ts`, `trading-listing.ts`, related exact-version contracts | Consume exact refs only. Social cannot mutate Trading, Listing, pricing, valuation, or Trademark Truth.                                |
| Buyer Behavior               | `packages/contracts/src/trading-buyer-behavior.ts`                                                                                        | Reuse the precedent that observations have no authority consequences and stateful events point back to canonical owner actions.        |
| Media                        | `packages/contracts/src/media.ts`, `media-plan.ts`, `media-rights.ts`                                                                     | Consume exact Audio/Clip/Video/other Media Artifact refs and rights snapshots. Social does not create a second media-asset owner.      |
| Workspace / Identity         | `identity.ts`, `auth.ts`                                                                                                                  | Workspace and principal identity stay Core-owned. Social facts reference exact trusted workspace/account context.                      |
| Capability                   | `capability-runtime.ts`                                                                                                                   | Platform operations resolve through existing Capability + Implementation Profile binding. Caller gets no provider-selection authority. |
| Managed AI                   | `managed-ai-execution.ts`                                                                                                                 | Caption/reply preparation can use Managed AI. Its authority explicitly does not send an external message.                              |
| Authorization / Execution    | existing protected-action / execution contracts plus `external-capability-exposure.ts`                                                    | Social EXECUTE must reuse existing protected-action and Execution mappings; no Social authorization stack.                             |
| Provider / Evidence patterns | `provider-execution.ts`, `evidence-lifecycle.ts`                                                                                          | Reuse exact lineage and "provider claim != official truth" discipline. Social platform facts require receipt/reconciliation evidence.  |
| External exposure            | `external-capability-exposure.ts`                                                                                                         | `EXECUTE` is `PROTECTED` and requires exact protected-action + execution refs. Social does not bypass this.                            |

## Proposed bounded Social-owned facts

These are ownership decisions for future contracts only. This audit does **not** create them.

### `SocialChannelBindingV1`

**Owner:** Social Integration.

Represents that a Workspace has connected or selected an external social account/channel.

Allowed durable semantics should include:

- `workspaceId`;
- platform identifier;
- external account/channel identifier;
- safe display label/profile metadata;
- binding lifecycle state;
- capability / implementation binding reference where useful;
- timestamps and provenance.

It must **not** contain passwords, API secrets, cookies, refresh tokens, session tokens, or raw browser
session state.

Credential material belongs behind the selected platform adapter / secret boundary, not in the canonical
business contract.

### `DistributionIntentV1`

**Owner:** Social Distribution.

Represents a user's intent to distribute an exact, approved source package or media artifact to one or
more targets.

It may reference exact:

- `PublishPackage`;
- Media Artifact;
- selected Trading/Showcase presentation input where applicable;
- requesting Workspace/principal;
- scheduling intent.

It is preparation truth only. It does not authorize or execute publication.

### `DistributionTargetV1`

**Owner:** Social Distribution.

One exact target under an intent. It should freeze:

- exact `SocialChannelBinding`;
- platform;
- transformed/normalized payload snapshot or fingerprint;
- scheduling request;
- human/protected-action approval reference when required;
- execution lineage/status reference.

The transformed payload is a distribution snapshot, not a replacement for the Product/Media source owner.

### `PublishReceiptV1`

**Owner:** Social Distribution.

The durable bounded fact that MO observed a platform publication result.

It should capture enough exact evidence to reconcile:

- platform and account/channel identity;
- platform work/post identifier;
- permalink where available;
- platform lifecycle/status;
- publish attempt / Execution lineage;
- receipt or webhook/polling evidence reference;
- observed/reconciled timestamps;
- uncertainty/failure state.

`Execution success` alone cannot create `PublishReceipt.status = PUBLISHED`.

The receipt proves a platform observation only. It does not create Listing publication, Trademark Truth,
market demand, valuation, or official/legal truth.

### `SocialSourceSubscriptionV1`

**Owner:** Social Acquisition.

Represents a Workspace's explicit request to observe a creator/account, keyword, topic, or URL.

Current recommendation: **reference semantics only**. No implicit crawling right, download right, or reuse
right is created by a subscription.

### `AcquiredSocialItemV1`

**Owner:** Social Acquisition.

Represents an observed/captured third-party item with exact source/provenance metadata.

Default rights class must be **REFERENCE**. An acquired item is not a MO-owned reusable Media Artifact
unless a separate rights/ownership owner establishes eligible reuse.

This follows the current Media Rights discipline: rights eligibility is evidence-backed and still
`createsExecutionAuthority: false`.

### `SocialCommentEventV1`

**Owner:** Social Engagement.

Represents an external platform observation:

- exact channel/work/comment identifiers;
- parent/thread identifier;
- external author reference;
- observed content / bounded safe representation;
- platform timestamp plus MO capture timestamp;
- source/provenance;
- current observation state.

It is not a CRM Lead, Matter, Inquiry, or canonical person identity by implication.

### `SocialReplyDraftV1`

**Owner:** Social Engagement.

Represents prepared response content, possibly produced through Managed AI.

It must retain:

- exact source comment;
- draft provenance;
- human/AI authorship;
- Managed AI evidence/provenance where applicable;
- explicit `sendAuthorized = false` semantics until a separate protected action exists.

### `SocialReplyReceiptV1`

**Owner:** Social Engagement.

Represents observed platform evidence after a governed reply execution:

- exact source comment / thread;
- exact protected-action / execution lineage;
- platform action/comment identifier;
- platform result / reconciled state;
- timestamps and evidence refs.

An Execution return code alone is insufficient to claim a platform reply was sent.

### `SocialPerformanceObservationV1`

**Owner:** Social Observation / Learning.

Represents time-bounded measurements such as views, impressions, likes, saves, comments, clicks,
watch time, or qualified inquiry observations.

It should preserve:

- exact channel/work reference;
- metric name/value/unit;
- snapshot/period timestamps;
- source type (`OFFICIAL_API`, approved alternative, etc.);
- provenance/evidence reference;
- capture timestamp.

The existing `BuyerBehaviorEventV1` is the governing precedent: observation does not create the action or
business conclusion it describes.

Therefore:

```text
SocialPerformanceObservation
!= Market Demand
!= Pricing Conclusion
!= Valuation
!= Trademark Truth
!= Listing Truth
!= Official Truth
```

A later governed handoff may use observations as Commercial/Content evidence, but the receiving owner
must decide what, if anything, can be inferred.

## Authority and data-flow freeze

```text
Product / Media exact source
        ↓
DistributionIntent (Social-owned preparation)
        ↓
DistributionTarget (Social-owned exact target snapshot)
        ↓
Human / protected-action authorization (existing owner)
        ↓
Execution (existing owner)
        ↓
Capability → Implementation Profile → Platform Adapter (existing platform substrate)
        ↓
provider/platform response
        ↓
PublishReceipt + reconciliation (Social-owned bounded platform fact)
```

For replies:

```text
CommentEvent
  ↓
ReplyDraft
  ↓
Human review / protected action
  ↓
Execution
  ↓
Platform adapter
  ↓
ReplyReceipt / reconciliation
```

## Path ownership proposal

Future Social implementation should prefer new bounded Social files/services and references into existing
owners. It must not take ownership of current Trading, Media, Capability, Execution, Identity, or Evidence
contracts.

Shared hot files remain L0-controlled:

- `packages/contracts/package.json`
- `packages/contracts/src/index.ts`
- root `package.json`
- `pnpm-lock.yaml`
- `tsconfig*`
- `infrastructure/persistence/migration-owners.json`
- `.github/workflows/**`

## Audit conclusion

Current main already provides the architecture needed to govern Social actions. New Social work should add
only the missing platform connection, distribution receipt, engagement observation, and performance
observation facts.

No second platform substrate is justified.
