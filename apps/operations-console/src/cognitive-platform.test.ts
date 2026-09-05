import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CognitiveOwnerReadError,
  describeBrainBuildRuns,
  loadCapabilityCognitiveOwner,
  loadCognitivePlatformSnapshot,
  loadCoreCognitiveOwner
} from './cognitive-platform.js';

function jsonResponse(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function pathOf(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.toString() : input.url;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Operations Console cognitive owner client', () => {
  it('loads the exact Core Gateway route with only the authenticated browser session', async () => {
    const seen: Array<{ path: string; init: RequestInit | undefined }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        seen.push({ path: pathOf(input), init });
        return Promise.resolve(
          jsonResponse(200, {
            schemaVersion: 1,
            source: { domain: 'CORE' },
            futureOwnerField: { preserve: true }
          })
        );
      })
    );

    const result = await loadCoreCognitiveOwner();

    expect(result).toMatchObject({ futureOwnerField: { preserve: true } });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.path).toBe('/api/internal/control-plane/cognitive/brain');
    expect(seen[0]?.init?.credentials).toBe('include');
    expect(seen[0]?.init?.headers).toEqual({ accept: 'application/json' });
  });

  it('loads the exact Capability Gateway route without Workspace or browser authority headers', async () => {
    const seen: Array<{ path: string; init: RequestInit | undefined }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        seen.push({ path: pathOf(input), init });
        return Promise.resolve(
          jsonResponse(200, {
            schemaVersion: 1,
            source: { domain: 'CAPABILITY_ENGINE' },
            sourceAdmissionPolicies: [
              { policyId: 'policy-818', policyFingerprintSha256: 'a'.repeat(64) }
            ]
          })
        );
      })
    );

    const result = await loadCapabilityCognitiveOwner();

    expect(result.sourceAdmissionPolicies).toEqual([
      { policyId: 'policy-818', policyFingerprintSha256: 'a'.repeat(64) }
    ]);
    expect(seen[0]?.path).toBe('/api/internal/control-plane/cognitive/capabilities');
    expect(seen[0]?.init).toEqual({
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
  });

  it('keeps owner failures independent instead of converting them to an empty aggregate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const path = pathOf(input);
        return Promise.resolve(
          path.endsWith('/brain')
            ? jsonResponse(503, {
                code: 'COGNITIVE_READ_SOURCE_UNAVAILABLE',
                message: 'Core owner source unavailable.'
              })
            : jsonResponse(200, {
                schemaVersion: 1,
                source: { domain: 'CAPABILITY_ENGINE' },
                runtimeCapabilities: [{ capabilityId: 'capability-818' }]
              })
        );
      })
    );

    const snapshot = await loadCognitivePlatformSnapshot();

    expect(snapshot.core).toEqual({
      status: 'unavailable',
      error: {
        status: 503,
        code: 'COGNITIVE_READ_SOURCE_UNAVAILABLE',
        message: 'Core owner source unavailable.'
      }
    });
    expect(snapshot.capability).toMatchObject({
      status: 'available',
      value: { runtimeCapabilities: [{ capabilityId: 'capability-818' }] }
    });
  });

  it('preserves typed owner denial instead of masking it as a successful empty response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(403, {
            code: 'PERMISSION_DENIED',
            message: 'control-plane:cognitive:read capability is required.'
          })
        )
      )
    );

    await expect(loadCoreCognitiveOwner()).rejects.toEqual(
      new CognitiveOwnerReadError(
        403,
        'PERMISSION_DENIED',
        'control-plane:cognitive:read capability is required.'
      )
    );
  });
});

describe('Brain Build Run truth language', () => {
  it('renders NOT_DURABLY_RECORDED as unavailable durable inventory, never zero or healthy', () => {
    const description = describeBrainBuildRuns({
      availability: 'NOT_DURABLY_RECORDED',
      inventory: null,
      reasonCode: 'NO_DURABLE_BUILD_RUN_REGISTRY'
    });

    expect(description.title).toBe('Durable Brain Build Run inventory is not recorded');
    expect(description.detail).toContain('NOT_DURABLY_RECORDED');
    expect(description.detail).toContain('not zero runs');
    expect(description.detail).not.toContain('0 runs');
    expect(description.detail).not.toContain('healthy.');
  });

  it('does not infer empty inventory when the owner availability shape is absent', () => {
    expect(describeBrainBuildRuns(undefined)).toEqual({
      title: 'Brain Build Run availability unavailable',
      detail: 'No valid owner availability field is present; the console does not infer an empty inventory.'
    });
  });
});
