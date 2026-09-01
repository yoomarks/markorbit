# Outcome & Trust Evidence V1

## 1. Status and scope

**MGSN-P0-006 / [#422](https://github.com/yoomarks/markorbit/issues/422), parent [#358](https://github.com/yoomarks/markorbit/issues/358).** Documentation / architecture boundary freeze only, audited on 2026-09-01 against fetched `origin/main` at `118252c503450dab39ee4d6f24899bf6c72e062e`, in the dedicated `mgsn-f` worktree/branch.

The smallest V1 outcome is privacy-authorized, contextual explanation of attributable historical evidence for human decision support:

```text
governed collaboration history
→ owner source facts / observations / claims
→ authorized contextual evidence
→ Trust Explanation → human decision support
```

It is never `history → magic score → winner → automatic Selection`. **Implemented** below means inspected current code only. **V1 Boundary / Not Implemented** freezes future semantics. Contracts changed: **NONE**; events emitted/consumed: **NONE**. No runtime, persistence, scoring, ranking or UI is implemented. Only this document changes.

## 2. Canon and audited inventory

Read [AGENTS.md](../../../AGENTS.md), [Participation & Visibility](NETWORK-PARTICIPATION-VISIBILITY-V1.md), [Human Selection](HUMAN-PROVIDER-SELECTION-V1.md), [Controlled Handoff](CONTROLLED-PRIVACY-HANDOFF-V1.md), [Provider Workspace](PROVIDER-WORKSPACE-V1.md), the task, [#422](https://github.com/yoomarks/markorbit/issues/422) and its [Lane Owner preflight](https://github.com/yoomarks/markorbit/issues/422#issuecomment-5485285516). Discovery remains pending and was read at exact `origin/mgsn-b` head `07a2e91a`; it is not copied here.

Current source audit:

- [Registry](../src/provider-registry.ts): Provider operational status and versioned provenance; Supply status, jurisdictions/services/effective period, capacity/availability, evidence references, source fingerprint and UNVERIFIED / EVIDENCE_RECORDED / VERIFIED_FOR_SUPPLY. No MGSN trust score, rating, `trustFlag` or outcome observation store was found.
- [Eligibility](../src/service-package-eligibility.ts), [Allocation/Acceptance](../src/allocation-provider-acceptance.ts), [Return](../src/provider-return.ts) and [M4 contract](../../../packages/contracts/src/provider-execution.ts): exact Service Package/suitability/assignment/response lineage and CURRENT/SUPERSEDED Provider claims.
- [Commercial-admin](../src/commercial-admin-read.ts): INTERNAL_OPERATOR + `commercial-admin:read` private inspection, not exposure authority or Trust judgment.
- [Execution Provider Return evidence](../../execution/src/provider-return-evidence.ts), [Evidence Review](../../execution/src/evidence-review.ts) and [Evidence Lifecycle contract](../../../packages/contracts/src/evidence-lifecycle.ts): exact evidence receipt and human review outcome ADMITTED_FOR_INTERNAL_USE / CORRECTION_REQUIRED / REJECTED, with supersession checks and false downstream consequences. This is Execution-owned evidence-handling truth, not verified professional outcome or Official Truth.
- [Payment contract](../../../packages/contracts/src/payment.ts) and Payment service: payment PENDING / REQUIRES_ACTION / PROCESSING / SUCCEEDED / FAILED / CANCELLED, attempts, verified provider-event receipts, refunds and reconciliation. These are Payment owner/commercial facts only.

No audited source currently establishes universal Provider quality, customer satisfaction or generic SUCCESS. Names containing “completed”, “success”, “verified”, “filed” or “outcome” are not admitted as Trust facts without exact owner authority. Unknown authority is **UNKNOWN / NOT ADMITTED AS TRUST FACT**.

## 3. Permanent locks and semantic layers

Private First; Trust Before Exposure; Evidence Before Ranking; Human Choice Before Routing Action; Relationship Ownership Remains with Organizations; Direct-to-Executor; No Rebrokering.

```text
Provider Return != Official Truth
Payment != Performance / Acceptance / Completion
Provider ACTIVE != Trusted Provider
VERIFIED_FOR_SUPPLY != universal trust or user Capability verification
Trust Evidence != Selection / Allocation / Acceptance / appointment
```

AI may summarize evidence, explain provenance/relevance/freshness/limitations, compare context, identify contradictions and offer advisory recommendations. It may not certify claims, invent missing truth, rank a winner, select, allocate, appoint, accept, file, pay or create Official Truth.

V1 separates:

| Layer                | Meaning                                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source Fact          | Canonical owner record proving only its own event/state, exact version and time; for example Allocation exists, Provider responded ACCEPTED, Payment succeeded, or Execution recorded an internal review decision |
| Provider Claim       | Provider-submitted `workStatusClaim`, assertion or artifact/reference. Attributable evidence, never self-verifying outcome truth                                                                                  |
| Outcome Observation  | Future bounded observation from an identified authorized observer/owner about one Provider/work context, with type, source/version/time, evidence references and correction/dispute status                        |
| Evidence Reference   | Provenance pointer; visibility never grants artifact/file/Matter/communication access                                                                                                                             |
| Trust Evidence       | Contextual item derived from currently authorized source fact, observation or claim, retaining source authority, provenance and limitations; never universal quality                                              |
| Trust Explanation    | Privacy-safe account of what exists, relevance, owner, context, freshness, contradictions, limitations and unknowns                                                                                               |
| Trust Recommendation | Future advisory decision support only; creates none of the authority consequences in section 10                                                                                                                   |

An Outcome Observation must eventually bind observer and authority, source owner, subject Provider, exact work/context, observation type, source/version/fingerprint, observed timestamp/effective period, evidence references, and correction/withdrawal/dispute lineage. It must not become a free-form public review or duplicate owner truth.

## 4. Source authority matrix

Classifications: REUSE_AS_SOURCE_FACT proves its narrow owner event; CLAIM_ONLY remains attributable assertion; EVIDENCE_REFERENCE_ONLY is a pointer; INTERNAL_ONLY cannot power general exposure; EXTEND_LATER requires a canonical observation/contract; NOT_TRUST_EVIDENCE has no performance meaning by itself.

| Source                                    | Owner / producer                            | Proves                                                                                                   | Does not prove                                                                  | Version / time / correction                                                                                            | Visibility                                            | Classification                                 |
| ----------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| Provider operational status               | MGSN Registry                               | Current ACTIVE/SUSPENDED/INACTIVE operational record                                                     | Quality, success, executor, qualification, trust                                | Provider version/update; INACTIVE terminal in M4                                                                       | Private by default                                    | NOT_TRUST_EVIDENCE                             |
| Registry provenance                       | MGSN                                        | Existing Provider/Core reference and attributed mutations                                                | Performance or relationship                                                     | Exact version/actor/time                                                                                               | Permission-controlled                                 | REUSE_AS_SOURCE_FACT                           |
| Supply Capability                         | MGSN                                        | Private stated operating coverage/effective facts                                                        | User Capability, outcome or ranking                                             | Immutable versions/fingerprint/effective period; ACTIVE/SUSPENDED/RETIRED                                              | Participation/Visibility projection required          | REUSE_AS_SOURCE_FACT                           |
| Supply verificationState                  | MGSN supply process                         | UNVERIFIED/EVIDENCE_RECORDED/VERIFIED_FOR_SUPPLY state                                                   | Universal trust, professional qualification, performance                        | Supply version/fingerprint/time                                                                                        | Private supply truth                                  | NOT_TRUST_EVIDENCE                             |
| Supply evidenceReferences                 | Source rights holders / MGSN provenance     | Reference was recorded                                                                                   | Artifact content/truth/publication                                              | Supply version and source rights; withdrawal handled by owner                                                          | Separate reference/artifact authority                 | EVIDENCE_REFERENCE_ONLY                        |
| Service Package                           | MGSN from Execution source                  | Exact package admitted/stale/cancelled                                                                   | Success, quality, acceptance                                                    | Version/fingerprint/source/captured/effective facts                                                                    | Originating authority                                 | NOT_TRUST_EVIDENCE                             |
| Eligibility                               | MGSN                                        | Exact ELIGIBLE/INELIGIBLE suitability evaluation for one Package/Provider snapshot                       | Performance, Selection or future suitability                                    | Version/fingerprint/evaluatedAt; source changes invalidate use                                                         | Private operational decision                          | NOT_TRUST_EVIDENCE                             |
| Allocation                                | MGSN                                        | Governed assignment event/status and lineage                                                             | Acceptance, appointment, execution, quality, completion                         | Version; ACTIVE/CANCELLED/SUPERSEDED, audit                                                                            | Work-owner/Provider bounded                           | REUSE_AS_SOURCE_FACT                           |
| Provider Acceptance                       | MGSN / authenticated Provider               | ACCEPTED or DECLINED response to exact Allocation                                                        | Success, completion, quality, future willingness/Selection, appointment         | Exact response fingerprint/respondedAt; immutable response                                                             | Bounded work authority                                | REUSE_AS_SOURCE_FACT                           |
| Return workStatusClaim                    | Provider via MGSN                           | Provider made this claim                                                                                 | Verified completion/filing/satisfaction/quality                                 | Return version/fingerprint/submittedAt; CURRENT vs SUPERSEDED                                                          | Private work/projection authority                     | CLAIM_ONLY                                     |
| Return assertions                         | Provider                                    | Exact structured assertions submitted                                                                    | Substantive truth or owner corroboration                                        | Same Return lineage; correction supersedes                                                                             | Minimized authorized projection                       | CLAIM_ONLY                                     |
| Return artifact/evidence references       | Provider / referenced owner                 | Provider supplied references                                                                             | Read right, artifact truth or successful outcome                                | Same Return lineage plus independent source rights                                                                     | Reference and artifact gates separate                 | EVIDENCE_REFERENCE_ONLY                        |
| M4 Evidence Handoff                       | MGSN + Execution                            | Exact current Return reference was handed to exact released Execution source                             | Claim true, filing succeeded, Matter complete, satisfaction                     | Idempotent receipt/time; newer Return supersedes review source                                                         | Workspace/Execution authority                         | REUSE_AS_SOURCE_FACT                           |
| Execution evidence receipt/review         | Execution human reviewer                    | Receipt status and exact ADMITTED_FOR_INTERNAL_USE/CORRECTION_REQUIRED/REJECTED internal review decision | External outcome, client satisfaction, filing/Official Truth, universal quality | Receipt/decision versions, fingerprints, reviewedAt; newer Return invalidates old source; correction requests retained | Execution-internal unless later projection authorized | REUSE_AS_SOURCE_FACT                           |
| Other Execution filing/review objects     | Execution                                   | Only their exact authorization/review/draft/release state                                                | External office success, broad performance or trust without explicit owner fact | Owner versions/fingerprints/time                                                                                       | Owner-controlled                                      | NOT_TRUST_EVIDENCE until specifically admitted |
| Payment lifecycle/status                  | Payment                                     | Initiation/current status; SUCCEEDED only payment success                                                | Provider performance, Acceptance, Matter completion, appointment, filing        | Version/provider event verifiedAt/succeededAt; refunds/reconciliation retained                                         | Commercial/private; amount sensitive                  | REUSE_AS_SOURCE_FACT, never performance        |
| Payment amount/refund                     | Payment                                     | Exact commercial amount/refund state                                                                     | Quality score or outcome quality                                                | Version/timestamps/event/reconciliation lineage                                                                        | Excluded from generic discovery Trust                 | NOT_TRUST_EVIDENCE                             |
| Commercial-admin inspection               | MGSN internal operator                      | Authorized operator viewed current Registry/Supply                                                       | Provider consent, Trust judgment or public visibility                           | Current owner records                                                                                                  | INTERNAL_OPERATOR only                                | INTERNAL_ONLY                                  |
| Originating Workplace outcome observation | Not implemented; future authorized observer | Nothing currently                                                                                        | No inferred satisfaction/success                                                | Must support exact version/time/correction/dispute                                                                     | Observer/relationship authority                       | EXTEND_LATER                                   |

DECLINED is legitimate exact response history, not a negative quality score. Evidence review REJECTED/CORRECTION_REQUIRED concerns the reviewed evidence receipt, not an automatic judgment of all Provider performance.

## 5. Context, freshness and current authority

Every Trust item is bounded by Provider identity, jurisdiction, service/capability and task/work type, collaboration/outcome scope, actual final-executor responsibility, source authority/version, observed time/effective period, freshness rule and `checkedAt`. US trademark-filing evidence cannot imply worldwide excellence. Absence is **UNKNOWN / INSUFFICIENT EVIDENCE**, not bad, unqualified or a low score unless an authoritative source independently proves a bounded negative fact.

Historical evidence may remain accurately attributable while stale or irrelevant for a current decision. Historical evidence != current suitability. Explanations name age/freshness, checked source versions and limitations; unknown freshness cannot become unlimited validity. Unavailable source yields UNKNOWN and no positive cache fallback.

Evidence existence is separate from exposure. Each future disclosure/explanation must revalidate current ACTIVE Participation, Visibility Policy, exact data class/fields, audience/context/purpose, relationship authority where required, owner/source rights and artifact rights. Missing, stale, ambiguous, revoked, contracted or unavailable authority means **DENY NEW TRUST EXPOSURE**. Retained private audit is not a rediscovery permit.

## 6. Corrections, contradictions and disputes

Provider Return CURRENT is the current Provider claim; SUPERSEDED remains immutable history but is not current. Execution refuses/supersedes review use when a newer Return receipt exists. Future observations must append correction/revocation/supersession lineage rather than overwrite history. Withdrawn evidence stops current reliance/exposure while retaining restricted provenance under retention policy.

Support conceptually CURRENT/CORRECTED/REVOKED/DISPUTED or equivalent metadata without freezing exact enum names. A dispute does not erase the claim and must not be silently counted as clean positive evidence. No full dispute workflow is designed here.

When Provider claim, Workplace observation, Execution review or other owner sources disagree: preserve each attributable exact source, time and context; show contradiction and limitations; do not invent consensus, choose an unofficial winner, delete unfavorable evidence or average conflict into a score. Corroboration is a separately sourced relationship between facts, not mutation of a claim into Official Truth.

## 7. Privacy and relationship protection

“Provider worked with Workspace X” is private relationship information, not a public partner graph, customer list or logo wall. No generic exposure of end-client name/email/phone/CRM identity, Workplace ↔ client relationship, quote/pricing/margin/profit/internal notes, unrelated Matter/mark/communication or raw Return free text/evidence. Future Trust output is an authorized minimized projection; privacy-safe aggregation may be designed later, but #422 freezes no formula or anonymity threshold.

Evidence reference visibility != artifact readability. A reference grants no download, file/Matter/communication enumeration or sibling access. Dereference requires exact current artifact owner permission for requester, purpose, context and version. Audit/explanation/reason strings must not copy private values or leak hidden Provider/relationship existence.

Trust attaches to the actual responsible/final executor. Consume [#375](https://github.com/yoomarks/markorbit/issues/375); do not infer proof from ACTIVE, Acceptance, Return or payment. Hidden intermediary/sub-agent work cannot be credited to the wrong Provider. Missing required responsibility proof is UNKNOWN / fail closed. A transparent required legal signer is not hidden rebrokering and is not automatically the executor; only the authoritative role evidence controls attribution.

## 8. Discovery compatibility

Future Discovery may consume only current privacy-authorized Trust Evidence projections plus explanations. Humans may compare relevance, source authority, freshness, contextual coverage, contradictions, disputes, limitations and unknowns. V1 defines no universal numeric score, stars, rating, leaderboard, quality badge, rank formula or winner.

```text
Trust Evidence → explanation / advisory evidence
Trust Evidence != rank / winner / Selection / Allocation / appointment
```

A recommendation preserves candidate-only consequences and exact evidence lineage. AI saying “best,” evidence volume or prior success cannot execute choice/action. Evidence Before Ranking is a safety constraint, not authorization to build ranking.

## 9. Negative acceptance cases

| Case                                                          | Required result                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| N01 Return says WORK_COMPLETED / Return exists                | Provider claim only; no verified outcome or Official Truth                    |
| N02 Return assertion or evidence reference exists             | No automatic truth or artifact access                                         |
| N03 Evidence Handoff completed                                | Handoff fact only; underlying claim, filing and completion unverified         |
| N04 Payment initiated/SUCCEEDED/refunded or amount known      | Commercial fact only; no performance, Acceptance, completion or quality score |
| N05 Provider ACTIVE                                           | No trust/high quality/final-executor/qualification inference                  |
| N06 VERIFIED_FOR_SUPPLY                                       | No universal trust, performance or user Capability verification               |
| N07 Eligibility ELIGIBLE                                      | No performance evidence, Selection or future suitability                      |
| N08 Allocation / prior ACCEPTED response                      | No success, appointment or future Selection/Allocation authority              |
| N09 DECLINED                                                  | Preserve exact response; no automatic negative-quality judgment               |
| N10 One-context past success/corroboration                    | No cross-jurisdiction/service universal trust                                 |
| N11 Little/no evidence                                        | UNKNOWN / insufficient, not bad or unqualified                                |
| N12 Stale evidence                                            | Explain limitation; do not present as current suitability                     |
| N13 Return SUPERSEDED                                         | Preserve history; old claim is not current claim                              |
| N14 New Return supersedes an Execution review source          | Old internal admission cannot validate new claim                              |
| N15 Two sources contradict                                    | Preserve both/provenance/conflict; no invented consensus or average score     |
| N16 Outcome disputed/corrected/revoked                        | Show status/limitation; no clean positive treatment or history erasure        |
| N17 Source unavailable/unknown authority                      | UNKNOWN; no positive fallback or admission by name                            |
| N18 Visibility revoked/contracted                             | No new Discovery Trust exposure; private history may remain                   |
| N19 Historical Provider–Workspace relationship                | No public partner graph or customer disclosure                                |
| N20 End-client identity/contact/CRM embedded                  | Exclude from generic Trust projection                                         |
| N21 Pricing/margin/profit/internal commercial detail embedded | Exclude; payment amount is not quality                                        |
| N22 Raw private Return/evidence/communication exists          | No blanket retrieval, copying or explanation leakage                          |
| N23 Hidden intermediary performed work                        | Do not credit direct-executor evidence to wrong Provider                      |
| N24 Legal signer appears                                      | Do not automatically classify signer as executor or recipient                 |
| N25 Direct-executor proof required but missing/stale          | UNKNOWN / fail closed, never inferred                                         |
| N26 Execution review ADMITTED_FOR_INTERNAL_USE                | Internal evidence admission only; no external outcome/Official Truth          |
| N27 Execution review CORRECTION_REQUIRED/REJECTED             | Evidence-review fact with limitations, not universal Provider rating          |
| N28 AI says Provider A is best                                | No Selection, rank winner or action                                           |
| N29 Evidence-rich Provider                                    | No automatic Allocation, Acceptance, appointment or contact                   |
| N30 Successful Payment + Return                               | Still no Matter completion, filing success or Official Truth                  |
| N31 Cached positive explanation after source/authority change | Deny/recompute; historical fingerprint is not current permission              |
| N32 Commercial-admin sees evidence                            | Internal access does not authorize discovery exposure or trust certification  |

## 10. Authority consequences and non-goals

Trust Evidence itself authorizes nothing beyond bounded evidence/explanation use under current visibility authority. Unless separate owner truth exists, it keeps false: `providerSelected`, `providerAllocated`, `providerAccepted`, `providerEngaged`, `professionalAppointmentCreated`, `externalContactAuthorized`, `protectedActionReleased`, `filingAuthorized`, `filingSubmitted`, `paymentAuthorizedByTrustEvidence`, `officialTruthCreated`, `matterCompleted`, `userCapabilityVerifiedAutomatically`.

No runtime, TypeScript, database/migration, Gateway/UI, score/rating/stars/leaderboard, ranking algorithm, public reviews, marketplace/bidding, automatic Selection/Allocation/appointment, live Provider contact, Payment/Filing or Official Truth. No duplicate Execution/Matter/Payment/Capability truth store. No cross-service SQL. #422 stops at this MGSN document and dependency request; the Lane Owner independently reviews/merges.

# Shared Dependency Request

## Goal

Create minimum canonical, composable Outcome Observation and contextual Trust Evidence/explanation vocabulary without a universal score or copied owner truth.

## Why

Current M4 provides narrow facts and Provider claims; Execution has internal evidence-review truth; Payment has commercial truth. Cross-lane consumers need stable provenance/context/limitations without interpreting local snapshots as verified performance.

## Producer

Each canonical owner produces its own Source Fact. MGSN produces Trust Evidence projection/explanation and references owner facts. Future authorized observers produce versioned observations. Core remains identity authority; #375 owns responsibility proof.

## Consumer

Future MGSN Trust evaluation/explanation, Provider Discovery and authorized Provider/Workplace evidence surfaces. Consumers remain advisory and cannot create routing or protected-action authority.

## Contract

Concepts equivalent to `OutcomeObservationReference`, `OutcomeEvidenceReference`, `TrustEvidenceItem`, contextual dimensions, source authority, visibility projection, explanation, limitation, dispute/correction reference and freshness. Reuse identity, exact-version/fingerprint/time, evidence and visibility primitives. Bind owner/observer/subject/work context, source authority, current/superseded/disputed state, contradictions and all section 10 false consequences. No score/rank, raw artifact, private relationship graph or duplicate owner record.

## Requested Paths

`packages/contracts/**` only for the later contract/fixtures. Persistence/migration, source-owner observation APIs, Gateway/security, artifact/source rights and Discovery consumer wiring remain separately scoped issues. MGSN runtime stays under `services/mgsn/**` after contracts are accepted.

## Compatibility

Preserve #367 Participation/Visibility, #381 candidate lineage, #394 human Selection, #405 Handoff and #375 executor responsibility. M4 and Execution evidence review remain unchanged; Payment and Capability retain ownership. Provider claims remain claims; current visibility governs exposure; no cross-service SQL or derived Official Truth.

## Acceptance

Fixtures cover every semantic layer, contextual dimensions, exact owner/version/time, UNKNOWN, stale/unavailable, superseded/corrected/revoked/disputed, contradictions without consensus, reference-vs-artifact authority, relationship/privacy exclusions, executor attribution, all section 9 negatives and false consequences. Future owner/MGSN HTTP/PostgreSQL tests prove tenant isolation, current visibility/revocation, immutable history and fail-closed source outages. Exact-head affected CI required.

## Risk

Primary risks: claim-to-truth promotion, Payment-as-performance, universal scoring, cross-context generalization, hidden relationship/customer leaks, stale positive caches, wrong executor attribution and duplicated owner stores. Mitigate with exact canonical references, current authority, contextual projection, explicit unknowns/limitations and append-only correction/dispute lineage.

## Blocked MGSN work

Blocks durable observation/Trust Evidence runtime and Discovery consumption, not this documentation freeze. Contract work comes first; persistence, observer APIs, Gateway and consumer integration require separate authorization. Do not start them in #422.
