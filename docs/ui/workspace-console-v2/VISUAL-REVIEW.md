# Visual review checklist

Status: `PASS` on Chromium desktop and 390 px mobile.

## Required captures

- Chinese desktop: `zh-desktop-overview.png`, `zh-desktop-products.png`,
  `zh-desktop-collection-mismatch.png`.
- English desktop: `en-desktop-products.png`, `en-desktop-finance.png`.
- Chinese 390 px: `zh-mobile-390-overview.png`, `zh-mobile-390-products.png`.
- English 390 px: `en-mobile-390-finance-denied.png`.

## Review criteria

- No combined available balance appears.
- Payment, agreement, entitlement, installation and member assignment remain separate.
- Payer/payee/legal entity are readable before secondary transaction metadata.
- Brand and collection authority are not conflated.
- Desktop rows convert to readable single-column mobile rows without horizontal page overflow.
- Dialog actions remain reachable at 390 px and keyboard focus is visible.
- Fixture/provenance notices are visible near financial actions.
- Chinese labels are concise; English is complete rather than navigation-only.

## Findings

- Product comparison initially compressed six columns on mobile. It was changed to labeled,
  single-column plan cards and recaptured.
- The 390 px browser assertion confirms the document has no horizontal page overflow.
- Transaction detail uses a bottom-sheet treatment on mobile; payer, payee, currency/channel,
  status and evidence remain visible before the close action.
- Collection mismatch uses an alert dialog and persistent blocked status. It does not offer a
  bypass through brand editing.
- English screenshots contain full page, finance-lane and error content, not navigation-only copy.
