# Opportunity Discovery Capability Alignment

## Decision

Opportunity discovery is not a Data Engine responsibility and is not a new peer beside the
existing Capability classes.

The current architecture already defines `Discovery Capability` as the reusable execution class
for transient business candidates, with renewal, expansion and dead-mark opportunities as
canonical examples.

The Capability Tree remains:

```text
Capability Domain
  -> Discovery Capability
      -> domain opportunity capability family
          -> method / skill
              -> action / invocation
```

For trademarks, `Client Opportunity / Service Readiness` is the domain family under Discovery.

## Child opportunity families

Concrete opportunity algorithms belong below that family rather than in Data Engine:

- deadline / maintenance opportunity;
- examination / Office Action opportunity;
- renewal opportunity;
- status-change opportunity;
- relationship / cited-mark opportunity;
- contact-readiness opportunity;
- market / portfolio opportunity.

Each child may bind an ACTIVE Brain Method Package or deterministic governed method. All children
return transient candidates with provenance. Capability does not own a durable candidate pool.

## Authority boundary

```text
Data Engine facts
  -> Discovery Capability / ACTIVE method
      -> transient Opportunity Candidate
          -> Product qualification
              -> MarkReg Formal Opportunity when explicitly promoted
```

Data Engine may provide objective facts, timelines, contacts, deadlines and bounded query
substrates. It must not infer opportunity value or persist commercial opportunity policy as fact.

`Opportunity Candidate != Formal Opportunity` remains unchanged.

## TSDR handoff

TSDR is downstream evidence acquisition, not the opportunity detector.

A Discovery Capability or Product may emit an explicit acquisition intent such as:

- status/contact verification;
- selected business-chain document acquisition;
- one-shot logo asset completion.

The TSDR planner may deduplicate, budget, rate-limit, cool down and retry that explicit intent.
It must not recreate the commercial decision from nationality, attorney presence, mark quality or
other Data Engine facts.

This keeps the Capability Tree, Data Engine source-truth boundary, Product authority boundary and
TSDR sparse-acquisition design aligned.
