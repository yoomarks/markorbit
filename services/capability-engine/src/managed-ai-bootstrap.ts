import {
  AiProviderRegistryV1,
  DeepSeekProviderAdapterV1,
  DEEPSEEK_SECRET_ENV,
  ManagedAiExecutorV1,
  ManagedAiImplementationRegistryV1,
  knowledgeDeepSeekImplementationProfileV1,
  type AiHttpTransport
} from '@markorbit/ai';
import type { QueryClient } from '@markorbit/persistence';
import {
  PostgresManagedAiExecutionClaimStoreV1,
  type ManagedAiExecutionClaimStoreV1,
  type ManagedAiExecutionClaimTransactionHostV1
} from './managed-ai-execution-claim.js';
import {
  PostgresManagedAiExactOutputStoreV1,
  type ManagedAiExactOutputStoreV1
} from './managed-ai-exact-output.js';
import type { ManagedAiExecutionAuthorityV1 } from './managed-ai-http.js';

export const MANAGED_AI_RUNTIME_ENABLED_ENV = 'MO_MANAGED_AI_RUNTIME_ENABLED' as const;
export const MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV =
  'MO_MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED' as const;

export interface ManagedAiRuntimeBindingsV1 {
  managedAiExecutor: ManagedAiExecutionAuthorityV1;
  managedAiClaimStore: ManagedAiExecutionClaimStoreV1;
  managedAiExactOutputStore: ManagedAiExactOutputStoreV1;
}

export interface ManagedAiRuntimeBootstrapOptionsV1 {
  environment: NodeJS.ProcessEnv;
  database: ManagedAiExecutionClaimTransactionHostV1;
  query: QueryClient;
  deepSeekTransport?: AiHttpTransport;
  now?: () => Date;
}

function toggle(environment: NodeJS.ProcessEnv, name: string): boolean {
  const value = environment[name];
  if (value === undefined || value === '' || value === '0') return false;
  if (value === '1') return true;
  throw new Error(`${name} must be exactly '0' or '1' when configured.`);
}

function providerEnvironment(secret: string): NodeJS.ProcessEnv {
  return { [DEEPSEEK_SECRET_ENV]: secret };
}

export function createManagedAiRuntimeBindingsV1(
  options: Readonly<ManagedAiRuntimeBootstrapOptionsV1>
): ManagedAiRuntimeBindingsV1 | null {
  const runtimeEnabled = toggle(options.environment, MANAGED_AI_RUNTIME_ENABLED_ENV);
  const providerDispatchAuthorized = toggle(
    options.environment,
    MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV
  );

  if (!runtimeEnabled && !providerDispatchAuthorized) return null;
  if (!runtimeEnabled && providerDispatchAuthorized) {
    throw new Error(
      `${MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV}=1 requires ${MANAGED_AI_RUNTIME_ENABLED_ENV}=1.`
    );
  }
  if (!providerDispatchAuthorized) {
    throw new Error(
      `${MANAGED_AI_RUNTIME_ENABLED_ENV}=1 requires ${MANAGED_AI_PROVIDER_DISPATCH_AUTHORIZED_ENV}=1.`
    );
  }

  const deepSeekSecret = options.environment[DEEPSEEK_SECRET_ENV];
  if (!deepSeekSecret || !deepSeekSecret.trim()) {
    throw new Error(
      `${DEEPSEEK_SECRET_ENV} is required when governed Managed AI provider dispatch is authorized.`
    );
  }

  const deepSeek = new DeepSeekProviderAdapterV1({
    environment: providerEnvironment(deepSeekSecret),
    ...(options.deepSeekTransport === undefined ? {} : { transport: options.deepSeekTransport }),
    ...(options.now === undefined ? {} : { now: options.now }),
    offPeakOnly: true
  });
  const providers = new AiProviderRegistryV1([deepSeek]);
  const implementations = new ManagedAiImplementationRegistryV1([
    knowledgeDeepSeekImplementationProfileV1
  ]);
  const managedAiExecutor = new ManagedAiExecutorV1(
    implementations,
    providers,
    options.now === undefined ? {} : { now: options.now }
  );
  const managedAiClaimStore = new PostgresManagedAiExecutionClaimStoreV1(
    options.database,
    options.query
  );
  const managedAiExactOutputStore = new PostgresManagedAiExactOutputStoreV1(options.query);

  return { managedAiExecutor, managedAiClaimStore, managedAiExactOutputStore };
}
