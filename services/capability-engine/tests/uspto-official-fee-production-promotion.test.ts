import { describe, expect, it } from 'vitest';

import { parseExecutableMethodPackageV1 } from '@markorbit/contracts/brain-method';
import {
  executableMethodActivationEvidenceRefV1,
  executableMethodPackageFingerprintV1,
  parseExecutableMethodPackageActivationDecisionV1
} from '@markorbit/contracts/brain-method-activation';

import {
  USPTO_OFFICIAL_FEE_GOVERNANCE_APPROVAL_V1,
  currentApprovedUsptoOfficialFeeMethodActivationAuthorityV1,
  materializeApprovedUsptoOfficialFeeGovernedActivationV1
} from '../src/uspto-official-fee-production-promotion.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
} from '../src/uspto-official-fee-resolver-pilot.js';

describe('USPTO official-fee production promotion governance', () => {
  it('materializes the real #659 approval through the canonical activation contract', () => {
    const first = materializeApprovedUsptoOfficialFeeGovernedActivationV1();
    const replay = materializeApprovedUsptoOfficialFeeGovernedActivationV1();
    const decision = parseExecutableMethodPackageActivationDecisionV1(first.decision);
    const activePackage = parseExecutableMethodPackageV1(first.activePackage);

    expect(first).toEqual(replay);
    expect(first.validatedSuccessorFingerprintSha256).toBe(
      executableMethodPackageFingerprintV1(first.predecessor)
    );
    expect(decision).toMatchObject({
      decision: 'APPROVED',
      approval: {
        authority: 'BRAIN_GOVERNANCE',
        policyVersion: 'brain-governance-v1',
        approvedBy: 'yoomarks',
        approvalTicketRef: 'github:issue/659',
        approvedAt: '2026-09-03T01:23:00.000Z'
      }
    });
    expect(decision.target.selectionPriority).toBe(100);
    expect(decision.target.limitations).toEqual(first.predecessor.limitations);
    expect(first.activationEvidenceRef).toBe(executableMethodActivationEvidenceRefV1(decision));
    expect(activePackage.lifecycle).toBe('ACTIVE');
    expect(activePackage.packageVersion).toBe(first.predecessor.packageVersion + 1);
    expect(activePackage.activationDecisionId).toBe(decision.decisionId);
    expect(activePackage.activationEvidenceRef).toBe(first.activationEvidenceRef);
    expect(first.legacyPilot.currentBrainGovernanceActivationEstablished).toBe(false);

    expect(USPTO_OFFICIAL_FEE_GOVERNANCE_APPROVAL_V1.rationale).toContain(
      'no Recommendation, Quote, Filing, Payment'
    );
  });

  it('resolves activation only for the exact governed USPTO binding', () => {
    const resolved = currentApprovedUsptoOfficialFeeMethodActivationAuthorityV1.resolveCurrent({
      capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
      capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
      implementationProfileId:
        USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationProfileId,
      methodId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
      methodVersionId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID
    });
    expect(resolved.status).toBe('RESOLVED');

    const foreign = currentApprovedUsptoOfficialFeeMethodActivationAuthorityV1.resolveCurrent({
      capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
      capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
      implementationProfileId: 'foreign-profile',
      methodId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
      methodVersionId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID
    });
    expect(foreign.status).toBe('NOT_ESTABLISHED');
  });
});
