# Operations Console UI Brief

**Users/job:** internal operations, data/system administrators, and compliance reviewers need rapid, accountable triage of health, failures, review queues, and events.

**IA:** an unmistakable Internal-only shell with Overview, Reviews, and Events. Overview summarizes service health, failed operations, manual review, and events. It does not expose direct database access or silently mutate owned service state.

**Behavior:** highest density of the three products; desktop favors scanning, while mobile stacks summaries without hiding severity text. Every shared state applies. Partial/stale/offline data shows timestamps and prevents unsafe action; forbidden views reveal no protected details; blocking errors provide trace/support references.

**Accessibility/acceptance:** landmark navigation, current-page state, headings, text/icon status, keyboard operation, and responsive reading order. Storybook provides fixture desktop/small-screen views. Future Playwright path: verify Internal-only marker → inspect unhealthy service → open manual-review queue; workflow implementation is out of scope.
