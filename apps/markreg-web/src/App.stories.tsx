import type { Meta, StoryObj } from '@storybook/react';
import { MarkregApp } from './App.js';
import type { MarkregClient } from './api/markreg.js';
const fixtureClient: MarkregClient = {
  createIntake: (command) =>
    Promise.resolve({
      intake: {
        intakeId: 'intake_story',
        channel: command.channel,
        relationshipModel: command.relationshipModel,
        status: 'RECOMMENDATION_READY',
        customerIntent: command.customerIntent,
        createdAt: new Date().toISOString(),
        correlationId: command.correlationId
      },
      recommendation: {
        recommendationId: 'recommendation_story',
        intakeId: 'intake_story',
        status: 'FIXTURE_ONLY',
        options: [
          { tier: 'A', name: 'Essential Protection', description: 'A focused starting point.' },
          { tier: 'B', name: 'Recommended Protection', description: 'Balanced coverage.' },
          { tier: 'C', name: 'Extended Protection', description: 'Broader planning coverage.' }
        ],
        rationale: 'Compares scope against the supplied markets and goal.',
        assumptions: ['The supplied applicant details are accurate.'],
        limitations: ['No clearance search or professional review has been performed.'],
        provenance: ['execution_story'],
        generatedAt: new Date().toISOString()
      },
      trace: {
        correlationId: command.correlationId,
        capabilityRequestId: 'capability_story',
        executionId: 'execution_story',
        provenanceRefs: ['execution_story']
      }
    })
};
export default {
  title: 'Products/markreg Recommendation',
  component: MarkregApp,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof MarkregApp>;
export const Comparison: StoryObj<typeof MarkregApp> = {};
export const SmallScreen: StoryObj<typeof MarkregApp> = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
export const FixtureBackedJourney: StoryObj<typeof MarkregApp> = {
  args: { client: fixtureClient }
};
