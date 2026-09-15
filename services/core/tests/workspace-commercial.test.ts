import { describe, expect, it } from 'vitest';
import type {
  CommercialAgreementV1,
  CommercialOfferVersionV1,
  RatePolicyVersionV1
} from '@markorbit/contracts/workspace-commercial';
import {
  InMemoryWorkspaceCommercialRepositoryV1,
  WorkspaceCommercialError,
  WorkspaceCommercialServiceV1
} from '../src/workspace-commercial.js';

const t0 = '2026-09-15T00:00:00.000Z';
const t1 = '2026-10-01T00:00:00.000Z';
const memberships = new Map([
  [
    'membership_a',
    {
      membershipId: 'membership_a',
      workspaceId: 'workspace_team',
      userId: 'user_a',
      status: 'ACTIVE' as const
    }
  ],
  [
    'membership_b',
    {
      membershipId: 'membership_b',
      workspaceId: 'workspace_team',
      userId: 'user_b',
      status: 'ACTIVE' as const
    }
  ],
  [
    'membership_other',
    {
      membershipId: 'membership_other',
      workspaceId: 'workspace_other',
      userId: 'user_c',
      status: 'ACTIVE' as const
    }
  ]
]);

function setup() {
  const repository = new InMemoryWorkspaceCommercialRepositoryV1();
  return {
    repository,
    service: new WorkspaceCommercialServiceV1(repository, (id) =>
      Promise.resolve(memberships.get(id))
    )
  };
}

function offer(overrides: Partial<CommercialOfferVersionV1> = {}): CommercialOfferVersionV1 {
  return {
    schemaVersion: 1,
    offerId: 'offer_lite-personal',
    version: 1,
    sku: 'LITE_FREE_V1',
    displayName: 'Lite Free',
    subjectScope: 'USER',
    productKey: 'LITE',
    amountMinor: 0,
    currency: 'CNY',
    billingInterval: 'NONE',
    effectiveFrom: t0,
    lifecycle: 'PUBLISHED',
    entitlements: [
      { key: 'lite.access', subjectScope: 'USER', value: { kind: 'BOOLEAN', enabled: true } }
    ],
    assignableBenefits: [],
    publishedAt: t0,
    recordedAt: t0,
    ...overrides
  };
}

function agreement(overrides: Partial<CommercialAgreementV1> = {}): CommercialAgreementV1 {
  return {
    schemaVersion: 1,
    agreementId: 'agreement_personal-a',
    version: 1,
    subject: { scope: 'USER', userId: 'user_a' },
    offerId: 'offer_lite-personal',
    offerVersion: 1,
    status: 'ACTIVE',
    effectiveFrom: t0,
    sourceRef: 'manual:test',
    recordedAt: t0,
    ...overrides
  };
}

describe('Workspace commercial foundation', () => {
  it('keeps two immutable catalog versions and agreement lineage', async () => {
    const { repository, service } = setup();
    await service.recordOffer(offer());
    await service.recordOffer(
      offer({ version: 2, sku: 'LITE_FREE_V2', amountMinor: 100, effectiveFrom: t1 })
    );
    await service.recordAgreement(agreement());
    expect((await repository.getOffer('offer_lite-personal', 1))?.amountMinor).toBe(0);
    expect((await repository.getOffer('offer_lite-personal', 2))?.amountMinor).toBe(100);
    expect((await repository.listAgreementVersions('agreement_personal-a'))[0]?.offerVersion).toBe(
      1
    );
  });

  it('models Team as Workspace grants plus one explicitly assigned Pro benefit', async () => {
    const { service } = setup();
    await service.recordOffer(
      offer({
        offerId: 'offer_lite-team',
        sku: 'LITE_TEAM_V1',
        displayName: 'Lite Team',
        subjectScope: 'WORKSPACE',
        amountMinor: 19900,
        billingInterval: 'MONTH',
        entitlements: [
          {
            key: 'lite.access',
            subjectScope: 'WORKSPACE',
            value: { kind: 'BOOLEAN', enabled: true }
          }
        ],
        assignableBenefits: [
          {
            benefitKey: 'included-lite-pro',
            capacity: 1,
            entitlements: [
              {
                key: 'lite.user.ai_usage',
                subjectScope: 'USER',
                value: {
                  kind: 'QUANTITY',
                  quantity: 100,
                  unit: 'RUN',
                  aggregation: 'MAX',
                  period: 'MONTH'
                }
              }
            ]
          }
        ]
      })
    );
    await service.recordAgreement(
      agreement({
        agreementId: 'agreement_team',
        subject: { scope: 'WORKSPACE', workspaceId: 'workspace_team' },
        offerId: 'offer_lite-team'
      })
    );
    const materialized = await service.materializeActiveAgreement('agreement_team');
    const assignable = materialized.assignableGrants[0]!;
    await service.assignBenefit({
      assignmentId: 'assignment_a',
      assignableGrantId: assignable.assignableGrantId,
      membershipId: 'membership_a',
      effectiveFrom: t0,
      recordedAt: t0
    });
    expect(
      (
        await service.resolveEntitlement(
          { scope: 'USER', userId: 'user_a' },
          'lite.user.ai_usage',
          t1
        )
      ).value
    ).toMatchObject({ quantity: 100 });
    await expect(
      service.resolveEntitlement({ scope: 'USER', userId: 'user_b' }, 'lite.user.ai_usage', t1)
    ).rejects.toMatchObject({ code: 'NO_APPLICABLE_ENTITLEMENT' });
    await expect(
      service.assignBenefit({
        assignmentId: 'assignment_other',
        assignableGrantId: assignable.assignableGrantId,
        membershipId: 'membership_other',
        effectiveFrom: t1,
        recordedAt: t1
      })
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' });
  });

  it('reassigns the single included grant without changing member roles and preserves history', async () => {
    const { repository, service } = setup();
    await service.recordOffer(
      offer({
        offerId: 'offer_team',
        sku: 'TEAM',
        subjectScope: 'WORKSPACE',
        displayName: 'Team',
        entitlements: [],
        assignableBenefits: [
          {
            benefitKey: 'pro',
            capacity: 1,
            entitlements: [
              {
                key: 'lite.user.ai_usage',
                subjectScope: 'USER',
                value: { kind: 'QUANTITY', quantity: 50, unit: 'RUN', aggregation: 'MAX' }
              }
            ]
          }
        ]
      })
    );
    await service.recordAgreement(
      agreement({
        agreementId: 'agreement_team',
        subject: { scope: 'WORKSPACE', workspaceId: 'workspace_team' },
        offerId: 'offer_team'
      })
    );
    const grant = (await service.materializeActiveAgreement('agreement_team')).assignableGrants[0]!;
    await service.assignBenefit({
      assignmentId: 'assignment_a',
      assignableGrantId: grant.assignableGrantId,
      membershipId: 'membership_a',
      effectiveFrom: t0,
      recordedAt: t0
    });
    await service.assignBenefit({
      assignmentId: 'assignment_b',
      assignableGrantId: grant.assignableGrantId,
      membershipId: 'membership_b',
      effectiveFrom: t1,
      recordedAt: t1
    });
    const history = await repository.listAssignments(grant.assignableGrantId);
    expect(history.filter((v) => v.assignmentId === 'assignment_a').map((v) => v.status)).toEqual([
      'ACTIVE',
      'REVOKED'
    ]);
    expect(
      (
        await service.resolveEntitlement(
          { scope: 'USER', userId: 'user_a' },
          'lite.user.ai_usage',
          '2026-09-30T00:00:00.000Z'
        )
      ).value
    ).toMatchObject({ quantity: 50 });
    await expect(
      service.resolveEntitlement(
        { scope: 'USER', userId: 'user_a' },
        'lite.user.ai_usage',
        '2026-10-02T00:00:00.000Z'
      )
    ).rejects.toBeInstanceOf(WorkspaceCommercialError);
    expect(
      (
        await service.resolveEntitlement(
          { scope: 'USER', userId: 'user_b' },
          'lite.user.ai_usage',
          '2026-10-02T00:00:00.000Z'
        )
      ).value
    ).toMatchObject({ quantity: 50 });
  });

  it('makes Team cancellation explicit on dependent grants and assignments', async () => {
    const { repository, service } = setup();
    await service.recordOffer(
      offer({
        offerId: 'offer_team_cancel',
        sku: 'TEAM_CANCEL',
        subjectScope: 'WORKSPACE',
        displayName: 'Team',
        entitlements: [],
        assignableBenefits: [
          {
            benefitKey: 'pro',
            capacity: 1,
            entitlements: [
              {
                key: 'lite.user.ai_usage',
                subjectScope: 'USER',
                value: { kind: 'QUANTITY', quantity: 50, unit: 'RUN', aggregation: 'MAX' }
              }
            ]
          }
        ]
      })
    );
    const active = agreement({
      agreementId: 'agreement_team_cancel',
      subject: { scope: 'WORKSPACE', workspaceId: 'workspace_team' },
      offerId: 'offer_team_cancel'
    });
    await service.recordAgreement(active);
    const grant = (await service.materializeActiveAgreement(active.agreementId))
      .assignableGrants[0]!;
    await service.assignBenefit({
      assignmentId: 'assignment_cancel',
      assignableGrantId: grant.assignableGrantId,
      membershipId: 'membership_a',
      effectiveFrom: t0,
      recordedAt: t0
    });
    await service.recordAgreement({
      ...active,
      version: 2,
      status: 'CANCELLED',
      recordedAt: t1,
      effectiveTo: t1
    });
    expect(
      (await repository.listAssignableGrantVersions(grant.assignableGrantId)).at(-1)?.status
    ).toBe('REVOKED');
    expect((await repository.listAssignments(grant.assignableGrantId)).at(-1)?.status).toBe(
      'REVOKED'
    );
    expect(
      (
        await service.resolveEntitlement(
          { scope: 'USER', userId: 'user_a' },
          'lite.user.ai_usage',
          '2026-09-30T00:00:00.000Z'
        )
      ).value
    ).toMatchObject({ quantity: 50 });
    await expect(
      service.resolveEntitlement(
        { scope: 'USER', userId: 'user_a' },
        'lite.user.ai_usage',
        '2026-10-02T00:00:00.000Z'
      )
    ).rejects.toMatchObject({ code: 'NO_APPLICABLE_ENTITLEMENT' });
  });

  it('keeps product installation separate from entitlement', async () => {
    const { service } = setup();
    await service.recordInstallation({
      schemaVersion: 1,
      installationId: 'install_site',
      workspaceId: 'workspace_team',
      productKey: 'SITE',
      version: 1,
      status: 'ACTIVE',
      effectiveAt: t0,
      recordedAt: t0,
      sourceRef: 'config:test'
    });
    expect(await service.listCurrentInstallations('workspace_team')).toHaveLength(1);
    await expect(
      service.resolveEntitlement(
        { scope: 'WORKSPACE', workspaceId: 'workspace_team' },
        'site.access',
        t1
      )
    ).rejects.toMatchObject({ code: 'NO_APPLICABLE_ENTITLEMENT' });
  });

  it('proves exact current SITE installation and Workspace entitlement references for Site runtime', async () => {
    const { repository, service } = setup();
    await repository.appendInstallation({
      schemaVersion: 1,
      installationId: 'install_site_runtime',
      workspaceId: 'workspace_team',
      productKey: 'SITE',
      version: 1,
      status: 'ACTIVE',
      effectiveAt: t0,
      recordedAt: t0,
      sourceRef: 'test:site-runtime'
    });
    for (const [index, entitlementKey] of ['site.access', 'site.workspace.custom_domain'].entries())
      await repository.appendGrant({
        schemaVersion: 1,
        grantId: `grant_site_${index}`,
        version: 1,
        subject: { scope: 'WORKSPACE', workspaceId: 'workspace_team' },
        entitlement: {
          key: entitlementKey,
          subjectScope: 'WORKSPACE',
          value: { kind: 'BOOLEAN', enabled: true }
        },
        status: 'ACTIVE',
        sourceType: 'AGREEMENT',
        sourceRef: 'agreement_site:1',
        effectiveFrom: t0,
        recordedAt: t0
      });
    await expect(
      service.resolveSiteRuntimeAccess({
        workspaceId: 'workspace_team',
        installationId: 'install_site_runtime',
        installationVersion: 1,
        entitlementKeys: ['site.access', 'site.workspace.custom_domain'],
        asOf: t1
      })
    ).resolves.toMatchObject({
      installationRef: { installationId: 'install_site_runtime', version: 1 },
      entitlementRefs: [{ key: 'site.access' }, { key: 'site.workspace.custom_domain' }]
    });
    await repository.appendInstallation({
      schemaVersion: 1,
      installationId: 'install_site_runtime',
      workspaceId: 'workspace_team',
      productKey: 'SITE',
      version: 2,
      status: 'SUSPENDED',
      effectiveAt: t1,
      recordedAt: t1,
      sourceRef: 'test:suspended'
    });
    await expect(
      service.resolveSiteRuntimeAccess({
        workspaceId: 'workspace_team',
        installationId: 'install_site_runtime',
        installationVersion: 1,
        entitlementKeys: ['site.access'],
        asOf: '2026-10-02T00:00:00.000Z'
      })
    ).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
  });

  it('snapshots the exact historical rate version without inventing payment success', async () => {
    const { service } = setup();
    const rate = (
      version: number,
      effectiveFrom: string,
      basisPoints: number
    ): RatePolicyVersionV1 => ({
      schemaVersion: 1,
      policyId: 'policy_referral',
      version,
      kind: 'REFERRAL_COMMISSION',
      lifecycle: 'ACTIVE',
      applicability: { productKey: 'MARKREG_DISTRIBUTION', channelKey: 'REFERRAL' },
      calculation: { kind: 'PERCENTAGE', basisPoints },
      effectiveFrom,
      sourceRef: `policy-config:${version}`,
      recordedAt: effectiveFrom
    });
    await service.recordRatePolicy(rate(1, t0, 1000));
    const oldSnapshot = await service.resolveRate({
      kind: 'REFERRAL_COMMISSION',
      applicability: { productKey: 'MARKREG_DISTRIBUTION', channelKey: 'REFERRAL' },
      asOf: '2026-09-20T00:00:00.000Z',
      sourceRef: 'order_1',
      basisAmountMinor: 10000,
      currency: 'CNY'
    });
    await service.recordRatePolicy(rate(2, t1, 1500));
    const newSnapshot = await service.resolveRate({
      kind: 'REFERRAL_COMMISSION',
      applicability: { channelKey: 'REFERRAL', productKey: 'MARKREG_DISTRIBUTION' },
      asOf: '2026-10-02T00:00:00.000Z',
      sourceRef: 'order_2',
      basisAmountMinor: 10000,
      currency: 'CNY'
    });
    expect(oldSnapshot).toMatchObject({ policyVersion: 1, calculatedAmountMinor: 1000 });
    expect(newSnapshot).toMatchObject({ policyVersion: 2, calculatedAmountMinor: 1500 });
    expect(oldSnapshot).not.toHaveProperty('paymentStatus');
  });
});
