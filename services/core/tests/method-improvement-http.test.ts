import { describe, expect, it, vi } from 'vitest';
import type { JsonRequest } from '@markorbit/service-kit';
import { createMethodImprovementRoutesV1 } from '../src/method-improvement-http.js';
import { MethodImprovementAdmissionError } from '../src/method-improvement.js';

const secret = 'phase7-method-improvement-secret-32-bytes';
const workspaceId = '11111111-1111-4111-8111-111111111111';

function request(headers: Record<string, string | undefined> = {}): JsonRequest {
  return {
    body: { schemaVersion: 1 },
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-workspace-id': workspaceId,
      'idempotency-key': 'phase7-http-key',
      'x-correlation-id': 'phase7-http-correlation',
      ...headers
    },
    method: 'POST',
    path: '/internal/v1/evaluation/method-improvement/performance-gaps',
    params: {},
    query: {}
  };
}

function fixture(result: unknown = { trigger: {}, researchMission: {}, replayed: false }) {
  const admit = vi.fn(() => Promise.resolve(result as never));
  const route = createMethodImprovementRoutesV1({
    internalServiceSecret: secret,
    service: { admit }
  })[0]!;
  return { route, admit };
}

function failing(error: MethodImprovementAdmissionError) {
  const admit = vi.fn(() => Promise.reject(error));
  const route = createMethodImprovementRoutesV1({
    internalServiceSecret: secret,
    service: { admit }
  })[0]!;
  return { route, admit };
}

describe('Method Improvement HTTP admission', () => {
  it('returns 201 for a new admission and 200 for exact replay', async () => {
    const first = fixture({ trigger: {}, researchMission: {}, replayed: false });
    const replay = fixture({ trigger: {}, researchMission: {}, replayed: true });

    await expect(first.route.handle(request())).resolves.toMatchObject({ status: 201 });
    await expect(replay.route.handle(request())).resolves.toMatchObject({ status: 200 });
    expect(first.admit).toHaveBeenCalledWith({
      workspaceId,
      idempotencyKey: 'phase7-http-key',
      correlationId: 'phase7-http-correlation',
      command: { schemaVersion: 1 }
    });
  });

  it('rejects missing or wrong internal service identity before admission', async () => {
    for (const authorization of [undefined, 'not-the-secret']) {
      const f = fixture();
      await expect(
        f.route.handle(request({ 'x-markorbit-internal-authorization': authorization }))
      ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
      expect(f.admit).not.toHaveBeenCalled();
    }
  });

  it('requires workspace, idempotency and correlation headers', async () => {
    const cases = [
      ['x-markorbit-workspace-id', 'WORKSPACE_CONTEXT_REQUIRED'],
      ['idempotency-key', 'IDEMPOTENCY_KEY_REQUIRED'],
      ['x-correlation-id', 'CORRELATION_ID_REQUIRED']
    ] as const;
    for (const [header, code] of cases) {
      const f = fixture();
      await expect(f.route.handle(request({ [header]: undefined }))).rejects.toMatchObject({
        status: 400,
        code
      });
      expect(f.admit).not.toHaveBeenCalled();
    }
  });

  it('maps insufficient evidence and invalid requests to 400', async () => {
    for (const code of ['INSUFFICIENT_EVIDENCE', 'INVALID_REQUEST'] as const) {
      const f = failing(new MethodImprovementAdmissionError(code, 'invalid bounded admission'));
      await expect(f.route.handle(request())).rejects.toMatchObject({ status: 400, code });
    }
  });

  it('maps workspace mismatch to 403', async () => {
    const f = failing(
      new MethodImprovementAdmissionError('WORKSPACE_MISMATCH', 'trusted workspace mismatch')
    );
    await expect(f.route.handle(request())).rejects.toMatchObject({
      status: 403,
      code: 'WORKSPACE_MISMATCH'
    });
  });

  it('maps report and trigger conflicts to 409', async () => {
    for (const code of ['REPORT_MISMATCH', 'TRIGGER_CONFLICT'] as const) {
      const f = failing(new MethodImprovementAdmissionError(code, 'immutable conflict'));
      await expect(f.route.handle(request())).rejects.toMatchObject({ status: 409, code });
    }
  });

  it('maps persistence unavailability to retryable 503', async () => {
    const f = failing(
      new MethodImprovementAdmissionError(
        'PERSISTENCE_UNAVAILABLE',
        'persistence unavailable',
        true
      )
    );
    await expect(f.route.handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'PERSISTENCE_UNAVAILABLE',
      retryable: true
    });
  });
});
