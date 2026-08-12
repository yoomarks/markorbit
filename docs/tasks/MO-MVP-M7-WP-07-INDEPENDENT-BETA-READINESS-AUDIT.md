# M7-WP-07 — Independent Beta readiness and authority audit

- **Work package:** `M7-WP-07`
- **Baseline:** M7-WP-06 merge `bf4592e5f87b3a27c3eacc07d1b59851f653b3cb` / PR #100.
- **Audited candidate:** `392996fe3a021e5151eca971d4fc655d2b68f25c`.
- **Audited tree:** `3065fea1ea6c0c9e2f720b65394c93da831f67b6`.
- **Status:** `READY_FOR_OWNER_REVIEW`.
- **Recommendation:** `GO`.

## Objective

Independently audit the exact M7-WP-06 candidate against the approved M7 scope, repository engineering rules, Week 4 exit obligations, owner boundaries, permanent authority locks, real-runtime evidence, deployment/recovery evidence and known limits.

The audit may produce `GO` or `FIX`. `GO` means only that the exact candidate is eligible for explicit Owner release consideration.

## Audit inputs

Canonical inputs are:

- `AGENTS.md`;
- `docs/planning/MO-MVP-MILESTONE-007-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-007-DELIVERY-PLAN.md`;
- `docs/architecture/BETA-READINESS-AUTHORITY-BOUNDARY.md`;
- `infrastructure/rehearsal/m7-wp-06-beta-rc.json` from the exact candidate;
- `infrastructure/rehearsal/m7-wp-06-known-limits.json` from the exact candidate;
- WP-06 run `31612894763` machine evidence;
- the exact candidate's required pull-request and workflow-dispatch GitHub Actions results.

## Independence rule

WP-07 does not qualify the audit branch as a new release candidate. The audited candidate remains the exact WP-06 head `392996fe3a021e5151eca971d4fc655d2b68f25c`.

The audit first proves that PR #100 merged the same Git tree as the candidate, then independently verifies the original candidate evidence and run inventory.

## Acceptance

The dedicated audit gate must prove:

1. audited candidate and merged WP-06 baseline share exact tree `3065fea1ea6c0c9e2f720b65394c93da831f67b6`;
2. original WP-06 matrix is `PASS` for the exact candidate;
3. fingerprint remains `sha256:ab18c9645a23cf3ea6ee973dcf341f6e5cece058c7fbeec023296517eb6e390c`;
4. all 15 required workflow runs are successful on the exact candidate SHA;
5. owner/persistence-boundary validators independently pass;
6. all six known limits remain explicit and contain impact plus mitigation;
7. all permanent authority distinctions remain intact;
8. WP-07 changes are restricted to audit/workflow/documentation scope;
9. repository-wide `pnpm check` passes;
10. the generated independent audit artifact returns `GO` while release/deployment authority remains false.

## Non-goals

WP-07 does not:

- change business runtime behavior;
- create a new service, route, contract or database state;
- re-run a new seeded candidate as a replacement for the audited exact head;
- deploy production traffic;
- publish a Beta release or release tag;
- create Payment/Invoice, legal appointment, Filing Submission or Official Truth;
- automatically verify Capability or mutate Capability Canon;
- create public Capability ranking/certification;
- grant autonomous Twin protected-action authority;
- authorize release merely because CI is green.

## Permanent release lock

```text
Independent Audit GO != Owner Release Authorization
Beta Release Candidate != Released Beta
Deployment Rehearsal != Production Deployment
Green CI != Owner Release Authorization
```

The candidate remains unreleased until a separate explicit Owner action.

## Exit gate

M7-WP-07 is complete when the dedicated hosted independent-audit workflow and the applicable repository pull-request gates pass on the final audit PR head.

After that, Milestone 7 has a final `GO` recommendation and the exact WP-06 candidate is eligible for explicit Owner Beta release consideration. The audit PR must not auto-merge and must not perform a release.
