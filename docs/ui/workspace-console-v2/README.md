# Workspace Console V2 review preview

This is an isolated, fixture-only browser review surface for the V2 Decision Record. It has no
production route, external network call, payment control, persistence or owner mutation.

Run from `apps/workspace-console-v2-preview`:

```powershell
npm run start
```

Then open `http://127.0.0.1:4208`.

Review coverage:

- Simplified Chinese and English content for all surfaces and dialogs.
- Desktop and 390 px responsive layouts.
- Product comparison, purchasing subject and exact commercial state separation.
- Site purchase → entitlement → two Site instances → manager assignment → bill detail → Site Admin
  handoff feedback.
- Five financial lanes, transaction evidence and collecting-entity mismatch.
- Conversational guidance with structured confirmation and trusted-control boundary.
- Fixture disclaimer is persistent on payment-sensitive surfaces.

The review price and all entities/records use clearly labelled test fixtures. They are not product
catalog constants or claims about production scale.
