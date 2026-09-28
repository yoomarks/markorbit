# Workspace Console V1 visual review

The runnable review surface lives in `apps/workspace-console-preview` and is deliberately isolated
from production routing.

Run:

```powershell
node apps/workspace-console-preview/server.mjs
```

Then open `http://127.0.0.1:4178/`.

Review routes are query driven:

- `/?lang=zh&page=overview`
- `/?lang=en&page=overview`
- `/?lang=zh&page=resources`
- `/?lang=zh&page=team`
- `/?lang=zh&page=products`
- `/?lang=zh&page=states`
- `/?lang=zh&page=lite&persona=employee`
- `/?lang=zh&page=shared&access=revoked`

All displayed organizations, people and records are named fixtures. The preview marks local
mutations as review simulation and never claims Core persistence, payment or production activation.

Visual evidence and acceptance output are written under `docs/ui/workspace-console-v1/evidence` and
are kept separate from live application code.

See `VISUAL-REVIEW.md` for the captured desktop/mobile matrix and review findings.
