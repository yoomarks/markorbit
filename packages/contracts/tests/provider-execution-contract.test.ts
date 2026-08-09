import { describe, expect, it } from 'vitest';
import type {
  ExecutionRelease,
  FilingAuthorization,
  FilingExecutionTaskDraft,
  FormalMatter,
  PreparationLock
} from '../src/index.js';
import {
  allocationAuthorityConsequences,
  allocationStatuses,
  eligibilityAuthorityConsequences,
  eligibilityOutcomes,
  evidenceHandoffAuthorityConsequences,
  providerAcceptanceAuthorityConsequences,
  providerAcceptanceDecisions,
  providerExecutionErrorCodes,
  providerOperationalStatuses,
  providerReturnAuthorityConsequences,
  providerReturnStatuses,
  providerSupplyCapabilityStatuses,
  servicePackageAuthorityConsequences,
  servicePackageStatuses,
  type AllocateProviderCommand,
  type CreateProviderReturnCommand,
  type CreateServicePackageCommand,
  type EvaluateProviderEligibilityCommand,
  type HandoffProviderReturnEvidenceCommand,
  type ProviderAcceptance,
  type ProviderExecutionSourceSnapshot,
  type ProviderReference,
  type ProviderReturn,
  type ProviderSupplyCapability,
  type RespondToAllocationCommand
} from '../src/provider-execution.js';

const sha = 'a'.repeat(64);
const sha2 = 'b'.repeat(64);

const provider = {
  providerId: 'provider_contract-01',
  providerWorkspaceId: 'workspace_provider-01',
  displayName: 'Example Provider',
  operationalStatus: 'ACTIVE'
} as const satisfies ProviderReference;

const supply = {
  schemaVersion: 1,
  providerSupplyCapabilityId: 'provider-supply-capability_contract-01',
  provider,
  version: 4,
  status: 'ACTIVE',
  jurisdictions: ['US'],
  serviceTypes: ['TRADEMARK_FILING_EXECUTION'],
  effectivePeriod: { effectiveFrom: '2026-08-09T00:00:00.000Z' },
  capacityUnits: 5,
  evidenceReferences: ['provider-evidence:contract-01'],
  sourceFingerprintSha256: sha,
  createdAt: '2026-08-09T00:00:00.000Z',
  updatedAt: '2026-08-09T00:00:00.000Z'
} as const satisfies ProviderSupplyCapability;

const source = {
  schemaVersion: 1,
  workspaceId: 'workspace_customer-01',
  formalMatter: { id: 'formal-matter_contract-01', version: 1 },
  preparationLock: { id: 'preparation-lock_contract-01', version: '2:3:locked' },
  filingAuthorization: { id: 'filing-authorization_contract-01', version: 2 },
  executionRelease: { id: 'execution-release_contract-01', version: 3 },
  filingExecutionTaskDraft: { id: 'filing-task-draft_contract-01', version: 1 },
  jurisdiction: 'US',
  serviceType: 'TRADEMARK_FILING_EXECUTION',
  serviceScope: ['prepare filing package', 'return execution evidence'],
  documentReferences: ['document:poa'],
  instructionReferences: ['instruction:goods-services'],
  executionWindow: {
    startsAt: '2026-08-09T00:00:00.000Z',
    endsAt: '2026-09-08T00:00:00.000Z'
  },
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  sourceFingerprintSha256: sha2,
  correlationId: 'correlation_contract-01',
  capturedAt: '2026-08-09T00:00:00.000Z'
} as const satisfies ProviderExecutionSourceSnapshot;

describe('Milestone 4 provider execution contract', () => {
  it('locks the bounded operational vocabulary without creating finance or Official Truth states', () => {
    expect(providerOperationalStatuses).toEqual(['ACTIVE', 'SUSPENDED', 'INACTIVE']);
    expect(providerSupplyCapabilityStatuses).toEqual(['ACTIVE', 'SUSPENDED', 'RETIRED']);
    expect(servicePackageStatuses).toEqual(['ADMITTED', 'STALE', 'CANCELLED']);
    expect(eligibilityOutcomes).toEqual(['ELIGIBLE', 'INELIGIBLE']);
    expect(allocationStatuses).toEqual(['ACTIVE', 'CANCELLED', 'SUPERSEDED']);
    expect(providerAcceptanceDecisions).toEqual(['ACCEPTED', 'DECLINED']);
    expect(providerReturnStatuses).toEqual(['CURRENT', 'SUPERSEDED']);

    const forbidden = ['PAID', 'INVOICED', 'FILED', 'OFFICIALLY_ACCEPTED', 'MATTER_COMPLETED'];
    const vocabulary = [
      ...providerOperationalStatuses,
      ...providerSupplyCapabilityStatuses,
      ...servicePackageStatuses,
      ...eligibilityOutcomes,
      ...allocationStatuses,
      ...providerAcceptanceDecisions,
      ...providerReturnStatuses
    ];
    for (const state of forbidden) expect(vocabulary).not.toContain(state);
  });

  it('uses Core identity references instead of inventing a second provider identity model', () => {
    expect(provider.providerId).toBe('provider_contract-01');
    expect(provider.providerWorkspaceId).toBe('workspace_provider-01');
    expect(supply.provider).toEqual(provider);
    expect(supply.sourceFingerprintSha256).toHaveLength(64);
  });

  it('preserves exact existing Execution and Matter source identities and versions', () => {
    const matterId: FormalMatter['formalMatterId'] = source.formalMatter!.id;
    const lockId: PreparationLock['preparationLockId'] = source.preparationLock.id;
    const authorizationId: FilingAuthorization['filingAuthorizationId'] =
      source.filingAuthorization.id;
    const releaseId: ExecutionRelease['executionReleaseId'] = source.executionRelease.id;
    const taskId: FilingExecutionTaskDraft['filingExecutionTaskDraftId'] =
      source.filingExecutionTaskDraft.id;

    expect(matterId).toBe('formal-matter_contract-01');
    expect(lockId).toBe('preparation-lock_contract-01');
    expect(authorizationId).toBe('filing-authorization_contract-01');
    expect(releaseId).toBe('execution-release_contract-01');
    expect(taskId).toBe('filing-task-draft_contract-01');
    expect(source.sourceFingerprintSha256).toHaveLength(64);
    expect(source.correlationId).toBe('correlation_contract-01');
  });

  it('defines exact-version and fingerprint commands without trusting provider actor identity in provider payloads', () => {
    const create = {
      workspaceId: source.workspaceId,
      source,
      idempotencyKey: 'service-package:create:1',
      correlationId: source.correlationId
    } satisfies CreateServicePackageCommand;

    const eligibility = {
      workspaceId: source.workspaceId,
      servicePackageId: 'service-package_contract-01',
      expectedServicePackageVersion: 1,
      expectedServicePackageFingerprintSha256: sha2,
      providerSupplyCapabilityId: supply.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: supply.version,
      expectedProviderSupplyCapabilityFingerprintSha256: supply.sourceFingerprintSha256,
      idempotencyKey: 'eligibility:evaluate:1',
      correlationId: source.correlationId
    } satisfies EvaluateProviderEligibilityCommand;

    const allocate = {
      workspaceId: source.workspaceId,
      servicePackageId: eligibility.servicePackageId,
      expectedServicePackageVersion: 1,
      expectedServicePackageFingerprintSha256: sha2,
      eligibilityEvaluationId: 'eligibility-evaluation_contract-01',
      expectedEligibilityEvaluationVersion: 1,
      expectedEligibilityFingerprintSha256: sha,
      providerId: provider.providerId,
      providerSupplyCapabilityId: supply.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: supply.version,
      rationale: 'Current eligible provider for the exact package.',
      idempotencyKey: 'allocation:create:1',
      correlationId: source.correlationId
    } satisfies AllocateProviderCommand;

    const respond = {
      workspaceId: source.workspaceId,
      allocationId: 'allocation_contract-01',
      expectedAllocationVersion: 1,
      decision: 'ACCEPTED',
      acknowledgement: 'I accept this exact service package.',
      idempotencyKey: 'allocation:respond:1',
      correlationId: source.correlationId
    } satisfies RespondToAllocationCommand;

    expect(create.source.executionRelease.version).toBe(3);
    expect(eligibility.expectedProviderSupplyCapabilityVersion).toBe(4);
    expect(allocate.expectedEligibilityFingerprintSha256).toHaveLength(64);
    expect(respond).not.toHaveProperty('providerId');
    expect(respond).not.toHaveProperty('providerWorkspaceId');
  });

  it('keeps Provider Return as provenance evidence and requires exact evidence-handoff lineage', () => {
    const acceptance = {
      schemaVersion: 1,
      providerAcceptanceId: 'provider-acceptance_contract-01',
      workspaceId: source.workspaceId,
      version: 1,
      allocation: { id: 'allocation_contract-01', version: 1 },
      servicePackage: { id: 'service-package_contract-01', version: 1 },
      providerId: provider.providerId,
      providerWorkspaceId: provider.providerWorkspaceId,
      decision: 'ACCEPTED',
      acknowledgement: 'Accepted.',
      responseFingerprintSha256: sha,
      respondedAt: '2026-08-09T01:00:00.000Z',
      correlationId: source.correlationId
    } as const satisfies ProviderAcceptance;

    const providerReturn = {
      schemaVersion: 1,
      providerReturnId: 'provider-return_contract-01',
      workspaceId: source.workspaceId,
      version: 1,
      servicePackage: { id: 'service-package_contract-01', version: 1 },
      allocation: { id: acceptance.allocation.id, version: 1 },
      providerAcceptance: { id: acceptance.providerAcceptanceId, version: acceptance.version },
      providerId: provider.providerId,
      providerWorkspaceId: provider.providerWorkspaceId,
      workStatusClaim: 'Provider claims the requested external preparation work was performed.',
      artifacts: [{ reference: 'artifact:receipt', sha256: sha }],
      assertions: [
        {
          code: 'PROVIDER_CLAIMS_EXTERNAL_ACTION',
          value: true,
          evidenceReferences: ['artifact:receipt']
        }
      ],
      returnFingerprintSha256: sha2,
      status: 'CURRENT',
      submittedAt: '2026-08-09T02:00:00.000Z',
      correlationId: source.correlationId
    } as const satisfies ProviderReturn;

    const createReturn = {
      workspaceId: source.workspaceId,
      allocationId: providerReturn.allocation.id,
      expectedAllocationVersion: 1,
      providerAcceptanceId: acceptance.providerAcceptanceId,
      expectedProviderAcceptanceVersion: acceptance.version,
      servicePackageId: providerReturn.servicePackage.id,
      expectedServicePackageVersion: 1,
      workStatusClaim: providerReturn.workStatusClaim,
      artifacts: providerReturn.artifacts,
      assertions: providerReturn.assertions,
      idempotencyKey: 'provider-return:create:1',
      correlationId: source.correlationId
    } satisfies CreateProviderReturnCommand;

    const handoff = {
      workspaceId: source.workspaceId,
      providerReturnId: providerReturn.providerReturnId,
      expectedProviderReturnVersion: providerReturn.version,
      expectedProviderReturnFingerprintSha256: providerReturn.returnFingerprintSha256,
      executionReleaseId: source.executionRelease.id,
      expectedExecutionReleaseVersion: 3,
      filingExecutionTaskDraftId: source.filingExecutionTaskDraft.id,
      expectedFilingExecutionTaskDraftVersion: 1,
      idempotencyKey: 'provider-return:handoff:1',
      correlationId: source.correlationId
    } satisfies HandoffProviderReturnEvidenceCommand;

    expect(createReturn.assertions[0]?.code).toBe('PROVIDER_CLAIMS_EXTERNAL_ACTION');
    expect(handoff.expectedProviderReturnFingerprintSha256).toBe(sha2);
    expect(providerReturn).not.toHaveProperty('officialApplicationNumber');
  });

  it('locks typed failures for stale lineage, provider isolation, concurrency and retry', () => {
    expect(providerExecutionErrorCodes).toEqual([
      'STALE_SOURCE',
      'SOURCE_VERSION_MISMATCH',
      'SOURCE_FINGERPRINT_MISMATCH',
      'PERMISSION_DENIED',
      'POLICY_DENIED',
      'IDEMPOTENCY_CONFLICT',
      'VERSION_CONFLICT',
      'PROVIDER_NOT_FOUND',
      'PROVIDER_SUSPENDED',
      'SUPPLY_CAPABILITY_INACTIVE',
      'PROVIDER_NOT_ELIGIBLE',
      'ACTIVE_ALLOCATION_EXISTS',
      'ALLOCATION_NOT_CURRENT',
      'PROVIDER_IDENTITY_MISMATCH',
      'RETURN_SUPERSEDED',
      'PERSISTENCE_UNAVAILABLE',
      'DEPENDENCY_UNAVAILABLE'
    ]);
    expect(new Set(providerExecutionErrorCodes).size).toBe(providerExecutionErrorCodes.length);
  });

  it('proves every internal stage remains outside finance, legal appointment and Official Truth authority', () => {
    expect(servicePackageAuthorityConsequences).toMatchObject({
      servicePackageCreated: true,
      eligibilityEvaluated: false,
      providerAllocated: false
    });
    expect(eligibilityAuthorityConsequences).toMatchObject({
      eligibilityEvaluated: true,
      providerAllocated: false,
      providerAccepted: false
    });
    expect(allocationAuthorityConsequences).toMatchObject({
      providerAllocated: true,
      providerAccepted: false,
      professionalLegallyAppointedAutomatically: false
    });
    expect(providerAcceptanceAuthorityConsequences).toMatchObject({
      providerAccepted: true,
      providerReturnCreated: false,
      professionalLegallyAppointedAutomatically: false
    });
    expect(providerReturnAuthorityConsequences).toMatchObject({
      providerReturnCreated: true,
      executionEvidenceHandedOff: false,
      filingSubmitted: false,
      officialApplicationCreated: false,
      formalMatterCompletedAutomatically: false
    });
    expect(evidenceHandoffAuthorityConsequences).toMatchObject({
      executionEvidenceHandedOff: true,
      paymentCreated: false,
      invoiceCreated: false,
      professionalLegallyAppointedAutomatically: false,
      filingSubmitted: false,
      officialApplicationCreated: false,
      officialApplicationNumberReceived: false,
      trademarkOfficeAcceptance: false,
      trademarkOfficeContactedAsVerifiedTruth: false,
      formalMatterCompletedAutomatically: false,
      userCapabilityVerifiedAutomatically: false
    });
  });
});
