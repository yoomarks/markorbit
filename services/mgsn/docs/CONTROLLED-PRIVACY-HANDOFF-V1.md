# Controlled Privacy Handoff V1

## 1. Status, outcome and scope

**MGSN-P0-004 / [#395](https://github.com/yoomarks/markorbit/issues/395), parent [#358](https://github.com/yoomarks/markorbit/issues/358).** Documentation / architecture boundary freeze only, audited on 2026-09-01 against fetched `origin/main` at `70acdf30cb92b8470e3d022965a1815da5598587`, in the dedicated `mgsn-d` branch/worktree.

The originating Workplace's authorized human needs to understand and authorize exactly which private fields may reach a selected final execution Provider for a bounded purpose. MGSN owns this disclosure authority boundary; the Workplace retains its customer relationship, private context and permissions.

```text
Need → Provider Discovery → Evidence + Explanation
→ explicit Human Provider Selection → Controlled Privacy Handoff
→ later independently governed provider collaboration
```

Handoff answers **who may receive which data, for what purpose, under whose authority, until when, with what revocation and audit rules**. It does not decide who should be selected/allocated, whether the Provider accepted, whether appointment exists, or whether contact, protected action, filing or payment may proceed.

**Implemented** below means inspected existing behavior only. **V1 Boundary / Not Implemented** denotes the new semantics in sections 3–14. **Future / Shared Dependency** denotes the separately scoped contracts and wiring requested at the end. Contracts changed: **NONE**. Events emitted/consumed by #395: **NONE**; no event names or infrastructure are introduced. No runtime, UI, API or database is implemented. Only this document changes.

## 2. Canonical basis and verified implementation gap

Read-only sources for this freeze:

| Source                                                                                                                                                                               | Reuse and boundary                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [AGENTS.md](../../../AGENTS.md), [Participation & Visibility V1](NETWORK-PARTICIPATION-VISIBILITY-V1.md)                                                                             | Private First; Core identity ownership; field/purpose/audience grants; no-row participation = NOT_PARTICIPATING/PRIVATE; current policy governs exposure.                                                          |
| [Human Provider Selection V1](HUMAN-PROVIDER-SELECTION-V1.md), merged via #390                                                                                                       | Exact human choice and source lineage; CURRENT is distinct from current usability; no customer-data or contact authority.                                                                                          |
| [Discovery boundary at PR #374 head](https://github.com/yoomarks/markorbit/blob/1d5e4702eaec39cc944fc46fe2149401e481d8ed/services/mgsn/docs/PROVIDER-DISCOVERY-EXPLAINABILITY-V1.md) | Read from exact `origin/mgsn-b` head; pending, absent on this base's main. Independent exposure/suitability gates, authorized candidate projection and evidence-reference restrictions. Not copied or merged here. |
| [provider-registry.ts](../src/provider-registry.ts)                                                                                                                                  | Existing `providerId` / `providerWorkspaceId`, active Core identity check and separate operational state; no final-executor proof or disclosure consent.                                                           |
| [service-package-eligibility.ts](../src/service-package-eligibility.ts)                                                                                                              | Exact Execution-source admission and private operational candidate/Eligibility evaluation; neither Network Visibility nor Handoff authorization.                                                                   |
| [allocation-provider-acceptance.ts](../src/allocation-provider-acceptance.ts)                                                                                                        | Explicit Allocation with exact eligible lineage; Acceptance derives Provider identity from authenticated Provider Workspace context. Neither authorizes customer-data disclosure.                                  |
| [provider-return.ts](../src/provider-return.ts), [provider-execution.ts](../../../packages/contracts/src/provider-execution.ts)                                                      | M4 Evidence Handoff requires current exact Provider Return and admitted Execution-source lineage. It is not this pre-collaboration privacy envelope; Return remains claims/evidence.                               |
| [http.ts](../src/http.ts), [Gateway MGSN wiring](../../../apps/gateway/src/mgsn-http.ts)                                                                                             | Existing internal Principal, Workspace checks, permissions and session/origin/CSRF conventions can be reused later. Existing `execution:manage` is not a new privacy-authorizing permission.                       |
| [M12 matching](../../lite/src/trademark-service-candidate-matching.ts), [M13 execution](../../execution/src/trademark-service-execution.ts)                                          | Candidate-only consequences and separately protected Provider instruction; neither implements purpose/field-specific Handoff consent.                                                                              |

**Implemented gap:** the existing M4 path governs Registry → Supply → Service Package → Eligibility → Allocation → Acceptance → Return → Evidence Handoff. M13 `createTrademarkServiceProviderHandoff` consumes a protected `PROVIDER_INSTRUCTION` release. Neither records an independent human authorization for an exact minimized customer-data projection with expiry and revocation. Renaming either existing Handoff would incorrectly combine distinct authorities. Reuse their references, exact-version, trusted-actor and audit conventions; do not change their state machines.

The inspected [HTTP boundary tests](../tests/http-boundary.test.ts), [Registry tests](../tests/provider-registry-postgres.test.ts), [Eligibility tests](../tests/service-package-eligibility-postgres.test.ts), [Allocation/Acceptance tests](../tests/allocation-provider-acceptance-postgres.test.ts) and [Return tests](../tests/provider-return-postgres.test.ts) establish existing isolation, lineage and replay behavior. They do not prove implementation of this V1 boundary.

## 3. Permanent privacy and authority locks

**V1 Boundary:** Private First; Trust Before Exposure; Relationship Ownership Remains with Organizations; Direct-to-Executor; No Rebrokering. A Handoff cannot widen Network Visibility or turn a selected Provider into an owner of the originating Workplace's customer relationship.

```text
Provider Candidate != Provider Selection
Provider Selection != Allocation
Selection != Handoff authorization
Handoff authorization != Provider engagement
Handoff authorization != external Provider contact
Handoff authorization != Allocation
Allocation != Provider Acceptance
Provider Acceptance != legal/professional appointment
Handoff authorization != M13 protected-action release
Provider Return != Official Truth
Evidence Handoff != Filing Submission
Payment != Performance / Authority / Acceptance / Completion
```

AI may analyze necessary data, explain privacy consequences, suggest minimization and flag risks. AI may not authorize Handoff, select/allocate/contact/appoint a Provider, accept for it, file, pay or create Official Truth. Provider Supply Capability is not user Capability evidence; completion cannot verify Capability or mutate the Canon.

## 4. Eligibility to enter Handoff review

Authenticate and authorize the requester before loading a private Selection, preparing its Privacy Preview or returning a historical envelope. The following are prerequisites, never automatic authorization:

| Required fact                           | Fail-closed requirement                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trusted originating Workspace and human | Resolve current Core Workspace identity, membership and action-specific authority from authenticated Workspace Principal context. Missing/archived Workspace, inactive membership or unknown authority denies review. The user must have authority to disclose these owner-controlled fields for this purpose, not merely read them. |
| Current usable Selection                | Consume the exact canonical #394 Selection ID/version and its current validation. Missing, SUPERSEDED, REVOKED, stale or unverifiable Selection denies review; CURRENT alone is insufficient.                                                                                                                                        |
| Exact lineage                           | Match originating Workspace, consumer owner, Need/work-package scope/version, Selection and selected Provider/Provider Workspace. Resolve exact #381 candidate/request/result and owner-source versions/fingerprints through Selection lineage, without defining a second candidate snapshot.                                        |
| Explicit proposal                       | Exact intended recipient/final Provider, purpose, requested data classes/fields, source references/versions and bounded validity must be known before a reviewable proposal exists.                                                                                                                                                  |
| Network authority                       | ACTIVE participation and current visibility for the relied-upon Provider projection, audience/purpose/context; current TRUSTED relationship evidence where required. No-row, pause/revoke, withdrawn relevant fields or unavailable policy denies new network Handoff.                                                               |
| Operational/source authority            | Provider operationally ACTIVE, relevant Supply/source/evidence versions and effective periods/freshness valid for the exact Need. Consume M4 Service Package/Eligibility only when the flow uses them; do not fabricate either as a precondition for pre-Allocation Handoff.                                                         |
| Responsibility authority                | Current canonical #375 final-executor/direct-responsibility/no-rebrokering evidence and required signer disclosure where the authoritative flow requires it; no caller-controlled opt-out.                                                                                                                                           |

Payload `authorizedBy`, actor or Workspace claims are not trusted authority. Reject a spoofed/mismatched claim even when the authenticated caller otherwise has permission; do not silently accept it as another user. A service credential, broad operator privilege or payload `humanConfirmed = true` alone is not an attributable human authorization.

Selection and Handoff may be authorized by different humans only when each has independently verified current authority for the same originating Workspace and action. Selection authority does not delegate disclosure authority.

## 5. Purpose and minimum necessary projection

The purpose must identify the intended professional task, exact consumer-owned Need/work-package and context sufficiently to justify each requested field. Case review, quotation preparation, professional instruction preparation, filing preparation and evidence review are examples, **not a new shared enum**. `network use`, `service`, `collaboration`, missing or ambiguous purpose is insufficient. Filing preparation does not authorize submission; quotation preparation does not disclose the originating quote or margin.

```text
requested data ∩ explicitly authorized data ∩ minimum data necessary for purpose
= handoff projection
```

Evaluate necessity against current owner rules and a named privacy-policy version, with a field-level reason and authoritative source. The human confirms the resulting exact projection; human assent cannot override a canonical exclusion or grant rights the human lacks. AI suggestions and caller-supplied necessity labels are not authority.

Never serialize a whole Workspace, Matter, customer record, Provider Registry record, Trademark Asset or CRM record merely because it exists. No wildcard, sibling-field expansion, raw object fallback or arbitrary attachment bundle is permitted. References, labels, free text and instruction fields cannot smuggle excluded content. A requested unauthorized/nonessential field is excluded with a privacy-safe explanation before review or the proposal is denied. If its omission makes the purpose impossible, deny; do not silently claim the original task can proceed. Unknown classification/rights/necessity denies the field, and mandatory unknowns deny the proposal.

Network policy continues to govern Provider-derived projections; it is not the authority for Applicant/customer fields. Those require their source owner's separate purpose/field authority. Conversely, an originating human cannot use Handoff consent to override another organization's withdrawn visibility or evidence rights.

## 6. Data-class separation

Every row defaults to **PRIVATE**. “Conditional” requires exact purpose, owner authority, field authorization, necessity and current validity; it never means whole-record access. Generic V1 exclusions cannot be enabled by a checkbox or free-text consent. Any distinct canonical authority for excluded relationship/commercial data is outside V1.

| Data class                                       | Generic V1 treatment                                                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Originating Workspace identity/reference         | Conditional minimum Core reference necessary to identify the sender; no organization/customer directory snapshot.                                                                                         |
| Provider / Provider Workspace reference          | Conditional exact selected recipient binding; Provider Workspace is distinct from originating Workspace. Any display projection still requires current visibility.                                        |
| Need / work-package reference                    | Conditional bounded consumer-owned scope and version; no copied Need workflow or entire customer context.                                                                                                 |
| Provider Selection reference                     | Conditional exact ID/version and resolvable canonical lineage; no selection rationale/customer-file expansion.                                                                                            |
| Applicant / Trademark Owner official information | Conditional only when this exact professional/official purpose genuinely requires each field, the human's authority covers it and minimization permits it. Remains private, never Discovery profile data. |
| Trademark-specific working information           | Conditional only the mark-specific fields needed for this task, with owner/source version and field-level authority; no unrelated assets.                                                                 |
| Matter-specific minimum working information      | Conditional relevant scope/status/facts only; no entire Matter or customer record.                                                                                                                        |
| Professional instruction fields                  | Conditional reviewed minimum preparation content. Including a field does not send an instruction, create appointment or release M13.                                                                      |
| Provider/evidence references                     | Conditional relevant authorized references and provenance; artifact retrieval remains separately gated under section 11. No raw evidence by default.                                                      |
| End-client Relationship Information              | Excluded: client contacts, email, phone, customer acquisition/relationship context and Originating Workplace ↔ end-client relationship. Provider professional work does not confer these rights.          |
| Originating Workplace quotes/pricing             | Excluded, including commercial terms hidden in instructions or notes; not necessary merely because the Provider prepares its own quote.                                                                   |
| Margin / profit                                  | Excluded. No inferred, derived or aggregate disclosure as a substitute for direct fields.                                                                                                                 |
| Private CRM information                          | Excluded, including segmentation, internal commercial notes and relationship history.                                                                                                                     |
| Unrelated communications                         | Excluded, including attached email/message threads.                                                                                                                                                       |
| Unrelated trademark assets                       | Excluded; references and filenames must not leak unrelated marks.                                                                                                                                         |
| Unrelated Matter/customer data                   | Excluded; shared storage or an existing client relationship is not purpose authority.                                                                                                                     |

**Applicant/Owner official information is not End-client Relationship Information, but is still private.** For example, an Applicant legal name may be needed for specifically authorized filing preparation; it remains forbidden in a generic discovery/selection or unrelated quotation projection. Classification follows the field's meaning, source and exact use, not a renamed key. Relabeling client email/phone as “Applicant data” cannot bypass the generic relationship-data exclusion. V1 does not determine jurisdictional filing requirements or create a new legal authority.

## 7. Exact recipient and Direct-to-Executor

The envelope binds the selected Provider, its Core Provider Workspace and the actual Final Execution Provider. These identities must agree with current Selection and canonical responsibility lineage; a display name, email address or arbitrary destination supplied in a payload is insufficient. An independently authenticated recipient/use context must match that binding at disclosure. Possession of an envelope ID is not recipient authentication or a bearer grant.

```text
Allowed boundary: Originating Workplace → MGSN → Final Execution Provider
Denied: selected Provider A → undisclosed Agent B → unknown final executor
```

Consume [#375](https://github.com/yoomarks/markorbit/issues/375): final-executor status, direct responsibility, no-rebrokering commitment/violation state, required distinct legal signer/entity, source/attestation/evidence, exact version, effective period, freshness and suspension/revocation. Current Provider ACTIVE, prior success, payment or self-description does not prove direct execution. Where proof is required, missing/unknown/stale/contradictory/prohibited proof **fails closed**. Whether proof is required comes from authoritative flow/policy, not a caller flag. Known hidden rebrokering is never acceptable.

A legally required distinct signer/entity may be transparently represented with its role, necessity and canonical disclosure reference; it is not automatically hidden rebrokering. Representation grants it **no receipt or onward-transfer rights**. V1 has one exact selected final-Provider recipient per envelope, no wildcard team/sub-agent audience. Any separate recipient or onward disclosure requires its own canonical recipient/purpose/field authority and separately scoped boundary; it cannot be silently added to this envelope. Changing the final Provider requires a current matching human Selection and a newly reviewed Handoff.

## 8. Privacy Preview and affirmative human authorization

Before authorization, an authorized originating human must be able to understand:

- Exact recipient and Provider Workspace, final-executor disclosure and any distinct legal signer/role.
- Exact purpose, Need/work-package and current Selection lineage.
- Requested data classes, exact proposed fields and source versions, why each is necessary, and explicitly excluded fields with privacy-safe reasons.
- The actual bounded values or authorized source view sufficient to understand the disclosure; a class label alone cannot authorize unseen changing content. Preview access has its own source permissions and stays private.
- Expiry/validity, revocation's effect on future access and inability to undo knowledge already lawfully delivered.
- No Provider contact, instruction, Allocation, Acceptance, appointment, M13 release, filing, payment or Official Truth consequence.

An affirmative, authenticated human action and acknowledgement must bind the exact reviewed tuple: recipient, purpose, Selection/scope, field projection and source versions/fingerprint, privacy policy, responsibility disclosure and expiry. Default checkboxes, prior authorization/collaboration/payment, Selection, Eligibility, Provider/Participation ACTIVE, Allocation, Provider Return or AI recommendation cannot substitute. A mismatch or decision-relevant change after preview requires refreshed review and new human confirmation, not transfer of the old acknowledgement.

This is a semantic requirement only: no UI, Storybook, Playwright journey or preview API is implemented. A future UI issue must supply its own accessible states, visual review and acceptance journey under repository UI rules.

## 9. Conceptual envelope, validity and revocation

Names are illustrative, not new shared types. Reuse canonical identity, Selection, source-version, authority and correlation primitives.

| Envelope concept                                                    | Minimum meaning                                                                                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handoffId`, `version`, fingerprint                                 | Immutable identity/version and deterministic binding of the complete authorized tuple. A valid fingerprint proves integrity, not current permission.        |
| `originatingWorkspaceId`, scope                                     | Trusted Core reference, consumer owner and exact Need/work-package reference/version.                                                                       |
| `providerSelectionReference`                                        | Exact #394 Selection ID/version with resolvable #381 candidate/source lineage; no duplicated candidate type.                                                |
| `recipientProviderReference`, `recipientProviderWorkspaceReference` | Exact selected final recipient plus #375 responsibility/signer references where applicable.                                                                 |
| `purpose`, `authorizedDataClasses`, `authorizedFieldProjection`     | Explicit purpose and exact field allowlist, necessity and bounded content/source binding. No whole-record snapshot.                                         |
| `sourceReferences`, `sourceVersions`                                | Source owner, immutable reference/version/fingerprint, field selector and applicable effective/freshness bounds. Never resolve “latest” into an old grant.  |
| `authorityReference`, `authorizedBy`, `authorizedAt`                | Trusted human/Workspace disclosure authority, affirmative preview acknowledgement/reference and service-recorded authorization time.                        |
| `expiresAt`, validity basis                                         | Explicit finite deadline or authoritative bounded rule with determinable end; policy/time basis recorded. Unknown/unbounded validity is denied.             |
| `revokedAt`, `revocationReference`                                  | Append-only withdrawal evidence, actor, reason, exact target and time; reflected in current state without rewriting original authorization.                 |
| `privacyPolicyVersion`, `directExecutorDisclosureReference`         | Exact reviewed policy and relevant responsibility version/evidence; retain current participation/visibility/source validation lineage by bounded reference. |
| `correlationReference`, idempotency, `expectedVersion`              | Scope/action/payload binding, explicit absence on creation, exact current version on revoke; stable concurrency and replay control.                         |

Retain only the authorized projection or protected immutable owner references sufficient to reconstruct exactly what was approved, with integrity/fingerprint evidence. If immutable source content cannot be established, deny instead of copying the whole source or granting access to changing “latest” data. Retained content remains private and subject to future retention policy; envelope or preview retrieval cannot be a data-leak side channel.

Minimal lifecycle semantics (exact shared status names remain deferred):

| From / condition                                                                              | Result                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No envelope; human confirms exact reviewed proposal; current checks and expected absence pass | Record authorization and private audit atomically; do not transmit or enqueue Provider contact.                                                                        |
| Recorded authorization; all current checks pass within bounded validity                       | Eligible only for the exact attempted disclosure; still requires independent action/recipient authority.                                                               |
| Expiry reached, including exactly at `expiresAt`, or validity unknown                         | Deny new disclosure/use. Expiry is a validity result, not an Execution transition; original authorization remains historical.                                          |
| Authorized originating human revokes exact current envelope version                           | Append revocation and deny all future disclosure/use under this envelope. Candidate visibility/suitability or Selection usability need not pass to withdraw authority. |
| Revoked/expired envelope, restored participation or replayed authorize command                | No restoration. New disclosure authority requires a new envelope, fresh review and current checks.                                                                     |
| Recipient, purpose, fields/content/source binding or validity needs changing/extending        | New human-reviewed authorization record; no in-place widening or renewal of an old envelope. Any withdrawal of the old envelope is explicit and attributable.          |

No Selection, envelope or operational status automatically revokes or replaces a different record. Nevertheless loss of current Selection/authority denies reliance on this envelope immediately. A separate new grant never revives a revoked grant. There is no invented one-envelope-per-Selection or multi-Provider workflow.

Revocation stops future disclosure, dereference and use **under this envelope**, including delayed/retried operations; retain immutable historical audit and do not rewrite an already lawful transmission as if it never occurred. It cannot erase knowledge delivered or automatically undo independently authorized downstream actions. Those retain their own owner/authority/state; no Execution cancellation semantics or existing-collaboration exception is created here. Retention is never current permission.

## 10. Revalidation, replay and concurrency

Revalidate at review entry, immediately before authorization commits, and again immediately before each actual consumption/disclosure. Check current originating and recipient identity/authority; Selection status/usability and exact scope; participation; relevant visibility/Trusted relationship; Provider operational state; relevant Supply/source/evidence versions, rights and freshness; required direct-executor proof; privacy policy; exact recipient/purpose/projection; expiry and revocation. The consuming Principal/action must have current authority even if different from the authorizing human; a service cannot infer delegation from the envelope alone.

An unavailable owner, unknown freshness/validity, stale/mismatched reference or conflicting policy denies use. Historical fingerprints, cached positive validation, old acknowledgements and idempotent replay do not override current denial. No silent source/recipient substitution, hidden field expansion or reuse for another Need/purpose is permitted. A decision-relevant changed tuple returns to human review; current validation does not rewrite the historical approval.

Every mutation requires idempotency and exact expected versions. Bind the key/fingerprint to originating Workspace, action, envelope/scope, human/authority and full reviewed payload. Same key with different payload/actor/scope conflicts. An exact committed replay returns only the authorized historical result after current caller access checks; it creates no new grant, expiry extension, revocation reversal or duplicate transmission. Historical result reads must not re-expose now-denied projection values.

Future MGSN persistence must atomically commit authorization/revocation, expected-version control, command result and privacy-safe audit. Concurrent revoke versus mutation cannot lose the revoke; failed validation or transaction failure creates no partial authority. At validation-to-use boundaries, recheck authoritative versions or use a separately specified owner-bound consumption protocol that prevents a stale positive check from authorizing disclosure. A queued operation must revalidate when released; asynchronous cache invalidation alone is insufficient. The future delivery owner must prevent duplicate sends/retries and record actual disclosure separately from authorization. #395 designs neither a distributed transaction nor a new messaging system.

## 11. Evidence references and actual disclosure

```text
permission to see an evidence reference != permission to retrieve its artifact
```

Only authorized references may enter the projection. Artifact dereference requires current source-owner permission for that exact artifact/version, recipient, purpose and action, as well as valid envelope checks where this envelope is its authority. A reference is not a transferable signed access token, permission to enumerate sibling files or permission to copy raw private evidence. If an artifact itself is necessary, its exact content must be separately authorized and reviewed; reference visibility alone cannot supply that authorization.

Actual transfer is a separate governed action. A valid envelope contributes only data-disclosure authority; it does not schedule a message, contact the Provider, send professional instructions or release a protected action. Any future push, pull or download path must enforce applicable action authority and exact recipient identity in addition to the envelope. New transmission, cached re-serving and artifact retrieval after expiry/revocation are denied under the old envelope.

## 12. M4, M12, M13 and false consequences

Service Package, Eligibility, Allocation, Provider Acceptance, Provider Return and M4 Evidence Handoff keep their existing semantics. An Allocation is not Handoff consent; a Handoff creates no Allocation and cannot impersonate Provider Acceptance. Existing M4 history is not backfilled into this new authority model.

M12 retains `providerEngagedByLite = false`, `providerSelectedByLite = false`, `servicePackageSelectedByLite = false` and `protectedActionAuthorized = false`; a later envelope does not rewrite historical candidate consequences.

M13 remains independently authorized: **Controlled Privacy Handoff authorization != M13 protected-action release != Provider Acceptance**. Current `createTrademarkServiceProviderHandoff` preserves `targetOwner = MGSN`, `providerEngagementCreatedByExecution = false` and `providerAcceptanceCreatedByExecution = false`. A future integration may consume exact matching Handoff/Selection, Workspace, Provider, scope, purpose and instruction/evidence references; a valid M13 release must not widen the authorized projection, and a valid envelope must not release M13. No Execution edit occurs here.

Every future Handoff authority-consequence contract must explicitly preserve:

```text
providerEngaged = false
providerAllocated = false
providerAccepted = false
professionalAppointmentCreated = false
externalContactAuthorized = false
protectedActionReleased = false
filingAuthorized = false
filingSubmitted = false
paymentAuthorized = false
paymentCreated = false
officialTruthCreated = false
matterCompleted = false
```

These describe effects created by this authorization, not assertions that no independently authorized downstream record exists. The envelope establishes only that this bounded projection may be disclosed to this recipient for this purpose under this authority during this validity window, subject to current revalidation and separate action authority. It also creates no Service Package, new Selection or Capability verification.

## 13. Private audit and provenance

Record envelope ID/version/fingerprint; originating Workspace and consumer scope; exact Selection and selected Provider lineage; recipient; purpose; requested/authorized data classes and exact field selectors; immutable source references/versions; trusted actor, disclosure-authority basis and preview acknowledgement; authorized time and validity; revocation actor/time/reference; privacy policy and responsibility disclosure reference; validation policy/time/versions; correlation/idempotency and expected/current versions.

Authorization audit is not proof of delivery. Future disclosure audit must separately identify the attempted/actual authorized projection reference/fingerprint, recipient, action-authority reference, time and outcome without copying payloads. Append history; never overwrite the reviewed decision or lawful transmission. Do not put customer files, values of private official fields, raw private evidence, secrets, email/phone, commercial notes or arbitrary payloads in audit metadata, logs, errors or reason strings. Exact projection audit means field selectors and protected references/fingerprint, not duplicated content.

Audit is private with current permission-controlled reads and bounded retention under a future policy. Unauthorized users must not learn hidden Providers, customers, field values or evidence existence through preview exclusions, validation reasons or replay responses. No new retention duration, deletion system or observability subsystem is specified here.

## 14. Negative acceptance cases

These are required future shared fixtures/runtime acceptance cases, **not implemented V1 tests**. Each denial occurs before private disclosure or downstream side effects.

| Case                                                                                                | Required result                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| N01 Selection missing                                                                               | Deny review/authorization/use; no choice inferred.                                                               |
| N02 Selection SUPERSEDED                                                                            | Deny new Handoff and future reliance on its existing envelopes.                                                  |
| N03 Selection REVOKED                                                                               | Deny; restored Provider/participation state cannot revive it.                                                    |
| N04 Selection CURRENT but stale/unverifiable; candidate/source fingerprint mismatch                 | Deny; CURRENT and historical integrity are insufficient.                                                         |
| N05 Wrong Workspace Principal, archived identity or inactive membership                             | Reject before private Selection/preview/envelope reads.                                                          |
| N06 Spoofed payload actor/authorizedBy/Workspace, even for privileged caller                        | Reject mismatch; do not silently accept or impersonate.                                                          |
| N07 Service credential, AI suggestion, default checkbox, Selection/Allocation/history/payment alone | No attributable human Handoff authorization; deny.                                                               |
| N08 Purpose missing/generic/ambiguous or changed to another Need                                    | Deny; no broad “collaboration” permit.                                                                           |
| N09 Requested class/field lacks authorization or necessity                                          | Exclude before review or deny; no sibling/whole-record fallback. Mandatory omissions deny the proposal.          |
| N10 Applicant/Owner field unnecessary for exact purpose                                             | Deny that field; selection or relabeling cannot authorize it.                                                    |
| N11 End-client email/phone/relationship/CRM supplied, including disguised instruction fields        | Exclude/reject from generic V1; never retain in audit.                                                           |
| N12 Originating quotes/pricing/margin/profit or derived commercial data supplied                    | Exclude/reject; quotation preparation is not an exception.                                                       |
| N13 Unrelated communications, marks, assets, Matter/customer data or whole source supplied          | Exclude/reject; references and attachments cannot bypass minimization.                                           |
| N14 Participation no-row/NOT_PARTICIPATING/PAUSED/REVOKED                                           | No new network Handoff/disclosure, including cached positive envelopes.                                          |
| N15 Relevant visibility withdrawn/PRIVATE or required TRUSTED relationship invalid                  | Deny; originating consent cannot override Provider/source authority.                                             |
| N16 Provider SUSPENDED/INACTIVE, relevant Supply stale/outside effective period, owner unavailable  | Deny; no permissive fallback or fabricated Eligibility.                                                          |
| N17 Direct-executor proof required but missing/stale/revoked/prohibited                             | Fail closed; never infer from Provider ACTIVE or caller flag.                                                    |
| N18 Hidden intermediary/sub-agent chain, recipient Workspace mismatch or substituted final Provider | Deny compliant direct-executor Handoff; do not forward.                                                          |
| N19 Legally required distinct signer transparently disclosed                                        | May be represented, not automatically brokered; no automatic receipt/onward-transfer permission.                 |
| N20 Expired, exactly-at-expiry, unknown or unbounded validity                                       | Deny new disclosure/use, including delayed sends.                                                                |
| N21 Revoked envelope or old authorization replay                                                    | No restored authority, renewed expiry or duplicate disclosure.                                                   |
| N22 Evidence reference visible but artifact access denied                                           | No dereference/copy; deny required-artifact operation.                                                           |
| N23 Preview tuple changes before confirmation or source resolves to newer content                   | Fresh review and human confirmation required; no silent substitution.                                            |
| N24 Concurrent revoke/policy contraction versus authorization/use                                   | Reject stale versions or revalidate at consumption; no lost revoke or partial grant.                             |
| N25 Same key reused with another actor/scope/payload                                                | Conflict with no mutation; exact committed replay is historical only.                                            |
| N26 Envelope authorized                                                                             | Provider engagement remains false.                                                                               |
| N27 Envelope authorized                                                                             | Allocation, Provider Acceptance and professional appointment remain false/not created.                           |
| N28 Envelope authorized without separate action permission                                          | No external contact, instruction/send or M13 release; all remain unauthorized.                                   |
| N29 Envelope authorized or Provider Return/payment exists                                           | No filing authorization/submission, payment authorization/creation, Official Truth or completion.                |
| N30 Candidate/Selection no longer usable when human revokes envelope                                | Allow withdrawal with current revocation authority and exact envelope version; no positive candidate gate.       |
| N31 Unauthorized preview/audit/replay read or private data in denial metadata                       | Deny access; do not leak values or hidden object existence.                                                      |
| N32 Separately authorized downstream action already occurred before revoke                          | Stop future envelope use, preserve history; no automatic Execution cancellation or rewriting of lawful delivery. |

## 15. Validation and non-goals

#395 is a one-file documentation change. Verify all boundary questions and N01–N32 against the cited sources, formatting, workspace/persistence boundaries and CI scope-detector tests. Run affected MGSN dependency build plus lint/typecheck/test and exact-head hosted CI, including the selected MGSN PostgreSQL owner tests. Report local database skips as skips, not passes. No UI journey exists to test in this change; later behavior requires its own contract fixtures and runtime/HTTP/PostgreSQL acceptance tests.

No runtime, API, database, migration, shared contract, Gateway, Selection/Discovery implementation, M4 Allocation/Acceptance change, M13 change, Provider Workspace/UI, live Provider action/contact, email/message sending, production credentials, unrestricted egress, filing, payment or Official Truth. No marketplace, second Workspace/Provider identity, Capability Engine or Execution workflow. No edits outside `services/mgsn/**`, no README change, no root CI/config/lockfile changes. This freeze does not start its dependencies or authorize production data transfer. Independent MGSN Lane Owner review and merge remain required.

# Shared Dependency Request

## Goal

Create the minimum canonical Controlled Privacy Handoff envelope/validation contract, then separately scope MGSN-owned persistence and authenticated API wiring. Establish bounded disclosure authority after current human Selection without creating Provider contact or action authority.

## Why

Existing M4 Evidence Handoff and M13 protected Provider instruction serve different purposes and cannot represent field-specific human privacy approval. #395 cannot safely invent local-only cross-lane contracts or edit shared migration/Gateway paths. A canonical projection and current validation prevent consumers from treating Selection, an envelope snapshot or a historical replay as blanket data authority.

## Producer

MGSN owns envelope authorization, revocation, current validation and private audit. Core owns Workspace/user identity and membership. Consumer/source owners retain Need/work-package, Applicant/Owner, Matter, trademark, evidence and data-access truth through bounded contracts; no cross-service database reads, copied API types or duplicate identity system.

## Consumer

Future MGSN Handoff review/consumption and authorized Workplace read surfaces; later Execution M13 integration only for matching references alongside its own protected-action release. The exact final Provider may consume only the approved projection through a separately authorized delivery/access path. An envelope alone grants no Provider Workspace-wide browsing or access to originating records.

## Contract

Proposed names below are conceptual; prefer existing canonical vocabulary/primitives over parallel types. Reuse [#367](https://github.com/yoomarks/markorbit/issues/367) participation/visibility, [#381](https://github.com/yoomarks/markorbit/issues/381) Discovery lineage, [#394](https://github.com/yoomarks/markorbit/issues/394) Selection and [#375](https://github.com/yoomarks/markorbit/issues/375) responsibility disclosure. #394 owns Selection contract only; this request does not broaden it into runtime.

| Concept                                             | Required semantics                                                                                                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ControlledHandoffId` / `ControlledHandoffEnvelope` | Section 9 exact originating scope, Selection/recipient/source lineage, trusted human/authority, immutable reviewed tuple/version/fingerprint, expiry and revocation. Not a bearer capability or content dump.                                            |
| `HandoffPurpose` / `AuthorizedDataProjection`       | Explicit bounded task/context, requested and authorized classes/fields, necessity, source/version binding and exclusions; no speculative product enum or unrestricted payload. Privacy Preview acknowledgement binds this exact projection.              |
| `HandoffAuthorityConsequences`                      | All twelve section 12 consequences explicitly false; only bounded disclosure authority represented.                                                                                                                                                      |
| `HandoffStatus` / validity result                   | Recorded authorization and withdrawal history distinct from current usable/denied evaluation, including expiry, Selection and current authority failures. No extra Execution lifecycle.                                                                  |
| `HandoffMutationCommand`                            | Authorize/revoke with trusted action context, human acknowledgement, expected absence/version, idempotency/correlation, immutable history and conflict semantics. Changes/renewal require new authorization; revoke does not require a usable candidate. |
| `HandoffValidationResult`                           | Exact requester/recipient/purpose/action, envelope/Selection/source/policy versions, checked time, validity and privacy-safe denial/limitation. Bound to attempted consumption, not a reusable current-authority token.                                  |

Authority/preview and audit metadata should use those shared concepts, not separate duplicate snapshot systems. Source-owner contracts must provide current field disclosure rights, immutable source resolution and artifact access separately from reference visibility; missing dependencies deny runtime use. No new business events are requested.

## Requested Paths

- `packages/contracts/**`: minimum composed vocabulary/exports and fixtures covering sections 4–14, exact versions, privacy exclusions and negative consequences.
- `infrastructure/persistence/**`: separately authorized MGSN-owner migration and `migration-owners.json` registration. Preserve immutable grants and appended revocations; atomically persist expected-version/idempotency/audit state. Prove restart durability, revoke races and zero inferred/backfilled grants from Selection, Allocation, Provider ACTIVE, payments or history. Existing M4 records remain intact.
- `apps/gateway/**`: separately scoped authenticated preview/read/authorize/revoke and bounded validation wiring with explicit permission mapping, Core session/Principal resolution, Workspace isolation, applicable origin/CSRF and idempotency checks. Reject spoofed actor/Workspace claims; existing `execution:manage` alone grants no new disclosure power. No public browse/contact/send endpoint is implied.

Later MGSN implementation/tests belong under `services/mgsn/**`. Additional source-owner, consumer UI or Execution changes require their own scope authorization; none is implicitly requested as an edit here. Contract delivery, persistence and API wiring must stay separately bounded. **No Shared Zone path changes in #395.**

## Compatibility

Preserve current Participation/Visibility, candidate-only Discovery, explicit current Human Selection and Direct-to-Executor. Handoff cannot expand Provider visibility or disclose End-client Relationship Information/commercial context. Applicant/Owner fields remain separately purpose-authorized and minimum necessary. Preserve Core ownership, M4 state machines, M12 false consequences and independently protected M13; no automatic engagement, Allocation, Acceptance, appointment, contact, filing, payment, Official Truth or Capability verification. Existing lawful actions retain their own authority; no retroactive migration of their state into Handoff consent.

## Acceptance

Shared fixtures must represent the full envelope, exact preview acknowledgement, purpose/field exclusions, immutable source binding, explicit expiry/revocation, all twelve false consequences and N01–N32. Future unit/HTTP/PostgreSQL integration must prove wrong-Workspace/spoofed-actor denial before reads, explicit human authority, no whole-record leakage, artifact permissions, stale/revoked/expired replay denial, exact recipient matching, transactional failure safety, concurrent revocation, disclosure-time owner revalidation and no duplicate delivery from replay. Include current-policy denial after restart and audit privacy tests. No migration backfill of consent or proven executors. A future UI journey needs its own UI skill/design/states/Storybook/Playwright evidence. Applicable affected-scope and fresh exact-head hosted CI must pass before delivery.

## Risk

Primary risks: blanket consent from Selection; confusing disclosure authority with contact/M13 release; Applicant labels leaking customer relationships; historical envelope/replay surviving withdrawal; reference access granting artifact access; hidden rebrokering or signer disclosure expanding recipients. Also prevent source/check-to-use races, mutable-source substitution and private payloads in audit. Mitigate with canonical owner references, field minimization, trusted affirmative review, explicit bounded validity, exact versions, atomic MGSN mutations and fail-closed consumption checks. Unknown ownership or rights is a denial, not a permissive fallback.

## Blocked MGSN work

Canonical Handoff contract, #367/#381/#394/#375 current-authority contracts, immutable source/field-rights dependencies and separately authorized persistence/Gateway work block durable Handoff runtime and cross-lane consumption. Delivery/contact/M13 integration additionally needs independent action authority and owner-scoped implementation. These dependencies do **not** block this documentation freeze. Return this request to the repository controller after the boundary PR; do not implement dependencies or merge the PR on the Lane Owner's behalf.
