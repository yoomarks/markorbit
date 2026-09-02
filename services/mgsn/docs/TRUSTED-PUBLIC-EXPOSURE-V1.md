# Trusted Public Exposure V1

## 1. Status and scope

**MGSN-P0 / [#648](https://github.com/yoomarks/markorbit/issues/648), parent [#358](https://github.com/yoomarks/markorbit/issues/358).** Documentation / product-boundary freeze only, based on current `main` after durable Outcome & Trust Evidence landed.

This document defines the first bounded Public-expansion semantics for MGSN. It does **not** create a public endpoint, public index, ranking directory, contact flow, live Provider outreach, public deployment, shared contract, schema or migration.

Public eligibility is authorization metadata only; it never establishes current serving authority without the revalidation required below.

The V1 progression is:

```text
private network truth
→ explicit public-eligibility authorization
→ current authority revalidation
→ minimum public projection
→ PUBLICLY_EXPOSED serve decision
```

It is never:

```text
Provider exists
→ automatically public
→ ranked marketplace
→ automatic contact / Selection / Allocation
```

## 2. Permanent canon

Public expansion remains subordinate to the permanent MGSN principles:

- Private First;
- Trust Before Exposure;
- Evidence Before Ranking;
- Human Choice Before Routing Action;
- Relationship Ownership Remains with Organizations;
- Direct-to-Executor;
- No Rebrokering.

The following locks remain unchanged:

```text
Public eligibility != Public exposure
Public exposure != Provider Selection
Public exposure != Allocation
Public exposure != Provider Acceptance
Public exposure != engagement/contact
Public exposure != legal/professional appointment
Public exposure != Controlled Handoff authorization
Public exposure != M13 protected-action release
Public exposure != Filing / Payment / Official Truth
Provider Return != Official Truth
Payment != performance / completion truth
Trust Evidence != universal score / stars / rank / winner
```

AI may explain or summarize already-authorized public facts. It may not make a private record public, certify a Provider, invent missing authority, choose a winner, select, allocate, appoint, contact, file, pay or create Official Truth.

## 3. Three distinct public states

V1 freezes three semantically distinct states. Exact future enum naming may be shared-contract work, but implementations must preserve the separation.

| State                     | Meaning                                                                                                                                                               | Serve publicly?                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `PRIVATE_NETWORK_ONLY`    | Current MGSN truth exists but no current authorization establishes public eligibility. This is the default.                                                           | No                                    |
| `TRUSTED_PUBLIC_ELIGIBLE` | An authorized Provider/organization decision permits a bounded set of fields to be considered for a defined public purpose/audience, subject to current revalidation. | Not by itself                         |
| `PUBLICLY_EXPOSED`        | At serve time, eligibility plus every required current authority/freshness/source check succeeds and the exact requested fields are inside the authorized projection. | Yes, only for that projection/request |

There is no implicit transition from Provider Registry presence, Network Participation, Discovery candidacy, Selection history, Allocation, Acceptance, Provider Return, Trust Evidence, Payment or commercial activity into public eligibility.

`TRUSTED_PUBLIC_ELIGIBLE` is authorization metadata, not a cached permission token. Every public serve must revalidate current authority.

## 4. Required public-eligibility authority

A future public-eligibility record must bind at least:

- exact Provider / organization identity;
- exact authorization owner / authorized organizational principal;
- purpose of exposure;
- public audience class;
- exact data classes and field allowlist;
- effective time and optional expiry;
- current Participation / Visibility policy reference where applicable;
- source versions/fingerprints for projected owner truth;
- revocation / supersession lineage;
- a statement that current authority revalidation is required before serve;
- all downstream authority consequences false.

Historical authorization is retained only as audit/history. Historical authorization does not establish current public eligibility after expiry, supersession, withdrawal, suspension, source invalidation or authority-source outage.

Unknown authority is denial for new public serve.

## 5. Public projection allowlist

Public exposure is field-bounded. A later Shared contract may model these classes more precisely, but it must not broaden them by omission.

### 5.1 Potentially public-eligible classes

Only when explicitly authorized and sourced from current owner truth:

- Provider public display name / organization name;
- a public-safe Provider identifier or slug that does not expose internal Workspace identity;
- public-safe geographic / jurisdiction coverage descriptors;
- public-safe service-category descriptors derived from authorized Supply truth, without private capacity or operational detail;
- public-safe language / operating descriptors if independently authorized;
- bounded public profile description supplied/approved by the Provider organization;
- public-safe Direct-to-Executor responsibility statement when authoritative evidence supports it;
- bounded contextual Trust Explanation fields already authorized for a `PUBLIC` audience, such as source class, freshness class, limitation codes and contradiction/dispute state, provided no hidden relationship or source identity is leaked;
- public contact mechanism only in a later separately authorized product slice. V1 does not authorize or implement contact.

Eligibility of one field never authorizes sibling fields.

### 5.2 Always excluded from generic public exposure in V1

The following must remain private unless a future separately frozen contract creates an explicit exceptional authority model:

- Core Workspace IDs or internal Provider Workspace IDs;
- end-client identity, name, email, phone or account metadata;
- Workplace ↔ client relationship graph;
- customer lists, logo walls inferred from matters, or relationship history;
- private communications, instructions, internal notes or CRM segmentation;
- pricing, quote values, margin, profit, commercial terms or Payment data;
- payment credentials, payment attempts, refunds or reconciliation details;
- Allocation rationale, allocator identity or internal routing reasons;
- private Supply Capability detail, capacity, availability, evidence internals or internal verification notes;
- Service Package source snapshots or unrelated Execution context;
- Acceptance acknowledgement payloads beyond separately authorized public facts;
- Provider Return assertions, free text, raw claims, attachments or artifacts;
- raw evidence, artifact content, download URLs, Matter files or evidence retrieval authority;
- unrelated matters, marks, assets, documents or communications;
- internal audit actor/principal/correlation values;
- internal trust calculation inputs, if any future implementation introduces them;
- hidden intermediary/sub-agent relationship data.

A public-safe projection must never be implemented as a filtered raw JSON dump.

## 6. Outcome / Trust Evidence compatibility

Outcome & Trust Evidence remains contextual advisory evidence, not a public reputation score.

A future public projection may expose only Trust Evidence / Trust Explanation fields whose audience authority explicitly permits public exposure and whose current source authority is revalidated.

Public exposure must preserve:

- Provider/context attribution;
- source class;
- freshness/currentness state;
- limitations;
- contradiction/dispute state;
- explicit statement that Provider Claim is not verified outcome truth where relevant;
- explicit statement that Payment is commercial fact only where relevant.

It must not expose:

- raw evidence or artifacts;
- evidence dereference authority;
- private source-owner values;
- end-client / relationship identity;
- universal score, stars, leaderboard, percentile, winner or generic quality badge;
- an inference that little/no evidence means a bad Provider.

`INSUFFICIENT_EVIDENCE` remains insufficient evidence, not a negative rating.

## 7. Current authority revalidation

Every attempted public serve must fail closed unless all required current checks succeed. At minimum, the future serving layer must be able to establish:

1. exact Provider/organization identity is still current;
2. relevant Network Participation / Visibility authority remains current where required;
3. public-eligibility authorization is current and not revoked/superseded/expired;
4. exact requested field/data class is authorized;
5. purpose and audience match the authorization;
6. source record/version/fingerprint is still current enough for the field;
7. source owner has not withdrawn/restricted the fact;
8. Direct-to-Executor attribution is not contradicted where the public statement depends on it;
9. Trust Evidence authority is separately current for any trust-related field;
10. artifact retrieval is not accidentally implied by evidence-reference visibility.

If any required source is unavailable, malformed, ambiguous, stale beyond policy, revoked or contradictory to an asserted positive public fact, new public serve is denied or reduced to a smaller independently authorized projection. There is no stale positive cache fallback.

## 8. Revocation, withdrawal and supersession

Public exposure must be revocable without deleting immutable owner history.

Conceptually:

```text
AUTHORIZED ELIGIBILITY
→ may produce current PUBLICLY_EXPOSED serve decisions

REVOKED / SUPERSEDED / EXPIRED / AUTHORITY_UNAVAILABLE
→ no new public serve from that authorization
```

A previously served page or external cache is not authoritative MGSN current truth. Future product work must define cache invalidation, downstream indexing removal and retention separately before production public exposure is authorized.

Withdrawal of one field does not necessarily revoke unrelated independently authorized fields, but implementations must not broaden remaining authority.

## 9. Direct-to-Executor and No-Rebrokering

Trusted public visibility must not become a lead-broker or hidden-subcontractor marketplace.

Any public statement implying that a Provider performs a service directly requires current authoritative executor attribution. Provider ACTIVE status, Supply declaration, Acceptance, Return or payment alone is insufficient proof of final-executor responsibility.

Where responsibility is unknown or contradictory, the public projection must omit the positive Direct-to-Executor claim or fail closed for the relevant field.

A transparent required legal signer or local representative is not automatically the final executor and must not be misrepresented as one.

## 10. Marketplace and ranking prohibition

Workstream 8 does not authorize a generic marketplace.

The following are outside V1:

- bidding or reverse-auction flows;
- lowest-price ranking;
- sponsored rank or pay-to-win visibility;
- universal stars/ratings;
- generic Provider leaderboard;
- automatic “best Provider” winner;
- automatic Provider Selection or routing because a public profile exists;
- automatic lead forwarding, contact initiation or appointment;
- public customer reviews without a separately governed observation/evidence model;
- public CRM/customer graph;
- scraping private network facts into a directory.

Public discoverability, if later implemented, remains advisory discovery only. Human choice and downstream governed authority remain separate.

## 11. Negative acceptance cases

| Case                                                | Required result                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Provider is ACTIVE                                  | Remains private unless explicit public eligibility exists                                  |
| Provider has ACTIVE Network Participation           | Participation alone is not public exposure authority                                       |
| Supply says `VERIFIED_FOR_SUPPLY`                   | No public trust/quality badge by consequence                                               |
| Provider was a Discovery candidate                  | No public listing by consequence                                                           |
| Provider was selected/allocated/accepted            | No public listing, contact or appointment authority                                        |
| Provider submitted a Return                         | Claim remains private unless a separately authorized bounded projection exists             |
| Payment succeeded                                   | No public performance/success inference                                                    |
| Trust Evidence exists                               | No public exposure unless public audience authority is current                             |
| Trust Evidence is absent                            | No low score or negative badge                                                             |
| Eligibility was authorized historically but revoked | Deny new public serve                                                                      |
| Authority source is unavailable                     | Deny new public serve; no stale-positive fallback                                          |
| One field is authorized                             | Sibling/private fields remain hidden                                                       |
| Evidence reference is public                        | Artifact retrieval remains unauthorized                                                    |
| Public profile is visible                           | No Selection, Allocation, Acceptance, contact or appointment consequence                   |
| Provider requests withdrawal                        | Stop future serve after current revocation is established; retain restricted audit history |

## 12. Shared dependency boundary

This document deliberately freezes semantics before Shared/public transport implementation.

A later Integration issue may define the minimum shared contract for public-eligibility authorization and current public projection. A separate later Integration/Gateway issue may define a public read surface only after the contract exists. Any live contact mechanism, search-index publication, cache/CDN policy or production rollout requires separate explicit authorization.

MGSN owner-local code must not preemptively add shared types, migrations, Gateway routes, public Web pages or external contact.

## 13. V1 acceptance

Trusted Public Exposure V1 is frozen only if future implementations preserve all of the following:

1. `PRIVATE_NETWORK_ONLY`, `TRUSTED_PUBLIC_ELIGIBLE` and `PUBLICLY_EXPOSED` remain distinct concepts;
2. explicit Provider/organization authorization is required for eligibility;
3. current revalidation is required for every public serve;
4. exposure is exact-field, purpose and audience bounded;
5. revocation/supersession/expiry/source failure stops new serve;
6. historical authorization never establishes current public eligibility;
7. relationship/client/commercial/raw-evidence/private operational fields remain excluded;
8. Trust Evidence remains contextual and non-ranking;
9. Evidence reference visibility never grants artifact access;
10. Direct-to-Executor / No-Rebrokering remains enforced;
11. public visibility creates no downstream Selection/Allocation/Acceptance/contact/appointment/M13/Filing/Payment/Official-Truth authority;
12. V1 introduces no public endpoint, live contact, shared contract, migration or deployment by itself.

Only this documentation boundary is in scope for #648.
