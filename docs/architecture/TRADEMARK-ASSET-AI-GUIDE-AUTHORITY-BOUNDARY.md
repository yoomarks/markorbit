# Trademark Asset Workspace and AI Guide Authority Boundary

## Status

This document is the M10-WP-01 authority boundary for the MO Lite Trademark Asset Workspace and contextual AI Guide.

It extends existing MarkOrbit owner boundaries. It does not create a new registry, Matter system, execution owner, Knowledge owner, Data Engine owner or autonomous legal agent.

## 1. Ownership model

| Concern | Owning boundary | Lite M10 role |
| --- | --- | --- |
| User / Workspace / Principal / permissions | Core | authenticated Product consumer |
| Order / Matter / Lifecycle Projection | MarkReg | exact reference and Product projection |
| protected execution / review evidence | Execution | exact reference and governed handoff |
| rules, office notices and source provenance | Knowledge | source/reference consumer |
| bulk/public trademark data | Data Engine | read-only contract consumer |
| private Trademark Asset working projection | Lite | Product owner |
| private tags / notes / attention | Lite | Product owner |
| contextual AI Guide suggestion | Lite-owned Product intelligence | assistive, non-executing output |
| professional Capability evidence | Capability Engine | separate governed evidence boundary |

No owner database may be reached through cross-service SQL.

## 2. Trademark Asset is not official truth

`TrademarkAsset` is a Workspace-private Product projection. It may combine identifiers, user-owned notes and exact references to owner/source records for convenient professional work.

The following distinctions are permanent:

```text
TrademarkAsset != official registry record
TrademarkAsset != Matter
TrademarkAsset != Order
TrademarkAsset != Lifecycle Projection
TrademarkAsset != Execution evidence
TrademarkAsset != Data Engine authoritative storage
```

A status, date, owner, class or identifier displayed from an external/owner source must retain its source and observation/freshness context. Unknown values remain unknown. Conflicting values remain visible as conflicting rather than being silently resolved by Lite.

## 3. Source and freshness boundary

A source-dependent Asset claim uses `TrademarkAssetSourceReference` with:

- owner;
- source kind;
- source id/version;
- optional fingerprint;
- observed timestamp;
- freshness state.

The initial freshness states are `CURRENT`, `STALE`, `UNKNOWN` and `CONFLICTING`.

Freshness is Product evidence about whether a source can safely support current assistance. It is not certification that a registry fact is legally current.

## 4. Data Engine boundary

Data Engine may support matching, search, normalization and public-record context only through an explicit read-only integration contract.

M10 must not:

- access Data Engine storage directly;
- mutate Data Engine records;
- copy Data Engine's ownership responsibilities into Lite;
- treat a Data Engine match alone as official/legal truth.

A `DATA_ENGINE_TRADEMARK_RECORD` source reference is therefore a provenance pointer, not an authority transfer.

## 5. Knowledge boundary

Knowledge remains acquisition and provenance. It may provide a rule, office notice, change or source material relevant to an Asset.

Lite may decide that the source is relevant to a particular user's Asset, but Knowledge does not own that user-specific relevance decision. Conversely, Lite may not rewrite the captured source into legal/official truth.

## 6. Attention boundary

`TrademarkAssetAttentionSignal` is an explainable Product signal. It may use current evidence for dimensions such as source freshness, time sensitivity, missing context, an existing MarkReg recommendation, a relevant Knowledge change or an explicit user priority.

Every signal must expose its reason and evidence.

An attention signal cannot certify a legal deadline, verify official status or authorize execution. Those consequences remain explicitly false in the contract.

## 7. Contextual AI Guide boundary

The AI Guide may:

- explain an accessible Asset;
- summarize accessible owner context;
- identify missing information;
- explain a relevant source change;
- compare accessible Assets;
- prepare a checklist;
- prepare bounded Today, Content or owner-action candidates.

The AI Guide may not:

- certify a deadline;
- verify an official status;
- submit a filing;
- contact a customer or provider automatically;
- approve professional review;
- create verified professional Capability;
- authorize paid execution;
- bypass owner-domain validation or protected-action gates.

`AiGuideSuggestion` therefore remains a suggestion even when it prepares an owner-action candidate.

## 8. Permission-safe context compilation

`AiGuideContext` must be compiled only from records available to the authenticated Workspace Principal. Asset identifiers do not grant access by themselves.

A direct identifier guess, copied URL or cross-Workspace reference must fail under the same permission rules as the underlying owner records.

Private Asset notes, tags and behavior remain Workspace Product state.

## 9. Existing Product-loop integration

M10 reuses M9 and Product Loop semantics rather than creating automatic consequences:

```text
Asset / Attention / AI suggestion
-> explicit user choice
-> bounded Today / Content / owner-action candidate
-> existing confirmation / review / owner validation
-> governed owner handoff where applicable
```

A prepared candidate is not an executed action. A Content candidate is not Published. A prepared owner action is not an Order, Matter or Filing until the existing owner-domain transition occurs.

## 10. Product feedback versus Capability evidence

Opening, saving, dismissing, comparing, asking the Guide, preparing a checklist or acting on an Asset suggestion are Product usage/preference events.

They do not automatically become professional Capability evidence and cannot verify Capability without a separately approved Capability Engine evidence contract.

## 11. Automatic consequences prohibited by M10

M10-WP-01 permanently excludes automatic:

- official-status verification;
- deadline certification;
- filing submission;
- customer/provider contact;
- Order or Matter creation;
- professional-review approval;
- paid execution;
- Capability verification;
- Official Truth creation.

These locks apply regardless of whether deterministic logic or an AI model produced the Product suggestion.

## 12. Merge and release authority

A green M10 engineering PR may be merged under the owner's repository-engineering authorization. Merge does not imply production deployment, GA, external filing, publication/outreach, provider execution, paid execution or Official Truth authority.
