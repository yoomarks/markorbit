# TASK 022 — Formal Matter creation vertical slice

The MarkReg-owned flow promotes a confirmed Customer Confirmation plus an exact READY Matter Draft into one durable `OPEN` Formal Matter. The receipt retains immutable source lineage and reloads by Workspace and ID. See [Formal Matter creation](../architecture/FORMAL-MATTER-CREATION.md).

Migration `0022_markreg_formal_matters` owns Matter, command idempotency, and append-only creation audit tables. Canonical routes are `POST /api/markreg/formal-matters` and `GET /api/markreg/formal-matters/:formalMatterId`. This delivery does not require Professional Review and creates none of the explicitly excluded downstream objects.

Executable acceptance evidence is provided by `test:formal-matter:postgres` (migration, exact reload/hash, replay/conflict, concurrency, rollback, Workspace scope, and reconnect), `test:formal-matter:http` (real Core, MarkReg, Gateway listeners with PostgreSQL, role/error mapping, and an actual MarkReg listener restart), and `test:formal-matter:browser` (desktop/mobile creation receipt and browser refresh lineage recovery). PostgreSQL required mode fails rather than skips when its dedicated URL is absent; CI runs the PostgreSQL suite twice against the same database.
