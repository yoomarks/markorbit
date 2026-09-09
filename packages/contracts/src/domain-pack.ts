import type { CapabilityRiskClass } from './capability-runtime.js';

export type DomainPackId = `domain-pack_${string}`;

export interface DomainPackExactRefV1 {
  owner: string;
  id: string;
  version: string;
}

export interface DomainPackAuthorityRefV1 extends DomainPackExactRefV1 {
  authorityKind: 'CANON' | 'OFFICIAL_SOURCE' | 'WORKSPACE_CONTEXT' | 'INFERENCE_POLICY';
}

export interface DomainCapabilityRequirementV1 {
  capabilityId: string;
  capabilityVersion: string;
  riskClass: CapabilityRiskClass;
  governancePolicyRef: Readonly<DomainPackExactRefV1>;
  evidenceRequirementRefs: readonly DomainPackExactRefV1[];
  providerRequirementRefs: readonly DomainPackExactRefV1[];
}

export interface DomainUiExtensionV1 {
  extensionId: string;
  surfaceOwner: string;
  slot: 'OVERVIEW_SECTION' | 'DETAIL_SECTION' | 'WORKSPACE_PANEL';
  presentationSchemaRef: Readonly<DomainPackExactRefV1>;
  requiredCapabilityIds: readonly string[];
}

export interface DomainPackV1 {
  schemaVersion: 1;
  domainPackId: DomainPackId;
  version: string;
  domainId: string;
  title: string;
  status: 'DRAFT' | 'ACCEPTED' | 'RETIRED';
  ontologyRefs: readonly DomainPackExactRefV1[];
  truthAuthorityRefs: readonly DomainPackAuthorityRefV1[];
  knowledgeRefs: readonly DomainPackExactRefV1[];
  ruleRefs: readonly DomainPackExactRefV1[];
  workflowRefs: readonly DomainPackExactRefV1[];
  capabilityRequirements: readonly DomainCapabilityRequirementV1[];
  benchmarkRefs: readonly DomainPackExactRefV1[];
  uiExtensions: readonly DomainUiExtensionV1[];
  authority: Readonly<{
    canonicalTruthCreated: false;
    sourceApproved: false;
    providerApproved: false;
    protectedActionAuthorized: false;
    arbitraryCodeAllowed: false;
  }>;
}

export class DomainPackContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'DomainPackContractError';
  }
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new DomainPackContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}
function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unsupported.length)
    throw new DomainPackContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new DomainPackContractError(`${field} must be a non-empty string.`);
  return value.trim();
}
function unique<T>(items: readonly T[], key: (item: T) => string, field: string): readonly T[] {
  if (new Set(items.map(key)).size !== items.length)
    throw new DomainPackContractError(`${field} must not contain duplicates.`);
  return items;
}
function list<T>(
  value: unknown,
  field: string,
  parse: (value: unknown, field: string) => T
): readonly T[] {
  if (!Array.isArray(value)) throw new DomainPackContractError(`${field} must be an array.`);
  return value.map((item, index) => parse(item, `${field}[${index}]`));
}
function ref(value: unknown, field: string): DomainPackExactRefV1 {
  const item = object(value, field);
  exactKeys(item, ['owner', 'id', 'version'], field);
  return {
    owner: text(item.owner, `${field}.owner`),
    id: text(item.id, `${field}.id`),
    version: text(item.version, `${field}.version`)
  };
}
function authorityRef(value: unknown, field: string): DomainPackAuthorityRefV1 {
  const item = object(value, field);
  exactKeys(item, ['owner', 'id', 'version', 'authorityKind'], field);
  if (
    !['CANON', 'OFFICIAL_SOURCE', 'WORKSPACE_CONTEXT', 'INFERENCE_POLICY'].includes(
      String(item.authorityKind)
    )
  )
    throw new DomainPackContractError(`${field}.authorityKind is invalid.`);
  return {
    ...ref({ owner: item.owner, id: item.id, version: item.version }, field),
    authorityKind: item.authorityKind as DomainPackAuthorityRefV1['authorityKind']
  };
}
function refs(value: unknown, field: string): readonly DomainPackExactRefV1[] {
  return unique(
    list(value, field, ref),
    (item) => `${item.owner}:${item.id}:${item.version}`,
    field
  );
}
function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new DomainPackContractError(`${field} must be an array.`);
  return unique(
    value.map((item, index) => text(item, `${field}[${index}]`)),
    (item) => item,
    field
  );
}
function capability(value: unknown, field: string): DomainCapabilityRequirementV1 {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'capabilityId',
      'capabilityVersion',
      'riskClass',
      'governancePolicyRef',
      'evidenceRequirementRefs',
      'providerRequirementRefs'
    ],
    field
  );
  if (!['LOW', 'MODERATE', 'HIGH', 'PROTECTED'].includes(String(item.riskClass)))
    throw new DomainPackContractError(`${field}.riskClass is invalid.`);
  return {
    capabilityId: text(item.capabilityId, `${field}.capabilityId`),
    capabilityVersion: text(item.capabilityVersion, `${field}.capabilityVersion`),
    riskClass: item.riskClass as CapabilityRiskClass,
    governancePolicyRef: ref(item.governancePolicyRef, `${field}.governancePolicyRef`),
    evidenceRequirementRefs: refs(item.evidenceRequirementRefs, `${field}.evidenceRequirementRefs`),
    providerRequirementRefs: refs(item.providerRequirementRefs, `${field}.providerRequirementRefs`)
  };
}
function uiExtension(value: unknown, field: string): DomainUiExtensionV1 {
  const item = object(value, field);
  exactKeys(
    item,
    ['extensionId', 'surfaceOwner', 'slot', 'presentationSchemaRef', 'requiredCapabilityIds'],
    field
  );
  if (!['OVERVIEW_SECTION', 'DETAIL_SECTION', 'WORKSPACE_PANEL'].includes(String(item.slot)))
    throw new DomainPackContractError(`${field}.slot is invalid.`);
  return {
    extensionId: text(item.extensionId, `${field}.extensionId`),
    surfaceOwner: text(item.surfaceOwner, `${field}.surfaceOwner`),
    slot: item.slot as DomainUiExtensionV1['slot'],
    presentationSchemaRef: ref(item.presentationSchemaRef, `${field}.presentationSchemaRef`),
    requiredCapabilityIds: stringList(item.requiredCapabilityIds, `${field}.requiredCapabilityIds`)
  };
}

export function parseDomainPackV1(value: unknown): DomainPackV1 {
  const item = object(value, 'domainPack');
  exactKeys(
    item,
    [
      'schemaVersion',
      'domainPackId',
      'version',
      'domainId',
      'title',
      'status',
      'ontologyRefs',
      'truthAuthorityRefs',
      'knowledgeRefs',
      'ruleRefs',
      'workflowRefs',
      'capabilityRequirements',
      'benchmarkRefs',
      'uiExtensions',
      'authority'
    ],
    'domainPack'
  );
  if (item.schemaVersion !== 1) throw new DomainPackContractError('schemaVersion must be 1.');
  if (!['DRAFT', 'ACCEPTED', 'RETIRED'].includes(String(item.status)))
    throw new DomainPackContractError('status is invalid.');
  const domainPackId = text(item.domainPackId, 'domainPackId');
  if (!domainPackId.startsWith('domain-pack_'))
    throw new DomainPackContractError('domainPackId is invalid.');
  const capabilities = unique(
    list(item.capabilityRequirements, 'capabilityRequirements', capability),
    (entry) => `${entry.capabilityId}@${entry.capabilityVersion}`,
    'capabilityRequirements'
  );
  const extensions = unique(
    list(item.uiExtensions, 'uiExtensions', uiExtension),
    (entry) => entry.extensionId,
    'uiExtensions'
  );
  const authority = object(item.authority, 'authority');
  exactKeys(
    authority,
    [
      'canonicalTruthCreated',
      'sourceApproved',
      'providerApproved',
      'protectedActionAuthorized',
      'arbitraryCodeAllowed'
    ],
    'authority'
  );
  if (Object.values(authority).some((claim) => claim !== false))
    throw new DomainPackContractError('Domain Pack authority claims must all be false.');
  return {
    schemaVersion: 1,
    domainPackId: domainPackId as DomainPackId,
    version: text(item.version, 'version'),
    domainId: text(item.domainId, 'domainId'),
    title: text(item.title, 'title'),
    status: item.status as DomainPackV1['status'],
    ontologyRefs: refs(item.ontologyRefs, 'ontologyRefs'),
    truthAuthorityRefs: unique(
      list(item.truthAuthorityRefs, 'truthAuthorityRefs', authorityRef),
      (entry) => `${entry.authorityKind}:${entry.owner}:${entry.id}:${entry.version}`,
      'truthAuthorityRefs'
    ),
    knowledgeRefs: refs(item.knowledgeRefs, 'knowledgeRefs'),
    ruleRefs: refs(item.ruleRefs, 'ruleRefs'),
    workflowRefs: refs(item.workflowRefs, 'workflowRefs'),
    capabilityRequirements: capabilities,
    benchmarkRefs: refs(item.benchmarkRefs, 'benchmarkRefs'),
    uiExtensions: extensions,
    authority: {
      canonicalTruthCreated: false,
      sourceApproved: false,
      providerApproved: false,
      protectedActionAuthorized: false,
      arbitraryCodeAllowed: false
    }
  };
}
