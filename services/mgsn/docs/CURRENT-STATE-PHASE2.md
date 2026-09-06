# MGSN Current State & Phase 2 Audit

Issue: #844  
Final audit baseline: `main@db85fa9301505c03cd8e35c24ec2bc1831fd622d` (2026-09-06), plus this final #844 Provider execution observability slice.

This document is the principal current-state entry point for MGSN after Epic #358. The older V1 documents remain valuable architecture records, but several were written as boundary freezes before their runtime implementation landed. Their historical status paragraphs must not be used as current implementation truth.

## Status vocabulary

- **IMPLEMENTED** — current MGSN owner/runtime code and tests exist.
- **PRODUCTIZED** — an authenticated product-facing path exists outside or through the owner boundary; this does not widen MGSN authority.
- **INTERNAL_ONLY** — current owner/runtime capability exists but is not a general product surface.
- **BOUNDARY_ONLY** — semantics are documented but current owner implementation is intentionally absent.
- **LIVE_DEFERRED** — bounded non-live/trusted behavior may exist, but public/live Provider operation is not authorized.

## Current capability map

| Capability                            | Current classification      | Current owner/runtime truth                                                                                                                                                                                                 |
| ------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider Registry + Supply Capability | IMPLEMENTED / INTERNAL_ONLY | Durable MGSN owner truth with Core Workspace references; no duplicated identity.                                                                                                                                            |
| Service Package + Eligibility         | IMPLEMENTED                 | Existing M4 execution substrate remains authoritative and backward compatible.                                                                                                                                              |
| Network Participation + Visibility    | IMPLEMENTED                 | Durable owner service and authenticated owner transport exist; Provider `ACTIVE` alone still does not imply participation or exposure authority.                                                                            |
| Provider Discovery + explainability   | IMPLEMENTED / PRODUCTIZED   | Current Discovery composes Participation/Visibility, operational/supply suitability and Direct-Executor evidence. It may consume exact contextual Trust decision-support evidence without score/rank/winner semantics.      |
| Explicit Human Provider Selection     | IMPLEMENTED / PRODUCTIZED   | Durable exact-candidate lineage and current-authority validation exist. Human choice remains the Selection authority.                                                                                                       |
| Controlled Privacy Handoff            | IMPLEMENTED / PRODUCTIZED   | Durable exact minimum-necessary authorization, current validation/revocation and privacy-preparation support exist. Evidence/reference visibility does not authorize artifact retrieval.                                    |
| Governed Allocation                   | IMPLEMENTED / PRODUCTIZED   | #716 admission reuses M4 Allocation while atomically preserving exact Selection/Handoff lineage; governed admission never falls back to legacy Allocation.                                                                  |
| Provider Work incoming authority      | IMPLEMENTED / PRODUCTIZED   | Provider Work reads distinguish `CURRENTLY_USABLE`, `DENIED`, `KNOWN_ABSENT`, `UNKNOWN` and `SOURCE_UNAVAILABLE` without embedding private field values. The Provider Web task-first action console is productized by #930. |
| Provider Acceptance + Provider Return | IMPLEMENTED / PRODUCTIZED   | Existing M4 owner truth is exposed through the governed Provider Workspace action flow. Acceptance != appointment; Provider Return != Official Truth.                                                                       |
| Outcome + Trust Evidence              | IMPLEMENTED                 | Contextual/advisory evidence with current exposure authority. It is not a universal Provider quality score and is not Official Truth.                                                                                       |
| Trusted Public Exposure               | IMPLEMENTED / LIVE_DEFERRED | Bounded trusted-public owner logic exists, but this does not authorize a public marketplace, live Provider contact/delivery or generic public discovery.                                                                    |
| Live Provider operation               | LIVE_DEFERRED               | No live contact/delivery, appointment, Filing, Payment or Official Truth authority is implied by the completed governed network path.                                                                                       |

## Product-path closure

Epic #358 and its authenticated Workplace progression dependency #815 are closed. The completed non-live path is:

`Participation + Visibility -> explainable Discovery -> explicit Human Selection -> Controlled Privacy Handoff -> governed Allocation -> Provider Work -> Acceptance / Return`

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

The governed-network transport is now split by authority domain rather than concentrated in one oversized transport file:

- `src/governed-network-http.ts` — explicit deterministic composer only;
- `src/governed-network-discovery-http.ts` — Discovery transport;
- `src/governed-network-selection-http.ts` — explicit Human Selection transport;
- `src/governed-network-handoff-http.ts` — Controlled Privacy Handoff transport;
- `src/governed-network-allocation-http.ts` — governed Allocation transport;
- `src/governed-network-http-boundary.ts` — shared exact-shape, principal, idempotency and bounded parsing helpers;
- `src/http.ts` — legacy/provider-execution and Network Participation owner routes;
- `src/provider-execution-semantic-observability.ts` — composition-only Acceptance/Return telemetry wrapper; it changes no owner state semantics;
- `src/semantic-observability.ts` — privacy-minimized semantic event vocabulary, classification and best-effort sinks;
- `src/controlled-handoff-preparation-http.ts` — dedicated Handoff preparation/Privacy Preview boundary;
- `src/durable-runtime.ts` — production durable owner composition.

The exact eight-route governed-network inventory remains frozen by #920 and the domain extraction slices preserve it. Selection and Handoff remain separate trusted-human-action authority domains; governed Allocation still has no legacy fallback.

## Phase 2 modularization result

The authority-boundary modularization is complete on current code. Discovery, Selection, Handoff and governed Allocation are independently reviewable modules with one explicit composer. Shared helpers are limited to transport validation/principal/idempotency/error concerns rather than a generic admin/proxy layer.

The refactor did not:

- broaden permissions;
- make body/browser identity authoritative;
- merge Selection and Handoff authority;
- introduce a generic admin/proxy layer;
- make governed Allocation fall back to legacy Allocation;
- change current fail-closed source/current-authority behavior.

## Documentation reconciliation result

The principal historical V1 documents retain their original design text and now carry current-state overlays:

- `NETWORK-PARTICIPATION-VISIBILITY-V1.md`;
- `HUMAN-PROVIDER-SELECTION-V1.md`;
- `CONTROLLED-PRIVACY-HANDOFF-V1.md`;
- `PROVIDER-DISCOVERY-EXPLAINABILITY-V1.md`.

Those overlays point here and explicitly distinguish inception-time `BOUNDARY / Not Implemented` wording from current implementation truth. The MGSN README also points here first. Provider Workspace productization is no longer described as pending after #930.

## Semantic observability result

Privacy-safe semantic telemetry is implemented for the governed funnel. #932 covers Discovery, Selection, Handoff and governed Allocation. The final Provider execution composition adds bounded Acceptance and Return events:

- Provider response recorded as `PROVIDER_ACCEPTED` or `PROVIDER_DECLINED`;
- Provider Return recorded as `PROVIDER_RETURN_SUBMITTED` or `PROVIDER_RETURN_CORRECTED`;
- idempotency conflicts remain distinct from stale/version conflicts;
- generic operation conflict, current-authority denial, authority/source unavailability and dependency unavailability remain bounded result classes;
- latency is recorded only as operation timing.

Telemetry retains no end-client identity/contact, relationship graph, Applicant/Owner private fields, trademark/matter payload, pricing/margin/payment amount, evidence/artifact payload, Provider Return assertion/free text, private Handoff values, browser/session secrets or raw internal authorization envelopes. Telemetry sink failure is best-effort and cannot alter governed owner truth.

Operational telemetry is explicitly non-authoritative. Selection count is not Provider quality; acceptance rate is not universal quality; decline is not negative quality evidence; Return submission is not verified completion; latency or availability is not professional quality; telemetry grants no Discovery ranking, Trust Evidence, contact, Filing, Payment or Official Truth authority.

## Final coherence audit

The final #844 audit preserves these conclusions:

1. current README/current-state docs describe the implemented post-#358 path rather than roadmap aspiration;
2. governed-network route inventory remains explicit and deterministic;
3. Selection and Handoff human authority remain separate;
4. governed Allocation remains exact-source/current-authority and never falls back to legacy Allocation;
5. Provider Workspace Acceptance/Return productization does not grant appointment, contact, Filing, Payment or Official Truth authority;
6. semantic telemetry distinguishes success/empty/deny/unavailable/conflict classes without private payload retention;
7. operational metrics remain outside Provider Trust/ranking authority;
8. Trusted Public and Live Provider operation remain deferred.
