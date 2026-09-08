import { describe, expect, it, vi } from 'vitest';
import { managedAiNoAuthorityConsequences } from '@markorbit/contracts/managed-ai-execution';
import type { TrademarkAsset } from '@markorbit/contracts/trademark-asset-workspace';
import {
  TRADING_AI_PROFILE_OUTPUT_SCHEMA_ID,
  HttpTradingManagedAiClient,
  TradingAiProfileGenerator,
  type TradingManagedAiClient
} from '../src/trading-ai-profile-generation.js';

const workspaceId = '98989898-9898-4989-8989-989898989898';
const principal = {
  kind: 'WORKSPACE' as const,
  sessionId: 'session_1',
  userId: 'user_1',
  workspaceId,
  membershipId: 'membership_1',
  role: 'WORKSPACE_ADMIN' as const,
  permissions: ['workspace:read' as const],
  sessionExpiresAt: '2026-09-09T00:00:00Z'
};

const asset: TrademarkAsset = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_1',
  workspaceId,
  version: 2,
  identity: { jurisdiction: 'US', markText: 'ORBIT' },
  externalIdentifiers: [],
  workspaceRelationships: [],
  sourceReferences: [],
  relations: [],
  workspaceTags: [],
  workspaceNotes: [],
  officialTruthVerifiedByLite: false,
  filingExecutedByLite: false,
  createdAt: '2026-09-08T00:00:00Z',
  updatedAt: '2026-09-08T00:00:00Z'
};

const commercialInsights = {
  schemaVersion: 1,
  evidenceCoverage: 'LIMITED',
  personas: [
    {
      commercialPersonaId: 'trading-commercial-persona_consumer-1',
      kind: 'END_CONSUMER',
      label: 'Potential end consumer',
      summary: 'A possible audience for a future ORBIT-branded offer.',
      evidenceRefs: ['trading-commercial-evidence_asset-1']
    },
    {
      commercialPersonaId: 'trading-commercial-persona_operator-1',
      kind: 'BUSINESS_OPERATOR',
      label: 'Potential operator',
      summary: 'An operator exploring a business built around the asset.'
    },
    {
      commercialPersonaId: 'trading-commercial-persona_buyer-1',
      kind: 'TRADEMARK_BUYER',
      label: 'Potential trademark buyer',
      summary: 'A buyer evaluating whether the asset fits a future launch.',
      assumptionRefs: ['trading-commercial-assumption_demand-1']
    }
  ],
  sellingPoints: [
    {
      sellingPointId: 'trading-selling-point_identity-1',
      label: 'Concise identity',
      description: 'The supplied mark text is concise.',
      basisType: 'TRUTH_DERIVED',
      sourceRefs: [asset.trademarkAssetId]
    }
  ],
  buyingPoints: [
    {
      buyingPointId: 'trading-buying-point_launch-1',
      label: 'Potential launch fit',
      description: 'A buyer may consider the concise identity useful for a future launch.',
      sellingPointRefs: ['trading-selling-point_identity-1'],
      personaRefs: ['trading-commercial-persona_buyer-1'],
      scenarioRefs: ['trading-commercial-scenario_launch-1'],
      assumptionRefs: ['trading-commercial-assumption_demand-1']
    }
  ],
  scenarios: [
    {
      commercialScenarioId: 'trading-commercial-scenario_launch-1',
      label: 'Possible future launch',
      description: 'A hypothetical launch scenario, not an existing business fact.',
      kind: 'LAUNCH',
      personaRefs: ['trading-commercial-persona_operator-1'],
      buyingPointRefs: ['trading-buying-point_launch-1']
    }
  ],
  evidenceBasis: [
    {
      commercialEvidenceId: 'trading-commercial-evidence_asset-1',
      label: 'Supplied Trademark Asset',
      sourceRef: asset.trademarkAssetId,
      sourceType: 'TRADEMARK_ASSET'
    }
  ],
  assumptions: [
    {
      commercialAssumptionId: 'trading-commercial-assumption_demand-1',
      label: 'Future demand',
      description: 'Market demand has not been established.',
      risk: 'HIGH'
    }
  ],
  limits: ['Evidence coverage is qualitative and does not predict commercial success.']
} as const;

function outcome(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    status: 'COMPLETED',
    deliveryState: 'PROVIDER_COMPLETED',
    retryDisposition: 'RETRY_FORBIDDEN',
    provenance: {
      implementationProfileId: 'implementation-profile_ai-profile',
      implementationProfileVersion: 1,
      implementationKey: 'managed-ai:knowledge-deepseek:v1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      promptPolicyId: 'lite-trading-ai-profile',
      promptPolicyVersion: '2',
      outputSchemaId: TRADING_AI_PROFILE_OUTPUT_SCHEMA_ID,
      inputSha256: 'a'.repeat(64),
      startedAt: '2026-09-08T00:00:01Z',
      completedAt: '2026-09-08T00:00:02Z'
    },
    exactOutput: {
      kind: 'DURABLE_REF',
      mediaType: 'application/json',
      sha256: 'b'.repeat(64),
      sizeBytes: 100,
      ref: 'artifact://managed-ai/exact/ai-profile-1'
    },
    structuredOutput: {
      summary: 'A focused technology brand.',
      commercialInsights,
      tags: [
        {
          aiTagId: 'trading-ai-tag_industry-1',
          category: 'INDUSTRY',
          label: 'Technology',
          rationale: 'The supplied identity suggests technology services.'
        }
      ]
    },
    authority: managedAiNoAuthorityConsequences,
    ...overrides
  };
}

function command() {
  return {
    workspaceId,
    studioRun: { id: 'standard-studio-run_1' as const, version: 1 },
    trademarkAsset: asset,
    aiProfileId: 'trading-ai-derived_ai-profile_1' as const,
    version: 1,
    userBrief: ' Let AI lead. ',
    idempotencyKey: 'studio-run-1:ai-profile:1',
    correlationId: 'studio-run-1'
  };
}

describe('Lite Trading AI Profile generation adapter', () => {
  it('invokes the governed Capability Runtime with trusted Lite caller context', async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            returnValue: {
              status: 'COMPLETED',
              outputSchemaId: 'managed-ai-output.v1',
              output: outcome()
            }
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    const client = new HttpTradingManagedAiClient(
      'http://capability.test/',
      's'.repeat(32),
      principal,
      fetcher
    );
    expect(
      await client.execute({ schemaVersion: 1 } as never, {
        idempotencyKey: 'profile-1',
        correlationId: 'run-1'
      })
    ).toEqual(outcome());
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('http://capability.test/v1/capability-requests');
    expect(init?.headers).toMatchObject({
      'x-markorbit-workspace-id': workspaceId,
      'x-markorbit-caller-product': 'LITE',
      'idempotency-key': 'profile-1',
      'x-correlation-id': 'run-1'
    });
    expect(JSON.parse(init?.body as string)).toMatchObject({
      capabilityId: 'managed-ai-execution',
      caller: {
        workspaceId,
        principalId: principal.userId,
        callerProduct: 'LITE',
        permissionContextRef: `core-workspace-membership:${principal.membershipId}`
      },
      inputSchemaId: 'managed-ai-input.v1',
      outputSchemaId: 'managed-ai-output.v1'
    });
  });

  it('maps network and governed runtime failures without accepting partial output', async () => {
    await expect(
      new HttpTradingManagedAiClient('http://capability.test', 's'.repeat(32), principal, () =>
        Promise.reject(new Error('offline'))
      ).execute({ schemaVersion: 1 } as never, {
        idempotencyKey: 'profile-1',
        correlationId: 'run-1'
      })
    ).rejects.toMatchObject({ code: 'MANAGED_AI_FAILED', retryable: true });
    await expect(
      new HttpTradingManagedAiClient('http://capability.test', 's'.repeat(32), principal, () =>
        Promise.resolve(new Response(JSON.stringify({ returnValue: {} }), { status: 200 }))
      ).execute({ schemaVersion: 1 } as never, {
        idempotencyKey: 'profile-1',
        correlationId: 'run-1'
      })
    ).rejects.toMatchObject({ code: 'MANAGED_AI_FAILED' });
  });

  it('uses governed Managed AI and binds exact source and implementation provenance', async () => {
    const execute = vi.fn<TradingManagedAiClient['execute']>(() => Promise.resolve(outcome()));
    const profile = await new TradingAiProfileGenerator({ execute }).generate(command());

    const [input, context] = execute.mock.calls[0]!;
    expect(input).toMatchObject({
      processingClass: 'CONTENT_GENERATION',
      dataClassification: 'CONFIDENTIAL',
      requestedOutput: { schemaId: TRADING_AI_PROFILE_OUTPUT_SCHEMA_ID, format: 'JSON' },
      requirements: { exactProviderOutputRequired: true, provenanceRequired: true },
      taskInput: {
        studioRun: command().studioRun,
        trademarkAsset: asset,
        userBrief: 'Let AI lead.'
      }
    });
    expect(context).toEqual({
      idempotencyKey: command().idempotencyKey,
      correlationId: command().correlationId
    });
    expect(profile).toMatchObject({
      trademarkAsset: { id: asset.trademarkAssetId, version: asset.version },
      summary: 'A focused technology brand.',
      commercialInsights,
      provenance: {
        truthClass: 'AI_INFERENCE',
        sourceReferences: [
          {
            ownerReference: 'lite-trademark-asset',
            sourceId: asset.trademarkAssetId,
            sourceVersion: asset.version
          },
          {
            ownerReference: 'lite-trading-studio-run',
            sourceId: command().studioRun.id,
            sourceVersion: command().studioRun.version
          }
        ],
        implementation: {
          implementationKey: 'managed-ai:knowledge-deepseek:v1'
        }
      }
    });
  });

  it('fails closed on unsuccessful or incomplete governed outcomes', async () => {
    await expect(
      new TradingAiProfileGenerator({
        execute: () =>
          Promise.resolve(
            outcome({
              status: 'FAILED',
              deliveryState: 'NOT_DELIVERED',
              retryDisposition: 'RETRY_ALLOWED',
              provenance: undefined,
              exactOutput: undefined,
              structuredOutput: undefined,
              error: { code: 'RATE_LIMITED', message: 'Try later.' }
            })
          )
      }).generate(command())
    ).rejects.toMatchObject({ code: 'MANAGED_AI_FAILED', retryable: true });

    await expect(
      new TradingAiProfileGenerator({
        execute: () => Promise.resolve(outcome({ exactOutput: undefined }))
      }).generate(command())
    ).rejects.toMatchObject({ code: 'MANAGED_AI_CONTRACT_MISMATCH' });
  });

  it('rejects malformed AI content and cross-workspace source input', async () => {
    await expect(
      new TradingAiProfileGenerator({
        execute: () =>
          Promise.resolve(outcome({ structuredOutput: { summary: 'Profile', tags: [{}] } }))
      }).generate(command())
    ).rejects.toMatchObject({ code: 'MANAGED_AI_CONTRACT_MISMATCH' });

    await expect(
      new TradingAiProfileGenerator({ execute: () => Promise.resolve(outcome()) }).generate({
        ...command(),
        workspaceId: '11111111-1111-4111-8111-111111111111'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects incomplete or quantitative Commercial Value Map output', async () => {
    await expect(
      new TradingAiProfileGenerator({
        execute: () =>
          Promise.resolve(
            outcome({
              structuredOutput: {
                summary: 'Profile',
                tags: [],
                commercialInsights: {
                  ...commercialInsights,
                  personas: commercialInsights.personas.slice(0, 2)
                }
              }
            })
          )
      }).generate(command())
    ).rejects.toMatchObject({ code: 'MANAGED_AI_CONTRACT_MISMATCH' });

    await expect(
      new TradingAiProfileGenerator({
        execute: () =>
          Promise.resolve(
            outcome({
              structuredOutput: {
                summary: 'Profile',
                tags: [],
                commercialInsights: { ...commercialInsights, confidence: 0.91 }
              }
            })
          )
      }).generate(command())
    ).rejects.toMatchObject({ code: 'MANAGED_AI_CONTRACT_MISMATCH' });
  });
});
