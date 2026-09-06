# MGSN Current State & Phase 2 Audit

Issue: #844  
Audit baseline: `main@39174e5017594c86b4ba35fec925cb8599bbea09` (2026-09-06)

This document is the principal current-state entry point for MGSN after Epic #358. The older V1 documents remain valuable architecture records, but several were written as boundary freezes before their runtime implementation landed. Their historical status paragraphs must not be used as current implementation truth.

## Status vocabulary

- **IMPLEMENTED** — current MGSN owner/runtime code and tests exist.
- **PRODUCTIZED** — an authenticated product-facing path exists outside or through the owner boundary; this does not widen MGSN authority.
- **INTERNAL_ONLY** — current owner/runtime capability exists but is not a general product surface.
- **BOUNDARY_ONLY** — semantics are documented but current owner implementation is intentionally absent.
- **LIVE_DEFERRED** — bounded non-live/trusted behavior may exist, but public/live Provider operation is not authorized.

## Current capability map

| Capability                            | Current classification      | Current owner/runtime truth                                                                                                                                                                                                           |
| ------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider Registry + Supply Capability | IMPLEMENTED / INTERNAL_ONLY | Durable MGSN owner truth with Core Workspace references; no duplicated identity.                                                                                                                                                      |
| Service Package + Eligibility         | IMPLEMENTED                 | Existing M4 execution substrate remains authoritative and backward compatible.                                                                                                                                                        |
| Network Participation + Visibility    | IMPLEMENTED                 | Durable owner service and authenticated owner transport exist; Provider `ACTIVE` alone still does not imply participation or exposure authority.                                                                                      |
| Provider Discovery + explainability   | IMPLEMENTED / PRODUCTIZED   | Current Discovery composes Participation/Visibility, operational/supply suitability and Direct-Executor evidence. Post-#841 it can also consume exact contextual Trust decision-support evidence without score/rank/winner semantics. |
| Explicit Human Provider Selection     | IMPLEMENTED / PRODUCTIZED   | Durable exact-candidate lineage and current-authority validation exist. Human choice remains the Selection authority.                                                                                                                 |
| Controlled Privacy Handoff            | IMPLEMENTED / PRODUCTIZED   | Durable exact minimum-necessary authorization, current validation/revocation and privacy-preparation support exist. Evidence/reference visibility does not authorize artifact retrieval.                                              |
| Governed Allocation                   | IMPLEMENTED / PRODUCTIZED   | #716 admission reuses M4 Allocation while atomically preserving exact Selection/Handoff lineage; governed admission never falls back to legacy Allocation.                                                                            |
| Provider Work incoming authority      | IMPLEMENTED                 | Provider Work reads distinguish `CURRENTLY_USABLE`, `DENIED`, `KNOWN_ABSENT`, `UNKNOWN` and `SOURCE_UNAVAILABLE` without embedding private field values.                                                                              |
| Provider Acceptance + Provider Return | IMPLEMENTED                 | Existing M4 truth remains unchanged. Acceptance != appointment; Provider Return != Official Truth. Task-first Provider Web action-console productization remains separate work (#842).                                                |
| Outcome + Trust Evidence              | IMPLEMENTED                 | Contextual/advisory evidence with current exposure authority. It is not a universal Provider quality score and is not Official Truth.                                                                                                 |
| Trusted Public Exposure               | IMPLEMENTED / LIVE_DEFERRED | Bounded trusted-public owner logic exists, but this does not authorize a public marketplace, live Provider contact/delivery or generic public discovery.                                                                              |
| Live Provider operation               | LIVE_DEFERRED               | No live contact/delivery, appointment, Filing, Payment or Official Truth authority is implied by the completed governed network path.                                                                                                 |

## Product-path closure

Epic #358 and its authenticated Workplace progression dependency #815 are closed on current repository history. The completed non-live path is:

`Participation + Visibility -> explainable Discovery -> explicit Human Selection -> Controlled Privacy Handoff -> governed Allocation -> Provider Work / Acceptance / Return`

This closure is not permission to collapse authority boundaries. The permanent locks remain:

- Candidate != Selection;
- Selection != Handoff;
- Selection != Allocation;
- Handoff != Allocation;
- Allocation != Acceptance;
- Acceptance != professional/legal appointment;
- Provider Return != Official Truth;
- Trust Evidence != score/rank/winner;
- evidence/reference visibility != artifact retrieval;
- AI explanation/recommendation != Selection/Handoff/Allocation/Acceptance/contact/Filing/Payment authority.

## Principal code entry points

Current owner composition is spread across deliberate domain services plus two broad HTTP surfaces:

- `src/http.ts` — legacy/provider-execution and Network Participation owner routes; current blob size at this audit: 25,710 bytes.
- `src/governed-network-http.ts` — authenticated governed-network progression transport; current blob size at this audit: 77,406 bytes.
- `src/controlled-handoff-preparation-http.ts` — dedicated Handoff preparation/Privacy Preview boundary; current blob size at this audit: 10,675 bytes.
- `src/durable-runtime.ts` — production durable owner composition.
- `src/provider-discovery.ts` + `src/provider-discovery-trust.ts` — candidate evaluation and bounded Trust-context composition.
- `src/provider-selection*.ts` — Selection owner truth/current authority.
- `src/controlled-privacy-handoff*.ts` + `src/controlled-handoff-current-authority.ts` — Handoff owner truth/current authority.
- `src/governed-allocation*.ts` — exact governed admission over existing M4 Allocation.
- `src/provider-work-incoming-authority.ts` — incoming authority projection without private field-value embedding.

## Phase 2 modularization audit

`governed-network-http.ts` is the strongest current coherence risk. Its ~77 KB size is not itself a defect, but it now contains multiple security-critical authority domains that should be independently reviewable.

The owner-local refactor should split only around existing authority boundaries:

1. Discovery routes;
2. Human Selection routes;
3. Controlled Handoff routes;
4. Governed Allocation routes;
5. only genuinely shared trusted-principal / explicit-human-action / idempotency / error helpers.

PR #920 has already frozen the exact current eight-route governed-network inventory on `main`, including duplicate method/path rejection. Every extraction slice must preserve that route guard and existing request/response semantics.

The refactor must not:

- broaden permissions;
- make body/browser identity authoritative;
- merge Selection and Handoff authority;
- introduce a generic admin/proxy layer;
- make governed Allocation fall back to legacy Allocation;
- change current fail-closed source/current-authority behavior.

## Documentation reconciliation findings

The following principal V1 documents contain materially stale inception-time status wording on current `main`:

- `NETWORK-PARTICIPATION-VISIBILITY-V1.md` still describes participation records/visibility enforcement as not implemented;
- `HUMAN-PROVIDER-SELECTION-V1.md` still labels all Selection semantics as V1 Boundary / Not Implemented;
- `CONTROLLED-PRIVACY-HANDOFF-V1.md` still says no runtime/API/database is implemented;
- `PROVIDER-DISCOVERY-EXPLAINABILITY-V1.md` opens as an architecture/contract boundary freeze even though the owner runtime and later Trust-aware consumer path now exist.

These documents should retain their historical design rationale, but their opening status headers need a short current-state overlay pointing here rather than rewriting the historical body.

## Semantic observability status

The semantic telemetry slice is **not yet implemented by #844**. Before adding it, audit existing repository observability conventions and reuse them rather than creating a second metrics substrate.

Required minimization remains strict: no end-client identity/contact, relationship graph, private Handoff field values, raw evidence/artifacts, Provider Return free text, pricing/margin/payment amounts, bearer/session material or raw internal authorization envelopes in metrics/logs.

Operational telemetry must never become Trust/ranking truth. Selection count, acceptance rate, declines, latency, availability and Return submission are operational facts only.

## Execution plan for #844

1. **This slice:** correct the principal README and freeze this current-state/modularization audit.
2. Add current-state overlays to materially stale V1 status headers without rewriting historical design intent.
3. **Completed in #920:** freeze exact governed-network route inventory/parity coverage.
4. Extract governed-network HTTP routes by authority domain in one or more owner-local, behavior-preserving PRs.
5. Audit and add privacy-safe semantic observability using existing repository conventions.
6. Run a final current-main coherence audit before closing #844.
