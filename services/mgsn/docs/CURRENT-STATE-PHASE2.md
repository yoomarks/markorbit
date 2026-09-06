# MGSN Current State & Phase 2 Audit

Issue: #844  
Audit baseline: `main@7b3b91291db0f0cdd5bbb71f5e9d670d49db6303` (2026-09-07)

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
| Provider Acceptance + Provider Return | IMPLEMENTED / PRODUCTIZED   | Existing M4 truth remains unchanged and the authenticated Provider Workspace action console is complete (#842 / #930). Acceptance != appointment; Provider Return != Official Truth.                                                  |
| Outcome + Trust Evidence              | IMPLEMENTED                 | Contextual/advisory evidence with current exposure authority. It is not a universal Provider quality score and is not Official Truth.                                                                                                 |
| Trusted Public Exposure               | IMPLEMENTED / LIVE_DEFERRED | Bounded trusted-public owner logic exists, but this does not authorize a public marketplace, live Provider contact/delivery or generic public discovery.                                                                              |
| Live Provider operation               | LIVE_DEFERRED               | No live contact/delivery, appointment, Filing, Payment or Official Truth authority is implied by the completed governed network path.                                                                                                 |

## Product-path closure

Epic #358 and its authenticated Workplace progression dependency #815 are closed on current repository history. The completed non-live path is:

`Participation + Visibility -> explainable Discovery -> explicit Human Selection -> Controlled Privacy Handoff -> governed Allocation -> Provider Work / Acceptance / Return`

This closure is not permission to collapse authority boundaries. The permanent locks remain:

- Public visibility != Contact;
- Need != appointment;
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

Current owner composition is split by reviewable authority domain:

- `src/http.ts` - legacy/provider-execution and Network Participation owner routes.
- `src/governed-network-http.ts` - small authenticated governed-network composition root; 73 lines at this audit.
- `src/governed-network-discovery-http.ts` - Discovery evaluation transport.
- `src/governed-network-selection-http.ts` - explicit Human Selection create/revoke/current-validation transport.
- `src/governed-network-handoff-http.ts` - Controlled Privacy Handoff authorize/revoke/current-validation transport.
- `src/governed-network-allocation-http.ts` - governed Allocation commit transport.
- `src/governed-network-http-boundary.ts` + `src/governed-network-human-action.ts` - genuinely shared trusted-principal, transport-shape and explicit-human-action helpers.
- `src/controlled-handoff-preparation-http.ts` - Handoff preparation/Privacy Preview boundary; preparation remains non-authorizing.
- `src/semantic-observability.ts` + `src/provider-workflow-observability.ts` - bounded privacy-safe operational telemetry with explicit no-Trust/no-ranking authority.
- `src/durable-runtime.ts` - production durable owner composition and telemetry sink wiring.
- domain owner services (`provider-discovery*`, `provider-selection*`, `controlled-privacy-handoff*`, `governed-allocation*`, `provider-work-*`, `allocation-provider-acceptance*`, `provider-return*`) retain canonical business authority.

## Phase 2 modularization audit

Completed. PR #920 froze the exact eight-route governed-network inventory before extraction. PRs #921, #927, #928 and #929 then extracted Discovery, Human Selection, Controlled Handoff and governed Allocation respectively while preserving the same route order and transport semantics.

The former ~77 KB `governed-network-http.ts` monolith is now a small composition root. Shared code was promoted only where it is genuinely common: trusted Workspace Principal/transport validation and the explicit human-action envelope. Selection and Handoff remain distinct authority domains.

The completed refactor preserves the original locks:

- no permission broadening;
- no body/browser identity becoming authoritative;
- no generic admin/proxy layer;
- no Selection/Handoff authority collapse;
- no governed Allocation fallback to legacy Allocation;
- fail-closed current-authority/source behavior remains intact;
- the exact eight-route inventory remains deterministic and guarded by tests.

## Documentation reconciliation findings

Completed in #923. The four materially stale V1 documents now open with current-state overlays that point back to this Canon while preserving their historical design bodies:

- `NETWORK-PARTICIPATION-VISIBILITY-V1.md`;
- `HUMAN-PROVIDER-SELECTION-V1.md`;
- `CONTROLLED-PRIVACY-HANDOFF-V1.md`;
- `PROVIDER-DISCOVERY-EXPLAINABILITY-V1.md`.

Historical `V1 Boundary`, `Future / Shared Dependency` and `Not Implemented` labels may still appear below those overlays because they describe the inception-time architecture freeze. They are not current implementation classifications.

## Semantic observability status

Implemented owner-locally. PR #932 adds bounded semantic telemetry for Discovery, Human Selection, Controlled Handoff and governed Allocation; PR #934 extends the same vocabulary to Provider Acceptance/Decline, Provider Return submission/correction and evidence-handoff completion.

The telemetry records only bounded operation/result classes, latency, replay where applicable and authorized candidate count where applicable. It does not retain Workspace/Provider/end-client identity, relationship graph, Applicant/Owner private fields, trademark/matter payloads, pricing/margin/payment amounts, private Handoff values, Provider Return free text/assertions, raw evidence/artifacts, bearer/session material, raw human-action envelopes or error messages. Sink failure is best-effort and cannot mutate, retry, deny or replace governed truth.

Operational telemetry remains explicitly non-authoritative:

- telemetry != Trust Evidence, appointment, Filing, Payment or Official Truth;
- selection count != Provider quality;
- acceptance/decline != universal quality or Trust evidence;
- Return submission/correction != verified completion or quality judgment;
- evidence-handoff completion != Filing or Official Truth;
- latency/availability != professional quality;
- telemetry != Discovery ranking authority.

Any future Trust Evidence use still requires its own canonical source authority and separately reviewed semantics.

## Execution closure for #844

1. **Completed in #919:** principal README/current-state Canon reconciliation.
2. **Completed in #923:** V1 current-state overlays without rewriting historical design intent.
3. **Completed in #920:** exact eight-route governed-network inventory/parity guard.
4. **Completed in #921 / #927 / #928 / #929:** authority-domain HTTP modularization.
5. **Completed in #932 / #934:** privacy-safe semantic observability across the governed funnel and Provider response/Return workflow.
6. **Final fresh-main audit:** README is current, the four historical V1 documents have overlays, Provider Workspace action-console productization is complete (#842 / #930), the J2 governed Provider journey is reconciled as an authenticated product consumer (#913), and public marketplace, Provider bidding, Public/Live Provider contact or delivery, Filing, Payment, appointment and Official Truth remain outside #844. AI may analyze, explain and recommend, but cannot automatically perform Selection, Handoff authorization, Allocation, Acceptance, Contact, Filing, Payment or Official Truth mutation.
