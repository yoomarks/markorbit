# MO MVP TASK 031A — Milestone 6 scope and architecture lock

- **Task ID:** MO-MVP-TASK-031A
- **Baseline:** M5-WP-08 final GO merge `242b34f806711df608a7178b238104289e65bb00` / PR #70.
- **Task type:** planning / architecture decision only.
- **Status:** `PROPOSED_FOR_APPROVAL`.
- **Objective:** select and bound the next MVP milestone after the Milestone 5 `GO` audit without starting runtime implementation in this planning task.
- **Proposed direction:** `DURABLE_CAPABILITY_LEARNING_AND_PRIVATE_REFLECTION`.

## Numbering note

The historical Task Index already reserves `MO-MVP-TASK-031` for Jurisdiction Recommendation. This milestone planning task uses `TASK 031A` rather than rewriting or reusing that identifier.

## Canonical basis

TASK 031A is governed by:

- `AGENTS.md` repository locks;
- `docs/product/MVP-PRODUCT-LOCK.md`;
- `docs/planning/FOUR-WEEK-PLAN.md`;
- the Milestone 5 scope, implementation traceability, reliability and final GO audit;
- the accepted Capability Canon semantics referenced by `AGENTS.md`;
- the existing Capability Engine service and Lite Capability Center product boundary.

The controlling semantic locks remain:

- Capability = Stable Outcome Contract + Governed Implementation + Evidence Base + Version Lineage + Controlled Evolution;
- Capability hierarchy = Domain → Capability → Skill → Action / Invocation;
- Reflection Candidate is not canonical truth;
- Provider Supply Capability is not user Capability evidence;
- Provider Return is not Official Truth and is not direct user Capability evidence;
- task completion does not automatically verify Capability;
- AI output cannot automatically mutate formal state or Capability Canon;
- Payment is not performance, authority, acceptance or completion;
- external protected actions require explicit authority;
- no cross-service SQL is permitted.

## Repository gap after Milestone 5

Milestone 5 closes the governed application/lifecycle loop through explicit evidence review, exact reviewed-source admission, durable lifecycle projection and Recommended Actions.

That creates the prerequisite source quality that the M5 planning decision said Capability learning should wait for.

The remaining Capability learning Beta loop is still incomplete. The four-week plan calls for:

```text
Capability Profile
-> Twin projection
-> Ledger
-> private Reflection Candidate
```

The current Capability Engine runtime remains fixture-oriented: its request path uses an in-memory repository and a hard-coded `trademark-application-recommendation` / `0.1.0-fixture` capability identity/version. That proves a thin request slice, but not durable Capability version lineage, private evidence learning or controlled reflection.

## Proposed Milestone 6 outcome

An authenticated Lite professional can accumulate private, exact, governed Capability evidence from reviewed MarkOrbit work outcomes; inspect an append-oriented private Capability Ledger; receive an explainable private Reflection Candidate; explicitly accept, reject or defer that candidate; and recover a deterministic private Capability Profile/Twin projection after restart.

The outcome must preserve:

- accepted Capability Canon authority and version lineage;
- Core identity / Workspace / Principal ownership;
- Capability Engine ownership of runtime Capability definitions, private observations, Ledger, Reflection Candidates/Dispositions and Profile/Twin projections;
- Execution/MarkReg ownership of governed source work truth;
- MGSN ownership of Provider Return and Provider Supply Capability without conversion into user Capability truth;
- exact source identity/version/fingerprint or equivalent stable provenance;
- database-per-owner isolation and no cross-service SQL;
- durable idempotency, replay and optimistic concurrency;
- private-by-default subject-user isolation;
- no automatic Capability verification, Canon mutation, public ranking, permission escalation, finance, legal appointment, external Filing Submission or Official Truth.

## Direction decision

TASK 031A proposes Capability learning and private reflection as the next milestone because:

1. M5 explicitly deferred Capability learning until reviewed lifecycle outcomes existed; that prerequisite is now complete with a `GO` audit;
2. the MVP Product Lock explicitly requires a fifth Beta loop: Capability learning;
3. the four-week Beta plan explicitly names Capability Profile, Twin projection, Ledger and private Reflection Candidate;
4. the current Capability Engine is still an in-memory fixture rather than a durable learning boundary;
5. private evidence-backed reflection closes a visible professional-user loop without introducing finance, official filing or public reputation authority;
6. the repository already freezes the critical negative semantics needed to build it safely: Reflection Candidate is not canonical truth, Provider Supply Capability is not user Capability evidence and task completion is not automatic Capability verification.

## Proposed work packages

- `M6-WP-01` — Capability learning contracts and canonical authority boundary.
- `M6-WP-02` — Durable runtime Capability Registry and version lineage.
- `M6-WP-03` — Durable Capability Observation Ledger and governed source admission.
- `M6-WP-04` — Private Reflection Candidate generation.
- `M6-WP-05` — Explicit Reflection Disposition and private Profile/Twin projection.
- `M6-WP-06` — Authenticated Gateway and Lite Capability Center.
- `M6-WP-07` — Reliability, privacy, replay, isolation, concurrency and browser matrix.
- `M6-WP-08` — Independent Milestone 6 integration and authority audit.

## Explicit authority boundary

Milestone 6 may create private governed truths only through bounded commands:

- runtime Capability definition/version admission from an accepted Canon source;
- exact Capability Observation admission;
- private Capability Ledger entry;
- private Reflection Candidate;
- explicit subject-user Reflection Disposition;
- private Capability Profile and Capability Twin projection.

It must not infer or create:

- verified Capability or professional certification;
- Capability Canon mutation from work evidence or AI output;
- public score, rank, star rating or marketplace reputation;
- Core role, permission or authority escalation;
- Provider Supply Capability → user Capability conversion;
- raw Provider Return → user Capability conversion;
- Payment, settlement or Invoice;
- legal/professional representative appointment;
- external trademark-office submission;
- Official Truth;
- autonomous Capability Twin execution authority.

An accepted private Reflection means the authenticated user accepted that reflection into their private profile. It does not mean MarkOrbit independently verified professional competence.

## Planning outputs

- `docs/planning/MO-MVP-MILESTONE-006-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-006-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-006-PLAN.json`;
- this task record;
- Milestone 5 completion-status reconciliation;
- Task Index and README planning-status reconciliation;
- exact-head hosted validation evidence for the final planning tree before it is presented for approval.

## Allowed changes in TASK 031A

Planning, architecture, task-index and repository-status documentation only.

## Prohibited changes in TASK 031A

No product code, runtime contract implementation, database migration, Capability Ledger record, Reflection Candidate, Profile/Twin state, Gateway route, Lite UI behavior, Payment/Invoice integration, external filing, Git tag, release or deployment freeze is part of TASK 031A itself.

## Approval gate

Merge of the TASK 031A planning PR will approve the Milestone 6 engineering direction and bounded work-package graph only. After that merge, the next approved implementation step is `M6-WP-01`.

Planning approval does not itself create runtime Capability state, verify a user Capability, mutate Canon, publish a public profile or authorize any external action.
