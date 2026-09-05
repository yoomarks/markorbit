# Examination Stage V1 — governed product truth boundary

- Issue: #799
- Parent: #376

## Decision

MarkReg's first post-Matter slice is a governed Examination workflow projection, not a trademark-office status registry.

V1 reuses the existing durable MarkReg Lifecycle Projection as its persisted workflow source. It does not create a second Examination state machine, a second Formal Matter identity, or an `official status` record merely to name the next Canon stage.

The first implementation after this freeze should be an owner-local read-only Examination Stage projection over the exact current and historical Lifecycle Projection for one Formal Matter. It may expose only examination-qualified lifecycle events admitted by a strict MarkReg-owned event-code/state policy. It creates no new lifecycle truth.

A separate durable Examination aggregate becomes justified only when MarkReg must own stage-specific immutable decisions or attributes that cannot be represented by the existing lifecycle substrate. A future canonical office-status producer may justify a separate authority-bearing source contract, but that source must remain distinct from this internal workflow projection.

## Current repository truth

Current MarkReg and shared substrate already provide:

- durable Workspace-scoped Formal Matters;
- exact Formal Matter version and source fingerprint lineage;
- Execution-owned Evidence Review decisions;
- exact `ReviewedSourceAdmissionEnvelope` handoff into MarkReg;
- durable MarkReg lifecycle events and current lifecycle views;
- exact source versions and fingerprints for lifecycle events;
- customer-safe lifecycle labels and summaries;
- durable Recommended Actions bound to exact Lifecycle View identity/currentness;
- Formal Matter Evidence and Matter Intelligence read projections.

The shared evidence-lifecycle contract fixes `officialStatusVerified: false` on `LifecycleEventProjection` and `CurrentLifecycleView`.

A successful reviewed-source admission therefore proves only that evidence was explicitly reviewed and admitted for bounded internal use. It does not prove what a trademark office has officially done.

Current `services/markreg/**` contains no dedicated Examination or office-action owner model and no proven canonical office source capable of establishing trademark-office Official Truth.

## V1 projection boundary

The future owner-local read projection should have semantics equivalent to:

```text
ExaminationStageProjectionV1
  workspaceId
  formalMatter { id, version }
  established: boolean
  current?
    sourceLifecycleView { id, version, fingerprint }
    sourceLifecycleEvent { id, version, fingerprint }
    workflowState
    eventCode
    customerSafeLabel
    customerSafeSummary
    sourceClass
    sourceCurrentness
    officialStatusVerified = false
  history[]
  deadline = unavailable unless exact governed source support exists
  authorityConsequences = all protected consequences false
```

This is a read projection. Canonical persisted workflow truth remains the exact lifecycle event and current-view history already owned by MarkReg.

Every established Examination projection remains bound to:

- exact Workspace;
- exact Formal Matter id and version;
- exact current Lifecycle View id, version, and fingerprint;
- exact current Lifecycle Event id, version, and fingerprint;
- exact Reviewed Source Admission id, version, and admission fingerprint;
- exact Evidence Review Decision identity;
- exact Evidence Receipt and Provider Return lineage already retained by the lifecycle source.

A historical event must never be rebound to a current Formal Matter merely because the ids still match.

## Truth classes

### `REVIEWED_EXTERNAL_EVIDENCE`

This is the positive external-evidence class the current boundary can prove.

It means an exact evidence receipt/provider-return lineage was explicitly reviewed, admitted for bounded internal use, linked to a Formal Matter, and used by MarkReg to project lifecycle workflow truth.

It does not mean:

- Provider Return is Official Truth;
- office status is verified;
- a deadline is certified;
- a legal conclusion was approved;
- filing or response submission occurred.

### `INTERNAL_PRODUCT_PROJECTION`

This is the MarkReg-owned interpretation of exact admitted evidence into bounded product workflow state.

It may answer what internal work state the Matter surface should show. It may not answer what the official office status is.

### `OFFICIAL_VERIFIED_SOURCE`

This class is unavailable in the current V1 substrate.

It is reserved for a future canonical producer that proves official-source identity, exact version/currentness/fingerprint, and the bounded facts that source is authorized to assert.

The current `ReviewedSourceAdmissionEnvelope` cannot be relabelled as official truth because a provider says the underlying evidence came from an office.

Until such a producer exists:

- V1 always exposes `officialStatusVerified=false`;
- official examination status is unavailable, not inferred;
- missing official-source data is not evidence that no examination action exists.

### `CUSTOMER_PROVIDED_EVIDENCE`

Current lifecycle provenance does not canonically distinguish customer-provided evidence from other reviewed external evidence.

V1 therefore does not invent this source class. Customer-provided material may only use the semantics that the current review/admission boundary can actually prove until a later contract exposes exact source-origin authority.

### `UNAVAILABLE_OR_AMBIGUOUS`

Use this whenever source authority or currentness cannot be established exactly. It never degrades into empty, current, or official truth.

## Examination event family

The Examination projection does not treat every post-Matter lifecycle event as Examination.

The first owner runtime should enforce this exact event-code/state family:

- `EXAMINATION_INTERNAL_PROCESSING` pairs only with `INTERNAL_PROCESSING`.
- `EXAMINATION_REVIEWED_EVIDENCE` pairs only with `REVIEWED_PROVIDER_EVIDENCE`.
- `EXAMINATION_WAITING_NO_ACTION` pairs only with `WAITING_NO_ACTION`.
- `EXAMINATION_CUSTOMER_ACTION_NEEDED` pairs only with `CUSTOMER_ACTION_NEEDED`.
- `EXAMINATION_CORRECTION_OR_REVIEW_ISSUE` pairs only with `CORRECTION_OR_REVIEW_ISSUE`.

These are internal workflow event codes, not office outcomes.

Any other event code is not an Examination V1 event. Any mismatched event-code/state pair fails closed in the future owner-local policy layer.

## `NOT_ESTABLISHED`

The read projection needs one non-persisted successful result state: `NOT_ESTABLISHED`.

It means only that no current lifecycle event qualifying under Examination V1 policy can be established for the requested Formal Matter.

It must not be interpreted as:

- no office action;
- examination has not begun;
- the application is pending;
- the application is clear or accepted;
- no deadline exists.

## Currentness and history

A lifecycle event may drive current Examination state only when all required exact currentness checks remain true.

At minimum:

- Workspace matches;
- Formal Matter id/version matches current owner truth;
- lifecycle event belongs to the exact current Lifecycle View;
- current event id/version/fingerprint matches the view;
- source lineage and fingerprints are complete;
- event-code/state pairing is admitted by Examination V1 policy.

Historical examination-qualified lifecycle events may be returned as bounded history, but they remain explicitly historical and cannot establish current workflow state.

Stale or superseded source remains attributable history. It is never silently rewritten to current source identity.

If MarkReg cannot establish lifecycle persistence, source authority, or currentness because a dependency is unavailable, return an explicit unavailable failure. Do not return `NOT_ESTABLISHED`.

## Deadline semantics

Examination V1 has no inferred deadline.

The current lifecycle and reviewed-source contracts do not carry an authoritative deadline plus basis/currentness tuple. Therefore V1 must not derive deadlines from:

- lifecycle event code or state;
- historical Matter Intelligence duration bands;
- AI or model output;
- provider prose that has not been normalized and admitted through an exact governed deadline-source contract.

Missing due-date truth is not proof that no deadline exists.

A future governed deadline source must provide at least:

- exact deadline value and temporal semantics;
- deadline/source type;
- exact source identity, version, and fingerprint;
- effective/currentness state;
- verification or admission basis;
- explicit limitations and authority semantics.

That is a separate source/contract task.

## Recommended Action interaction

The current bounded Recommended Action policy remains the correct attention mechanism for V1.

- `CUSTOMER_ACTION_NEEDED` may yield `CUSTOMER_ACTION_REQUIRED`.
- `CORRECTION_OR_REVIEW_ISSUE` may yield `REVIEW_CORRECTION_ISSUE`.
- Other lifecycle states yield no current action.
- No deadline is inferred.
- `executionAuthorized=false` remains mandatory.

V1 does not introduce an Examination-specific legal recommendation engine.

Acknowledge or Dismiss changes only advisory Recommended Action state. It does not approve a response, authorize filing, submit to an office, appoint/contact a provider, pay a fee, certify a legal conclusion, or create Official Truth.

## Human action boundary

The first V1 productization may allow a user to:

- read the Examination workflow projection;
- inspect exact evidence, currentness, and bounded history;
- acknowledge or dismiss the existing Recommended Action under its existing exact-version rules;
- navigate to existing governed Documents, Preparation, and Execution surfaces where those owner products independently authorize an action.

Examination V1 does not authorize:

- office-response creation or submission;
- a claim that filing occurred;
- provider contact or appointment;
- payment execution;
- official application-status mutation;
- deadline certification;
- approval of legal strategy or conclusion;
- protected state transitions from AI output alone.

Any future response-preparation or submission flow must use its canonical owner boundary and explicit authorization separately.

## AI and Capability boundary

AI or Capability may later assist with bounded preparation tasks such as summarizing admitted evidence, classifying evidence for human review, preparing a checklist or draft candidate, and explaining why the internal workflow is waiting or blocked.

AI or Capability may not independently establish Official Status, certify a deadline, decide a legal response, approve/submit a filing, or mutate protected Examination truth by inference alone.

AI output without admitted source lineage is advisory material, not Examination workflow truth.

## Evidence and audit minimum

The Examination projection exposes references and bounded summaries rather than duplicating raw private evidence.

Current and history entries should retain enough provenance to reconstruct:

- lifecycle event id/version/fingerprint;
- lifecycle view id/version/fingerprint where current;
- Reviewed Source Admission id/version/fingerprint;
- Evidence Review Decision identity;
- Evidence Receipt identity;
- Provider Return identity;
- Formal Matter id/version;
- occurred/projected timestamps;
- correlation identity;
- source-current or historical classification.

Raw evidence artifacts remain behind existing owner/access boundaries.

## Failure semantics

The owner read must distinguish these cases exactly:

- Unknown or cross-Workspace Formal Matter: privacy-safe `404` with no disclosure.
- Valid Matter with no qualifying Examination event: successful `NOT_ESTABLISHED`.
- Lifecycle/source dependency unavailable: explicit `503` or equivalent unavailable result, never `NOT_ESTABLISHED`.
- Source/event no longer current: historical/stale or explicit conflict according to operation, never silently current.
- Exact expected version/fingerprint mismatch on a future mutation: `409` conflict.
- Invalid Examination event-code/state pairing: explicit validation or policy denial with zero new projection truth.
- Missing official source: `officialStatusVerified=false` and official truth unavailable, never a negative official fact.
- Missing governed deadline source: no governed due date, never a claim that no deadline exists.

## Implementation split after this freeze

### MarkReg owner task A — next runnable task

Implement a read-only Examination Stage V1 projection under `services/markreg/**`.

Requirements:

- local type/projection first; no shared contract until a real external consumer proves one is needed;
- exact Formal Matter/Workspace read authority;
- reuse existing Lifecycle repository, current view, and bounded history;
- enforce the exact Examination event-code/state allowlist;
- return `NOT_ESTABLISHED` only for successful known absence;
- preserve unavailable, stale, historical, and current semantics;
- always keep `officialStatusVerified=false`;
- no migration while current lifecycle persistence is sufficient;
- internal owner GET only;
- focused unit and PostgreSQL restart/isolation/currentness tests.

This is the preferred next implementation because it productizes a genuine post-Matter owner read without fabricating Official Truth or new persistence.

### Integration task B — after owner read exists

Expose the exact MarkReg Examination read through authenticated Gateway using trusted Core Session/Workspace Principal authority and an existing suitable read permission.

The Gateway must preserve `404`, successful known absence, stale/currentness, and dependency-unavailable semantics without reinterpreting owner truth.

### MarkReg Web task C — after Gateway exposure

Add an Examination section to the Formal Matter workspace.

The UI must present internal workflow state as internal workflow state, keep source/currentness/history inspectable, distinguish `NOT_ESTABLISHED` from unavailable, and show no governed deadline unless a later canonical deadline source exists.

Existing Recommended Action remains the only bounded attention action in V1.

### Official-source and deadline task D — separate future dependency

If the product requires verified trademark-office status or deadlines, first define or consume a canonical producer that can prove those facts.

Do not widen `ReviewedSourceAdmissionEnvelope` semantics by convention or UI copy.

### Separate durable Examination aggregate — deferred

Do not add one in the first implementation. Reconsider only when a concrete stage-specific durable command or immutable attribute cannot be represented by the existing lifecycle substrate.

## Parent #376 consequence

The path to satisfying the first post-Matter productization requirement is now concrete:

`Reviewed Evidence -> durable Lifecycle Projection -> MarkReg Examination Stage read projection -> authenticated Gateway read -> Formal Matter Examination UI`

This sequence creates a useful governed Examination workflow without claiming office Official Truth.

Opposition, Registration, Maintenance, Renewal, Ownership, and Cancellation/Dispute remain Canon-only until separately admitted.

## Permanent authority locks

- Examination Stage != Official Status.
- Lifecycle Projection != Official Status.
- Reviewed Evidence != Official Truth.
- Provider Return != Official Truth.
- Matter Intelligence != legal or professional conclusion.
- Recommended Action != authorization.
- Professional Review != filing or response submission.
- Preparation Lock != Filing Authorization.
- Filing Authorization != Filing Submission.
- No Payment, provider contact, filing, office mutation, or Official Truth is created by this boundary.
