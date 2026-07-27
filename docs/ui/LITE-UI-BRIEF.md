# MarkOrbit Lite UI Brief

**Users/job:** trademark agents, IP and brand-service professionals, and small professional teams need to prioritize multi-customer work, evidence, opportunities, and governed next actions.

**IA:** fixed primary navigation is Today, Content, Opportunities, Trademarks, Work, Capability, Guide. Guide is workflow assistance, never generic chat. Today groups pending attention, opportunities, trademark status, work, and Capability suggestions.

**Behavior:** desktop uses a persistent rail and dense three-column summaries; mobile stacks summaries and provides scrollable navigation without losing labels. Initial/loading/empty/partial/ready/stale/warning/recoverable and blocking error/offline/unauthorized/forbidden/not-found follow the shared model. Permission and stale states prevent protected actions. Fixture content remains visibly marked.

**Accessibility/acceptance:** landmarks, current-page semantics, headings, visible focus, text status, reduced motion, and responsive reflow. Fixture-backed Storybook covers desktop and small screen. Playwright acceptance path for the next journey task: open Today → traverse seven navigation items by keyboard → inspect pending attention → verify fixture warning; this foundation does not add Playwright infrastructure.
