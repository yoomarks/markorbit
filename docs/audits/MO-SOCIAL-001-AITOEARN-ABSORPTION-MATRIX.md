# MO-SOCIAL-001 AiToEarn Absorption Matrix

- Issue: #1083
- Reference repository: `yikart/AiToEarn`
- Date: 2026-09-09
- Purpose: classify patterns, not copy a product stack

## Classification rule

- **ADOPT** — structural pattern can be reused without changing MO owner/authority semantics.
- **ADAPT** — pattern is useful but must be re-owned/re-governed through MO contracts and runtime.
- **REFERENCE_ONLY** — useful implementation/product evidence; no code or canonical semantics should be imported now.
- **REJECT** — conflicts with MO authority, privacy, credential, rights, platform-policy, or architecture boundaries.

## Matrix

| AiToEarn capability / pattern                                                        | Class                                      | MO decision                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One platform integration interface with capability discovery                         | **ADAPT**                                  | Preserve adapter separation, but register/resolve through MO Capability + Implementation Profile rather than create a Social registry.                 |
| Per-platform publish provider separation                                             | **ADOPT**                                  | Keep providers isolated by platform; provider-specific fields stay adapter-local.                                                                      |
| `validate → normalize → publish` pipeline                                            | **ADOPT**                                  | Strong fit for creating exact target payload snapshots before protected execution.                                                                     |
| Optional `finalize / verify / cancel / update` provider methods                      | **ADAPT**                                  | Reuse where a platform supports them; MO receipt/reconciliation remains canonical Social fact.                                                         |
| Completion strategy: sync / polling / media-finalize / webhook / user-handoff        | **ADOPT**                                  | Useful normalized execution/reconciliation vocabulary.                                                                                                 |
| Platform capability metadata (publish, analytics, engagement, work, browse, webhook) | **ADAPT**                                  | Feed Capability/Implementation eligibility; do not create a second Social capability registry.                                                         |
| Official OAuth/API adapter pattern                                                   | **ADOPT**                                  | Preferred first-class integration path; credential material remains behind secret/adapter boundary.                                                    |
| Browser/plugin/QR auth mode abstraction                                              | **REFERENCE_ONLY**                         | May inform later sidecar fallbacks; not canonical platform architecture.                                                                               |
| Access/refresh token fields embedded in generic channel integration objects          | **REJECT**                                 | `Account Binding != Credential`; canonical Social contracts cannot store raw tokens/secrets.                                                           |
| Platform profile/selectable-account discovery                                        | **ADAPT**                                  | Useful during binding, but persisted output must be a safe `SocialChannelBinding`, not a credential snapshot.                                          |
| Platform-specific content/media rules                                                | **ADAPT**                                  | Normalize into target-specific validation/transformation; do not leak platform schema into upstream Product/Media owners.                              |
| Platform-specific transforms/options                                                 | **ADAPT**                                  | Allowed only at DistributionTarget/adapter boundary with exact payload snapshot/fingerprint.                                                           |
| Scheduling / `publishAt`                                                             | **ADAPT**                                  | Useful intent field; actual scheduling/execution is governed by existing Execution and platform support.                                               |
| Retry UI / retry publish task                                                        | **ADAPT**                                  | Must obey idempotency and delivery uncertainty rules. Retry is forbidden until reconciliation when delivery may already have occurred.                 |
| Publish provider returning post ID/permalink                                         | **ADAPT**                                  | Treat as evidence candidate, not automatically final platform truth.                                                                                   |
| `verify` / polling / webhook reconciliation                                          | **ADOPT**                                  | Core pattern for `Execution success != Platform Published`.                                                                                            |
| Publish record lifecycle/status UI                                                   | **ADAPT**                                  | Useful presentation pattern; MO state derives from exact Social receipt/reconciliation.                                                                |
| Analytics account/work snapshots with snapshot times                                 | **ADAPT**                                  | Maps well to `SocialPerformanceObservation`; raw metrics do not create business truth.                                                                 |
| Multiple analytics sources including crawler source                                  | **REFERENCE_ONLY**                         | Official API source preferred; every non-official source requires provenance and policy review.                                                        |
| Normalized comment list/thread model                                                 | **ADAPT**                                  | Good basis for CommentEvent normalization, with exact platform/work/thread provenance.                                                                 |
| Unified comment/reply inbox UX                                                       | **ADAPT**                                  | Good product pattern; MO should surface professional inquiry/opportunity context rather than build a generic creator inbox.                            |
| Reply draft assistance                                                               | **ADAPT**                                  | Use existing Managed AI; draft never grants send authority.                                                                                            |
| Reply send adapter                                                                   | **ADAPT**                                  | Only behind current human review / protected-action / Execution path.                                                                                  |
| Scheduled/automatic reply execution                                                  | **REJECT**                                 | Violates current `AI Draft != Send` and human/protected-action boundary.                                                                               |
| Generic auto-like/follow/repost/bookmark actions                                     | **REJECT**                                 | Outside current MO product purpose and creates unnecessary platform/abuse risk.                                                                        |
| Work list/detail/ownership verification                                              | **ADAPT**                                  | Useful for reconciliation and source references; ownership verification must remain platform evidence, not rights ownership.                           |
| Search/browse creator/work APIs                                                      | **REFERENCE_ONLY**                         | Useful to design SourceSubscription later; no broad crawling runtime in current phase.                                                                 |
| Social crawling skill that downloads media for republishing                          | **REJECT** as default flow                 | It assumes acquisition and republishing are operationally allowed. MO requires explicit rights/provenance and defaults third-party items to REFERENCE. |
| User-supplied URL extraction/metadata capture                                        | **ADAPT**                                  | May support `AcquiredSocialItem` as reference evidence without granting download/reuse rights.                                                         |
| Saving temporary crawled media into a permanent content library                      | **REJECT** without rights evidence         | `Acquired Content != Owned Asset`.                                                                                                                     |
| Electron local sidecar pattern                                                       | **REFERENCE_ONLY**                         | Potential future fallback for platforms without official APIs; requires dedicated security, policy, update, and secret-isolation design.               |
| Browser automation as normal publishing path                                         | **REJECT**                                 | Not a default production path for MO; brittle, policy-sensitive, and credential-heavy.                                                                 |
| Cookie/session scraping in Electron or cloud service                                 | **REJECT** in canonical/cloud architecture | Cookies/session tokens must never enter Social business contracts or central generic storage.                                                          |
| Direct calls to creator-site internal/private endpoints                              | **REJECT** as production foundation        | Platform-policy and stability risk; may only inform feasibility research.                                                                              |
| Raw platform response stored indiscriminately                                        | **REJECT** as canonical truth              | Retain only bounded safe evidence refs where needed; normalize canonical Social facts.                                                                 |

## Patterns worth carrying forward

The highest-value AiToEarn contribution is not its product IA or database. It is the adapter lifecycle:

```text
discover capability
→ validate
→ normalize
→ publish
→ finalize/verify
→ reconcile
```

plus:

```text
official API / platform adapter
→ platform-specific result
→ normalized platform evidence
```

MO should place those patterns under its existing:

```text
Workspace
→ Capability
→ Implementation Profile
→ Protected Action / Execution
→ Evidence / Audit
```

and add bounded Social facts only where current owners do not already exist.

## Patterns intentionally rejected

The following must not become hidden technical shortcuts:

- browser automation as the canonical integration layer;
- central cookie/session collection;
- auto-reply or auto-engagement without protected authorization;
- bulk download/repost semantics that imply ownership;
- platform success codes promoted directly into durable "published" truth;
- a second Social provider/capability/execution/evidence stack.

## Result

AiToEarn is a strong **adapter/flow reference**, especially for platform normalization and reconciliation.
It is not a canonical MO runtime and should not be imported wholesale.
