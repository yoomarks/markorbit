# Accessibility Baseline

Target WCAG 2.2 AA. Native HTML is preferred. Pages have one logical `h1`, ordered headings, named landmarks, a visible focus indicator and a main-content target. Controls work by keyboard without hover; tab order follows reading order; tabs expose selected state; steppers expose the current step. Icon-only actions require an accessible name.

Every form control has a persistent label. Help and errors use `aria-describedby`; errors set `aria-invalid` and are announced. Loading uses polite status; blocking errors and the fixture warning use alert semantics. StatusBadge combines symbol and text so color is never the only signal. Text and controls target AA contrast, 200% zoom and reflow without horizontal page scrolling; dense operational content may scroll within a clearly named region in later tasks.

Motion respects reduced-motion. Touch targets aim for 44×44 CSS pixels in customer journeys. Copy avoids legal certainty and identifies assumptions and limitations. Locale, directionality and 30% text expansion must be reviewed before translation work.

## Evidence and acceptance

- Storybook a11y addon checks serious violations and invalid ARIA on component/product stories.
- Testing Library verifies labels, error descriptions, landmarks, disabled behavior and semantic status.
- `jest-axe` checks rendered primitives; color contrast remains a Storybook/browser visual check because jsdom cannot calculate it reliably.
- Future product journeys add Playwright keyboard paths: skip/enter main content, traverse primary navigation, complete forms, compare recommendation cards, recover from errors and confirm protected-action review. Task 003 has no runtime server or business journey, so its acceptance path is Storybook: open each Product story, tab through controls/navigation at desktop and mobile widths, and verify fixture warning remains visible.
