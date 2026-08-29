import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type {
  CapabilityRequestV2,
  ImplementationBinding,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import {
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
  DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
  normalizeCnPreliminaryPublicationDiscoveryRequestV2,
  parseCnPreliminaryPublicationDiscoveryEnvelopeV2,
  parseCnPreliminaryPublicationDiscoveryPageV2,
  type CnPreliminaryPublicationDiscoveryEnvelopeV2,
  type CnPreliminaryPublicationDiscoveryPageV2,
  type CnPreliminaryPublicationDiscoveryRequestV2
} from '@markorbit/contracts/data-engine-discovery';
import { DATA_ENGINE_INTEGRATION_CONTRACT_VERSION } from '@markorbit/contracts/data-engine';

import type {
  CapabilityImplementationExecutionResult,
  CapabilityImplementationExecutor
} from './capability-runtime.js';

export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_ID =
  'discovery.cn-preliminary-publication-facts' as const;
export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_VERSION = '1.0.0' as const;
export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_INPUT_SCHEMA =
  'data-engine-input.cn-preliminary-publication-fact-discovery.v2' as const;
export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_OUTPUT_SCHEMA =
  'capability-output.cn-preliminary-publication-fact-discovery.v2' as const;
export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_IMPLEMENTATION_KEY =
  'data-engine.cn-preliminary-publication-discovery.v2' as const;

export interface CnPreliminaryPublicationDiscoveryCapabilityInputV2 {
  jurisdiction: 'CN';
  authority: 'CNIPA';
  objectType: 'TRADEMARK_APPLICATION';
  operation: 'DISCOVER_PRELIMINARY_PUBLICATION_FACTS';
  candidateType: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE;
  applicationNumberStart: string;
  applicationNumberEnd: string;
  pageSize?: number;
  cursor?: string;
}

export interface CnPreliminaryPublicationDiscoveryCapabilityOutputV2 {
  schemaVersion: 1;
  kind: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID;
  jurisdiction: 'CN';
  candidateType: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE;
  dataEngine: {
    integrationContractVersion: typeof DATA_ENGINE_INTEGRATION_CONTRACT_VERSION;
    discoveryContractVersion: typeof DATA_ENGINE_DISCOVERY_CONTRACT_VERSION;
    engineVersion: string;
    resourceKind: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND;
  };
  page: CnPreliminaryPublicationDiscoveryPageV2;
  objectiveFactOnly: true;
  rankingApplied: false;
  scoringApplied: false;
  recommendation: false;
  legalConclusion: false;
  brainResearchHotPathUsed: false;
  candidateLifecycleStateCreated: false;
  productBusinessStateMutated: false;
}

export interface CnPreliminaryPublicationDiscoveryClientV2 {
  discover(
    request: Readonly<CnPreliminaryPublicationDiscoveryRequestV2>,
    context?: Readonly<{ correlationId?: string; requestId?: string }>
  ): Promise<CnPreliminaryPublicationDiscoveryEnvelopeV2>;
}

export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_DEFINITION: Readonly<RuntimeCapabilityDefinition> =
  Object.freeze({
    schemaVersion: 1,
    runtimeCapabilityDefinitionId: 'runtime-capability_cn-preliminary-publication-discovery-v2',
    version: 1,
    capabilityId: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_ID,
    capabilityVersion: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_VERSION,
    title: 'CN preliminary-publication objective fact Discovery',
    description:
      'Reads one bounded deterministic application-number range from the authenticated Data Engine preliminary-publication fact stream without ranking, scoring, recommendation, candidate lifecycle ownership or product-state mutation.',
    lineage: {
      capabilityId: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_ID
    },
    canonReference: {
      canonId: 'phase4-cn-preliminary-publication-discovery-v2',
      canonVersion: '1',
      sourceFingerprintSha256: '48bd9a35678fccedc0ae41eb32e04f1faa80b945b849401e245d4b0dbb2249cc'
    },
    acceptedCanonProjection: true,
    createdFromWorkEvidence: false,
    createdFromAiOutput: false,
    createdAt: '2026-08-29T11:00:00.000Z'
  });

export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_IMPLEMENTATION_PROFILE: Readonly<ImplementationProfile> =
  Object.freeze({
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_cn-preliminary-publication-discovery-v2',
    version: 1,
    capabilityId: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_ID,
    capabilityVersion: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_VERSION,
    kind: 'DETERMINISTIC_SERVICE',
    status: 'APPROVED',
    implementationKey: CN_PRELIMINARY_PUBLICATION_DISCOVERY_IMPLEMENTATION_KEY,
    inputSchemaId: CN_PRELIMINARY_PUBLICATION_DISCOVERY_INPUT_SCHEMA,
    outputSchemaId: CN_PRELIMINARY_PUBLICATION_DISCOVERY_OUTPUT_SCHEMA,
    allowedCallerProducts: ['MARKREG'],
    maximumRiskClass: 'LOW',
    timeoutMs: 5000,
    maxAttempts: 1,
    approvalPolicyVersion: 'phase4-cn-preliminary-publication-discovery-pilot.v2',
    createdAt: '2026-08-29T11:00:00.000Z'
  });

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function allowedKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function parseCnPreliminaryPublicationDiscoveryCapabilityInputV2(
  value: unknown
): CnPreliminaryPublicationDiscoveryCapabilityInputV2 & { pageSize: number } {
  const input = record(value);
  if (
    !input ||
    !allowedKeys(input, [
      'jurisdiction',
      'authority',
      'objectType',
      'operation',
      'candidateType',
      'applicationNumberStart',
      'applicationNumberEnd',
      'pageSize',
      'cursor'
    ]) ||
    input.jurisdiction !== 'CN' ||
    input.authority !== 'CNIPA' ||
    input.objectType !== 'TRADEMARK_APPLICATION' ||
    input.operation !== 'DISCOVER_PRELIMINARY_PUBLICATION_FACTS' ||
    input.candidateType !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE ||
    typeof input.applicationNumberStart !== 'string' ||
    typeof input.applicationNumberEnd !== 'string' ||
    (input.pageSize !== undefined && typeof input.pageSize !== 'number') ||
    (input.cursor !== undefined && typeof input.cursor !== 'string')
  ) {
    throw new TypeError(
      'CN preliminary-publication Discovery input is outside the Phase 4 V2 contract.'
    );
  }
  const normalized = normalizeCnPreliminaryPublicationDiscoveryRequestV2({
    applicationNumberStart: input.applicationNumberStart,
    applicationNumberEnd: input.applicationNumberEnd,
    ...(input.pageSize === undefined ? {} : { pageSize: input.pageSize }),
    ...(input.cursor === undefined ? {} : { cursor: input.cursor })
  });
  return {
    jurisdiction: 'CN',
    authority: 'CNIPA',
    objectType: 'TRADEMARK_APPLICATION',
    operation: 'DISCOVER_PRELIMINARY_PUBLICATION_FACTS',
    candidateType: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
    applicationNumberStart: normalized.applicationNumberStart,
    applicationNumberEnd: normalized.applicationNumberEnd,
    pageSize: normalized.pageSize,
    ...(normalized.cursor === undefined ? {} : { cursor: normalized.cursor })
  };
}

export function validateCnPreliminaryPublicationDiscoveryCapabilityInputV2(
  value: unknown
): boolean {
  try {
    parseCnPreliminaryPublicationDiscoveryCapabilityInputV2(value);
    return true;
  } catch {
    return false;
  }
}

export function validateCnPreliminaryPublicationDiscoveryCapabilityOutputV2(
  value: unknown
): boolean {
  const output = record(value);
  const dataEngine = record(output?.dataEngine);
  if (
    !output ||
    !dataEngine ||
    output.schemaVersion !== 1 ||
    output.kind !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID ||
    output.jurisdiction !== 'CN' ||
    output.candidateType !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE ||
    dataEngine.integrationContractVersion !== DATA_ENGINE_INTEGRATION_CONTRACT_VERSION ||
    dataEngine.discoveryContractVersion !== DATA_ENGINE_DISCOVERY_CONTRACT_VERSION ||
    typeof dataEngine.engineVersion !== 'string' ||
    dataEngine.engineVersion.length === 0 ||
    dataEngine.resourceKind !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND ||
    !parseCnPreliminaryPublicationDiscoveryPageV2(output.page) ||
    output.objectiveFactOnly !== true ||
    output.rankingApplied !== false ||
    output.scoringApplied !== false ||
    output.recommendation !== false ||
    output.legalConclusion !== false ||
    output.brainResearchHotPathUsed !== false ||
    output.candidateLifecycleStateCreated !== false ||
    output.productBusinessStateMutated !== false
  ) {
    return false;
  }
  const page = parseCnPreliminaryPublicationDiscoveryPageV2(output.page)!;
  return (
    page.snapshot.source_version === dataEngine.engineVersion &&
    page.provenance.engine_version === dataEngine.engineVersion
  );
}

export class CnPreliminaryPublicationDiscoveryCapabilityExecutorV2 implements CapabilityImplementationExecutor {
  constructor(private readonly client: CnPreliminaryPublicationDiscoveryClientV2) {}

  async execute(
    request: Readonly<CapabilityRequestV2>,
    binding: Readonly<ImplementationBinding>
  ): Promise<CapabilityImplementationExecutionResult> {
    if (
      binding.implementation.kind !== 'DETERMINISTIC_SERVICE' ||
      binding.implementation.implementationKey !==
        CN_PRELIMINARY_PUBLICATION_DISCOVERY_IMPLEMENTATION_KEY
    ) {
      throw new TypeError(
        'CN preliminary-publication Discovery implementation binding has drifted.'
      );
    }
    const input = parseCnPreliminaryPublicationDiscoveryCapabilityInputV2(request.input);
    const envelope = parseCnPreliminaryPublicationDiscoveryEnvelopeV2(
      await this.client.discover(
        {
          applicationNumberStart: input.applicationNumberStart,
          applicationNumberEnd: input.applicationNumberEnd,
          pageSize: input.pageSize,
          ...(input.cursor === undefined ? {} : { cursor: input.cursor })
        },
        { correlationId: request.correlationId }
      )
    );
    if (!envelope) {
      throw new TypeError(
        'CN preliminary-publication Discovery client returned an invalid V2 fact envelope.'
      );
    }
    const scope = envelope.payload.query.scope.application_number;
    if (
      scope.start_inclusive !== input.applicationNumberStart ||
      scope.end_exclusive !== input.applicationNumberEnd ||
      envelope.payload.query.limits.page_size !== input.pageSize
    ) {
      throw new TypeError(
        'CN preliminary-publication Discovery response scope does not match the requested range.'
      );
    }

    const output: CnPreliminaryPublicationDiscoveryCapabilityOutputV2 = {
      schemaVersion: 1,
      kind: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
      jurisdiction: 'CN',
      candidateType: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
      dataEngine: {
        integrationContractVersion: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
        discoveryContractVersion: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
        engineVersion: envelope.engine_version,
        resourceKind: CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND
      },
      page: envelope.payload,
      objectiveFactOnly: true,
      rankingApplied: false,
      scoringApplied: false,
      recommendation: false,
      legalConclusion: false,
      brainResearchHotPathUsed: false,
      candidateLifecycleStateCreated: false,
      productBusinessStateMutated: false
    };
    return {
      output,
      evidenceRefs: [
        `data-engine-integration-contract:${DATA_ENGINE_INTEGRATION_CONTRACT_VERSION}`,
        `data-engine-discovery-contract:${DATA_ENGINE_DISCOVERY_CONTRACT_VERSION}`,
        `data-engine-discovery-stream:${CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID}`,
        `data-engine-query-sha256:${envelope.payload.query.query_hash}`,
        `data-engine-snapshot:${envelope.payload.snapshot.snapshot_id}`,
        'capability-runtime:brain-research-hot-path=absent',
        'capability-runtime:data-engine-direct-storage-read=absent',
        'capability-runtime:candidate-lifecycle-state=absent',
        'capability-runtime:product-business-state-write=absent'
      ]
    };
  }
}
