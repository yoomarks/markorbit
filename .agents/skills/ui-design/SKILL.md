---
name: ui-design
description: Required MarkOrbit UI implementation workflow. Use before changing any MarkOrbit browser UI, page, route, component, Storybook story, responsive layout, or Playwright user journey. Do not use it to redefine product canon, service contracts, or Product-owned workflow meaning.
---

# MarkOrbit UI Design

Use this skill before implementing any UI task in this repository.

The skill governs **how UI work is designed, evidenced, and accepted**. It does not create product truth, new service contracts, legal/professional authority, or shared workflow meaning.

## 1. Establish product truth first

Before editing UI code, identify:

- the user and job-to-be-done;
- the Product owner of the workflow meaning;
- the exact contracts / Gateway routes / durable owner truth the UI may consume;
- facts that are unavailable, partial, fixture-only, derived, or explicitly non-authoritative;
- non-goals and authority boundaries that the UI must not imply.

Do not invent live truth to make a screen look complete. Fixture data may support tests and Storybook states, but must never be mixed into a live production path.

## 2. Define the information architecture

Write the bounded IA before implementation:

- entry point and navigation context;
- primary user question the screen answers;
- list/detail/workbench hierarchy where applicable;
- primary action and secondary actions;
- read-only versus editable regions;
- provenance, status, warning, and partial-data placement;
- what remains unavailable and how that is shown truthfully.

Reuse Product-owned IA when it already exists. Do not force Lite and markreg.com into a shared experience merely because they share primitives.

## 3. Define the complete state matrix

Every UI task must account for the states applicable to the feature, including at minimum:

- loading;
- empty;
- error;
- permission/auth failure;
- partial data;
- success.

Also include task-specific states such as stale version, conflict, unavailable dependency, read-only ownership, pagination, or no-decision/no-result when the owner contract distinguishes them.

Never collapse a real failure into empty, undecided, unavailable, or success.

## 4. Design desktop and mobile together

Before implementation, decide:

- desktop composition and information density;
- narrow/mobile ordering, wrapping, scrolling, and action placement;
- how tables, metadata, status groups, and long text degrade on small screens;
- whether any interaction changes mode on touch/narrow layouts.

Do not treat mobile as a final CSS cleanup pass.

## 5. Reuse shared primitives without sharing Product meaning

Use `packages/ui` for shared visual primitives and interaction building blocks when they already exist.

Do not move Product-owned workflow semantics, navigation, domain copy, state interpretation, or information architecture into the shared UI package merely to deduplicate code.

Prefer existing components over new abstractions. Add a shared primitive only when multiple Product surfaces genuinely need the same primitive behavior.

## 6. Accessibility is part of the implementation

For each changed journey verify, as applicable:

- semantic landmarks, headings, lists, tables, forms, and buttons;
- meaningful labels and accessible names;
- keyboard reachability and logical focus order;
- visible focus indication;
- status and warnings are not communicated by color alone;
- error association and recovery are understandable;
- responsive zoom/text growth does not hide required content or controls.

Do not defer accessibility to a later polishing task.

## 7. Build bounded Storybook evidence

Create or update fixture-backed Storybook states for the meaningful UI states introduced by the task.

Storybook fixtures are rendering evidence, not live business truth. Keep fixture names and setup explicit enough that a reviewer cannot mistake them for owner/runtime data.

Prefer a small state matrix that proves the important branches over many decorative stories.

## 8. Produce visual review evidence

Review the implemented screen in the repository-standard browser environment at representative desktop and mobile widths.

Check:

- hierarchy and scanability;
- overflow, clipping, wrapping, and density;
- empty/error/partial states;
- interactive affordances and focus;
- misleading copy or implied authority;
- consistency with the owning Product's existing visual language.

Visual review must evaluate the actual implementation, not only a design mockup.

## 9. Add Playwright acceptance for the user path

For a new or materially changed user journey, add or update Playwright coverage where the repository has a browser acceptance path.

The acceptance path should prove the user-visible outcome and important negative/state boundaries, not merely that a page renders.

Do not intercept or replace a real owner/Gateway boundary in a test that claims real-runtime acceptance unless that suite explicitly permits it.

## 10. Completion checklist

Before declaring a UI task complete, confirm:

- [ ] user and JTBD are explicit;
- [ ] Product-owned information architecture is defined;
- [ ] desktop and mobile behavior are verified;
- [ ] loading / empty / error / permission / partial / success states are handled as applicable;
- [ ] unavailable owner truth is not invented;
- [ ] accessibility behavior is verified;
- [ ] shared UI primitives are reused without moving Product meaning into `packages/ui`;
- [ ] Storybook fixtures cover meaningful states;
- [ ] visual review evidence exists for desktop and mobile;
- [ ] Playwright acceptance covers the changed journey where applicable;
- [ ] focused tests, lint, typecheck, build, and affected hosted CI pass;
- [ ] the final diff contains no fixture leakage, temporary visual-debug code, or unrelated refactor.
