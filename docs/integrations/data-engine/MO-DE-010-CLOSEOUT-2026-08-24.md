# MO-DE-010 Closeout — 2026-08-24

## Decision

`MO-DE-010 — Trademark Asset On-Demand Product Admission` is accepted and complete.

This closeout recognizes one bounded downstream use of the already-completed G1 protected read plane. It does **not** unlock G2, Brain integration, global Lite Data Engine productization, production deployment, Official Truth or Protected Action.

## Authorization

The bounded implementation scope was explicitly authorized before runtime work:

- PR #193 — governance authorization;
- final head: `3c561fb32180a8409dccf020c88f4e8c97d81c96`;
- merge: `51fe5f48869d4a650fd302281c18c74a6ba6f93f`.

## Runtime implementation

PR #194 implemented the authorized product path:

- title: `MO-DE-010: admit Data Engine facts into Trademark Asset detail`;
- final exact head: `67ec70907df7ee1a8e9efd1620aad941802bf6ed`;
- squash merge: `9600daa6b3ddc8d75cfbfcd443341ee755a30129`.

All workflows triggered on the final #194 head completed successfully:

- validation — `32722585033`;
- M8 WP-06 Commercial Runtime Reliability — `32722585200`;
- MO-DE G1 Cross-Repo Acceptance — `32722585121`;
- Product Loop Candidate Qualification — `32722585024`;
- Product Loop Today Prepared Action — `32722585061`;
- Product Loop Content Preparation — `32722585054`;
- M7 WP-02 Conversion Analytics — `32722585110`;
- Product Loop Feedback Observability — `32722585052`.

The #194 cross-repository job genuinely started the pinned auth-required Data Engine provider and passed the Gateway acceptance group at 8 test files / 42 tests, including the real-provider MO-DE-010 Trademark Asset path.

## Acceptance-gate audit and repair

Closeout audit found one evidence-quality defect after #194 merged: the cross-repository workflow used the nonexistent package filter `@markorbit/lite` for its two Lite-specific commands. Those commands therefore did not execute in run `32722585121`.

This did not conceal a broken Lite runtime. The #194 exact head independently passed Lite lint/typecheck through repository validation and M7. However, a cross-repository acceptance gate that claims to verify Lite must enforce the real Lite package, so the gate was repaired before final closeout.

PR #195 changed only the workflow selectors:

- correct package: `@markorbit/lite-service`;
- final exact head: `012afea8d4a98d8c4362082bc8157d88559e23be`;
- squash merge: `d996b1cd1b3e4f18b4e68b593bb6bfb8d88f2992`;
- validation run `32724940769` — success;
- corrected MO-DE cross-repo run `32724940740` — success.

The corrected run explicitly proved:

- Gateway TypeScript typecheck executed and passed;
- `@markorbit/lite-service` TypeScript typecheck executed and passed;
- Gateway Data Engine acceptance: 8 files / 42 tests passed;
- Lite trusted Trademark Asset recomposition: 1 file / 3 tests passed;
- the real product path passed again: authenticated primary Gateway -> real auth-required Data Engine -> Lite fact recomposition.

PR #195 is acceptance-evidence hardening only. It does not change MO-DE-010 runtime semantics or expand product scope.

## Provider baseline and drift check

Final acceptance remains pinned to Data Engine SHA:

`57be59ab27e41ac99ae95922ce802aa189c48181`

At closeout, Data Engine `main` was:

`5e4888a001de866ca5b811151cf0afe13d5eef71`

The canonical frozen V1 contract blob remained:

`7567908e4d1c8d79eef27fb763fe63d58281f02a`

No V1 contract drift was observed between the accepted provider runtime and the provider main observed at closeout.

## Accepted product behavior

The admitted path is bounded to an existing M10 Trademark Asset detail request:

`authenticated client -> Gateway -> Lite durable Asset Anchor -> Gateway Data Engine CN/US case read -> factual mapping -> Lite composition -> client`

The Asset Anchor remains the product identity authority. Provider lookup requires supported `CN` or `US` jurisdiction plus `APPLICATION_NUMBER`.

Allowed mapped contribution kinds are:

- `APPLICATION_STATUS`;
- `APPLICATION_DATE`;
- `REGISTRATION_DATE`;
- `RENEWAL_DATE` only when explicitly present in the provider payload;
- `OWNER_NAME`;
- `NICE_CLASSES`.

Provider "current" records are carried with `UNKNOWN` freshness. They are not promoted to legal-current truth. Lite remains the sole owner of conflict-preserving composition, attention, confidence and recommendation semantics.

Provider not-found, unavailable, timeout, rate-limit, authentication or incompatible-response states degrade to the original M10 detail and never become fabricated negative facts.

## Preserved authority invariants

The completed runtime does not change these invariants:

- `officialTruthVerifiedByLite=false`;
- `legalDeadlineCertified=false`;
- `protectedActionAuthorized=false`.

There is no new Data Engine source-fact persistence in Lite/Core, no background synchronization, no source-fact writeback and no cross-service product SQL.

## Explicit non-authorizations after closeout

The following remain deferred and unauthorized:

- `/api/v1/us/changes` product consumption;
- `MO-DE-007 — US Trademark Change Feed Ownership` implementation;
- `MO-DE-008 — Cursor / Consumer Checkpoint Ownership` implementation;
- durable consumer cursor/checkpoint persistence;
- Brain indexing/retrieval integration;
- global Lite Data Engine productization or other Lite surfaces;
- legal conclusions or Official Truth certification;
- legal deadline certification;
- Protected Action authorization;
- production credentials, deployment or GA activation.

## Final state

- G0: complete.
- G1-A / `MO-DE-006`: complete.
- G1-B / `MO-DE-009`: complete.
- Overall G1: complete.
- `MO-DE-010`: accepted and complete.
- Cross-repository Lite acceptance gate: corrected and proven by PR #195.
- `MO-DE-007/008`: deferred, no implementation authorization.
- G2/G3/G4: no automatic unlock; any future implementation requires a new explicit authorization/decision.

Machine-readable authority remains `integration-status.yaml`; the human-readable shared requirement definition remains `requirements.md`.
