from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"missing patch anchor in {path}")
    target.write_text(text.replace(old, new, 1))


replace(
    "services/execution/src/index.ts",
    """    const declaredWorkspace =
      request.headers['x-markorbit-workspace-id'] ??
      (request.body &&
      typeof request.body === 'object' &&
      'workspaceId' in request.body &&
      typeof (request.body as { workspaceId?: unknown }).workspaceId === 'string'
        ? (request.body as { workspaceId: string }).workspaceId
        : undefined);
    if (declaredWorkspace && declaredWorkspace !== principal.workspaceId) {
""",
    """    const headerWorkspace = request.headers['x-markorbit-workspace-id'];
    const bodyWorkspace =
      request.body &&
      typeof request.body === 'object' &&
      'workspaceId' in request.body &&
      typeof (request.body as { workspaceId?: unknown }).workspaceId === 'string'
        ? (request.body as { workspaceId: string }).workspaceId
        : undefined;
    if (
      (headerWorkspace && headerWorkspace !== principal.workspaceId) ||
      (bodyWorkspace && bodyWorkspace !== principal.workspaceId)
    ) {
""",
)
replace(
    "package.json",
    '    "test:professional-review:postgres": "pnpm build:professional-review-deps && pnpm --filter @markorbit/execution-service exec vitest run tests/professional-review-postgres.test.ts",\n',
    '    "test:professional-review:postgres": "pnpm build:professional-review-deps && pnpm --filter @markorbit/execution-service exec vitest run tests/professional-review-postgres.test.ts",\n'
    '    "test:filing-governance:auth": "pnpm build:professional-review-deps && pnpm --filter @markorbit/execution-service exec vitest run tests/filing-authorization-auth.test.ts",\n'
    '    "test:filing-governance:postgres": "pnpm build:professional-review-deps && EXECUTION_POSTGRES_TEST_REQUIRED=1 pnpm --filter @markorbit/execution-service exec vitest run tests/filing-authorization-postgres.test.ts",\n',
)
replace(
    ".github/workflows/ci.yml",
    "      - run: pnpm test:professional-review:http\n",
    "      - run: pnpm test:professional-review:http\n"
    "      - name: Run authenticated Execution filing-governance boundary\n"
    "        run: pnpm test:filing-governance:auth\n"
    "      - name: Run durable Execution filing-governance PostgreSQL suite\n"
    "        run: pnpm test:filing-governance:postgres\n",
)
replace(
    "services/execution/tests/professional-review-postgres.test.ts",
    """    await pool.query(
      'DROP TABLE IF EXISTS professional_review_audit, professional_review_commands, professional_review_cases CASCADE'
    );
""",
    """    await pool.query(
      `DROP TABLE IF EXISTS
         filing_execution_task_drafts,
         execution_releases,
         filing_authorizations,
         filing_governance_commands,
         filing_governance_audit,
         professional_review_audit,
         professional_review_commands,
         professional_review_cases
       CASCADE`
    );
    await pool.query(
      'DROP FUNCTION IF EXISTS reject_filing_governance_audit_mutation() CASCADE'
    );
""",
)
replace(
    "services/execution/src/filing-authorization-postgres.ts",
    """import {
  FilingGovernanceError,
  type ExecutionReleaseRepository,
  type FilingGovernanceDenial
} from './filing-authorization.js';
""",
    """import {
  FilingGovernanceError,
  type FilingGovernanceDenial
} from './filing-authorization.js';
""",
)
replace(
    "services/execution/tests/filing-authorization-postgres.test.ts",
    """    const command = {
      acknowledgementCodes: [...codes],
      acknowledgedBy: actorId,
      idempotencyKey: 'confirm-durable'
    };
""",
    """    const command: Parameters<
      FilingGovernanceService['confirmAuthorization']
    >[1] = {
      acknowledgementCodes: [...codes],
      acknowledgedBy: actorId,
      idempotencyKey: 'confirm-durable'
    };
""",
)
