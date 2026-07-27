# Component Inventory

- Actions: Button and IconButton.
- Forms: TextInput, TextArea, Select, Checkbox, and RadioGroup; all labels are programmatically associated and errors use `aria-describedby`.
- Status: Badge, StatusBadge, Alert, FixtureBanner, AssumptionList, and LimitationNotice.
- Structure: Card, PageHeader, SectionHeader, Tabs, Stepper, DataList, and KeyValueList.
- States: EmptyState, ErrorState, LoadingState, and Skeleton.
- Recommendation: RecommendationCard presents option code, rationale, assumptions, limitations, selection, recommendation, and fixture status.
- Shell: AppShell, SideNavigation, and TopBar are presentation primitives. Product apps retain navigation meaning and workflow.

All accept composition or `className` where relevant. Stories cover core defaults, focus/hover, disabled, error, empty, long content, and small screens.
