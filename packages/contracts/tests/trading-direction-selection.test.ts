import { describe, expect, it } from 'vitest';
import type { TradingCommercialDirectionSetV1 } from '../src/trading-commercial-direction.js';
import {
  assertCreateTradingDirectionSelectionCommandV1,
  assertTradingDirectionSelectionV1,
  tradingDirectionSelectionAuthorityConsequencesV1,
  type CreateTradingDirectionSelectionCommandV1,
  type TradingDirectionSelectionV1
} from '../src/trading-direction-selection.js';
import { noTradingAiAuthorityConsequencesV1 } from '../src/trading-ai-provenance.js';
import { noTradingDirectionAuthorityConsequencesV1 } from '../src/trading-commercial-direction.js';

const directionSet = (): TradingCommercialDirectionSetV1 => {
  const directions = (['BEST_FIT', 'VALUE_UP', 'POSSIBILITY'] as const).map((role, index) => ({
    schemaVersion: 1 as const,
    commercialDirectionId: `trading-ai-derived_commercial-direction_${index}` as const,
    version: 1,
    role,
    studioRun: { id: 'standard-studio-run_1' as const, version: 1 },
    brandDna: { id: 'trading-ai-derived_brand-dna_1' as const, version: 1 },
    title: role,
    summary: role,
    rationale: role,
    constraints: ['preserve mark'],
    status: 'CANDIDATE' as const,
    provenance: {
      schemaVersion: 1 as const,
      derivedObject: {
        id: `trading-ai-derived_commercial-direction_${index}` as const,
        version: 1
      },
      truthClass: 'AI_CONCEPT' as const,
      trademarkAsset: { id: 'trademark-asset_1' as const, version: 2 },
      sourceReferences: [],
      implementation: {
        implementationProfileId: 'implementation-profile_1' as const,
        implementationProfileVersion: 1,
        implementationKey: 'direction',
        provider: 'provider',
        model: 'model',
        promptPolicyId: 'prompt-policy_1' as const,
        promptPolicyVersion: '1',
        outputSchemaId: 'direction-v1',
        inputSha256: 'a'.repeat(64),
        startedAt: '2026-09-07T00:00:00Z',
        completedAt: '2026-09-07T00:00:01Z'
      },
      createdAt: '2026-09-07T00:00:02Z',
      currentness: { state: 'CURRENT' as const, evaluatedAt: '2026-09-07T00:00:02Z' },
      authorityConsequences: noTradingAiAuthorityConsequencesV1
    },
    authorityConsequences: noTradingDirectionAuthorityConsequencesV1,
    createdAt: '2026-09-07T00:00:02Z'
  }));
  return {
    schemaVersion: 1,
    commercialDirectionSetId: 'commercial-direction-set_1',
    workspaceId: 'workspace-1',
    version: 1,
    studioRun: { id: 'standard-studio-run_1', version: 1 },
    trademarkAsset: { id: 'trademark-asset_1', version: 2 },
    brandDna: { id: 'trading-ai-derived_brand-dna_1', version: 1 },
    directions: [directions[0]!, directions[1]!, directions[2]!],
    createdAt: '2026-09-07T00:00:03Z'
  };
};

const selection = (): TradingDirectionSelectionV1 => ({
  schemaVersion: 1,
  directionSelectionId: 'trading-direction-selection_1',
  workspaceId: 'workspace-1',
  version: 1,
  status: 'CURRENT',
  directionSet: { id: 'commercial-direction-set_1', version: 1 },
  selectedDirection: { id: 'trading-ai-derived_commercial-direction_0', version: 1 },
  selectionMethod: 'EXPLICIT_HUMAN_ACTION',
  selectedAt: '2026-09-07T00:01:00Z',
  correlationId: 'correlation_1',
  authorityConsequences: tradingDirectionSelectionAuthorityConsequencesV1
});

describe('Lite Trading direction selection V1 contract', () => {
  it('records one explicit human choice from the exact direction set', () => {
    expect(() => assertTradingDirectionSelectionV1(selection(), directionSet())).not.toThrow();
  });

  it('rejects stale set versions and candidates outside the set', () => {
    expect(() =>
      assertTradingDirectionSelectionV1(
        { ...selection(), directionSet: { id: 'commercial-direction-set_1', version: 2 } },
        directionSet()
      )
    ).toThrow(/exact direction set/u);
    expect(() =>
      assertTradingDirectionSelectionV1(
        {
          ...selection(),
          selectedDirection: { id: 'trading-ai-derived_commercial-direction_other', version: 1 }
        },
        directionSet()
      )
    ).toThrow(/exact DirectionVersion/u);
  });

  it('keeps Deep Build, Listing and Trademark Truth outside selection authority', () => {
    expect(tradingDirectionSelectionAuthorityConsequencesV1).toEqual({
      humanSelectionRecorded: true,
      deepBuildStarted: false,
      listingCreated: false,
      trademarkTruthMutated: false
    });
  });

  it('requires exact optimistic versions and idempotency on the command', () => {
    const command: CreateTradingDirectionSelectionCommandV1 = {
      schemaVersion: 1,
      directionSetId: 'commercial-direction-set_1',
      expectedDirectionSetVersion: 1,
      selectedDirectionId: 'trading-ai-derived_commercial-direction_0',
      expectedDirectionVersion: 1,
      idempotencyKey: 'select-direction-1',
      correlationId: 'correlation_1'
    };
    expect(() => assertCreateTradingDirectionSelectionCommandV1(command)).not.toThrow();
    expect(() =>
      assertCreateTradingDirectionSelectionCommandV1({ ...command, expectedDirectionVersion: 0 })
    ).toThrow(/positive integer/u);
  });
});
