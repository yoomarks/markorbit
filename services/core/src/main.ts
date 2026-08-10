import { ManagedDatabase, parseDatabaseConfig } from '@markorbit/persistence';
import {
  AuthenticationService,
  PostgresSessionRepository,
  validateInternalServiceSecret
} from './auth.js';
import {
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository
} from './identity.js';
import { createRuntime } from './index.js';
import { PostgresKnowledgeIntakeRepository } from './knowledge-intake.js';

const secret = process.env.MO_INTERNAL_SERVICE_SECRET;
if (!secret) throw new Error('MO_INTERNAL_SERVICE_SECRET is required.');
validateInternalServiceSecret(secret, secret);
const database = new ManagedDatabase(parseDatabaseConfig(process.env));
await database.start();
const query = database.getPool();
const workspaces = new PostgresWorkspaceRepository(query);
const authentication = new AuthenticationService({
  sessions: new PostgresSessionRepository(query),
  users: new PostgresUserRepository(query),
  workspaces,
  memberships: new PostgresMembershipRepository(query)
});
const runtime = createRuntime({
  authentication,
  workspaces,
  knowledgeIntakes: new PostgresKnowledgeIntakeRepository(query),
  internalServiceSecret: secret
});

async function shutdown(signal: string) {
  process.stdout.write(`${runtime.manifest.name}: received ${signal}, stopping.\n`);
  await runtime.stop();
  await database.close();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await runtime.start();
} catch (error) {
  await database.close();
  throw error;
}
process.stdout.write(
  `${runtime.manifest.name}: listening on http://127.0.0.1:${runtime.listeningPort}.\n`
);
