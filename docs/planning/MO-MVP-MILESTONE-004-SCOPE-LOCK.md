# MO MVP Milestone 4 Scope Lock

**Status:** `PROPOSED_FOR_OWNER_APPROVAL`  
**Planning task:** TASK 029  
**Baseline:** merged `main` at `505962ff146980a64b9cf6e08259068146612d05` after M3-WP-08 / PR #47.  
**Predecessor result:** Milestone 3 integration audit `GO`. Milestone 3 is not represented here as tagged, frozen or released unless a separate owner action creates that release reference.

## 1. Decision

**Recommended direction:** `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`.

Milestone 4 should close the next missing Beta delivery loop after durable Order-to-Matter truth: governed execution handoff to the MGSN provider network, explicit allocation and acceptance, durable Provider Return, and evidence handoff back into the controlled Execution boundary.

The milestone must not jump from internal Matter truth directly to official filing truth. The governing repository rules remain:

- Provider Supply Capability is not user Capability evidence;
- Provider Return is not Official Truth;
- Payment is not performance, authority, acceptance or completion;
- protected external actions require explicit review and approval;
- automatic official filing remains an MVP non-goal.

## 2. Why this is the next milestone

Milestone 3 proved:

```text
exact commercial source
-> durable Order
-> explicit confirmation
-> ReadyForMatter
-> atomic Formal Matter create/link
-> restart/recovery
```

The repository still lacks the durable governed loop required by the MVP product lock and four-week Beta plan:

```text
Matter / governed preparation
-> controlled execution package
-> eligible provider
-> explicit allocation
-> provider acceptance
-> provider work return
-> evidence review / handoff
```

The current baseline contains useful execution-governance semantics for Filing Authorization, Execution Release and Filing Execution Task Draft, but the implementation uses the in-memory `InMemoryFilingGovernanceRepository`. MGSN itself is still only a deployable service skeleton. The next milestone should make the operational provider loop durable and authenticated before adding finance or official-office integration.

## 3. Direction comparison

| Option | Outcome | Dependency fit | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| **A — Durable governed provider execution and return** | durable Execution source, MGSN provider eligibility/allocation/acceptance, Provider Return and evidence handoff | directly continues the M3 Matter boundary and closes the MVP provider-return loop | medium-high | **SELECT** |
| B — Payment / Invoice transaction layer | settlement, payment-provider and accounting truth | does not close the delivery loop and Payment is explicitly not authority/performance/completion | high | defer |
| C — External trademark-office filing | transmission, office credentials and official application truth | requires durable execution/provider evidence plus a separate protected external-action boundary | very high | defer |
| D — Broad lifecycle/communications expansion | reminders, messages and generalized customer status | useful later, but depends on durable execution truth to avoid projecting fixture state | medium | defer |

Milestone 4 chooses A only.

## 4. Primary product outcome

An authenticated authorized actor can take an exact current governed execution source, create a durable MGSN Service Package, evaluate provider eligibility, explicitly allocate one eligible provider, record provider acceptance, receive a durable Provider Return, and hand that return/evidence into Execution for review without creating Official Truth.

The primary acceptance path is:

```text
Authenticated Workspace / controlled operator
-> exact current Execution source
-> durable MGSN Service Package
-> eligibility evaluation
-> explicit Allocation
-> Provider Acceptance
-> Provider Return
-> exact Evidence Handoff to Execution
-> reviewable evidence state
-> restart/reload
```

The path must preserve exact source versions, Workspace isolation, Channel / Relationship Model lineage where relevant, idempotency, optimistic concurrency, provider identity, audit evidence and non-enumerating cross-Workspace behavior.

## 5. Runtime ownership

### Core

Core remains owner of User, Workspace, Membership, Session and authenticated Principal derivation. MGSN must reference Core identity/Workspace truth rather than inventing a second login or membership system.

### MarkReg

MarkReg remains owner of trademark Order, Customer Confirmation, Matter Draft, Formal Matter, Document Package and Instruction Ledger truth. MGSN cannot read MarkReg tables directly and cannot mutate Formal Matter status from Provider Return.

### Execution

Execution owns governed professional/external-action preparation, including the existing Filing Authorization / Execution Release / Filing Execution Task Draft semantics, and owns the evidence-review boundary that consumes a Provider Return.

Milestone 4 may make this existing execution-governance path durable and authenticated in the Execution database. It must not reinterpret `RELEASED_FOR_EXECUTION` as external submission.

### MGSN

MGSN owns provider-network operational truth:

- Provider identity reference/profile;
- Provider Supply Capability;
- Service Package;
- Eligibility Evaluation / eligibility evidence;
- Allocation;
- Provider Acceptance / decline;
- Provider Return;
- MGSN command and audit evidence.

MGSN does not own Formal Matter, Payment, Invoice, official Filing or trademark-office truth.

### Gateway and Web surfaces

Gateway remains transport/policy aggregation. Product and operations UIs are projections/action surfaces only and must not become state owners.

## 6. Canonical provider meaning

A **Provider** is a governed supply-side participant able to perform a bounded service package. Provider Supply Capability is operational supply evidence and must not be merged into the user Capability canon.

An **Allocation** is an internal governed assignment decision. It is not automatically:

- legal representative appointment;
- customer consent to a changed commercial scope;
- proof of payment;
- proof that work has started;
- proof that filing has occurred.

A **Provider Acceptance** means the selected provider accepted the internal service package under the recorded terms/version. It is not trademark-office acceptance.

A **Provider Return** is a structured provider claim/evidence package describing work performed and returned artifacts. It is never Official Truth by itself.

## 7. Milestone lifecycle boundary

Exact canonical vocabulary must be checked against the accepted publication canon in M4-WP-01 before contract freeze. The following is the bounded Milestone 4 acceptance path, not permission to replace publication-controlled states:

```text
Execution source ready
-> Service Package ready
-> Eligible
-> Allocated
-> Accepted
-> In Progress
-> Returned
-> Evidence Handed Off
```

Required semantic guards:

- only an explicit authorized command allocates a provider;
- eligibility does not allocate;
- allocation does not equal acceptance;
- acceptance does not equal professional/legal appointment;
- Provider Return does not equal completion or Official Truth;
- evidence handoff does not mutate Formal Matter or official Filing state automatically;
- AI may summarize, compare or recommend eligible providers but cannot independently allocate, accept, certify a Provider Return or create Official Truth.

## 8. Exact source admission

A Service Package must be admitted only from a current exact execution source. The initial trademark-filing vertical slice should preserve at least:

- Workspace identity;
- Formal Matter identity/version or exact governed Matter reference;
- current Preparation Lock identity/version where required by the execution path;
- current Filing Authorization identity/version where used;
- current Execution Release / Filing Execution Task Draft identity/version;
- jurisdiction;
- service scope;
- document/instruction references or immutable bounded snapshot;
- Channel and Relationship Model lineage where available;
- source checksum / correlation context;
- requested service window and constraints.

MGSN must not infer source truth by reading MarkReg or Execution databases.

## 9. Provider registry and Supply Capability

Milestone 4 requires a minimum durable private provider registry, not a public marketplace.

Required provider truth includes:

- stable provider ID;
- referenced Core Workspace / organization identity;
- active/suspended state;
- jurisdiction/service coverage;
- Supply Capability with version/effective period;
- explicit evidence references and verification status appropriate to supply-side operations;
- bounded capacity/availability metadata where required for eligibility;
- created/updated/audit metadata.

Prohibited:

- public star ranking;
- automatic professional qualification;
- treating supply capability as user Capability evidence;
- auto-accepting a provider because a score is high.

## 10. Eligibility, allocation and acceptance

Eligibility must be deterministic from the exact Service Package and exact Provider Supply Capability version used in the decision.

An eligibility result may explain why a provider is eligible or ineligible, but it cannot allocate.

Allocation must:

- be explicit;
- require an authorized actor;
- reference an eligible provider and exact eligibility result/version;
- use optimistic concurrency and idempotency;
- produce durable audit evidence;
- support explicit cancellation/reallocation under bounded policy before acceptance or under a governed recovery path.

Provider Acceptance / decline must be recorded under authenticated provider identity or another explicitly approved controlled actor model. Caller-supplied provider identity cannot override authenticated identity truth.

## 11. Provider Return and evidence handoff

Provider Return must preserve:

- exact Allocation / Acceptance lineage;
- provider identity;
- returned-at timestamp;
- structured work result / status claim;
- returned artifacts/evidence references;
- provider assertions and caveats;
- checksum/version metadata;
- immutable or append-only evidence where required;
- correction/supersession semantics rather than silent mutation.

The return may contain a provider assertion such as “submitted” only as a provider claim/evidence field. The system must not convert that assertion into `filingSubmitted`, `officialApplicationCreated`, `officialApplicationNumberReceived` or trademark-office contact truth without a later separately authorized official-truth workflow.

Evidence handoff to Execution must use an exact Provider Return ID/version/fingerprint and create a reviewable internal evidence record. It must be safe to retry and must not require a cross-service database transaction.

## 12. Cross-service consistency model

Milestone 4 must preserve database-per-owner isolation:

- Core -> Core DB;
- MarkReg -> MarkReg DB;
- Execution -> Execution DB;
- MGSN -> MGSN DB.

No direct cross-service SQL is allowed.

Cross-service handoffs use bounded APIs/contracts, exact source versions, idempotency and replay. Milestone 4 does not claim globally atomic transactions across Execution and MGSN.

Where a handoff succeeds in one owner but the acknowledgement path fails, the operation must be safely re-drivable from durable command/evidence truth. A durable cross-service outbox may be proposed by an implementation work package only if the scope remains bounded and evidence proves ownership; it is not implicitly required by this planning decision.

## 13. Authentication and isolation

Every protected M4 read/mutation must be authenticated and Workspace/provider scoped.

Required protections include:

- Core-derived Principal truth;
- explicit permission checks;
- provider-to-Core identity linkage;
- actor/workspace/provider spoof rejection;
- non-enumerating cross-Workspace/provider reads;
- Origin/CSRF for browser mutations where applicable;
- idempotency keys for protected mutations;
- optimistic expected versions;
- bounded safe error projections;
- append-only success/denial audit where appropriate.

## 14. Customer and operations projections

Milestone 4 should expose only bounded product-safe status.

A customer may eventually see that work is “with a service provider” or “provider evidence returned” if the product surface can do so without leaking provider-private data or asserting official truth. Internal/provider records remain owner-controlled.

The first implementation may prioritize controlled operations and API evidence over a broad customer redesign. A public provider marketplace is prohibited.

## 15. Authority consequences

Milestone 4 may create the following new internal truths through explicit governed commands:

- durable MGSN Service Package;
- eligibility result;
- explicit Allocation;
- Provider Acceptance / decline;
- Provider Return;
- internal evidence handoff/review record.

The following remain false unless a later separately scoped command owns them:

- Payment / settlement;
- Invoice issuance;
- legal/professional representative appointment;
- automatic customer acceptance of changed scope;
- external Filing submission truth;
- official application creation;
- official application number receipt;
- trademark-office acceptance;
- trademark-office contact caused only by internal state;
- automatic Matter completion;
- Capability verification/canon mutation.

## 16. Explicit non-goals

Milestone 4 does not implement:

- payment processor integration, settlement, custody or escrow;
- invoice/tax/refund/chargeback lifecycle;
- public MGSN marketplace or star ranking;
- automatic provider selection or allocation by AI;
- automatic professional/legal representative appointment;
- external trademark-office credential storage/transmission;
- automatic official filing;
- official application-number ingestion as trusted truth;
- generic global provider procurement;
- automatic Capability canon updates from Provider Return;
- production GA claim.

## 17. Required implementation sequence

The approved direction should be delivered through milestone-local work packages so implementation cannot skip ownership prerequisites:

1. `M4-WP-01` — provider execution contracts, canonical state/authority boundary;
2. `M4-WP-02` — durable authenticated Execution filing-governance source;
3. `M4-WP-03` — durable MGSN Provider Registry and Supply Capability;
4. `M4-WP-04` — Service Package and Eligibility;
5. `M4-WP-05` — Allocation and Provider Acceptance;
6. `M4-WP-06` — Provider Return and evidence handoff;
7. `M4-WP-07` — authenticated Gateway plus controlled operations/provider journey;
8. `M4-WP-08` — migration/restart/outage/concurrency/isolation/browser reliability matrix;
9. `M4-WP-09` — independent integration and authority audit.

The delivery plan may refine file-level implementation but must not reorder away the owner prerequisites.

## 18. Release acceptance

Milestone 4 may receive a `GO` recommendation only when one exact implementation tree proves:

```text
current governed execution source
-> durable MGSN Service Package
-> deterministic eligibility
-> explicit Allocation
-> authenticated Provider Acceptance
-> durable Provider Return
-> exact evidence handoff to Execution
-> restart/recovery
```

with:

- Core/MarkReg/Execution/MGSN owner boundaries preserved;
- no cross-service SQL;
- deterministic replay and version conflict behavior;
- provider and Workspace isolation;
- provider return correction/supersession evidence;
- no automatic financial, legal-representation or official-filing consequences;
- desktop/mobile evidence for any new user journey;
- exact-head hosted CI evidence;
- independent authority audit.

## 19. Planning approval meaning

Merging TASK 029 approves the direction and work-package boundaries for implementation. It does not itself:

- implement MGSN persistence;
- allocate a real provider;
- appoint a legal representative;
- send a document externally;
- submit a trademark filing;
- create Payment or Invoice truth;
- tag or publish a release.
