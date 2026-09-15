import { createHash } from 'node:crypto';
import {
  encodeInternalWorkspacePrincipal,
  isMarkOrbitId,
  type MarkOrbitId,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  parseCapabilityRequestV2Command,
  type CapabilityRequestV2Command
} from '@markorbit/contracts/capability-runtime';
import {
  noEarlyFunnelAuthorityConsequences,
  type EarlyFunnelArtifactReferenceV1,
  type EarlyFunnelSourceReferenceV1,
  type ProductionFeeFactsV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { PostgresProductionFeeFactsService } from './production-fee-facts.js';
import type { CapabilityProductionSourceExecutionReferenceTransportV1 } from './recommendation-source.js';

export const PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID =
  'resolver.uspto-official-fee-base-application-per-class' as const;
export const PRODUCTION_OFFICIAL_FEE_CAPABILITY_VERSION = '1.0.0' as const;
export const PRODUCTION_OFFICIAL_FEE_INPUT_SCHEMA =
  'brain-input.official-fee-resolution.v1' as const;
export const PRODUCTION_OFFICIAL_FEE_OUTPUT_SCHEMA = 'brain.official-fee-resolution.v1' as const;
export const PRODUCTION_OFFICIAL_FEE_OPERATION =
  'USPTO_TM_NEW_APPLICATION_BASE_FEE_SECTION_1_44_ELECTRONIC_PER_CLASS' as const;
export const PRODUCTION_OFFICIAL_FEE_ACCEPTED_REFERENCE_ID =
  'official-fee-ref_f5aa68b190809b271729776c7fb99b65995708e5835cbd4f31e832d29efecbdc' as const;
const RUNTIME_DEFINITION_ID = 'runtime-capability_uspto-official-fee-resolver-v1';
const IMPLEMENTATION_PROFILE_ID = 'implementation-profile_uspto-official-fee-resolver-v1';
const IMPLEMENTATION_KEY = 'brain-method-package-runtime.uspto-official-fee-resolver.v1';
const ADMISSION_POLICY_ID = 'source-admission-policy.uspto-official-fee-resolver.v2';
const SOURCE_USE_POLICY_ID = 'source-use-policy.uspto-official-fee-resolver.markreg.v1';
const SHA256 = /^[0-9a-f]{64}$/u;

export interface ResolveProductionOfficialFeeSourceCommandV1 {
  readonly schemaVersion: 1;
  readonly intakeId: MarkOrbitId;
  readonly expectedIntakeVersion: number;
  readonly idempotencyKey: string;
  readonly correlationId: MarkOrbitId;
}

export interface ProductionOfficialFeeSourceV1 {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly intake: Readonly<EarlyFunnelArtifactReferenceV1>;
  readonly feeFacts: Readonly<EarlyFunnelArtifactReferenceV1>;
  readonly source: Readonly<
    EarlyFunnelSourceReferenceV1 & {
      sourceKind: 'PRICING_SOURCE';
      admissionClass: 'PRODUCTION_ADMISSIBLE';
      currentness: 'CURRENT';
    }
  >;
  readonly material: Readonly<{
    filingBasis: ProductionFeeFactsV1['filingBasis'];
    classCount: number;
    feePerClass: Readonly<{ amountMinor: number; currency: string }>;
    totalOfficialFee: Readonly<{ amountMinor: number; currency: string }>;
    referenceId: string;
    referenceVersion: string;
    effectiveFrom: string;
    productionEvidenceId: string;
  }>;
  readonly authorityConsequences: typeof noEarlyFunnelAuthorityConsequences;
}

export class ProductionOfficialFeeSourceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductionOfficialFeeSourceError';
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, member]) => member !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function productionOfficialFeeSourceSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function requirePermission(principal: WorkspacePrincipal, permission: Permission): void {
  if (!principal.permissions.includes(permission)) {
    throw new ProductionOfficialFeeSourceError(
      'PERMISSION_DENIED',
      `${permission} permission is required.`,
      403
    );
  }
}
function exactCommand(
  command: Readonly<ResolveProductionOfficialFeeSourceCommandV1>
): Readonly<ResolveProductionOfficialFeeSourceCommandV1> {
  if (command.schemaVersion !== 1 || !isMarkOrbitId(command.intakeId)) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_PRODUCTION_OFFICIAL_FEE_REQUEST',
      'Production official-fee source request identity is invalid.',
      400
    );
  }
  if (!Number.isSafeInteger(command.expectedIntakeVersion) || command.expectedIntakeVersion < 1) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_PRODUCTION_OFFICIAL_FEE_REQUEST',
      'expectedIntakeVersion must be a positive safe integer.',
      400
    );
  }
  if (!command.idempotencyKey || command.idempotencyKey.trim() !== command.idempotencyKey) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_PRODUCTION_OFFICIAL_FEE_REQUEST',
      'idempotencyKey must contain exact non-empty text.',
      400
    );
  }
  if (!isMarkOrbitId(command.correlationId)) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_PRODUCTION_OFFICIAL_FEE_REQUEST',
      'correlationId must be a MarkOrbit identifier.',
      400
    );
  }
  return command;
}
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      `${field} must be an object.`,
      502
    );
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      `${field} must contain exact non-empty text.`,
      502
    );
  }
  return value;
}

function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      `${field} must be a positive safe integer.`,
      502
    );
  }
  return Number(value);
}
function instant(value: unknown, field: string): string {
  const result = text(value, field);
  if (Number.isNaN(Date.parse(result)) || new Date(Date.parse(result)).toISOString() !== result) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      `${field} must be an exact ISO instant.`,
      502
    );
  }
  return result;
}

function stringList(value: unknown, field: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length > 64 ||
    value.some((item) => typeof item !== 'string')
  ) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      `${field} must be a bounded string array.`,
      502
    );
  }
  return value.map((item) => text(item, field));
}

function allFalse(value: unknown, field: string): void {
  const authority = record(value, field);
  if (!Object.keys(authority).length || Object.values(authority).some((entry) => entry !== false)) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      `${field} must contain only explicit false consequences.`,
      502
    );
  }
}
function executionReference(
  value: unknown
): CapabilityProductionSourceExecutionReferenceTransportV1 {
  const v = record(value, 'sourceEvidenceReadReference');
  const result = {
    schemaVersion: v.schemaVersion as 1,
    idempotencyKey: text(v.idempotencyKey, 'reference.idempotencyKey'),
    requestFingerprintSha256: text(
      v.requestFingerprintSha256,
      'reference.requestFingerprintSha256'
    ),
    capabilityRequestId: text(v.capabilityRequestId, 'reference.capabilityRequestId'),
    sessionReceiptId: text(v.sessionReceiptId, 'reference.sessionReceiptId')
  };
  if (
    result.schemaVersion !== 1 ||
    !SHA256.test(result.requestFingerprintSha256) ||
    !result.capabilityRequestId.startsWith('capreq_') ||
    !result.sessionReceiptId.startsWith('session-receipt_')
  ) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      'Capability invocation did not return an exact production-source reference.',
      502
    );
  }
  return result;
}

function sourceIdempotencyKey(
  principal: WorkspacePrincipal,
  feeFacts: ProductionFeeFactsV1,
  orchestrationKey: string
): string {
  return `markreg-official-fee-${productionOfficialFeeSourceSha256({
    workspaceId: principal.workspaceId,
    feeFactsId: feeFacts.feeFactsId,
    feeFactsVersion: feeFacts.version,
    feeFactsFingerprintSha256: feeFacts.fingerprintSha256,
    orchestrationKey
  })}`;
}
export class HttpProductionOfficialFeeCapabilityInvokerV1 {
  constructor(
    private readonly capabilityUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async invoke(
    principal: WorkspacePrincipal,
    feeFacts: ProductionFeeFactsV1,
    orchestrationKey: string,
    correlationId: MarkOrbitId,
    asOf: string
  ): Promise<CapabilityProductionSourceExecutionReferenceTransportV1> {
    const idempotencyKey = sourceIdempotencyKey(principal, feeFacts, orchestrationKey);
    const command: CapabilityRequestV2Command = parseCapabilityRequestV2Command({
      schemaVersion: 2,
      capabilityId: PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID,
      capabilityVersion: PRODUCTION_OFFICIAL_FEE_CAPABILITY_VERSION,
      caller: {
        workspaceId: principal.workspaceId,
        principalId: principal.userId,
        callerProduct: 'MARKREG',
        permissionContextRef: `core-workspace-membership:${principal.membershipId}`
      },
      purpose:
        'Resolve the current governed USPTO base application official fee for Quote composition.',
      input: {
        jurisdiction: 'US',
        authority: 'USPTO',
        objectType: 'TRADEMARK_APPLICATION',
        operation: PRODUCTION_OFFICIAL_FEE_OPERATION,
        procedure: 'ELECTRONIC_FILING',
        stage: 'NEW_APPLICATION',
        filingBasis: feeFacts.filingBasis,
        segment: 'BASE_FEE',
        classCount: feeFacts.classCount,
        asOf,
        acceptedReferenceId: PRODUCTION_OFFICIAL_FEE_ACCEPTED_REFERENCE_ID
      },
      inputSchemaId: PRODUCTION_OFFICIAL_FEE_INPUT_SCHEMA,
      outputSchemaId: PRODUCTION_OFFICIAL_FEE_OUTPUT_SCHEMA,
      riskClass: 'LOW',
      idempotencyKey,
      correlationId
    });
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.capabilityUrl.replace(/\/$/u, '')}/v1/capability-requests`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
            'x-markorbit-workspace-id': principal.workspaceId,
            'x-markorbit-caller-product': 'MARKREG',
            'idempotency-key': idempotencyKey,
            'x-correlation-id': correlationId
          },
          body: JSON.stringify(command)
        }
      );
    } catch (cause) {
      throw new ProductionOfficialFeeSourceError(
        'OFFICIAL_FEE_CAPABILITY_UNAVAILABLE',
        'Governed official-fee Capability invocation is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const detail =
        body && typeof body === 'object' && !Array.isArray(body)
          ? (body as Record<string, unknown>)
          : {};
      throw new ProductionOfficialFeeSourceError(
        typeof detail.code === 'string' ? detail.code : 'OFFICIAL_FEE_CAPABILITY_DENIED',
        typeof detail.message === 'string'
          ? detail.message
          : 'Governed official-fee Capability was denied.',
        response.status,
        response.status >= 500
      );
    }
    const payload = record(body, 'capability response');
    const reference = executionReference(payload.sourceEvidenceReadReference);
    if (reference.idempotencyKey !== idempotencyKey) {
      throw new ProductionOfficialFeeSourceError(
        'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
        'Capability source reference does not match the exact invocation.',
        502
      );
    }
    return reference;
  }
}
export class HttpProductionOfficialFeeSourceEvidenceReaderV1 {
  constructor(
    private readonly capabilityUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async read(
    principal: WorkspacePrincipal,
    reference: CapabilityProductionSourceExecutionReferenceTransportV1,
    correlationId: MarkOrbitId
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.capabilityUrl.replace(/\/$/u, '')}/v1/production-source-evidence/read`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
            'x-markorbit-workspace-id': principal.workspaceId,
            'x-markorbit-caller-product': 'MARKREG',
            'x-correlation-id': correlationId
          },
          body: JSON.stringify(reference)
        }
      );
    } catch (cause) {
      throw new ProductionOfficialFeeSourceError(
        'OFFICIAL_FEE_SOURCE_READ_UNAVAILABLE',
        'Governed official-fee production source evidence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new ProductionOfficialFeeSourceError(
        response.status === 404
          ? 'OFFICIAL_FEE_SOURCE_NOT_FOUND'
          : 'OFFICIAL_FEE_SOURCE_READ_UNAVAILABLE',
        'Governed official-fee production source evidence was not admitted.',
        response.status,
        response.status >= 500
      );
    }
    return body;
  }
}
function projectOfficialFeeMaterial(
  value: unknown,
  feeFacts: ProductionFeeFactsV1,
  expectedInputFingerprint: string
): Readonly<{
  source: ProductionOfficialFeeSourceV1['source'];
  material: ProductionOfficialFeeSourceV1['material'];
}> {
  const result = record(value, 'producer');
  if (result.schemaVersion !== 1 || result.status !== 'PRODUCTION_ADMISSIBLE') {
    throw new ProductionOfficialFeeSourceError(
      'OFFICIAL_FEE_SOURCE_NOT_ADMITTED',
      'Official-fee Capability source is not production-admissible.',
      422
    );
  }
  allFalse(result.authority, 'producer.authority');
  const source = record(result.source, 'producer.source');
  if (source.producer !== 'CAPABILITY_ENGINE' || source.admission !== 'PRODUCTION_ADMISSIBLE') {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      'Official-fee source producer/admission identity is invalid.',
      502
    );
  }
  allFalse(source.authority, 'producer.source.authority');
  const sourceUse = record(source.sourceUse, 'producer.source.sourceUse');
  if (sourceUse.currentness !== 'CURRENT') {
    throw new ProductionOfficialFeeSourceError(
      'OFFICIAL_FEE_SOURCE_STALE',
      'Official-fee Capability source is no longer current.',
      409
    );
  }
  const sourceUsePolicy = record(sourceUse.policy, 'producer.source.sourceUse.policy');
  if (
    sourceUsePolicy.policyId !== SOURCE_USE_POLICY_ID ||
    integer(sourceUsePolicy.policyVersion, 'sourceUse.policyVersion') !== 1
  ) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      'Official-fee source-use policy is not consumer-allowlisted.',
      502
    );
  }
  const capability = record(
    record(source.current, 'producer.source.current').capability,
    'capability'
  );
  const implementation = record(
    record(source.current, 'producer.source.current').implementation,
    'implementation'
  );
  if (
    capability.capabilityId !== PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID ||
    capability.capabilityVersion !== PRODUCTION_OFFICIAL_FEE_CAPABILITY_VERSION ||
    capability.runtimeCapabilityDefinitionId !== RUNTIME_DEFINITION_ID ||
    integer(capability.version, 'capability.version') !== 1 ||
    implementation.implementationProfileId !== IMPLEMENTATION_PROFILE_ID ||
    integer(implementation.version, 'implementation.version') !== 1 ||
    implementation.implementationKey !== IMPLEMENTATION_KEY ||
    implementation.status !== 'APPROVED'
  ) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      'Official-fee Capability/Implementation binding is not consumer-allowlisted.',
      502
    );
  }
  const admission = record(source.admissionPolicy, 'producer.source.admissionPolicy');
  if (
    admission.policyId !== ADMISSION_POLICY_ID ||
    integer(admission.policyVersion, 'admissionPolicy.policyVersion') !== 2
  ) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      'Official-fee production admission policy is not consumer-allowlisted.',
      502
    );
  }
  const material = record(result.officialFeeMaterial, 'producer.officialFeeMaterial');
  if (
    material.materialFamilyId !== 'uspto-official-fee-base-application-per-class' ||
    integer(material.materialFamilyVersion, 'officialFeeMaterial.materialFamilyVersion') !== 1 ||
    material.filingBasis !== feeFacts.filingBasis ||
    integer(material.classCount, 'officialFeeMaterial.classCount') !== feeFacts.classCount ||
    text(
      material.analyzedInputFingerprintSha256,
      'officialFeeMaterial.analyzedInputFingerprintSha256'
    ) !== expectedInputFingerprint
  ) {
    throw new ProductionOfficialFeeSourceError(
      'OFFICIAL_FEE_SOURCE_INPUT_MISMATCH',
      'Official-fee material does not match the exact current fee facts.',
      409
    );
  }
  allFalse(material.authorityConsequences, 'officialFeeMaterial.authorityConsequences');
  const currentness = record(material.currentness, 'officialFeeMaterial.currentness');
  if (currentness.status !== 'CURRENT') {
    throw new ProductionOfficialFeeSourceError(
      'OFFICIAL_FEE_SOURCE_STALE',
      'Official-fee material is not current.',
      409
    );
  }
  const fee = record(material.fee, 'officialFeeMaterial.fee');
  const amountMinor = integer(fee.amountMinor, 'officialFeeMaterial.fee.amountMinor');
  const currency = text(fee.currency, 'officialFeeMaterial.fee.currency');
  if (fee.unit !== 'PER_CLASS' || !/^[A-Z]{3}$/u.test(currency)) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      'Official-fee monetary material is invalid.',
      502
    );
  }
  const totalMinor = amountMinor * feeFacts.classCount;
  if (!Number.isSafeInteger(totalMinor)) {
    throw new ProductionOfficialFeeSourceError(
      'OFFICIAL_FEE_AMOUNT_OVERFLOW',
      'Official-fee total exceeds the supported integral minor-unit range.',
      422
    );
  }
  const reference = record(material.reference, 'officialFeeMaterial.reference');
  const referenceId = text(reference.referenceId, 'officialFeeMaterial.reference.referenceId');
  if (referenceId !== PRODUCTION_OFFICIAL_FEE_ACCEPTED_REFERENCE_ID) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      'Official-fee reference identity is not consumer-allowlisted.',
      502
    );
  }
  const lineage = record(material.lineage, 'officialFeeMaterial.lineage');
  if (
    lineage.capabilityId !== PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID ||
    lineage.capabilityVersion !== PRODUCTION_OFFICIAL_FEE_CAPABILITY_VERSION ||
    lineage.runtimeCapabilityDefinitionId !== RUNTIME_DEFINITION_ID ||
    lineage.implementationProfileId !== IMPLEMENTATION_PROFILE_ID ||
    lineage.implementationKey !== IMPLEMENTATION_KEY
  ) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      'Official-fee material lineage is not consumer-allowlisted.',
      502
    );
  }
  const outputFingerprint = text(
    lineage.outputFingerprintSha256,
    'officialFeeMaterial.lineage.outputFingerprintSha256'
  );
  if (!SHA256.test(outputFingerprint)) {
    throw new ProductionOfficialFeeSourceError(
      'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      'Official-fee output fingerprint is invalid.',
      502
    );
  }
  const productionEvidenceId = text(
    lineage.productionEvidenceId,
    'officialFeeMaterial.lineage.productionEvidenceId'
  );
  const checkedAt = instant(currentness.checkedAt, 'officialFeeMaterial.currentness.checkedAt');
  const referenceVersion =
    typeof reference.version === 'number'
      ? String(integer(reference.version, 'officialFeeMaterial.reference.version'))
      : text(reference.version, 'officialFeeMaterial.reference.version');
  const assumptions = stringList(material.assumptions, 'officialFeeMaterial.assumptions');
  const limitations = stringList(material.limitations, 'officialFeeMaterial.limitations');
  const sourceReference: ProductionOfficialFeeSourceV1['source'] = {
    sourceKind: 'PRICING_SOURCE',
    sourceId: PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID,
    sourceVersion: `${PRODUCTION_OFFICIAL_FEE_CAPABILITY_VERSION}|reference:${referenceId}@${referenceVersion}|evidence:${productionEvidenceId}`,
    fingerprintSha256: outputFingerprint,
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: checkedAt,
    provenanceRefs: [
      `capability-runtime-definition:${RUNTIME_DEFINITION_ID}@1`,
      `capability-implementation-profile:${IMPLEMENTATION_PROFILE_ID}@1|key:${IMPLEMENTATION_KEY}`,
      `capability-source-admission-evidence:${productionEvidenceId}`,
      `capability-admission-policy:${ADMISSION_POLICY_ID}@2`,
      `capability-source-use-policy:${SOURCE_USE_POLICY_ID}@1`,
      `official-fee-reference:${referenceId}@${referenceVersion}`,
      `production-fee-facts:${feeFacts.feeFactsId}@${feeFacts.version}#${feeFacts.fingerprintSha256}`
    ],
    assumptions,
    limitations
  };
  return Object.freeze({
    source: Object.freeze(sourceReference),
    material: Object.freeze({
      filingBasis: feeFacts.filingBasis,
      classCount: feeFacts.classCount,
      feePerClass: Object.freeze({ amountMinor, currency }),
      totalOfficialFee: Object.freeze({ amountMinor: totalMinor, currency }),
      referenceId,
      referenceVersion,
      effectiveFrom: instant(
        reference.effectiveFrom,
        'officialFeeMaterial.reference.effectiveFrom'
      ),
      productionEvidenceId
    })
  });
}

export interface ProductionOfficialFeeSourceDependenciesV1 {
  readonly feeFacts: Pick<PostgresProductionFeeFactsService, 'getCurrent'>;
  readonly invoker: Pick<HttpProductionOfficialFeeCapabilityInvokerV1, 'invoke'>;
  readonly reader: Pick<HttpProductionOfficialFeeSourceEvidenceReaderV1, 'read'>;
}

export class ProductionOfficialFeeSourceServiceV1 {
  constructor(
    private readonly dependencies: ProductionOfficialFeeSourceDependenciesV1,
    private readonly now = () => new Date().toISOString()
  ) {}

  async resolve(
    principal: WorkspacePrincipal,
    supplied: Readonly<ResolveProductionOfficialFeeSourceCommandV1>
  ): Promise<Readonly<ProductionOfficialFeeSourceV1>> {
    requirePermission(principal, 'order:read');
    const command = exactCommand(supplied);
    const at = instant(this.now(), 'currentnessClock');
    let feeFacts: ProductionFeeFactsV1;
    try {
      feeFacts = await this.dependencies.feeFacts.getCurrent(
        principal,
        command.intakeId,
        command.expectedIntakeVersion
      );
    } catch (cause) {
      const dependency = cause as { code?: unknown; status?: unknown; retryable?: unknown };
      if (typeof dependency.code === 'string' && typeof dependency.status === 'number') {
        throw new ProductionOfficialFeeSourceError(
          dependency.code,
          cause instanceof Error
            ? cause.message
            : 'Production fee-facts dependency rejected the request.',
          dependency.status,
          dependency.retryable === true,
          { cause: cause instanceof Error ? cause : undefined }
        );
      }
      throw new ProductionOfficialFeeSourceError(
        'OFFICIAL_FEE_DEPENDENCY_UNAVAILABLE',
        'Production fee-facts dependency is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (feeFacts.currentness !== 'CURRENT') {
      throw new ProductionOfficialFeeSourceError(
        'PRODUCTION_FEE_FACTS_STALE',
        'Official-fee source requires the exact current fee facts.',
        409
      );
    }
    const input = {
      jurisdiction: 'US',
      authority: 'USPTO',
      objectType: 'TRADEMARK_APPLICATION',
      operation: PRODUCTION_OFFICIAL_FEE_OPERATION,
      procedure: 'ELECTRONIC_FILING',
      stage: 'NEW_APPLICATION',
      filingBasis: feeFacts.filingBasis,
      segment: 'BASE_FEE',
      classCount: feeFacts.classCount,
      asOf: at,
      acceptedReferenceId: PRODUCTION_OFFICIAL_FEE_ACCEPTED_REFERENCE_ID
    } as const;
    const reference = await this.dependencies.invoker.invoke(
      principal,
      feeFacts,
      command.idempotencyKey,
      command.correlationId,
      at
    );
    const raw = await this.dependencies.reader.read(principal, reference, command.correlationId);
    const projected = projectOfficialFeeMaterial(
      raw,
      feeFacts,
      productionOfficialFeeSourceSha256(input)
    );
    return Object.freeze({
      schemaVersion: 1,
      workspaceId: principal.workspaceId,
      intake: Object.freeze({ ...feeFacts.intake }),
      feeFacts: Object.freeze({
        id: feeFacts.feeFactsId,
        version: feeFacts.version,
        fingerprintSha256: feeFacts.fingerprintSha256
      }),
      source: projected.source,
      material: projected.material,
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    });
  }
}
