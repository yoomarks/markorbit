# Workspace Console V1 visual review evidence

Review base: `origin/main@e44470ea8bf08faf8a2be9ac8c7b513317a45ea9`

Surface: isolated fixture-only preview

Review status: `READY_FOR_INDEPENDENT_REVIEW`

## Captured browser evidence

| Evidence                                        | Viewport / purpose                                       |
| ----------------------------------------------- | -------------------------------------------------------- |
| `evidence/workspace-overview-zh-desktop.png`    | 1440 × 1050, Chinese owner overview                      |
| `evidence/workspace-overview-en-desktop.png`    | 1440 × 1050, complete English owner overview             |
| `evidence/workspace-overview-zh-mobile-390.png` | 390 × 844, Chinese mobile overview regression            |
| `evidence/workspace-products-zh-mobile-390.png` | 390 × 844, product and multi-Site mobile regression      |
| `evidence/workspace-resources-zh-desktop.png`   | 1440 × 1050, owner-backed resource directory             |
| `evidence/workspace-products-zh-desktop.png`    | 1440 × 1050, installation/entitlement/runtime separation |
| `evidence/workspace-team-zh-desktop.png`        | 1440 × 1050, member scope/action/expiry model            |
| `evidence/workspace-revoked-link-zh.png`        | 1440 × 1050, revoked old-link denial                     |

## Review findings

- Hierarchy: current institution identity and owner decisions precede products and resources.
- Scanability: desktop keeps a stable 248 px rail; content stays within a 1280 px canvas.
- Mobile: 390 px uses a fixed bottom navigation, single-column cards and labeled member rows; the
  automated regression found no horizontal document overflow.
- Language: Chinese navigation remains short and colloquial; the English route translates all
  visible shell and overview content without exposing internal contract names.
- Truthfulness: the preview banner and action receipts state that payment, Core persistence and Site
  owner writes do not occur.
- Authority: employee Lite fixtures omit unassigned customers; revoked external access shows a
  fail-closed page and does not expose other resource names.
- Accessibility: semantic landmarks/headings/tables/forms are present, controls have accessible
  names, focus styles are visible, status is not color-only, dialogs can close with Escape, and
  reduced-motion preference is respected.
- States: loading, empty, error, permission, partial and success treatments are available from the
  state-matrix route. Stale/revoked semantics are documented in the Decision Record and the revoked
  link route.

## Review boundary

These screenshots are rendered from named fixtures. They are not evidence of production payment,
Core persistence, agency-identity verification, Resource Access Grant durability, or the real
Agency #1093 operator journey. Production Storybook stories and owner-backed browser acceptance
belong to the separately approved implementation slices after this design review.
