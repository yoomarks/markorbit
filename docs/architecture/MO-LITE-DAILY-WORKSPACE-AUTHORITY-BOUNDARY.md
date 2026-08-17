# MO Lite Daily Workspace — Authority Boundary

## Purpose

This document records the M9-WP-01 ownership and authority boundary for the MO Lite Daily Workspace.

The Product experience is:

```text
SEE -> CREATE -> MOVE
```

The architecture remains owner-based. Product language does not create new physical services.

## Reused lifecycle

M9 reuses the existing Product Loop and Lite content lifecycle:

```text
TodayRecommendation
-> PreparedAction
-> explicit confirmation
-> owner handoff

ContentOpportunity
-> ContentDraft
-> ContentReviewDecision
-> PublishPackage
-> ProductLoopUseFeedback
```

M9 adds bounded Daily/Content working projections around those objects. It does not create a second publication lifecycle.

## New M9 contract roles

### DailySignal

Lite-owned source-derived candidate input with exact governed provenance.

It may classify source material for Product use but does not certify legal/official truth and does not automatically create a Recommendation.

### DailyOrbitItem

Workspace-specific Product projection/ranking of a DailySignal.

It explains importance, personal relevance, time sensitivity and content potential. Ranking is not authorization.

### ContentPick

Editorial candidate tied to a Today Recommendation and Daily Orbit item.

It may suggest why to publish, angles and platforms. It is not a Content Draft or PublishPackage.

### ContentKit

Product working projection tied to the existing Content Opportunity.

It groups Why It Matters, Why Publish, angles, platform variants and references to existing Draft/PublishPackage/Visual objects. It has no publication authority.

### CreatorPreference

Minimum Lite Product preference/context. It may come from explicit configuration or bounded Product feedback. It is not Capability verification.

### VisualBrief / VisualOutputReference

Consumer-safe boundary between Lite and the governed visual engine. Lite supplies content intent and output need, not provider/model/payment/QC overrides.

### ProductPreferenceEvent

Workspace/user Product interaction evidence used for future relevance/product improvement. It does not prove that MarkOrbit performed an external action and does not prove professional Capability.

## Ownership matrix

| State / responsibility                                                  | Owner                                   |
| ----------------------------------------------------------------------- | --------------------------------------- |
| source discovery/fetch/provenance                                       | markorbit-knowledge                     |
| trusted Knowledge intake integrity                                      | Core                                    |
| identity/Workspace/Principal/permission                                 | Core                                    |
| DailySignal / DailyOrbit / ContentPick / ContentKit / CreatorPreference | Lite                                    |
| Content Opportunity/Draft/Review/PublishPackage                         | Lite                                    |
| visual assets/IP packages/recipes/provider routing/QC                   | MOKI universal visual engine            |
| formal trademark-service opportunity and professional work              | MarkReg                                 |
| governed protected actions                                              | Execution where applicable              |
| provider/network truth                                                  | MGSN                                    |
| professional Capability evidence/learning                               | Capability Engine                       |
| browser/API composition                                                 | Gateway                                 |
| bulk/public trademark data                                              | Data Engine via read-only contract only |

## Permanent semantic locks

1. DailySignal != legal/official truth.
2. DailyOrbitItem ranking != authorization.
3. ContentPick != ContentDraft.
4. ContentKit != content lifecycle owner.
5. ContentDraft != reviewed content.
6. Human Review != external publication.
7. PublishPackage != Published.
8. ProductPreferenceEvent != MarkOrbit-executed external action.
9. ProductPreferenceEvent != Capability verification.
10. VisualBrief != provider execution authorization.
11. AI preparation != user confirmation, human review, qualification or protected action.
12. SEE / CREATE / MOVE != service topology.
13. Brain remains a logical responsibility in M9, not a new physical service.

## Cross-boundary rules

- no cross-service SQL;
- no second identity or permission namespace;
- exact owner/id/version/fingerprint provenance is retained where source-derived state crosses a boundary;
- owner truth is not copied into Lite merely for convenience;
- visual engine internals are not exposed through Lite's consumer contract;
- user-reported external outcomes remain explicitly user-reported unless an owning integration independently verifies them;
- Product preference evidence cannot enter Capability verification without a separately governed admission contract.

## M9-WP-02 consequence

WP02 may now implement the real Knowledge -> Daily Signal runtime path against the `@markorbit/contracts/daily-workspace` contract. It should reuse Core's existing ReadyPackage content intake and expose a governed projection to Lite rather than adding cross-service database access.
