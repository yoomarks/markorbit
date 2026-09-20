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
import { createPostgresBrainCognitiveReadServiceV1 } from './brain-cognitive-read-postgres.js';
import { PostgresBrainAssetRegistry } from './brain-asset-registry-postgres.js';
import {
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository
} from './identity.js';
import { CurrentWorkspaceAuthorityService } from './current-workspace-authority.js';
import { PostgresGovernedHumanActionReceiptStore } from './governed-human-action-receipt-postgres.js';
import { GovernedHumanActionReceiptService } from './governed-human-action-receipt.js';
import { createRuntime } from './index.js';
import {
  createEnvironmentCognitiveReadGrantSourceV1,
  createEnvironmentCoreAdminReadGrantSourceV1,
  createEnvironmentDataReadGrantSourceV1,
  createEnvironmentExecutionAdminReadGrantSourceV1,
  createEnvironmentGovernanceAdminReadGrantSourceV1,
  createEnvironmentKnowledgeReadGrantSourceV1,
  createEnvironmentLiteAdminReadGrantSourceV1,
  createEnvironmentSystemAdminReadGrantSourceV1,
  createEnvironmentWorkspaceAdminReadGrantSourceV1,
  createEnvironmentWorkspaceAdminManageGrantSourceV1,
  InternalOperatorPrincipalResolverV1
} from './internal-operator-principal.js';
import { PostgresKnowledgeReadyPackageContentRepository } from './knowledge-content.js';
import { PostgresWorkspaceAdminPortfolioReaderV1 } from './workspace-admin-portfolio.js';
import { PostgresWorkspaceAdminManagementServiceV1 } from './workspace-admin-management.js';
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
import {
  UsTrademarkMarkRepresentationMethodAuthorityV1,
  materializeUsTrademarkMarkRepresentationBrainAssetLifecycleV1
} from './us-trademark-mark-representation-method-authority.js';
import { PostgresWorkspaceTrademarkIssueIntelligenceRepository } from './workspace-trademark-issue-intelligence-store.js';
import { WorkspaceCommercialServiceV1 } from './workspace-commercial.js';
import { PostgresWorkspaceCommercialRepositoryV1 } from './workspace-commercial-postgres.js';
import { OAuthCredentialCurrentnessServiceV1 } from './oauth-credential-currentness.js';
import { PostgresOAuthCredentialRepositoryV1 } from './oauth-credential-postgres.js';
import { ExternalCredentialCurrentnessServiceV1 } from './external-credential-currentness.js';
import { PostgresExternalCredentialRepositoryV1 } from './external-credential-postgres.js';

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
const currentWorkspaceAuthorityService = new CurrentWorkspaceAuthorityService({
  users,
  workspaces,
  memberships
});
const workspaceCommercial = new WorkspaceCommercialServiceV1(
  new PostgresWorkspaceCommercialRepositoryV1(database),
  async (membershipId) => {
    const result = await query.query<{
      membership_id: string;
      workspace_id: string;
      user_id: string;
      status: 'ACTIVE' | 'SUSPENDED';
    }>(
      `SELECT membership_id,workspace_id,user_id,status
         FROM workspace_memberships WHERE membership_id=$1`,
      [membershipId]
    );
    const value = result.rows[0];
    return value
      ? {
          membershipId: value.membership_id,
          workspaceId: value.workspace_id,
          userId: value.user_id,
          status: value.status
        }
      : undefined;
  }
);
const governedHumanActionReceipts = new GovernedHumanActionReceiptService({
  store: new PostgresGovernedHumanActionReceiptStore(database),
  currentWorkspaceAuthority: currentWorkspaceAuthorityService
});
const currentWorkspaceAuthority = Object.assign(currentWorkspaceAuthorityService, {
  materializeOrResolve: governedHumanActionReceipts.materializeOrResolve.bind(
    governedHumanActionReceipts
  ),
  validateCurrent: governedHumanActionReceipts.validateCurrent.bind(governedHumanActionReceipts),
  validateNotificationAutomationActivation:
    governedHumanActionReceipts.validateNotificationAutomationActivation.bind(
      governedHumanActionReceipts
    )
});
const accountAccess = new AccountAccessService(
  new PostgresAccountAccessStore(database),
  authentication
);
const internalOperatorPrincipalResolver = new InternalOperatorPrincipalResolverV1({
  authentication,
  accountAccess,
  cognitiveReadGrants: createEnvironmentCognitiveReadGrantSourceV1(),
  dataReadGrants: createEnvironmentDataReadGrantSourceV1(),
  knowledgeReadGrants: createEnvironmentKnowledgeReadGrantSourceV1(),
  workspaceAdminReadGrants: createEnvironmentWorkspaceAdminReadGrantSourceV1(),
  workspaceAdminManageGrants: createEnvironmentWorkspaceAdminManageGrantSourceV1(),
  liteAdminReadGrants: createEnvironmentLiteAdminReadGrantSourceV1(),
  executionAdminReadGrants: createEnvironmentExecutionAdminReadGrantSourceV1(),
  coreAdminReadGrants: createEnvironmentCoreAdminReadGrantSourceV1(),
  systemAdminReadGrants: createEnvironmentSystemAdminReadGrantSourceV1(),
  governanceAdminReadGrants: createEnvironmentGovernanceAdminReadGrantSourceV1()
});
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
const brainAssetRegistry = new PostgresBrainAssetRegistry(database);
await materializeUsTrademarkMarkRepresentationBrainAssetLifecycleV1(brainAssetRegistry);
const usTrademarkMarkRepresentationMethods = new UsTrademarkMarkRepresentationMethodAuthorityV1(
  brainAssetRegistry
);
const runtime = createRuntime({
  authentication,
  accountAccess,
  accountOnboarding,
  workspaces,
  currentWorkspaceAuthority,
  workspaceCommercial,
  knowledgeIntakes: new PostgresKnowledgeIntakeRepository(query),
  knowledgeContents: new PostgresKnowledgeReadyPackageContentRepository(query),
  knowledgeV2Deliveries: new PostgresKnowledgeV2DeliveryRepository(query),
  brainCognitiveRead: createPostgresBrainCognitiveReadServiceV1(database),
  internalOperatorPrincipalResolver,
  workspaceAdminPortfolio: new PostgresWorkspaceAdminPortfolioReaderV1(query),
  workspaceAdminManagement: new PostgresWorkspaceAdminManagementServiceV1(database),
  methodOutcomeEvidenceAdmissions,
  methodOutcomeReports,
  methodImprovementAdmissions,
  officialFeeReferences: new PostgresOfficialFeeReferenceStore(database),
  usTrademarkMarkRepresentationMethods,
  workspaceTrademarkIssueIntelligence: new PostgresWorkspaceTrademarkIssueIntelligenceRepository(
    database
  ),
  oauthCredentialCurrentness: new OAuthCredentialCurrentnessServiceV1(
    new PostgresOAuthCredentialRepositoryV1(database),
    currentWorkspaceAuthorityService
  ),
  externalCredentialCurrentness: new ExternalCredentialCurrentnessServiceV1(
    new PostgresExternalCredentialRepositoryV1(database),
    currentWorkspaceAuthorityService
  ),
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
