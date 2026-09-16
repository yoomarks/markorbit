# Lite user vocabulary audit

Issue: `#1287`

This audit enforces a UX visibility boundary; it does not redefine MarkOrbit architecture. It reuses the prototype-only mapping in `agency-ia-prototype-vocabulary.md` while leaving Agency production information architecture evidence-gated on real dogfood.

- **USER** copy uses professional task language and keeps required safety meaning: for example, `Up to date`, `Needs refresh`, `Ready for approval`, and `Some information is unavailable`.
- **ADVANCED** copy may expose exact versions, references, fingerprints, receipts, and related terms only through a reviewed, exact baseline entry for a diagnostic or source-history context.
- **HIDDEN** vocabulary describes implementation architecture and must not appear as new ordinary Lite copy. The scanner covers bounded phrases such as owner state, Prepared Action, Execution Release, Target Binding, Capability Twin, and Reflection Candidate.

The Vitest audit parses production `.ts` and `.tsx` source rather than grepping raw text. Tests, stories, imports, comments, identifiers, property names, and TypeScript literal types are outside the user-copy signal. Raw `CURRENT`, `STALE`, `UNKNOWN`, and `UNAVAILABLE` values are checked only when directly rendered. Plain-English words such as `owner` and legitimate business copy such as `Seller role: OWNER` are not globally banned.

Existing findings are recorded individually by file, category, exact phrase, count, surface, and reason. Wildcards, directories, zero counts, duplicates, missing reasons, stale entries, and unreviewed new findings fail closed. The baseline is never generated or updated by the test.

The checked-in baseline summary is maintained by the focused test and must match the current audit exactly. Trading Studio remains scanned, but issue `#1283` owns any copy repair in that surface.

## Fresh-main baseline

The initial audit records 108 occurrences across 27 production source files in 55 exact baseline entries: 92 USER occurrences of known wording debt and 16 ADVANCED technical-evidence occurrences. Nothing is automatically treated as approved merely because it already exists.

| Category                    | Occurrences |
| --------------------------- | ----------: |
| `OWNER_INTERNAL`            |          27 |
| `REVIEW_INTERNAL`           |          24 |
| `TECHNICAL_EVIDENCE`        |          17 |
| `EXECUTION_INTERNAL`        |          16 |
| `PROTECTED_ACTION_INTERNAL` |          10 |
| `REFLECTION_INTERNAL`       |           6 |
| `PREPARATION_INTERNAL`      |           4 |
| `RAW_STATUS_ENUM`           |           2 |
| `CAPABILITY_INTERNAL`       |           2 |

Trading Studio contributes two existing `OWNER_INTERNAL` occurrences. They are reported in the baseline only; this task does not modify the Trading surface.
