import { ManagedDatabase, parseDatabaseConfig } from '@markorbit/persistence';
import {
  AuthenticationService,
  PostgresSessionRepository,
  validateInternalServiceSecret
} from './auth.js';
import { AccountAccessService, PostgresAccountAccessStore } from './account-access.js';
import {
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository
} from './identity.js';
import { createRuntime } from './index.js';
import { PostgresKnowledgeReadyPackageContentRepository } from './knowledge-content.js';
import { PostgresKnowledgeIntakeRepository } from './knowledge-intake.js';
import { PostgresKnowledgeV2DeliveryRepository } from './knowledge-v2-delivery.js';

const secret = process.env.MO_INTERNAL_SERVICE_SECRET;
if (!secret) throw new Error('MO_INTERNAL_SERVICE_SECRET is required.');
validateInternalServiceSecret(secret, secret);
const database = new ManagedDatabase(parseDatabaseConfig(process.env));
await database.start();
const query = database.getPool();
const users = new PostgresUserRepository(query);
const workspaces = new PostgresWorkspaceRepository(query);
const authentication = new AuthenticationService({
  sessions: new PostgresSessionRepository(query),
  users,
  workspaces,
  memberships: new PostgresMembershipRepository(query)
});
const accountAccess = new AccountAccessService(
  new PostgresAccountAccessStore(database),
  authentication
);
const runtime = createRuntime({
  authentication,
  accountAccess,
  workspaces,
  knowledgeIntakes: new PostgresKnowledgeIntakeRepository(query),
  knowledgeContents: new PostgresKnowledgeReadyPackageContentRepository(query),
  knowledgeV2Deliveries: new PostgresKnowledgeV2DeliveryRepository(query),
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
