import { describe, expect, it } from 'vitest';
import { noTradingAiAuthorityConsequencesV1 } from '../src/trading-ai-provenance.js';
import {
  assertTradingAiProfileV1,
  tradingAiTagCategories,
  type TradingAiProfileV1
} from '../src/trading-ai-profile.js';

const profile = (): TradingAiProfileV1 => ({
  schemaVersion: 1,
  aiProfileId: 'trading-ai-derived_ai-profile_mark-1',
  workspaceId: 'workspace-1',
  version: 2,
  trademarkAsset: { id: 'trademark-asset_mark-1', version: 4 },
  summary: 'A concise commercial identity with an optimistic, modern tone.',
  tags: [
    {
      aiTagId: 'trading-ai-tag_industry-1',
      category: 'INDUSTRY',
      label: 'Consumer technology',
      rationale: 'The supplied product context centers on connected consumer devices.'
    },
    {
      aiTagId: 'trading-ai-tag_personality-1',
      category: 'PERSONALITY',
      label: 'Optimistic',
      rationale: 'The source language consistently emphasizes accessible progress.'
    }
  ],
  provenance: {
    schemaVersion: 1,
    derivedObject: { id: 'trading-ai-derived_ai-profile_mark-1', version: 2 },
    truthClass: 'AI_INFERENCE',
    trademarkAsset: { id: 'trademark-asset_mark-1', version: 4 },
    sourceReferences: [
      { ownerReference: 'trademark-asset', sourceId: 'trademark-asset_mark-1', sourceVersion: 4 }
    ],
    implementation: {
      implementationProfileId: 'implementation-profile_ai-profile',
      implementationProfileVersion: 1,
      implementationKey: 'orbit-studio/ai-profile',
      provider: 'provider-a',
      model: 'model-1',
      promptPolicyId: 'prompt-policy_ai-profile',
      promptPolicyVersion: '1.0.0',
      outputSchemaId: 'trading-ai-profile-v1',
      inputSha256: 'a'.repeat(64),
      startedAt: '2026-09-07T12:00:00.000Z',
      completedAt: '2026-09-07T12:00:02.000Z'
    },
    createdAt: '2026-09-07T12:00:03.000Z',
    currentness: { state: 'CURRENT', evaluatedAt: '2026-09-07T12:00:03.000Z' },
    authorityConsequences: noTradingAiAuthorityConsequencesV1
  },
  createdAt: '2026-09-07T12:00:03.000Z'
});

const commercialInsights = (): NonNullable<TradingAiProfileV1['commercialInsights']> => ({
  schemaVersion: 1,
  evidenceCoverage: 'LIMITED',
  personas: [
    {
      commercialPersonaId: 'trading-commercial-persona_consumer-1',
      kind: 'END_CONSUMER',
      label: 'Active urban consumer',
      summary: 'A possible consumer audience for a future brand.',
      evidenceRefs: ['trading-commercial-evidence_mark-record-1']
    },
    {
      commercialPersonaId: 'trading-commercial-persona_operator-1',
      kind: 'BUSINESS_OPERATOR',
      label: 'Apparel operator',
      summary: 'An operator positioned to build an apparel business.'
    },
    {
      commercialPersonaId: 'trading-commercial-persona_buyer-1',
      kind: 'TRADEMARK_BUYER',
      label: 'Trademark asset buyer',
      summary: 'A buyer seeking an existing trademark asset.',
      assumptionRefs: ['trading-commercial-assumption_channel-1']
    }
  ],
  sellingPoints: [
    {
      sellingPointId: 'trading-selling-point_class-fit-1',
      label: 'Relevant class coverage',
      description: 'The recorded goods may fit an apparel business direction.',
      basisType: 'TRUTH_DERIVED',
      sourceRefs: ['trademark-asset_mark-1']
    }
  ],
  buyingPoints: [
    {
      buyingPointId: 'trading-buying-point_launch-fit-1',
      label: 'Potential launch fit',
      description: 'The class coverage may reduce naming-to-launch friction for this operator.',
      sellingPointRefs: ['trading-selling-point_class-fit-1'],
      personaRefs: ['trading-commercial-persona_buyer-1'],
      scenarioRefs: ['trading-commercial-scenario_launch-1'],
      assumptionRefs: ['trading-commercial-assumption_channel-1']
    }
  ],
  scenarios: [
    {
      commercialScenarioId: 'trading-commercial-scenario_launch-1',
      label: 'Possible apparel launch',
      description: 'A possible future launch scenario, not an existing business fact.',
      kind: 'LAUNCH',
      personaRefs: ['trading-commercial-persona_operator-1'],
      buyingPointRefs: ['trading-buying-point_launch-fit-1']
    }
  ],
  evidenceBasis: [
    {
      commercialEvidenceId: 'trading-commercial-evidence_mark-record-1',
      label: 'Current trademark record',
      sourceRef: 'trademark-asset_mark-1',
      sourceType: 'TRADEMARK_TRUTH'
    }
  ],
  assumptions: [
    {
      commercialAssumptionId: 'trading-commercial-assumption_channel-1',
      label: 'Future channel fit',
      description: 'Channel suitability has not been validated with market-performance data.',
      risk: 'MEDIUM'
    }
  ],
  limits: ['Evidence coverage describes data sufficiency, not commercial success probability.']
});

describe('Lite Trading AI Profile V1 contract', () => {
  it('supports the eight structured Product PRD tag categories without numeric confidence', () => {
    expect(tradingAiTagCategories).toEqual([
      'INDUSTRY',
      'AUDIENCE',
      'POSITIONING',
      'PERSONALITY',
      'VISUAL_LANGUAGE',
      'CHANNEL_FIT',
      'MARKET_FIT',
      'BRAND_POTENTIAL'
    ]);
    expect(() => assertTradingAiProfileV1(profile())).not.toThrow();
    expect(profile().tags[0]).not.toHaveProperty('confidence');
  });

  it('binds the profile to its exact derived-object and Trademark Asset versions', () => {
    expect(() =>
      assertTradingAiProfileV1({
        ...profile(),
        provenance: {
          ...profile().provenance,
          derivedObject: { ...profile().provenance.derivedObject, version: 3 }
        }
      })
    ).toThrow(/exact profile version/u);
    expect(() =>
      assertTradingAiProfileV1({
        ...profile(),
        trademarkAsset: { ...profile().trademarkAsset, version: 5 }
      })
    ).toThrow(/same exact Trademark Asset version/u);
  });

  it('never accepts an AI Profile as an AI concept or canonical fact', () => {
    expect(() =>
      assertTradingAiProfileV1({
        ...profile(),
        provenance: { ...profile().provenance, truthClass: 'AI_CONCEPT' }
      })
    ).toThrow(/AI_INFERENCE/u);
    expect(profile().provenance.authorityConsequences.officialTruthCreated).toBe(false);
    expect(profile().provenance.authorityConsequences.trademarkTruthMutated).toBe(false);
  });

  it('rejects duplicate tag identities and keeps created time aligned with provenance', () => {
    expect(() =>
      assertTradingAiProfileV1({
        ...profile(),
        tags: [profile().tags[0]!, profile().tags[0]!]
      })
    ).toThrow(/duplicate ids/u);
    expect(() =>
      assertTradingAiProfileV1({ ...profile(), createdAt: '2026-09-07T12:00:04.000Z' })
    ).toThrow(/provenance timestamp/u);
  });

  it('accepts a backward-compatible Commercial Value Map with three distinct persona kinds', () => {
    expect(() =>
      assertTradingAiProfileV1({ ...profile(), commercialInsights: commercialInsights() })
    ).not.toThrow();
    expect(commercialInsights().evidenceCoverage).toBe('LIMITED');
    expect(commercialInsights()).not.toHaveProperty('confidence');
  });

  it('requires all three commercial persona layers', () => {
    const insights = commercialInsights();
    expect(() =>
      assertTradingAiProfileV1({
        ...profile(),
        commercialInsights: { ...insights, personas: insights.personas.slice(0, 2) }
      })
    ).toThrow(/all three persona kinds/u);
  });

  it('rejects buying points with unknown selling-point, persona or scenario references', () => {
    const insights = commercialInsights();
    expect(() =>
      assertTradingAiProfileV1({
        ...profile(),
        commercialInsights: {
          ...insights,
          buyingPoints: [
            {
              ...insights.buyingPoints[0]!,
              sellingPointRefs: ['trading-selling-point_unknown']
            }
          ]
        }
      })
    ).toThrow(/unknown reference/u);
  });

  it('rejects dangling evidence and assumption references', () => {
    const insights = commercialInsights();
    expect(() =>
      assertTradingAiProfileV1({
        ...profile(),
        commercialInsights: {
          ...insights,
          personas: [
            {
              ...insights.personas[0]!,
              evidenceRefs: ['trading-commercial-evidence_unknown']
            },
            ...insights.personas.slice(1)
          ]
        }
      })
    ).toThrow(/unknown reference/u);
  });

  it('binds commercial evidence to exact AI Profile provenance sources', () => {
    const insights = commercialInsights();
    expect(() =>
      assertTradingAiProfileV1({
        ...profile(),
        commercialInsights: {
          ...insights,
          evidenceBasis: [
            {
              ...insights.evidenceBasis[0]!,
              sourceRef: 'unbound-private-source'
            }
          ]
        }
      })
    ).toThrow(/unknown reference/u);
  });
});
