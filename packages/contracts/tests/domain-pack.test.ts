import { describe, expect, it } from 'vitest';
import { parseDomainPackV1 } from '../src/domain-pack.js';

const reference = (owner: string, id: string) => ({ owner, id, version: '1.0.0' });
const trademarkPack = {
  schemaVersion: 1,
  domainPackId: 'domain-pack_trademark-v1',
  version: '1.0.0',
  domainId: 'trademark-services',
  title: 'Trademark Services',
  status: 'DRAFT',
  ontologyRefs: [reference('KNOWLEDGE', 'trademark-ontology')],
  truthAuthorityRefs: [
    { ...reference('CAPABILITY', 'accepted-capability-canon'), authorityKind: 'CANON' },
    {
      ...reference('DATA_ENGINE', 'official-trademark-registers'),
      authorityKind: 'OFFICIAL_SOURCE'
    },
    { ...reference('CORE', 'workspace-trademark-context'), authorityKind: 'WORKSPACE_CONTEXT' },
    { ...reference('BRAIN', 'trademark-inference-policy'), authorityKind: 'INFERENCE_POLICY' }
  ],
  knowledgeRefs: [reference('KNOWLEDGE', 'trademark-knowledge')],
  ruleRefs: [reference('MARKREG', 'professional-review-rules')],
  workflowRefs: [reference('MARKREG', 'trademark-service-workflow')],
  capabilityRequirements: [
    {
      capabilityId: 'trademark.application.prepare',
      capabilityVersion: '1.0.0',
      riskClass: 'PROTECTED',
      governancePolicyRef: reference('GOVERNANCE', 'protected-trademark-action'),
      evidenceRequirementRefs: [reference('EVIDENCE', 'trademark-preparation-evidence')],
      providerRequirementRefs: [reference('MGSN', 'trademark-professional-provider-requirements')]
    }
  ],
  benchmarkRefs: [reference('CAPABILITY', 'trademark-preparation-benchmark')],
  uiExtensions: [
    {
      extensionId: 'trademark-overview',
      surfaceOwner: 'MARKREG',
      slot: 'OVERVIEW_SECTION',
      presentationSchemaRef: reference('MARKREG', 'trademark-overview-presentation'),
      requiredCapabilityIds: ['trademark.application.prepare']
    }
  ],
  authority: {
    canonicalTruthCreated: false,
    sourceApproved: false,
    providerApproved: false,
    protectedActionAuthorized: false,
    arbitraryCodeAllowed: false
  }
} as const;

describe('domain pack contract', () => {
  it('maps Trademark requirements to existing owners by exact reference', () => {
    const parsed = parseDomainPackV1(trademarkPack);
    expect(parsed.capabilityRequirements[0]?.governancePolicyRef.owner).toBe('GOVERNANCE');
    expect(parsed.uiExtensions[0]?.surfaceOwner).toBe('MARKREG');
  });
  it('does not grant truth, source, provider, action, or code authority', () => {
    expect(() =>
      parseDomainPackV1({
        ...trademarkPack,
        authority: { ...trademarkPack.authority, providerApproved: true }
      })
    ).toThrow('authority claims must all be false');
  });
  it('rejects executable UI or provider implementation fields', () => {
    const extension = {
      ...trademarkPack.uiExtensions[0],
      moduleUrl: 'https://example.invalid/code.js'
    };
    expect(() => parseDomainPackV1({ ...trademarkPack, uiExtensions: [extension] })).toThrow(
      'unsupported fields'
    );
    const requirement = { ...trademarkPack.capabilityRequirements[0], providerName: 'vendor' };
    expect(() =>
      parseDomainPackV1({ ...trademarkPack, capabilityRequirements: [requirement] })
    ).toThrow('unsupported fields');
  });
  it('requires unique capability versions and extension identities', () => {
    expect(() =>
      parseDomainPackV1({
        ...trademarkPack,
        capabilityRequirements: [
          trademarkPack.capabilityRequirements[0],
          trademarkPack.capabilityRequirements[0]
        ]
      })
    ).toThrow('must not contain duplicates');
  });
});
