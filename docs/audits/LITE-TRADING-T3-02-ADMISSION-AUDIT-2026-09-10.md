# LT-T3-02 Listing Asset Admission Preflight Audit

Issue: #1096  
Audit branch: `lite-trading/1096-t3-02-admission-audit`  
Current-main baseline: `a3e26117043600c5dfde42678a3fa315d75271db`  
Scope: docs/audit only. No contract, runtime, persistence, API, UI, migration, workflow or shared-hot-file mutation.

## Recommendation

`READY_FOR_T3_02_CODE`

No new cross-service canonical owner is required before T3-02 coding. The missing seam is a Trading-owned admission binding inside the already-public `trading-asset-classification` contract surface. Coding must still wait for L0 `START LT-T3-02 CODE` and Shared Contracts Lock availability.

## Current-main owner matrix

| Concept | Current owner / surface | Current guarantee | Gap for T3-02 |
| --- | --- | --- | --- |
| Private Studio visual | Trading / `packages/contracts/src/trading-asset-classification.ts` | exact version, private `studio-media_*`, `publicationEligibility: NOT_ELIGIBLE`, `aiConceptLabel: true`, AI provenance | none; source owner is already correct |
| Studio visual QA | Trading / same file | exact visual reference; `PASS / PASS_WITH_WARNINGS / FAIL`; no human/publication authority | none; QA is evidence only |
| Showcase | Trading / `packages/contracts/src/trading-brand-dna.ts` | exact Brand Bible/template/panels; explicit human panel selection; `PRIVATE`, `NOT_ELIGIBLE`; all authority consequences false | no public-representation admission binding |
| Listing Asset | Trading / `packages/contracts/src/trading-asset-classification.ts` | distinct `listing-asset_*`, public `listing-media_*`, `LISTING_PUBLIC`, provenance required, publication approval reference required | provenance and approval are currently loose strings; exact private source/review/admission cannot be validated |
| Listing Draft | Trading / `packages/contracts/src/trading-listing.ts` | requires non-empty exact-version Listing Asset refs; exact Showcase is separately pinned | trusts Listing Asset identity; does not itself prove asset admission |
| Explicit human action pattern | Trading / `trading-direction-selection.ts` | `selectionMethod: EXPLICIT_HUMAN_ACTION`; exact selected version; no Listing/truth authority | reusable semantic pattern, not reusable as the public-representation approval object itself |
| AI provenance | Trading + Managed AI / `trading-ai-provenance.ts`, `managed-ai-execution.ts` | exact lineage and implementation provenance; all human approval/publication/truth consequences false | must remain evidence only |
| Media rights | Media / `media.ts`, `media-rights.ts` | exact rights snapshot; current eligibility revalidation; eligibility creates no execution authority | reusable only when the admitted media requires those rights; must not become publication approval |
| Trusted public exposure | Network/public-provider boundary / `trusted-public-exposure.ts` | provider/directory field allowlisting and current serve authorization | REJECT for T3-02: provider-specific public exposure is not Trading Listing Asset admission |
| Listing publication | Trading Listing / `trading-listing.ts` | frozen exact draft; `CURRENT` review + explicit human approval; exact truth/direction/Showcase binding | separate later publication gate; Listing Asset admission must not publish the Listing |

## Frozen source -> admission -> Listing Asset state machine

```text
PRIVATE_SOURCE
  = exact TradingStudioVisualAssetV1
    + exact TradingStudioVisualQualityReviewV1
      status PASS or PASS_WITH_WARNINGS
  OR exact TradingShowcaseV1@version + slotId
    resolving to that same exact visual + exact quality review

PRIVATE_SOURCE
  -- QA pass alone --> still PRIVATE / NOT_ELIGIBLE
  -- Showcase human selection alone --> still PRIVATE / NOT_ELIGIBLE
  -- AI provenance alone --> still AI_CONCEPT / no approval authority

PRIVATE_SOURCE
  + EXPLICIT_HUMAN_ACTION approving this exact material
    specifically as a public representation
  + required rights eligibility evidence when the material needs it
  -> ADMITTED_PUBLIC_REPRESENTATION

ADMITTED_PUBLIC_REPRESENTATION
  -> distinct TradingListingAssetV1
     with distinct listing-media_* identity
     and exact admission/source lineage

TradingListingAssetV1
  != Listing publication
  != marketplace publication
  != ownership verification
  != Trademark Truth
```

Fail closed when any exact source id/version, QA review id/version, Showcase id/version/slot resolution, human approval, Workspace/Trademark Asset binding, or required rights eligibility does not match.

## Proof of permanent locks

1. Studio Visual is structurally `PRIVATE`, `publicationEligibility: NOT_ELIGIBLE`, `aiConceptLabel: true`.
2. Studio QA authority consequences freeze `humanApprovalCreated: false`, `showcaseApproved: false`, `listingPublicationCreated: false`, `trademarkTruthMutated: false` even when status is `PASS`.
3. Showcase is structurally `PRIVATE` and `NOT_ELIGIBLE`; its authority consequences freeze Listing creation/publication/source publication/truth mutation to false.
4. Showcase panel `selectionMethod: EXPLICIT_HUMAN_ACTION` means a person selected a private concept into the private composition. It is not approval for public representation.
5. Trading AI provenance freezes `humanApprovalCreated: false`, `listingPublicationCreated: false`, `officialTruthCreated: false`, `ownershipOrAuthorityVerified: false`.
6. Managed AI execution likewise creates no professional decision, filing, payment, external-message or external-action authority.
7. Media Rights eligibility explicitly has `createsExecutionAuthority: false`; rights eligibility is a prerequisite/evidence input, never the public-representation approval itself.
8. Listing publication remains a later, separate gate in `TradingPublishedListingV1`; Listing Asset admission cannot satisfy or bypass it.

## Minimum future contract delta

Keep the delta inside `packages/contracts/src/trading-asset-classification.ts` and its focused test file. Do not create a second owner or new package subpath.

Recommended minimum shape:

- add a typed Listing Asset admission record/reference owned by Trading;
- admission source is a discriminated union:
  - exact Studio Visual + exact quality review; or
  - exact Showcase + `slotId` + exact resolved Studio Visual + exact quality review;
- require the QA state used for admission to be `PASS` or `PASS_WITH_WARNINGS`, never `FAIL`;
- require a public-representation approval object with `approvalMethod: EXPLICIT_HUMAN_ACTION`, non-empty durable approval reference and timestamp;
- bind admission to the same Workspace / Trademark Asset lineage as the resulting Listing Asset;
- when rights are applicable, accept/reuse an exact `MediaRightsSnapshotRefV1` / current eligibility proof rather than inventing Trading-owned rights truth;
- replace or supplement loose Listing Asset `provenanceReferences` / `publicationApprovalReference` with the typed exact admission binding so validation can prove source + review + human public approval;
- keep all existing `noTradingAssetClassificationAuthorityConsequencesV1` values false;
- creating/admitting a Listing Asset must not create or publish a Listing.

Do not introduce a generic cross-service HumanApproval owner for this task. The approval semantics are specifically "this exact Trading material may become a public Listing representation" and therefore belong at the Trading admission boundary. Reuse the existing explicit-human-action pattern, not the DirectionSelection object.

## Expected focused negative proofs for coding

- exact Studio Visual with `FAIL` QA -> reject;
- QA `PASS` without explicit public-representation approval -> reject;
- Showcase panel selected by human but no separate public-representation approval -> reject;
- Showcase/slot not resolving to the exact source visual/review -> reject;
- source id mismatch or source version mismatch -> reject;
- quality-review id/version mismatch -> reject;
- approval missing / blank / non-explicit-human method -> reject;
- Workspace or Trademark Asset lineage mismatch -> reject;
- required rights eligibility missing/stale/ineligible -> reject when rights are applicable;
- AI provenance / generation completion / QA pass cannot substitute for approval;
- admitted Listing Asset still cannot set Listing/publication/truth/ownership authority consequences true.

## Path / collision map

Current audit branch started exactly at current main, so audit baseline drift is zero at freeze time.

### #1088 Shared Contracts Lock

#1088 currently changes:
- `packages/contracts/src/social-channel-binding.ts`
- `packages/contracts/tests/social-channel-binding.test.ts`
- `packages/contracts/package.json`

Future T3-02 should change only:
- `packages/contracts/src/trading-asset-classification.ts`
- `packages/contracts/tests/trading-asset-classification.test.ts`

`trading-asset-classification` already has a package subpath export and tsup build entry, so T3-02 does **not** need `packages/contracts/package.json`. Therefore the planned T3-02 file set has no direct path collision with #1088, but coding must still obey the L0 Shared Contracts Lock serialisation rule.

### #1092 other active coding lane

#1092 is Capability/Cordis trademark-change interpretation work. Its declared protected surfaces are Capability Engine / Brain / Lite composition and it explicitly avoids shared-contract hot files while #1088 owns the lock. T3-02 must not borrow or edit #1092 owner surfaces. No dependency from #1092 is required for Listing Asset admission.

### Hot files explicitly excluded

No need for T3-02 to touch:
- `packages/contracts/package.json`
- `packages/contracts/src/index.ts`
- root `package.json`
- `pnpm-lock.yaml`
- `tsconfig*`
- migrations / owner maps
- `.github/workflows/**`
- runtime, API or UI surfaces

## Coding gate

The repository already contains every upstream owner needed to express the admission boundary. The missing contract is local to Trading and can be implemented as a bounded extension of the existing asset-classification surface after L0 releases the coding gate.

Final audit result: `READY_FOR_T3_02_CODE`.
