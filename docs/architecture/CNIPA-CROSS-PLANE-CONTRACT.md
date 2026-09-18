# CNIPA Cross-Plane Contract

Status: Proposed architecture baseline for CNIPA judgment acquisition and downstream use

Related architecture:

- `docs/architecture/COGNITIVE_PLATFORM_ARCHITECTURE.md`
- `docs/architecture/BRAIN-FOUNDATION-ARCHITECTURE.md`
- `docs/architecture/DATA-ENGINE-INTEGRATION-BOUNDARY.md`
- `docs/architecture/MO-LITE-DAILY-WORKSPACE-AUTHORITY-BOUNDARY.md`

Related implementation tracks:

- Knowledge acquisition: `yoomarks/markorbit-knowledge#691`
- Knowledge slow DETAIL lane: `yoomarks/markorbit-knowledge#796`
- Data Engine CNIPA LIST facts: `yoomarks/markorbit-data-engine#746`

## 1. Purpose

This contract freezes the ownership and exchange boundaries for the three CNIPA public judgment libraries:

- `REGISTRATION_EXAMINATION`
- `OPPOSITION_DECISION`
- `REVIEW_ADJUDICATION`

The contract exists to prevent source documents, structured facts, cognitive interpretations, and Workspace business state from collapsing into one store.

The governing platform invariant remains:

> Knowledge owns documents. Data Engine owns objective facts. Brain researches how to understand documents and facts. Products own business state. Capability executes governed methods.

For CNIPA, this means:

```text
CNIPA
  |
  +--> Knowledge FAST LIST acquisition
  |       |
  |       +--> raw LIST evidence
  |       +--> canonical document asset from LIST fileContent
  |       +--> stable DETAIL discovery pointer
  |       |
  |       +--------------------> Data Engine LIST fact projection
  |
  +--> Knowledge SLOW DETAIL enrichment
          |
          +--> raw DETAIL evidence
          +--> enriched canonical document version where material

Knowledge documents ------------------+
                                      |
                                      v
                                    Brain
                                      ^
                                      |
Data Engine objective facts ---------+
                                      |
                            governed relation/result
                             /                     \
                            v                       v
                  Data Engine objective        MarkReg / Workspace
                  world relationships          business relationships
```

## 2. Permanent ownership matrix

| Object / responsibility                              | Owner                                                   | Explicit non-owner                |
| ---------------------------------------------------- | ------------------------------------------------------- | --------------------------------- |
| CNIPA browser/session/authentication                 | Knowledge                                               | Data Engine, Brain, Product       |
| LIST scheduling, pagination, retry, backfill windows | Knowledge                                               | Data Engine                       |
| DETAIL slow queue, pacing, retry/backoff             | Knowledge                                               | Data Engine                       |
| Raw LIST response bytes                              | Knowledge                                               | Data Engine                       |
| Raw DETAIL response bytes                            | Knowledge                                               | Data Engine                       |
| Canonical Markdown / document versions               | Knowledge                                               | Data Engine                       |
| Retrieval/indexing over documents                    | Knowledge                                               | Data Engine                       |
| CNIPA LIST structured source facts                   | Data Engine                                             | Knowledge as canonical fact owner |
| Objective official relationships                     | Data Engine after governed admission                    | Knowledge, Product                |
| Reusable interpretation/reasoning method             | Brain                                                   | Knowledge, Data Engine            |
| Case-specific cognitive interpretation               | Brain runtime / consuming Product according to contract | Data Engine as canonical fact     |
| Client / portfolio / managed trademark asset         | MarkReg / Workspace                                     | Data Engine                       |
| Matter / task / reminder / notification target       | MarkReg / Workspace                                     | Data Engine                       |
| External action execution                            | Capability / Execution                                  | Brain, Knowledge, Data Engine     |

## 3. Source identities

Stable source identity is library-specific:

| Library                  | Stable source record id |
| ------------------------ | ----------------------- |
| Registration examination | `adjuOpenId`            |
| Opposition decision      | `adjuOpenId`            |
| Review adjudication      | `pubId`                 |

These source identities are the cross-plane join anchors. Systems should not invent a second CNIPA document identity when the official source identity is available.

## 4. Contract A — LIST acquisition

### Owner

Knowledge.

### Purpose

Acquire CNIPA public judgment populations with the minimum request load required for durable source evidence.

### Rules

1. DATE_RANGE LIST is the primary acquisition surface.
2. Primary LIST collection never fans out DETAIL requests.
3. LIST acquisition owns authenticated-session behavior, hidden pagination, bounded retries and request pacing.
4. Returned pagination metadata is not trusted where authenticated raw evidence proved it clamped.
5. Content-driven termination remains valid:
   - empty page;
   - short page;
   - full page with zero new canonical ids;
   - explicit safety ceiling.
6. Zero-row windows are successful source observations, not errors.
7. A LIST run is valid independently of any later DETAIL availability.

### Historical windowing

Historical coverage begins from a configurable floor, initially `2016-01-01`.

The maximum query interval is 30 calendar days.

Backfill uses monotonic density-adaptive windows:

```text
sparse history      -> up to 30-day windows
denser history      -> 7-day windows
high-volume/current -> 1-day windows
```

Cutover years are not hard-coded. Window size is reduced from observed density / safety pressure.

A window that reaches a collection safety ceiling is not accepted as complete; it must be subdivided and replayed at a smaller interval.

### Current incremental cadence

The preferred ordinary cadence avoids weekend-only calls:

```text
Monday    -> query Friday through Sunday
Tuesday   -> query Monday
Wednesday -> query Tuesday
Thursday  -> query Wednesday
Friday    -> query Thursday
Weekend   -> no scheduled primary request
```

Holiday or otherwise empty windows remain successful empty observations.

## 5. Contract B — Knowledge document asset

### Owner

Knowledge.

### Initial document creation

CNIPA LIST rows already expose `fileContent` in the observed libraries.

Knowledge may therefore create the initial canonical Markdown document from LIST content without requesting DETAIL.

The initial document asset binds at minimum:

- document kind;
- stable source record id;
- source authority;
- source URI / acquisition evidence;
- LIST RawArtifact lineage;
- canonical Markdown bytes;
- immutable content hash;
- observed/captured time;
- version lineage.

The document is a Knowledge asset even when its body originated from a LIST row.

### Versioning

Knowledge document versions are immutable.

A later enrichment does not overwrite the LIST-derived version. It creates a new version only when the canonical content materially changes.

## 6. Contract C — Data Engine LIST fact projection

### Owner

Data Engine after a governed projection from Knowledge acquisition output.

### Purpose

Represent objective structured facts exposed by CNIPA LIST rows.

Examples include:

- document kind;
- source record id;
- application / registration identifiers;
- trademark name;
- source party fields;
- source agent fields;
- source title / document number;
- source decision / return date;
- source authority;
- cited registration identifiers where explicitly exposed;
- query observation window;
- observation time;
- reproducible source-row fingerprint / provenance.

### Exclusions

Data Engine does not store:

- LIST `fileContent` as a document body;
- raw DETAIL bodies;
- canonical Markdown;
- Knowledge document version state;
- DETAIL acquisition queue state;
- Brain interpretation;
- Workspace portfolio or Matter relationships.

Data Engine may preserve enough source provenance to reproduce and audit the structured fact without taking ownership of the Knowledge document asset.

### Empty-window semantics

A valid zero-row source window is a successful observation. It does not imply that a specific mark, application, registration, or proceeding does not exist.

## 7. Contract D — DETAIL enrichment

### Owner

Knowledge.

### Discovery

DETAIL URIs are deterministic from source identity and may be recorded immediately when LIST discovers a record:

```text
REGISTRATION_EXAMINATION
/pubnotice/portal/tmscJudgment/queryInfo?id=<adjuOpenId>

OPPOSITION_DECISION
/pubnotice/portal/tmyyJudgment/queryInfo?id=<adjuOpenId>

REVIEW_ADJUDICATION
/pubnotice/portal/tmpsJudgment/queryInfo?id=<pubId>
```

Recording the URI does not mean DETAIL has been fetched.

### Runtime model

DETAIL is a separate slow acquisition lane.

Initial policy:

- strict serial concurrency = 1;
- materially slower pacing than LIST;
- small bounded request budget;
- durable lease/checkpoint;
- retry/backoff only under governed evidence-backed rules;
- authentication/security challenge pauses the lane;
- repeated successful content is deduplicated by content hash.

Primary LIST acquisition must never wait for this lane.

### Result

DETAIL produces a Knowledge RawArtifact.

If DETAIL materially adds content, links, images, cited-mark references, or source fields, Knowledge may create an enriched immutable Markdown version with lineage to both LIST and DETAIL evidence.

If DETAIL adds nothing material, no redundant canonical document version is required.

## 8. Contract E — Brain consumption

### Inputs

Brain may consume both:

1. Knowledge CNIPA document assets and exact document versions;
2. Data Engine CNIPA and trademark structured facts.

Brain must preserve exact evidence/version/fact scope in its research lineage.

### Brain responsibilities

Brain may:

- retrieve similar documents;
- discover patterns;
- compare case reasoning;
- derive feature definitions;
- study decision behavior;
- propose relation candidates;
- build and validate reusable methods;
- produce case-specific interpretations through governed runtime paths.

Brain does not become the canonical owner of CNIPA documents, trademark populations, or Workspace business state.

## 9. Contract F — objective relation admission

Relationships must be classified before persistence.

### Class 1 — source-explicit objective relation

Example:

```text
CNIPA decision D explicitly identifies application 12345678
CNIPA decision D explicitly cites registration 11223344
```

These are objective source relationships and may enter Data Engine after deterministic parsing / identity validation.

### Class 2 — inferred objective relation

Example:

A Brain method infers that a document corresponds to a structured trademark record from mark, party, class and date evidence when no direct identifier is present.

This remains a candidate relation until it passes a governed admission contract with:

- method/version identity;
- evidence references;
- applicability;
- confidence/evaluation requirements;
- deterministic target identity;
- audit evidence.

Only after admission may it become Data Engine objective fact.

### Class 3 — business relation

Examples:

- this CNIPA document is relevant to Workspace trademark asset A;
- this mark belongs to client C;
- Matter M should include this decision;
- operator O should be notified;
- create task/deadline/review work.

These are Product / MarkReg / Workspace relationships and must not be written to Data Engine.

## 10. Contract G — Workspace asset-link

### Owner

MarkReg / Workspace.

A Workspace may link a Knowledge document or Data Engine source identity to:

- managed trademark asset;
- client / agent;
- Matter;
- task;
- deadline;
- notification;
- internal note;
- workflow state.

A deterministic official identifier may make the candidate link obvious, but persistence of the business relationship remains Product-owned.

Brain may assist matching. Capability may execute a governed link/create/update command where authorized. Neither action transfers ownership to Brain or Data Engine.

## 11. Cross-plane identity rule

The same CNIPA record may appear in multiple planes without duplicated ownership:

```text
source identity:
  (document_kind, source_record_id)

Knowledge:
  document asset / version / provenance

Data Engine:
  structured source fact / objective relations

Brain:
  evidence reference / method input / interpretation

MarkReg:
  business link to managed trademark asset / Matter
```

Cross-plane references must preserve owner + stable identity. A consumer reference does not create a second canonical copy.

## 12. Production bootstrap consequence

CNIPA production bootstrapping must reflect ownership and traffic class.

Primary LIST acquisition:

- three independent CNIPA SourceDefinitions because response identities/schemas differ;
- scheduled FAST LIST plans using adaptive historical backfill and weekday incremental windows;
- no DETAIL fan-out.

Slow DETAIL acquisition:

- separate Knowledge enrichment authority / queue / plans;
- independent request budget and pacing;
- no dependency from LIST success.

Data Engine admission and Product/Brain consumption are downstream integrations, not part of CNIPA browser execution authority.

## 13. Architecture acceptance checks

Every CNIPA implementation PR should answer:

1. Is this a document/evidence asset? If yes, Knowledge owns it.
2. Is this an objective structured source fact? If yes, Data Engine may own it.
3. Is this an interpretation, reusable reasoning method, or relation inference? If yes, Brain owns the method/result according to its contract.
4. Is this a client/portfolio/Matter/workflow relationship? If yes, Product/MarkReg/Workspace owns it.
5. Is this a protected or external action? If yes, it requires Capability/Execution authority.
6. Does the implementation copy canonical owner data merely for convenience? If yes, redesign around stable references.
7. Can LIST success remain valid if DETAIL is unavailable for weeks? It must.
8. Can a zero-row source window finish successfully? It must.
9. Can an inferred relation enter Data Engine without governed evidence admission? It must not.
10. Can Data Engine store canonical CNIPA Markdown or DETAIL bodies? It must not.

## 14. Working model

For CNIPA specifically:

> Knowledge preserves the decisions. Data Engine preserves their objective facts. Brain learns how to understand and connect them. MarkReg decides what they mean for our managed assets and work.
