# Component Inventory

## Shared primitives (`packages/ui`)

| Family         | Components                                                    | Contract                                                                                       |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Actions        | Button, IconButton                                            | Native buttons, focusable, disabled semantics, visible label or accessible name                |
| Forms          | TextInput, TextArea, Select, Checkbox, RadioGroup             | Persistent label; hint/error association; native keyboard behavior                             |
| Status         | Badge, StatusBadge, Alert, FixtureBanner                      | Text/icon plus color; fixture warning is prominent and non-dismissable                         |
| Structure      | Card, PageHeader, SectionHeader, Tabs, DataList, KeyValueList | Semantic headings, lists and tab roles                                                         |
| States         | EmptyState, ErrorState, LoadingState, Skeleton                | Named recovery/action; loading is announced without noisy skeletons                            |
| Journey        | Stepper                                                       | Ordered progress and `aria-current=step`                                                       |
| Recommendation | RecommendationCard, AssumptionList, LimitationNotice          | Option code, rationale, assumptions, limitations, selection, recommendation and fixture status |
| Shell          | AppShell, SideNavigation, TopBar                              | Named navigation landmark and main content; internal variant is explicit                       |

Every component is strict TypeScript, backend-free and supports `className` where extension is relevant. Product-owned cards and flows remain in each app.

## Story matrix

Storybook contains actions (default/hover target/focus/disabled), form default/error, status tones, alerts, empty/error/loading, stepper, A/B/C long-text recommendations, fixture warning, all three fixture shells and mobile-width variants. Empty content is exercised by `DataList` and state stories. Automated a11y parameters run in preview; unit tests cover semantic contracts.

## Deferred inventory

Dialog, toast, table/grid, date and currency input, file upload, pagination, command menu and notification patterns require a real workflow task. They must not be invented in this foundation.
