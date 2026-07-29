# MO-MVP-TASK-014 — Storybook, Deep-Link and Negative-Path Closure

## Objective and baseline

TASK 014 starts from merged TASK 013 SHA `41c73d2b95f66dc7ed9d7fc02b2ffc65b7f75124`. This Draft-PR work closes auditable state-description gaps without adding business capability or declaring Milestone 1 frozen. The environment has no `origin`, so remote-main provenance and remote Node 22 status cannot be asserted locally.

## Implemented evidence

MarkReg and Lite now own typed URLSearchParams codecs. They parse, validate, serialize and canonicalize every governed target, distinguish malformed from unsupported routes, and extract exact identity/version. They never interpret a missing identity as “latest”. Lite targets remain under Work and its seven-destination navigation is unchanged.

The explicit recovery union covers loading, ready, blocked, stale, withdrawn, expired, not found, version mismatch, malformed, downstream unavailable and recoverable error. Read-only states encode that property; retry states retain the same identity/version. The codecs provide contracts for the existing Gateway clients; web packages do not import service implementations.

Cross-application handoffs are represented by the exact destination codecs: Matter Draft to Professional Review, completed Professional Review to Documents and Instructions, and Filing Authorization to Execution Release. A handoff must serialize the governed ID and expected version.

The Storybook manifest contains all eleven stages and nine requested state families, records N/A domain transitions with rationales, maps applicable cells to real fixture-backed stories, calls out 390px states, long content and authority warnings, and is validated by `pnpm test:story-matrix`. The validator is part of `pnpm check` and Node 22 milestone CI.

The consolidated 17-case negative-path descriptor records the owning boundary, established error meaning, Gateway status/code, immutable records, mutation expectation and authority consequence. Its readable report is derived from the same descriptors. Existing isolated owning-service suites and real Gateway HTTP suites are named as adapters; completing case-by-case executable adapter linkage remains required before M-004 can be declared resolved.

The route namespace policy records intentional compatibility debt. The route inventory makes fixture-only unauthenticated, non-production scope explicit. The legacy `/v1/executions` boundary remains an internal execution envelope and is not a filing/task-draft route.

## Browser and accessibility behavior

Matrix stories use semantic main/section/headings, a status role, keyboard-native retry/back controls, long wrapping content, explicit authority text, and mobile viewport metadata. They cover loading, success, blocked, recovery, long-content and domain-applicable terminal states. The visual delta is additive Storybook evidence rather than an application redesign.

## Non-goals and residual risks

No Order, Payment, Invoice, formal Matter, appointment, external assignment, Filing, Submission, official application/number, message, dispatch or office contact is created. There is no production authentication/persistence, route migration, new router, new workflow state, external filing, TASK 015 work or freeze declaration.

The typed codecs and Storybook matrix do not by themselves prove authoritative deep-link loading in the runnable apps. The focused recovery browser suite, direct-navigation/reload additions to both real-runtime paths, all 17 executable service/Gateway equivalence adapters, and remote Node 22 CI evidence remain residual TASK 014 work. Consequently M-003 and M-004 must not yet be marked resolved.

## TASK 015 handoff

TASK 015 remains solely responsible for reassessment and any freeze decision after all open acceptance evidence is green.
