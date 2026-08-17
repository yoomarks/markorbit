# M9-WP-01 — Daily Workspace Contracts and Ownership Boundary

## Objective

Freeze the minimum M9 Product vocabulary and ownership decisions required to deepen the existing Lite Product Loop into the SEE -> CREATE -> MOVE Daily Workspace.

WP01 is a contract/architecture work package. It must not introduce a second content lifecycle, automatic publication, customer outreach, external protected action, Capability verification or a physical Brain service.

## Existing contracts that must be inspected/reused first

- `packages/contracts/src/product-loop.ts`;
- Knowledge ReadyPackage export/intake contracts;
- Core Workspace / Principal / permission contracts;
- existing Lite content preparation runtime;
- existing Product feedback contracts;
- MOKI universal engine Lite consumer contract;
- existing MarkReg formal opportunity / intake handoff boundaries.

## Required contract surface

WP01 should freeze the smallest useful vocabulary for:

1. source-derived Daily Signal candidate input;
2. Daily Orbit product projection;
3. Content Pick product projection;
4. Content Kit working projection tied to existing Content Opportunity/Draft lifecycle;
5. Content Angle;
6. Platform Variant metadata;
7. minimum Creator Preference;
8. Visual Brief;
9. Visual Output Reference;
10. bounded Product interaction/preference events.

## Required lifecycle mapping

The contract tests must prove:

```text
Daily Signal
-> Daily Orbit Item
-> Content Pick
-> existing Content Opportunity
-> Content Kit working projection
-> existing Content Draft / Human Review / PublishPackage
```

and must prove that Content Kit does not become publication authority.

MOVE remains:

```text
Today Recommendation
-> Prepared Action
-> explicit confirmation
-> owner handoff
```

## Authority locks

- Recommendation != authorization.
- Content Pick != publishable content.
- Content Kit != Content Draft lifecycle replacement.
- Content Draft != reviewed content.
- Human Review approval != external publication.
- PublishPackage != Published.
- user-reported publication/use != MarkOrbit-executed external action.
- Product preference != Capability verification.
- Visual request != provider execution authorization.
- Daily ranking/explanation != legal or official truth.
- Brain is a logical responsibility in M9, not a new physical service.

## Ownership

- Knowledge: source acquisition/provenance only.
- Core: identity/Workspace/Principal/permission and trusted Knowledge intake integrity.
- Lite: Daily projection, recommendation, Product content working state and Product preferences.
- Visual repository: visual assets/recipes/provider routing/QC.
- MarkReg: formal trademark-service opportunity/work truth.
- Execution: governed protected actions where applicable.
- Capability Engine: governed professional capability evidence/learning only.
- Gateway: transport/composition only.

## Acceptance

WP01 is complete when:

- new contracts compile and are exported through the correct package surface;
- tests enforce lifecycle/authority separations;
- source references preserve owner/id/version/fingerprint/observed time where applicable;
- all new Product objects are Workspace-scoped where persistent/product-specific state requires it;
- no contract implies automatic publish/outreach/formal opportunity/order/matter/payment/provider appointment/filing/official truth/capability verification;
- existing Product Loop tests remain green;
- no new service is created merely for Brain/Daily Orbit/Content Kit naming.

## Non-goals

- migrations;
- production persistence for new M9 objects;
- Daily ranking runtime;
- Content generation runtime;
- Visual provider calls;
- UI changes;
- automatic publication;
- external outreach;
- Capability ingestion changes;
- deployment/GA.

## Next task

After WP01 is merged, M9-WP-02 implements the governed Knowledge -> Daily Signal runtime path against the frozen contract.
