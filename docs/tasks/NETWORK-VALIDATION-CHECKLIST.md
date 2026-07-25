# Network-enabled validation checklist

The repository intentionally does not contain a fabricated lockfile.

On the first network-enabled checkout:

```bash
corepack enable
corepack prepare pnpm@10.28.1 --activate
pnpm install
pnpm validate:workspace
pnpm format
pnpm check
pnpm infra:config
```

Commit the resulting `pnpm-lock.yaml`. CI already requires the lockfile and uses `--frozen-lockfile`, so it cannot silently accept dependency drift.
