# @markorbit/lite-service

Lite Product-owned server-side state. Product Loop Closure keeps Recommendation, bounded Content preparation, Opportunity Candidate and explicit Qualification state here until repeated cross-Product use justifies extraction.

Current durable boundaries:

- PLC-WP-02 — Recommendation -> Content Opportunity -> bounded Content Draft -> Human Review -> prepared PublishPackage;
- PLC-WP-03 — exact Product signal -> Opportunity Candidate -> explicit human Qualification -> disposed Candidate state.

Formal Trademark Service Opportunity remains MarkReg-owned and is not created by the Lite service. Qualification only prepares the boundary for the later MarkReg owner mutation.

This service does not own identity, Knowledge ingestion, MarkReg formal work, Execution protected actions, customer truth, external publication/outreach, or universal Artifact/Opportunity/Workplace services.

Authenticated Opportunity Candidate Review reads (#365):

- All three GET routes require trusted internal authorization, a Workspace Principal with `workspace:read`, and a matching `x-markorbit-workspace-id`. Workspace scope comes from that Principal, never from query parameters. Gateway exposure is a separate integration task (#366).
- `GET /v1/opportunity-candidates?limit=50&cursor=...` returns `{ items: OpportunityCandidate[], nextCursor: OpportunityCandidateId | null }`. `limit` defaults to 50 and must be an integer from 1 to 100. Each identity appears only at its latest version. Ordering is Candidate ID ascending; the cursor is the last returned ID, passed back URL-encoded, with a maximum length of 300 characters. Version/qualification updates do not change identity order. Pages are live reads, not a frozen snapshot: new identities before the cursor require restarting the list. `nextCursor: null` means no further page at read time.
- `GET /v1/opportunity-candidates/:opportunityCandidateId` returns the latest durable `OpportunityCandidate` unchanged.
- `GET /v1/opportunity-candidates/:opportunityCandidateId/qualification` returns the durable `OpportunityQualificationDecision` unchanged, or HTTP 200 with JSON `null` for a visible Candidate without a decision. `REJECTED` and `DEFERRED` are real decisions, never absence. The decision's `candidate.version` and `expectedCandidateFingerprintSha256` identify the reviewed version, not the current dispositioned Candidate version.
- Unknown and other-Workspace Candidates receive the same HTTP 404 `OPPORTUNITY_CANDIDATE_NOT_FOUND` on both detail routes. Invalid pagination returns 422 `INVALID_INPUT`; persistence failures return retryable 503 `PERSISTENCE_UNAVAILABLE`, never an empty page or `null` fallback.
- These reads reuse existing Lite tables and emit no events or mutations. Candidate is not confirmed demand; Qualification is not customer instruction. `customerId`, when present, is only an opaque stored reference, not proof of a currently valid relationship. Source references retain their recorded provenance and observed timestamps; reading them does not revalidate current source freshness. The stored `customerContacted: false` and `formalOpportunityCreated: false` describe Candidate/Qualification consequences, not activity in other systems. Reads never contact customers, create Formal Opportunities, or prepare/confirm actions. No customer profile, confidence, or inferred Asset/Intake/Matter association is added.

Focused verification: set `LITE_CANDIDATE_TEST_DATABASE_URL` to an isolated test database and `LITE_CANDIDATE_POSTGRES_TEST_REQUIRED=1`, then run `pnpm --filter @markorbit/lite-service exec vitest run --no-file-parallelism tests/opportunity-candidate-http.test.ts tests/candidate-qualification-postgres.test.ts`. The PostgreSQL suite uses existing owner migrations, starts `src/main.ts` with a read-only database connection, and checks authenticated reads, exact qualification binding, isolation, bounded pagination, unchanged durable state, and real database failures.

Authenticated Trademark Asset Commerce runtime:

- `GET /v1/trademark-assets/:trademarkAssetId` includes the workspace-owned `commerceProfile` (or `null` before creation), after checking Asset visibility.
- `POST /v1/trademark-assets/:trademarkAssetId/commerce-profile` accepts the existing `UpsertTrademarkAssetCommerceProfileInput` fields except `workspaceId`, `trademarkAssetId` and `idempotencyKey`: Workspace identity comes from the trusted Workspace Principal, the Asset ID from the route, and idempotency from the `Idempotency-Key` header. Body identity/actor/authority fields are rejected.
- Reading requires `workspace:read`; writing additionally requires `matter:manage`, following existing Lite mutation permissions. `OWNED`, `MANAGED` and `REPRESENTED` relationships remain editable; Marketplace-only references remain read-only.
- Creates omit `expectedCommerceProfileVersion`; updates supply its current value. Both require the exact `expectedTrademarkAssetVersion`. Domain conflicts return 409; invisible Assets return 404. Writes replace optional sale context, so omitted optional fields clear to their existing store defaults; `null` is rejected.
- The existing PostgreSQL Commerce store and Lite-owned migration `0056` are reused. Commerce changes emit no external action or Marketplace transaction and preserve `marketplaceListingCreatedByLite = false` and `sourceTrademarkFactsMutatedByLite = false`.

Focused verification (set `LITE_TRADEMARK_ASSET_TEST_DATABASE_URL` to an isolated test database and `LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED=1`): `pnpm --filter @markorbit/lite-service exec vitest run --no-file-parallelism tests/trademark-asset-commerce-http.test.ts tests/trademark-asset-commerce-postgres.test.ts`. The PostgreSQL suite starts the actual `src/main.ts` runtime and exercises authenticated HTTP against durable state.
