import { describe, expect, it } from 'vitest';
import {
  trademarkServiceExecutionObservabilityAuthority,
  trademarkServiceRecoveryDrillOutcomes
} from '../src/trademark-service-execution-observability.js';

describe('M15-WP-07 recovery observability authority', () => {
  it('freezes the bounded recovery outcome vocabulary', () => {
    expect(trademarkServiceRecoveryDrillOutcomes).toEqual([
      'SUCCESS',
      'TRANSIENT_FAILURE',
      'AMBIGUOUS_EXTERNAL_OUTCOME',
      'PERMANENT_FAILURE'
    ]);
  });

  it('keeps external consequence retry manual and environment-bound', () => {
    expect(trademarkServiceExecutionObservabilityAuthority).toEqual({
      mayRecordSandboxCorrelation: true,
      mayRecordDurableRecoveryAudit: true,
      mayClassifyBoundedManualReplay: true,
      mayDeadLetterForHumanReview: true,
      mayAutomaticallyRetryExternalConsequence: false,
      mayReplayAcrossEnvironment: false,
      mayReplayAcrossMode: false,
      mayPerformLiveExternalAction: false,
      mayCreateOfficialTruth: false
    });
  });
});
