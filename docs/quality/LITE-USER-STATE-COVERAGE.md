# Lite user-state Storybook coverage

This is a deterministic, read-only inventory for issue #1297. It does not change production information architecture, owner contracts, migrations, or runtime state semantics.

## User and job

The reviewed user is a Lite professional deciding what information is ready, incomplete, unavailable, restricted, stale, or failed before continuing ordinary work. The primary question is: **can I trust what is shown, and what—if anything—can I do next?**

The Product-owned information architecture remains unchanged. Each existing surface keeps its own entry point and actions; this inventory only records fixture-backed Storybook evidence. Desktop and narrow behavior are not inferred from a state story unless that story explicitly carries the corresponding viewport evidence.

## State interpretation

- `EVIDENCED`: one or more named exports exist in the owning Storybook file.
- `MISSING`: the state is semantically relevant, but no focused story currently proves it.
- `NOT_APPLICABLE`: the current bounded surface contract does not expose that state; a reason is mandatory.

`EMPTY`, `UNAVAILABLE`, `ERROR`, and `PERMISSION_RESTRICTED` remain separate. A stale or conflicting snapshot is not an error. A successful preparation or review state is not evidence that an external action was sent, published, accepted, or completed.

## Scope and findings

The machine-readable source is `docs/quality/LITE-USER-STATE-COVERAGE.json`. It covers nine representative mature Lite surfaces and all eight requested state families. The focused audit verifies that every evidence reference resolves to a real story export and reports missing evidence in stable order.

Agency IA prototype, historical migration, Trading Studio, and the sell-side Trademark Asset story remain explicitly excluded. Those exclusions prevent this audit from productionizing Agency IA or competing with the Trading evidence lane.

Known gaps remain recorded as `MISSING`; no fixture or backend truth was invented to make the matrix appear complete. Issues #1299–#1301 may close only the gaps that belong to the bounded shared trust pattern and its acceptance evidence.
