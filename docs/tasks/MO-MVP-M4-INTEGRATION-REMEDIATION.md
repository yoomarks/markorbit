# M4 Integration Remediation — durable provider runtime composition

- **Milestone:** MO-MVP-MILESTONE-004
- **Trigger:** merged M4-WP-09 independent audit / PR #57
- **Initial audit recommendation:** `FIX`
- **Remediation PR:** #58 — merged
- **Remediated main baseline:** `327b61a22ad800250a2d9babe5997eb5a6a9e8eb`
- **Re-audit recommendation:** `GO`
- **Status:** `RESOLVED_AND_REAUDITED_GO`

## Objective

Close the three release-blocking integration findings recorded by M4-WP-09 without expanding Milestone 4 authority:

- `M4-INT-001` — normal MGSN startup did not compose the durable WP03–WP06 services;
- `M4-INT-002` — normal durable Execution runtime did not expose the Provider Return evidence handoff backed by Execution-owned persistence;
- `M4-E2E-001` — the repository did not prove the complete zero-interception Core + Gateway + Execution + MGSN + owner-PostgreSQL provider path through a reviewable Execution evidence receipt.

## Runtime remediation

### Core

Core exposes a trusted internal bounded Workspace lookup returning only Core-owned Workspace identity/status truth. MGSN consumes that boundary rather than duplicating identity truth or reading the Core database.

### Execution

Execution exposes trusted internal provider-execution routes for:

- exact current Execution source verification;
- exact Provider Return evidence handoff;
- bounded evidence receipt lookup for integration evidence.

The routes use Execution-owned repositories and preserve exact Filing Authorization, Execution Release and Filing Execution Task Draft lineage. A source is admitted only when the exact current IDs, versions, governed scope and fingerprint still match.

### MGSN

Normal MGSN runtime composition wires the durable Provider Registry, Service Package/Eligibility, Allocation/Acceptance and Provider Return services to the MGSN-owned PostgreSQL database. Core identity and Execution source/evidence are consumed only through bounded trusted HTTP dependencies.

No cross-service SQL is introduced.

## Permanent integration evidence

Permanent evidence is:

- `.github/workflows/milestone-4-integration.yml`;
- `scripts/m4-provider-runtime.integration.test.ts`.

The integration test runs real HTTP runtimes with three independent owner databases and no request interception or service stubs. It proves the path:

```text
Core identity/session
-> Gateway
-> MGSN Provider + Supply Capability
-> Service Package
-> deterministic Eligibility
-> explicit Allocation
-> authenticated Provider Acceptance
-> Provider Return
-> Execution evidence handoff
-> durable PENDING_REVIEW receipt
```

The test also verifies that the evidence receipt does not automatically create Payment, Invoice, legal/professional appointment, Filing Submission, Official Application truth, application-number truth, trademark-office acceptance, Formal Matter completion or user Capability verification.

## Authority boundary

This remediation changes integration composition only. It does not change the Milestone 4 authority model:

- Eligibility is not Allocation;
- Allocation is not Provider Acceptance;
- Provider Acceptance is not legal/professional appointment;
- Provider Return is evidence, not Official Truth;
- Evidence Handoff is not Filing Submission or Formal Matter completion;
- Payment and Invoice remain outside Milestone 4;
- automatic provider selection remains outside Milestone 4;
- external trademark-office submission remains outside Milestone 4.

## Acceptance result

The exact remediation head `4c75c837374f1e92e61bc1a612273c94990371cd` passed Milestone 4 integration, validation, M2/M3/M4 reliability and Browser/Visual Validation. Its Git tree `79efcbe2580e7fa372f0c7f5ebefe6f744216416` is identical to merged `main` commit `327b61a22ad800250a2d9babe5997eb5a6a9e8eb`.

The independent post-merge M4-WP-09 rerun records `GO`. The three blocking findings are closed.
