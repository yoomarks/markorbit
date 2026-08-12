# M7-WP-04 — Three-loop full-journey Beta real-runtime acceptance

- **Milestone:** `MO-MVP-MILESTONE-007`
- **Direction:** `BETA_RELEASE_READINESS_AND_OPERATIONAL_HARDENING`
- **Base:** `2fd372c3fc96f89a391833819e51d15a9a34d228` (M7-WP-03 / PR #97 merged)
- **Status:** `READY_FOR_OWNER_REVIEW`
- **Functional acceptance head:** `6f71c0da0caa2754068b72cd2adf61ebecde1ede`
- **Dedicated hosted evidence:** `M7 WP-04 Three-loop Full-journey Acceptance` run `31592835063` — PASS

## Objective

Close the Milestone 7 full-journey acceptance gap by composing existing owner runtimes into one Beta-level real-runtime gate. WP-04 does not create a new business domain, generic orchestration platform, autonomous workflow authority or cross-service persistence layer.

The gate proves the three README MVP loops with real owner PostgreSQL, real service HTTP boundaries where authority crosses owners, and critical desktop/mobile browser paths without business-route interception.

## Accepted three-loop graph

### Loop 1 — trusted Knowledge to reviewed Content

```text
Core accepted ReadyPackage
-> exact Workspace-scoped Core Product-loop source over internal HTTP
-> Lite Today Recommendation
-> Content Opportunity
-> bounded Content Draft
-> explicit Human Review
-> prepared PublishPackage
-> user-reported, unverified Product-loop feedback
```

The PublishPackage remains prepared content only. WP-04 does not publish externally, verify the reported external use or grant publication authority.

### Loop 2 — Product feedback to qualified MarkReg handoff

```text
Lite Product-loop feedback
-> Opportunity Candidate
-> explicit QUALIFIED_FOR_MARKREG decision
-> exact Lite qualification authority over internal HTTP
-> MarkReg Formal Trademark Service Opportunity
-> explicit confirmed Intake handoff envelope
```

The path intentionally stops before automatic Intake, Order, Matter, Payment, Invoice or Filing creation. Formal Opportunity remains distinct from Intake and all downstream commercial/legal state.

### Loop 3 — governed work to evidence, outcome and reflection surfaces

```text
governed Order / Matter path
-> governed provider execution
-> Provider Return
-> Execution evidence receipt
-> explicit Evidence Review Decision
-> reviewed-source handoff
-> MarkReg Lifecycle Projection / outcome surface
-> private Capability reflection surface
```

WP-04 composes the already-governed M4, M5 and M6 runtime paths rather than duplicating them. Provider Return remains provider evidence, Evidence Review Decision remains internal governed truth rather than Official Truth, Lifecycle Projection remains an internal projection, and private reflection does not verify Capability.

## Root-cause boundary repair

The pre-WP-04 Product-loop browser runtime could synthesize accepted Core Knowledge provenance in-process for acceptance. That was insufficient for the Milestone 7 requirement that owner authority cross real service boundaries.

WP-04 adds one minimal read-only Core internal endpoint:

```text
GET /internal/knowledge/ready-packages/:readyPackageId/product-loop-source
```

The endpoint:

- requires trusted internal service authorization;
- requires an exact Core Workspace context;
- returns only an `ACCEPTED` ReadyPackage intake for that Workspace;
- returns exact source identity, stable source version, request SHA-256 and observation timestamp;
- returns `404` for pending/nonexistent/cross-Workspace sources;
- performs no downstream mutation and creates no new authority.

The Postgres repository lookup is Core-local. Lite consumes the source through HTTP; there is no Lite-to-Core SQL. MarkReg similarly consumes qualified Lite Candidate evidence through the existing `HttpQualifiedOpportunityAuthority` boundary; there is no MarkReg-to-Lite SQL.

## Owner database topology

The permanent WP-04 gate provisions distinct PostgreSQL databases for the acceptance graph, including:

- Core / Lite / MarkReg Product-and-Opportunity path;
- Product-loop browser runtime;
- Order/Matter browser runtime;
- M4 Core / Execution / MGSN provider-return path;
- M5 Core / Execution / MarkReg evidence-lifecycle path;
- Capability Center / Execution reflection browser path.

All service migrations and writes remain inside their owning database. No cross-service SQL is admitted.

## Browser acceptance

The dedicated gate runs the critical real-runtime Playwright paths for:

- Product loop — desktop and 390px mobile;
- Order / Matter — desktop and 390px mobile;
- Capability reflection — desktop and 390px mobile.

The Product-loop and Order/Matter no-interception validators run before browser acceptance. The repository-wide Playwright suite-boundary guard also proves generic mocked/intercepted suites do not replace the required real-runtime acceptance.

The reused real-runtime suites cover direct URL/reload recovery and authenticated Workspace-scoped behavior already frozen by their owner milestones; WP-04 composes those accepted surfaces into the single Beta gate rather than reimplementing them.

## Hosted verification on functional acceptance head

Run `31592835063` on `6f71c0da0caa2754068b72cd2adf61ebecde1ede` passed every dedicated step:

1. exact-head checkout;
2. owner-separated PostgreSQL creation;
3. Workspace / persistence ownership / formatting checks;
4. full Beta runtime build;
5. affected owner graph typecheck;
6. Core accepted Knowledge provenance boundary tests;
7. Loop 1+2 Core -> Lite -> MarkReg real-runtime integration;
8. Order no-interception guard;
9. M4 provider-return real-runtime integration;
10. M5 evidence-lifecycle real-runtime integration;
11. Product-loop no-interception guard;
12. Product-loop desktop + 390px mobile browser acceptance;
13. Order/Matter desktop + 390px mobile browser acceptance;
14. Capability reflection desktop + 390px mobile browser acceptance;
15. generic Playwright boundary guard;
16. exact-head machine-readable acceptance evidence emission.

Final repository-wide exact-head workflow evidence is recorded in PR #98 after the documentation-only status reconciliation, so recording that evidence does not recursively mutate the tested head.

## Integration defects found and repaired

During WP-04 the gate exposed three bounded harness/integration issues:

1. the Product-loop acceptance path lacked a real Core-owned accepted Knowledge source boundary; this was fixed with the read-only Workspace-scoped Core HTTP endpoint;
2. the new root integration initially mixed source-relative and workspace-package copies of `service-kit`, which caused an `instanceof HttpError` harness artifact; the root test now uses one source module graph rather than weakening production error semantics;
3. the combined gate initially omitted the root workspace-package links already required by the standalone M5 integration workflow; WP-04 now mirrors the proven M5 harness setup instead of changing M5 runtime code.

No production authority was broadened to make tests pass.

## Permanent authority locks

```text
Recommendation != authorization
Prepared Action != executed action
PublishPackage != Published
user-reported use != independently verified external outcome
Opportunity Candidate != Formal Opportunity
Qualification Decision != automatic downstream mutation
Formal Opportunity != Intake
Intake != Order != Matter != Filing
Provider Return != Official Truth
Evidence Review Decision != Official Truth
reviewed-source admission != Filing Submission
Lifecycle Projection != Official Status
Reflection Candidate != canonical truth
accepted private reflection != verified Capability
Green CI != Owner Release Authorization
```

WP-04 introduces no Payment/Invoice, legal appointment, external publication, Filing Submission, Official Truth, Capability verification, Capability Canon mutation, production deployment or Beta release.

## Next

Only after explicit Owner merge of PR #98:

`M7-WP-05 — Deployment rehearsal, migration and rollback/recovery evidence`.
