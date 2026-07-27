# UI Foundation

## Purpose and language

MarkOrbit Lite, markreg.com, and Operations Console share accessible primitives, semantic tokens, status language, and evidence-aware presentation—not product information architecture. Lite is a dense, calm professional workspace; markreg.com is a spacious, reassuring guided service; Operations Console is a compact, explicit internal triage surface.

Capability retains its canonical meaning and hierarchy. Provider Return is not Official Truth, payment is not completion, and protected external actions always require explicit review and approval. AI and fixture output cannot silently mutate formal state, verify a Capability, or change canon.

## Responsive and interaction principles

Desktop layouts preserve product-specific navigation and comparison context. Below 760px, shells become one column, navigation scrolls horizontally, cards stack, and primary action order remains logical. Content never depends on hover. Every operation is keyboard reachable, focus remains visible, and status has icon/text as well as color. Motion respects `prefers-reduced-motion`.

## Internationalization readiness

UI strings remain separate from tokens and layout; layouts tolerate expansion and bidirectional future work. Display locale-aware dates with an unambiguous month name where space permits, and include time zone for operational timestamps. Display money with ISO 4217 currency code when ambiguity exists, never infer currency. Display country names localized for customers and retain ISO codes in data/operations contexts. Display language names in their own language plus localized name when needed. Translation is out of scope.

## Fixture integrity and prohibited patterns

Fixtures use a high-prominence `FixtureBanner` and explicit “Fixture only” badges; they must never visually resemble verified, official, live, or professionally accepted results. Do not use generic chat for Guide, color-only status, unlabeled controls, hidden legal limitations, automatic formal-state changes, dark patterns, arbitrary component hex/spacing, large UI frameworks, or cross-product workflow components.

## State colors

Error means an action failed and needs correction; Warning means progress remains possible with material risk or attention; Pending means work has not resolved; Success means the described step completed only—not authority, acceptance, payment performance, official truth, or end-to-end completion.
