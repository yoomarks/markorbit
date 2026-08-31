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

## #372 Content Studio work reads

Content Studio uses the existing `contentOpportunityId` as stable Workspace work identity, with
its current Opportunity version. It does not persist a Studio lifecycle or require a current
Content Pick, Daily Orbit item or subject user's preferences. The accepted #364 Supervisor decision
and #372 govern this backend-only change; Gateway exposure belongs to #373 and Web UI is separate.

- `GET /v1/content-studio/works?limit=20&after=content-opportunity_...`: select the latest version
  per Opportunity identity, then include only `ACCEPTED_FOR_PREPARATION`. `limit` is 1–50 (default
  20); `after` is an exclusive Opportunity ID. Items use ascending PostgreSQL `C`-collation ID order.
  `nextAfter` is the last returned ID when another page exists, otherwise `null`. Each request has
  a consistent snapshot; pagination is not a frozen multi-request snapshot of concurrently changing work.
- `GET /v1/content-studio/works/:contentOpportunityId`: read the current Workspace-visible
  Opportunity, including its actual non-active status if it has since been rejected/deferred.
  Only Draft lineage associated with that exact current Opportunity version is returned.
- Both routes reuse trusted internal Workspace Principal authentication and `workspace:read`.
  No subject identity, mutation permission, CSRF or idempotency key is used by these internal GETs.
  Unsupported query parameters are rejected; reads cannot request a historical Opportunity version.

`ContentStudioWorkList` and `ContentStudioWorkDetail` are Lite-local transport projections of
existing shared domain types. List summaries contain the exact Opportunity reference, title,
rationale, sources and Opportunity timestamps. `latestDraft` selects the newest `updatedAt` among
each Draft identity's latest version, breaking ties by ascending Draft ID. `latestDraftReview`
is either the actual decision for that exact Draft version or `null`; Draft status is never used
to invent a decision. `latestPublishPackage` is the last Package by creation time, ID and version;
it retains its exact Draft/Review references and may cover an older Draft. `latestPackageFeedback`
belongs only to that exact Package. Missing optional records are `null`, not a synthesized stage.

Detail returns `opportunity`, `drafts` (latest per identity), `reviewedDrafts` (the exact historical
versions covered by decisions), `reviews`, `publishPackages` and `feedback`. Drafts are ordered by
ID/version; decisions, Packages and feedback by their owner timestamp, ID and version. Review
fingerprints must match the exact Draft; Packages must match both Draft and approving decision;
feedback must match the exact Package and stored expected fingerprint. Workspace, relational
identity and document lineage are checked before returning any records.

The whole page/detail uses a `READ ONLY`, `REPEATABLE READ` transaction and batch queries over
existing Lite tables. Unknown or another Workspace's work returns 404. Invalid inputs are governed
400/422 errors; permission denial is 403; persistence failures and malformed stored lineage are
503, never an empty list or absent Draft/Review fallback. No domain events or state transitions
are emitted by these reads.

Historical Visual discovery remains explicitly unavailable: both responses carry `partial: true`
and `warnings: ["VISUAL_HISTORY_NOT_DISCOVERABLE"]`. They do not return incomplete current-Kit
Visual references as history. This does not block the non-media lifecycle. No provider/model,
QC, paid execution or publication authority is introduced. Drafts retain `humanReviewRequired=true`
and `published=false`; Packages retain `externalPublishExecuted=false`; feedback remains a user's
after-the-fact report, never independently verified publication or use.

Focused verification (isolated PostgreSQL database, existing migrations only):

```sh
LITE_CONTENT_STUDIO_TEST_DATABASE_URL=postgresql://... LITE_CONTENT_STUDIO_POSTGRES_TEST_REQUIRED=1 pnpm --filter @markorbit/lite-service exec vitest run --no-file-parallelism tests/content-studio.test.ts tests/content-studio-postgres.test.ts
pnpm --filter @markorbit/lite-service test
pnpm --filter @markorbit/lite-service lint
pnpm --filter @markorbit/lite-service typecheck
pnpm --filter @markorbit/lite-service build
pnpm validate:persistence-boundaries
pnpm validate:workspace
node --test scripts/ci-detect-scope.test.mjs
pnpm format:check
git diff --check
```

The PostgreSQL suite exercises the actual `src/main.ts` HTTP runtime and removes an original
Daily Signal after proving its Orbit/Pick existed, then verifies stable list/detail for another
Workspace member. It also covers version dedupe, pagination, isolation, exact historical lineage,
malformed records and unchanged lifecycle row counts. No Gateway or UI implementation is included.

Authenticated Trademark Asset Commerce runtime:

- `GET /v1/trademark-assets/:trademarkAssetId` includes the workspace-owned `commerceProfile` (or `null` before creation), after checking Asset visibility.
- `POST /v1/trademark-assets/:trademarkAssetId/commerce-profile` accepts the existing `UpsertTrademarkAssetCommerceProfileInput` fields except `workspaceId`, `trademarkAssetId` and `idempotencyKey`: Workspace identity comes from the trusted Workspace Principal, the Asset ID from the route, and idempotency from the `Idempotency-Key` header. Body identity/actor/authority fields are rejected.
- Reading requires `workspace:read`; writing additionally requires `matter:manage`, following existing Lite mutation permissions. `OWNED`, `MANAGED` and `REPRESENTED` relationships remain editable; Marketplace-only references remain read-only.
- Creates omit `expectedCommerceProfileVersion`; updates supply its current value. Both require the exact `expectedTrademarkAssetVersion`. Domain conflicts return 409; invisible Assets return 404. Writes replace optional sale context, so omitted optional fields clear to their existing store defaults; `null` is rejected.
- The existing PostgreSQL Commerce store and Lite-owned migration `0056` are reused. Commerce changes emit no external action or Marketplace transaction and preserve `marketplaceListingCreatedByLite = false` and `sourceTrademarkFactsMutatedByLite = false`.

Focused verification (set `LITE_TRADEMARK_ASSET_TEST_DATABASE_URL` to an isolated test database and `LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED=1`): `pnpm --filter @markorbit/lite-service exec vitest run --no-file-parallelism tests/trademark-asset-commerce-http.test.ts tests/trademark-asset-commerce-postgres.test.ts`. The PostgreSQL suite starts the actual `src/main.ts` runtime and exercises authenticated HTTP against durable state.
