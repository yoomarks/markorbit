import type { Meta, StoryObj } from '@storybook/react';
import type { DurableDocumentPackageView } from '@markorbit/contracts';
import {
  completedReviewFixture,
  packageClientForScenario,
  previewPackageId,
  reviewClientForScenario
} from '../../documents-instructions-preview/fixtures.js';
import { DocumentPackageWorkspace } from './DocumentPackageWorkspace.js';

const base: DurableDocumentPackageView = {
  documentPackageId: 'document-package_story025',
  workspaceId: 'workspace-story025',
  formalMatterId: 'formal-matter_story025',
  sourceFormalMatterVersion: 1,
  sourceFormalMatterHash: 'a'.repeat(64),
  professionalReviewCaseId: 'professional-review_story025',
  sourceReviewVersion: 5,
  sourceCompletedDecisionId: '2026-08-01T10:00:00.000Z',
  sourceCompletedDecisionHash: 'b'.repeat(64),
  status: 'DRAFT',
  version: 4,
  schemaVersion: 1,
  requirements: [
    {
      requirementKey: 'MARK_REPRESENTATION_FILE',
      displayName: 'Mark representation',
      blocking: true
    }
  ],
  draft: { note: 'Exact reviewed mark artwork.' },
  documentItems: [
    {
      documentItemId: 'document-item_story025',
      requirementKey: 'MARK_REPRESENTATION_FILE',
      originalFileName: 'orbit-mark.pdf',
      verificationStatus: 'RECORDED'
    }
  ],
  instructionEntries: [
    {
      instructionEntryId: 'instruction-entry_story025_1',
      sequence: 1,
      instructionType: 'FILING_SCOPE',
      structuredPayload: { text: 'Use reviewed class scope.' }
    },
    {
      instructionEntryId: 'instruction-entry_story025_2',
      sequence: 2,
      instructionType: 'FILING_SCOPE',
      structuredPayload: { text: 'Use corrected reviewed class scope.' },
      supersedesEntryId: 'instruction-entry_story025_1'
    }
  ],
  createdBy: 'user_story025',
  updatedBy: 'user_story025',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:05:00.000Z'
};
const meta = {
  title: 'Lite/Document Package Workspace',
  component: DocumentPackageWorkspace,
  parameters: { layout: 'fullscreen' },
  args: { workspaceId: base.workspaceId }
} satisfies Meta<typeof DocumentPackageWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Draft: Story = { args: { initialPackage: base } };
export const CompletedReviewNotStarted: Story = {
  args: {
    initialReview: completedReviewFixture,
    packageClient: packageClientForScenario('from-review'),
    reviewClient: reviewClientForScenario('from-review')
  }
};
export const Loading: Story = {
  args: {
    packageId: previewPackageId,
    packageClient: packageClientForScenario('loading')
  }
};
export const PermissionDenied: Story = {
  args: {
    packageId: previewPackageId,
    packageClient: packageClientForScenario('permission')
  }
};
export const VersionConflict: Story = {
  args: {
    packageId: previewPackageId,
    packageClient: packageClientForScenario('conflict')
  }
};
export const ServiceUnavailable: Story = {
  args: {
    packageId: previewPackageId,
    packageClient: packageClientForScenario('unavailable')
  }
};
export const ReadyForPreparationLock: Story = {
  args: {
    initialPackage: {
      ...base,
      status: 'READY_FOR_PREPARATION_LOCK',
      version: 5,
      readyAt: '2026-08-01T10:06:00.000Z',
      readyBy: 'user_story025',
      canonicalEvidenceHash: 'c'.repeat(64)
    }
  }
};
