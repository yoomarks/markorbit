# MarkOrbit UI Foundation

## Delivery audit

MO-MVP-TASK-003 establishes an engineering-ready visual language without connecting Task 002 APIs. The repository and runtime were searched before implementation; **ui-design skill unavailable** (no readable `ui-design/SKILL.md` was found), so the repository's `UI-DESIGN-STANDARD.md` workflow is the operational baseline. Figma is Starter / View and is not edited.

## Users, jobs and product distinction

| Product            | User and job                                                                                          | Density      | Navigation                              | Voice and interaction                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------- | --------------------------------------------------------------------------- |
| Lite               | Practitioners and small professional teams prioritize multi-customer work, evidence and opportunities | Medium, calm | Persistent professional side navigation | Precise; review-first; Guide is contextual assistance, never a generic chat |
| markreg.com        | Non-specialists understand choices and take the next safe step                                        | Low          | Linear journey and progress stepper     | Plain language; few decisions; assumptions and limits stay visible          |
| Operations Console | Internal operators diagnose exceptions and perform governed intervention                              | High         | Dedicated operational navigation        | Terse, diagnostic, explicit timestamps and audit consequences               |

The products share tokens and accessible primitives, not information architecture or Product-owned workflow meaning. Capability retains its canonical definition and hierarchy. Provider Return is not Official Truth; payment is not completion; no AI or fixture output causes formal-state, verification or canon mutation.

## Responsive direction

Lite and Operations Console are **desktop-first** because comparison and operational triage require space; at narrow widths navigation becomes a horizontally scrollable landmark and grids stack in priority order. markreg.com is **mobile-first** because customers may begin and resume intake on a phone; content stays single-decision, cards stack A→B→C and the primary action remains after explanations. Desktop layouts use a 12-column grid. No control requires hover. The static shells demonstrate, but do not claim, complete production responsiveness.

## Internationalization readiness

Copy is externalized conceptually and layouts tolerate approximately 30% expansion. Do not concatenate translated sentences. Store machine values independently of presentation. Render dates with locale-aware `Intl.DateTimeFormat`, show the time zone when operationally relevant, and never use ambiguous numeric dates. Render money with ISO currency through `Intl.NumberFormat`, including the currency code when symbols conflict. Show country display name plus ISO code in professional/operational contexts. Language selectors use autonyms (for example, “Deutsch”), while internal logs preserve stable language codes. Translation delivery is out of scope.

## Semantic visual rules

Brand is independent from status. Error/danger means an operation failed or destructive risk exists; warning means review or attention without asserting failure; pending/info means incomplete or informational work; success means the stated bounded step succeeded—not authority, filing, acceptance, performance or official truth. Every state includes text and/or icon in addition to color. Status colors are never used decoratively as brand colors.

Fixtures use a persistent, bordered amber `FixtureBanner` and local `Fixture only` badges. They must never resemble live, legal or official output. Recommendations always expose rationale, assumptions and limitations.

## Prohibited patterns

- Generic AI chat as the product or a Guide detached from workflow context.
- Generic CRM table walls in Lite, Lite navigation in Operations, or internal vocabulary in markreg.com.
- Hidden fixture status, color-only status, unlabeled form controls, placeholder-only labels or focus removal.
- Automatic external protected actions, formal-state changes, Capability verification or canon mutation.
- Treating a recommendation, Provider Return or payment as legal conclusion, Official Truth or completion.
- Arbitrary colors, spacing or typography inside components; product code consumes shared semantics.

## Interaction and state contract

All data surfaces implement the state vocabulary in `PAGE-STATE-MODEL.md`. Primary decisions state consequences before action. Destructive and protected actions require explicit review and approval. Loading retains page context; partial/stale content identifies what is trustworthy; recoverable errors preserve user input. Motion respects `prefers-reduced-motion`.
