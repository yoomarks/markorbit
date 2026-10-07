# Lite Capability Reflection runnable preview

- **Task ID:** `LITE-CAPABILITY-REFLECTION-RUNNABLE-PREVIEW`
- **Repository / allowed directories:** `apps/lite-web`, `tests/e2e`, `docs/ui`
- **Expected PR title:** `feat(lite): add runnable Capability Reflection preview`

## Outcome

An authenticated professional can understand one private, evidence-backed suggested reflection,
inspect why it appeared, explicitly accept, defer or reject its exact current version, and see the
resulting private practice picture without mistaking it for verification, ranking or public truth.

## Canonical sources and contracts

- `docs/architecture/CAPABILITY-LEARNING-AUTHORITY-BOUNDARY.md`
- `docs/tasks/MO-MVP-M6-WP-06-AUTHENTICATED-CAPABILITY-CENTER.md`
- `CapabilityCenterView`, `CapabilityLedgerEntry`, `ReflectionCandidate`,
  `ReflectionDispositionOutcome`, `CapabilityProfileProjection`, `CapabilityTwinProjection`
- Existing `CapabilityCenterClient` Gateway transport; no service contract changes

## Information architecture and behavior

The primary order is suggested reflection → reason and exact evidence → subject-user decision →
private practice picture → append-only evidence trail. Desktop uses a two-column decision/picture
layout. Mobile stacks the same semantic order with full-width 44px primary actions. Exact IDs,
versions, policy and fingerprints remain available in disclosure controls instead of dominating the
decision surface.

Successful fixture decisions emit the existing exact disposition command with candidate ID,
version, fingerprint and `ACCEPTED`, `DEFERRED` or `REJECTED`, then reload the owner view. Loading,
empty, partial, permission, recoverable error, stale conflict, ready and completed states remain
distinct. Status and errors use live-region semantics; headings, native details, buttons and source
order remain keyboard and screen-reader accessible.

## Acceptance and validation

- Storybook fixtures retain the permanent Capability Center state matrix.
- Component tests verify exact disposition payload and permission separation.
- Playwright verifies evidence-before-decision, all three decisions, stale recovery, desktop layout,
  390px ordering, touch target size and absence of horizontal overflow.
- Validate with Lite lint, typecheck, unit tests, build, Storybook build and the dedicated browser
  config.

## Non-goals

No Capability verification, Canon mutation, public profile, score, ranking, role/permission change,
Provider Supply Capability conversion, Payment/Invoice, appointment, filing, external action,
Official Truth, production authentication cutover or service/API change.
