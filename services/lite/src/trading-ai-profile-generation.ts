import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  MANAGED_AI_EXECUTION_CAPABILITY_ID,
  MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  parseManagedAiExecutionOutcomeV1,
  type ManagedAiExecutionInputV1,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import {
  assertTradingAiProfileV1,
  tradingAiTagCategories,
  type TradingCommercialInsightsV1,
  type TradingAiProfileId,
  type TradingAiProfileV1,
  type TradingAiTagV1
} from '@markorbit/contracts/trading-ai-profile';
import { noTradingAiAuthorityConsequencesV1 } from '@markorbit/contracts/trading-ai-provenance';
import type { TradingStandardStudioRunId } from '@markorbit/contracts/trading-studio-usage';
import type { TrademarkAsset } from '@markorbit/contracts/trademark-asset-workspace';

export const TRADING_AI_PROFILE_OUTPUT_SCHEMA_ID = 'lite-trading-ai-profile-generation.v2';
export const TRADING_AI_PROFILE_PROMPT_POLICY_ID = 'lite-trading-ai-profile';
export const TRADING_AI_PROFILE_PROMPT_POLICY_VERSION = '2';

export interface TradingManagedAiClient {
  execute(
    input: Readonly<ManagedAiExecutionInputV1>,
    context: Readonly<{ idempotencyKey: string; correlationId: string }>
  ): Promise<unknown>;
}

export class HttpTradingManagedAiClient implements TradingManagedAiClient {
  constructor(
    private readonly capabilityUrl: string,
    private readonly internalServiceSecret: string,
    private readonly principal: Readonly<WorkspacePrincipal>,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async execute(
    input: Readonly<ManagedAiExecutionInputV1>,
    context: Readonly<{ idempotencyKey: string; correlationId: string }>
  ): Promise<unknown> {
    const command = {
      schemaVersion: 2,
      capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
      capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
      caller: {
        workspaceId: this.principal.workspaceId,
        principalId: this.principal.userId,
        callerProduct: 'LITE',
        permissionContextRef: `core-workspace-membership:${this.principal.membershipId}`
      },
      purpose: 'Generate one versioned Lite Trading AI Profile candidate.',
      input,
      inputSchemaId: 'managed-ai-input.v1',
      outputSchemaId: 'managed-ai-output.v1',
      riskClass: 'LOW',
      idempotencyKey: context.idempotencyKey,
      correlationId: context.correlationId
    } as const;
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.capabilityUrl.replace(/\/$/u, '')}/v1/capability-requests`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(this.principal),
            'x-markorbit-workspace-id': this.principal.workspaceId,
            'x-markorbit-caller-product': 'LITE',
            'idempotency-key': context.idempotencyKey,
            'x-correlation-id': context.correlationId
          },
          body: JSON.stringify(command)
        }
      );
    } catch (cause) {
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_FAILED',
        'Governed Capability Runtime is unavailable.',
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error =
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : undefined;
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_FAILED',
        typeof error?.message === 'string'
          ? error.message
          : 'Governed Capability Runtime rejected AI Profile generation.',
        response.status >= 500
      );
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_CONTRACT_MISMATCH',
        'Governed Capability Runtime returned an invalid execution.'
      );
    const returned = (payload as Record<string, unknown>).returnValue;
    if (!returned || typeof returned !== 'object' || Array.isArray(returned))
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_CONTRACT_MISMATCH',
        'Governed Capability Runtime omitted its return value.'
      );
    const value = returned as Record<string, unknown>;
    if (value.status !== 'COMPLETED' || value.outputSchemaId !== 'managed-ai-output.v1')
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_FAILED',
        'Governed Capability Runtime did not complete Managed AI execution.'
      );
    return structuredClone(value.output);
  }
}

export interface GenerateTradingAiProfileCommand {
  workspaceId: string;
  studioRun: Readonly<{ id: TradingStandardStudioRunId; version: number }>;
  trademarkAsset: Readonly<TrademarkAsset>;
  aiProfileId: TradingAiProfileId;
  version: number;
  userBrief?: string;
  idempotencyKey: string;
  correlationId: string;
}

export class TradingAiProfileGenerationError extends Error {
  constructor(
    readonly code: 'INVALID_INPUT' | 'MANAGED_AI_FAILED' | 'MANAGED_AI_CONTRACT_MISMATCH',
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TradingAiProfileGenerationError';
  }
}

function required(value: string, field: string, maximum = 500): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new TradingAiProfileGenerationError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`
    );
  return cleaned;
}

function output(value: unknown): Readonly<{
  summary: string;
  tags: readonly TradingAiTagV1[];
  commercialInsights: Readonly<TradingCommercialInsightsV1>;
}> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TradingAiProfileGenerationError(
      'MANAGED_AI_CONTRACT_MISMATCH',
      'Managed AI output must be an object.'
    );
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) => key !== 'summary' && key !== 'tags' && key !== 'commercialInsights'
    )
  )
    throw new TradingAiProfileGenerationError(
      'MANAGED_AI_CONTRACT_MISMATCH',
      'Managed AI output contains unsupported fields.'
    );
  if (!Array.isArray(record.tags))
    throw new TradingAiProfileGenerationError(
      'MANAGED_AI_CONTRACT_MISMATCH',
      'Managed AI output tags must be an array.'
    );
  const ids = new Set<string>();
  const tags = record.tags.map((value, index): TradingAiTagV1 => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_CONTRACT_MISMATCH',
        `Managed AI output tag ${index} must be an object.`
      );
    const tag = value as Record<string, unknown>;
    if (
      Object.keys(tag).some(
        (key) => !['aiTagId', 'category', 'label', 'rationale'].includes(key)
      ) ||
      typeof tag.aiTagId !== 'string' ||
      !/^trading-ai-tag_[A-Za-z0-9_-]+$/u.test(tag.aiTagId) ||
      ids.has(tag.aiTagId) ||
      typeof tag.category !== 'string' ||
      !tradingAiTagCategories.includes(tag.category as never) ||
      typeof tag.label !== 'string' ||
      !tag.label.trim() ||
      typeof tag.rationale !== 'string' ||
      !tag.rationale.trim()
    )
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_CONTRACT_MISMATCH',
        `Managed AI output tag ${index} is invalid.`
      );
    ids.add(tag.aiTagId);
    return {
      aiTagId: tag.aiTagId as TradingAiTagV1['aiTagId'],
      category: tag.category as TradingAiTagV1['category'],
      label: tag.label.trim(),
      rationale: tag.rationale.trim()
    };
  });
  return {
    summary: requiredOutput(record.summary, 'summary'),
    tags,
    commercialInsights: commercialInsightsOutput(record.commercialInsights)
  };
}

function commercialInsightsOutput(value: unknown): Readonly<TradingCommercialInsightsV1> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TradingAiProfileGenerationError(
      'MANAGED_AI_CONTRACT_MISMATCH',
      'Managed AI output commercialInsights must be an object.'
    );
  const record = value as Record<string, unknown>;
  const allowed = [
    'schemaVersion',
    'evidenceCoverage',
    'personas',
    'sellingPoints',
    'buyingPoints',
    'scenarios',
    'evidenceBasis',
    'assumptions',
    'limits'
  ];
  if (Object.keys(record).some((key) => !allowed.includes(key)))
    throw new TradingAiProfileGenerationError(
      'MANAGED_AI_CONTRACT_MISMATCH',
      'Managed AI output commercialInsights contains unsupported fields.'
    );
  return {
    schemaVersion: record.schemaVersion as 1,
    evidenceCoverage: record.evidenceCoverage as TradingCommercialInsightsV1['evidenceCoverage'],
    personas: objectArray(record.personas, 'commercialInsights.personas', [
      'commercialPersonaId',
      'kind',
      'label',
      'summary',
      'jobs',
      'pains',
      'desiredOutcomes',
      'evidenceRefs',
      'assumptionRefs'
    ]) as unknown as TradingCommercialInsightsV1['personas'],
    sellingPoints: objectArray(record.sellingPoints, 'commercialInsights.sellingPoints', [
      'sellingPointId',
      'label',
      'description',
      'category',
      'basisType',
      'sourceRefs',
      'evidenceRefs',
      'assumptionRefs'
    ]) as unknown as TradingCommercialInsightsV1['sellingPoints'],
    buyingPoints: objectArray(record.buyingPoints, 'commercialInsights.buyingPoints', [
      'buyingPointId',
      'label',
      'description',
      'sellingPointRefs',
      'personaRefs',
      'scenarioRefs',
      'evidenceRefs',
      'assumptionRefs'
    ]) as unknown as TradingCommercialInsightsV1['buyingPoints'],
    scenarios: objectArray(record.scenarios, 'commercialInsights.scenarios', [
      'commercialScenarioId',
      'label',
      'description',
      'kind',
      'personaRefs',
      'buyingPointRefs',
      'evidenceRefs',
      'assumptionRefs'
    ]) as unknown as TradingCommercialInsightsV1['scenarios'],
    evidenceBasis: objectArray(record.evidenceBasis, 'commercialInsights.evidenceBasis', [
      'commercialEvidenceId',
      'label',
      'sourceRef',
      'sourceType',
      'description',
      'observedAt'
    ]) as unknown as TradingCommercialInsightsV1['evidenceBasis'],
    assumptions: objectArray(record.assumptions, 'commercialInsights.assumptions', [
      'commercialAssumptionId',
      'label',
      'description',
      'risk'
    ]) as unknown as TradingCommercialInsightsV1['assumptions'],
    ...(record.limits === undefined
      ? {}
      : { limits: stringArray(record.limits, 'commercialInsights.limits') })
  };
}

function objectArray(value: unknown, field: string, allowedKeys: readonly string[]) {
  if (!Array.isArray(value))
    throw new TradingAiProfileGenerationError(
      'MANAGED_AI_CONTRACT_MISMATCH',
      `Managed AI output ${field} must be an array.`
    );
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_CONTRACT_MISMATCH',
        `Managed AI output ${field}[${index}] must be an object.`
      );
    const record = item as Record<string, unknown>;
    if (Object.keys(record).some((key) => !allowedKeys.includes(key)))
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_CONTRACT_MISMATCH',
        `Managed AI output ${field}[${index}] contains unsupported fields.`
      );
    return structuredClone(record);
  });
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new TradingAiProfileGenerationError(
      'MANAGED_AI_CONTRACT_MISMATCH',
      `Managed AI output ${field} must be a string array.`
    );
  return value.map((item) => item as string);
}

function requiredOutput(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new TradingAiProfileGenerationError(
      'MANAGED_AI_CONTRACT_MISMATCH',
      `Managed AI output ${field} is required.`
    );
  return value.trim();
}

export class TradingAiProfileGenerator {
  constructor(private readonly managedAi: TradingManagedAiClient) {}

  async generate(command: Readonly<GenerateTradingAiProfileCommand>): Promise<TradingAiProfileV1> {
    const workspaceId = required(command.workspaceId, 'workspaceId');
    const idempotencyKey = required(command.idempotencyKey, 'idempotencyKey');
    const correlationId = required(command.correlationId, 'correlationId');
    if (command.trademarkAsset.workspaceId !== workspaceId)
      throw new TradingAiProfileGenerationError(
        'INVALID_INPUT',
        'Trademark Asset must belong to the requested Workspace.'
      );
    if (!Number.isSafeInteger(command.version) || command.version < 1)
      throw new TradingAiProfileGenerationError('INVALID_INPUT', 'version must be positive.');
    if (!Number.isSafeInteger(command.studioRun.version) || command.studioRun.version < 1)
      throw new TradingAiProfileGenerationError(
        'INVALID_INPUT',
        'studioRun.version must be positive.'
      );

    const input: ManagedAiExecutionInputV1 = {
      schemaVersion: 1,
      processingClass: 'CONTENT_GENERATION',
      dataClassification: 'CONFIDENTIAL',
      taskInput: {
        studioRun: command.studioRun,
        trademarkAsset: command.trademarkAsset,
        ...(command.userBrief?.trim() ? { userBrief: command.userBrief.trim() } : {})
      },
      requestedOutput: { schemaId: TRADING_AI_PROFILE_OUTPUT_SCHEMA_ID, format: 'JSON' },
      requirements: {
        capabilities: ['structured-output'],
        exactProviderOutputRequired: true,
        provenanceRequired: true
      },
      promptPolicy: {
        policyId: TRADING_AI_PROFILE_PROMPT_POLICY_ID,
        policyVersion: TRADING_AI_PROFILE_PROMPT_POLICY_VERSION
      },
      evidence: { exactOutput: 'REQUIRED', providerRequestId: 'REQUIRED_WHEN_AVAILABLE' }
    };

    let outcome: ManagedAiExecutionOutcomeV1;
    try {
      outcome = parseManagedAiExecutionOutcomeV1(
        await this.managedAi.execute(input, { idempotencyKey, correlationId })
      );
    } catch (cause) {
      if (cause instanceof TradingAiProfileGenerationError) throw cause;
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_CONTRACT_MISMATCH',
        'Managed AI returned an invalid governed outcome.',
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (outcome.status !== 'COMPLETED')
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_FAILED',
        outcome.error?.message ?? 'Managed AI did not complete the AI Profile.',
        outcome.retryDisposition === 'RETRY_ALLOWED'
      );
    if (
      outcome.capabilityId !== MANAGED_AI_EXECUTION_CAPABILITY_ID ||
      outcome.capabilityVersion !== MANAGED_AI_EXECUTION_CONTRACT_VERSION ||
      !outcome.provenance ||
      outcome.provenance.outputSchemaId !== TRADING_AI_PROFILE_OUTPUT_SCHEMA_ID ||
      !outcome.exactOutput
    )
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_CONTRACT_MISMATCH',
        'Managed AI outcome is missing required AI Profile provenance or exact output.'
      );

    const generated = output(outcome.structuredOutput);
    const createdAt = outcome.provenance.completedAt;
    const profile: TradingAiProfileV1 = {
      schemaVersion: 1,
      aiProfileId: command.aiProfileId,
      workspaceId,
      version: command.version,
      trademarkAsset: {
        id: command.trademarkAsset.trademarkAssetId,
        version: command.trademarkAsset.version
      },
      ...generated,
      provenance: {
        schemaVersion: 1,
        derivedObject: { id: command.aiProfileId, version: command.version },
        truthClass: 'AI_INFERENCE',
        trademarkAsset: {
          id: command.trademarkAsset.trademarkAssetId,
          version: command.trademarkAsset.version
        },
        sourceReferences: [
          {
            ownerReference: 'lite-trademark-asset',
            sourceId: command.trademarkAsset.trademarkAssetId,
            sourceVersion: command.trademarkAsset.version
          },
          {
            ownerReference: 'lite-trading-studio-run',
            sourceId: command.studioRun.id,
            sourceVersion: command.studioRun.version
          }
        ],
        implementation: outcome.provenance,
        createdAt,
        currentness: { state: 'CURRENT', evaluatedAt: createdAt },
        authorityConsequences: noTradingAiAuthorityConsequencesV1
      },
      createdAt
    };
    try {
      assertTradingAiProfileV1(profile);
    } catch (cause) {
      throw new TradingAiProfileGenerationError(
        'MANAGED_AI_CONTRACT_MISMATCH',
        'Managed AI output cannot be materialized as a valid AI Profile.',
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    return profile;
  }
}
