# Network Participation & Visibility V1

## 1. Status and scope

**MGSN-P0-001 / [#359](https://github.com/yoomarks/markorbit/issues/359), parent [#358](https://github.com/yoomarks/markorbit/issues/358).** Architecture, privacy and contract-boundary freeze for review. Audited against fetched `origin/main` at `574d142f1965fcc31bf77f64b065ad5d22d76c79` on 2026-08-31, in the dedicated `mgsn-a` worktree/branch.

The smallest new boundary is explicit participation authorization and a versioned, Private First visibility policy referencing an existing Core Workspace and MGSN Provider. It answers whether a node and selected fields may be exposed for a specified discovery purpose. It does not implement discovery or provider execution.

Labels throughout this document distinguish:

- **Implemented:** observed current code and tests, not a claim that V1 already runs.
- **V1 Boundary:** semantics frozen here for future implementation.
- **Future / Shared Dependency:** contracts, persistence and authenticated wiring requiring Integration authorization.
- **Not Implemented:** participation records, visibility enforcement, public discovery, new APIs and UI in this issue.

Governance: [AGENTS.md](../../../AGENTS.md), the supplied task locks and current #358/#359. Shared contract consumed/read: [provider-execution.ts](../../../packages/contracts/src/provider-execution.ts). Contracts changed: **NONE**. Events emitted/consumed by #359: **NONE**. Only this document and a minimal [README](../README.md) pointer change; no runtime, UI or migration.

## 2. Canon / authority locks

**V1 Boundary:** Private First; Trust Before Exposure; Evidence Before Ranking; Human Choice Before Routing Action; Relationship Ownership Remains with Organizations.

```text
Capability Need != Provider Appointment
Provider Candidate != Provider Selection
Provider Selection != Allocation
Eligibility != Allocation
Allocation != Provider Acceptance
Provider Acceptance != legal/professional appointment
Provider Return != Official Truth
Evidence Handoff != Filing Submission
Payment != Performance / Authority / Acceptance / Completion
Provider Supply Capability != user Capability verification
```

AI may explain evidence and recommend candidates but must not automatically select, allocate, appoint, accept, certify Provider Return, create Official Truth, file or pay. Participation, visibility, successful work and payment confer none of these authorities. A Reflection Candidate is not canonical truth; completion does not verify a Capability or mutate the Canon.

## 3. Current implemented substrate

**Implemented:** Provider Registry → Supply Capability → Service Package → Eligibility → Allocation → Provider Acceptance → Provider Return → Execution evidence handoff. The missing layer is consent to network participation and field/purpose/audience visibility; it is not missing provider identity or a replacement M4 workflow.

| Current source                                                                                                                                                   | Observed behavior and boundary                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [provider-registry.ts](../src/provider-registry.ts): `createProvider`, `assertActiveCoreWorkspace`, `setProviderOperationalStatus`                               | Uses a Core Workspace UUID, checks the returned reference and ACTIVE identity on creation/reactivation, creates the Provider operationally ACTIVE; INACTIVE is terminal in this M4 implementation. No participation consent is recorded.                                                                                                                                                      |
| [provider-registry-postgres.ts](../src/provider-registry-postgres.ts): `createProvider`, `updateProvider`, `reviseSupplyCapability`                              | MGSN-owned provider/supply records, command replay, exact versions and transactional audit. One Provider per referenced Workspace; immutable historical supply versions. These are reusable conventions, not a participation store.                                                                                                                                                           |
| [commercial-admin-read.ts](../src/commercial-admin-read.ts), [commercial-admin-http.ts](../src/commercial-admin-http.ts)                                         | `listProviders` / `inspectProvider` require INTERNAL_OPERATOR plus `commercial-admin:read`; HTTP also requires trusted internal authentication. Inspection includes current supply. Internal operator access is not Network Visibility.                                                                                                                                                       |
| [service-package-eligibility.ts](../src/service-package-eligibility.ts): `admitServicePackage`, `evaluateProviderEligibility`, `listCandidateSupplyCapabilities` | Exact Execution-source admission and deterministic eligibility checks. Private candidate list filters operational/supply status, jurisdiction and service type, returning supply records; it does not evaluate participation or visibility. Eligibility explanations can include raw availability and evidence references.                                                                    |
| [allocation-provider-acceptance.ts](../src/allocation-provider-acceptance.ts): `allocateProvider`, `respondToAllocation`                                         | Explicit Allocation uses current exact eligible lineage and actor/rationale. Provider response derives identity from authenticated Provider Workspace context. Allocation is not Acceptance; a DECLINED response supersedes the Allocation and preserves history.                                                                                                                             |
| [provider-return.ts](../src/provider-return.ts): `createProviderReturn`, `handoffProviderReturnEvidence`                                                         | Exact accepted lineage, authenticated Provider identity, versioned corrections and exact evidence handoff. Artifacts and assertions remain Provider claims, not Official Truth.                                                                                                                                                                                                               |
| [runtime-dependencies.ts](../src/runtime-dependencies.ts), [durable-runtime.ts](../src/durable-runtime.ts)                                                       | MGSN repositories use its owner database. Core identity, Execution-source verification and evidence handoff use bounded HTTP dependencies; dependency failures do not authorize fallback truth.                                                                                                                                                                                               |
| [http.ts](../src/http.ts), read-only [Gateway MGSN wiring](../../../apps/gateway/src/mgsn-http.ts)                                                               | Internal secret plus Workspace Principal and `execution:read/manage`; Gateway resolves Core sessions/membership and checks origin/CSRF for mutations. Service Package/customer records and Provider Allocation/Return reads enforce their respective Workspace contexts. Generic registry/supply routes are operational reads, not owner-only V1 management or visibility-filtered discovery. |

**Implemented test evidence, inspected rather than newly added:**

| Test source                                                                                                 | Assertions relevant to this freeze                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [provider-registry-postgres.test.ts](../tests/provider-registry-postgres.test.ts)                           | One Provider per active Core Workspace; missing/archived identity rejection; durable replay, suspension, stale version rejection; normalized supply without user Capability verification; append-only audit.     |
| [commercial-admin-read.test.ts](../tests/commercial-admin-read.test.ts)                                     | Permission denied before registry read; trusted internal authentication and operator authority; bounded owner-source inspection.                                                                                 |
| [http-boundary.test.ts](../tests/http-boundary.test.ts)                                                     | Missing internal authorization, read-only mutations, cross-Workspace targeting and missing idempotency rejected; Provider Acceptance identity comes from Principal; another Provider cannot read the Allocation. |
| [service-package-eligibility-postgres.test.ts](../tests/service-package-eligibility-postgres.test.ts)       | Exact source/fingerprint checks, no automatic Allocation, suspended/zero-availability ineligibility, private candidate lists with no rank or score.                                                              |
| [allocation-provider-acceptance-postgres.test.ts](../tests/allocation-provider-acceptance-postgres.test.ts) | Explicit Allocation versus authenticated Acceptance, spoofing rejection, concurrent Allocation exclusion, stale source rejection and preserved declined history.                                                 |
| [provider-return-postgres.test.ts](../tests/provider-return-postgres.test.ts)                               | Evidence-only returns, no payment/filing/official application consequence, explicit correction lineage, spoofing and stale handoff rejection.                                                                    |

These tests establish M4 behavior; none proves V1 consent enforcement. PostgreSQL suites require their configured test database and must not be reported as executed merely because their source was inspected.

## 4. Current substrate reuse classification

Each row has exactly one classification. **REUSE** preserves existing identity or provenance conventions without making them consent. **EXTEND_LATER** means a separately authorized projection/metadata extension is required, not an edit to the current field in #359. **NOT_NETWORK_PARTICIPATION** means an independent operational mechanism or gate that must not be interpreted as consent.

| Current field/capability                     | Classification            | Reason / future constraint                                                                                           |
| -------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `providerWorkspaceId`                        | REUSE                     | Bounded reference to Core identity, never a new Workplace object.                                                    |
| `CoreWorkspaceIdentityReference.workspaceId` | REUSE                     | Existing identity-source reference; verify exact match.                                                              |
| Core Workspace `ACTIVE` / `ARCHIVED`         | NOT_NETWORK_PARTICIPATION | Identity/authority gate, not opt-in.                                                                                 |
| `providerId`                                 | REUSE                     | Existing MGSN provider operational identifier; no duplicate Provider registry.                                       |
| `displayName`                                | EXTEND_LATER              | Private source label; selected display projection requires authority, not a new identity.                            |
| `operationalStatus`                          | NOT_NETWORK_PARTICIPATION | ACTIVE/SUSPENDED/INACTIVE operational axis only.                                                                     |
| `createdBy`, `updatedBy`                     | REUSE                     | Actor-attribution convention; does not prove participation authority.                                                |
| `createdAt`, `updatedAt`                     | REUSE                     | Timestamp convention; not consent freshness.                                                                         |
| `version`                                    | REUSE                     | Exact optimistic-version convention; participation/policy versions remain separate from Provider version.            |
| Supply `jurisdictions`                       | EXTEND_LATER              | Selected authorized discovery projection; private by default.                                                        |
| Supply `serviceTypes`                        | EXTEND_LATER              | Selected authorized supply profile; not user Capability verification.                                                |
| Supply `effectivePeriod`                     | REUSE                     | Source applicability/freshness evidence; not visibility authorization.                                               |
| Supply `capacityUnits`                       | NOT_NETWORK_PARTICIPATION | Exact private operational capacity; no automatic exposure.                                                           |
| Supply `availabilityUnits`                   | EXTEND_LATER              | Remains private; a future bounded/derived signal needs its own contract and authorization. No formula designed here. |
| Supply `evidenceReferences`                  | EXTEND_LATER              | Only selected authorized references/derived claims, with provenance and access checks; no raw evidence publication.  |
| Supply `verificationState`                   | NOT_NETWORK_PARTICIPATION | UNVERIFIED/EVIDENCE_RECORDED/VERIFIED_FOR_SUPPLY does not authorize disclosure or qualify a user.                    |
| Supply `status`                              | NOT_NETWORK_PARTICIPATION | ACTIVE/SUSPENDED/RETIRED is a supply-operability axis, not visibility.                                               |
| Supply `sourceFingerprintSha256`             | REUSE                     | Exact source integrity/lineage, not consent or proof of truth.                                                       |
| Commercial admin `listProviders`             | NOT_NETWORK_PARTICIPATION | Internal operational list, not participant discovery.                                                                |
| Commercial admin `inspectProvider`           | NOT_NETWORK_PARTICIPATION | Authorized internal inspection, not publication authority.                                                           |
| `commercial-admin:read`                      | NOT_NETWORK_PARTICIPATION | Operator access cannot opt a Workplace in or expand its exposure.                                                    |
| Service Package                              | NOT_NETWORK_PARTICIPATION | Governed Execution-source admission; unchanged.                                                                      |
| Eligibility                                  | NOT_NETWORK_PARTICIPATION | Operational suitability, not visibility or Allocation.                                                               |
| Allocation                                   | NOT_NETWORK_PARTICIPATION | Explicit MGSN assignment; neither discovery selection nor Acceptance.                                                |
| Provider Acceptance                          | NOT_NETWORK_PARTICIPATION | Authenticated response, not opt-in or legal appointment.                                                             |
| Provider Return                              | NOT_NETWORK_PARTICIPATION | Evidence/claims, not consent or Official Truth.                                                                      |
| Evidence Handoff                             | NOT_NETWORK_PARTICIPATION | Exact reviewable evidence transfer, not filing or network exposure.                                                  |

## 5. Identity and ownership rule

**V1 Boundary:** MGSN does not own or create a second Workplace / Organization identity system. Core remains Workspace/organization identity authority. A participating network node is the existing Core Workspace referenced by `providerWorkspaceId`, linked to the existing `providerId`. A future participation identifier identifies an authorization record, not a second organization or Provider identity.

In future participation commands, `workspaceId` means the participating Provider's Core Workspace; it must equal the bound Provider's `providerWorkspaceId`. This must not be confused with M4 Service Package/Allocation `workspaceId`, which identifies the originating/customer Workspace. Requester identity is separate from the node being considered. No cross-service SQL or copied identity records are permitted.

Provider existence, ACTIVE operational state or active Core identity never implies enrollment. Missing, archived or unresolvable authoritative identity/authority must deny new exposure without deleting M4 history or silently changing any of the state axes below.

## 6. Participation lifecycle

**V1 Boundary / Not Implemented:**

| State               | Meaning and exposure                                                                                                                                                                             | Authorized transition                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOT_PARTICIPATING` | Default, including no participation row. No discovery, Trusted or bounded Public exposure. Provider/Supply may exist operationally.                                                              | Explicit authorized opt-in → ACTIVE, initially PRIVATE unless a separate explicit visibility authorization is recorded.                               |
| `ACTIVE`            | Workplace authorized participation subject to its current policy; may remain entirely PRIVATE. No selection, Allocation, Acceptance, appointment, legal engagement, filing or payment authority. | Explicit pause → PAUSED; explicit revoke → REVOKED. Visibility mutation alone does not change participation state.                                    |
| `PAUSED`            | Temporary fail-closed state: stop discovery, new Trusted and all bounded Public exposure immediately. Retain underlying Provider/Supply and M4 history.                                          | Explicit authorized resume → ACTIVE after revalidating current authority/policy; revoke → REVOKED. Never resume from operational status alone.        |
| `REVOKED`           | Old participation authority withdrawn. No new network exposure or future effect from that authorization. Retain history only for restricted audit/provenance and existing lawful obligations.    | New explicit opt-in with a new authorization reference → ACTIVE. Old authorization stays revoked; no resume or silent reuse of old visibility grants. |

All unspecified transitions are denied. Rejoining reuses the same Core Workspace and Provider references, begins PRIVATE, and requires fresh authority for any exposure. Authorized visibility updates while paused cannot restore exposure; resume must validate what remains authorized. No state change deletes or rewrites an existing M4 operational commitment.

During pause, Trusted access stops except for a separately authorized, already-existing collaboration that requires retained access. On revocation, any retained access must derive solely from a separately valid existing obligation/authorization, with minimum data and purpose; revoked network consent cannot be its basis. Neither exception permits new discovery or generic partner access.

Three axes remain orthogonal:

| Axis                                        | Values                                             |
| ------------------------------------------- | -------------------------------------------------- |
| Provider operational state (Implemented M4) | `ACTIVE`, `SUSPENDED`, `INACTIVE`                  |
| Network participation state (V1 Boundary)   | `NOT_PARTICIPATING`, `ACTIVE`, `PAUSED`, `REVOKED` |
| Visibility scope (V1 Boundary)              | `PRIVATE`, `TRUSTED`, `BOUNDED_PUBLIC`             |

`operationalStatus = ACTIVE` + `participation = NOT_PARTICIPATING` is valid and **not discoverable**. `participation = ACTIVE` + entirely `PRIVATE` visibility is valid. Operational gates can independently disqualify a candidate; they can never enroll, resume or expand visibility.

## 7. Visibility model

**V1 Boundary:** PRIVATE is the default for every data class; omitted or unknown classes are denied. Visibility is an allowlist of selected fields/classes for a specified audience and purpose, not permission to serialize a whole Provider, supply record or evidence object.

| Scope            | Required semantics                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRIVATE`        | Owning organization and explicitly authorized operational/internal surfaces only. No network discovery consequence. Internal authorization remains independently required.                                                                                                                                                                        |
| `TRUSTED`        | Selected fields for explicitly authorized trusted relationships/collaboration contexts with current relationship authority evidence. Not every participant, all previous partners, a public directory or automatic eligibility. Missing relationship evidence denies access.                                                                      |
| `BOUNDED_PUBLIC` | Selected eligible data classes for approved network-discovery purposes outside a pre-existing trusted relationship. Requires explicit Workplace and data-class authorization, minimization, revocation and provenance. Not unrestricted publication, unrestricted evidence retrieval or a routing action. No End-client Relationship Information. |

Exposure requires ACTIVE participation **and** current explicit policy authority **and** an allowed data class/field **and** the authorized requester/context/purpose. TRUSTED additionally requires current relationship authority. Missing, stale, contradictory or ambiguous consent means **DENY EXPOSURE**, not permission to choose a more permissive interpretation.

`PRIVATE → TRUSTED`, `PRIVATE → BOUNDED_PUBLIC` and `TRUSTED → BOUNDED_PUBLIC` are exposure expansions requiring new explicit authority. Adding fields, recipients, purposes or extending authorization validity also requires new authority even when the scope label is unchanged. A trusted relationship by itself is insufficient. Provider ACTIVE, Supply, Eligibility, successful history, Acceptance, Payment, commercial-admin access and AI recommendations never authorize expansion.

Contraction is fail-closed: `BOUNDED_PUBLIC → PRIVATE`, `TRUSTED → PRIVATE`, pause and revoke stop future discovery exposure immediately. Narrowing BOUNDED_PUBLIC to TRUSTED removes the broader audience; retained Trusted access still needs its own authority basis. All removed grants stop applying.

**Future / Shared Dependency:** every subsequent exposure must respect the latest authoritative participation/policy version. Cached results, read models, search results, explanations and dereferenced evidence must not serve withdrawn fields. If current authority/version cannot be established, deny rather than serve a stale positive result; asynchronous invalidation alone is insufficient. Historical snapshots and idempotent replay are not current exposure permits. Revocation cannot undo knowledge already lawfully delivered, but forbids further access/republication under the withdrawn grant.

## 8. Data-classification matrix

**V1 Boundary:** every row defaults to PRIVATE. “Yes, selected” below means only after ACTIVE participation, explicit field/class authorization, purpose/audience checks and source provenance; it does not claim implemented access. Handoff permission is always separate from discovery consent. “Procedure only” is not a TRUSTED profile grant.

| Data class                                | Data owner / authority                                                                                           | Current source                                                                                                          | Default | May be TRUSTED?                                     | May be BOUNDED_PUBLIC?                          | Required consent / authority                                                                                                   | Discovery use allowed?                                                    | Handoff use allowed?                                                  | Important restrictions                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Core Workspace / organization identity    | Core identity truth; owning organization controls disclosure                                                     | Core identity reference via `HttpCoreWorkspaceIdentitySource`; current adapter exposes ID/status only                   | PRIVATE | Yes, selected                                       | Yes, selected display identity                  | Owning Workplace participation + selected identity visibility authorization; authoritative identity source                     | Authorized projection only                                                | Minimum identity under separate purpose authority                     | Do not clone Core identity or assume its internal UUID/status must be displayed.                                                  |
| MGSN Provider identity/reference          | MGSN operational truth; owning Workplace exposure authority                                                      | `ProviderReference`: `providerId`, `providerWorkspaceId`, `displayName`                                                 | PRIVATE | Yes, selected                                       | Yes, selected                                   | Explicit Provider-reference/display-field authorization                                                                        | Authorized reference only                                                 | Existing bounded Provider reference, with separate handoff authority  | Identifier presence is not consent; no duplicate Provider object.                                                                 |
| Capability / supply profile               | MGSN private supply truth; owning Workplace disclosure authority                                                 | Versioned `ProviderSupplyCapabilityRecord`, including `serviceTypes`                                                    | PRIVATE | Yes, selected                                       | Yes, selected                                   | Explicit profile-field grant and exact source provenance                                                                       | Authorized supply claims only                                             | Relevant supply subset under separate authority                       | Supply is not user Capability verification, professional qualification or appointment.                                            |
| Service jurisdictions                     | MGSN supply source; owning Workplace disclosure authority                                                        | Supply `jurisdictions`                                                                                                  | PRIVATE | Yes, selected                                       | Yes, selected                                   | Explicit jurisdiction-field authorization                                                                                      | Authorized jurisdictions only                                             | Procedure-relevant jurisdiction under separate authority              | Coverage is not eligibility, acceptance or legal authority.                                                                       |
| Availability                              | MGSN exact operating truth; owning Workplace disclosure authority                                                | `capacityUnits`, `availabilityUnits`, `effectivePeriod`                                                                 | PRIVATE | Later bounded signal only                           | Later bounded signal only                       | Explicit bounded-signal grant plus fresh source; signal contract deferred                                                      | Future authorized derived signal only                                     | Exact values only when separately necessary/authorized for operations | No automatic raw capacity disclosure; no signal formula/schema in #359.                                                           |
| Provider evidence                         | Source/evidence rights holders; MGSN supply provenance; Workplace disclosure authority                           | Supply `evidenceReferences`, `verificationState`, version/fingerprint                                                   | PRIVATE | Selected references/derived claims                  | Selected references/derived claims              | Workplace grant plus applicable evidence rights and retrieval authorization                                                    | Selected privacy-safe references/claims with provenance                   | Required evidence under separate purpose and access checks            | Raw evidence private; existence or VERIFIED_FOR_SUPPLY is not publication permission.                                             |
| Partner relationships                     | Organizations retain relationship ownership and applicable disclosure authority                                  | Existing organization collaboration context; no relationship-visibility authority in audited M4 registry                | PRIVATE | Later, specifically authorized relationship context | No generic relationship graph publication in V1 | Explicit authority for the relationship and affected parties/data                                                              | No generic graph; only authorized bilateral context for Trusted filtering | Minimum context separately authorized by relationship owners          | Previous collaboration does not automatically establish TRUSTED or authorize onward disclosure.                                   |
| Outcome / trust evidence                  | Evidence/source owners; organizations control disclosure; MGSN owns its operational history                      | M4 returns/evidence handoffs and owner-validated outcomes; no complete Trust Network in audited substrate               | PRIVATE | Yes, selected claims later                          | Yes, selected claims later                      | Evidence-backed, attributable, fresh/versioned, explainable and privacy-authorized claims                                      | Authorized evidence explanation only                                      | Separate authorized evidence handoff/review                           | No universal score; a simple operational `trustFlag`, if present elsewhere, is not a Trust Network. Provider claims stay claims.  |
| Applicant / Trademark Owner official data | Applicant/Owner authority; originating organization controls handling; existing professional/official owner path | Existing MarkReg preparation/Matter lineage and bounded Execution document/instruction references, not registry profile | PRIVATE | No profile grant; procedure only                    | No                                              | Separate specific professional/official-purpose authority and demonstrated necessity                                           | No                                                                        | Only minimum data required for that authorized procedure              | Applicant legal name required for filing does not publish a client relationship or authorize filing itself.                       |
| End-client Relationship Information       | Originating Workplace/organization retains customer relationship and permissions                                 | Originating customer, quote and private matter context; no network-profile source authorized                            | PRIVATE | No generic participation/visibility grant           | No                                              | Generic consent never suffices; any exceptional necessary handling requires separate specific authority, outside this boundary | No; also not Provider Selection data                                      | No generic handoff; unrelated data excluded, no bypass                | Contacts, relationship identity, originating quote, margin/profit, unrelated communications/assets/customer context stay private. |

## 9. Privacy and customer-relationship protection

**V1 Boundary:** End-client Relationship Information is **PRIVATE BY DEFAULT / NOT DISCOVERY DATA / NOT PUBLIC PROFILE DATA / NOT PROVIDER SELECTION DATA**. This includes end-client contacts, originating client-relationship identity beyond official necessity, originating quote, margin/profit, unrelated internal communications, unrelated trademark assets and unrelated matter/customer context.

Applicant / Trademark Owner official information is a separate class. A later authorized professional procedure may need a legal name or other specific official fields; necessity and authority must be established for that handoff. Participation never makes those fields discoverable. Mixed documents, references, explanations and derived claims must be minimized so official-purpose data cannot carry private relationship material along with it. No generic participation or visibility authorization exposes customer relationships. A Provider must not use MGSN to bypass the Originating Workplace.

Direct-to-Executor / No Rebrokering is a required future discovery/handoff compatibility rule:

```text
Allowed: Originating Workplace → MGSN → Final Execution Provider
Denied:  Originating Workplace → Middle Agent → Sub-agent → Final Provider
```

Future contracts must disclose final executor status, direct responsibility and any legally required distinct signing entity without exposing unnecessary client relationships. A distinct required signing entity is not permission for an undisclosed rebrokering chain. These disclosures and enforcement are deferred shared/controlled-handoff work, not fields or behavior added by #359.

## 10. Audit / provenance requirements

**V1 Boundary / Future implementation:** every participation/visibility mutation must establish `workspaceId`, `providerId`/participation reference, actor/Principal, actor authority basis, previous/new participation state, previous/new visibility policy and versions, affected data classes, consent/authorization reference, reason, correlation/reference ID, `occurredAt`, source version and expected version.

Persist accepted state/policy, idempotency outcome and privacy-safe audit atomically, following existing MGSN transaction/version conventions. Denied authorization must not mutate state. Record references and minimal change metadata rather than raw customer context, secrets or evidence content. Restrict audit access; audit history is not a discovery feed. Revocation, contraction and rejoin authorization lineage must remain provable; retention cannot reactivate exposure. A fingerprint proves integrity of a referenced version, not the actor's authority or the truth of a Provider claim.

## 11. Allowed exposure examples

**V1 Boundary, conditional on later implementation:**

1. An ACTIVE participant explicitly authorizes organization display identity, service type, `jurisdiction = US`, a future bounded availability signal and one selected evidence reference for BOUNDED_PUBLIC discovery. A consumer receives only those fields, once the deferred signal contract and current authorization checks exist; raw capacity and remaining evidence remain private.
2. An ACTIVE participant authorizes a selected supply profile for one evidenced bilateral TRUSTED relationship. That partner sees only the authorized subset; other network participants and previous partners receive nothing from this grant.
3. An Applicant legal name is transmitted later because it is necessary for a specific separately authorized professional handoff. Network profile visibility remains unchanged; unrelated client contact, quote and margin do not accompany it.

## 12. Denied / negative cases

**V1 Boundary acceptance cases for future implementation, not new runtime tests in #359:**

| Case                                                                                        | Required result                                                                                                                                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Provider exists and `operationalStatus = ACTIVE`, no participation row                   | **DENY DISCOVERY**; no-row = NOT_PARTICIPATING. No migration auto-enrollment.                                                                           |
| 2. Participation PAUSED                                                                     | **DENY DISCOVERY / DENY NEW TRUSTED EXPOSURE / DENY PUBLIC EXPOSURE** immediately; only separately authorized existing collaboration access may remain. |
| 3. Participation REVOKED                                                                    | **DENY ALL NEW NETWORK EXPOSURE**; historical M4 records remain. Old consent/replay cannot rejoin; new opt-in required.                                 |
| 4. Consent missing, stale, contradictory or ambiguous; unknown policy/class                 | **PRIVATE / DENY EXPOSURE**. Do not infer consent from a permissive cached snapshot.                                                                    |
| 5. Supply ACTIVE and eligible                                                               | Operational usability does not authorize discovery; participation and visibility authority still required.                                              |
| 6. AI identifies a strong candidate                                                         | **NO SELECTION / NO ALLOCATION / NO APPOINTMENT**, nor automatic Acceptance, certification, filing or payment.                                          |
| 7. Commercial-admin operator can inspect Provider                                           | Internal operator access only; no Network Visibility or authority to opt the Workplace in.                                                              |
| 8. Applicant/Owner data needed for later filing                                             | Deny discovery/profile exposure; allow only minimum separately authorized professional-purpose handoff.                                                 |
| 9. End-client contact or Originating Workplace margin exists                                | **DENY DISCOVERY / DENY GENERIC PROVIDER EXPOSURE**, including candidate explanations and references.                                                   |
| 10. BOUNDED_PUBLIC/TRUSTED contracts to PRIVATE                                             | Stop future discovery immediately; cached/read-model results must respect latest authoritative version or deny.                                         |
| 11. Raw `availabilityUnits`/`capacityUnits` already exists                                  | Deny automatic discovery disclosure; a future bounded signal is separate contract work.                                                                 |
| 12. Supply `verificationState = VERIFIED_FOR_SUPPLY`                                        | Deny publication of all evidence; only specifically authorized references/claims may be exposed.                                                        |
| 13. Previous collaboration or trusted relationship without a field/purpose grant            | Deny inferred TRUSTED exposure; explicit current relationship and visibility authority required.                                                        |
| 14. Visibility used as a rank/score or to create Allocation                                 | Deny ranking/selection/assignment consequence. Candidate remains candidate.                                                                             |
| 15. ACTIVE participation with PRIVATE policy                                                | Deny discovery; participation is valid without exposure.                                                                                                |
| 16. Core identity archived/missing, authority unavailable, wrong Workspace or spoofed actor | Deny new exposure/mutation as applicable; never fall back to ACTIVE or accept payload identity as authority.                                            |
| 17. Stale policy update, conflicting idempotency payload, replay of pre-revocation opt-in   | Reject conflict/stale mutation; any historical replay result grants no current exposure and cannot undo revocation.                                     |
| 18. Hidden intermediary/sub-agent or request to bypass Originating Workplace                | Deny that future discovery/handoff path; require final executor/direct responsibility disclosure and separate controlled handoff.                       |

## 13. Provider Discovery consumption boundary

**Future / Shared Dependency:** consume MGSN-owned participation/visibility truth only to answer:

- Is this Provider/network node allowed to be considered in this requester/context?
- Which authorized fields may be exposed for this discovery purpose?
- What authoritative evidence may be explained, with source/provenance and limits?

Visibility must not answer who should win, be selected, allocated or appointed. It supplies no rank, provider score, preference or selection authority. Evidence Before Ranking is a constraint, not a request to implement ranking.

Existing private M4 candidate lists, registry reads, supply snapshots and Eligibility explanations are not ready-made network projections. Future discovery must not forward them wholesale or expose denied fields in reasons, counts or evidence links. MGSN must enforce current policy before an authorized projection reaches a consumer; the consumer must not infer consent from `operational`/`current` or a previously received candidate. No public endpoint or discovery algorithm is proposed for the immediate implementation dependency.

## 14. M12 / M13 / M4 compatibility

**Implemented M12:** [trademark-service-candidate-matching.ts](../../lite/src/trademark-service-candidate-matching.ts) filters supplied owner snapshots and preserves the following in both unreviewed-intent and successful matching returns:

```text
providerEngagedByLite = false
providerSelectedByLite = false
servicePackageSelectedByLite = false
protectedActionAuthorized = false
```

Provider candidates also retain `engaged = false`, `selectedForExecution = false`; Service Package candidates retain `selected = false`. The existing matcher has no participation policy input and does not prove visibility authorization. Future integration supplies only currently authorized MGSN projections and keeps these candidate-only consequences. #359 changes neither M12 nor its contracts.

**Implemented M13:** [trademark-service-execution.ts](../../execution/src/trademark-service-execution.ts), `createTrademarkServiceProviderHandoff`, requires a provider-instruction release with an MGSN-owned plan step and preserves:

```text
targetOwner = MGSN
providerEngagementCreatedByExecution = false
providerAcceptanceCreatedByExecution = false
```

**V1 Boundary:** participation does not authorize Provider Engagement, Provider Acceptance, external contact, filing or payment. Future M13/MGSN integration retains the existing protected-action/human authorization and owner validation paths; visibility is not a release. #359 changes neither M13 nor its contracts.

**M4 lock:** no change here or implied future redefinition to Service Package, Eligibility, Allocation, Provider Acceptance, Provider Return or Evidence Handoff. Participation/visibility sit before/around discovery exposure. They neither replace M4 nor redefine Allocation as Provider Selection. Pause/revoke removes network exposure; existing operational commitments/history retain their independently governed M4 semantics.

## 15. Live / security gates

**V1 Boundary:** this freeze authorizes no live Provider contact, production exposure, customer-data transfer, filing or payment. Future implementation must first prove authenticated Workspace isolation, explicit participation/field authority, current-version fail-closed reads, revocation and privacy-safe provenance through fixtures and applicable HTTP/PostgreSQL tests. M4 operational access must not become a bypass for new discovery.

Shared contracts, migrations/ownership registration and Gateway wiring require separately authorized Integration work. Unsupported Trusted authority sources, derived signals or evidence rights remain denied until their bounded contracts exist. Any later protected external action or production/live enablement requires its own explicit review and approval. No events or new event infrastructure are designed here.

# Shared Dependency Request

## A. Dependency title

MGSN Network Participation & Visibility V1 shared implementation boundary.

## B. Why needed

#359 freezes semantics locally; runtime needs shared contracts, MGSN-owned persistence migrations and authenticated management API wiring outside `services/mgsn/**`. This request is for controller review, not authorization to start the next issue.

## C. Current MGSN blocker

The current Registry stores operational ACTIVE status and private supply, not participation consent or visibility grants. Existing operator/operational reads are not owner-scoped participation management or filtered discovery. MGSN alone cannot add canonical consumer contracts, register migrations/ownership or wire Gateway session/CSRF/permission checks. Core remains identity authority through its existing bounded API; no cross-service SQL or duplicate identity is acceptable.

## D. Proposed shared contract surface

Minimum proposed vocabulary, not TypeScript added by #359:

| Concept                        | Required semantics                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NetworkParticipationId`       | Participation authorization-record identifier, not a new network-node/organization/Provider identity.                                                                                                                                                                                                             |
| `NetworkParticipationState`    | NOT_PARTICIPATING / ACTIVE / PAUSED / REVOKED.                                                                                                                                                                                                                                                                    |
| `VisibilityScope`              | PRIVATE / TRUSTED / BOUNDED_PUBLIC; PRIVATE on missing grants.                                                                                                                                                                                                                                                    |
| `NetworkParticipationSnapshot` | Schema version, participation reference, separate Core `workspaceId` and existing MGSN `providerId`, state, authorization reference, policy and exact current versions. `workspaceId` must match Provider `providerWorkspaceId`. No-row reads normalize to NOT_PARTICIPATING/PRIVATE without inventing an opt-in. |
| `VisibilityPolicy`             | Versioned allowlist of selected data classes/fields, scope, requester/audience or relationship context, approved discovery purpose and authority references; omit/unknown = deny. Apply section 8 exclusions.                                                                                                     |
| Participation mutation command | Explicit opt-in, pause, resume or revoke; target references, expected version, idempotency key, reason, correlation and authorization reference. Rejoin requires new authority, not resume. Actor/Workspace authority comes from trusted Principal context.                                                       |
| Visibility mutation command    | Exact participation/policy versions, explicit replacement grants, idempotency/correlation/reason and new authority for expansions. No lifecycle activation side effect.                                                                                                                                           |
| Audit/provenance metadata      | Actor and authority basis, previous/new state and policy/version, affected classes, consent reference, reason, occurrence time, correlation and source/expected version. Reuse existing primitives rather than parallel types.                                                                                    |

Keep Provider operational versions independent. A creation command must assert absence; updates require exact current versions, including policy context. Reject stale/contradictory input. Historical replay must never authorize present exposure. Deferred extensions: bounded availability signal, evidence/claim projections, trusted relationship authority, final executor status, direct responsibility and any legally required distinct signing entity. Do not design a ranking system or extend M4 execution objects for these concerns.

## E. Persistence / migration requirement

Proposed data owner: `@markorbit/mgsn-service`. Migration SQL and `infrastructure/persistence/migration-owners.json` are Shared Zone requiring Integration authorization; no migration is written here.

Require no auto-enrollment; no-row = NOT_PARTICIPATING/PRIVATE; explicit state; versioned visibility; durable actor/consent provenance; pause/revoke and retained revocation lineage; idempotency with payload conflicts rejected; optimistic/exact versions and atomic state/policy/replay/audit writes. At most one current participation authority per existing Workspace/Provider binding; new opt-in after revocation must not revive old grants. Retain privacy-safe audit, not raw customer context. Do not delete or rewrite M4 history. Prove concurrent expansion versus pause/revoke cannot leave stale exposure active.

## F. Gateway / API requirement

Authenticated management only: read current participation; explicit opt-in/activate; pause; resume; revoke; read visibility policy; update visibility policy. No public Provider Discovery endpoint in the immediate implementation issue.

Reuse Gateway Core-session/Workspace resolution, trusted Principal forwarding, permission checks, applicable CSRF/trusted-origin rules and idempotency conventions. Require authority for the owning Provider Workspace at Gateway and MGSN; do not trust body actor/Workspace fields or use `commercial-admin:read` as consent. The Integration contract must map management permissions explicitly; existing `execution:manage` is not, by itself, participation authorization. Validate exact versions and bind idempotency to Workspace/target/action/payload. Deny unknown identity/authority and stale policy; errors must not disclose another Workspace's private records. Current-version management reads and all eventual exposure checks must fail closed; replay is historical evidence only.

## G. Producer / consumer

- Producer/owner: **MGSN**, participation and visibility truth.
- Identity dependency: **Core Workspace identity**, by existing bounded reference/API only.
- Future consumer: **Lite M12 / future Provider Discovery**, authorized projections and candidate-only semantics; not implemented in the immediate management boundary.
- Later controlled-handoff compatibility: **Execution M13**, separately authorized owner handoff; participation grants no engagement or acceptance authority.

## H. Requested shared paths

- `packages/contracts/**`: minimum shared vocabulary, exports and contract fixtures; reuse existing identity/version/Principal primitives.
- `infrastructure/persistence/**`: MGSN-owner migration and ownership-map registration, without cross-service reads.
- `apps/gateway/**`: authenticated management routes and security/isolation tests.

MGSN runtime/repository/tests remain under `services/mgsn/**` in later authorized work. No Core, Lite, Execution, root config, workflow or lockfile changes are requested for the immediate boundary. Later consumer/disclosure integration requires its own scoped authorization. None of these shared paths is edited by #359.

## I. Compatibility requirements

Existing M4 Registry remains valid; no auto-enrollment; operational status unchanged; Allocation/Acceptance/Return and other M4 state machines unchanged; Supply remains private operating truth, not user Capability verification. M12 remains candidate-only with all four false consequences in section 14; M13 handoff stays separately authorized. Absence/ambiguity denies exposure. Visibility creates no selection, Allocation, Acceptance or appointment authority. Existing commitments use their separate authorization, never revoked network grants.

## J. Security / privacy requirements

Workspace isolation; explicit owner and field/purpose/audience authority; data minimization; End-client relationship protection; Applicant/Owner procedure-only separation; fail-closed visibility and revocation; versioned provenance; idempotency; no cross-service SQL; no automatic Public/Trusted exposure. Current policy must govern cached results, explanations and evidence retrieval; inability to verify current authority denies access. Required future fixtures/tests cover section 12, no-row migration, wrong Workspace/spoofed actors, absent permissions/CSRF, replay conflicts, concurrent policy contraction, revocation/rejoin and unavailable authority dependencies. No new event infrastructure is requested.

## K. Migration / deployment risk

Highest-risk compatibility failure: **accidentally treating all existing MGSN Providers as participating/discoverable after migration**.

Mitigation: **no-row = NOT_PARTICIPATING**, with PRIVATE/empty grants and no Public/Trusted backfill. Seed no opt-in from Provider ACTIVE, Supply verification, history or payment. Deploy management independently of discovery; older code, rollback, caches and unreadable policy versions must never default to exposure. Verify existing Provider/M4 data remains intact, no-row discovery denies, and pause/revoke/contraction survives restart before any later exposure enablement.

## 17. Explicit non-goals

No runtime implementation, shared contract code, new database table/migration, Gateway route, event infrastructure, UI, Provider Discovery algorithm, ranking/score, marketplace, public directory or human Provider Selection runtime. No Allocation/Acceptance/Return changes, Core identity changes, Lite/M12 changes, Execution/M13 changes, second Workplace/Organization/Provider identity, second Capability Engine or second Execution workflow. No live Provider contact, payment, filing or Official Truth. No production/provider configuration, root config/workflow/lockfile edits. Do not reopen M4 or create/start the next MGSN issue.

Delivery stops at **#359 PR ready for MGSN review → Shared Dependency Request returned to total-repo controller → STOP**.
