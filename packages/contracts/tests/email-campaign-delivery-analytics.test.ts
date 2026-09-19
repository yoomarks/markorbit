import { describe, expect, it } from 'vitest';
import {
  noEmailCampaignDeliveryAnalyticsAuthorityConsequencesV1,
  parseEmailCampaignDeliveryAnalyticsV1
} from '../src/email-campaign-delivery-analytics.js';

const value = {
  schemaVersion: 1 as const,
  workspaceId: '14141414-1414-4414-8414-141414141414',
  campaign: { campaignId: 'email-campaign_primary' as const, version: 2 },
  audience: { audienceSnapshotId: 'campaign-audience_primary' as const, version: 3 },
  requested: 10,
  attempted: 8,
  accepted: 7,
  delivered: 5,
  deferred: 2,
  hardBounced: 1,
  softBounced: 1,
  complained: 1,
  unsubscribed: 1,
  failed: 1,
  unknown: 0,
  evidenceThrough: '2026-09-19T05:00:00.000Z',
  evaluatedAt: '2026-09-19T05:01:00.000Z',
  authority: noEmailCampaignDeliveryAnalyticsAuthorityConsequencesV1
};

describe('Email Campaign delivery analytics contract', () => {
  it('admits bounded aggregate evidence with no business authority', () => {
    expect(parseEmailCampaignDeliveryAnalyticsV1(value)).toEqual(value);
  });

  it('rejects authority escalation', () => {
    expect(() =>
      parseEmailCampaignDeliveryAnalyticsV1({
        ...value,
        authority: {
          ...value.authority,
          businessSuccessCreated: true
        }
      })
    ).toThrow(/businessSuccessCreated/);
  });

  it('rejects unsupported recipient or engagement material', () => {
    expect(() =>
      parseEmailCampaignDeliveryAnalyticsV1({
        ...value,
        recipientEmail: 'person@example.com'
      })
    ).toThrow(/exactly the V1 fields/);
    expect(() =>
      parseEmailCampaignDeliveryAnalyticsV1({
        ...value,
        opened: 4
      })
    ).toThrow(/exactly the V1 fields/);
  });

  it('rejects non-canonical evidence chronology', () => {
    expect(() =>
      parseEmailCampaignDeliveryAnalyticsV1({
        ...value,
        evidenceThrough: '2026-09-19T05:02:00.000Z'
      })
    ).toThrow(/after evaluatedAt/);
  });
});
