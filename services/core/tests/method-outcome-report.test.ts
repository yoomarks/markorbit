import { describe, expect, it, vi } from 'vitest';
import {
  MethodOutcomeReportServiceV1,
  parseMethodOutcomeReportQueryV1,
  type MethodOutcomeReportReaderV1,
  type MethodOutcomeReportV1
} from '../src/method-outcome-report.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const query = {
  schemaVersion: 1,
  workspaceId,
  methodPackageRef: 'brain-method-package:package_cn-duration@1',
  methodVersionRef: 'brain-method-version:method-version_cn-duration'
};

function emptyReport(): MethodOutcomeReportV1 {
  return {
    schemaVersion: 1,
    workspaceId,
    methodPackageRef: query.methodPackageRef,
    methodVersionRef: query.methodVersionRef,
    admittedReviews: 0,
    confirmed: { count: 0, rate: 0 },
    overridden: { count: 0, rate: 0 },
    methodError: { count: 0, rate: 0 },
    inputDataError: { count: 0, rate: 0 },
    applicabilityError: { count: 0, rate: 0 },
    productUserPreference: { count: 0, rate: 0 },
    inconclusive: { count: 0, rate: 0 },
    sampleEvidenceRefs: []
  };
}

describe('Method Outcome report query', () => {
  it('parses exact package/version, supported segment and monotonic watermark', () => {
    expect(
      parseMethodOutcomeReportQueryV1({
        ...query,
        segment: { kind: 'RESEARCH_DATASET', value: 'research-dataset:cn-duration-band:accepted' },
        watermark: {
          admissionSequence: 7,
          methodOutcomeEvidenceId: 'method-outcome-evidence_phase6-report-7'
        }
      })
    ).toEqual({
      ...query,
      segment: { kind: 'RESEARCH_DATASET', value: 'research-dataset:cn-duration-band:accepted' },
      watermark: {
        admissionSequence: 7,
        methodOutcomeEvidenceId: 'method-outcome-evidence_phase6-report-7'
      }
    });
  });

  it('rejects unsupported segment kinds and extra lifecycle payload', () => {
    expect(() =>
      parseMethodOutcomeReportQueryV1({
        ...query,
        segment: { kind: 'JURISDICTION', value: 'CN' }
      })
    ).toThrow(/segment\.kind/u);
    expect(() => parseMethodOutcomeReportQueryV1({ ...query, formalMatter: { id: 'x' } })).toThrow(
      /unsupported fields/u
    );
  });

  it('requires exact governed method refs and positive watermark sequence', () => {
    expect(() =>
      parseMethodOutcomeReportQueryV1({ ...query, methodPackageRef: 'package_cn-duration' })
    ).toThrow(/brain-method-package/u);
    expect(() =>
      parseMethodOutcomeReportQueryV1({
        ...query,
        watermark: {
          admissionSequence: 0,
          methodOutcomeEvidenceId: 'method-outcome-evidence_phase6-report'
        }
      })
    ).toThrow(/positive safe integer/u);
  });

  it('fails trusted workspace mismatch before invoking the reader', async () => {
    const report = vi.fn(() => Promise.resolve(emptyReport()));
    const service = new MethodOutcomeReportServiceV1({ report } as MethodOutcomeReportReaderV1);

    await expect(
      service.report({
        workspaceId: '22222222-2222-4222-8222-222222222222',
        query
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH', status: 403 });
    expect(report).not.toHaveBeenCalled();
  });
});
