import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID
} from '@markorbit/contracts/brain-us-trademark-mark-representation-method';

export const US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID =
  'markreg.us-trademark-mark-representation-strategy-source' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION = '1.0.0' as const;

export const US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_DEFINITION: Readonly<RuntimeCapabilityDefinition> =
  Object.freeze({
    schemaVersion: 1,
    runtimeCapabilityDefinitionId:
      'runtime-capability_us-trademark-mark-representation-strategy-source-v1',
    version: 1,
    capabilityId: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID,
    capabilityVersion: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION,
    title: 'US trademark mark-representation strategy source',
    description:
      'Produces bounded evidence-backed mark-representation dimensions for human strategy review from current governed USPTO Method evidence.',
    lineage: { capabilityId: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID },
    canonReference: {
      canonId: 'github:yoomarks/markorbit#903',
      canonVersion: '1',
      sourceFingerprintSha256: 'eb9fe8e8814c37b713409c45f9dec633712e2684df4886760b0776c21e2ac26a'
    },
    acceptedCanonProjection: true,
    createdFromWorkEvidence: false,
    createdFromAiOutput: false,
    createdAt: '2026-09-06T20:05:33.000Z'
  });

export const US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE: Readonly<ImplementationProfile> =
  Object.freeze({
    schemaVersion: 1,
    implementationProfileId:
      'implementation-profile_us-trademark-mark-representation-strategy-source-v1',
    version: 1,
    capabilityId: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID,
    capabilityVersion: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION,
    kind: 'DETERMINISTIC_SERVICE',
    status: 'APPROVED',
    implementationKey: 'brain-method-package-runtime.us-trademark-mark-representation-strategy.v1',
    inputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
    outputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
    allowedCallerProducts: ['MARKREG'],
    maximumRiskClass: 'LOW',
    timeoutMs: 1000,
    maxAttempts: 1,
    approvalPolicyVersion: 'capability-production-source-admission.848.v1',
    createdAt: '2026-09-06T20:05:33.000Z'
  });
