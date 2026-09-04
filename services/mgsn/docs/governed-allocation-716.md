# Governed Allocation admission (#716)

The explicit-human-choice path is a separate MGSN operation.

It must not call the legacy `allocateProvider()` mutation and append admission lineage afterward. The governed repository commit is the only mutation boundary and must atomically persist the exact M4 Allocation, the #712 admission-lineage row, governed replay, legacy Allocation replay/audit required by M4, and the lineage audit.

A missing lineage row remains `LEGACY_UNLINKED`; it is never inferred as `NONE_EXPLICIT`. `NONE_EXPLICIT` is an explicit new-flow admission statement. `EXACT` requires fresh `HANDOFF_CONSUMPTION` validation and never grants artifact retrieval, Provider Acceptance, contact, appointment, Filing, Payment or Official Truth.
