# MarkOrbit Product Governance

Status: ACTIVE GOVERNANCE PROCESS
Effective date: 2026-10-07

## 1. Goal

Product conversations must create durable project memory.

A useful idea must not disappear into chat history, and a persuasive conversation must not silently alter implementation scope.

The permanent process is:

Discuss
→ Independent review
→ Joint decision
→ Version assignment / Park / Reject
→ Update canonical product files
→ Create or amend implementation work only when authorized
→ Validate against acceptance evidence

## 2. Three-director review

Every material product proposal is reviewed independently from three perspectives.

### Product Director
Evaluates:
- target user and job;
- commercial value;
- product scope;
- sequencing;
- whether the idea improves a real business loop;
- whether it belongs in 1.0/2.0/3.0;
- whether the product is becoming too broad.

### Design Director
Evaluates:
- user vocabulary;
- information architecture;
- journey continuity;
- channel behavior;
- state clarity;
- accessibility;
- whether internal implementation concepts are leaking into the product.

### Technical Director
Evaluates:
- owner boundaries;
- identity/Workspace isolation;
- data/knowledge authority;
- idempotency/currentness/replay;
- external dependency risk;
- security/privacy;
- operational cost;
- compatibility with existing substrate;
- whether a proposal creates duplicate truth or unnecessary platform scope.

The directors are required to disagree when appropriate. Product Owner preference is important input but is not itself technical/product proof.

## 3. Decision classes

Every material idea receives exactly one current disposition:

- 1.0 — necessary for the current commercial promise or release safety;
- 2.0 — valuable after 1.0 validation and reuse;
- 3.0 — long-term platform scale/composability;
- PARKED — potentially valuable but insufficient evidence/timing;
- REJECTED — conflicts with product strategy, safety, economics or architecture;
- RESEARCH — needs bounded evidence before version assignment.

## 4. Required durable updates

When a material idea is accepted or reclassified, update the appropriate canonical files in the same product-planning change:

- Product identity/principle change → MO-PRODUCT-CONSTITUTION.md;
- version/scope change → MO-VERSION-ROADMAP.md;
- rationale/decision → MO-PRODUCT-DECISION-LOG.md;
- not-yet-accepted idea → MO-IDEA-REGISTER.md;
- 1.0 release consequence → MO-MVP-1.0-ACCEPTANCE.md.

A chat answer alone is not an accepted product change.

## 5. Idea intake rule

During future conversations, an idea is material when it changes one or more of:
- target user;
- product promise;
- product surface/navigation;
- identity/Workspace semantics;
- commercial model;
- product profile/bundle;
- Brain/Capability/Knowledge/Data policy;
- external provider/channel policy;
- release gate;
- roadmap version;
- major workflow;
- platform ownership boundary.

For material ideas, the directors should:
1. state independent product/design/technical judgment;
2. record the disposition and rationale;
3. update the durable plan at the next repository planning change;
4. avoid creating implementation tasks until the idea is accepted into an active version.

Small wording, bug-fix and non-strategic questions do not require roadmap changes.

## 6. Version change rule

Moving an item between 1.0, 2.0 and 3.0 requires:
- explicit rationale;
- impact on current commercial promise;
- affected Golden Flow;
- dependency analysis;
- cost/complexity effect;
- acceptance impact;
- decision-log entry.

No item enters 1.0 because the code already exists.

No item remains in 1.0 because work has already been spent on it.

## 7. Implementation admission rule

An implementation task is admitted only if it maps to:
- an active 1.0 acceptance requirement; or
- a P0 security/data-integrity defect; or
- an explicitly authorized platform-maintenance obligation.

Every admitted task must name:
- Product version;
- user/business outcome;
- owning product surface;
- durable owner(s);
- acceptance evidence;
- rollout/maturity target.

Horizontal platform expansion without such mapping is blocked.

## 8. Capability maturity and product release

Technical existence is distinct from product maturity.

Canonical maturity:
EXPERIMENTAL → INTERNAL → MARKREG_DOGFOOD → PILOT → GA

Promotion is evidence-based.

A Product Profile may only depend on capabilities/providers/packs whose maturity and compatibility satisfy that profile's policy.

## 9. Repository truth classification

Each significant existing capability should be classified as one of:

- PRODUCTION — real user path with durable owner and production evidence;
- DURABLE_INTERNAL — real owner/substrate without complete product path;
- PREVIEW — fixture/demo/review surface;
- EXTERNAL_GATE — implementation exists but an external credential/provider/account/legal condition blocks real acceptance;
- PARKED — intentionally outside current roadmap;
- DEPRECATED — retained only for transition/removal.

This classification must be used during MVP rebaseline and subsequent audits.

## 10. Review cadence

At minimum:
- continuous: record material product decisions;
- weekly during active MVP work: review 1.0 acceptance gaps and escapes from MO to spreadsheets/email/manual scripts;
- before any new Epic: verify roadmap admission;
- before maturity promotion: verify production evidence;
- before 1.0 release: run full acceptance review.

## 11. Conflict resolution

Priority order:
1. security, legal/privacy and data integrity;
2. explicit Product Constitution;
3. active Version Roadmap;
4. 1.0 Acceptance gates;
5. current Decision Log;
6. historical Issues/PRs/plans.

Old Issues do not override a newer accepted product baseline.

## 12. Communication contract

Future product discussions should end with one of:
- no durable product change;
- decision logged;
- idea registered for research/parked;
- roadmap updated;
- 1.0 acceptance updated.

This prevents fragmented planning drift and makes the repository, not chat history, the durable product memory.
