import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  canTransitionFactCandidateStatusV1,
  factCandidateFingerprintMaterialV1,
  factCandidateFingerprintSha256V1,
  parseFactCandidateV1,
  serializeFactCandidateV1,
  type FactCandidateV1
} from '../src/fact-candidate-v1.js';

async function fixture(jurisdiction: 'CN' | 'US'): Promise<Record<string, unknown>> {
  const file =
    jurisdiction === 'US'
      ? 'fact-candidate-us-citation-v1.json'
      : 'fact-candidate-cn-citation-v1.json';
  return JSON.parse(
    await readFile(new URL(`../fixtures/${file}`, import.meta.url), 'utf8')
  ) as Record<string, unknown>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe('Fact Candidate V1', () => {
  it.each(['US', 'CN'] as const)(
    'parses and round-trips the %s official citation fixture',
    async (jurisdiction) => {
      const parsed = parseFactCandidateV1(await fixture(jurisdiction));

      expect(parsed?.jurisdiction).toBe(jurisdiction);
      expect(parsed?.factType).toBe('CITED_AS_REFERENCE_FOR_REFUSAL');
      expect(parsed?.sourceAuthority).toBe('DIRECT_OFFICIAL');
      expect(parsed?.legalConclusion).toBe(false);
      expect(parseFactCandidateV1(JSON.parse(serializeFactCandidateV1(parsed!)))).toEqual(parsed);
    }
  );

  it('reproduces the fixture fingerprint and changes it for evidence-bearing mutations', async () => {
    const parsed = parseFactCandidateV1(await fixture('US'))!;

    expect(factCandidateFingerprintSha256V1(factCandidateFingerprintMaterialV1(parsed))).toBe(
      parsed.candidateFingerprintSha256
    );

    for (const mutate of [
      (value: FactCandidateV1) => {
        value.object.registrationNumber = '7654321';
      },
      (value: FactCandidateV1) => {
        value.sourceDocument.documentVersion = 2;
      },
      (value: FactCandidateV1) => {
        value.evidenceLocator.startOffset += 1;
      },
      (value: FactCandidateV1) => {
        value.extractionMethod.methodVersion = '1.0.1';
      },
      (value: FactCandidateV1) => {
        value.confidence.scoreBasisPoints -= 1;
      }
    ]) {
      const changed = clone(parsed);
      mutate(changed);
      expect(
        factCandidateFingerprintSha256V1(factCandidateFingerprintMaterialV1(changed))
      ).not.toBe(parsed.candidateFingerprintSha256);
      expect(parseFactCandidateV1(changed)).toBe(null);
    }
  });

  it('requires validation evidence before Data Engine admission', async () => {
    const proposed = parseFactCandidateV1(await fixture('US'))!;
    const skipped = clone(proposed);
    skipped.ingestion = {
      status: 'ADMITTED',
      validation: null,
      admission: {
        outcome: 'ADMITTED',
        dataEngineFactId: 'rel_us_97123456_6123456',
        dataEngineContractVersion: 'MARKORBIT_TEMPORAL_RELATIONSHIP_V1',
        decidedAt: '2026-09-18T00:02:00.000Z',
        reasonCode: null
      }
    } as never;

    expect(parseFactCandidateV1(skipped)).toBe(null);

    const admitted = clone(proposed);
    admitted.ingestion = {
      status: 'ADMITTED',
      validation: {
        outcome: 'ACCEPTED',
        validatorId: 'citation-candidate-validator',
        validatorVersion: '1.0.0',
        decidedAt: '2026-09-18T00:01:00.000Z',
        reasonCode: null
      },
      admission: {
        outcome: 'ADMITTED',
        dataEngineFactId: 'rel_us_97123456_6123456',
        dataEngineContractVersion: 'MARKORBIT_TEMPORAL_RELATIONSHIP_V1',
        decidedAt: '2026-09-18T00:02:00.000Z',
        reasonCode: null
      }
    };
    expect(parseFactCandidateV1(admitted)?.ingestion.status).toBe('ADMITTED');
  });

  it('keeps validation and admission rejections state-consistent', async () => {
    const proposed = parseFactCandidateV1(await fixture('CN'))!;
    const validationRejected = clone(proposed);
    validationRejected.ingestion = {
      status: 'REJECTED',
      validation: {
        outcome: 'REJECTED',
        validatorId: 'citation-candidate-validator',
        validatorVersion: '1.0.0',
        decidedAt: '2026-09-18T00:02:00.000Z',
        reasonCode: 'CITED_MARK_NOT_EXPLICIT'
      },
      admission: null
    };
    expect(parseFactCandidateV1(validationRejected)?.ingestion.status).toBe('REJECTED');

    const admissionRejected = clone(proposed);
    admissionRejected.ingestion = {
      status: 'REJECTED',
      validation: {
        outcome: 'ACCEPTED',
        validatorId: 'citation-candidate-validator',
        validatorVersion: '1.0.0',
        decidedAt: '2026-09-18T00:02:00.000Z',
        reasonCode: null
      },
      admission: {
        outcome: 'REJECTED',
        dataEngineFactId: null,
        dataEngineContractVersion: 'MARKORBIT_TEMPORAL_RELATIONSHIP_V1',
        decidedAt: '2026-09-18T00:03:00.000Z',
        reasonCode: 'DUPLICATE_FACT'
      }
    };
    expect(parseFactCandidateV1(admissionRejected)?.ingestion.status).toBe('REJECTED');

    const inconsistentAdmission = admissionRejected.ingestion.admission;
    if (!inconsistentAdmission) throw new Error('Expected admission rejection fixture.');
    inconsistentAdmission.dataEngineFactId = 'rel_duplicate';
    expect(parseFactCandidateV1(admissionRejected)).toBe(null);
  });

  it('accepts only the frozen transition graph', () => {
    expect(canTransitionFactCandidateStatusV1('PROPOSED', 'VALIDATED')).toBe(true);
    expect(canTransitionFactCandidateStatusV1('PROPOSED', 'REJECTED')).toBe(true);
    expect(canTransitionFactCandidateStatusV1('VALIDATED', 'ADMITTED')).toBe(true);
    expect(canTransitionFactCandidateStatusV1('VALIDATED', 'REJECTED')).toBe(true);
    expect(canTransitionFactCandidateStatusV1('PROPOSED', 'ADMITTED')).toBe(false);
    expect(canTransitionFactCandidateStatusV1('ADMITTED', 'REJECTED')).toBe(false);
    expect(canTransitionFactCandidateStatusV1('REJECTED', 'VALIDATED')).toBe(false);
  });

  it.each([
    (value: Record<string, unknown>) => ({ ...value, extra: true }),
    (value: Record<string, unknown>) => ({ ...value, factType: 'OWNER' }),
    (value: Record<string, unknown>) => ({ ...value, sourceAuthority: 'INFERRED' }),
    (value: Record<string, unknown>) => {
      const locator = clone(value.evidenceLocator) as Record<string, unknown>;
      return { ...value, evidenceLocator: { ...locator, endOffset: locator.startOffset } };
    }
  ])('fails closed for unsupported or non-exact evidence', async (mutate) => {
    expect(parseFactCandidateV1(mutate(await fixture('US')))).toBe(null);
  });
});
