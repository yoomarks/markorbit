import { describe, expect, it } from 'vitest';
import {
  trademarkServiceExecutionEnvironments,
  trademarkServiceExecutionModes,
  trademarkServiceExecutionSandboxAuthority,
  trademarkServiceSandboxConnectorClasses,
  trademarkServiceSandboxCredentialClasses,
  trademarkServiceSandboxEndpointClasses,
  type TrademarkServiceExecutionEnvironmentPolicy,
  type TrademarkServiceProtectedActionEnvironmentBinding
} from '../src/trademark-service-execution-sandbox.js';

describe('M15-WP-01 execution environment contracts', () => {
  it('freezes non-production environments and execution modes', () => {
    expect(trademarkServiceExecutionEnvironments).toEqual([
      'LOCAL',
      'CI',
      'SANDBOX',
      'PROVIDER_TEST'
    ]);
    expect(trademarkServiceExecutionModes).toEqual(['SIMULATED', 'TEST_CONNECTOR']);
    expect(trademarkServiceSandboxConnectorClasses).toEqual([
      'SIMULATOR',
      'PROVIDER_SANDBOX',
      'AUTHORITY_TEST',
      'PAYMENT_TEST'
    ]);
    expect(trademarkServiceSandboxEndpointClasses).toEqual([
      'LOOPBACK',
      'INTERNAL_TEST',
      'ALLOWLISTED_SANDBOX'
    ]);
    expect(trademarkServiceSandboxCredentialClasses).toEqual(['NONE', 'TEST_ONLY']);
    expect(trademarkServiceExecutionEnvironments).not.toContain('PRODUCTION');
  });

  it('keeps environment policy explicitly non-production and immutable', () => {
    const policy: TrademarkServiceExecutionEnvironmentPolicy = {
      schemaVersion: 1,
      environmentPolicyId: 'trademark-service-execution-environment-policy_fixture',
      workspaceId: 'workspace_fixture',
      executionAuthorizationId: 'trademark-service-execution-authorization_fixture',
      environment: 'SANDBOX',
      mode: 'TEST_CONNECTOR',
      connectorClass: 'PROVIDER_SANDBOX',
      endpointClass: 'ALLOWLISTED_SANDBOX',
      credentialClass: 'TEST_ONLY',
      createdAt: '2026-08-22T00:00:00.000Z',
      immutable: true,
      nonProduction: true,
      productionEnvironmentAuthorized: false,
      productionCredentialsAllowed: false,
      unrestrictedEgressAllowed: false,
      liveExternalActionAuthorized: false,
      officialTruthCreated: false
    };

    expect(policy).toMatchObject({
      immutable: true,
      nonProduction: true,
      productionEnvironmentAuthorized: false,
      productionCredentialsAllowed: false,
      unrestrictedEgressAllowed: false,
      liveExternalActionAuthorized: false,
      officialTruthCreated: false
    });
  });

  it('makes environment and mode part of protected-action replay identity', () => {
    const binding: TrademarkServiceProtectedActionEnvironmentBinding = {
      schemaVersion: 1,
      protectedActionReleaseId: 'trademark-service-protected-action-release_fixture',
      environmentPolicyId: 'trademark-service-execution-environment-policy_fixture',
      environment: 'CI',
      mode: 'SIMULATED',
      connectorClass: 'SIMULATOR',
      endpointClass: 'INTERNAL_TEST',
      credentialClass: 'NONE',
      immutable: true,
      environmentAndModeIncludedInReplayIdentity: true,
      crossEnvironmentReplayAllowed: false,
      crossModeReplayAllowed: false
    };

    expect(binding.environmentAndModeIncludedInReplayIdentity).toBe(true);
    expect(binding.crossEnvironmentReplayAllowed).toBe(false);
    expect(binding.crossModeReplayAllowed).toBe(false);
  });

  it('never grants production or owner-truth authority', () => {
    expect(trademarkServiceExecutionSandboxAuthority).toMatchObject({
      mayCreateNonProductionEnvironmentPolicy: true,
      maySimulateProtectedAction: true,
      mayUseNonProductionTestConnector: true,
      mayBindProtectedActionToEnvironment: true,
      mayUseProductionEnvironment: false,
      mayUseProductionCredentials: false,
      mayUseUnrestrictedEgress: false,
      mayPerformLiveFiling: false,
      mayPerformLivePayment: false,
      mayContactLiveProvider: false,
      mayPublishLive: false,
      mayCreateOfficialTruth: false,
      mayMutateMarkRegLifecycleDirectly: false,
      mayUseCrossServiceSql: false
    });
  });
});
