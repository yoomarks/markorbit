import { ManagedDatabase, parseDatabaseConfig } from '@markorbit/persistence';
import { AccountAccessService, PostgresAccountAccessStore } from './account-access.js';
import {
  AccountOnboardingService,
  PostgresAccountOnboardingRepository
} from './account-onboarding.js';
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
import { CurrentWorkspaceAuthorityService } from './current-workspace-authority.js';
import { createRuntime } from './index.js';
import { PostgresKnowledgeReadyPackageContentRepository } from './knowledge-content.js';
import { PostgresKnowledgeIntakeRepository } from './knowledge-intake.js';
import { PostgresKnowledgeV2DeliveryRepository } from './knowledge-v2-delivery.js';
import {
  MethodImprovementAdmissionServiceV1,
  PostgresMethodImprovementAdmissionRepositoryV1
} from './method-improvement.js';
import {
  MethodOutcomeEvidenceAdmissionServiceV1,
  PostgresMethodOutcomeEvidenceAdmissionRepositoryV1
} from './method-outcome-evidence.js';
import {
  MethodOutcomeReportServiceV1,
  PostgresMethodOutcomeReportReaderV1
} from './method-outcome-report.js';
import { PostgresOfficialFeeReferenceStore } from './official-fee-reference-store-postgres.js';

const secret = process.env.MO_INTERNAL_SERVICE_SECRET;
if (!secret) throw new Error('MO_INTERNAL_SERVICE_SECRET is required.');
validateInternalServiceSecret(secret, secret);
const database = new ManagedDatabase(parseDatabaseConfig(process.env));
await database.start();
const query = database.getPool();
const users = new PostgresUserRepository(query);
const workspaces = new PostgresWorkspaceRepository(query);
const memberships = new PostgresMembershipRepository(query);
const authentication = new AuthenticationService({
  sessions: new PostgresSessionRepository(query),
  users,
  workspaces,
  memberships
});
const currentWorkspaceAuthority = new CurrentWorkspaceAuthorityService({
  users,
  workspaces,
  memberships
});
const accountAccess = new AccountAccessService(
  new PostgresAccountAccessStore(database),
  authentication
);
const accountOnboarding = new AccountOnboardingService(
  new PostgresAccountOnboardingRepository(database)
);
const methodOutcomeEvidenceAdmissions = new MethodOutcomeEvidenceAdmissionServiceV1({
  repository: new PostgresMethodOutcomeEvidenceAdmissionRepositoryV1(database)
});
const methodOutcomeReports = new MethodOutcomeReportServiceV1(
  new PostgresMethodOutcomeReportReaderV1(database)
);
const methodImprovementAdmissions = new MethodImprovementAdmissionServiceV1({
  repository: new PostgresMethodImprovementAdmissionRepositoryV1(database),
  reports: methodOutcomeReports
});
const runtime = createRuntime({
  authentication,
  accountAccess,
  accountOnboarding,
  workspaces,
  currentWorkspaceAuthority,
  knowledgeIntakes: new PostgresKnowledgeIntakeRepository(query),
  knowledgeContents: new PostgresKnowledgeReadyPackageContentRepository(query),
  knowledgeV2Deliveries: new PostgresKnowledgeV2DeliveryRepository(query),
  methodOutcomeEvidenceAdmissions,
  methodOutcomeReports,
  methodImprovementAdmissions,
  officialFeeReferences: new PostgresOfficialFeeReferenceStore(database),
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
