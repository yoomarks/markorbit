# UI Design and Engineering Standard

## Required workflow

Every UI task begins by loading the available `ui-design` skill.

```text
User and Job
→ Information Architecture
→ Primary Decision
→ State Matrix
→ Interaction Contract
→ Responsive Layout
→ Component Stories
→ Implementation
→ Visual Review
→ Playwright Journey
```

## Product distinction

### Lite

Dense but calm professional workspace. It optimizes multi-customer review, prioritization, evidence and batch work.

Primary navigation:

```text
Today | Content | Opportunities | Trademarks | Work | Capability | Guide
```

### markreg.com

Low-friction consumer service. It absorbs legal complexity and emphasizes clarity, confidence and next action.

Primary customer journey:

```text
Tell us about the brand
→ Review recommendations
→ Choose protection
→ Confirm price
→ Submit documents
→ Track progress
```

## Required states

Every data surface must define:

- loading;
- empty;
- partial data;
- error;
- permission denied;
- stale or conflicting data;
- success;
- destructive confirmation when relevant.

## Components

Use shared primitives from `packages/ui`. Product-specific workflow components remain inside their product app.

Approved accelerators:

- shadcn/ui component sources;
- Storybook;
- React Hook Form and Zod;
- TanStack Query;
- MSW;
- Playwright;
- Figma design handoff and Code Connect when editable access is available.

Do not generate generic dashboards without a UI brief.
