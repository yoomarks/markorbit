# MO MVP Milestone 2 integration audit

- **Task:** TASK 027 — Milestone 2 integration audit
- **Audit date:** 2026-08-08
- **Audited merged baseline:** `5badc2ea7e2c074357bef48b268f5359c8f9878f`
- **Audited implementation tree:** `4e1a01e770cae99c34161f626c963432551f44f4`
- **TASK 026 exact-head evidence commit:** `aba2803137b5e08327e9240a009e8e794367c2b3`
- **TASK 026 PR:** #37, merged
- **Audit recommendation:** **GO**
- **Freeze / tag / merge action:** **NOT PERFORMED** — owner action remains explicit

## 1. Executive conclusion

Milestone 2 is recommended **GO** for its approved scope: Durable Authenticated Matter Operations.

The merged `main` commit and the final TASK 026 PR head have the same Git tree (`4e1a01e770cae99c34161f626c963432551f44f4`). Therefore the successful hosted CI evidence recorded against `aba2803` validates the exact repository contents merged as `5badc2e`; the SHA difference is merge metadata, not a content difference.

All three hosted workflow families completed successfully on the exact implementation tree:

| Workflow | Run | Result | Relevant jobs |
| --- | ---: | --- | --- |
| `validation` | `31231437103` | PASS | `persistence`, `validate`, `professional-review-browser` |
| `Milestone 2 reliability` | `31231437099` | PASS | `reliability` |
| `Browser and Visual Validation` | `31231437102` | PASS | `chromium`, `Milestone Real Runtime Validation` |

The reliability job used PostgreSQL 16 and a database-per-owner topology, installed Chromium, ran the ordered executable reliability matrix, and completed the final workspace check. The browser workflow separately passed both the focused Chromium acceptance job and the full Milestone Real Runtime Validation job.

No release blocker was found in the approved Milestone 2 boundary. The audit found two documentation-evidence drifts: the TASK 026 reliability matrix files still describe hosted evidence as pending, and the implementation traceability summary still says TASK 026 was not started. Those records are stale relative to the merged code and hosted Actions evidence. They do not change runtime truth; this TASK 027 audit records the authoritative final evidence, and the planning traceability/index are updated by this audit branch.

## 2. Audit scope

This audit evaluates the exact merged Milestone 2 implementation against:

- `docs/planning/MO-MVP-MILESTONE-002-SCOPE-LOCK.md`;
- `docs/planning/MO-MVP-MILESTONE-002-DELIVERY-PLAN.md`;
- `docs/planning/MO-MVP-MILESTONE-002-IMPLEMENTATION-TRACEABILITY.md`;
- `docs/tasks/MO-MVP-TASK-026-RESTART-MIGRATION-TENANT-MATRIX.md`;
- production migrations `0018` through `0025`;
- Core, MarkReg, Execution and Gateway ownership boundaries;
- executable persistence, HTTP, restart, outage, concurrency, tenant-isolation and browser suites;
- the explicit no-authority-consequence boundary.

TASK 027 is an audit task. It does not add product behavior, change a contract, add a migration, weaken a test, freeze a milestone, create a release tag or merge itself.

## 3. Approved Milestone 2 outcome

The approved Milestone 2 outcome is an authenticated, authorized Workspace member creating durable governed matter truth from exact-version source evidence, with persistence across restart and fail-closed Workspace isolation.

The audited path is:

1. Core resolves authenticated Session and Workspace Membership into Principal context.
2. MarkReg stores Customer Confirmation and Matter Draft evidence.
3. MarkReg creates Formal Matter from exact-version governed source truth.
4. Formal Matter stores immutable source lineage/snapshot and command/audit evidence.
5. Lite exposes the Workspace-scoped Matter projection without becoming semantic owner.
6. Execution owns Professional Review evidence and terminal review decisions.
7. MarkReg owns Document Package and Instruction Ledger truth.
8. Browser recovery, direct URL, refresh and Workspace-switch behavior operate through real service runtimes.

The milestone does **not** authorize or represent an external filing, payment, provider appointment, official application or office contact.

## 4. Content identity of merged main and tested head

The final TASK 026 PR head `aba2803137b5e08327e9240a009e8e794367c2b3` has tree:

`4e1a01e770cae99c34161f626c963432551f44f4`

The merged `main` commit `5badc2ea7e2c074357bef48b268f5359c8f9878f` has the same tree:

`4e1a01e770cae99c34161f626c963432551f44f4`

Audit finding: **PASS — exact content identity established.**

This matters because PR-triggered Actions are attached to the PR head SHA while GitHub's merge operation created a different commit SHA. Tree identity proves that the successful hosted suites exercised the exact contents now on `main`.

## 5. Hosted gate evidence

### 5.1 Validation workflow

Run `31231437103` completed successfully.

The `persistence` job passed the durable boundary suites, including:

- migration/bootstrap/status/verification;
- persistence boundary tests;
- repeated Core identity/auth PostgreSQL execution;
- Core auth service and HTTP behavior;
- Customer Confirmation PostgreSQL/repeated/HTTP execution;
- Formal Matter PostgreSQL/repeated/HTTP execution;
- Professional Review PostgreSQL/repeated/HTTP execution;
- Document Package PostgreSQL/repeated/HTTP execution;
- durable audit/idempotency PostgreSQL/repeated/HTTP/restart execution;
- Gateway route inventory.

The `validate` job passed the repository validation command.

The `professional-review-browser` job passed:

- Professional Review browser acceptance;
- Document Package desktop acceptance;
- Document Package 390px mobile acceptance;
- full Document Package real runtime;
- no-interception validation;
- Playwright suite-boundary validation.

Audit finding: **PASS.**

### 5.2 Milestone 2 reliability workflow

Run `31231437099`, job `93035915375` (`reliability`), completed successfully.

The hosted job explicitly completed:

1. PostgreSQL container initialization;
2. owner database topology creation;
3. Chromium installation;
4. ordered executable reliability matrix;
5. final workspace check.

The reliability aggregate is fail-fast (`&&`), so a successful aggregate means each preceding named reliability group returned success.

Required groups represented by TASK 026 are:

- `test:milestone2:migrations`;
- `test:milestone2:restart`;
- `test:milestone2:outage`;
- `test:milestone2:concurrency`;
- `test:milestone2:tenant-isolation`;
- `test:milestone2:markreg-repeatability`;
- dedicated browser acceptance;
- evidence validation.

Audit finding: **PASS.**

### 5.3 Browser and Visual Validation workflow

Run `31231437102` completed successfully.

Job `93035938626` (`chromium`) passed:

- product builds;
- browser and visual validation;
- focused Formal Matter desktop/mobile acceptance;
- real authenticated Lite Matter desktop/mobile acceptance;
- focused visual evidence generation.

Job `93035938647` (`Milestone Real Runtime Validation`) passed:

- workspace validation;
- format check;
- lint;
- typecheck;
- runtime tests;
- Storybook state-matrix tests;
- Gateway inventory;
- negative-path matrix;
- full tests;
- builds;
- Storybook matrix build/index validation;
- repository `check`;
- Playwright E2E;
- real-runtime E2E;
- visual tests;
- generated-artifact tracking guard.

Audit finding: **PASS.**

## 6. Reliability acceptance matrix

| Acceptance dimension | Evidence | Result |
| --- | --- | --- |
| Empty database migration | dedicated migration integration suite under PostgreSQL 16 | PASS |
| Prior-state migration | migration replay/reconstruction coverage | PASS |
| Owner migration separation | Core / MarkReg / Execution owner DB topology | PASS |
| Core restart | actual listener/pool replacement and durable Session/Principal recovery | PASS |
| MarkReg restart | Formal Matter / Document Package durable HTTP recovery | PASS |
| Execution restart | Professional Review durable HTTP recovery | PASS |
| Startup outage | owner service startup failure and restored listener behavior | PASS |
| Runtime pool outage | Core / MarkReg / Execution outage paths through Gateway | PASS |
| Concurrent duplicate | deterministic idempotent replay / unique evidence | PASS |
| Conflicting replay | same key + changed fingerprint rejected | PASS |
| Stale version | optimistic stale update loses safely | PASS |
| Tenant isolation | cross-Workspace reads/mutations fail closed | PASS |
| Restart isolation | durable records remain scoped after runtime replacement | PASS |
| Repeatability | MarkReg groups execute repeated cycles with stable totals and zero skip guard | PASS |
| Desktop browser | dedicated real-runtime projects | PASS |
| Mobile browser | dedicated 390px / mobile real-runtime projects | PASS |
| Direct URL / refresh | dedicated browser recovery paths | PASS |
| Workspace switch | stale scoped state is cleared rather than leaked | PASS |
| Storybook state matrix | state-matrix tests/build/index validation | PASS |

## 7. Migration and ownership audit

### Core

Core remains semantic owner of:

- User;
- Workspace;
- Membership;
- Session;
- Principal derivation and canonical role/permission semantics.

Core durable identity/auth data is isolated to the Core owner database in the reliability topology.

Audit finding: **PASS — no audited MarkReg or Execution mutation takes ownership of Core identity truth.**

### MarkReg

MarkReg remains semantic owner of:

- Customer Confirmation;
- Matter Draft;
- Formal Matter and immutable source snapshot;
- Formal Matter command/idempotency evidence;
- MarkReg audit records within the authorized bounded remediation;
- Document Package;
- Document Package command evidence;
- document evidence items;
- Instruction Ledger.

Migration `0025_markreg_audit_hardening` remains MarkReg-owned and does not redefine Core or Execution ownership.

Audit finding: **PASS.**

### Execution

Execution remains semantic owner of Professional Review and its durable command/decision evidence. Existing filing-governance code does not convert the Milestone 2 Matter path into an external filing consequence.

Audit finding: **PASS.**

### Gateway

Gateway remains the authenticated transport/policy boundary rather than a semantic data owner. Workspace context is resolved through authenticated Principal semantics and owner services remain responsible for mutation.

Audit finding: **PASS.**

## 8. Tenant-isolation audit

The required security property is not merely hiding UI records. The owner repositories and authenticated Gateway boundary must fail closed across Workspace context.

TASK 026's tenant suite uses durable Core Sessions/Memberships and real owner listeners across the three owner databases. The successful reliability run therefore exercises isolation at runtime boundaries rather than only in an in-memory UI fixture.

The browser suites additionally cover Workspace-switch clearing so a browser cannot preserve stale detail state when the active Workspace changes.

Audit finding: **PASS — no release-blocking cross-Workspace enumeration or mutation path was found in the audited evidence.**

## 9. Exact-version, idempotency and concurrency audit

Formal Matter creation preserves the required source-version relationship and immutable snapshot lineage.

The repository contract and tests demonstrate:

- concurrent identical commands converge on one Formal Matter/evidence set;
- identical idempotent replay returns the same durable result;
- conflicting reuse of an idempotency key is rejected;
- a second command against an already consumed exact Draft version is rejected;
- stale optimistic mutations lose rather than overwrite newer truth.

Document Package and Professional Review suites add their own owner-specific replay/version guarantees.

Audit finding: **PASS.**

## 10. Restart and durability audit

The reliability matrix exercises replacement listeners and database-backed reload, not only an object re-instantiation inside one process.

Required durable truth survives restart for the audited boundary:

- Core Session / Principal evidence;
- Formal Matter and exact source lineage;
- Formal Matter command/audit evidence;
- Document Package and Instruction Ledger evidence;
- Professional Review state and terminal decision evidence.

The outage fixes merged in TASK 026 preserve owner pools during transient probes and use fresh health probes for replacement listeners, avoiding false recovery from stale keep-alive connections.

Audit finding: **PASS.**

## 11. Authority-consequence audit

Milestone 2 must stop at governed internal truth. The following 13 authority consequences are required to remain false for the audited path:

| Consequence | Required value | Audit result |
| --- | --- | --- |
| `orderCreated` | `false` | PASS |
| `paymentCreated` | `false` | PASS |
| `invoiceCreated` | `false` | PASS |
| `formalMatterCreated` as a consequence of filing authorization | `false` | PASS |
| `professionalAppointed` | `false` | PASS |
| `providerAssignedExternally` | `false` | PASS |
| `filingCreated` | `false` | PASS |
| `filingSubmitted` | `false` | PASS |
| `officialApplicationCreated` | `false` | PASS |
| `officialApplicationNumberReceived` | `false` | PASS |
| `customerMessageSent` | `false` | PASS |
| `externalDocumentSent` | `false` | PASS |
| `trademarkOfficeContacted` | `false` | PASS |

The Execution filing-governance tests explicitly preserve a no-authority consequence object through authorization/release preparation. Even when an internal filing execution task draft is prepared by that separate governed code path, it remains internal and the external consequences above remain false.

Milestone 2 therefore does not claim that a trademark application has been filed, paid, submitted, accepted or assigned externally.

Audit finding: **PASS.**

## 12. Browser / product-state audit

The real-runtime browser evidence is accepted because it uses dedicated Playwright projects and real service boundaries rather than request interception.

The final TASK 026 reliability repair also exercises authenticated Golden Path context using a real Core auth sidecar with seeded User, Workspace, Membership and Session evidence. Gateway authentication remains enabled; the harness supplies the browser Session/Workspace/CSRF context rather than bypassing authorization.

This closes the earlier mismatch where the old Golden Path harness predated the authenticated Milestone 2 Gateway boundary.

Audit finding: **PASS.**

## 13. Storybook and state coverage

The Milestone Real Runtime Validation job passed `test:story-matrix`, `build:storybook-matrix` and `test:storybook-index` on the exact implementation tree.

The browser and Storybook evidence are complementary:

- Storybook proves bounded state representation and build/index integrity;
- real runtime proves authenticated interaction, persistence, direct-route recovery and responsive acceptance.

Audit finding: **PASS.**

## 14. Evidence and documentation drift

Two stale records were found after PR #37 completed hosted CI:

1. `docs/validation/MO-MVP-MILESTONE-002-RELIABILITY-MATRIX.md` and its JSON companion still say hosted evidence is pending / not executed.
2. `docs/planning/MO-MVP-MILESTONE-002-IMPLEMENTATION-TRACEABILITY.md` still lists TASK 026 and TASK 027 as not started.

The first is an evidence-record drift, not a runtime failure. TASK 027 is restricted to audit/release/planning documentation, so this audit does not rewrite the TASK 026 validation artifact after the fact. Instead it records the actual successful hosted run IDs and exact-tree relationship here.

The planning traceability and Task Index are corrected in the TASK 027 documentation branch.

Audit classification: **NON-BLOCKING DOCUMENTATION DRIFT.**

## 15. Known non-goals and residual risks

The following are intentionally not release claims for Milestone 2:

- no durable cross-service outbox;
- no broker/queue delivery guarantee;
- no crash-recovery guarantee for process-local domain events;
- no Payment execution;
- no external Provider appointment;
- no external document dispatch;
- no trademark-office submission;
- no official application creation or application-number receipt;
- no automatic customer communication consequence;
- no guarantee that later filing/execution milestones are complete.

The absence of an outbox is not treated as a defect because the approved Milestone 2 scope does not promise reliable cross-service event delivery. Audit persistence is evidence of governed mutation; it is not a message-delivery guarantee.

## 16. Reproducibility statement

A reviewer can reproduce the release evidence from the merged tree with the repository-defined commands and CI topology rather than relying on this narrative alone.

The relevant aggregate commands are:

```bash
pnpm validate
pnpm test:milestone2:reliability
pnpm test:e2e
pnpm test:e2e:real-runtime
pnpm test:visual
```

PostgreSQL-dependent reliability execution requires the owner-specific databases and required-mode flags defined by `.github/workflows/milestone-2-reliability.yml`.

For hosted evidence, use the recorded Actions runs:

- validation: `31231437103`;
- Milestone 2 reliability: `31231437099`;
- Browser and Visual Validation: `31231437102`.

## 17. Final release decision

### Decision: GO

The audited implementation satisfies the approved Milestone 2 functional, durability, isolation, concurrency, browser and no-authority-consequence boundaries.

There is no identified implementation defect that requires reopening Milestone 2 before moving to the next planned milestone/task.

The recommendation is intentionally narrower than a production filing-system certification. It means the repository may proceed beyond Milestone 2 **within the frozen scope boundary**; it does not authorize external filing, payment, provider assignment or office contact behavior.

### Owner action still required

TASK 027 does **not** perform any of the following:

- merge this audit PR;
- freeze Milestone 2;
- create a Git tag;
- publish a release;
- authorize downstream external actions.

Those remain explicit owner decisions.
