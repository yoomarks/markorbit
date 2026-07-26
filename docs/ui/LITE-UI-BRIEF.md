# MarkOrbit Lite UI Brief

## User, job and architecture

Trademark agents, IP professionals, brand-service professionals and small teams need to prioritize customer work, review evidence and move governed work forward without losing Workplace context. Persistent navigation is locked to **Today, Content, Opportunities, Trademarks, Work, Capability, Guide**. Customer context is secondary to product navigation; Guide appears inside the current workflow and is not a chat destination detached from work.

## Page map

| Page                  | Primary decision / content                                                              | Desktop and mobile                                             |
| --------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Lite Shell            | Workplace, primary navigation, current context                                          | Fixed side rail; horizontal compact navigation on mobile       |
| Today Dashboard       | What needs attention now? Tasks, opportunities, trademark state, Capability suggestions | 8/4 priority grid; single priority stream                      |
| Opportunities List    | Which signal deserves qualification?                                                    | Filterable list, not CRM table walls; cards/compact list       |
| Trademark Portfolio   | Which asset needs review/action?                                                        | Portfolio facets and status; summarized filters                |
| Work Queue            | What should I review or advance?                                                        | Evidence/status queue; grouped priority stream                 |
| Capability Library    | Which governed outcome contract fits this work?                                         | Domain → Capability → Skill drill-down; progressive disclosure |
| Guide Workspace       | What contextual assistance helps the current step?                                      | Split context/advice; inline drawer below work                 |
| Customer Summary      | What relationship context is relevant?                                                  | Summary and scoped work; prioritized facts                     |
| Intake Summary        | Is supplied information complete and accurate?                                          | Review sections and gaps; accordion review                     |
| Recommendation Review | Are rationale, assumptions and limitations safe to advance?                             | Comparison plus review rail; stacked options                   |

Capability surfaces state the canonical outcome-contract meaning and never infer verification from task completion. Suggestions cannot mutate canon. Provider Supply Capability is not shown as user evidence.

## Core flows

1. Today → select due review → Customer Summary → Intake Summary → Recommendation Review → explicit approve/correct decision.
2. Opportunity → qualify signal → capture scoped intake → create work only after confirmation.
3. Work → invoke contextual Guide → review output and evidence → accept/correct; no automatic formal-state mutation.
4. Capability suggestion → inspect lineage/evidence → choose for governed work; no automatic verification.

## State and accessibility contract

Every page implements all states in `PAGE-STATE-MODEL.md`. Loading preserves Workplace/page identity; Empty explains useful setup; Partial names missing sources; Stale shows observed time; Unauthorized/Forbidden reveal no customer data; Recoverable Error retains filters/input; Blocking Error offers an auditable reference. Review cannot proceed with missing required evidence. Keyboard order follows navigation → context → heading → priority content → actions, landmarks are named, dense lists preserve headings and status never relies on color.

## Task 003 fixture shell

The implementation renders Shell + Today only: needs-attention items, opportunity/trademark/work summaries and a Capability suggestion. A prominent fixture banner distinguishes all data. It has no API call and emits/consumes no events.

## Acceptance and later tasks

Storybook desktop/mobile stories are visual evidence. Playwright acceptance for Task 050: load Ready fixture, tab through the locked navigation, open a needs-attention item, verify Workplace context and fixture banner; then exercise loading, empty, partial, error and forbidden fixtures. Later tasks remain 050 Shell/Today, 051 Content, 052 Opportunities, 053 Trademarks, 054 Capability, 055 Guide and 056 Work/Matter.
