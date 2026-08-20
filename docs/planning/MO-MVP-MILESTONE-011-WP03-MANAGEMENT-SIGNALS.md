# M11 WP03 — Time-Sensitive & Risk/Opportunity Management Signals

WP03 turns current composed Trademark Asset context and WP02 refresh history into explainable Product management signals.

## Supported dimensions

- observed renewal-date proximity;
- stale or non-current consequential context;
- missing consequential context;
- unresolved source conflict;
- owner-domain lifecycle recommendation relevance;
- Knowledge/rule-change relevance;
- explicit Workspace user priority;
- repeated portfolio conditions when at least three accessible Assets already have the same evidence-backed signal dimension.

## Evidence and change linkage

Signals carry exact source references. When a WP02 refresh run is supplied, matching refresh changes are attached to the derived signal so the Product can explain both the current condition and what changed.

Polling timestamp changes alone do not manufacture management significance. Source version/fingerprint changes and freshness changes remain distinct.

## Date boundary

Observed date proximity is only a Product management signal. The initial bounded window is 180 days. Severity increases as an observed renewal date approaches or passes, but every signal keeps `legalDeadlineCertified = false` and explicitly requires source/deadline verification before action.

## Permanent authority boundary

Management Signal derivation is read-only. It does not verify official status, certify legal deadlines, form a legal conclusion, resolve conflicting sources, mutate an owner domain, or authorize filing/contact/payment/publication/execution.

Portfolio pattern signals are concentration observations over already-derived Product signals; they do not create new factual or legal truth.
