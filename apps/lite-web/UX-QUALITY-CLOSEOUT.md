# Codex B UX-quality closeout

Issues: `#1292`, `#1297`–`#1301`

Status: **COMPLETE for the bounded evidence lane.** This note does not authorize an Agency IA
cutover or change Product-owned workflow meaning.

## Delivered evidence

| Area                       | Evidence                                                                                                                                                                                                                                                                       | Boundary                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User-facing state coverage | The fixture-backed inventory distinguishes loading, empty, partial, stale/needs-refresh, unavailable, permission, error and success/ready. Missing cells remain explicit rather than being inferred.                                                                           | Agency IA and Trading stories remain outside this inventory.                                                                                             |
| Vocabulary and safety      | The AST audit rejects new internal architecture language, raw state tokens, unavailable-as-empty wording and collapsed lifecycle claims; existing findings stay itemized.                                                                                                      | Existing debt is a baseline, not approval. Trading repairs remain in its owner lane.                                                                     |
| Sources and diagnostics    | Canonical stories keep source evidence separate from AI interpretation and place technical diagnostics behind Advanced. Normal, partial, conflicting, unavailable and diagnostics-open states exist at desktop and 390px widths.                                               | The pattern remains Storybook/dev-only until Product evidence supports production placement.                                                             |
| Accessibility              | `jest-axe`, Storybook interactions and browser review cover status semantics, native disclosure semantics, keyboard reachability, visible focus, focus retention, no trap and disabled-action explanation. A negative fixture proves the automated audit detects a regression. | This is bounded evidence, not a repository-wide WCAG certification.                                                                                      |
| Responsive and visual      | `playwright.ux-trust-visual.config.ts` captures desktop working width and 390px review width for trust states, long identifiers/content, diagnostics closed/open, disabled actions and final-confirmation readiness. Every path asserts no horizontal overflow.                | Deep work remains supported here because the selected stories already expose a coherent 390px review mode; no new mobile workflow meaning is introduced. |

## Known gaps that require real Agency dogfood

- Whether `Sources & history` belongs in the production Agency IA, and which tasks need it by
  default, requires observed practitioner behavior rather than prototype preference.
- The disclosure density, terminology and ordering need validation with real long-running matters,
  mixed official/workspace evidence and genuine conflicting histories.
- Diagnostics access policy, support roles and escalation paths require Product and operational
  authority decisions; Storybook technical fields are fixtures only.
- Attention prioritization, notification burden, cross-client triage and draft handoff quality need
  longitudinal dogfood. This lane does not convert the Agency prototype into production navigation.

No follow-on child is created by this closeout. A future task should be opened only for a concrete
dogfood finding or regression with a bounded owner and acceptance path.
