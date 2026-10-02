import type { PreparedActionJourney } from '@markorbit/contracts/product-loop';
import type { SeedWorkbenchContextBrief } from './SeedContextualWorkbench.js';

const workspaceId = '30303030-3030-4030-8030-303030303030';
const now = '2026-09-21T12:00:00.000Z';

export const contextualWorkbenchPreviewContext: SeedWorkbenchContextBrief = {
  contextId: 'seed-context_northstar',
  title: 'Northstar Robotics Ltd.',
  subtitle: 'Seed / Agency contextual workbench prototype',
  currentness: 'Prepared seed context refreshed 18 minutes ago.',
  evidence: [
    '18 historically represented trademarks',
    '46 related source records discovered',
    'One maintenance item needs review'
  ],
  authorityNote:
    'Historical representation, discovered records and conversation text do not establish a current Customer Relationship, managed asset or customer instruction.'
};

export const preparedOpportunityPreview = {
  schemaVersion: 1,
  preparedAction: {
    schemaVersion: 1,
    preparedActionId: 'prepared-action_workbench-opportunity',
    workspaceId,
    version: 1,
    recommendation: { id: 'today-recommendation_workbench-opportunity', version: 1 },
    recommendationFingerprintSha256: 'a'.repeat(64),
    kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    summary: 'Review one qualified trademark-service opportunity in MarkReg.',
    confirmationEffect:
      'Create one Formal Trademark Service Opportunity from the exact reviewed Candidate. No customer contact, order, matter, payment or filing will occur.',
    handoffTarget: 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    sources: [],
    preparedActionFingerprintSha256: 'b'.repeat(64),
    confirmationRequired: true,
    executionAuthorized: false,
    createdAt: now,
    updatedAt: now
  },
  handoffState: 'AWAITING_CONFIRMATION'
} as unknown as PreparedActionJourney;

export const pendingOpportunityPreview = {
  ...preparedOpportunityPreview,
  handoffState: 'HANDOFF_PENDING'
} as unknown as PreparedActionJourney;

export const completedOpportunityPreview = {
  ...preparedOpportunityPreview,
  confirmation: {
    schemaVersion: 1,
    preparedAction: { id: preparedOpportunityPreview.preparedAction.preparedActionId, version: 1 },
    expectedPreparedActionFingerprintSha256:
      preparedOpportunityPreview.preparedAction.preparedActionFingerprintSha256,
    confirmedByPrincipalId: '11111111-1111-4111-8111-111111111111',
    confirmedAt: '2026-09-21T12:03:00.000Z',
    acknowledgedEffect: preparedOpportunityPreview.preparedAction.confirmationEffect,
    protectedActionAuthorized: false
  },
  handoffState: 'HANDOFF_COMPLETED',
  handoffResult: {
    schemaVersion: 1,
    preparedAction: { id: preparedOpportunityPreview.preparedAction.preparedActionId, version: 1 },
    target: 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    owner: 'MARKREG',
    ownerRecord: { id: 'trademark-service-opportunity_workbench', version: 1 },
    completedAt: '2026-09-21T12:03:01.000Z',
    consequences: {
      externalPublishExecuted: false,
      customerContactedAutomatically: false,
      formalOpportunityCreatedAutomatically: false,
      orderCreatedAutomatically: false,
      matterCreatedAutomatically: false,
      paymentCreated: false,
      providerAppointed: false,
      filingSubmitted: false,
      officialTruthCreated: false
    }
  }
} as unknown as PreparedActionJourney;

export const preparedClientActionPreview = {
  schemaVersion: 1,
  preparedAction: {
    schemaVersion: 1,
    preparedActionId: 'prepared-action_workbench-client-update',
    workspaceId,
    version: 1,
    recommendation: { id: 'today-recommendation_workbench-client-update', version: 1 },
    recommendationFingerprintSha256: 'c'.repeat(64),
    kind: 'PREPARE_CONTENT',
    summary: 'Prepare a concise client update for human review.',
    confirmationEffect:
      'Create one reviewable content work package. Nothing will be sent, published or filed.',
    handoffTarget: 'LITE_CONTENT_PREPARATION',
    sources: [],
    preparedActionFingerprintSha256: 'd'.repeat(64),
    confirmationRequired: true,
    executionAuthorized: false,
    createdAt: now,
    updatedAt: now
  },
  handoffState: 'AWAITING_CONFIRMATION'
} as unknown as PreparedActionJourney;

export const completedClientActionPreview = {
  ...preparedClientActionPreview,
  confirmation: {
    schemaVersion: 1,
    preparedAction: { id: preparedClientActionPreview.preparedAction.preparedActionId, version: 1 },
    expectedPreparedActionFingerprintSha256:
      preparedClientActionPreview.preparedAction.preparedActionFingerprintSha256,
    confirmedByPrincipalId: '11111111-1111-4111-8111-111111111111',
    confirmedAt: '2026-09-21T12:05:00.000Z',
    acknowledgedEffect: preparedClientActionPreview.preparedAction.confirmationEffect,
    protectedActionAuthorized: false
  },
  handoffState: 'HANDOFF_COMPLETED',
  handoffResult: {
    schemaVersion: 1,
    preparedAction: { id: preparedClientActionPreview.preparedAction.preparedActionId, version: 1 },
    target: 'LITE_CONTENT_PREPARATION',
    owner: 'LITE',
    ownerRecord: { id: 'content-opportunity_workbench', version: 1 },
    completedAt: '2026-09-21T12:05:01.000Z',
    consequences: {
      externalPublishExecuted: false,
      customerContactedAutomatically: false,
      formalOpportunityCreatedAutomatically: false,
      orderCreatedAutomatically: false,
      matterCreatedAutomatically: false,
      paymentCreated: false,
      providerAppointed: false,
      filingSubmitted: false,
      officialTruthCreated: false
    }
  }
} as unknown as PreparedActionJourney;
