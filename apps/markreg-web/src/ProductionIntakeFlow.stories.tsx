import type { ProductionIntakeV1 } from '@markorbit/contracts/markreg-early-funnel';
import type { Meta, StoryObj } from '@storybook/react';
import type { ProductionIntakeClient } from './api/production-intake.js';
import { ProductionIntakeFlow } from './ProductionIntakeFlow.js';

const intake: ProductionIntakeV1 = {
  schemaVersion: 1,
  intakeId: 'production-intake_story',
  workspaceId: '018f0000-0000-7000-8000-000000000899',
  version: 1,
  status: 'RECEIVED',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Launch a software brand in several markets.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs Ltd.', country: 'GB' },
    trademark: { type: 'WORD', representationText: 'ORBIT' },
    targetJurisdictions: ['US', 'GB'],
    goodsServices: { sourceText: 'Downloadable software and software as a service.' },
    filingGoal: 'Prepare a new filing.'
  },
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: 'a'.repeat(64),
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
  authorityConsequences: {
    professionalApprovalCreated: false,
    legalConclusionCreated: false,
    filingAuthorizationCreated: false,
    protectedActionAuthorized: false,
    orderCreated: false,
    paymentCreated: false,
    invoiceCreated: false,
    filingCreated: false,
    officialTruthCreated: false
  }
};

const client: ProductionIntakeClient = {
  create: () => Promise.resolve(intake),
  get: () => Promise.resolve(intake)
};

const reset = () => {
  sessionStorage.removeItem('markreg-production-intake-draft-v1');
  sessionStorage.removeItem('markreg-production-intake-submission-v1');
  sessionStorage.removeItem('markreg-production-intake-ref-v1');
};

const meta = {
  title: 'MarkReg/Production Intake',
  component: ProductionIntakeFlow,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof ProductionIntakeFlow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Start: Story = {
  args: { client },
  decorators: [
    (Story) => {
      reset();
      return <Story />;
    }
  ]
};

export const Mobile390: Story = {
  args: { client },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  decorators: [
    (Story) => {
      reset();
      return <Story />;
    }
  ]
};

export const DurableReceipt: Story = {
  args: { client },
  decorators: [
    (Story) => {
      reset();
      sessionStorage.setItem('markreg-production-intake-ref-v1', JSON.stringify(intake.intakeId));
      return <Story />;
    }
  ]
};
