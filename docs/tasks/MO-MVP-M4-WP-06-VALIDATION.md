# M4-WP-06 Validation Matrix

Required hosted evidence before readiness:

- workspace/typecheck/lint/format validation;
- MGSN migrations through `0031` verified in the MGSN owner database;
- Execution migrations including `0032` verified in the Execution owner database;
- authenticated exact ACCEPTED Allocation -> Provider Return creation;
- retry-safe Provider Return replay and conflicting-key rejection;
- additive correction with exact supersession lineage and historical reload;
- provider Workspace spoof rejection;
- stale/superseded Provider Return handoff rejection;
- exact Execution Release and Filing Execution Task Draft validation;
- durable Execution evidence receipt and response-loss-safe replay;
- append-only MGSN and Execution audit evidence;
- closed authority-consequence fixtures;
- existing Milestone 2 / Milestone 3 / Browser and Visual Validation remain green.
