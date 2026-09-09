import type { CapabilityRiskClass } from './capability-runtime.js';

export type ExternalCapabilityExposurePolicyId = `external-capability-exposure-policy_${string}`;
export type ExternalCapabilityOperation = 'READ' | 'PREPARE' | 'EXECUTE';

export interface ExternalCapabilityExactRefV1 {
  owner: string;
  id: string;
  version: string;
}

export interface ExternalCapabilityOperationPolicyV1 {
  operation: ExternalCapabilityOperation;
  riskClass: CapabilityRiskClass;
  permissionRequirementRef: Readonly<ExternalCapabilityExactRefV1>;
  evidenceRequirementRefs: readonly ExternalCapabilityExactRefV1[];
  protectedActionPolicyRef?: Readonly<ExternalCapabilityExactRefV1>;
  executionContractRef?: Readonly<ExternalCapabilityExactRefV1>;
}

export interface ExternalCapabilityExposurePolicyV1 {
  schemaVersion: 1;
  policyId: ExternalCapabilityExposurePolicyId;
  version: string;
  status: 'NOT_EXPOSED' | 'DISCOVERABLE' | 'AVAILABLE';
  capabilityRef: Readonly<{ capabilityId: string; capabilityVersion: string }>;
  subjectBinding: Readonly<{
    workspaceRequired: true;
    principalRequired: true;
    currentPermissionContextRequired: true;
    currentEntitlementContextRequired: true;
  }>;
  discoveryPolicyRef: Readonly<ExternalCapabilityExactRefV1>;
  authenticationPolicyRef: Readonly<ExternalCapabilityExactRefV1>;
  auditPolicyRef: Readonly<ExternalCapabilityExactRefV1>;
  ratePolicyRef: Readonly<ExternalCapabilityExactRefV1>;
  operations: readonly ExternalCapabilityOperationPolicyV1[];
  authority: Readonly<{
    permissionGranted: false;
    preparationAcceptedAsTruth: false;
    protectedActionAuthorized: false;
    executionStarted: false;
    externalBillingCreated: false;
  }>;
}

export class ExternalCapabilityExposureContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalCapabilityExposureContractError';
  }
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ExternalCapabilityExposureContractError(`${field} must be an object.`);
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
    throw new ExternalCapabilityExposureContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new ExternalCapabilityExposureContractError(`${field} must be a non-empty string.`);
  return value.trim();
}
function reference(value: unknown, field: string): ExternalCapabilityExactRefV1 {
  const item = object(value, field);
  exactKeys(item, ['owner', 'id', 'version'], field);
  return {
    owner: text(item.owner, `${field}.owner`),
    id: text(item.id, `${field}.id`),
    version: text(item.version, `${field}.version`)
  };
}
function references(value: unknown, field: string): readonly ExternalCapabilityExactRefV1[] {
  if (!Array.isArray(value))
    throw new ExternalCapabilityExposureContractError(`${field} must be an array.`);
  const result = value.map((item, index) => reference(item, `${field}[${index}]`));
  if (
    new Set(result.map((item) => `${item.owner}:${item.id}:${item.version}`)).size !== result.length
  )
    throw new ExternalCapabilityExposureContractError(`${field} must not contain duplicates.`);
  return result;
}
function operationPolicy(value: unknown, field: string): ExternalCapabilityOperationPolicyV1 {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'operation',
      'riskClass',
      'permissionRequirementRef',
      'evidenceRequirementRefs',
      'protectedActionPolicyRef',
      'executionContractRef'
    ],
    field
  );
  if (!['READ', 'PREPARE', 'EXECUTE'].includes(String(item.operation)))
    throw new ExternalCapabilityExposureContractError(`${field}.operation is invalid.`);
  if (!['LOW', 'MODERATE', 'HIGH', 'PROTECTED'].includes(String(item.riskClass)))
    throw new ExternalCapabilityExposureContractError(`${field}.riskClass is invalid.`);
  const operation = item.operation as ExternalCapabilityOperation;
  const protectedActionPolicyRef =
    item.protectedActionPolicyRef === undefined
      ? undefined
      : reference(item.protectedActionPolicyRef, `${field}.protectedActionPolicyRef`);
  const executionContractRef =
    item.executionContractRef === undefined
      ? undefined
      : reference(item.executionContractRef, `${field}.executionContractRef`);
  if (
    operation === 'EXECUTE' &&
    (item.riskClass !== 'PROTECTED' || !protectedActionPolicyRef || !executionContractRef)
  )
    throw new ExternalCapabilityExposureContractError(
      `${field} EXECUTE must map to PROTECTED risk with exact protected-action and execution references.`
    );
  if (operation !== 'EXECUTE' && (protectedActionPolicyRef || executionContractRef))
    throw new ExternalCapabilityExposureContractError(
      `${field} non-EXECUTE operations cannot claim protected-action or execution mappings.`
    );
  return {
    operation,
    riskClass: item.riskClass as CapabilityRiskClass,
    permissionRequirementRef: reference(
      item.permissionRequirementRef,
      `${field}.permissionRequirementRef`
    ),
    evidenceRequirementRefs: references(
      item.evidenceRequirementRefs,
      `${field}.evidenceRequirementRefs`
    ),
    ...(protectedActionPolicyRef ? { protectedActionPolicyRef } : {}),
    ...(executionContractRef ? { executionContractRef } : {})
  };
}

export function parseExternalCapabilityExposurePolicyV1(
  value: unknown
): ExternalCapabilityExposurePolicyV1 {
  const item = object(value, 'externalCapabilityExposurePolicy');
  exactKeys(
    item,
    [
      'schemaVersion',
      'policyId',
      'version',
      'status',
      'capabilityRef',
      'subjectBinding',
      'discoveryPolicyRef',
      'authenticationPolicyRef',
      'auditPolicyRef',
      'ratePolicyRef',
      'operations',
      'authority'
    ],
    'externalCapabilityExposurePolicy'
  );
  if (item.schemaVersion !== 1)
    throw new ExternalCapabilityExposureContractError('schemaVersion must be 1.');
  if (!['NOT_EXPOSED', 'DISCOVERABLE', 'AVAILABLE'].includes(String(item.status)))
    throw new ExternalCapabilityExposureContractError('status is invalid.');
  const policyId = text(item.policyId, 'policyId');
  if (!policyId.startsWith('external-capability-exposure-policy_'))
    throw new ExternalCapabilityExposureContractError('policyId is invalid.');
  const capabilityRef = object(item.capabilityRef, 'capabilityRef');
  exactKeys(capabilityRef, ['capabilityId', 'capabilityVersion'], 'capabilityRef');
  const subjectBinding = object(item.subjectBinding, 'subjectBinding');
  exactKeys(
    subjectBinding,
    [
      'workspaceRequired',
      'principalRequired',
      'currentPermissionContextRequired',
      'currentEntitlementContextRequired'
    ],
    'subjectBinding'
  );
  if (Object.values(subjectBinding).some((required) => required !== true))
    throw new ExternalCapabilityExposureContractError(
      'all current subject bindings must be required.'
    );
  if (!Array.isArray(item.operations))
    throw new ExternalCapabilityExposureContractError('operations must be an array.');
  const operations = item.operations.map((entry, index) =>
    operationPolicy(entry, `operations[${index}]`)
  );
  if (new Set(operations.map(({ operation }) => operation)).size !== operations.length)
    throw new ExternalCapabilityExposureContractError('operations must not contain duplicates.');
  if (item.status === 'NOT_EXPOSED' && operations.length !== 0)
    throw new ExternalCapabilityExposureContractError(
      'NOT_EXPOSED policy cannot expose operations.'
    );
  if (item.status === 'DISCOVERABLE' && operations.some(({ operation }) => operation !== 'READ'))
    throw new ExternalCapabilityExposureContractError(
      'DISCOVERABLE policy may describe READ only.'
    );
  if (item.status === 'AVAILABLE' && operations.length === 0)
    throw new ExternalCapabilityExposureContractError(
      'AVAILABLE policy requires at least one operation.'
    );
  const authority = object(item.authority, 'authority');
  exactKeys(
    authority,
    [
      'permissionGranted',
      'preparationAcceptedAsTruth',
      'protectedActionAuthorized',
      'executionStarted',
      'externalBillingCreated'
    ],
    'authority'
  );
  if (Object.values(authority).some((claim) => claim !== false))
    throw new ExternalCapabilityExposureContractError(
      'exposure policy authority claims must all be false.'
    );
  return {
    schemaVersion: 1,
    policyId: policyId as ExternalCapabilityExposurePolicyId,
    version: text(item.version, 'version'),
    status: item.status as ExternalCapabilityExposurePolicyV1['status'],
    capabilityRef: {
      capabilityId: text(capabilityRef.capabilityId, 'capabilityRef.capabilityId'),
      capabilityVersion: text(capabilityRef.capabilityVersion, 'capabilityRef.capabilityVersion')
    },
    subjectBinding: {
      workspaceRequired: true,
      principalRequired: true,
      currentPermissionContextRequired: true,
      currentEntitlementContextRequired: true
    },
    discoveryPolicyRef: reference(item.discoveryPolicyRef, 'discoveryPolicyRef'),
    authenticationPolicyRef: reference(item.authenticationPolicyRef, 'authenticationPolicyRef'),
    auditPolicyRef: reference(item.auditPolicyRef, 'auditPolicyRef'),
    ratePolicyRef: reference(item.ratePolicyRef, 'ratePolicyRef'),
    operations,
    authority: {
      permissionGranted: false,
      preparationAcceptedAsTruth: false,
      protectedActionAuthorized: false,
      executionStarted: false,
      externalBillingCreated: false
    }
  };
}
