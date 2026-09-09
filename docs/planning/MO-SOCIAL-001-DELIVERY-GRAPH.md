# MO-SOCIAL-001 Delivery Graph and First-Platform Recommendation

- Issue: #1083
- Date: 2026-09-09
- Scope: post-audit sequencing only; no runtime is authorized by this document

## Development decisions

| Work item                                                   | Decision          | Dependency / rationale                                                                                           |
| ----------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `SOCIAL-002` Channel / Account Binding                      | **NOW**           | Small bounded fact needed by every later platform action. Must keep credentials outside canonical contract.      |
| `SOCIAL-003` Distribution Intent / Target / Publish Receipt | **NOW**           | Core missing contract set for `Prepare → Authorize → Execute → Reconcile`.                                       |
| `SOCIAL-004` Source Subscription / Acquired Reference       | **CONTRACT_ONLY** | Freeze reference/right semantics now; defer broad crawling/download runtime.                                     |
| `SOCIAL-005` Comment Inbox / Reply Draft / Reply Receipt    | **LATER**         | Start after one real publish/reconciliation vertical slice proves channel/work identity and protected execution. |
| `SOCIAL-006` Performance Observation                        | **LATER**         | Start immediately after the first publish pilot so observations bind to exact platform work receipts.            |

No item is rejected at the contract/product level. Rejected items are implementation shortcuts such as
automatic replies, default browser automation, central cookie storage, and ownership-free bulk scraping.

## Dependency graph

```text
#1083 / MO-SOCIAL-001 audit
        ↓
SOCIAL-002 Channel Binding
        ↓
SOCIAL-003 Distribution Intent / Target / Publish Receipt
        ↓
SPIKE / VERTICAL SLICE: LinkedIn official-API publish + reconciliation
        ↓
SOCIAL-006 Performance Observation
        ↓
SOCIAL-005 Comment Inbox / Reply Draft / Reply Receipt

SOCIAL-004 Source Subscription / Acquired Reference
        └── contract-only after the shared-contract queue allows it;
            runtime stays deferred
```

Only one Social coding PR should own shared contract files at a time.

## First real platform: LinkedIn

**Recommendation: LinkedIn is the single first production-oriented pilot.**

### Why LinkedIn

1. **Strategic fit** — LinkedIn maps directly to MO's `Brand × Cross-border × Professional Services`
   audience: professional firms, lawyers, agents, corporate/brand operators, and B2B companies.
2. **Official API path** — LinkedIn Posts APIs support organic post creation/retrieval. Community
   Management covers company-page management and social interactions.
3. **Content coverage** — official Posts APIs support text and rich media, while the existing AiToEarn
   adapter demonstrates text/image/video provider separation.
4. **Receipt identity** — platform post URNs provide a stable external identity suitable for
   `PublishReceipt` and later reconciliation.
5. **Engage** — official Comments APIs support reading and writing comments/replies under approved
   permissions.
6. **Learn** — Community Management / Social Metadata / organization share statistics expose
   reactions, comments, page/share performance and related analytics.
7. **Credential safety** — OAuth/API integration can be isolated behind the adapter/secret boundary;
   no cookie/browser session needs to enter canonical Social facts.

### Hard readiness gate

LinkedIn Community Management is a vetted product and some scopes are restricted.

Therefore the pilot must have a hard gate:

```text
LinkedIn app + required approved scopes available?
    YES → execute official-API vertical slice
    NO  → BLOCK / remain in integration-readiness state
```

**Do not silently fall back to browser automation or cookie capture.**

### Why not TikTok first

TikTok's 2026 Content Posting API has strong Direct Post and explicit status polling/webhook
reconciliation, including photo posting. That makes it a strong future Distribution adapter.

However:

- `video.publish` requires approval and user authorization;
- unaudited clients are restricted to private posts;
- required UX explicitly demands creator information and user consent;
- normal product comment/community-management capability is not as complete for the intended MO
  Engage loop.

TikTok should be a later publish-focused adapter after MO proves its canonical receipt model.

### Why not YouTube first

YouTube has a mature official upload API and excellent comment/reply APIs, but the first MO pilot should
prove a general professional-content path, not a video-only channel.

YouTube remains a strong second-wave video platform. New/unverified upload projects also face private
visibility restrictions until compliance audit.

### Why not Xiaohongshu / WeChat Channels first

They are strategically valuable for China, but current reference implementations rely heavily on
Electron/browser/cookie/session behavior and creator-site/internal endpoints. That is the highest-risk
credential/policy path and would distort the canonical architecture before the official-API flow is
proven.

China-platform support should follow a separate sidecar/security/platform-policy review after the first
official-API vertical slice.

## LinkedIn pilot acceptance

The first vertical slice should prove exactly:

```text
exact MO Artifact / reviewed PublishPackage
        ↓
DistributionIntent
        ↓
exact DistributionTarget / LinkedIn ChannelBinding
        ↓
Human Review
        ↓
Protected Action
        ↓
Execution
        ↓
Capability → approved LinkedIn Implementation Profile
        ↓
LinkedIn official API adapter
        ↓
platform post URN / response evidence
        ↓
PublishReceipt
        ↓
GET / reconciliation confirms platform state
```

Minimum acceptance:

- official OAuth authorization;
- no raw credential in canonical Social contract;
- exact source artifact/package lineage;
- text plus at least one media-capable path;
- explicit human approval before external publish;
- idempotency key;
- no blind retry after uncertain delivery;
- durable platform post identifier;
- reconciliation independent from initial execution success;
- platform failure/uncertainty modeled without claiming publication;
- evidence/provenance retained through existing MO mechanisms.

Comments and analytics are not required to merge the first Distribution pilot, but LinkedIn is selected
partly because those capabilities can support the next `Engage → Learn` phases without switching
platforms.

## Permanent product/authority locks

```text
PublishPackage != Published
Execution success != Platform Published
Account Binding != Credential
AI Draft != Send
Social Observation != Business Truth
Acquired Content != Owned Asset
```

## External platform references checked for this audit

Official references checked on 2026-09-09:

- LinkedIn Posts API:
  `https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api`
- LinkedIn Comments API:
  `https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api`
- LinkedIn Community Management:
  `https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview`
- LinkedIn Social Metadata:
  `https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/social-metadata-api`
- LinkedIn Organization Share Statistics:
  `https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics`
- TikTok Content Posting / Direct Post / Status:
  `https://developers.tiktok.com/products/content-posting-api`
  `https://developers.tiktok.com/docs/en/content-posting-api-get-started`
  `https://developers.tiktok.com/docs/en/content-posting-api-reference-get-video-status`
- YouTube video upload and comments:
  `https://developers.google.com/youtube/v3/docs/videos/insert`
  `https://developers.google.com/youtube/v3/docs/commentThreads`
  `https://developers.google.com/youtube/v3/docs/comments`
