import { describe, expect, it } from 'vitest';
import {
  assertTradingCommercialDirectionSetV1,
  noTradingDirectionAuthorityConsequencesV1,
  type TradingCommercialDirectionRole,
  type TradingCommercialDirectionSetV1,
  type TradingCommercialDirectionVersionV1
} from '../src/trading-commercial-direction.js';
import { noTradingAiAuthorityConsequencesV1 } from '../src/trading-ai-provenance.js';

const direction = (
  role: TradingCommercialDirectionRole,
  suffix: string
): TradingCommercialDirectionVersionV1 => ({
  schemaVersion: 1,
  commercialDirectionId: `trading-ai-derived_commercial-direction_${suffix}`,
  version: 1,
  role,
  studioRun: { id: 'standard-studio-run_mark-1', version: 1 },
  brandDna: { id: 'trading-ai-derived_brand-dna_mark-1', version: 1 },
  title: role.replaceAll('_', ' '),
  summary: `A distinct ${role} commercial direction.`,
  rationale: `The exact BrandDNA supports the ${role} emphasis.`,
  constraints: ['preserve the registered mark spelling'],
  status: 'CANDIDATE',
  provenance: {
    schemaVersion: 1,
    derivedObject: { id: `trading-ai-derived_commercial-direction_${suffix}`, version: 1 },
    truthClass: 'AI_CONCEPT',
    trademarkAsset: { id: 'trademark-asset_mark-1', version: 4 },
    sourceReferences: [
      {
        ownerReference: 'lite-trading',
        sourceId: 'trading-ai-derived_brand-dna_mark-1',
        sourceVersion: 1
      },
      {
        ownerReference: 'lite-trading',
        sourceId: 'standard-studio-run_mark-1',
        sourceVersion: 1
      }
    ],
    implementation: {
      implementationProfileId: 'implementation-profile_direction',
      implementationProfileVersion: 1,
      implementationKey: 'orbit-studio/commercial-direction',
      provider: 'provider-a',
      model: 'model-1',
      promptPolicyId: 'prompt-policy_direction',
      promptPolicyVersion: '1.0.0',
      outputSchemaId: 'trading-commercial-direction-v1',
      inputSha256: 'a'.repeat(64),
      startedAt: '2026-09-07T12:02:00.000Z',
      completedAt: '2026-09-07T12:02:02.000Z'
    },
    createdAt: '2026-09-07T12:02:03.000Z',
    currentness: { state: 'CURRENT', evaluatedAt: '2026-09-07T12:02:03.000Z' },
    authorityConsequences: noTradingAiAuthorityConsequencesV1
  },
  authorityConsequences: noTradingDirectionAuthorityConsequencesV1,
  createdAt: '2026-09-07T12:02:03.000Z'
});

const directionSet = (): TradingCommercialDirectionSetV1 => ({
  schemaVersion: 1,
  commercialDirectionSetId: 'commercial-direction-set_mark-1',
  workspaceId: 'workspace-1',
  version: 1,
  studioRun: { id: 'standard-studio-run_mark-1', version: 1 },
  trademarkAsset: { id: 'trademark-asset_mark-1', version: 4 },
  brandDna: { id: 'trading-ai-derived_brand-dna_mark-1', version: 1 },
  directions: [
    direction('BEST_FIT', 'best-fit'),
    direction('VALUE_UP', 'value-up'),
    direction('POSSIBILITY', 'possibility')
  ],
  createdAt: '2026-09-07T12:02:04.000Z'
});

describe('Lite Trading CommercialDirection V1 contract', () => {
  it('requires exactly one Best Fit, Value Up and Possibility candidate', () => {
    expect(() => assertTradingCommercialDirectionSetV1(directionSet())).not.toThrow();
    expect(directionSet().directions.map((item) => item.role)).toEqual([
      'BEST_FIT',
      'VALUE_UP',
      'POSSIBILITY'
    ]);
  });

  it('rejects duplicate roles or identities', () => {
    const value = directionSet();
    expect(() =>
      assertTradingCommercialDirectionSetV1({
        ...value,
        directions: [value.directions[0], value.directions[0], value.directions[2]]
      })
    ).toThrow(/distinct direction identities|exactly once/u);
    expect(() =>
      assertTradingCommercialDirectionSetV1({
        ...value,
        directions: [
          value.directions[0],
          direction('BEST_FIT', 'duplicate-role'),
          value.directions[2]
        ]
      })
    ).toThrow(/exactly once/u);
  });

  it('requires refinements to reference the immediately previous immutable version', () => {
    const value = directionSet();
    const refined = {
      ...value.directions[0],
      version: 2,
      previousVersion: { id: value.directions[0].commercialDirectionId, version: 1 },
      provenance: {
        ...value.directions[0].provenance,
        derivedObject: { id: value.directions[0].commercialDirectionId, version: 2 }
      }
    } satisfies TradingCommercialDirectionVersionV1;
    expect(() =>
      assertTradingCommercialDirectionSetV1({
        ...value,
        directions: [refined, value.directions[1], value.directions[2]]
      })
    ).not.toThrow();
    const { previousVersion, ...withoutPreviousVersion } = refined;
    expect(previousVersion).toBeDefined();
    expect(() =>
      assertTradingCommercialDirectionSetV1({
        ...value,
        directions: [withoutPreviousVersion, value.directions[1], value.directions[2]]
      })
    ).toThrow(/immediately previous version/u);
  });

  it('keeps generated directions as AI concepts without selection or Deep Build effects', () => {
    const value = directionSet();
    expect(() =>
      assertTradingCommercialDirectionSetV1({
        ...value,
        directions: [
          {
            ...value.directions[0],
            provenance: { ...value.directions[0].provenance, truthClass: 'AI_INFERENCE' }
          },
          value.directions[1],
          value.directions[2]
        ]
      })
    ).toThrow(/AI_CONCEPT/u);
    expect(noTradingDirectionAuthorityConsequencesV1).toEqual({
      humanSelectionCreated: false,
      deepBuildStarted: false,
      listingCreated: false,
      trademarkTruthMutated: false
    });
  });
});
