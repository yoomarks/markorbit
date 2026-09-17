# Evidence-to-Fact Bridge V1

- Task: `FOUNDATION-EVIDENCE-TO-FACT-CONTRACT-V1`
- Contract: `MARKORBIT_FACT_CANDIDATE_V1`
- Shared package: `@markorbit/contracts/fact-candidate-v1`
- Issue: `yoomarks/markorbit#1328`
- Runtime mutation: none

## Purpose

Fact Candidate V1 is the transport boundary between Knowledge document evidence, a governed
Brain/Method extraction, Capability execution and Data Engine fact admission. It lets a proposed
objective relationship retain an exact evidence trail without making either a document, an
extractor return or a candidate equivalent to Data Engine truth.

The first admitted fact family is intentionally narrow:

`CITED_AS_REFERENCE_FOR_REFUSAL`

It represents a trademark application receiving a refusal that explicitly cites another trademark
in an official document. A refusal event by itself cannot produce this candidate or edge.

## Owner path

```text
Knowledge document/version + exact locator
  -> Brain/Method extraction identity + version
  -> PROPOSED Fact Candidate
  -> governed validation
  -> VALIDATED or REJECTED
  -> Data Engine admission
  -> ADMITTED fact identity or REJECTED
```

- Knowledge remains owner of the referenced document bytes, version and locator.
- Brain/Method owns the extraction-method meaning and version.
- Capability will own governed execution when an ACTIVE method exists.
- Data Engine owns only an admitted objective fact and its immutable provenance reference.
- A Product owns no state in this bridge and receives no automatic workflow mutation.

## Evidence identity

Every candidate binds:

- jurisdiction, fact type, refused subject trademark and cited object trademark;
- event date and optional effective date;
- Knowledge source/document identity, immutable version, SHA-256 and source URI;
- an exact page-text or canonical-text range plus the selected text SHA-256;
- direct-official authority;
- extraction Method identity/version;
- evidence level and bounded confidence basis points;
- `legalConclusion: false`.

The candidate fingerprint is SHA-256 over the canonical JSON representation of those
evidence-bearing fields. Candidate ID, creation time and ingestion decisions are excluded, so
validation/admission can progress without changing the evidence identity. Changing the fact,
document version, locator, method version or confidence changes the fingerprint.

## State invariants

- `PROPOSED` has no validation or admission decision.
- `VALIDATED` has an accepted validation and no admission decision.
- `REJECTED` contains either a validation rejection or a post-validation admission rejection.
- `ADMITTED` contains both an accepted validation and a Data Engine admission identity.
- `REJECTED` and `ADMITTED` are terminal in V1.
- Decision timestamps cannot precede candidate production or their preceding transition.
- A Provider Return, model output or extractor output cannot skip validation.

## US and CN proof fixtures

The shared contract package contains fixture-backed proofs for:

- a USPTO TSDR office-action page that explicitly identifies a cited registration; and
- a CNIPA refusal/review document page that explicitly identifies a cited mark.

These are synthetic contract fixtures, not claims that live documents were acquired or that the
corresponding facts exist in production.

## Fail-closed boundary

V1 rejects unknown fields, unsupported fact types or jurisdictions, inferred authority, missing
official identifiers, non-exact locators, fingerprint drift, malformed method versions and invalid
state combinations. Consumers import the shared contract; they must not reproduce its wire types.

V1 does not implement an extractor, activate a Brain Method, invoke Capability, acquire a live
document, write a Data Engine fact, create a citation table/API, infer legal effect, or mutate
production state.
