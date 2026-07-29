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

## Continuation implementation evidence

The typed codecs are now invoked by the actual MarkReg and Lite entry points. Direct-link screens load through the existing Gateway clients, compare exact identity/version, focus recovery headings, retain read-only terminal evidence, retry only the same identity/version, and never invoke a mutation. Consultation, Recommendation and Quote gained three minimal owning-service GET routes forwarded by the Gateway; their HTTP integration test proves exact lookup, 404 without latest fallback, and no repository mutation.

Gateway inventory validation now extracts method/path pairs from Gateway source and compares the complete set and owner metadata. There are 53 runtime routes: the original audit's 48 governed/compatibility routes, three TASK 014 read-only routes, and two health probes. The earlier 47 was a faulty documentation extractor result: four multiline tuples were omitted and one `GET POST` parser artifact was included.

Storybook validation now builds the shared configuration for MarkReg and Lite into ignored diagnostic directories and verifies all 86 applicable IDs against each generated `index.json`, including duplicate-ID detection. The legacy `/v1/executions` HTTP regression test proves the response remains only `CAPABILITY_INVOCATION` / `RECORDED` and contains none of the filing, submission, official-application, office-contact or task-draft consequences.

The ordinary focused browser suite is explicitly fixture-intercepted UI recovery evidence, not real-runtime evidence. M-003 remains in progress until all TASK 013 real-runtime checkpoint navigation passes on desktop and mobile. M-004 remains in progress until the 17 descriptors have explicit owning-service and real-Gateway HTTP execution adapters; descriptor validation is not represented as behavioral execution.

## Runtime, M-003 and M-004 closure evidence

The six-runtime harness now registers each child before readiness, performs idempotent awaited reverse-order cleanup, waits after SIGTERM before bounded SIGKILL, closes logs, verifies port release, preserves the startup error with a `cleanupError`, and supports injected port maps/definitions. Playwright starts children in its own process group so normal, failure, timeout, and interrupt shutdown cannot orphan detached runtime groups. Regression coverage includes occupied ports, middle-service and Web failures, readiness timeout, named early exit, double stop, and successful/failed port rebinding.

The real-runtime path removed repeated workflow screenshots and is divided into Playwright steps for Consultation/Plan/Quote, Confirmation/Matter Draft, Professional Review, Documents/Ledger/Lock, Filing Authorization, Execution Release/Task Draft, nested deep-link reload checkpoints, and visual overflow evidence. Retries are zero. The complete path remains within the existing 30-second per-test budget: desktop 26.8 seconds and mobile 20.9 seconds in focused first runs. Each of six checkpoints uses the application codec, a new browser page, direct navigation and reload, exact ID/version/status assertions, canonical URL assertion, and observed Gateway methods restricted to GET. Thus direct entry and refresh cannot replay a mutation or create a duplicate active record.

The negative-path command now executes the complete MarkReg, Execution and real Gateway HTTP suites before validating the one-to-one descriptor adapter registry. All 17 descriptor IDs have Service and Gateway evidence; missing or unexpected adapters fail immediately. The Gateway additions specifically execute duplicate and stale Professional Review failures through started Execution and Gateway runtimes. Existing focused HTTP suites retain immutable-record, typed-error, idempotency, stale task-draft and false-authority assertions.
