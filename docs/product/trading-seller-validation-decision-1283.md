# Trading seller validation decision note — #1283

Status: **VALIDATION EVIDENCE / NOT PUBLICATION AUTHORITY**

This note records what the #1283 seller-flow prototype proves and, equally importantly, what it does not prove. It is evidence for the #1265 product/architecture gate; it is not authorization for migration 0125, a Publish Request owner, or #1176.

## Current proven substrate

Fresh main already provides durable exact-version owners for Studio Run / Direction Set / Selection, Listing Draft / Review, Listing Asset currentness, and Marketplace Target Binding currentness. Brand DNA is also returned by the current Studio read boundary.

The #1283 prototype keeps the live Studio default unchanged. Seller validation is enabled only by an explicit prototype flag in Storybook/tests. Prototype workbench interactions are local UI state and create no durable creative artifact, Listing, Publish Request, authorization, provider attempt, or marketplace result.

## Decision question 1

**Is exact reviewed listing + exact destination set sufficient to reconstruct final confirmation conceptually after reload?**

Current answer: **architecturally likely, product proof incomplete**.

The existing exact-version owners provide the ingredients for deterministic reconstruction. The prototype also demonstrates that transient panel/open-tab state is unnecessary for reconstruction. However, #1283 does not wire live Listing Review + Marketplace Target owners into one production final-confirmation read, so this remains a composition hypothesis rather than end-to-end production proof.

## Decision question 2

**Does the user workflow currently require a persistent pending-publication queue?**

Current answer: **not proven**.

The validation journey remains understandable with durable Selection plus reconstructable reviewed inputs. No separate queue operation is required by the prototype. A queue becomes justified only if real operators need to leave publication pending across sessions, coordinate multiple pending publications, or resume a pre-authorization publication intent independently from editing/reviewing the listing.

## Decision question 3

**Is cancel-pending-publication a real user action distinct from editing/reviewing the listing?**

Current answer: **not observed**.

The current seller flow exposes edit/refine/review preparation and a disabled final-confirmation preview. There is no distinct user need for `Cancel pending publication`. Do not manufacture a `CANCELLED` lifecycle until real operation demonstrates that cancelling a pending publication intent is meaningfully different from abandoning or revising the reviewed listing/destination choice.

## Decision question 4

**Can a newer reviewed listing/destination naturally replace the previous confirmation state, or is explicit supersession history required?**

Current answer: **natural replacement appears sufficient for the prototype; real workflow evidence is still required**.

Because the final-confirmation concept can be derived from exact current refs, a newer exact reviewed listing or destination can conceptually produce a new confirmation view without persisting a separate supersession object. Explicit supersession history should be added only if operators need to audit multiple simultaneously pending publication intents or distinguish an intentionally replaced intent from ordinary revision history.

## Decision question 5

**Would a Core Human Receipt bound to an exact reviewed action digest be sufficient for final confirmation if publication is later activated?**

Current answer: **plausibly yes, but not yet authorized for implementation**.

If final confirmation is deterministically composed from an exact reviewed Listing, exact admitted Listing Assets, exact current Marketplace Target Binding, and the reviewed action digest, a Core HUMAN_USER receipt may be sufficient to prove the human-confirmation event without a separate pre-authorization business-intent owner. This must be re-audited when publication is actually activated; #1283 does not implement or authorize #1176.

## Decision question 6

**Which Deep Build state genuinely requires a future durable owner?**

Current answer:

- durable creative outputs may eventually need an owner when Brand Bible / Showcase / approved visual assets must survive restart, be shared across operators, or become exact Listing inputs;
- explicit seller choices that materially change reusable creative assets (for example an approved/pinned asset that becomes listing evidence) may require durable identity/version lineage;
- temporary tab selection, open/closed panel state, compare mode, unsaved adjustment controls, and prototype pin/remove interactions do **not** justify a durable owner;
- the current placeholder slots are deliberately local UI state and must not be mistaken for Brand Bible / Showcase / Listing Asset truth.

## Current #1265 decision

**KEEP #1265 FROZEN. Do not reserve migration 0125.**

#1283 shows a useful seller journey can be tested without introducing a Publish Request owner. Reactivate #1265 only after real seller/operator testing demonstrates at least one concrete need for restart-surviving pending publication intent, cancellation, supersession, receipt binding to a distinct intent object, or a recoverable publication queue.

## Next evidence to collect

Run the prototype with representative seller workflows and record whether users naturally ask to save/queue/cancel/resume publication intent separately from editing/reviewing the listing. Also test whether the Deep Build visual choices that users care about must persist across sessions or collaboration. Those observations, not an architecture diagram, should decide the next owner.
