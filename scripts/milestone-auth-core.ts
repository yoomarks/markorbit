import {
  AuthenticationService,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  createRuntime,
  hashSessionToken
} from '../services/core/src/index.js';

const port = Number(process.env.PORT ?? '4301');
const internalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
if (!internalServiceSecret)
  throw new Error(
    'MO_INTERNAL_SERVICE_SECRET is required for the authenticated milestone runtime.'
  );
const workspaceId = process.env.MO_MILESTONE_WORKSPACE_ID ?? '55555555-5555-4555-8555-555555555555';
const userId = process.env.MO_MILESTONE_USER_ID ?? 'user_milestone_golden';
const sessionId = process.env.MO_MILESTONE_SESSION_ID;
const sessionValue = process.env.MO_MILESTONE_SESSION_VALUE;
if (!sessionId || !sessionValue)
  throw new Error('Authenticated milestone browser session fixture is required.');

const users = new InMemoryUserRepository();
const workspaces = new InMemoryWorkspaceRepository();
const memberships = new InMemoryMembershipRepository(users, workspaces);
const sessions = new InMemorySessionRepository();
const authentication = new AuthenticationService({ users, workspaces, memberships, sessions });
const runtime = createRuntime({ port, authentication, internalServiceSecret });

async function shutdown(signal: string) {
  process.stdout.write(`milestone-auth-core: received ${signal}, stopping.\n`);
  await runtime.stop();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => void shutdown(signal));

async function main() {
  await workspaces.create({
    workspaceId,
    name: 'Milestone Golden Path',
    slug: 'milestone-golden-path'
  });
  await users.create({
    userId,
    email: 'milestone-golden@example.test',
    displayName: 'Milestone Golden Path User'
  });
  await memberships.create({
    membershipId: 'membership_milestone_golden',
    workspaceId,
    userId,
    role: 'WORKSPACE_ADMIN'
  });
  await sessions.create({
    sessionId,
    userId,
    tokenHash: hashSessionToken(sessionValue),
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2036-01-01T00:00:00.000Z',
    revokedAt: null,
    version: 1
  });
  await runtime.start();
  process.stdout.write(
    `milestone-auth-core: listening on http://127.0.0.1:${runtime.listeningPort} for ${workspaceId}.\n`
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
