# MarkOrbit Product Governance

Status: ACTIVE GOVERNANCE PROCESS
Effective date: 2026-10-08

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

Every indivisible material scope slice receives exactly one current horizon disposition:

- Shared 1.0 / MR-1.0 / WS-1.0 — necessary for the named current commercial promise or release safety;
- MR-1.5 / FORWARD — accepted only into the MarkReg Forward Track for governed real-use dogfood; it is not a WS-1.0 commitment, PILOT promotion or GA approval;
- WS-2.0 — valuable after 1.0 validation and reuse;
- WS-3.0 — long-term platform scale/composability;
- PARKED — potentially valuable but insufficient evidence/timing;
- REJECTED — conflicts with product strategy, safety, economics or architecture;
- RESEARCH — needs bounded evidence before version assignment.

A Forward disposition assigns a proof horizon, not ordinary-Workspace availability. The relevant module/subsection must still pass specification approval, dependency readiness, maturity promotion and release acceptance before broader exposure.

The Idea Register may separately mark lineage as ACTIVE, PROMOTED or PARTIALLY_PROMOTED. Those labels are not horizon dispositions. A row may contain multiple explicitly separable slices only when each slice has one horizon; an unresolved slice remains RESEARCH rather than simultaneously receiving a candidate version.

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

An implementation task is admitted only if it maps to one of:

- an active Workspace-release acceptance requirement;
- a MarkReg Forward Track dogfood objective;
- an explicitly approved Architecture Runway objective;
- a P0 security/data-integrity defect;
- an explicitly authorized platform-maintenance obligation.

Architecture Runway admission is intentionally possible even when a capability is not yet customer-visible. However, it must be decoupled from current release-critical flows, have a clear future platform/safety/cost rationale, and may not force product exposure merely to justify the work.

Every admitted task must name:

- Track: Architecture Runway / MarkReg Forward / Workspace Release;
- Product version or target horizon where applicable;
- user/business outcome or explicit platform/safety rationale;
- owning product surface;
- durable owner(s);
- acceptance evidence;
- rollout/maturity target;
- whether the work is visible to ordinary Workspace users.

Horizontal platform expansion without a named Architecture Runway objective remains blocked.

Horizontal platform expansion without such mapping is blocked.

## 8. MarkReg-first proof policy

Reusable user-facing capabilities intended for ordinary Workspaces should normally progress:

EXPERIMENTAL
→ INTERNAL
→ MARKREG_DOGFOOD
→ PILOT
→ GA

Promotion from MARKREG_DOGFOOD requires real-use evidence, not only synthetic tests or operator walkthroughs.

Evidence should include as applicable:

- number of real runs/cases;
- user/operator friction;
- error/fallback rate;
- escapes to manual tools;
- business outcome or time saved;
- support burden;
- operational cost;
- rollback/degradation behavior.

### Exception

If MarkReg is not a representative user for a capability, Product Governance may designate another Reference Workspace or bounded pilot.

The exception must state:

- why MarkReg is not representative;
- which Workspace/user is representative;
- equivalent evidence required before wider release.

"MarkReg does not use it" is never sufficient reason to skip real-use proof.

## 9. Release-lag policy

Workspace releases intentionally lag the MarkReg Forward Track.

At a Workspace release decision, three-director review must confirm:

- every ordinary-user capability has reference-use evidence;
- the released UI is simpler than the underlying platform;
- MarkReg is already exercising the next meaningful improvement wave;
- the next release can be shipped without redesigning the just-released core.

The purpose is continuous improvement and product defensibility, not artificial feature withholding.

## 10. Architecture/product decoupling

Architecture may advance beyond current product needs, but product surfaces should expose only what users need for the current job.

A stronger internal model must not create:

- additional user navigation solely for internal objects;
- mandatory configuration users cannot understand;
- slower onboarding;
- dependency on unfinished future modules;
- release blockage without an explicit acceptance reason.

## Product specification approval gate

Material product development is specification-gated.

Before runtime implementation begins for a product module or a material product change, the three directors must produce an owner-reviewable specification covering, at minimum:

- module purpose and target users;
- target release track/version;
- entry points, pages and information architecture;
- when a user-facing UI is in scope: Chinese-primary behavior with complete English functional parity; desktop, mobile and applicable Mini Program behavior; loading, empty, partial, stale, conflict, unauthorized, forbidden, recoverable error, blocking error, offline and success states plus task-specific states; composed-journey accessibility behavior; fixture-backed Storybook states; bilingual desktop/mobile and applicable Mini Program visual evidence; Playwright acceptance paths; and real-channel evidence where browser fixtures cannot prove identity, payment or notification behavior;
- canonical business objects;
- fields and visible information;
- states/state transitions;
- user/system actions;
- permissions and Workspace isolation;
- feature/profile/channel/provider controls;
- dependencies and owner boundaries;
- failure/degradation behavior;
- audit/evidence requirements;
- product/operating metrics;
- acceptance criteria;
- unresolved questions requiring Product Owner decision.

Specification status is one of:
DRAFT / IN_REVIEW / APPROVED / FROZEN / CHANGE_REQUESTED / SUPERSEDED.

Only the Product Owner can move product scope to APPROVED/FROZEN for implementation. Approval may apply to a full module or explicitly identified subsections.

Product Owner feedback that revises, redirects, expands, narrows or reassigns a draft defaults to CHANGE_REQUESTED for the affected module/subsection unless the Product Owner explicitly states APPROVED or FROZEN and identifies the approved scope. A direction or version decision may be recorded durably while the rest of the module remains unapproved.

Implementation issues and PRs must cite the approved module/subsection, release track and acceptance criteria.

If an approved product definition changes, affected implementation pauses until the Change Request is reviewed and the product specification is updated.

Existing code, previous Issues, Preview maturity or green CI do not override this gate.

## 11. Capability maturity and product release

Technical existence is distinct from product maturity.

Canonical maturity:
EXPERIMENTAL → INTERNAL → MARKREG_DOGFOOD → PILOT → GA

Promotion is evidence-based.

A Product Profile may only depend on capabilities/providers/packs whose maturity and compatibility satisfy that profile's policy.

## 12. Repository truth classification

Each significant existing capability should be classified as one of:

- PRODUCTION — real user path with durable owner and production evidence;
- DURABLE_INTERNAL — real owner/substrate without complete product path;
- PREVIEW — fixture/demo/review surface;
- EXTERNAL_GATE — implementation exists but an external credential/provider/account/legal condition blocks real acceptance;
- PARKED — intentionally outside current roadmap;
- DEPRECATED — retained only for transition/removal.

This classification must be used during MVP rebaseline and subsequent audits.

## 13. Review cadence

At minimum:

- continuous: record material product decisions;
- weekly during active MVP work: review 1.0 acceptance gaps and escapes from MO to spreadsheets/email/manual scripts;
- before any new Epic: verify roadmap admission;
- before maturity promotion: verify production evidence;
- before 1.0 release: run full acceptance review.

## 14. Conflict resolution

Priority order:

1. security, legal/privacy and data integrity;
2. explicit Product Constitution;
3. active Version Roadmap;
4. 1.0 Acceptance gates;
5. current Decision Log;
6. historical Issues/PRs/plans.

Old Issues do not override a newer accepted product baseline.

## 15. Communication contract

Future product discussions should end with one of:

- no durable product change;
- decision logged;
- idea registered for research/parked;
- roadmap updated;
- 1.0 acceptance updated.

This prevents fragmented planning drift and makes the repository, not chat history, the durable product memory.
