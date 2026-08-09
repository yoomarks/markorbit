import { createHash, randomUUID } from 'node:crypto';
import type {
  ProviderId,
  ProviderOperationalStatus,
  ProviderReference,
  ProviderSupplyCapability,
  ProviderSupplyCapabilityId,
  ProviderSupplyCapabilityStatus
} from '@markorbit/contracts/provider-execution';

export type ProviderSupplyVerificationState =
  'UNVERIFIED' | 'EVIDENCE_RECORDED' | 'VERIFIED_FOR_SUPPLY';

export interface ProviderRegistryRecord extends ProviderReference {
  schemaVersion: 1;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSupplyCapabilityRecord extends ProviderSupplyCapability {
  availabilityUnits: number;
  verificationState: ProviderSupplyVerificationState;
  createdBy: string;
  updatedBy: string;
}

export interface CoreWorkspaceIdentityReference {
  workspaceId: string;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface CoreWorkspaceIdentitySource {
  getWorkspace(workspaceId: string): Promise<CoreWorkspaceIdentityReference | undefined>;
}

export interface ProviderRegistryReplay {
  fingerprint: string;
  targetType: 'PROVIDER' | 'SUPPLY_CAPABILITY';
  targetId: string;
  responseVersion: number;
  responseRecord: ProviderRegistryRecord | ProviderSupplyCapabilityRecord;
}

export interface ProviderRegistryRepository {
  findReplay(scopeKey: string, idempotencyKey: string): Promise<ProviderRegistryReplay | undefined>;
  findProviderById(providerId: ProviderId): Promise<ProviderRegistryRecord | undefined>;
  findProviderByWorkspaceId(
    providerWorkspaceId: string
  ): Promise<ProviderRegistryRecord | undefined>;
  listProviders(): Promise<ProviderRegistryRecord[]>;
  createProvider(
    record: ProviderRegistryRecord,
    scopeKey: string,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<ProviderRegistryRecord>;
  updateProvider(
    record: ProviderRegistryRecord,
    expectedVersion: number,
    scopeKey: string,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<ProviderRegistryRecord>;
  findSupplyCapability(
    providerSupplyCapabilityId: ProviderSupplyCapabilityId,
    version?: number
  ): Promise<ProviderSupplyCapabilityRecord | undefined>;
  listCurrentSupplyCapabilities(providerId: ProviderId): Promise<ProviderSupplyCapabilityRecord[]>;
  createSupplyCapability(
    record: ProviderSupplyCapabilityRecord,
    scopeKey: string,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<ProviderSupplyCapabilityRecord>;
  reviseSupplyCapability(
    record: ProviderSupplyCapabilityRecord,
    expectedVersion: number,
    scopeKey: string,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<ProviderSupplyCapabilityRecord>;
}

export type ProviderRegistryErrorCode =
  | 'INVALID_PROVIDER_INPUT'
  | 'CORE_WORKSPACE_NOT_FOUND'
  | 'CORE_WORKSPACE_INACTIVE'
  | 'PROVIDER_IDENTITY_EXISTS'
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_INACTIVE'
  | 'INVALID_PROVIDER_STATUS_TRANSITION'
  | 'STALE_PROVIDER'
  | 'SUPPLY_CAPABILITY_NOT_FOUND'
  | 'SUPPLY_CAPABILITY_EXISTS'
  | 'STALE_SUPPLY_CAPABILITY'
  | 'INVALID_EFFECTIVE_PERIOD'
  | 'INVALID_CAPACITY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class ProviderRegistryError extends Error {
  constructor(
    public readonly code: ProviderRegistryErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'ProviderRegistryError';
  }
}

export interface CreateProviderCommand {
  providerWorkspaceId: string;
  displayName: string;
  actorId: string;
  idempotencyKey: string;
}

export interface SetProviderOperationalStatusCommand {
  providerId: ProviderId;
  expectedVersion: number;
  operationalStatus: ProviderOperationalStatus;
  actorId: string;
  idempotencyKey: string;
}

export interface CreateProviderSupplyCapabilityCommand {
  providerId: ProviderId;
  status?: ProviderSupplyCapabilityStatus;
  jurisdictions: readonly string[];
  serviceTypes: readonly string[];
  effectiveFrom: string;
  effectiveUntil?: string;
  capacityUnits: number;
  availabilityUnits: number;
  evidenceReferences: readonly string[];
  verificationState: ProviderSupplyVerificationState;
  actorId: string;
  idempotencyKey: string;
}

export interface ReviseProviderSupplyCapabilityCommand {
  providerSupplyCapabilityId: ProviderSupplyCapabilityId;
  expectedVersion: number;
  status: ProviderSupplyCapabilityStatus;
  jurisdictions: readonly string[];
  serviceTypes: readonly string[];
  effectiveFrom: string;
  effectiveUntil?: string;
  capacityUnits: number;
  availabilityUnits: number;
  evidenceReferences: readonly string[];
  verificationState: ProviderSupplyVerificationState;
  actorId: string;
  idempotencyKey: string;
}

export const providerRegistryAuthorityConsequences = Object.freeze({
  providerNetworkRecordCreated: true,
  providerSupplyCapabilityRecorded: true,
  userCapabilityVerifiedAutomatically: false,
  professionalQualifiedAutomatically: false,
  providerAllocated: false,
  providerAccepted: false,
  legalProfessionalAppointmentCreated: false,
  paymentCreated: false,
  invoiceCreated: false,
  filingSubmitted: false,
  officialApplicationCreated: false,
  officialTruthCreated: false
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const providerStatuses = new Set<ProviderOperationalStatus>(['ACTIVE', 'SUSPENDED', 'INACTIVE']);
const supplyStatuses = new Set<ProviderSupplyCapabilityStatus>(['ACTIVE', 'SUSPENDED', 'RETIRED']);
const verificationStates = new Set<ProviderSupplyVerificationState>([
  'UNVERIFIED',
  'EVIDENCE_RECORDED',
  'VERIFIED_FOR_SUPPLY'
]);

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cleanText(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned)
    throw new ProviderRegistryError('INVALID_PROVIDER_INPUT', `${field} is required.`, 422);
  return cleaned;
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim();
  if (!uuidPattern.test(cleaned))
    throw new ProviderRegistryError(
      'INVALID_PROVIDER_INPUT',
      'providerWorkspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned.toLowerCase();
}

function cleanSet(values: readonly string[], field: string, allowEmpty = false): string[] {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  if (!allowEmpty && normalized.length === 0)
    throw new ProviderRegistryError('INVALID_PROVIDER_INPUT', `${field} is required.`, 422);
  return normalized;
}

function cleanEffectivePeriod(effectiveFrom: string, effectiveUntil?: string) {
  const from = new Date(effectiveFrom);
  const until = effectiveUntil ? new Date(effectiveUntil) : undefined;
  if (Number.isNaN(from.valueOf()) || (until && Number.isNaN(until.valueOf())))
    throw new ProviderRegistryError(
      'INVALID_EFFECTIVE_PERIOD',
      'Supply Capability effective period must contain valid timestamps.',
      422
    );
  if (until && until <= from)
    throw new ProviderRegistryError(
      'INVALID_EFFECTIVE_PERIOD',
      'effectiveUntil must be later than effectiveFrom.',
      422
    );
  return {
    effectiveFrom: from.toISOString(),
    ...(until ? { effectiveUntil: until.toISOString() } : {})
  };
}

function cleanCapacity(capacityUnits: number, availabilityUnits: number) {
  if (
    !Number.isInteger(capacityUnits) ||
    capacityUnits < 0 ||
    !Number.isInteger(availabilityUnits) ||
    availabilityUnits < 0 ||
    availabilityUnits > capacityUnits
  )
    throw new ProviderRegistryError(
      'INVALID_CAPACITY',
      'availabilityUnits must be an integer between zero and capacityUnits.',
      422
    );
  return { capacityUnits, availabilityUnits };
}

function providerReference(record: ProviderRegistryRecord): Readonly<ProviderReference> {
  return Object.freeze({
    providerId: record.providerId,
    providerWorkspaceId: record.providerWorkspaceId,
    displayName: record.displayName,
    operationalStatus: record.operationalStatus
  });
}

function providerScope(providerId: ProviderId) {
  return `provider:${providerId}`;
}
function providerWorkspaceScope(providerWorkspaceId: string) {
  return `provider-workspace:${providerWorkspaceId}`;
}
function capabilityScope(providerSupplyCapabilityId: ProviderSupplyCapabilityId) {
  return `supply-capability:${providerSupplyCapabilityId}`;
}

export function isSupplyOperationallyEligibleAt(
  provider: ProviderRegistryRecord,
  capability: ProviderSupplyCapabilityRecord,
  at: string
): boolean {
  const instant = new Date(at);
  if (Number.isNaN(instant.valueOf())) return false;
  if (provider.operationalStatus !== 'ACTIVE' || capability.status !== 'ACTIVE') return false;
  if (provider.providerId !== capability.provider.providerId) return false;
  if (capability.availabilityUnits <= 0) return false;
  const from = new Date(capability.effectivePeriod.effectiveFrom);
  const until = capability.effectivePeriod.effectiveUntil
    ? new Date(capability.effectivePeriod.effectiveUntil)
    : undefined;
  return instant >= from && (!until || instant < until);
}

export class ProviderRegistryService {
  constructor(
    private readonly repository: ProviderRegistryRepository,
    private readonly coreWorkspaces: CoreWorkspaceIdentitySource,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly providerIdFactory: () => ProviderId = () => `provider_${randomUUID()}`,
    private readonly supplyCapabilityIdFactory: () => ProviderSupplyCapabilityId = () =>
      `provider-supply-capability_${randomUUID()}`
  ) {}

  async createProvider(command: CreateProviderCommand): Promise<ProviderRegistryRecord> {
    const providerWorkspaceId = cleanWorkspaceId(command.providerWorkspaceId);
    const displayName = cleanText(command.displayName, 'displayName');
    const actorId = cleanText(command.actorId, 'actorId');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const scopeKey = providerWorkspaceScope(providerWorkspaceId);
    const requestFingerprint = fingerprint({
      command: 'PROVIDER_CREATE',
      providerWorkspaceId,
      displayName,
      actorId
    });
    const replay = await this.providerReplay(scopeKey, idempotencyKey, requestFingerprint);
    if (replay) return replay;

    await this.assertActiveCoreWorkspace(providerWorkspaceId);
    const at = this.now();
    const record: ProviderRegistryRecord = {
      schemaVersion: 1,
      providerId: this.providerIdFactory(),
      providerWorkspaceId,
      displayName,
      operationalStatus: 'ACTIVE',
      version: 1,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: at,
      updatedAt: at
    };
    return this.repository.createProvider(record, scopeKey, idempotencyKey, requestFingerprint);
  }

  async getProvider(providerId: ProviderId) {
    return this.repository.findProviderById(providerId);
  }

  listProviders() {
    return this.repository.listProviders();
  }

  async setProviderOperationalStatus(
    command: SetProviderOperationalStatusCommand
  ): Promise<ProviderRegistryRecord> {
    if (!providerStatuses.has(command.operationalStatus))
      throw new ProviderRegistryError(
        'INVALID_PROVIDER_INPUT',
        'Unknown provider operational status.',
        422
      );
    const actorId = cleanText(command.actorId, 'actorId');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const scopeKey = providerScope(command.providerId);
    const requestFingerprint = fingerprint({
      command: 'PROVIDER_STATUS',
      providerId: command.providerId,
      expectedVersion: command.expectedVersion,
      operationalStatus: command.operationalStatus,
      actorId
    });
    const replay = await this.providerReplay(scopeKey, idempotencyKey, requestFingerprint);
    if (replay) return replay;

    const current = await this.requireProvider(command.providerId);
    if (current.version !== command.expectedVersion)
      throw new ProviderRegistryError(
        'STALE_PROVIDER',
        'Provider changed; reload the exact latest version.',
        409
      );
    if (current.operationalStatus === command.operationalStatus)
      throw new ProviderRegistryError(
        'INVALID_PROVIDER_STATUS_TRANSITION',
        'Provider is already in the requested operational state.',
        409
      );
    if (current.operationalStatus === 'INACTIVE')
      throw new ProviderRegistryError(
        'INVALID_PROVIDER_STATUS_TRANSITION',
        'INACTIVE provider records are terminal in the M4 registry boundary.',
        409
      );
    if (command.operationalStatus === 'ACTIVE')
      await this.assertActiveCoreWorkspace(current.providerWorkspaceId);
    const next: ProviderRegistryRecord = {
      ...current,
      operationalStatus: command.operationalStatus,
      version: current.version + 1,
      updatedBy: actorId,
      updatedAt: this.now()
    };
    return this.repository.updateProvider(
      next,
      current.version,
      scopeKey,
      idempotencyKey,
      requestFingerprint
    );
  }

  async createSupplyCapability(
    command: CreateProviderSupplyCapabilityCommand
  ): Promise<ProviderSupplyCapabilityRecord> {
    const normalized = this.normalizeSupplyCommand(command);
    const scopeKey = providerScope(command.providerId);
    const requestFingerprint = fingerprint({ command: 'SUPPLY_CREATE', ...normalized });
    const replay = await this.supplyReplay(scopeKey, normalized.idempotencyKey, requestFingerprint);
    if (replay) return replay;

    const provider = await this.requireProvider(command.providerId);
    if (provider.operationalStatus === 'INACTIVE')
      throw new ProviderRegistryError(
        'PROVIDER_INACTIVE',
        'Cannot add supply to an inactive provider record.',
        409
      );
    const at = this.now();
    const providerSnapshot = providerReference(provider);
    const sourceFingerprintSha256 = fingerprint({
      provider: providerSnapshot,
      status: normalized.status,
      jurisdictions: normalized.jurisdictions,
      serviceTypes: normalized.serviceTypes,
      effectivePeriod: normalized.effectivePeriod,
      capacityUnits: normalized.capacityUnits,
      availabilityUnits: normalized.availabilityUnits,
      evidenceReferences: normalized.evidenceReferences,
      verificationState: normalized.verificationState
    });
    const record: ProviderSupplyCapabilityRecord = {
      schemaVersion: 1,
      providerSupplyCapabilityId: this.supplyCapabilityIdFactory(),
      provider: providerSnapshot,
      version: 1,
      status: normalized.status,
      jurisdictions: normalized.jurisdictions,
      serviceTypes: normalized.serviceTypes,
      effectivePeriod: normalized.effectivePeriod,
      capacityUnits: normalized.capacityUnits,
      availabilityUnits: normalized.availabilityUnits,
      evidenceReferences: normalized.evidenceReferences,
      verificationState: normalized.verificationState,
      sourceFingerprintSha256,
      createdBy: normalized.actorId,
      updatedBy: normalized.actorId,
      createdAt: at,
      updatedAt: at
    };
    return this.repository.createSupplyCapability(
      record,
      scopeKey,
      normalized.idempotencyKey,
      requestFingerprint
    );
  }

  async reviseSupplyCapability(
    command: ReviseProviderSupplyCapabilityCommand
  ): Promise<ProviderSupplyCapabilityRecord> {
    const normalized = this.normalizeSupplyCommand(command);
    const scopeKey = capabilityScope(command.providerSupplyCapabilityId);
    const requestFingerprint = fingerprint({
      command: 'SUPPLY_REVISE',
      providerSupplyCapabilityId: command.providerSupplyCapabilityId,
      expectedVersion: command.expectedVersion,
      ...normalized
    });
    const replay = await this.supplyReplay(scopeKey, normalized.idempotencyKey, requestFingerprint);
    if (replay) return replay;

    const current = await this.repository.findSupplyCapability(command.providerSupplyCapabilityId);
    if (!current)
      throw new ProviderRegistryError(
        'SUPPLY_CAPABILITY_NOT_FOUND',
        'Provider Supply Capability was not found.',
        404
      );
    if (current.version !== command.expectedVersion)
      throw new ProviderRegistryError(
        'STALE_SUPPLY_CAPABILITY',
        'Provider Supply Capability changed; reload the exact latest version.',
        409
      );
    const provider = await this.requireProvider(current.provider.providerId);
    const providerSnapshot = providerReference(provider);
    const sourceFingerprintSha256 = fingerprint({
      provider: providerSnapshot,
      status: normalized.status,
      jurisdictions: normalized.jurisdictions,
      serviceTypes: normalized.serviceTypes,
      effectivePeriod: normalized.effectivePeriod,
      capacityUnits: normalized.capacityUnits,
      availabilityUnits: normalized.availabilityUnits,
      evidenceReferences: normalized.evidenceReferences,
      verificationState: normalized.verificationState
    });
    const next: ProviderSupplyCapabilityRecord = {
      ...current,
      provider: providerSnapshot,
      version: current.version + 1,
      status: normalized.status,
      jurisdictions: normalized.jurisdictions,
      serviceTypes: normalized.serviceTypes,
      effectivePeriod: normalized.effectivePeriod,
      capacityUnits: normalized.capacityUnits,
      availabilityUnits: normalized.availabilityUnits,
      evidenceReferences: normalized.evidenceReferences,
      verificationState: normalized.verificationState,
      sourceFingerprintSha256,
      updatedBy: normalized.actorId,
      updatedAt: this.now()
    };
    return this.repository.reviseSupplyCapability(
      next,
      current.version,
      scopeKey,
      normalized.idempotencyKey,
      requestFingerprint
    );
  }

  getSupplyCapability(providerSupplyCapabilityId: ProviderSupplyCapabilityId, version?: number) {
    return this.repository.findSupplyCapability(providerSupplyCapabilityId, version);
  }

  listCurrentSupplyCapabilities(providerId: ProviderId) {
    return this.repository.listCurrentSupplyCapabilities(providerId);
  }

  private async assertActiveCoreWorkspace(providerWorkspaceId: string) {
    const workspace = await this.coreWorkspaces.getWorkspace(providerWorkspaceId);
    if (!workspace || workspace.workspaceId !== providerWorkspaceId)
      throw new ProviderRegistryError(
        'CORE_WORKSPACE_NOT_FOUND',
        'Referenced Core Workspace identity was not found.',
        422
      );
    if (workspace.status !== 'ACTIVE')
      throw new ProviderRegistryError(
        'CORE_WORKSPACE_INACTIVE',
        'Referenced Core Workspace identity is archived.',
        409
      );
  }

  private async requireProvider(providerId: ProviderId) {
    const provider = await this.repository.findProviderById(providerId);
    if (!provider)
      throw new ProviderRegistryError('PROVIDER_NOT_FOUND', 'Provider was not found.', 404);
    return provider;
  }

  private async providerReplay(scopeKey: string, key: string, requestFingerprint: string) {
    const replay = await this.repository.findReplay(scopeKey, key);
    if (!replay) return undefined;
    if (replay.fingerprint !== requestFingerprint)
      throw new ProviderRegistryError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.',
        409
      );
    if (replay.targetType !== 'PROVIDER')
      throw new ProviderRegistryError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key belongs to a different command family.',
        409
      );
    const record = replay.responseRecord as ProviderRegistryRecord;
    if (record.providerId !== replay.targetId || record.version !== replay.responseVersion)
      throw new ProviderRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Provider result is unavailable.',
        503
      );
    return record;
  }

  private async supplyReplay(scopeKey: string, key: string, requestFingerprint: string) {
    const replay = await this.repository.findReplay(scopeKey, key);
    if (!replay) return undefined;
    if (replay.fingerprint !== requestFingerprint)
      throw new ProviderRegistryError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.',
        409
      );
    if (replay.targetType !== 'SUPPLY_CAPABILITY')
      throw new ProviderRegistryError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key belongs to a different command family.',
        409
      );
    const record = replay.responseRecord as ProviderSupplyCapabilityRecord;
    if (
      record.providerSupplyCapabilityId !== replay.targetId ||
      record.version !== replay.responseVersion
    )
      throw new ProviderRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Supply Capability result is unavailable.',
        503
      );
    return record;
  }

  private normalizeSupplyCommand(
    command: CreateProviderSupplyCapabilityCommand | ReviseProviderSupplyCapabilityCommand
  ) {
    const status = command.status ?? 'ACTIVE';
    if (!supplyStatuses.has(status))
      throw new ProviderRegistryError(
        'INVALID_PROVIDER_INPUT',
        'Unknown Provider Supply Capability status.',
        422
      );
    if (!verificationStates.has(command.verificationState))
      throw new ProviderRegistryError(
        'INVALID_PROVIDER_INPUT',
        'Unknown supply verification state.',
        422
      );
    const evidenceReferences = cleanSet(command.evidenceReferences, 'evidenceReferences', true);
    if (command.verificationState === 'VERIFIED_FOR_SUPPLY' && evidenceReferences.length === 0)
      throw new ProviderRegistryError(
        'INVALID_PROVIDER_INPUT',
        'VERIFIED_FOR_SUPPLY requires bounded supply evidence references.',
        422
      );
    return {
      providerId: 'providerId' in command ? command.providerId : undefined,
      status,
      jurisdictions: cleanSet(command.jurisdictions, 'jurisdictions'),
      serviceTypes: cleanSet(command.serviceTypes, 'serviceTypes'),
      effectivePeriod: cleanEffectivePeriod(command.effectiveFrom, command.effectiveUntil),
      ...cleanCapacity(command.capacityUnits, command.availabilityUnits),
      evidenceReferences,
      verificationState: command.verificationState,
      actorId: cleanText(command.actorId, 'actorId'),
      idempotencyKey: cleanText(command.idempotencyKey, 'idempotencyKey')
    };
  }
}
