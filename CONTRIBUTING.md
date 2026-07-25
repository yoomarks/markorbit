# Contributing

## Branches

Use one branch per task:

```text
feat/mo-mvp-task-XXX-short-name
fix/mo-mvp-task-XXX-short-name
docs/mo-mvp-task-XXX-short-name
```

## Pull requests

Each pull request must state:

- task ID and outcome;
- affected service or product owner;
- contracts changed;
- migrations added;
- UI states covered;
- tests and commands run;
- explicit non-goals;
- rollback or compatibility notes.

Prefer squash merge after review.

## Change rules

- Contract changes are additive by default.
- Breaking contract changes require an ADR and consumer migration plan.
- Database migrations are immutable after merge.
- Generated files must be reproducible.
- No secret, personal customer data or production document belongs in Git.
