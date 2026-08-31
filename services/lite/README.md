# @markorbit/lite-service

Lite Product-owned server-side state. Product Loop Closure keeps Recommendation, bounded Content preparation, Opportunity Candidate and explicit Qualification state here until repeated cross-Product use justifies extraction.

Current durable boundaries:

- PLC-WP-02 — Recommendation -> Content Opportunity -> bounded Content Draft -> Human Review -> prepared PublishPackage;
- PLC-WP-03 — exact Product signal -> Opportunity Candidate -> explicit human Qualification -> disposed Candidate state.

Formal Trademark Service Opportunity remains MarkReg-owned and is not created by the Lite service. Qualification only prepares the boundary for the later MarkReg owner mutation.

This service does not own identity, Knowledge ingestion, MarkReg formal work, Execution protected actions, customer truth, external publication/outreach, or universal Artifact/Opportunity/Workplace services.

Authenticated Trademark Asset Commerce runtime:

- `GET /v1/trademark-assets/:trademarkAssetId` includes the workspace-owned `commerceProfile` (or `null` before creation), after checking Asset visibility.
- `POST /v1/trademark-assets/:trademarkAssetId/commerce-profile` accepts the existing `UpsertTrademarkAssetCommerceProfileInput` fields except `workspaceId`, `trademarkAssetId` and `idempotencyKey`: Workspace identity comes from the trusted Workspace Principal, the Asset ID from the route, and idempotency from the `Idempotency-Key` header. Body identity/actor/authority fields are rejected.
- Reading requires `workspace:read`; writing additionally requires `matter:manage`, following existing Lite mutation permissions. `OWNED`, `MANAGED` and `REPRESENTED` relationships remain editable; Marketplace-only references remain read-only.
- Creates omit `expectedCommerceProfileVersion`; updates supply its current value. Both require the exact `expectedTrademarkAssetVersion`. Domain conflicts return 409; invisible Assets return 404. Writes replace optional sale context, so omitted optional fields clear to their existing store defaults; `null` is rejected.
- The existing PostgreSQL Commerce store and Lite-owned migration `0056` are reused. Commerce changes emit no external action or Marketplace transaction and preserve `marketplaceListingCreatedByLite = false` and `sourceTrademarkFactsMutatedByLite = false`.

Focused verification (set `LITE_TRADEMARK_ASSET_TEST_DATABASE_URL` to an isolated test database and `LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED=1`): `pnpm --filter @markorbit/lite-service exec vitest run --no-file-parallelism tests/trademark-asset-commerce-http.test.ts tests/trademark-asset-commerce-postgres.test.ts`. The PostgreSQL suite starts the actual `src/main.ts` runtime and exercises authenticated HTTP against durable state.
