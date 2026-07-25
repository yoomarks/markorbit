# Development

## Requirements

- Node.js 22
- pnpm 10.28.1
- Docker with Compose support

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm check
```

## Local dependencies

```bash
pnpm infra:up
pnpm infra:down
```

Default local services:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- NATS: `localhost:4222`
- MinIO API: `localhost:9000`
- MinIO console: `localhost:9001`

## Service ports

- Gateway: 4000
- Core: 4101
- Knowledge: 4102
- Capability Engine: 4103
- Execution: 4104
- MarkReg: 4105
- MGSN: 4106

Each service must expose `GET /health` and return its own service identity.
