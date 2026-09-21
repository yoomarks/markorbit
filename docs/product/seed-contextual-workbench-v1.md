# Seed / Agency Contextual Workbench V1

Status: **bounded interaction prototype for #1401**

## Product question

Can MarkOrbit combine a structured professional workspace with conversational work without turning
conversation text into a second business-truth system?

The V1 answer is **Structured World + Conversational Work**:

1. a structured object/task opens the workbench;
2. the workbench starts with a Context Brief instead of a blank chat;
3. one bounded question is handled at a time;
4. suggested answers and free text update only working context;
5. a reviewable result is prepared through an existing Product owner seam;
6. an exact structured confirmation remains separate from conversation;
7. the committed result and receipt come back from the existing owner.

## First bounded tasks

V1 demonstrates three Seed / Agency tasks only:

- Seed Customer Review;
- Opportunity Review;
- Client Action / draft preparation.

This is intentionally **not** a universal chat platform.

## Existing owner seams

The prototype may point to or consume existing product-owned workflow meaning:

- Seed Review owns source-backed customer/applicant/managed-asset review;
- Lite Product Loop owns Today Recommendation and Prepared Action semantics;
- MarkReg owns Formal Trademark Service Opportunity results;
- Lite Content owns prepared content results;
- existing confirmation/handoff receipts remain the committed outcome evidence.

The workbench does not create a new Customer, Asset, Matter, Opportunity, send, publish, payment,
filing or Official Truth owner.

## Authority rules

Permanent distinctions:

- conversation != business truth;
- working proposal != committed relationship;
- recommendation != Formal Opportunity;
- draft != send;
- prepared result != confirmed result;
- confirmation text in conversation != structured confirmation;
- fixture data != live owner truth.

For Seed Customer Review, conversational answers remain proposals and route back to the existing
structured review. For Opportunity Review and Client Action, the prototype delegates preparation and
confirmation through an injected existing Prepared Action journey seam.

## Information architecture

Desktop:

- left: Context Brief and evidence/currentness;
- center: Conversation with one bounded question, suggestions and free text;
- right: Current Working State, reviewable result, structured confirmation and committed result.

Mobile preserves the order:

`Context -> Conversation -> Current Working State`.

No required confirmation or warning is hidden on narrow screens.

## State matrix

The prototype explicitly represents:

- loading;
- empty;
- error;
- permission failure;
- partial context;
- ready/success;
- working proposal;
- prepared / awaiting confirmation;
- handoff pending;
- committed result.

A failure is never rendered as empty or success.

## Conversation retention

V1 retains turns and the current proposal in the open workbench session as working context.
It deliberately does **not** introduce a shared durable conversation store.

Durable conversation infrastructure should be extracted only after several real product journeys
prove the same storage, privacy, currentness and ownership seam.

## Acceptance evidence

The PR must provide:

- Storybook stories for the three initial tasks;
- loading / empty / error / permission / partial / prepared / committed states;
- a 390px mobile story;
- focused tests proving conversation alone does not invoke a mutation callback;
- focused tests proving Prepare and Confirm are separate explicit steps;
- repository lint, typecheck, tests, build and affected hosted CI.

No production route is added by this prototype.
