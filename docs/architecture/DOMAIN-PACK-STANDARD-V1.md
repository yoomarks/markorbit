# Domain Pack Standard V1

- **Status:** additive contract foundation
- **Scope:** declarative domain requirements only
- **Authority:** a Domain Pack does not create canonical truth, approve sources or providers, authorize protected actions, or load executable code.

## Purpose

A Domain Pack is a versioned manifest that maps one professional domain onto existing MarkOrbit owners. It references ontology, truth/source authority, knowledge, rules, workflows, governed Capabilities, provider requirements, evidence requirements, benchmarks, and presentation schemas. It is not a runtime, plugin, package installer, or marketplace object.

The executable contract is `DomainPackV1` in `@markorbit/contracts/domain-pack`. All references carry `owner`, `id`, and `version`; consumers resolve them through the referenced owner's existing contract and authority rules.

## Owner boundaries

| Concern                                               | Canonical owner used by a pack                          |
| ----------------------------------------------------- | ------------------------------------------------------- |
| Domain ontology and reusable knowledge                | Knowledge                                               |
| Official external facts                               | Data Engine                                             |
| Workspace/private context                             | Core and the owning product                             |
| Typed non-canonical inference                         | Brain                                                   |
| Capability canon, implementation binding and outcomes | Capability Engine                                       |
| Provider requirement and selection                    | MGSN / existing provider contracts                      |
| Evidence and provenance                               | Existing Evidence/Provenance owners                     |
| Protected-action approval and execution               | Existing Governance, Authorization and Execution owners |
| Product presentation and workflow meaning             | The named product surface owner                         |

Installation or acceptance of a pack does not change any referenced object's status. Each owner independently validates the exact reference and applies its current policy.

## Declarative UI extensions

V1 permits only a stable extension identity, a product-owned surface, a bounded slot, a versioned presentation-schema reference, and required Capability IDs. JavaScript, module URLs, arbitrary components, navigation injection and executable callbacks are not contract fields. Product owners retain information architecture, permission, accessibility and rendering responsibility.

## Trademark reference mapping

Trademark is the reference mapping, not a bundled replacement implementation:

- `domainId`: `trademark-services`, matching current Capability lineage.
- ontology/knowledge: exact Knowledge-owned trademark references.
- official facts: exact Data Engine source references; provider returns remain non-official.
- workspace trademark context: Core/product-owned exact references.
- inference policy: Brain-owned reference; inference remains non-canonical.
- professional rules and workflow: MarkReg-owned references.
- Capability requirements: existing accepted Capability IDs and versions, with governance/evidence/provider requirement references.
- provider requirements: MGSN-owned criteria, never a provider product name.
- UI extensions: MarkReg-owned presentation schemas in bounded slots, without a Lite navigation change.

## Evolution and compatibility

The manifest is additive and versioned. Unknown fields fail closed in V1. A breaking semantic or structural change requires a new schema version. Retirement does not delete referenced evidence or lineage. This standard introduces no persistence migration and does not authorize hot loading, third-party package execution, monetization, or a plugin marketplace.
