import { createHash, randomUUID } from 'node:crypto';
import { channels, relationshipModels } from '@markorbit/contracts';
import type {
  ResolvedSiteRuntimeV1,
  SiteConfigurationVersionV1,
  SiteHostBindingV1,
  SiteInstallationV1,
  SiteKindV1,
  SiteRuntimeCommercialAccessV1
} from '@markorbit/contracts/site';

export type SiteServiceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_KEY_REUSE'
  | 'WORKSPACE_MISMATCH'
  | 'SITE_NOT_ACTIVE'
  | 'HOST_NOT_ACTIVE'
  | 'HOST_AMBIGUOUS'
  | 'COMMERCIAL_ACCESS_DENIED'
  | 'COMMERCIAL_AUTHORITY_UNAVAILABLE';

export class SiteServiceError extends Error {
  constructor(
    readonly code: SiteServiceErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'SiteServiceError';
  }
}

export interface SiteCommercialAuthorityV1 {
  assertCurrentAccess(
    input: Readonly<{
      workspaceId: string;
      installationId: string;
      installationVersion: number;
      entitlementKeys: readonly string[];
      asOf: string;
    }>
  ): Promise<Readonly<SiteRuntimeCommercialAccessV1>>;
}

export interface SiteMutationV1<T> {
  workspaceId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  response: T;
  expectedSiteVersion?: number;
  expectedBindingVersion?: number;
  installation?: SiteInstallationV1;
  configuration?: SiteConfigurationVersionV1;
  binding?: SiteHostBindingV1;
}

export interface SiteRepositoryV1 {
  replayCommand<T>(
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<T | undefined>;
  commitMutation<T>(mutation: Readonly<SiteMutationV1<T>>): Promise<T>;
  listCurrentInstallations(workspaceId: string): Promise<readonly SiteInstallationV1[]>;
  getCurrentInstallation(siteId: string): Promise<SiteInstallationV1 | undefined>;
  getConfiguration(
    siteId: string,
    version: number
  ): Promise<SiteConfigurationVersionV1 | undefined>;
  getCurrentBinding(bindingId: string): Promise<SiteHostBindingV1 | undefined>;
  listCurrentBindings(siteId: string): Promise<readonly SiteHostBindingV1[]>;
  findActiveBindings(normalizedHostname: string): Promise<readonly SiteHostBindingV1[]>;
}

const clone = <T>(value: T): T => structuredClone(value);

interface ReplayRecord {
  fingerprint: string;
  response: unknown;
}

export class InMemorySiteRepositoryV1 implements SiteRepositoryV1 {
  private readonly commands = new Map<string, ReplayRecord>();
  private readonly installationVersions = new Map<string, SiteInstallationV1>();
  private readonly installationHeads = new Map<string, SiteInstallationV1>();
  private readonly configurations = new Map<string, SiteConfigurationVersionV1>();
  private readonly bindingVersions = new Map<string, SiteHostBindingV1>();
  private readonly bindingHeads = new Map<string, SiteHostBindingV1>();

  replayCommand<T>(
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<T | undefined> {
    const replay = this.commands.get(`${workspaceId}:${idempotencyKey}`);
    if (!replay) return Promise.resolve(undefined);
    if (replay.fingerprint !== requestFingerprint)
      throw new SiteServiceError(
        'IDEMPOTENCY_KEY_REUSE',
        'Idempotency key is already bound to another Site command.'
      );
    return Promise.resolve(clone(replay.response) as T);
  }

  commitMutation<T>(mutation: Readonly<SiteMutationV1<T>>): Promise<T> {
    const commandKey = `${mutation.workspaceId}:${mutation.idempotencyKey}`;
    const replay = this.commands.get(commandKey);
    if (replay) {
      if (replay.fingerprint !== mutation.requestFingerprint)
        throw new SiteServiceError(
          'IDEMPOTENCY_KEY_REUSE',
          'Idempotency key is already bound to another Site command.'
        );
      return Promise.resolve(clone(replay.response) as T);
    }
    if (mutation.expectedSiteVersion !== undefined) {
      const siteId = mutation.installation?.siteId ?? mutation.binding?.siteId;
      const current = siteId ? this.installationHeads.get(siteId) : undefined;
      if ((current?.version ?? 0) !== mutation.expectedSiteVersion)
        throw new SiteServiceError('CONFLICT', 'Expected Site version is no longer current.');
      if (current && current.workspaceId !== mutation.workspaceId)
        throw new SiteServiceError('WORKSPACE_MISMATCH', 'Site belongs to another Workspace.');
    }
    if (mutation.expectedBindingVersion !== undefined) {
      const bindingId = mutation.binding?.bindingId;
      const current = bindingId ? this.bindingHeads.get(bindingId) : undefined;
      if ((current?.version ?? 0) !== mutation.expectedBindingVersion)
        throw new SiteServiceError(
          'CONFLICT',
          'Expected host binding version is no longer current.'
        );
      if (current && current.workspaceId !== mutation.workspaceId)
        throw new SiteServiceError(
          'WORKSPACE_MISMATCH',
          'Host binding belongs to another Workspace.'
        );
    }
    if (mutation.binding?.status === 'ACTIVE') {
      const conflict = [...this.bindingHeads.values()].find(
        (value) =>
          value.status === 'ACTIVE' &&
          value.normalizedHostname === mutation.binding!.normalizedHostname &&
          value.bindingId !== mutation.binding!.bindingId
      );
      if (conflict)
        throw new SiteServiceError('CONFLICT', 'Hostname is already active for another Site.');
    }
    if (mutation.configuration) {
      const storageKey = `${mutation.configuration.siteId}:${mutation.configuration.version}`;
      if (this.configurations.has(storageKey))
        throw new SiteServiceError('CONFLICT', 'Site configuration version already exists.');
      this.configurations.set(storageKey, clone(mutation.configuration));
    }
    if (mutation.installation) {
      const storageKey = `${mutation.installation.siteId}:${mutation.installation.version}`;
      if (this.installationVersions.has(storageKey))
        throw new SiteServiceError('CONFLICT', 'Site installation version already exists.');
      this.installationVersions.set(storageKey, clone(mutation.installation));
      this.installationHeads.set(mutation.installation.siteId, clone(mutation.installation));
    }
    if (mutation.binding) {
      const storageKey = `${mutation.binding.bindingId}:${mutation.binding.version}`;
      if (this.bindingVersions.has(storageKey))
        throw new SiteServiceError('CONFLICT', 'Site host binding version already exists.');
      this.bindingVersions.set(storageKey, clone(mutation.binding));
      this.bindingHeads.set(mutation.binding.bindingId, clone(mutation.binding));
    }
    this.commands.set(commandKey, {
      fingerprint: mutation.requestFingerprint,
      response: clone(mutation.response)
    });
    return Promise.resolve(clone(mutation.response));
  }

  listCurrentInstallations(workspaceId: string): Promise<readonly SiteInstallationV1[]> {
    return Promise.resolve(
      [...this.installationHeads.values()]
        .filter((value) => value.workspaceId === workspaceId)
        .map(clone)
    );
  }

  getCurrentInstallation(siteId: string): Promise<SiteInstallationV1 | undefined> {
    const value = this.installationHeads.get(siteId);
    return Promise.resolve(value && clone(value));
  }

  getConfiguration(
    siteId: string,
    version: number
  ): Promise<SiteConfigurationVersionV1 | undefined> {
    const value = this.configurations.get(`${siteId}:${version}`);
    return Promise.resolve(value && clone(value));
  }

  getCurrentBinding(bindingId: string): Promise<SiteHostBindingV1 | undefined> {
    const value = this.bindingHeads.get(bindingId);
    return Promise.resolve(value && clone(value));
  }

  listCurrentBindings(siteId: string): Promise<readonly SiteHostBindingV1[]> {
    return Promise.resolve(
      [...this.bindingHeads.values()]
        .filter((value) => value.siteId === siteId)
        .sort((left, right) => left.bindingId.localeCompare(right.bindingId))
        .map(clone)
    );
  }

  findActiveBindings(normalizedHostname: string): Promise<readonly SiteHostBindingV1[]> {
    return Promise.resolve(
      [...this.bindingHeads.values()]
        .filter(
          (value) => value.status === 'ACTIVE' && value.normalizedHostname === normalizedHostname
        )
        .map(clone)
    );
  }
}

export interface SiteConfigurationInputV1 {
  brand: SiteConfigurationVersionV1['brand'];
  localization: SiteConfigurationVersionV1['localization'];
  roles: SiteConfigurationVersionV1['roles'];
  services: SiteConfigurationVersionV1['services'];
  contentSlots: SiteConfigurationVersionV1['contentSlots'];
  attributionPolicyRef?: SiteConfigurationVersionV1['attributionPolicyRef'];
  sourceRef: string;
}

export interface CreateSiteCommandV1 {
  workspaceId: string;
  kind: SiteKindV1;
  coreSiteInstallationRef: SiteInstallationV1['coreSiteInstallationRef'];
  configuration: SiteConfigurationInputV1;
  sourceRef: string;
  idempotencyKey: string;
}

export interface ReviseSiteConfigurationCommandV1 {
  workspaceId: string;
  siteId: string;
  expectedSiteVersion: number;
  configuration: SiteConfigurationInputV1;
  idempotencyKey: string;
}

export interface CreateSiteHostBindingCommandV1 {
  workspaceId: string;
  siteId: string;
  expectedSiteVersion: number;
  hostname: string;
  bindingType: SiteHostBindingV1['bindingType'];
  verificationMethod: SiteHostBindingV1['verificationMethod'];
  idempotencyKey: string;
}

export interface VerifySiteHostBindingCommandV1 {
  workspaceId: string;
  bindingId: string;
  expectedBindingVersion: number;
  verificationEvidenceRef: string;
  idempotencyKey: string;
}

export interface ActivateSiteCommandV1 {
  workspaceId: string;
  siteId: string;
  expectedSiteVersion: number;
  bindingId: string;
  expectedBindingVersion: number;
  idempotencyKey: string;
}

export interface SuspendSiteCommandV1 {
  workspaceId: string;
  siteId: string;
  expectedSiteVersion: number;
  reasonRef: string;
  idempotencyKey: string;
}

function text(value: unknown, field: string, max = 300): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new SiteServiceError('INVALID_INPUT', `${field} is required and must be bounded.`);
  return value.trim();
}

function version(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new SiteServiceError('INVALID_INPUT', `${field} must be a positive integer.`);
  return Number(value);
}

function instant(value: unknown, field: string): string {
  const parsed = Date.parse(text(value, field));
  if (!Number.isFinite(parsed))
    throw new SiteServiceError('INVALID_INPUT', `${field} must be an ISO date/time.`);
  return new Date(parsed).toISOString();
}

function fingerprint(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .filter(([, entry]) => entry !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, canonical(entry)])
      );
    return item;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export function normalizeSiteHostname(value: unknown): string {
  const raw = text(value, 'hostname', 300).toLowerCase().replace(/\.$/u, '');
  if (raw.includes(',') || raw.includes('/') || raw.includes('@'))
    throw new SiteServiceError('INVALID_INPUT', 'hostname must be one exact host.');
  let hostname: string;
  try {
    hostname = new URL(`http://${raw}`).hostname.toLowerCase().replace(/\.$/u, '');
  } catch {
    throw new SiteServiceError('INVALID_INPUT', 'hostname is invalid.');
  }
  if (
    hostname.length > 253 ||
    hostname.includes(':') ||
    !hostname.split('.').every((label) => /^(?!-)[a-z0-9-]{1,63}(?<!-)$/u.test(label))
  )
    throw new SiteServiceError('INVALID_INPUT', 'hostname is invalid.');
  return hostname;
}

function exactRef(value: unknown, field: string): asserts value is { id: string; version: number } {
  if (!value || typeof value !== 'object')
    throw new SiteServiceError('INVALID_INPUT', `${field} must be an exact reference.`);
  const ref = value as { id?: unknown; version?: unknown };
  text(ref.id, `${field}.id`);
  version(ref.version, `${field}.version`);
}

function isArray(value: unknown): boolean {
  return Array.isArray(value);
}

function validateConfiguration(input: SiteConfigurationInputV1, workspaceId: string): void {
  text(input.sourceRef, 'configuration.sourceRef');
  text(input.brand?.displayName, 'brand.displayName', 120);
  if (!/^#[0-9a-f]{6}$/iu.test(input.brand?.theme?.primaryColor ?? ''))
    throw new SiteServiceError('INVALID_INPUT', 'brand.theme.primaryColor must be a hex color.');
  if (!/^#[0-9a-f]{6}$/iu.test(input.brand?.theme?.accentColor ?? ''))
    throw new SiteServiceError('INVALID_INPUT', 'brand.theme.accentColor must be a hex color.');
  if (!['LIGHT', 'DARK', 'SYSTEM'].includes(input.brand?.theme?.colorMode))
    throw new SiteServiceError('INVALID_INPUT', 'brand.theme.colorMode is invalid.');
  const locales = input.localization?.supportedLocales;
  if (!isArray(locales) || locales.length === 0 || locales.length > 20)
    throw new SiteServiceError('INVALID_INPUT', 'supportedLocales must be non-empty and bounded.');
  const locale = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iu;
  if (
    !locales.every((value) => typeof value === 'string' && locale.test(value)) ||
    !locales.includes(input.localization.defaultLocale)
  )
    throw new SiteServiceError('INVALID_INPUT', 'defaultLocale must be a supported locale.');
  text(input.localization.defaultMarket, 'localization.defaultMarket', 32);
  if (!isArray(input.localization.jurisdictions) || input.localization.jurisdictions.length > 50)
    throw new SiteServiceError('INVALID_INPUT', 'jurisdictions must be bounded.');
  for (const jurisdiction of input.localization.jurisdictions)
    text(jurisdiction, 'localization.jurisdiction', 32);
  if (input.roles?.surfaceOwnerWorkspaceId !== workspaceId)
    throw new SiteServiceError(
      'INVALID_INPUT',
      'surfaceOwnerWorkspaceId must match the owning Workspace.'
    );
  for (const field of [
    'customerRelationshipWorkspaceId',
    'offerOwnerRef',
    'merchantOwnerRef',
    'fulfillmentOwnerRef'
  ] as const)
    text(input.roles?.[field], `roles.${field}`);
  if (!isArray(input.services) || input.services.length > 100)
    throw new SiteServiceError('INVALID_INPUT', 'services must be bounded.');
  for (const service of input.services) {
    if (service.productRef?.owner !== 'MARKREG')
      throw new SiteServiceError('INVALID_INPUT', 'Service Product owner must be MARKREG in V1.');
    text(service.productRef.productId, 'service.productRef.productId');
    version(service.productRef.version, 'service.productRef.version');
    if (!['PUBLIC', 'HIDDEN'].includes(service.visibility))
      throw new SiteServiceError('INVALID_INPUT', 'service.visibility is invalid.');
    if (!isArray(service.locales) || !service.locales.every((value) => locales.includes(value)))
      throw new SiteServiceError('INVALID_INPUT', 'service.locales must be supported locales.');
    if (!isArray(service.markets) || service.markets.length > 50)
      throw new SiteServiceError('INVALID_INPUT', 'service.markets must be bounded.');
    for (const market of service.markets) text(market, 'service.market', 32);
    if (!(channels as readonly string[]).includes(service.channel))
      throw new SiteServiceError('INVALID_INPUT', 'service.channel is invalid.');
    if (!(relationshipModels as readonly string[]).includes(service.relationshipModel))
      throw new SiteServiceError('INVALID_INPUT', 'service.relationshipModel is invalid.');
    if (!['SELF', 'MARKREG', 'GOVERNED_NETWORK_POLICY'].includes(service.fulfillment?.mode))
      throw new SiteServiceError('INVALID_INPUT', 'service.fulfillment.mode is invalid.');
    if (service.fulfillment.mode === 'GOVERNED_NETWORK_POLICY')
      exactRef(service.fulfillment.policyRef, 'service.fulfillment.policyRef');
    for (const ref of service.pricingPolicyRefs ?? []) exactRef(ref, 'pricingPolicyRef');
  }
  if (!isArray(input.contentSlots) || input.contentSlots.length > 200)
    throw new SiteServiceError('INVALID_INPUT', 'contentSlots must be bounded.');
  for (const slot of input.contentSlots) {
    text(slot.slot, 'contentSlot.slot', 80);
    text(slot.title, 'contentSlot.title', 200);
    if (slot.description !== undefined) text(slot.description, 'contentSlot.description', 500);
    if (typeof slot.route !== 'string' || !/^\/(?!\/)[a-z0-9/_-]*$/iu.test(slot.route))
      throw new SiteServiceError('INVALID_INPUT', 'contentSlot.route is invalid.');
    if (!locales.includes(slot.locale))
      throw new SiteServiceError('INVALID_INPUT', 'contentSlot.locale is unsupported.');
    exactRef(slot.publishPackageRef, 'contentSlot.publishPackageRef');
    if (!/^[0-9a-f]{64}$/iu.test(slot.contentFingerprintSha256))
      throw new SiteServiceError('INVALID_INPUT', 'content fingerprint must be SHA-256.');
  }
  if (input.attributionPolicyRef) exactRef(input.attributionPolicyRef, 'attributionPolicyRef');
}

export class SiteServiceV1 {
  constructor(
    private readonly repository: SiteRepositoryV1,
    private readonly commercialAuthority: SiteCommercialAuthorityV1,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID
  ) {}

  async create(command: Readonly<CreateSiteCommandV1>): Promise<SiteInstallationV1> {
    const workspaceId = text(command.workspaceId, 'workspaceId');
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint(command);
    const replay = await this.repository.replayCommand<SiteInstallationV1>(
      workspaceId,
      idempotencyKey,
      requestFingerprint
    );
    if (replay) return replay;
    if (!['MARKREG_REFERENCE', 'WORKSPACE_BRANDED'].includes(command.kind))
      throw new SiteServiceError('INVALID_INPUT', 'kind is invalid.');
    text(command.coreSiteInstallationRef?.installationId, 'coreSiteInstallationRef.installationId');
    version(command.coreSiteInstallationRef?.version, 'coreSiteInstallationRef.version');
    validateConfiguration(command.configuration, workspaceId);
    const recordedAt = this.now().toISOString();
    const siteId = `site_${this.createId()}` as const;
    const configuration: SiteConfigurationVersionV1 = {
      schemaVersion: 1,
      siteId,
      workspaceId,
      version: 1,
      brand: clone(command.configuration.brand),
      localization: clone(command.configuration.localization),
      roles: clone(command.configuration.roles),
      services: clone(command.configuration.services),
      contentSlots: clone(command.configuration.contentSlots),
      ...(command.configuration.attributionPolicyRef
        ? { attributionPolicyRef: clone(command.configuration.attributionPolicyRef) }
        : {}),
      sourceRef: command.configuration.sourceRef,
      recordedAt
    };
    const installation: SiteInstallationV1 = {
      schemaVersion: 1,
      siteId,
      workspaceId,
      coreSiteInstallationRef: clone(command.coreSiteInstallationRef),
      version: 1,
      kind: command.kind,
      lifecycle: 'DRAFT',
      currentConfigurationVersion: 1,
      effectiveAt: recordedAt,
      recordedAt,
      sourceRef: text(command.sourceRef, 'sourceRef')
    };
    return this.repository.commitMutation({
      workspaceId,
      idempotencyKey,
      requestFingerprint,
      response: installation,
      expectedSiteVersion: 0,
      installation,
      configuration
    });
  }

  async reviseConfiguration(
    command: Readonly<ReviseSiteConfigurationCommandV1>
  ): Promise<SiteInstallationV1> {
    const workspaceId = text(command.workspaceId, 'workspaceId');
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint(command);
    const replay = await this.repository.replayCommand<SiteInstallationV1>(
      workspaceId,
      idempotencyKey,
      requestFingerprint
    );
    if (replay) return replay;
    const current = await this.ownedSite(workspaceId, command.siteId);
    const expected = version(command.expectedSiteVersion, 'expectedSiteVersion');
    if (current.version !== expected)
      throw new SiteServiceError('CONFLICT', 'Expected Site version is no longer current.');
    if (current.lifecycle === 'DECOMMISSIONED')
      throw new SiteServiceError('CONFLICT', 'A decommissioned Site cannot be revised.');
    validateConfiguration(command.configuration, current.workspaceId);
    const recordedAt = this.now().toISOString();
    const configuration: SiteConfigurationVersionV1 = {
      schemaVersion: 1,
      siteId: current.siteId,
      workspaceId: current.workspaceId,
      version: current.currentConfigurationVersion + 1,
      brand: clone(command.configuration.brand),
      localization: clone(command.configuration.localization),
      roles: clone(command.configuration.roles),
      services: clone(command.configuration.services),
      contentSlots: clone(command.configuration.contentSlots),
      ...(command.configuration.attributionPolicyRef
        ? { attributionPolicyRef: clone(command.configuration.attributionPolicyRef) }
        : {}),
      sourceRef: command.configuration.sourceRef,
      recordedAt
    };
    const installation: SiteInstallationV1 = {
      ...current,
      version: current.version + 1,
      lifecycle: current.lifecycle === 'ACTIVE' ? 'DRAFT' : current.lifecycle,
      currentConfigurationVersion: configuration.version,
      recordedAt,
      sourceRef: configuration.sourceRef
    };
    return this.repository.commitMutation({
      workspaceId: current.workspaceId,
      idempotencyKey,
      requestFingerprint,
      response: installation,
      expectedSiteVersion: expected,
      installation,
      configuration
    });
  }

  async createHostBinding(
    command: Readonly<CreateSiteHostBindingCommandV1>
  ): Promise<SiteHostBindingV1> {
    const workspaceId = text(command.workspaceId, 'workspaceId');
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint(command);
    const replay = await this.repository.replayCommand<SiteHostBindingV1>(
      workspaceId,
      idempotencyKey,
      requestFingerprint
    );
    if (replay) return replay;
    const site = await this.ownedSite(workspaceId, command.siteId);
    const expected = version(command.expectedSiteVersion, 'expectedSiteVersion');
    if (site.version !== expected)
      throw new SiteServiceError('CONFLICT', 'Expected Site version is no longer current.');
    if (!['PRIMARY', 'ALIAS', 'TEST'].includes(command.bindingType))
      throw new SiteServiceError('INVALID_INPUT', 'bindingType is invalid.');
    if (!['DNS_TXT', 'HTTP_TOKEN', 'PLATFORM_MANAGED'].includes(command.verificationMethod))
      throw new SiteServiceError('INVALID_INPUT', 'verificationMethod is invalid.');
    const binding: SiteHostBindingV1 = {
      schemaVersion: 1,
      bindingId: `site_host_${this.createId()}`,
      siteId: site.siteId,
      workspaceId: site.workspaceId,
      normalizedHostname: normalizeSiteHostname(command.hostname),
      bindingType: command.bindingType,
      version: 1,
      status: 'PENDING_VERIFICATION',
      verificationMethod: command.verificationMethod,
      recordedAt: this.now().toISOString()
    };
    return this.repository.commitMutation({
      workspaceId: site.workspaceId,
      idempotencyKey,
      requestFingerprint,
      response: binding,
      expectedSiteVersion: expected,
      expectedBindingVersion: 0,
      binding
    });
  }

  async verifyHostBinding(
    command: Readonly<VerifySiteHostBindingCommandV1>
  ): Promise<SiteHostBindingV1> {
    const workspaceId = text(command.workspaceId, 'workspaceId');
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint(command);
    const replay = await this.repository.replayCommand<SiteHostBindingV1>(
      workspaceId,
      idempotencyKey,
      requestFingerprint
    );
    if (replay) return replay;
    const current = await this.ownedBinding(workspaceId, command.bindingId);
    const expected = version(command.expectedBindingVersion, 'expectedBindingVersion');
    if (current.version !== expected || current.status !== 'PENDING_VERIFICATION')
      throw new SiteServiceError(
        'CONFLICT',
        'Host binding is not pending at the expected version.'
      );
    const recordedAt = this.now().toISOString();
    const binding: SiteHostBindingV1 = {
      ...current,
      version: current.version + 1,
      status: 'VERIFIED',
      verificationEvidenceRef: text(command.verificationEvidenceRef, 'verificationEvidenceRef'),
      verifiedAt: recordedAt,
      recordedAt
    };
    return this.repository.commitMutation({
      workspaceId: current.workspaceId,
      idempotencyKey,
      requestFingerprint,
      response: binding,
      expectedBindingVersion: expected,
      binding
    });
  }

  async activate(
    command: Readonly<ActivateSiteCommandV1>
  ): Promise<Readonly<{ installation: SiteInstallationV1; binding: SiteHostBindingV1 }>> {
    const workspaceId = text(command.workspaceId, 'workspaceId');
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint(command);
    const replay = await this.repository.replayCommand<
      Readonly<{ installation: SiteInstallationV1; binding: SiteHostBindingV1 }>
    >(workspaceId, idempotencyKey, requestFingerprint);
    if (replay) return replay;
    const site = await this.ownedSite(workspaceId, command.siteId);
    const binding = await this.ownedBinding(workspaceId, command.bindingId);
    const expectedSiteVersion = version(command.expectedSiteVersion, 'expectedSiteVersion');
    const expectedBindingVersion = version(
      command.expectedBindingVersion,
      'expectedBindingVersion'
    );
    if (site.version !== expectedSiteVersion || binding.version !== expectedBindingVersion)
      throw new SiteServiceError('CONFLICT', 'Expected Site state is no longer current.');
    if (
      binding.siteId !== site.siteId ||
      (binding.status !== 'VERIFIED' && binding.status !== 'ACTIVE')
    )
      throw new SiteServiceError(
        'CONFLICT',
        'A verified or currently active binding for this Site is required.'
      );
    const recordedAt = this.now().toISOString();
    await this.currentCommercialAccess(site, binding, recordedAt);
    const installation: SiteInstallationV1 = {
      ...site,
      version: site.version + 1,
      lifecycle: 'ACTIVE',
      effectiveAt: recordedAt,
      recordedAt
    };
    const activeBinding: SiteHostBindingV1 = {
      ...binding,
      version: binding.version + 1,
      status: 'ACTIVE',
      effectiveFrom: recordedAt,
      recordedAt
    };
    const response = { installation, binding: activeBinding };
    return this.repository.commitMutation({
      workspaceId: site.workspaceId,
      idempotencyKey,
      requestFingerprint,
      response,
      expectedSiteVersion,
      expectedBindingVersion,
      installation,
      binding: activeBinding
    });
  }

  async suspend(command: Readonly<SuspendSiteCommandV1>): Promise<SiteInstallationV1> {
    const workspaceId = text(command.workspaceId, 'workspaceId');
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint(command);
    const replay = await this.repository.replayCommand<SiteInstallationV1>(
      workspaceId,
      idempotencyKey,
      requestFingerprint
    );
    if (replay) return replay;
    const site = await this.ownedSite(workspaceId, command.siteId);
    const expectedSiteVersion = version(command.expectedSiteVersion, 'expectedSiteVersion');
    if (site.version !== expectedSiteVersion)
      throw new SiteServiceError('CONFLICT', 'Expected Site version is no longer current.');
    if (site.lifecycle !== 'ACTIVE')
      throw new SiteServiceError('CONFLICT', 'Only an active Site can be suspended.');
    const recordedAt = this.now().toISOString();
    const installation: SiteInstallationV1 = {
      ...site,
      version: site.version + 1,
      lifecycle: 'SUSPENDED',
      effectiveAt: recordedAt,
      recordedAt,
      sourceRef: text(command.reasonRef, 'reasonRef')
    };
    return this.repository.commitMutation({
      workspaceId: site.workspaceId,
      idempotencyKey,
      requestFingerprint,
      response: installation,
      expectedSiteVersion,
      installation
    });
  }

  list(workspaceId: string): Promise<readonly SiteInstallationV1[]> {
    return this.repository.listCurrentInstallations(text(workspaceId, 'workspaceId'));
  }

  async currentConfiguration(
    workspaceId: string,
    siteId: string
  ): Promise<SiteConfigurationVersionV1> {
    const site = await this.ownedSite(workspaceId, siteId);
    const configuration = await this.repository.getConfiguration(
      site.siteId,
      site.currentConfigurationVersion
    );
    if (!configuration || configuration.workspaceId !== site.workspaceId)
      throw new SiteServiceError('CONFLICT', 'Current Site configuration is unavailable.');
    return clone(configuration);
  }

  async listHostBindings(
    workspaceId: string,
    siteId: string
  ): Promise<readonly SiteHostBindingV1[]> {
    const site = await this.ownedSite(workspaceId, siteId);
    const bindings = await this.repository.listCurrentBindings(site.siteId);
    if (
      bindings.some(
        (binding) => binding.workspaceId !== site.workspaceId || binding.siteId !== site.siteId
      )
    )
      throw new SiteServiceError('CONFLICT', 'Stored Site host binding ownership is inconsistent.');
    return bindings.map(clone);
  }

  async resolve(
    hostname: string,
    observedAt = this.now().toISOString()
  ): Promise<ResolvedSiteRuntimeV1> {
    const normalizedHostname = normalizeSiteHostname(hostname);
    const at = instant(observedAt, 'observedAt');
    const bindings = await this.repository.findActiveBindings(normalizedHostname);
    if (bindings.length === 0)
      throw new SiteServiceError('HOST_NOT_ACTIVE', 'No active Site is bound to this host.');
    if (bindings.length !== 1)
      throw new SiteServiceError('HOST_AMBIGUOUS', 'Host resolves to more than one Site.');
    const binding = bindings[0]!;
    const installation = await this.repository.getCurrentInstallation(binding.siteId);
    if (!installation || installation.lifecycle !== 'ACTIVE')
      throw new SiteServiceError('SITE_NOT_ACTIVE', 'Resolved Site is not active.');
    if (installation.workspaceId !== binding.workspaceId)
      throw new SiteServiceError('CONFLICT', 'Stored Site owner binding is inconsistent.');
    const configuration = await this.repository.getConfiguration(
      installation.siteId,
      installation.currentConfigurationVersion
    );
    if (!configuration || configuration.workspaceId !== installation.workspaceId)
      throw new SiteServiceError('CONFLICT', 'Current Site configuration is unavailable.');
    await this.currentCommercialAccess(installation, binding, at);
    const publicSite = {
      schemaVersion: 1 as const,
      siteId: installation.siteId,
      siteVersion: installation.version,
      configurationVersion: configuration.version,
      hostBindingVersion: binding.version,
      hostname: normalizedHostname,
      brand: clone(configuration.brand),
      localization: clone(configuration.localization),
      services: configuration.services
        .filter((service) => service.visibility === 'PUBLIC')
        .map((service) => ({
          productRef: clone(service.productRef),
          visibility: service.visibility,
          locales: clone(service.locales),
          markets: clone(service.markets),
          channel: service.channel,
          relationshipModel: service.relationshipModel,
          fulfillmentMode: service.fulfillment.mode
        })),
      contentSlots: clone(configuration.contentSlots),
      currentness: {
        hostBindingCurrent: true as const,
        configurationCurrent: true as const,
        coreSiteInstallationCurrent: true as const,
        entitlementsCurrent: true as const,
        observedAt: at
      }
    };
    const contextBase = {
      schemaVersion: 1 as const,
      siteId: installation.siteId,
      workspaceId: installation.workspaceId,
      siteVersion: installation.version,
      configurationVersion: configuration.version,
      hostBindingId: binding.bindingId,
      hostBindingVersion: binding.version,
      normalizedHostname,
      defaultLocale: configuration.localization.defaultLocale,
      observedAt: at
    };
    return {
      schemaVersion: 1,
      publicSite,
      requestContext: { ...contextBase, fingerprintSha256: fingerprint(contextBase) }
    };
  }

  private async ownedSite(workspaceIdValue: string, siteIdValue: string) {
    const workspaceId = text(workspaceIdValue, 'workspaceId');
    const siteId = text(siteIdValue, 'siteId');
    const site = await this.repository.getCurrentInstallation(siteId);
    if (!site) throw new SiteServiceError('NOT_FOUND', 'Site does not exist.');
    if (site.workspaceId !== workspaceId)
      throw new SiteServiceError('WORKSPACE_MISMATCH', 'Site belongs to another Workspace.');
    return site;
  }

  private async ownedBinding(workspaceIdValue: string, bindingIdValue: string) {
    const workspaceId = text(workspaceIdValue, 'workspaceId');
    const binding = await this.repository.getCurrentBinding(text(bindingIdValue, 'bindingId'));
    if (!binding) throw new SiteServiceError('NOT_FOUND', 'Host binding does not exist.');
    if (binding.workspaceId !== workspaceId)
      throw new SiteServiceError(
        'WORKSPACE_MISMATCH',
        'Host binding belongs to another Workspace.'
      );
    return binding;
  }

  private currentCommercialAccess(
    site: SiteInstallationV1,
    binding: SiteHostBindingV1,
    asOf: string
  ) {
    const entitlementKeys = [
      'site.access',
      ...(binding.bindingType === 'TEST' ? [] : ['site.workspace.custom_domain'])
    ];
    return this.commercialAuthority.assertCurrentAccess({
      workspaceId: site.workspaceId,
      installationId: site.coreSiteInstallationRef.installationId,
      installationVersion: site.coreSiteInstallationRef.version,
      entitlementKeys,
      asOf
    });
  }
}
