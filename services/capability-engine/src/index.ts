import type { EventPublisher } from '@markorbit/events';
import { createServiceRuntime } from '@markorbit/service-kit';
import { createCapabilityCenterRoutes } from './capability-center-http.js';
import { createCapabilityObservationRoutes } from './capability-observation-http.js';
import type { PostgresCapabilityObservationLedger } from './capability-observation-ledger.js';
import { createCapabilityRuntimeRoutesV2 } from './capability-runtime-http.js';
import type { GovernedCapabilityRuntime } from './capability-runtime.js';
import type { ManagedAiExecutionClaimStoreV1 } from './managed-ai-execution-claim.js';
import type { ManagedAiExactOutputStoreV1 } from './managed-ai-exact-output.js';
import {
  createManagedAiExecutionRoutesV1,
  type ManagedAiExecutionAuthorityV1
} from './managed-ai-http.js';
import {
  createMilestoneCapabilityRequestFixtureRoute,
  type InMemoryCapabilityRequestRepository
} from './milestone-capability-request-fixture.js';
import { createPrivateReflectionCandidateRoutes } from './private-reflection-candidate-http.js';
import type { PostgresPrivateReflectionCandidateService } from './private-reflection-candidate.js';
import { createReflectionDispositionProfileRoutes } from './reflection-disposition-profile-http.js';
import type { PostgresReflectionDispositionProfileService } from './reflection-disposition-profile.js';
import { createRuntimeCapabilityRoutes } from './runtime-capability-http.js';
import type { PostgresRuntimeCapabilityRegistry } from './runtime-capability-registry.js';

export * from './capability-center-http.js';
export * from './capability-observation-http.js';
export * from './capability-observation-ledger.js';
export * from './capability-observation-source.js';
export * from './capability-runtime-http.js';
export * from './capability-runtime.js';
export * from './managed-ai-execution-claim.js';
export * from './managed-ai-exact-output.js';
export * from './managed-ai-http.js';
export * from './managed-communication-foundation.js';
export * from './milestone-capability-request-fixture.js';
export * from './private-reflection-candidate-http.js';
export * from './private-reflection-candidate.js';
export * from './reflection-disposition-profile-http.js';
export * from './reflection-disposition-profile.js';
export * from './runtime-capability-http.js';
export * from './runtime-capability-registry.js';

export const serviceManifest = Object.freeze({
  name: 'capability-engine',
  port: Number(process.env.PORT ?? '4103'),
  version: '0.1.0'
});

export interface CapabilityEngineOptions {
  port?: number;
  governedCapabilityRuntime?: Pick<GovernedCapabilityRuntime, 'invoke'>;
  milestoneFixtureRequestPath?: boolean;
  repository?: InMemoryCapabilityRequestRepository;
  publisher?: EventPublisher;
  now?: () => string;
  runtimeCapabilityRegistry?: PostgresRuntimeCapabilityRegistry;
  capabilityObservationLedger?: PostgresCapabilityObservationLedger;
  privateReflectionCandidates?: PostgresPrivateReflectionCandidateService;
  reflectionDispositionProfiles?: PostgresReflectionDispositionProfileService;
  managedAiExecutor?: ManagedAiExecutionAuthorityV1;
  managedAiClaimStore?: ManagedAiExecutionClaimStoreV1;
  managedAiExactOutputStore?: ManagedAiExactOutputStoreV1;
  internalServiceSecret?: string;
}

export function createRuntime(options: CapabilityEngineOptions = {}) {
  const milestoneFixtureRequested =
    options.milestoneFixtureRequestPath === true ||
    options.repository !== undefined ||
    options.publisher !== undefined ||
    options.now !== undefined;
  if (options.governedCapabilityRuntime && milestoneFixtureRequested) {
    throw new Error(
      'governedCapabilityRuntime and milestone Capability fixture options are mutually exclusive.'
    );
  }
  if (options.governedCapabilityRuntime && !options.internalServiceSecret) {
    throw new Error('governedCapabilityRuntime requires internalServiceSecret.');
  }
  if (options.runtimeCapabilityRegistry && !options.internalServiceSecret) {
    throw new Error('runtimeCapabilityRegistry requires internalServiceSecret.');
  }
  if (options.capabilityObservationLedger && !options.internalServiceSecret) {
    throw new Error('capabilityObservationLedger requires internalServiceSecret.');
  }
  if (options.privateReflectionCandidates && !options.internalServiceSecret) {
    throw new Error('privateReflectionCandidates requires internalServiceSecret.');
  }
  if (options.reflectionDispositionProfiles && !options.internalServiceSecret) {
    throw new Error('reflectionDispositionProfiles requires internalServiceSecret.');
  }
  if (options.managedAiExecutor && !options.internalServiceSecret) {
    throw new Error('managedAiExecutor requires internalServiceSecret.');
  }
  if (options.managedAiClaimStore && !options.managedAiExecutor) {
    throw new Error('managedAiClaimStore requires managedAiExecutor.');
  }
  if (options.managedAiExactOutputStore && !options.managedAiExecutor) {
    throw new Error('managedAiExactOutputStore requires managedAiExecutor.');
  }

  const capabilityRequestRoutes =
    options.governedCapabilityRuntime && options.internalServiceSecret
      ? createCapabilityRuntimeRoutesV2({
          runtime: options.governedCapabilityRuntime,
          internalServiceSecret: options.internalServiceSecret
        })
      : milestoneFixtureRequested
        ? [
            createMilestoneCapabilityRequestFixtureRoute({
              ...(options.repository === undefined ? {} : { repository: options.repository }),
              ...(options.publisher === undefined ? {} : { publisher: options.publisher }),
              ...(options.now === undefined ? {} : { now: options.now })
            })
          ]
        : [];
  const runtimeCapabilityRoutes =
    options.runtimeCapabilityRegistry && options.internalServiceSecret
      ? createRuntimeCapabilityRoutes({
          registry: options.runtimeCapabilityRegistry,
          internalServiceSecret: options.internalServiceSecret
        })
      : [];
  const capabilityObservationRoutes =
    options.capabilityObservationLedger && options.internalServiceSecret
      ? createCapabilityObservationRoutes({
          ledger: options.capabilityObservationLedger,
          internalServiceSecret: options.internalServiceSecret
        })
      : [];
  const privateReflectionCandidateRoutes =
    options.privateReflectionCandidates && options.internalServiceSecret
      ? createPrivateReflectionCandidateRoutes({
          reflections: options.privateReflectionCandidates,
          internalServiceSecret: options.internalServiceSecret
        })
      : [];
  const reflectionDispositionProfileRoutes =
    options.reflectionDispositionProfiles && options.internalServiceSecret
      ? createReflectionDispositionProfileRoutes({
          reflections: options.reflectionDispositionProfiles,
          internalServiceSecret: options.internalServiceSecret
        })
      : [];
  const capabilityCenterRoutes =
    options.capabilityObservationLedger &&
    options.privateReflectionCandidates &&
    options.reflectionDispositionProfiles &&
    options.internalServiceSecret
      ? createCapabilityCenterRoutes({
          ledger: options.capabilityObservationLedger,
          candidates: options.privateReflectionCandidates,
          reflections: options.reflectionDispositionProfiles,
          internalServiceSecret: options.internalServiceSecret
        })
      : [];
  const managedAiExecutionRoutes =
    options.managedAiExecutor && options.internalServiceSecret
      ? createManagedAiExecutionRoutesV1({
          executor: options.managedAiExecutor,
          internalServiceSecret: options.internalServiceSecret,
          ...(options.managedAiClaimStore === undefined
            ? {}
            : { claimStore: options.managedAiClaimStore }),
          ...(options.managedAiExactOutputStore === undefined
            ? {}
            : { exactOutputStore: options.managedAiExactOutputStore })
        })
      : [];

  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
        ...capabilityRequestRoutes,
        ...runtimeCapabilityRoutes,
        ...capabilityObservationRoutes,
        ...privateReflectionCandidateRoutes,
        ...reflectionDispositionProfileRoutes,
        ...capabilityCenterRoutes,
        ...managedAiExecutionRoutes
      ]
    }
  );
}
