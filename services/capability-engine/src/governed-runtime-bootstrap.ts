import { KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY } from '@markorbit/ai';
import type {
  CapabilityRequestV2,
  ImplementationBinding,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import {
  ManagedAiContractError,
  parseManagedAiExecutionInputV1,
  parseManagedAiExecutionOutcomeV1,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import type { JsonRequest, JsonRoute } from '@markorbit/service-kit';
import {
  GovernedCapabilityRuntime,
  type CapabilityContractValidator,
  type CapabilityImplementationExecutionResult,
  type CapabilityImplementationExecutor,
  type ImplementationProfileSelector,
  type RuntimeCapabilityDefinitionResolver
} from './capability-runtime.js';
import {
  PostgresGovernedImplementationProfileSelectorV1,
  type DurableImplementationProfileRegistryV1
} from './implementation-profile-registry-postgres.js';
import type { ManagedAiRuntimeBindingsV1 } from './managed-ai-bootstrap.js';
import { createManagedAiExecutionRoutesV1 } from './managed-ai-http.js';
import { createApprovedUsptoOfficialFeeResolverCapabilityExecutorV1 } from './uspto-official-fee-production-promotion.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
  USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
  USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
  validateUsptoOfficialFeeResolverInputV1,
  validateUsptoOfficialFeeResolverOutputV1,
  type OfficialFeeReferenceReaderV1
} from './uspto-official-fee-resolver-pilot.js';

export const MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID = 'managed-ai-input.v1' as const;
export const MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID = 'managed-ai-output.v1' as const;
export const MANAGED_AI_CAPABILITY_SELECTION_POLICY_VERSION =
  'capability-managed-ai-selection.v1' as const;
export const USPTO_OFFICIAL_FEE_CAPABILITY_SELECTION_POLICY_VERSION =
  'capability-uspto-official-fee-selection.v1' as const;

export interface GovernedProductionRuntimeBootstrapOptionsV1 {
  definitions: RuntimeCapabilityDefinitionResolver;
  implementationProfiles: DurableImplementationProfileRegistryV1;
  managedAiRuntime: ManagedAiRuntimeBindingsV1 | null;
  officialFeeReferences?: Readonly<OfficialFeeReferenceReaderV1> | null;
  internalServiceSecret: string;
}

class ProductionCapabilityContractValidatorV1 implements CapabilityContractValidator {
  constructor(
    private readonly side: 'INPUT' | 'OUTPUT',
    private readonly managedAiEnabled: boolean,
    private readonly officialFeeEnabled: boolean
  ) {}

  validate(schemaId: string, value: unknown): boolean {
    if (this.officialFeeEnabled) {
      if (this.side === 'INPUT' && schemaId === USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA)
        return validateUsptoOfficialFeeResolverInputV1(value);
      if (this.side === 'OUTPUT' && schemaId === USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA)
        return validateUsptoOfficialFeeResolverOutputV1(value);
    }
    if (!this.managedAiEnabled) return false;
    try {
      if (this.side === 'INPUT') {
        if (schemaId !== MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID) return false;
        parseManagedAiExecutionInputV1(value);
        return true;
      }
      if (schemaId !== MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID) return false;
      parseManagedAiExecutionOutcomeV1(value);
      return true;
    } catch (error) {
      if (error instanceof ManagedAiContractError) return false;
      throw error;
    }
  }
}

function capabilityUsage(outcome: Readonly<ManagedAiExecutionOutcomeV1>) {
  if (!outcome.usage) return undefined;
  return {
    ...(outcome.usage.latencyMs === undefined ? {} : { latencyMs: outcome.usage.latencyMs }),
    ...(outcome.usage.inputUnits === undefined ? {} : { inputUnits: outcome.usage.inputUnits }),
    ...(outcome.usage.outputUnits === undefined ? {} : { outputUnits: outcome.usage.outputUnits }),
    ...(outcome.usage.costMinor === undefined ? {} : { costMinor: outcome.usage.costMinor }),
    ...(outcome.usage.currency === undefined ? {} : { currency: outcome.usage.currency })
  };
}

function evidenceRefs(outcome: Readonly<ManagedAiExecutionOutcomeV1>): readonly string[] {
  return outcome.exactOutput?.kind === 'DURABLE_REF' ? [outcome.exactOutput.ref] : [];
}

class ManagedAiCapabilityImplementationExecutorV1 implements CapabilityImplementationExecutor {
  private readonly route: JsonRoute;

  constructor(
    bindings: Readonly<ManagedAiRuntimeBindingsV1>,
    private readonly internalServiceSecret: string
  ) {
    const route = createManagedAiExecutionRoutesV1({
      internalServiceSecret,
      executor: bindings.managedAiExecutor,
      claimStore: bindings.managedAiClaimStore,
      exactOutputStore: bindings.managedAiExactOutputStore
    }).find(
      (candidate) =>
        candidate.method === 'POST' && candidate.path === '/internal/v1/managed-ai-executions'
    );
    if (!route) throw new Error('Managed AI execution route is unavailable.');
    this.route = route;
  }

  async execute(
    request: Readonly<CapabilityRequestV2>,
    binding: Readonly<ImplementationBinding>
  ): Promise<CapabilityImplementationExecutionResult> {
    if (
      binding.implementation.kind !== 'AI_ASSISTED_SERVICE' ||
      binding.implementation.implementationKey !== KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY
    ) {
      throw new Error(
        'The selected Capability implementation is not registered in the production execution adapter set.'
      );
    }

    const managedRequest: JsonRequest = {
      method: 'POST',
      path: '/internal/v1/managed-ai-executions',
      params: {},
      query: {},
      headers: {
        'x-markorbit-internal-authorization': this.internalServiceSecret,
        'idempotency-key': request.idempotencyKey,
        'x-correlation-id': request.correlationId
      },
      body: request.input
    };
    const response = await this.route.handle(managedRequest);
    if (response.status !== 200) {
      throw new Error(`Managed AI execution returned unexpected status ${response.status}.`);
    }
    const outcome = parseManagedAiExecutionOutcomeV1(response.body);
    if (
      outcome.provenance &&
      outcome.provenance.implementationKey !== binding.implementation.implementationKey
    ) {
      throw new Error(
        'Managed AI execution provenance drifted from the governed implementation binding.'
      );
    }
    const usage = capabilityUsage(outcome);
    const result = {
      output: outcome,
      evidenceRefs: evidenceRefs(outcome),
      ...(usage === undefined ? {} : { usage })
    };
    if (outcome.status === 'COMPLETED') return result;
    if (outcome.status === 'REQUIRES_RECONCILIATION') return { ...result, requiresReview: true };
    return { ...result, failed: true };
  }
}

class ProductionCapabilityImplementationExecutorV1 implements CapabilityImplementationExecutor {
  private readonly managedAi?: ManagedAiCapabilityImplementationExecutorV1;
  private readonly officialFee?: CapabilityImplementationExecutor;

  constructor(options: Readonly<GovernedProductionRuntimeBootstrapOptionsV1>) {
    if (options.managedAiRuntime)
      this.managedAi = new ManagedAiCapabilityImplementationExecutorV1(
        options.managedAiRuntime,
        options.internalServiceSecret
      );
    if (options.officialFeeReferences)
      this.officialFee = createApprovedUsptoOfficialFeeResolverCapabilityExecutorV1(
        options.officialFeeReferences
      );
  }

  execute(
    request: Readonly<CapabilityRequestV2>,
    binding: Readonly<ImplementationBinding>
  ): Promise<CapabilityImplementationExecutionResult> {
    if (
      this.officialFee &&
      binding.implementation.kind === 'DETERMINISTIC_SERVICE' &&
      binding.implementation.implementationKey ===
        USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationKey
    )
      return this.officialFee.execute(request, binding);
    if (
      this.managedAi &&
      binding.implementation.kind === 'AI_ASSISTED_SERVICE' &&
      binding.implementation.implementationKey === KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY
    )
      return this.managedAi.execute(request, binding);
    return Promise.reject(
      new Error(
        'The selected Capability implementation is not registered in the production execution adapter set.'
      )
    );
  }
}

function productionSelector(
  options: Readonly<GovernedProductionRuntimeBootstrapOptionsV1>
): ImplementationProfileSelector {
  const managedAi = options.managedAiRuntime
    ? new PostgresGovernedImplementationProfileSelectorV1(options.implementationProfiles, {
        policyVersion: MANAGED_AI_CAPABILITY_SELECTION_POLICY_VERSION,
        admittedImplementationKinds: ['AI_ASSISTED_SERVICE'],
        preferredImplementationKeys: [KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY]
      })
    : undefined;
  const officialFee = options.officialFeeReferences
    ? new PostgresGovernedImplementationProfileSelectorV1(options.implementationProfiles, {
        policyVersion: USPTO_OFFICIAL_FEE_CAPABILITY_SELECTION_POLICY_VERSION,
        admittedImplementationKinds: ['DETERMINISTIC_SERVICE'],
        preferredImplementationKeys: [
          USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationKey
        ]
      })
    : undefined;
  return {
    select: (request, definition) =>
      definition.capabilityId === USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID
        ? (officialFee?.select(request, definition) ?? Promise.resolve(undefined))
        : (managedAi?.select(request, definition) ?? Promise.resolve(undefined))
  };
}

export function createGovernedProductionRuntimeV1(
  options: Readonly<GovernedProductionRuntimeBootstrapOptionsV1>
): GovernedCapabilityRuntime | null {
  if (!options.managedAiRuntime && !options.officialFeeReferences) return null;
  const admittedImplementationKinds = new Set<ImplementationProfile['kind']>();
  if (options.managedAiRuntime) admittedImplementationKinds.add('AI_ASSISTED_SERVICE');
  if (options.officialFeeReferences) admittedImplementationKinds.add('DETERMINISTIC_SERVICE');
  return new GovernedCapabilityRuntime({
    definitions: options.definitions,
    implementations: productionSelector(options),
    inputContracts: new ProductionCapabilityContractValidatorV1(
      'INPUT',
      Boolean(options.managedAiRuntime),
      Boolean(options.officialFeeReferences)
    ),
    outputContracts: new ProductionCapabilityContractValidatorV1(
      'OUTPUT',
      Boolean(options.managedAiRuntime),
      Boolean(options.officialFeeReferences)
    ),
    executor: new ProductionCapabilityImplementationExecutorV1(options),
    admittedImplementationKinds
  });
}
