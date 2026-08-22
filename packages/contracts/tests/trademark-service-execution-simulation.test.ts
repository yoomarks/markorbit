import { describe, expect, it } from 'vitest';
import {
  trademarkServiceSimulationAuthority,
  trademarkServiceSimulationClassifications,
  trademarkServiceSimulationScenarios
} from '../src/trademark-service-execution-simulation.js';

describe('M15-WP-05 deterministic simulation contract', () => {
  it('freezes the seven deterministic simulation scenarios', () => {
    expect(trademarkServiceSimulationScenarios).toEqual([
      'SUCCESS',
      'REJECTION',
      'TIMEOUT',
      'AMBIGUOUS_RETURN',
      'DUPLICATE_RESPONSE',
      'STALE_RESPONSE',
      'MALFORMED_RESPONSE'
    ]);
    expect(trademarkServiceSimulationClassifications).toHaveLength(7);
  });

  it('keeps simulation evidence outside provider and Official Truth authority', () => {
    expect(trademarkServiceSimulationAuthority).toEqual({
      mayGenerateDeterministicSimulationEvidence: true,
      mayRepresentProviderClaim: false,
      mayCreateProviderAcceptance: false,
      mayCreateOfficialFilingSuccess: false,
      mayCreatePaymentTruth: false,
      mayCreateMarkRegLifecycleTruth: false,
      mayCreateOfficialTruth: false,
      mayPerformLiveExternalAction: false,
      mayAuthorizeAutomaticExternalRetry: false,
      mayUseProductionCredential: false,
      mayUseProductionConnector: false
    });
  });
});
