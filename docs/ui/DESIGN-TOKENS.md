# Design Tokens

## Source and architecture

`packages/ui/src/tokens` is the engineering source of truth. TypeScript exports support typed composition; CSS custom properties apply the current light theme. A semantic indirection layer permits a future dark theme without changing component APIs, but dark mode is not implemented.

## Color

| Semantic token                              | Purpose                              |
| ------------------------------------------- | ------------------------------------ |
| `background`                                | Product canvas                       |
| `surface`, `surfaceRaised`                  | Content and elevated surfaces        |
| `textPrimary`, `textSecondary`, `textMuted` | Ordered text emphasis                |
| `border`, `borderStrong`                    | Structure and interactive boundaries |
| `brand`, `brandHover`                       | Brand action and hover only          |
| `success`, `warning`, `danger`, `info`      | Independent state meanings           |

The CSS layer additionally defines focus emphasis and readable on-color values. A status must include words or an icon; contrast is reviewed in stories and automated checks. Product code must not bind brand color to status.

## Scale

Spacing is the closed sequence `none, xs, sm, md, lg, xl, xxl, xxxl` (0 through 3rem). Radius uses `sm, md, lg, pill`; shadow uses `subtle, raised`. Typography provides one system stack, six sizes, four weights and two line heights. Motion provides fast/normal durations and one standard easing; reduced-motion preferences collapse decorative animation. Exceptions require a token proposal rather than an ad hoc value.

## Evolution

Token changes are versioned with code review and visual evidence. Figma variables later map to these names and versions; they do not drift as an unrelated source. Full brand identity, dark mode and additional themes are non-goals for this task.
