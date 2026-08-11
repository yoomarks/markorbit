# PLC-WP-07 — Reliability and browser matrix

- **Stage:** `MO-MVP-PRODUCT-LOOP-CLOSURE`
- **Work package:** `PLC-WP-07`
- **Status:** `COMPLETE / merged PR #82`
- **Base:** `8c155abda9d0d0cf5763ed316341e1c9d23001b6` (merged PLC-WP-06)
- **Exact verified head:** `26dcd84dc4e27e9c66536ced168b1efb0c55e036`
- **Verified runtime tree:** `23b153a2315f90de77e139bef44ff2a43e4aeb40`
- **Merge:** `eb029a104a19b05c2f577956bbd2a4a35f635878`
- **Scope:** verification and reliability closure only; no new Product semantics

## Objective

Prove the already-implemented PLC-WP-02 through PLC-WP-06 Product loop as one reliable real-runtime system before the independent WP-08 authority audit.

The acceptance chain is:

```text
Knowledge / governed source
-> Today Recommendation
-> Prepared Action / explicit confirmation
-> Lite Content Opportunity
-> bounded Content Draft
-> Human Review
-> PublishPackage
-> manual Product-loop use feedback
-> Opportunity Candidate
-> explicit Qualification
-> MarkReg Formal Opportunity
-> confirmed MarkReg Intake handoff
-> durable evidence / Today feedback
```

WP-07 does not add a new Product module, shared service, event platform or Milestone 6 learning runtime. It exists to prove that the exact state and authority boundaries already built survive real runtime conditions.

## Reliability matrix

The exact PR head must prove all of the following:

1. **Restart / recovery**
   - Lite Content preparation records survive store/runtime recreation.
   - Product-loop feedback survives recreation.
   - Candidate + Qualification survive recreation.
   - MarkReg Formal Opportunity + Intake handoff survive recreation.
   - exact idempotent replay after restart returns the same durable result.

2. **Replay / idempotency**
   - identical keys replay exactly;
   - key drift fails closed;
   - duplicate source promotion cannot create a second Formal Opportunity.

3. **Optimistic concurrency / stale state**
   - competing draft revisions have one winner;
   - competing Qualification decisions have one winner;
   - competing Formal Opportunity / Intake handoff mutations have one winner;
   - stale fingerprints and stale versions are rejected.

4. **Workspace and subject isolation**
   - Lite records cannot be read through another Workspace;
   - inaccessible customer relationships cannot create Candidates;
   - MarkReg Formal Opportunities remain Workspace-scoped;
   - the cross-service qualified-opportunity authority never bypasses the owning Lite boundary.

5. **Provenance preservation**
   - Knowledge provenance remains exact through Recommendation, Content and PublishPackage;
   - manual use feedback becomes an exact `CONTENT_USE_FEEDBACK` source;
   - Candidate cites that exact feedback source;
   - MarkReg Formal Opportunity cites the exact Candidate and Qualification Decision.

6. **Permission / transport denial**
   - authenticated Gateway Workspace Principal remains authoritative;
   - actor spoof, missing permission, invalid Workspace context, untrusted origin, CSRF and missing idempotency remain denied by existing Product-loop transport tests.

7. **Desktop/mobile real runtime**
   - Today uses real Core/Gateway/Lite services and real PostgreSQL;
   - a reviewed PublishPackage appears in `Outcome feedback needed`;
   - an authenticated user records an after-the-fact outcome;
   - that package leaves the pending queue and durable evidence returns to Today;
   - reload preserves the result;
   - 1440px desktop and 390px mobile both pass;
   - the acceptance spec contains no `page.route`, `context.route` or response fulfillment.

8. **Regression**
   - existing PLC-WP-02 through WP-06 gates stay green;
   - existing M2–M5 reliability/integration gates stay green;
   - repository validation, lint, typecheck, build and Browser/Visual remain green.

## Authority locks

The verification must preserve the existing statements:

```text
Recommendation != authorization
Prepared Action != executed action
PublishPackage != Published
User-reported use != MarkOrbit-executed external action
Opportunity Candidate != Formal Opportunity
Formal Opportunity != Intake / Order / Matter / Payment / Filing
Product/work evidence != Capability verification
```

The MarkReg reliability harness must use the existing `HttpQualifiedOpportunityAuthority` to resolve exact Candidate + Qualification evidence from the Lite HTTP owner boundary. It must not read Lite tables from MarkReg or join databases.

## Explicit non-goals

WP-07 does **not** implement:

- new Product state or migrations;
- new browser navigation/module architecture;
- automatic publication or outreach;
- automatic Candidate creation or qualification;
- automatic Formal Opportunity promotion;
- Order/Matter/Payment/provider appointment/filing mutation;
- universal Workplace/Brain/Value Factory/Artifact/Event infrastructure;
- M6 Capability Ledger, Reflection, Profile, Twin or Canon mutation;
- production GA.

## Completion gate

WP-07 is complete only when one exact PR head has:

- a dedicated two-owner PostgreSQL Product-loop closure integration gate;
- a dedicated desktop/mobile real-runtime browser feedback gate with no interception;
- all reliability matrix assertions green;
- all pre-existing Product-loop and M2–M5 gates green;
- no temporary remediation scripts/workflows left in the final diff.

## Completed exact-head evidence

PR #82 satisfied the gate at exact head `26dcd84dc4e27e9c66536ced168b1efb0c55e036`.

Successful hosted runs on that head:

- Product Loop Closure Reliability `31511957597`;
- validation `31511957587`;
- Browser and Visual Validation `31511957667`;
- Milestone 2 reliability `31511957572`;
- Milestone 3 reliability `31511957565`;
- Milestone 4 integration `31511957570`;
- Milestone 4 reliability `31511957635`;
- Milestone 5 integration `31511957655`;
- Milestone 5 reliability `31511957668`.

The verified head and merged main share tree `23b153a2315f90de77e139bef44ff2a43e4aeb40`, so the exact WP-07 runtime evidence is the runtime tree audited by PLC-WP-08.
