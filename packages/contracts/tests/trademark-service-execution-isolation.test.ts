import { describe, expect, it } from 'vitest';
import {
  trademarkServiceExecutionIsolationAuthority,
  trademarkServiceSandboxEgressModes
} from '../src/trademark-service-execution-isolation.js';

describe('M15 WP04 execution isolation authority contract', () => {
  it('keeps egress bounded to explicit non-production modes', () => {
    expect(trademarkServiceSandboxEgressModes).toEqual([
      'DISABLED',
      'LOOPBACK_ONLY',
      'INTERNAL_TEST_ONLY',
      'ALLOWLIST_ONLY'
    ]);
    expect(trademarkServiceSandboxEgressModes).not.toContain('UNRESTRICTED');
  });

  it('never grants production credentials, unrestricted egress, or live external action', () => {
    expect(trademarkServiceExecutionIsolationAuthority.mayUseProductionCredentials).toBe(false);
    expect(trademarkServiceExecutionIsolationAuthority.mayUseUnrestrictedEgress).toBe(false);
    expect(trademarkServiceExecutionIsolationAuthority.mayAuthorizeLiveExternalAction).toBe(false);
    expect(trademarkServiceExecutionIsolationAuthority.mayTrustClientSuppliedEndpoint).toBe(false);
    expect(trademarkServiceExecutionIsolationAuthority.mayInferEnvironmentFromUrlOrCredential).toBe(
      false
    );
  });
});
