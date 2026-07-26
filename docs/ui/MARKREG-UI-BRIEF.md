# markreg.com UI Brief

## User, job and journey

Enterprise customers, brand owners, founders and first-time applicants need to understand choices and safely progress without learning internal legal/operations vocabulary. The locked journey is Visitor → AI Consultation → Account → Guided Intake → Recommendation → Plan → Quote → Payment → Documents → Order/Matter → Professional Review → Filing/Fulfillment → Portal → Lifecycle. Payment explicitly means payment only—not performance, authority, acceptance, filing or completion.

## Page map

| Page                      | Primary decision / content                               | Desktop and mobile                                     |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| Public Landing            | Is this service relevant and what happens next?          | Trust/next-action sections; single-column narrative    |
| Consultation Start        | What outcome and context should I explain?               | Guided prompt; one question per viewport               |
| Guided Intake             | Is the brand/use/market information complete?            | Step form with summary rail; step form and save/resume |
| Recommendation Comparison | Which explained scope fits my goal?                      | A/B/C comparison; cards stacked A→B→C                  |
| Plan Selection            | Which service/support plan fits?                         | Plain comparison; one expanded choice at a time        |
| Quote Review              | Are price, scope, assumptions and exclusions understood? | Summary + total; ordered breakdown                     |
| Document Checklist        | What must I provide next?                                | Checklist with why/format; prioritized actions         |
| Order Status              | What happened and what is next?                          | Timeline; compact milestone stream                     |
| Customer Portal           | What needs my attention across matters?                  | Action-led overview; one-column action feed            |
| Trademark Lifecycle       | What status/evidence/action is current?                  | Evidence timeline; simplified lifecycle cards          |

## Recommendation Comparison contract

A/B/C are exactly **Essential Protection**, **Recommended Protection**, and **Extended Protection**. Each card shows option code, plain summary, recommendation state, why/rationale, assumptions, limitations and selection. The recommended option explains its basis without claiming a legal conclusion. Fixture environments permanently display: **“Demonstration only — not legal advice or an official filing recommendation.”** A professional review gate precedes protected external action.

## Core flows and states

Visitor begins consultation → creates account/draft recovery boundary → answers guided intake → reviews goal summary → compares A/B/C → selects plan → reviews quote → pays → provides documents → sees Order/Matter → professional review → explicit approved filing/fulfillment → portal/lifecycle. AI/fixture output cannot mutate formal state.

All `PAGE-STATE-MODEL.md` states apply. Initial explains time/privacy; Loading never discards answers; Empty means no draft/order and offers a safe start; Partial identifies missing answers or unavailable recommendation pieces; Stale requires refresh before price/protected decisions; Warning foregrounds assumptions; Recoverable Error preserves answers; Blocking Error/Forbidden provides support without private detail; Offline supports safe local reading but no submission. Controls have labels, progress has text, choices work by keyboard and error focus moves to a summary then field.

## Task 003 fixture and acceptance

Only the static Recommendation Comparison is implemented. It uses local fixture data, does not call Task 002, and emits/consumes no events. Storybook desktop/mobile stories provide visual evidence. Task 073 Playwright acceptance: view goal summary and warning, compare all three cards by keyboard, hear recommended/selected state, verify assumptions/limitations, choose B and continue; repeat partial, stale, recoverable error and forbidden fixtures. Suggested delivery split remains Tasks 070–077 in the planning index.
