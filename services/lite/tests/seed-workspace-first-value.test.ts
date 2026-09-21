import { describe, expect, it, vi } from 'vitest';
import type { SeedWorkspaceClaimV1 } from '../src/seed-workspace-package.js';
import { SeedWorkspaceFirstValueService } from '../src/seed-workspace-package.js';

const packageId = 'seed-workspace-package_first-value';
const workspaceId = '22222222-2222-4222-8222-222222222222';

function claim(): SeedWorkspaceClaimV1 {
  return {
    schemaVersion: 1,
    seedWorkspacePackageId: packageId,
    packageFingerprintSha256: '1'.repeat(64),
    educationCommunityJourneyId: 'education-journey_seed-first-value',
    journeyVersion: 3,
    journeyFingerprintSha256: '2'.repeat(64),
    activatedWorkspaceId: workspaceId,
    workspaceActivationVersion: 1,
    workspaceActivationFingerprintSha256: '3'.repeat(64),
    workspaceActivationObservedAt: '2026-09-21T01:00:00.000Z',
    claimedByPrincipalId: 'user_seed_claimant',
    claimedAt: '2026-09-21T01:00:00.000Z'
  };
}

describe('Seed Workspace first value', () => {
  it('derives exact Work Item evidence before using the existing EducationCommunity owner', async () => {
    const storedClaim = claim();
    const packages = {
      readClaimForWorkspace: vi.fn().mockResolvedValue(storedClaim)
    };
    const workItem = {
      owner: 'LITE' as const,
      kind: 'LITE_WORK_ITEM' as const,
      id: 'lite-work-item_first-value',
      version: 1,
      fingerprintSha256: '4'.repeat(64),
      observedAt: '2026-09-21T01:05:00.000Z'
    };
    const workItems = {
      reference: vi.fn().mockResolvedValue(workItem)
    };
    const journey = {
      educationCommunityJourneyId: storedClaim.educationCommunityJourneyId,
      stage: 'FIRST_VALUE_RECORDED' as const,
      version: 4
    };
    const journeys = {
      recordFirstValue: vi.fn().mockResolvedValue(journey)
    };
    const service = new SeedWorkspaceFirstValueService(packages, journeys, workItems);

    await expect(
      service.record({
        packageId,
        workspaceId,
        actorPrincipalId: 'user_seed_claimant',
        idempotencyKey: 'seed-first-value-001',
        workItemId: 'lite-work-item_first-value'
      })
    ).resolves.toEqual({ workItem, journey });

    expect(packages.readClaimForWorkspace).toHaveBeenCalledWith(workspaceId, packageId);
    expect(workItems.reference).toHaveBeenCalledWith(workspaceId, 'lite-work-item_first-value');
    expect(journeys.recordFirstValue).toHaveBeenCalledWith({
      workspaceId,
      actorPrincipalId: 'user_seed_claimant',
      idempotencyKey: 'seed-first-value-001',
      journeyId: storedClaim.educationCommunityJourneyId,
      expectedVersion: 3,
      workItem: {
        id: workItem.id,
        version: workItem.version,
        fingerprintSha256: workItem.fingerprintSha256
      }
    });
  });

  it('does not accept a Seed claim from another Workspace', async () => {
    const packages = {
      readClaimForWorkspace: vi.fn().mockResolvedValue(null)
    };
    const workItems = { reference: vi.fn() };
    const journeys = { recordFirstValue: vi.fn() };
    const service = new SeedWorkspaceFirstValueService(packages, journeys, workItems);

    await expect(
      service.record({
        packageId,
        workspaceId,
        actorPrincipalId: 'user_seed_claimant',
        idempotencyKey: 'seed-first-value-denied',
        workItemId: 'lite-work-item_first-value'
      })
    ).rejects.toMatchObject({ code: 'SEED_PACKAGE_NOT_FOUND', status: 404 });
    expect(workItems.reference).not.toHaveBeenCalled();
    expect(journeys.recordFirstValue).not.toHaveBeenCalled();
  });
});
