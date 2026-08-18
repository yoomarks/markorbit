import { describe, expect, it } from 'vitest';
import type { VisualBrief } from '@markorbit/contracts/daily-workspace';
import {
  UnavailableVisualEngineConsumer,
  buildLiteVisualRequest,
  type VisualBriefRecord
} from '../src/visual-bridge.js';

const brief: VisualBrief = {
  schemaVersion: 1,
  visualBriefId: 'visual-brief_contract',
  workspaceId: '81818181-8181-4818-8818-818181818181',
  version: 1,
  contentKit: { id: 'content-kit_contract', version: 1 },
  title: 'USPTO fee update',
  keyMessage: 'Explain the fee change without claiming official legal truth.',
  audience: 'US trademark practitioners',
  outputKind: 'XIAOHONGSHU_COVER',
  aspectRatio: '3:4',
  styleIntent: 'MarkOrbit Lite editorial visual',
  requestedIpPackage: 'MOKI',
  sceneIntent: 'MOKI points at a simple fee-change timeline.',
  reuseFirstRequired: true,
  paidExecutionAuthorized: false,
  createdAt: '2026-08-18T08:00:00.000Z'
};

const record: VisualBriefRecord = {
  brief,
  visualBriefFingerprintSha256: 'a'.repeat(64),
  consumerIdentity: {
    ipId: 'MOKI',
    styleId: 'markorbit-lite-editorial-v1'
  }
};

describe('Lite Visual Bridge consumer boundary', () => {
  it('emits only the governed MOKI Lite request vocabulary', () => {
    const request = buildLiteVisualRequest(record);
    expect(request).toEqual({
      api_version: 'lite-illustration-request/v1',
      operation: 'request.start',
      request_id: expect.stringMatching(/^lite_[0-9a-f]{32}$/u),
      input: {
        ip_id: 'MOKI',
        style_id: 'markorbit-lite-editorial-v1',
        scene_intent: 'MOKI points at a simple fee-change timeline.',
        composition: 'XIAOHONGSHU_COVER 3:4'
      }
    });
    const serialized = JSON.stringify(request);
    for (const forbidden of [
      'provider_id',
      'model_id',
      'recipe_id',
      'route_id',
      'paid_confirmation',
      'qc_override',
      'identity_override'
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('fails closed when no governed Visual Engine transport exists', async () => {
    const consumer = new UnavailableVisualEngineConsumer();
    await expect(consumer.start(buildLiteVisualRequest(record))).rejects.toMatchObject({
      code: 'VISUAL_CONSUMER_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });
});