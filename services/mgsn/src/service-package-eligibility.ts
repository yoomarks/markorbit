import { createHash, randomUUID } from 'node:crypto';
import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  CreateServicePackageCommand,
  EligibilityCheck,
  EligibilityEvaluation,
  EligibilityEvaluationId,
  EvaluateProviderEligibilityCommand,
  ProviderExecutionErrorCode,
  ProviderExecutionSourceSnapshot,
  ProviderId,
  ProviderSupplyCapabilityId,
  ServicePackage,
  ServicePackageId
} from '@markorbit/contracts/provider-execution';
import type {
  ProviderRegistryRecord,
  ProviderRegistryRepository,
  ProviderSupplyCapabilityRecord
} from './provider-registry.js';

export const MGSN_ELIGIBILITY_POLICY_VERSION = 'mgsn-eligibility-v1';

export interface ServicePackageRecord extends ServicePackage {
  servicePackageFingerprintSha256: string;
  createdBy: string;
  updatedBy: string;
}

export interface EligibilityEvaluationRecord extends EligibilityEvaluation {
  providerVersion: number;
  createdBy: string;
}

export interface ExecutionSourceVerification {
  status: 'CURRENT' | 'STALE' | 'MISSING';
  exactSourceFingerprintSha256?: string;
  reason?: string;
}

/**
 * Bounded dependency on Execution-owned truth. Implementations must call an Execution
 * API/adapter; MGSN must never read the Execution database directly.
 */
export interface ExecutionSourceAdmissionSource {
  verifyCurrentSource(
    source: Readonly<ProviderExecutionSourceSnapshot>
  ): Promise<ExecutionSourceVerification>;
}

export interface ServicePackageEligibilityReplay {
  fingerprint: string;
  targetType: 'SERVICE_PACKAGE' | 'ELIGIBILITY_EVALUATION';
  targetId: string;
  responseVersion: number;
  responseRecord: ServicePackageRecord | EligibilityEvaluationRecord;
}

export interface ServicePackageEligibilityRepository {
  findReplay(
    scopeKey: string,
    idempotencyKey: string
  ): Promise<ServicePackageEligibilityReplay | undefined>;
  findServicePackage(
    servicePackageId: ServicePackageId,
    version?: number
  ): Promise<ServicePackageRecord | undefined>;
  createServicePackage(
    record: ServicePackageRecord,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ServicePackageRecord>;
  findEligibilityEvaluation(
    eligibilityEvaluationId: EligibilityEvaluationId
  ): Promise<EligibilityEvaluationRecord | undefined>;
  listEligibilityEvaluations(
    servicePackageId: ServicePackageId,
    limit: number
  ): Promise<EligibilityEvaluationRecord[]>;
  createEligibilityEvaluation(
    record: EligibilityEvaluationRecord,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<EligibilityEvaluationRecord>;
}

export type ServicePackageEligibilityErrorCode =
  | ProviderExecutionErrorCode
  | 'INVALID_INPUT'
  | 'SERVICE_PACKAGE_NOT_FOUND'
  | 'ELIGIBILITY_EVALUATION_NOT_FOUND';

export class ServicePackageEligibilityError extends Error {
  constructor(
    public readonly code: ServicePackageEligibilityErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'ServicePackageEligibilityError';
  }
}

export interface AdmitServicePackageCommand extends CreateServicePackageCommand {
  actorId: string;
}

export interface EvaluateEligibilityCommand extends EvaluateProviderEligibilityCommand {
  actorId: string;
}

export const servicePackageEligibilityAuthorityConsequences = Object.freeze({
  servicePackageCreated: true,
  eligibilityEvaluated: true,
  providerAllocated: false,
  providerAccepted: false,
  legalProfessionalAppointmentCreated: false,
  paymentCreated: false,
  invoiceCreated: false,
  filingSubmitted: false,
  officialApplicationCreated: false,
  formalMatterCompletedAutomatically: false,
  userCapabilityVerifiedAutomatically: false,
  officialTruthCreated: false
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function cleanText(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned)
    throw new ServicePackageEligibilityError('INVALID_INPUT', `${field} is required.`, 422);
  return cleaned;
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!uuidPattern.test(cleaned))
    throw new ServicePackageEligibilityError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function assertSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!sha256Pattern.test(cleaned))
    throw new ServicePackageEligibilityError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function cleanSet(values: readonly string[], field: string, allowEmpty = false): string[] {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  if (!allowEmpty && normalized.length === 0)
    throw new ServicePackageEligibilityError('INVALID_INPUT', `${field} is required.`, 422);
  return normalized;
}

function cleanInstant(value: string, field: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf()))
    throw new ServicePackageEligibilityError('INVALID_INPUT', `${field} is invalid.`, 422);
  return instant.toISOString();
}

function normalizeSource(
  commandWorkspaceId: string,
  commandCorrelationId: MarkOrbitId,
  source: Readonly<ProviderExecutionSourceSnapshot>
): ProviderExecutionSourceSnapshot {
  const workspaceId = cleanWorkspaceId(commandWorkspaceId);
  if (cleanWorkspaceId(source.workspaceId) !== workspaceId)
    throw new ServicePackageEligibilityError(
      'PERMISSION_DENIED',
      'Service Package Workspace must match the Execution source Workspace.',
      403
    );
  if (source.correlationId !== commandCorrelationId)
    throw new ServicePackageEligibilityError(
      'SOURCE_VERSION_MISMATCH',
      'Correlation lineage must match the admitted Execution source.',
      409
    );
  const startsAt = cleanInstant(source.executionWindow.startsAt, 'executionWindow.startsAt');
  const endsAt = cleanInstant(source.executionWindow.endsAt, 'executionWindow.endsAt');
  if (new Date(endsAt) <= new Date(startsAt))
    throw new ServicePackageEligibilityError(
      'INVALID_INPUT',
      'Execution window must end after it starts.',
      422
    );
  return {
    ...source,
    workspaceId,
    jurisdiction: cleanText(source.jurisdiction, 'jurisdiction').toUpperCase(),
    serviceType: cleanText(source.serviceType, 'serviceType'),
    serviceScope: cleanSet(source.serviceScope, 'serviceScope'),
    documentReferences: cleanSet(source.documentReferences, 'documentReferences', true),
    instructionReferences: cleanSet(source.instructionReferences, 'instructionReferences', true),
    executionWindow: { startsAt, endsAt },
    sourceFingerprintSha256: assertSha256(
      source.sourceFingerprintSha256,
      'source.sourceFingerprintSha256'
    ),
    capturedAt: cleanInstant(source.capturedAt, 'capturedAt')
  };
}

function packageScope(workspaceId: string, sourceFingerprintSha256: string) {
  return `service-package:${workspaceId}:${sourceFingerprintSha256}`;
}

function eligibilityScope(
  servicePackageId: ServicePackageId,
  providerSupplyCapabilityId: ProviderSupplyCapabilityId
) {
  return `eligibility:${servicePackageId}:${providerSupplyCapabilityId}`;
}

function check(
  code: string,
  pass: boolean,
  reason: string,
  evidenceReferences: readonly string[] = []
): Readonly<EligibilityCheck> {
  return Object.freeze({
    code,
    status: pass ? 'PASS' : 'FAIL',
    blocking: true,
    reason,
    evidenceReferences: [...evidenceReferences]
  });
}

function coversWindow(
  capability: ProviderSupplyCapabilityRecord,
  startsAt: string,
  endsAt: string
): boolean {
  const effectiveFrom = new Date(capability.effectivePeriod.effectiveFrom);
  const effectiveUntil = capability.effectivePeriod.effectiveUntil
    ? new Date(capability.effectivePeriod.effectiveUntil)
    : undefined;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return start >= effectiveFrom && (!effectiveUntil || end <= effectiveUntil);
}

export class ServicePackageEligibilityService {
  constructor(
    private readonly repository: ServicePackageEligibilityRepository,
    private readonly providerRegistry: ProviderRegistryRepository,
    private readonly executionSource: ExecutionSourceAdmissionSource,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly servicePackageIdFactory: () => ServicePackageId = () =>
      `service-package_${randomUUID()}`,
    private readonly eligibilityEvaluationIdFactory: () => EligibilityEvaluationId = () =>
      `eligibility-evaluation_${randomUUID()}`
  ) {}

  async admitServicePackage(command: AdmitServicePackageCommand): Promise<ServicePackageRecord> {
    const actorId = cleanText(command.actorId, 'actorId');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const source = normalizeSource(command.workspaceId, command.correlationId, command.source);
    const scopeKey = packageScope(source.workspaceId, source.sourceFingerprintSha256);
    const requestFingerprint = fingerprint({
      command: 'SERVICE_PACKAGE_ADMIT',
      workspaceId: source.workspaceId,
      source,
      actorId,
      correlationId: command.correlationId
    });
    const replay = await this.servicePackageReplay(scopeKey, idempotencyKey, requestFingerprint);
    if (replay) return replay;

    await this.assertCurrentExecutionSource(source);
    const at = this.now();
    const servicePackageId = this.servicePackageIdFactory();
    const packageFingerprint = fingerprint({
      schemaVersion: 1,
      servicePackageId,
      workspaceId: source.workspaceId,
      version: 1,
      source,
      sourceFingerprintSha256: source.sourceFingerprintSha256,
      jurisdiction: source.jurisdiction,
      serviceType: source.serviceType,
      serviceScope: source.serviceScope,
      status: 'ADMITTED'
    });
    const record: ServicePackageRecord = {
      schemaVersion: 1,
      servicePackageId,
      workspaceId: source.workspaceId,
      version: 1,
      source,
      sourceFingerprintSha256: source.sourceFingerprintSha256,
      servicePackageFingerprintSha256: packageFingerprint,
      jurisdiction: source.jurisdiction,
      serviceType: source.serviceType,
      serviceScope: source.serviceScope,
      status: 'ADMITTED',
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: at,
      updatedAt: at
    };
    return this.repository.createServicePackage(
      record,
      scopeKey,
      idempotencyKey,
      requestFingerprint
    );
  }

  getServicePackage(servicePackageId: ServicePackageId, version?: number) {
    return this.repository.findServicePackage(servicePackageId, version);
  }

  async evaluateProviderEligibility(
    command: EvaluateEligibilityCommand
  ): Promise<EligibilityEvaluationRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const actorId = cleanText(command.actorId, 'actorId');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const expectedPackageFingerprint = assertSha256(
      command.expectedServicePackageFingerprintSha256,
      'expectedServicePackageFingerprintSha256'
    );
    const expectedCapabilityFingerprint = assertSha256(
      command.expectedProviderSupplyCapabilityFingerprintSha256,
      'expectedProviderSupplyCapabilityFingerprintSha256'
    );
    const scopeKey = eligibilityScope(command.servicePackageId, command.providerSupplyCapabilityId);
    const requestFingerprint = fingerprint({
      command: 'ELIGIBILITY_EVALUATE',
      workspaceId,
      servicePackageId: command.servicePackageId,
      expectedServicePackageVersion: command.expectedServicePackageVersion,
      expectedPackageFingerprint,
      providerSupplyCapabilityId: command.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: command.expectedProviderSupplyCapabilityVersion,
      expectedCapabilityFingerprint,
      actorId,
      correlationId: command.correlationId
    });
    const replay = await this.eligibilityReplay(scopeKey, idempotencyKey, requestFingerprint);
    if (replay) return replay;

    const servicePackage = await this.requireServicePackage(command.servicePackageId);
    if (servicePackage.workspaceId !== workspaceId)
      throw new ServicePackageEligibilityError(
        'PERMISSION_DENIED',
        'Service Package belongs to another Workspace.',
        403
      );
    if (servicePackage.version !== command.expectedServicePackageVersion)
      throw new ServicePackageEligibilityError(
        'SOURCE_VERSION_MISMATCH',
        'Service Package version changed.',
        409
      );
    if (servicePackage.servicePackageFingerprintSha256 !== expectedPackageFingerprint)
      throw new ServicePackageEligibilityError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Service Package fingerprint changed.',
        409
      );
    if (servicePackage.status !== 'ADMITTED')
      throw new ServicePackageEligibilityError(
        'STALE_SOURCE',
        'Only an admitted Service Package may be evaluated.',
        409
      );
    if (servicePackage.source.correlationId !== command.correlationId)
      throw new ServicePackageEligibilityError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the Service Package source.',
        409
      );
    await this.assertCurrentExecutionSource(servicePackage.source);

    const capability = await this.requireExactCurrentCapability(
      command.providerSupplyCapabilityId,
      command.expectedProviderSupplyCapabilityVersion,
      expectedCapabilityFingerprint
    );
    const provider = await this.requireProvider(capability.provider.providerId);

    const checks = this.evaluateChecks(servicePackage, provider, capability);
    const outcome = checks.every((item) => item.status === 'PASS') ? 'ELIGIBLE' : 'INELIGIBLE';
    const evaluatedAt = this.now();
    const deterministicFingerprintSha256 = fingerprint({
      policyVersion: MGSN_ELIGIBILITY_POLICY_VERSION,
      servicePackageId: servicePackage.servicePackageId,
      servicePackageVersion: servicePackage.version,
      servicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      providerId: provider.providerId,
      providerVersion: provider.version,
      providerOperationalStatus: provider.operationalStatus,
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      providerSupplyCapabilityVersion: capability.version,
      providerSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
      outcome,
      checks
    });
    const record: EligibilityEvaluationRecord = {
      schemaVersion: 1,
      eligibilityEvaluationId: this.eligibilityEvaluationIdFactory(),
      workspaceId,
      version: 1,
      servicePackage: { id: servicePackage.servicePackageId, version: servicePackage.version },
      servicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      provider: {
        providerId: provider.providerId,
        providerWorkspaceId: provider.providerWorkspaceId,
        displayName: provider.displayName,
        operationalStatus: provider.operationalStatus
      },
      providerVersion: provider.version,
      providerSupplyCapability: {
        id: capability.providerSupplyCapabilityId,
        version: capability.version
      },
      providerSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
      policyVersion: MGSN_ELIGIBILITY_POLICY_VERSION,
      outcome,
      checks,
      deterministicFingerprintSha256,
      evaluatedAt,
      correlationId: command.correlationId,
      createdBy: actorId
    };
    return this.repository.createEligibilityEvaluation(
      record,
      scopeKey,
      idempotencyKey,
      requestFingerprint
    );
  }

  getEligibilityEvaluation(eligibilityEvaluationId: EligibilityEvaluationId) {
    return this.repository.findEligibilityEvaluation(eligibilityEvaluationId);
  }

  listEligibilityEvaluations(servicePackageId: ServicePackageId, limit = 50) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new ServicePackageEligibilityError(
        'INVALID_INPUT',
        'Eligibility review list limit must be between 1 and 100.',
        422
      );
    return this.repository.listEligibilityEvaluations(servicePackageId, limit);
  }

  async listCandidateSupplyCapabilities(
    servicePackageId: ServicePackageId,
    limit = 50
  ): Promise<ProviderSupplyCapabilityRecord[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new ServicePackageEligibilityError(
        'INVALID_INPUT',
        'Candidate list limit must be between 1 and 100.',
        422
      );
    const servicePackage = await this.requireServicePackage(servicePackageId);
    const providers = await this.providerRegistry.listProviders();
    const result: ProviderSupplyCapabilityRecord[] = [];
    for (const provider of providers) {
      if (provider.operationalStatus !== 'ACTIVE') continue;
      const capabilities = await this.providerRegistry.listCurrentSupplyCapabilities(
        provider.providerId
      );
      for (const capability of capabilities) {
        if (
          capability.status === 'ACTIVE' &&
          capability.jurisdictions.includes(servicePackage.jurisdiction) &&
          capability.serviceTypes.includes(servicePackage.serviceType)
        ) {
          result.push(capability);
          if (result.length >= limit) return result;
        }
      }
    }
    return result;
  }

  private evaluateChecks(
    servicePackage: ServicePackageRecord,
    provider: ProviderRegistryRecord,
    capability: ProviderSupplyCapabilityRecord
  ): ReadonlyArray<Readonly<EligibilityCheck>> {
    const providerMatches = capability.provider.providerId === provider.providerId;
    return Object.freeze([
      check('SOURCE_CURRENT', true, 'Exact governed Execution source is current.'),
      check(
        'PROVIDER_MATCH',
        providerMatches,
        providerMatches
          ? 'Supply Capability belongs to the evaluated Provider.'
          : 'Supply Capability Provider lineage does not match.'
      ),
      check(
        'PROVIDER_ACTIVE',
        provider.operationalStatus === 'ACTIVE',
        provider.operationalStatus === 'ACTIVE'
          ? 'Provider is operationally active.'
          : `Provider is ${provider.operationalStatus}.`
      ),
      check(
        'SUPPLY_ACTIVE',
        capability.status === 'ACTIVE',
        capability.status === 'ACTIVE'
          ? 'Supply Capability is active.'
          : `Supply Capability is ${capability.status}.`
      ),
      check(
        'SUPPLY_VERIFIED',
        capability.verificationState === 'VERIFIED_FOR_SUPPLY',
        capability.verificationState === 'VERIFIED_FOR_SUPPLY'
          ? 'Supply evidence is verified for private MGSN supply operations.'
          : `Supply verification state is ${capability.verificationState}.`,
        capability.evidenceReferences
      ),
      check(
        'JURISDICTION_MATCH',
        capability.jurisdictions.includes(servicePackage.jurisdiction),
        capability.jurisdictions.includes(servicePackage.jurisdiction)
          ? `Supply covers ${servicePackage.jurisdiction}.`
          : `Supply does not cover ${servicePackage.jurisdiction}.`
      ),
      check(
        'SERVICE_TYPE_MATCH',
        capability.serviceTypes.includes(servicePackage.serviceType),
        capability.serviceTypes.includes(servicePackage.serviceType)
          ? `Supply covers ${servicePackage.serviceType}.`
          : `Supply does not cover ${servicePackage.serviceType}.`
      ),
      check(
        'EFFECTIVE_WINDOW',
        coversWindow(
          capability,
          servicePackage.source.executionWindow.startsAt,
          servicePackage.source.executionWindow.endsAt
        ),
        coversWindow(
          capability,
          servicePackage.source.executionWindow.startsAt,
          servicePackage.source.executionWindow.endsAt
        )
          ? 'Supply effective period covers the requested execution window.'
          : 'Supply effective period does not cover the requested execution window.'
      ),
      check(
        'AVAILABILITY',
        capability.availabilityUnits > 0,
        capability.availabilityUnits > 0
          ? `Supply has ${capability.availabilityUnits} available unit(s).`
          : 'Supply has no available capacity.'
      )
    ]);
  }

  private async assertCurrentExecutionSource(
    source: Readonly<ProviderExecutionSourceSnapshot>
  ): Promise<void> {
    let verification: ExecutionSourceVerification;
    try {
      verification = await this.executionSource.verifyCurrentSource(source);
    } catch (cause) {
      if (cause instanceof ServicePackageEligibilityError) throw cause;
      throw new ServicePackageEligibilityError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution source verification is unavailable.',
        503,
        { cause: cause instanceof Error ? cause.message : String(cause) }
      );
    }
    if (verification.status !== 'CURRENT')
      throw new ServicePackageEligibilityError(
        'STALE_SOURCE',
        verification.reason ?? 'Governed Execution source is missing or stale.',
        409,
        { sourceStatus: verification.status }
      );
    if (
      !verification.exactSourceFingerprintSha256 ||
      verification.exactSourceFingerprintSha256 !== source.sourceFingerprintSha256
    )
      throw new ServicePackageEligibilityError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Execution source fingerprint no longer matches the admitted exact source.',
        409
      );
  }

  private async requireServicePackage(servicePackageId: ServicePackageId) {
    const record = await this.repository.findServicePackage(servicePackageId);
    if (!record)
      throw new ServicePackageEligibilityError(
        'SERVICE_PACKAGE_NOT_FOUND',
        'Service Package was not found.',
        404
      );
    return record;
  }

  private async requireExactCurrentCapability(
    providerSupplyCapabilityId: ProviderSupplyCapabilityId,
    expectedVersion: number,
    expectedFingerprint: string
  ) {
    const exact = await this.providerRegistry.findSupplyCapability(
      providerSupplyCapabilityId,
      expectedVersion
    );
    if (!exact)
      throw new ServicePackageEligibilityError(
        'SUPPLY_CAPABILITY_INACTIVE',
        'Exact Provider Supply Capability version was not found.',
        409
      );
    if (exact.sourceFingerprintSha256 !== expectedFingerprint)
      throw new ServicePackageEligibilityError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Provider Supply Capability fingerprint changed.',
        409
      );
    const current = await this.providerRegistry.findSupplyCapability(providerSupplyCapabilityId);
    if (!current || current.version !== exact.version)
      throw new ServicePackageEligibilityError(
        'SOURCE_VERSION_MISMATCH',
        'Provider Supply Capability is no longer the current version.',
        409
      );
    return exact;
  }

  private async requireProvider(providerId: ProviderId) {
    const provider = await this.providerRegistry.findProviderById(providerId);
    if (!provider)
      throw new ServicePackageEligibilityError(
        'PROVIDER_NOT_FOUND',
        'Provider was not found.',
        404
      );
    return provider;
  }

  private async servicePackageReplay(
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    const replay = await this.repository.findReplay(scopeKey, idempotencyKey);
    if (!replay) return undefined;
    if (replay.fingerprint !== requestFingerprint)
      throw new ServicePackageEligibilityError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.',
        409
      );
    if (replay.targetType !== 'SERVICE_PACKAGE' || !('servicePackageId' in replay.responseRecord))
      throw new ServicePackageEligibilityError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Service Package result is unavailable.',
        503
      );
    return replay.responseRecord;
  }

  private async eligibilityReplay(
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    const replay = await this.repository.findReplay(scopeKey, idempotencyKey);
    if (!replay) return undefined;
    if (replay.fingerprint !== requestFingerprint)
      throw new ServicePackageEligibilityError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.',
        409
      );
    if (
      replay.targetType !== 'ELIGIBILITY_EVALUATION' ||
      !('eligibilityEvaluationId' in replay.responseRecord)
    )
      throw new ServicePackageEligibilityError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Eligibility result is unavailable.',
        503
      );
    return replay.responseRecord;
  }
}
