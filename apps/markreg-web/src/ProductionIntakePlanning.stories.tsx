import type { Meta, StoryObj } from '@storybook/react';
import type { ProductionIntakeV1 } from '@markorbit/contracts/markreg-early-funnel';
import type { ProductionIntakeClient } from './api/production-intake.js';
import {
  ProductionIntakePlanning,
  productionIntakeInput,
  type ProductionIntakeDraft
} from './ProductionIntakePlanning.js';

const workspaceId = '018f0000-0000-7000-8000-000000000699';
const draft: ProductionIntakeDraft = {
  applicantType: 'ORGANIZATION',
  applicantName: 'Orbit Labs Ltd.',
  applicantCountry: 'GB',
  trademarkType: 'WORD',
  trademarkText: 'ORBIT',
  targetJurisdictions: 'US, GB',
  goodsServices: 'Downloadable software and software as a service.',
  businessContext: 'Launch the Orbit brand for software services.',
  filingGoal: 'Record a new filing request.'
};
const record: ProductionIntakeV1 = {
  schemaVersion: 1,
  intakeId: 'production-intake_699',
  workspaceId,
  version: 1,
  status: 'RECEIVED',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: productionIntakeInput(draft),
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: 'a'.repeat(64),
  createdAt: '2026-09-03T08:00:00.000Z',
  updatedAt: '2026-09-03T08:00:00.000Z',
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

const editingClient: ProductionIntakeClient = {
  create: () => Promise.resolve({ intake: record }),
  get: () => Promise.resolve({ intake: record })
};

const meta = {
  title: 'MarkReg/Production Intake',
  component: ProductionIntakePlanning,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof ProductionIntakePlanning>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GuidedEntry: Story = {
  args: {
    client: editingClient,
    workspaceId
  }
};

export const Mobile390: Story = {
  args: {
    client: editingClient,
    workspaceId
  },
  parameters: {
    viewport: {
      viewports: {
        markreg390: {
          name: 'MarkReg 390px',
          styles: { width: '390px', height: '844px' }
        }
      },
      defaultViewport: 'markreg390'
    }
  }
};
