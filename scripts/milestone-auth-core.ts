import {
  AuthenticationService,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  createRuntime
} from '../services/core/src/index.js';

const port = Number(process.env.PORT ?? '4301');
const internalServiceSecret =
  process.env.MO_INTERNAL_SERVICE_SECRET ?? 'milestone-real-runtime-internal-secret-32-bytes';
const workspaceId =
  process.env.MO_MILESTONE_WORKSPACE_ID ?? '55555555-5555-4555-8555-555555555555';
const userId = process.env.MO_MILESTONE_USER_ID ?? 'user_milestone_golden';

const users = new InMemoryUserRepository();
const workspaces = new InMemoryWorkspaceRepository();
const memberships = new InMemoryMembershipRepository(users, workspaces);
const sessions = new InMemorySessionRepository();

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

const authentication = new AuthenticationService({ users, workspaces, memberships, sessions });
const runtime = createRuntime({ port, authentication, internalServiceSecret });

async function shutdown(signal: string) {
  process.stdout.write(`milestone-auth-core: received ${signal}, stopping.\n`);
  await runtime.stop();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => void shutdown(signal));

await runtime.start();
process.stdout.write(
  `milestone-auth-core: listening on http://127.0.0.1:${runtime.listeningPort} for ${workspaceId}.\n`
);
