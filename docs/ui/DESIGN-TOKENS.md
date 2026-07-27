# Design Tokens

Tokens are typed exports and CSS custom properties. Semantic colors are `background`, `surface`, `surfaceRaised`, `textPrimary`, `textSecondary`, `textMuted`, `border`, `borderStrong`, `brand`, `brandHover`, `success`, `warning`, `danger`, and `info`. Brand color never substitutes for a status color. Spacing follows a named `xs`–`xxxl` scale; typography, radius, shadow, and motion likewise use named values. Components must not introduce arbitrary hex colors or spacing.

The current root implements light mode. Semantic indirection deliberately leaves room for a future dark theme without implying that dark mode exists in this task.
