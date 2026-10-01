# Super Admin V2.3 — Real Read-only Integration

## Bounded first batch

### User and job

An authenticated Internal Operator needs to determine whether the Data Engine and Knowledge owner projections are available, current enough to inspect, and reporting attention states without opening a second administration product or mistaking missing data for health.

### Owner truth and routes

| Surface                   | Durable owner         | Gateway route                                                      | Required authority             | Browser context                                                                      |
| ------------------------- | --------------------- | ------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------ |
| Data summary              | MarkOrbit Data Engine | `GET /api/internal/control-plane/data/summary`                     | `control-plane:data:read`      | HttpOnly operator session                                                            |
| Knowledge evidence supply | Knowledge             | `GET /api/internal/control-plane/knowledge/evidence-supply-health` | `control-plane:knowledge:read` | HttpOnly operator session plus `X-MarkOrbit-Workspace-Id`; Core validates membership |

The browser never receives a Data Engine API key, internal service secret, or owner principal. Gateway resolves the exact Internal Operator capability and performs the downstream owner read. The UI reuses the existing Operations Console parsers and response models; it does not create a second API contract.

### Information architecture

- `?mode=demo` or an omitted mode keeps the existing fixture-backed review experience.
- `?mode=real` enters a visibly read-only workflow and removes Demo review controls and fixture workspaces.
- Platform Overview reads Data and Knowledge independently. Each owner card retains its own availability, provenance and update time and links to the matching real module overview.
- Data Overview shows only the bounded Data owner summary, source owner, contract/authority, generated time, owner health and aggregate counts.
- Knowledge Overview shows only the workspace-scoped Evidence Supply Health projection, source read model, observed time, explicit owner freshness/coverage states and target observations.
- The remaining 87 Real-mode routes show “暂未接入” and the expected owner boundary. They never fall back to Demo records.

### State matrix

| State             | Meaning                                                      | UI behavior                                                |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Loading           | Gateway request is pending                                   | Keep the owner isolated and announce loading               |
| Success           | Valid owner contract returned                                | Show read-only data with owner and observed/generated time |
| Empty             | Valid response contains no owner items                       | Show successful empty state, never a failure fallback      |
| 401               | Missing or expired Internal Operator session                 | Authentication-required state; no object data              |
| 403               | Exact capability or Workspace membership denied              | Permission state; no object data                           |
| Timeout           | Browser read deadline or typed timeout failure               | Timeout state with retry, distinct from empty              |
| Owner unavailable | Gateway/upstream 5xx or transport failure                    | Unavailable state with retry; sibling owner remains usable |
| Contract mismatch | Successful response fails the existing parser                | Untrusted-response state; no partial rendering             |
| Stale             | Knowledge owner explicitly reports `STALE`                   | Preserve stale state and observed timestamps               |
| Partial/degraded  | Owner explicitly reports partial coverage or degraded health | Preserve available facts and label missing/degraded scope  |

No Control Center freshness SLA is invented for the Data summary. Its `generated_at` value is shown as owner-provided currentness evidence, and the absence of a freshness classification is stated explicitly.

### Desktop and mobile behavior

Desktop presents the two owner cards side by side on Platform Overview and uses a compact provenance strip above owner-specific facts. Mobile stacks Data and Knowledge independently, keeps the Real/read-only label before content, and places retry or navigation directly within the affected owner card. Failure in one owner must not move or suppress the other owner’s usable result.

### Non-goals

- No production mutation, approval, retry, repair or owner command.
- No generic Admin Proxy, iframe, downstream secret, database read or copied business truth.
- No replacement of `/` and no expansion of Internal Operator capabilities.
- No claim that Data owner health is aggregate MarkOrbit platform health.

## Implemented acceptance evidence

The first read-only batch is available at these independent preview routes:

- `/super-admin-v2/overview/platform?mode=real`
- `/super-admin-v2/data/overview?mode=real`
- `/super-admin-v2/knowledge/overview?mode=real`

Knowledge reads require the authenticated operator's active Workspace context. A missing context is rendered as a distinct precondition state and does not issue an unscoped owner request. Unconnected Real routes issue no owner request and render `暂未接入`; switching back to Demo restores the fixture-backed review workflow.

The browser acceptance suite intercepts the two exact Gateway routes to deterministically prove normal, 401, 403, timeout, unavailable, stale, partial and valid-empty rendering. Those intercepted responses are UI state evidence, not a claim of a live production connection. The focused Gateway suites provide the actual boundary evidence: 15 tests verify HttpOnly session resolution, exact capability checks, Knowledge Workspace membership, owner-principal signing, downstream Data credentials and the absence of a generic control-plane proxy.

Screenshots produced by the acceptance path:

- `playwright-screenshots/super-admin-v23-real-platform-desktop.png`
- `playwright-screenshots/super-admin-v23-real-platform-mobile.png`
- `playwright-screenshots/super-admin-v23-real-data-desktop.png`
- `playwright-screenshots/super-admin-v23-real-data-mobile.png`
- `playwright-screenshots/super-admin-v23-real-knowledge-desktop.png`
- `playwright-screenshots/super-admin-v23-real-knowledge-mobile.png`

On a local preview without a valid Internal Operator session, Real mode is expected to show the matching authentication or availability state. It never substitutes Demo fixtures.

## Next read-only expansion order

1. Data Engine: extend from the connected owner summary to source coverage, data packages, query and storage only where an existing owner projection and exact Gateway contract already exist. Jobs and settings remain unavailable until a safe read contract is present.
2. Knowledge: extend from Evidence Supply Health to sources, plans, runs, Workers, raw artifacts, transforms, evidence, search and Ready Packages one owner projection at a time, preserving Workspace membership and provenance.
3. For both owners, keep each unsupported page explicit rather than inferring records from another projection or copying owner truth into the Operations Console.
