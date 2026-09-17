import { describe, expect, it } from 'vitest';
import {
  parseWechatMiniProgramEntryV1,
  wechatMiniProgramAuthorityConsequencesV1
} from '../src/site-wechat-miniprogram.js';

describe('WeChat Mini Program Site adapter contract', () => {
  it('accepts only bounded acquisition evidence', () => {
    expect(
      parseWechatMiniProgramEntryV1({
        schemaVersion: 1,
        campaign: 'launch-2026',
        content: 'service-trademark',
        referral: 'partner-a'
      })
    ).toEqual({
      schemaVersion: 1,
      campaign: 'launch-2026',
      content: 'service-trademark',
      referral: 'partner-a'
    });
  });

  it.each(['siteId', 'workspaceId', 'openid', 'unionid', 'session', 'paymentToken'])(
    'rejects %s as unsupported adapter authority',
    (field) => {
      expect(() => parseWechatMiniProgramEntryV1({ [field]: 'attacker-value' })).toThrow(
        'unsupported authority fields'
      );
    }
  );

  it('declares that projection and handoff create no business truth', () => {
    expect(Object.values(wechatMiniProgramAuthorityConsequencesV1)).toEqual(
      expect.arrayContaining([false])
    );
    expect(Object.values(wechatMiniProgramAuthorityConsequencesV1).every((value) => !value)).toBe(
      true
    );
  });
});
