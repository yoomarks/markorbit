import { describe, expect, it, vi } from 'vitest';
import type { JsonRequest } from '@markorbit/service-kit';
import { createMethodOutcomeReportRoutesV1 } from '../src/method-outcome-report-http.js';
import {
  MethodOutcomeReportError,
  type MethodOutcomeReportServiceV1,
  type MethodOutcomeReportV1
} from '../src/method-outcome-report.js';

const secret = 'phase6-method-outcome-report-secret-32-bytes';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const query = {
  schemaVersion: 1,
  workspaceId,
  methodPackageRef: 'brain-method-package:package_cn-duration@1',
  methodVersionRef: 'brain-method-version:method-version_cn-duration'
};

function report(): MethodOutcomeReportV1 {
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

function fixture(error?: MethodOutcomeReportError) {
  const reportMethod = vi.fn(() => (error ? Promise.reject(error) : Promise.resolve(report())));
  const route = createMethodOutcomeReportRoutesV1({
    internalServiceSecret: secret,
    service: { report: reportMethod } as Pick<MethodOutcomeReportServiceV1, 'report'>
  })[0]!;
  return { route, reportMethod };
}

function request(headers: Record<string, string | undefined> = {}): JsonRequest {
  return {
    body: query,
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-workspace-id': workspaceId,
      ...headers
    },
    method: 'POST',
    path: '/internal/v1/evaluation/method-outcome-reports',
    params: {},
    query: {}
  };
}

describe('Method Outcome report HTTP boundary', () => {
  it('returns the bounded report for a trusted internal workspace call', async () => {
    const f = fixture();
    await expect(f.route.handle(request())).resolves.toMatchObject({ status: 200 });
    expect(f.reportMethod).toHaveBeenCalledWith({ workspaceId, query });
  });

  it('rejects untrusted internal callers before report execution', async () => {
    const f = fixture();
    await expect(
      f.route.handle(
        request({ 'x-markorbit-internal-authorization': 'not-the-configured-secret' })
      )
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(f.reportMethod).not.toHaveBeenCalled();
  });

  it('requires trusted workspace context', async () => {
    const f = fixture();
    await expect(
      f.route.handle(request({ 'x-markorbit-workspace-id': undefined }))
    ).rejects.toMatchObject({ status: 400, code: 'WORKSPACE_CONTEXT_REQUIRED' });
    expect(f.reportMethod).not.toHaveBeenCalled();
  });

  it('preserves fail-closed report error status and retryability', async () => {
    const f = fixture(
      new MethodOutcomeReportError(
        'WATERMARK_MISMATCH',
        'Watermark does not belong to this filtered report.',
        409
      )
    );
    await expect(f.route.handle(request())).rejects.toMatchObject({
      status: 409,
      code: 'WATERMARK_MISMATCH'
    });
  });
});
