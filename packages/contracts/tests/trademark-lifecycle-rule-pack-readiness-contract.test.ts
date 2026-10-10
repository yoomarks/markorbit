import { describe, expect, it } from 'vitest';

import type { MethodApplicabilityV1 } from '../src/brain-method.js';
import {
  noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1,
  parseTrademarkLifecycleRulePackAdmissionReadinessV1,
  trademarkLifecycleRulePackAdmissionGateCodesV1,
  trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1,
  trademarkLifecycleRulePackApplicabilityFingerprintSha256V1,
  type ExactOwnerReferenceV1,
  type TrademarkLifecycleRulePackAdmissionEvidenceStateV1,
  type TrademarkLifecycleRulePackAdmissionGateV1,
  type TrademarkLifecycleRulePackAdmissionReadinessFingerprintMaterialV1,
  type TrademarkLifecycleRulePackAdmissionReadinessStatusV1,
  type TrademarkLifecycleRulePackAdmissionReadinessV1
} from '../src/trademark-lifecycle.js';

const expectedGateCodes = [
  'APPLICABILITY',
  'EXECUTABLE_METHOD',
  'LEGAL_SOURCE_PROVENANCE',
  'FACT_PATH',
  'DETERMINISTIC_CONTRACT',
  'PROFESSIONAL_RESPONSIBILITY',
  'FIXTURE_MATRIX',
  'CURRENT_PRODUCTION_ADMISSION',
  'DEGRADATION',
  'FULL_USABLE_OUTPUT_COST'
] as const;

const sha = (character: string): string => character.repeat(64);

function applicability(): MethodApplicabilityV1 {
  return {
    jurisdictions: ['CN'],
    authorities: ['CNIPA'],
    objectTypes: ['TRADEMARK_APPLICATION'],
    operations: ['PROJECT_TRADEMARK_LIFECYCLE'],
    procedures: ['FILING_TO_PRELIMINARY_PUBLICATION'],
    stages: ['FILING', 'PRELIMINARY_PUBLICATION'],
    filingBases: ['ANY'],
    segments: ['SOURCE_RECORDED_COMPLETED_HISTORY'],
    requiredData: ['filingDate', 'preliminaryPublicationDate'],
    effectiveFrom: '2026-10-10T00:00:00.000Z'
  };
}

function evidenceReference(index: number, suffix = ''): ExactOwnerReferenceV1 {
  return {
    owner: index % 2 === 0 ? 'BRAIN' : 'MARKREG',
    kind: 'RULE_PACK_ADMISSION_EVIDENCE',
    id: `rule-pack-admission-evidence_${String(index).padStart(2, '0')}${suffix}`,
    version: 1,
    fingerprintSha256: (index % 10).toString().repeat(64)
  };
}

function availableGates(): TrademarkLifecycleRulePackAdmissionGateV1[] {
  return trademarkLifecycleRulePackAdmissionGateCodesV1.map((gateCode, index) => ({
    gateCode,
    state: 'EVIDENCE_AVAILABLE',
    evidenceReferences: [evidenceReference(index, '-b'), evidenceReference(index, '-a')],
    reasonCodes: []
  }));
}

function material(
  gates: readonly Readonly<TrademarkLifecycleRulePackAdmissionGateV1>[] = availableGates(),
  status: TrademarkLifecycleRulePackAdmissionReadinessStatusV1 = 'READY_FOR_INDEPENDENT_ADMISSION_REVIEW',
  applicabilityValue: MethodApplicabilityV1 = applicability()
): TrademarkLifecycleRulePackAdmissionReadinessFingerprintMaterialV1 {
  return {
    schemaVersion: 1,
    assessedAt: '2026-10-10T02:00:00.000Z',
    applicability: applicabilityValue,
    applicabilityFingerprintSha256:
      trademarkLifecycleRulePackApplicabilityFingerprintSha256V1(applicabilityValue),
    gates,
    status,
    authority: noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1
  };
}

function signed(
  gates: readonly Readonly<TrademarkLifecycleRulePackAdmissionGateV1>[] = availableGates(),
  status: TrademarkLifecycleRulePackAdmissionReadinessStatusV1 = 'READY_FOR_INDEPENDENT_ADMISSION_REVIEW',
  applicabilityValue: MethodApplicabilityV1 = applicability()
): TrademarkLifecycleRulePackAdmissionReadinessV1 {
  const value = material(gates, status, applicabilityValue);
  return {
    ...value,
    assessmentFingerprintSha256:
      trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(value)
  };
}

function blockedGate(
  gate: TrademarkLifecycleRulePackAdmissionGateV1,
  state: Exclude<TrademarkLifecycleRulePackAdmissionEvidenceStateV1, 'EVIDENCE_AVAILABLE'>,
  reasonCodes: readonly string[] = ['EVIDENCE_NOT_ACCEPTED']
): TrademarkLifecycleRulePackAdmissionGateV1 {
  return {
    ...gate,
    state,
    evidenceReferences: [],
    reasonCodes
  };
}

describe('TrademarkLifecycleRulePackAdmissionReadinessV1', () => {
  it('requires the exact ten A0 gates once each and returns them in canonical order', () => {
    expect(trademarkLifecycleRulePackAdmissionGateCodesV1).toEqual(expectedGateCodes);

    const parsed = parseTrademarkLifecycleRulePackAdmissionReadinessV1(signed());
    expect(parsed.gates).toHaveLength(10);
    expect(parsed.gates.map((gate) => gate.gateCode)).toEqual(expectedGateCodes);
    expect(new Set(parsed.gates.map((gate) => gate.gateCode)).size).toBe(10);
  });

  it.each([
    ['jurisdictions', 'US'],
    ['authorities', 'USPTO'],
    ['procedures', 'REGISTRATION_TO_RENEWAL'],
    ['filingBases', 'USE_IN_COMMERCE']
  ] as const)('rejects a multi-value %s axis instead of merging exact branches', (field, value) => {
    const multipleBranches = applicability();
    multipleBranches[field] = [...multipleBranches[field], value];
    expect(() =>
      trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(
        material(availableGates(), 'READY_FOR_INDEPENDENT_ADMISSION_REVIEW', multipleBranches)
      )
    ).toThrow();
  });

  it('normalizes applicability, gates, references and reasons before deterministic fingerprinting', () => {
    const canonicalGates = availableGates();
    canonicalGates[0] = blockedGate(canonicalGates[0]!, 'EVIDENCE_MISSING', [
      'A_REASON',
      'Z_REASON'
    ]);
    const canonicalMaterial = material(canonicalGates, 'INCOMPLETE');

    const shuffledApplicability = applicability();
    shuffledApplicability.jurisdictions = [...shuffledApplicability.jurisdictions].reverse();
    shuffledApplicability.authorities = [...shuffledApplicability.authorities].reverse();
    shuffledApplicability.stages = [...shuffledApplicability.stages].reverse();
    shuffledApplicability.requiredData = [...shuffledApplicability.requiredData].reverse();
    const shuffledGates = structuredClone(canonicalGates)
      .reverse()
      .map((gate) => ({
        ...gate,
        evidenceReferences: [...gate.evidenceReferences].reverse(),
        reasonCodes: [...gate.reasonCodes].reverse()
      }));
    const shuffledMaterial = material(shuffledGates, 'INCOMPLETE', shuffledApplicability);

    const fingerprint =
      trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(canonicalMaterial);
    expect(trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(shuffledMaterial)).toBe(
      fingerprint
    );

    const parsed = parseTrademarkLifecycleRulePackAdmissionReadinessV1({
      ...shuffledMaterial,
      assessmentFingerprintSha256: fingerprint
    });
    expect(parsed.applicability.jurisdictions).toEqual(['CN']);
    expect(parsed.gates.map((gate) => gate.gateCode)).toEqual(expectedGateCodes);
    expect(parsed.gates[0]?.reasonCodes).toEqual(['A_REASON', 'Z_REASON']);
    expect(parsed.gates[1]?.evidenceReferences.map((reference) => reference.id)).toEqual([
      'rule-pack-admission-evidence_01-a',
      'rule-pack-admission-evidence_01-b'
    ]);
  });

  it('allows READY_FOR_INDEPENDENT_ADMISSION_REVIEW only when every gate has evidence', () => {
    expect(parseTrademarkLifecycleRulePackAdmissionReadinessV1(signed()).status).toBe(
      'READY_FOR_INDEPENDENT_ADMISSION_REVIEW'
    );

    const gates = availableGates();
    gates[4] = blockedGate(gates[4]!, 'DEPENDENCY_UNAVAILABLE', ['RUNNER_UNAVAILABLE']);
    expect(
      parseTrademarkLifecycleRulePackAdmissionReadinessV1(signed(gates, 'INCOMPLETE')).status
    ).toBe('INCOMPLETE');
    expect(() =>
      trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(
        material(gates, 'READY_FOR_INDEPENDENT_ADMISSION_REVIEW')
      )
    ).toThrow();
    expect(() =>
      trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(
        material(availableGates(), 'INCOMPLETE')
      )
    ).toThrow();
  });

  it('requires exact evidence references for EVIDENCE_AVAILABLE gates', () => {
    const noEvidence = availableGates();
    noEvidence[0] = { ...noEvidence[0]!, evidenceReferences: [] };
    expect(() =>
      trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(material(noEvidence))
    ).toThrow();

    const withReason = availableGates();
    withReason[0] = { ...withReason[0]!, reasonCodes: ['NOT_A_PASSING_REASON'] };
    expect(() =>
      trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(material(withReason))
    ).toThrow();

    const incompleteReference = structuredClone(signed()) as unknown as Record<string, unknown>;
    const gates = incompleteReference.gates as Array<{
      evidenceReferences: Array<Record<string, unknown>>;
    }>;
    delete gates[0]!.evidenceReferences[0]!.version;
    expect(() =>
      parseTrademarkLifecycleRulePackAdmissionReadinessV1(incompleteReference)
    ).toThrow();

    const duplicateReferences = availableGates();
    const duplicatedIdentity = duplicateReferences[0]!.evidenceReferences[0]!;
    duplicateReferences[0] = {
      ...duplicateReferences[0]!,
      evidenceReferences: [
        duplicatedIdentity,
        { ...duplicatedIdentity, fingerprintSha256: sha('f') }
      ]
    };
    expect(() =>
      trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(material(duplicateReferences))
    ).toThrow();
  });

  it.each(['EVIDENCE_MISSING', 'EVIDENCE_REJECTED', 'DEPENDENCY_UNAVAILABLE'] as const)(
    'requires a reason code for %s',
    (state) => {
      const gates = availableGates();
      gates[0] = blockedGate(gates[0]!, state, []);
      expect(() =>
        trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(
          material(gates, 'INCOMPLETE')
        )
      ).toThrow();
    }
  );

  it('rejects duplicate, missing and unknown admission gates', () => {
    const duplicate = availableGates();
    duplicate[9] = duplicate[0]!;
    const missing = availableGates().slice(0, -1);
    const unknown = structuredClone(availableGates()) as unknown as Array<Record<string, unknown>>;
    unknown[0]!.gateCode = 'SOURCE_USE_ADMISSION';

    for (const gates of [duplicate, missing, unknown]) {
      expect(() =>
        trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(
          material(gates as readonly TrademarkLifecycleRulePackAdmissionGateV1[], 'INCOMPLETE')
        )
      ).toThrow();
    }
  });

  it('rejects missing or unknown fields, false admission claims and raw operational data', () => {
    const missing = structuredClone(signed()) as unknown as Record<string, unknown>;
    delete missing.assessedAt;

    const variants: Record<string, unknown>[] = [
      missing,
      { ...signed(), unexpected: true },
      { ...signed(), status: 'ADMITTED' },
      { ...signed(), methodLifecycle: 'ACTIVE' },
      { ...signed(), fullUsableOutputCostUsd: 0.42 }
    ];

    for (const value of variants) {
      expect(() => parseTrademarkLifecycleRulePackAdmissionReadinessV1(value)).toThrow();
    }
  });

  it('rejects applicability or assessment fingerprint tampering', () => {
    expect(() =>
      parseTrademarkLifecycleRulePackAdmissionReadinessV1({
        ...signed(),
        applicabilityFingerprintSha256: sha('e')
      })
    ).toThrow();
    expect(() =>
      parseTrademarkLifecycleRulePackAdmissionReadinessV1({
        ...signed(),
        assessmentFingerprintSha256: sha('f')
      })
    ).toThrow();
  });

  it('keeps every authority consequence false even when independently review-ready', () => {
    const parsed = parseTrademarkLifecycleRulePackAdmissionReadinessV1(signed());
    expect(parsed.authority).toEqual(noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1);
    expect(Object.values(parsed.authority).every((value) => value === false)).toBe(true);

    expect(() =>
      parseTrademarkLifecycleRulePackAdmissionReadinessV1({
        ...signed(),
        authority: {
          ...noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1,
          rulePackAdmitted: true
        }
      })
    ).toThrow();

    const missingAuthority = structuredClone(signed()) as unknown as Record<string, unknown>;
    delete (missingAuthority.authority as Record<string, unknown>).sourceUsePromoted;
    expect(() => parseTrademarkLifecycleRulePackAdmissionReadinessV1(missingAuthority)).toThrow();

    const additionalAuthority = structuredClone(signed()) as unknown as Record<string, unknown>;
    (additionalAuthority.authority as Record<string, unknown>).admissionDecisionCreated = false;
    expect(() =>
      parseTrademarkLifecycleRulePackAdmissionReadinessV1(additionalAuthority)
    ).toThrow();
  });

  it('keeps the current CN candidate INCOMPLETE with every known blocker explicit', () => {
    const gates = availableGates();
    const block = (
      gateCode: TrademarkLifecycleRulePackAdmissionGateV1['gateCode'],
      reasonCodes: readonly string[]
    ): void => {
      const gateIndex = gates.findIndex((gate) => gate.gateCode === gateCode);
      gates[gateIndex] = blockedGate(gates[gateIndex]!, 'EVIDENCE_MISSING', reasonCodes);
    };
    block('EXECUTABLE_METHOD', ['ACTIVE_METHOD_NOT_FOUND', 'SUPPORTED_RUNNER_NOT_FOUND']);
    block('PROFESSIONAL_RESPONSIBILITY', [
      'CURRENT_REVIEW_RECEIPT_NOT_FOUND',
      'REVOCATION_EVIDENCE_NOT_FOUND'
    ]);
    block('FIXTURE_MATRIX', ['BRANCH_FIXTURE_MATRIX_INCOMPLETE']);
    block('FULL_USABLE_OUTPUT_COST', ['PRODUCTION_COST_EVIDENCE_MISSING']);

    const productionAdmissionIndex = gates.findIndex(
      (gate) => gate.gateCode === 'CURRENT_PRODUCTION_ADMISSION'
    );
    gates[productionAdmissionIndex] = {
      gateCode: 'CURRENT_PRODUCTION_ADMISSION',
      state: 'EVIDENCE_REJECTED',
      evidenceReferences: [
        {
          owner: 'CAPABILITY_ENGINE',
          kind: 'SOURCE_USE_POLICY',
          id: 'source-admission-policy.cn-preliminary-publication-discovery.v1',
          version: 1,
          fingerprintSha256: sha('c')
        }
      ],
      reasonCodes: ['SOURCE_POLICY_PILOT']
    };

    const parsed = parseTrademarkLifecycleRulePackAdmissionReadinessV1(signed(gates, 'INCOMPLETE'));
    const blockers = new Map(
      parsed.gates
        .filter((gate) => gate.state !== 'EVIDENCE_AVAILABLE')
        .map((gate) => [gate.gateCode, gate] as const)
    );
    expect(parsed.status).toBe('INCOMPLETE');
    expect(blockers.get('EXECUTABLE_METHOD')).toMatchObject({
      state: 'EVIDENCE_MISSING',
      reasonCodes: ['ACTIVE_METHOD_NOT_FOUND', 'SUPPORTED_RUNNER_NOT_FOUND']
    });
    expect(blockers.get('PROFESSIONAL_RESPONSIBILITY')).toMatchObject({
      state: 'EVIDENCE_MISSING',
      reasonCodes: ['CURRENT_REVIEW_RECEIPT_NOT_FOUND', 'REVOCATION_EVIDENCE_NOT_FOUND']
    });
    expect(blockers.get('FIXTURE_MATRIX')).toMatchObject({
      state: 'EVIDENCE_MISSING',
      reasonCodes: ['BRANCH_FIXTURE_MATRIX_INCOMPLETE']
    });
    expect(blockers.get('FULL_USABLE_OUTPUT_COST')).toMatchObject({
      state: 'EVIDENCE_MISSING',
      reasonCodes: ['PRODUCTION_COST_EVIDENCE_MISSING']
    });
    expect(blockers.get('CURRENT_PRODUCTION_ADMISSION')).toMatchObject({
      state: 'EVIDENCE_REJECTED',
      reasonCodes: ['SOURCE_POLICY_PILOT']
    });
    expect(blockers.size).toBe(5);
    expect(parsed.authority.sourceUsePromoted).toBe(false);
    expect(parsed.authority.rulePackAdmitted).toBe(false);
  });
});
