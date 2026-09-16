import { describe, expect, it, vi } from 'vitest';
import { educationCommunityWorkspaceActivationFingerprintSha256V1 } from '@markorbit/contracts/education-community';
import { HttpCoreEducationCommunityWorkspaceReader } from '../src/education-community.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';

describe('Education/community owner readers', () => {
  it('accepts only an exact active Core Workspace activation reference', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            workspace: {
              owner: 'CORE',
              kind: 'WORKSPACE_ACTIVATION',
              workspaceId,
              status: 'ACTIVE',
              version: 2,
              observedAt: '2026-09-17T00:00:00.000Z',
              fingerprintSha256: educationCommunityWorkspaceActivationFingerprintSha256V1({
                owner: 'CORE',
                kind: 'WORKSPACE_ACTIVATION',
                id: workspaceId,
                version: 2,
                observedAt: '2026-09-17T00:00:00.000Z'
              })
            }
          }),
          { status: 200 }
        )
      )
    );
    const reader = new HttpCoreEducationCommunityWorkspaceReader(
      'http://core.test',
      'internal-secret-32-bytes-minimum!!',
      fetchImpl
    );
    await expect(reader.resolve(workspaceId)).resolves.toMatchObject({
      owner: 'CORE',
      kind: 'WORKSPACE_ACTIVATION',
      id: workspaceId,
      version: 2
    });
    expect(
      new Headers(fetchImpl.mock.calls[0]![1]?.headers).get('x-markorbit-internal-authorization')
    ).toBe('internal-secret-32-bytes-minimum!!');
  });

  it('does not treat an archived Workspace as activation', async () => {
    const reader = new HttpCoreEducationCommunityWorkspaceReader(
      'http://core.test',
      'internal-secret-32-bytes-minimum!!',
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              workspace: {
                owner: 'CORE',
                kind: 'WORKSPACE_ACTIVATION',
                workspaceId,
                status: 'ARCHIVED',
                version: 2,
                observedAt: '2026-09-17T00:00:00.000Z',
                fingerprintSha256: 'a'.repeat(64)
              }
            }),
            { status: 200 }
          )
        )
    );
    await expect(reader.resolve(workspaceId)).rejects.toMatchObject({ code: 'LINEAGE_MISMATCH' });
  });
});
